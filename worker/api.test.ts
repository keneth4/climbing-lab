import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { handle } from './index';
let mf: Miniflare;
let a: Env;
let b: Env;
const asUser = (id: string) => async () => id;
const req = (path: string, body?: unknown) =>
  new Request(
    `https://local.test${path}`,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: ['gym-a', 'gym-b'].map((name) => ({
        name,
        modules: true,
        script: 'export default {fetch(){return new Response("local")}}',
        compatibilityDate: '2026-10-12',
        d1Databases: { DB: name },
      })),
    }),
  );
  let migration = await readFile(
    new URL('../migrations/0001_initial.sql', import.meta.url),
    'utf8',
  );
  migration +=
    '\n' +
    (await readFile(
      new URL('../migrations/0002_digital_twin.sql', import.meta.url),
      'utf8',
    ));
  migration +=
    '\n' +
    (await readFile(
      new URL('../migrations/0003_capture_camera.sql', import.meta.url),
      'utf8',
    ));
  migration +=
    '\n' +
    (await readFile(
      new URL('../migrations/0004_section_geometry.sql', import.meta.url),
      'utf8',
    ));
  migration +=
    '\n' +
    (await readFile(
      new URL('../migrations/0005_section_revisions.sql', import.meta.url),
      'utf8',
    ));
  const envs = [];
  for (const id of ['gym-a', 'gym-b']) {
    const db = await mf.getD1Database('DB', id);
    for (const sql of migration.split(';').filter((s) => s.trim()))
      await db.prepare(sql).run();
    const route = id === 'gym-a' ? 'route-a' : 'route-b';
    await db
      .prepare('INSERT INTO routes(id,name,grade,sector) VALUES(?,?,?,?)')
      .bind(route, id, 'V2', 'Spray wall')
      .run();
    await db
      .prepare(
        'INSERT INTO route_revisions(route_id,revision,snapshot) VALUES(?,?,?)',
      )
      .bind(route, 1, JSON.stringify({ name: id, holds: [] }))
      .run();
    await db
      .prepare('INSERT INTO staff VALUES(?,?)')
      .bind(id === 'gym-a' ? 'alice' : 'bob', 'editor')
      .run();
    await db
      .prepare('INSERT INTO sections(id,name,bounds) VALUES(?,?,?)')
      .bind(
        'section-' + id,
        'Wall',
        JSON.stringify({ min: [0, 0, 0], max: [1, 1, 1] }),
      )
      .run();
    await db
      .prepare('UPDATE routes SET section_id=? WHERE id=?')
      .bind('section-' + id, route)
      .run();
    await db
      .prepare(
        "INSERT INTO captures(id,filename,size,object_key,upload_id,status,upload_state,transform,created_by,created_at) VALUES(?,?,?,?,?,'published','ready',?,?,?)",
      )
      .bind(
        'cap-' + id,
        'fixture.ply',
        100,
        'fixture-' + id,
        'fixture',
        JSON.stringify({
          scale: 1,
          rotation: [0, 0, 0, 1],
          translation: [0, 0, 0],
        }),
        'owner',
        new Date().toISOString(),
      )
      .run();
    await db
      .prepare('UPDATE gym_state SET active_capture_id=?')
      .bind('cap-' + id)
      .run();
    envs.push({
      DB: db,
      GYM_ID: id,
      AUTH_ISSUER: 'https://auth.invalid',
      AUTH_AUDIENCE: 'authenticated',
    });
  }
  [a, b] = envs as Env[];
}, 30000);
afterAll(async () => mf?.dispose());
describe('per-gym D1 isolation', () => {
  it('each deployment only sees its bound catalog', async () => {
    const ra = await (await handle(req('/api/routes'), a)).json();
    const rb = await (await handle(req('/api/routes'), b)).json();
    expect(ra.routes.map((r: { id: string }) => r.id)).toEqual(['route-a']);
    expect(rb.routes.map((r: { id: string }) => r.id)).toEqual(['route-b']);
    expect((await handle(req('/api/routes/route-a'), b)).status).toBe(404);
  });
  it('does not accept tenant selection or staff headers as authentication', async () => {
    expect((await handle(req('/api/routes?gymId=gym-b'), a)).status).toBe(400);
    expect(
      (
        await handle(
          new Request('https://local.test/api/staff/reports', {
            headers: { 'X-User-Id': 'alice', 'X-Role': 'admin' },
          }),
          a,
        )
      ).status,
    ).toBe(401);
  });
  it('staff in A is not staff in B', async () => {
    expect(
      (await handle(req('/api/staff/reports'), a, asUser('alice'))).status,
    ).toBe(200);
    expect(
      (await handle(req('/api/staff/reports'), b, asUser('alice'))).status,
    ).toBe(403);
  });
  it('cannot write a foreign route or impersonate entry owner', async () => {
    expect(
      (
        await handle(
          req('/api/entries', {
            routeId: 'route-a',
            attempts: 1,
            result: 'ascenso',
          }),
          b,
          asUser('alice'),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handle(
          req('/api/entries', {
            routeId: 'route-a',
            attempts: 1,
            result: 'ascenso',
            user_id: 'bob',
          }),
          a,
          asUser('alice'),
        )
      ).status,
    ).toBe(400);
  });
  it('entries are owned, durable and absent in another gym', async () => {
    expect(
      (
        await handle(
          req('/api/entries', {
            routeId: 'route-a',
            attempts: 2,
            result: 'ascenso',
          }),
          a,
          asUser('alice'),
        )
      ).status,
    ).toBe(201);
    const alice = await (
      await handle(req('/api/entries'), a, asUser('alice'))
    ).json();
    const bob = await (
      await handle(req('/api/entries'), a, asUser('bob'))
    ).json();
    const other = await (
      await handle(req('/api/entries'), b, asUser('alice'))
    ).json();
    expect(alice.entries).toHaveLength(1);
    expect(bob.entries).toHaveLength(0);
    expect(other.entries).toHaveLength(0);
  });
  it('reports require local staff to resolve and leave an audit event', async () => {
    const result = await (
      await handle(
        req('/api/reports', {
          routeId: 'route-a',
          description: 'Agarre incorrecto',
        }),
        a,
        asUser('bob'),
      )
    ).json();
    expect(
      (
        await handle(
          req(`/api/staff/reports/${result.id}/resolve`, {}),
          a,
          asUser('bob'),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handle(
          req(`/api/staff/reports/${result.id}/resolve`, {}),
          b,
          asUser('bob'),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handle(
          req(`/api/staff/reports/${result.id}/resolve`, {}),
          a,
          asUser('alice'),
        )
      ).status,
    ).toBe(200);
    expect(
      await a.DB.prepare('SELECT COUNT(*) AS n FROM audit_events').first('n'),
    ).toBe(1);
  });
  it('rejects invalid inputs and oversized streamed bodies', async () => {
    expect(
      (
        await handle(
          req('/api/entries', {
            routeId: 'route-a',
            attempts: 1.5,
            result: 'ascenso',
          }),
          a,
          asUser('alice'),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handle(
          req('/api/reports', {
            routeId: 'route-a',
            description: 'x'.repeat(9000),
          }),
          a,
          asUser('alice'),
        )
      ).status,
    ).toBe(413);
    expect(
      (await handle(req('/api/entries?limit=101'), a, asUser('alice'))).status,
    ).toBe(400);
  });
  it('configured default handler never enables a demo token bypass', async () => {
    expect(
      (
        await handle(
          new Request('https://local.test/api/entries', {
            headers: { Authorization: 'Bearer demo-alice' },
          }),
          a,
        )
      ).status,
    ).toBe(401);
  });
});
it('only local staff can create routes and snapshot the camera', async () => {
  const payload = {
    name: 'Nueva ruta',
    sectionId: 'section-gym-a',
    grade: 'V4',
    sector: 'Spray wall',
    beta: 'Cruce',
    status: 'activa',
    holds: [],
    camera: {
      captureId: 'cap-gym-a',
      yaw: 0,
      pitch: 0,
      distance: 4,
      target: [0, 0, 0],
    },
  };
  expect(
    (await handle(req('/api/routes', payload), a, asUser('visitor'))).status,
  ).toBe(403);
  expect(
    (await handle(req('/api/routes', payload), b, asUser('alice'))).status,
  ).toBe(403);
  const response = await handle(
    req('/api/routes', payload),
    a,
    asUser('alice'),
  );
  expect(response.status).toBe(201);
  const created = await response.json();
  expect(created.revision).toBe(1);
  expect(created.snapshot.camera.distance).toBe(4);
  expect(created.snapshot.sectionRevision).toBe(1);
  expect((await handle(req(`/api/routes/${created.id}`), b)).status).toBe(404);
});
it('revision changes preserve ascent identity and reject stale edits', async () => {
  const payload = {
    name: 'Ruta renombrada',
    grade: 'V5',
    sector: 'Spray wall',
    beta: 'Nueva beta',
    status: 'activa',
    holds: [],
    expectedRevision: 1,
  };
  const update = () =>
    new Request('https://local.test/api/routes/route-a', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  const responses = await Promise.all([
    handle(update(), a, asUser('alice')),
    handle(update(), a, asUser('alice')),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  const entries = await (
    await handle(req('/api/entries'), a, asUser('alice'))
  ).json();
  expect(entries.entries[0].revision).toBe(1);
  expect(entries.entries[0].route_name).toBe('gym-a');
  const current = await (await handle(req('/api/routes/route-a'), a)).json();
  expect(current.revision).toBe(2);
  expect(current.snapshot.name).toBe('Ruta renombrada');
});
it('validates camera geometry before storing a revision', async () => {
  const response = await handle(
    req('/api/routes', {
      name: 'Bad',
      grade: 'V1',
      sector: 'Wall',
      beta: '',
      status: 'activa',
      holds: [],
      camera: {
        captureId: 'x',
        yaw: 0,
        pitch: 0,
        distance: -1,
        target: [0, 0, 0],
      },
    }),
    a,
    asUser('alice'),
  );
  expect(response.status).toBe(400);
});
it('validates 3D markers and preserves their positions in historical ascents', async () => {
  const payload = {
    name: '3D route',
    grade: 'V2',
    sector: 'Wall',
    sectionId: 'section-gym-a',
    captureId: 'cap-gym-a',
    beta: 'Start with both hands',
    status: 'activa',
    holds: [],
    holds3D: [{ id: 'hold-3d', position: [1, 2, 3], role: 'inicio' }],
  };
  const post = (v: unknown, user = 'alice') =>
    handle(req('/api/routes', v), a, asUser(user));
  expect((await post(payload, 'visitor')).status).toBe(403);
  expect((await post({ ...payload, captureId: undefined })).status).toBe(400);
  expect((await post({ ...payload, captureId: 'cap-gym-b' })).status).toBe(409);
  expect(
    (
      await post({
        ...payload,
        holds3D: [{ id: 'bad', position: [1, 2, null], role: 'inicio' }],
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await post({
        ...payload,
        holds3D: [...payload.holds3D, ...payload.holds3D],
      })
    ).status,
  ).toBe(400);
  const created = await (await post(payload)).json();
  expect(created.snapshot.holds3D).toEqual(payload.holds3D);
  expect(
    (
      await handle(
        req('/api/entries', {
          routeId: created.id,
          attempts: 1,
          result: 'ascenso',
          notes: '',
        }),
        a,
        asUser('marker-visitor'),
      )
    ).status,
  ).toBe(201);
  const updated = await handle(
    new Request('https://local.test/api/routes/' + created.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        expectedRevision: 1,
        holds3D: [{ ...payload.holds3D[0], position: [2, 3, 4] }],
      }),
    }),
    a,
    asUser('alice'),
  );
  expect(updated.status).toBe(200);
  const legacy = await handle(
    new Request('https://local.test/api/routes/' + created.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        expectedRevision: 2,
        holds3D: undefined,
      }),
    }),
    a,
    asUser('alice'),
  );
  expect(legacy.status).toBe(200);
  expect((await legacy.json()).snapshot.holds3D[0].position).toEqual([2, 3, 4]);

  const rows = await a.DB.prepare(
    "SELECT rr.snapshot FROM entries e JOIN route_revisions rr ON rr.route_id=e.route_id AND rr.revision=e.revision WHERE e.user_id='marker-visitor'",
  ).all<{ snapshot: string }>();
  expect(JSON.parse(rows.results[0].snapshot).holds3D).toEqual(payload.holds3D);
  expect((await handle(req('/api/routes/' + created.id), b)).status).toBe(404);
});
it('filters and paginates private activity with a complete summary isolated by account and gym', async () => {
  const values = Array.from({ length: 60 }, (_, i) => ({
    id: 'journal-' + i,
    attempts: i + 1,
    result: i % 2 ? 'intento' : 'ascenso',
    date: i % 2 ? '2026-01-11T12:00:00.000Z' : '2026-01-10T12:00:00.000Z',
  }));
  await a.DB.prepare(
    "INSERT INTO entries(id,user_id,route_id,revision,attempts,result,notes,created_at) SELECT json_extract(value,'$.id'),'journal-user','route-a',1,json_extract(value,'$.attempts'),json_extract(value,'$.result'),'private',json_extract(value,'$.date') FROM json_each(?)",
  )
    .bind(JSON.stringify(values))
    .run();
  const get = (path: string, env = a, user = 'journal-user') =>
    handle(req(path), env, asUser(user));
  const response = await get('/api/entries?limit=10');
  expect(response.status).toBe(200);
  const all = await response.json();
  expect(all.entries).toHaveLength(10);
  expect(all.summary).toEqual({
    records: 60,
    attempts: 1830,
    ascents: 30,
    routes: 1,
  });
  expect(all.pagination.hasMore).toBe(true);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const filtered = await (
    await get(
      '/api/entries?from=2026-01-11T00%3A00%3A00.000Z&until=2026-01-12T00%3A00%3A00.000Z&result=intento&limit=10&offset=20',
    )
  ).json();
  expect(filtered.summary).toEqual({
    records: 30,
    attempts: 930,
    ascents: 0,
    routes: 1,
  });
  expect(filtered.entries).toHaveLength(10);
  expect(filtered.pagination.hasMore).toBe(false);
  expect(
    (await (await get('/api/entries', a, 'other-user')).json()).summary.records,
  ).toBe(0);
  expect((await (await get('/api/entries', b)).json()).summary.records).toBe(0);
  expect((await get('/api/entries?result=bad')).status).toBe(400);
  expect((await get('/api/entries?from=bad')).status).toBe(400);
  expect(
    (
      await get(
        '/api/entries?from=2026-01-12T00%3A00%3A00.000Z&until=2026-01-11T00%3A00%3A00.000Z',
      )
    ).status,
  ).toBe(400);
});
