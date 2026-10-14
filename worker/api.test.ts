import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { handle } from './index';
import { presentationKey } from './pilot';
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
  migration +=
    '\n' +
    (await readFile(
      new URL('../migrations/0006_entry_history.sql', import.meta.url),
      'utf8',
    ));
  migration +=
    '\n' +
    (await readFile(
      new URL('../migrations/0007_projects.sql', import.meta.url),
      'utf8',
    ));
  migration +=
    '\n' +
    (await readFile(
      new URL('../migrations/0008_operations.sql', import.meta.url),
      'utf8',
    ));
  migration +=
    '\n' +
    (await readFile(
      new URL('../migrations/0009_pilot_ux.sql', import.meta.url),
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
          req(`/api/staff/reports/${result.id}/resolve`, {
            resolution: 'Agarre revisado por staff',
          }),
          a,
          asUser('bob'),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handle(
          req(`/api/staff/reports/${result.id}/resolve`, {
            resolution: 'Agarre revisado por staff',
          }),
          b,
          asUser('bob'),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await handle(
          req(`/api/staff/reports/${result.id}/resolve`, {
            resolution: 'Agarre revisado por staff',
          }),
          a,
          asUser('alice'),
        )
      ).status,
    ).toBe(200);
    expect(
      await a.DB.prepare(
        "SELECT COUNT(*) AS n FROM audit_events WHERE action='report.resolve'",
      ).first('n'),
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
async function presentation<T extends Record<string, any>>(
  input: T,
): Promise<T & Record<string, any>> {
  const camera = input.camera || {
    captureId: 'cap-gym-a',
    yaw: 0,
    pitch: 0,
    distance: 4,
    target: [0, 0, 0],
  };
  const holds3D = input.holds3D || [
    { id: 'start', position: [0, 0, 0], role: 'inicio' },
    { id: 'finish', position: [1, 1, 0], role: 'final' },
  ];
  const imageId = crypto.randomUUID();
  await a.DB.prepare('INSERT INTO route_images VALUES(?,?,?,?,?,?)')
    .bind(
      imageId,
      'cap-gym-a',
      'images/' + imageId,
      'alice',
      new Date().toISOString(),
      presentationKey(camera, holds3D),
    )
    .run();
  return {
    ...input,
    captureId: 'cap-gym-a',
    camera,
    holds3D,
    imageId,
    gradeScale: 'V',
    markersVerified: true,
  };
}
it('only local staff can create routes and snapshot the camera', async () => {
  const payload = await presentation({
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
  });
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
  const payload = await presentation({
    name: 'Ruta renombrada',
    grade: 'V5',
    sector: 'Spray wall',
    beta: 'Nueva beta',
    status: 'activa',
    holds: [],
    expectedRevision: 1,
  });
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
  const payload = await presentation({
    name: '3D route',
    grade: 'V2',
    sector: 'Wall',
    sectionId: 'section-gym-a',
    captureId: 'cap-gym-a',
    beta: 'Start with both hands',
    status: 'activa',
    holds: [],
    holds3D: [
      { id: 'hold-3d', position: [1, 2, 3], role: 'inicio' },
      { id: 'finish-3d', position: [2, 4, 3], role: 'final' },
    ],
  });
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
  const moved = await presentation({
    ...payload,
    holds3D: [
      { ...payload.holds3D[0], position: [2, 3, 4] },
      payload.holds3D[1],
    ],
  });
  const updated = await handle(
    new Request('https://local.test/api/routes/' + created.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...moved,
        expectedRevision: 1,
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
        ...moved,
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
it('lets only the owner correct or retire a record atomically while preserving its route and history', async () => {
  const owner = 'entry-owner';
  const created = await (
    await handle(
      req('/api/entries', {
        routeId: 'route-a',
        attempts: 2,
        result: 'ascenso',
        notes: 'original',
      }),
      a,
      asUser(owner),
    )
  ).json();
  const id = created.id;
  const call = (method: string, value: unknown, user = owner, env = a) =>
    handle(
      new Request('https://local.test/api/entries/' + id, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      }),
      env,
      asUser(user),
    );
  const history = (user = owner, env = a) =>
    handle(req(`/api/entries/${id}/history`), env, asUser(user));
  const first = await (await history()).json();
  expect(first.history).toHaveLength(1);
  expect(first.history[0].action).toBe('created');
  expect((await history('alice')).status).toBe(404);
  expect((await history(owner, b)).status).toBe(404);
  const edit = {
    expectedVersion: 1,
    attempts: 3,
    result: 'intento',
    notes: 'corrected',
  };
  expect((await call('PUT', edit, 'alice')).status).toBe(404);
  expect((await call('PUT', { ...edit, routeId: 'other-route' })).status).toBe(
    400,
  );
  expect((await call('PUT', { ...edit, attempts: 0 })).status).toBe(400);
  const concurrent = await Promise.all([
    call('PUT', edit),
    call('PUT', { ...edit, notes: 'another edit' }),
  ]);
  expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
  const second = await (await history()).json();
  expect(second.history).toHaveLength(2);
  expect(second.history[0].snapshot.routeRevision).toBe(
    first.history[0].snapshot.routeRevision,
  );
  expect(second.history[0].snapshot.createdAt).toBe(
    first.history[0].snapshot.createdAt,
  );
  expect(second.history[1].snapshot.notes).toBe('original');
  expect((await call('PUT', edit)).status).toBe(409);
  expect((await call('DELETE', { expectedVersion: 2 })).status).toBe(200);
  expect((await call('DELETE', { expectedVersion: 3 })).status).toBe(409);
  const current = await (
    await handle(req('/api/entries'), a, asUser(owner))
  ).json();
  expect(current.entries).toEqual([]);
  expect(current.summary.records).toBe(0);
  const retired = await (
    await handle(req('/api/entries?state=deleted'), a, asUser(owner))
  ).json();
  expect(retired.entries).toHaveLength(1);
  expect(retired.entries[0].entry_version).toBe(3);
  const final = await (await history()).json();
  expect(final.history.map((r: { action: string }) => r.action)).toEqual([
    'deleted',
    'updated',
    'created',
  ]);
  expect(
    await a.DB.prepare(
      'SELECT COUNT(*) AS n FROM audit_events WHERE object_id=?',
    )
      .bind(id)
      .first('n'),
  ).toBe(3);
});

it('stores past activity separately from audit time and rejects invalid or future timestamps', async () => {
  const owner = 'past-activity';
  const create = (occurredAt: unknown) =>
    handle(
      req('/api/entries', {
        routeId: 'route-a',
        attempts: 1,
        result: 'intento',
        notes: 'past',
        occurredAt,
      }),
      a,
      asUser(owner),
    );
  for (const value of [
    'bad',
    '2026-02-30T12:00:00.000Z',
    '2999-01-01T00:00:00.000Z',
    '2026-01-01',
    123,
  ])
    expect((await create(value)).status).toBe(400);
  const occurredAt = '2020-01-15T18:30:00.000Z';
  const response = await create(occurredAt);
  expect(response.status).toBe(201);
  const { id } = await response.json();
  const row = await a.DB.prepare('SELECT created_at FROM entries WHERE id=?')
    .bind(id)
    .first();
  expect(row?.created_at).toBe(occurredAt);
  const history = await a.DB.prepare(
    'SELECT snapshot,changed_at FROM entry_history WHERE entry_id=?',
  )
    .bind(id)
    .first<{ snapshot: string; changed_at: string }>();
  expect(JSON.parse(history!.snapshot).createdAt).toBe(occurredAt);
  expect(Date.parse(history!.changed_at)).toBeGreaterThan(
    Date.parse(occurredAt),
  );
});

it('exports the complete private interval without pagination or silent truncation', async () => {
  const owner = 'export-owner';
  await a.DB.prepare(
    "INSERT INTO entries(id,user_id,route_id,revision,attempts,result,notes,created_at) SELECT 'export-'||value,?,'route-a',1,1,'ascenso','=private','2020-01-01T00:00:00.000Z' FROM json_each(?)",
  )
    .bind(owner, JSON.stringify(Array.from({ length: 55 }, (_, i) => i)))
    .run();
  const get = (q = '', user = owner, env = a) =>
    handle(req('/api/entries?export=csv' + q), env, asUser(user));
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  const csv = await response.json();
  expect(csv.records).toBe(55);
  expect(csv.csv.split('\r\n')).toHaveLength(56);
  expect(csv.csv).toContain("'=private");
  expect((await (await get('', 'another')).json()).records).toBe(0);
  expect((await (await get('', owner, b)).json()).records).toBe(0);
  expect((await (await get('&result=intento')).json()).records).toBe(0);
  expect((await get('&offset=0')).status).toBe(400);
  await a.DB.prepare(
    "INSERT INTO entries(id,user_id,route_id,revision,attempts,result,notes,created_at) SELECT 'large-export-'||value,?,'route-a',1,1,'intento','','2021-01-01T00:00:00.000Z' FROM json_each(?)",
  )
    .bind(owner, JSON.stringify(Array.from({ length: 2001 }, (_, i) => i)))
    .run();
  expect((await get()).status).toBe(400);
  expect(
    (await (await get('&until=2021-01-01T00%3A00%3A00.000Z')).json()).records,
  ).toBe(55);
});

it('projects are private, versioned and do not automatically complete after ascents', async () => {
  const call = (
    path: string,
    value?: unknown,
    user = 'project-user',
    env = a,
    method = 'POST',
  ) =>
    handle(
      value === undefined
        ? req(path)
        : new Request('https://local.test' + path, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value),
          }),
      env,
      asUser(user),
    );
  const response = await call('/api/projects', {
    routeId: 'route-a',
    notes: 'Goal',
  });
  expect(response.status).toBe(201);
  const { project } = await response.json();
  expect(
    (await (await call('/api/projects', undefined, 'other')).json()).projects,
  ).toHaveLength(0);
  expect(
    (
      await call(
        '/api/projects/' + project.id,
        { expectedVersion: 1, status: 'completado', notes: 'x' },
        'other',
        a,
        'PUT',
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await call(
        '/api/projects',
        { routeId: 'route-a', notes: '' },
        'project-user',
        b,
      )
    ).status,
  ).toBe(404);
  const edits = await Promise.all([
    call(
      '/api/projects/' + project.id,
      { expectedVersion: 1, status: 'completado', notes: 'Done' },
      'project-user',
      a,
      'PUT',
    ),
    call(
      '/api/projects/' + project.id,
      { expectedVersion: 1, status: 'archivado', notes: 'Archived' },
      'project-user',
      a,
      'PUT',
    ),
  ]);
  expect(edits.map((r) => r.status).sort()).toEqual([200, 409]);
  const history = await (
    await call('/api/projects/' + project.id, undefined)
  ).json();
  expect(history.history).toHaveLength(2);
});
it('daily activity uses the gym timezone and includes the complete interval excluding retired entries', async () => {
  await a.DB.prepare(
    "INSERT INTO entries(id,user_id,route_id,revision,attempts,result,notes,created_at) SELECT 'day-'||value,'daily-user','route-a',1,2,'ascenso','','2026-01-12T03:00:00.000Z' FROM json_each(?)",
  )
    .bind(JSON.stringify(Array.from({ length: 55 }, (_, i) => i)))
    .run();
  const get = (user = 'daily-user', env = a) =>
    handle(req('/api/entries?group=day'), env, asUser(user));
  const d = await (await get()).json();
  expect(d.days).toEqual([
    { date: '2026-01-11', records: 55, attempts: 110, ascents: 55, routes: 1 },
  ]);
  await a.DB.prepare(
    "UPDATE entries SET deleted_at='2026-01-13T00:00:00.000Z' WHERE id='day-0'",
  ).run();
  expect((await (await get()).json()).days[0].records).toBe(54);
  expect((await (await get('other')).json()).days).toHaveLength(0);
  expect((await (await get('daily-user', b)).json()).days).toHaveLength(0);
});
it('reception, memberships, payments and inventory enforce permissions and atomic reversals', async () => {
  await a.DB.prepare(
    "INSERT INTO staff(user_id,role) VALUES('ops-admin','admin')",
  ).run();
  const post = (path: string, value: unknown, user = 'ops-admin', env = a) =>
    handle(req(path, value), env, asUser(user));
  const get = (path: string, user = 'ops-admin', env = a) =>
    handle(req(path), env, asUser(user));
  const created = await post('/api/members', { name: 'Pilot member' });
  expect(created.status).toBe(201);
  const memberId = (await created.json()).id;
  expect(
    (
      await post(
        '/api/plans',
        { name: 'x', kind: 'entries', quantity: 1, price: 100 },
        'alice',
      )
    ).status,
  ).toBe(403);
  expect((await get('/api/members', 'visitor')).status).toBe(403);
  const plan = await post('/api/plans', {
    name: 'Pass',
    kind: 'entries',
    quantity: 1,
    price: 10000,
  });
  expect(plan.status).toBe(201);
  const planId = (await plan.json()).id;
  const pay = await post('/api/payments', {
    memberId,
    planId,
    startDay: '2020-01-01',
    endDay: '2999-01-01',
    method: 'transfer',
    reference: 'bank',
  });
  expect(pay.status).toBe(201);
  const { id: paymentId, membershipId } = await pay.json();
  const credential = await post('/api/credentials', { memberId }, 'alice');
  expect(credential.status).toBe(201);
  const { id: credentialId, token } = await credential.json();
  let resolve = await post('/api/reception/resolve', { token }, 'alice');
  expect((await resolve.json()).memberships).toHaveLength(0);
  const confirmations = await Promise.all([
    post('/api/payments/' + paymentId + '/confirm', { expectedVersion: 1 }),
    post('/api/payments/' + paymentId + '/confirm', { expectedVersion: 1 }),
  ]);
  expect(confirmations.map((r) => r.status).sort()).toEqual([200, 409]);
  resolve = await post('/api/reception/resolve', { token }, 'alice');
  expect((await resolve.json()).memberships[0].remaining).toBe(1);
  expect(
    (await post('/api/reception/resolve', { token }, 'bob', b)).status,
  ).toBe(404);
  const visits = await Promise.all([
    post('/api/visits', { credentialId, membershipId, consume: true }, 'alice'),
    post('/api/visits', { credentialId, membershipId, consume: true }, 'alice'),
  ]);
  expect(visits.filter((r) => r.status === 201)).toHaveLength(1);
  expect(
    await a.DB.prepare('SELECT remaining FROM memberships WHERE id=?')
      .bind(membershipId)
      .first('remaining'),
  ).toBe(0);
  const repeat = await post(
    '/api/visits',
    { credentialId, membershipId, consume: true },
    'alice',
  );
  expect(repeat.status).toBe(200);
  const repeated = await repeat.json();
  expect(repeated.duplicate).toBe(true);
  expect(
    (
      await post(
        `/api/visits/${repeated.visit.id}/void`,
        { expectedVersion: 1, reason: 'Wrong visit' },
        'alice',
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await post(
        `/api/visits/${repeated.visit.id}/void`,
        { expectedVersion: 1, reason: 'Repeat' },
        'alice',
      )
    ).status,
  ).toBe(409);
  expect(
    await a.DB.prepare('SELECT remaining FROM memberships WHERE id=?')
      .bind(membershipId)
      .first('remaining'),
  ).toBe(1);
  await post('/api/credentials', { memberId }, 'alice');
  expect(
    (await post('/api/reception/resolve', { token }, 'alice')).status,
  ).toBe(404);
  const product = await post('/api/products', {
    name: 'Chalk',
    variant: 'Bag',
    sku: 'chalk-test',
    price: 2000,
    stock: 1,
  });
  expect(product.status).toBe(201);
  const variantId = (await product.json()).variantId;
  expect((await get('/api/products', 'visitor')).status).toBe(200);
  const s1 = await post('/api/sales', {
      lines: [{ variantId, quantity: 1 }],
      method: 'cash',
      reference: 'x',
    }),
    s2 = await post('/api/sales', {
      lines: [{ variantId, quantity: 1 }],
      method: 'cash',
      reference: 'y',
    });
  const sale1 = await s1.json(),
    sale2 = await s2.json();
  const sold = await Promise.all([
    post(`/api/payments/${sale1.paymentId}/confirm`, { expectedVersion: 1 }),
    post(`/api/payments/${sale2.paymentId}/confirm`, { expectedVersion: 1 }),
  ]);
  expect(sold.map((r) => r.status).sort()).toEqual([200, 409]);
  const winner = sold[0].status === 200 ? sale1 : sale2;
  expect(
    await a.DB.prepare('SELECT stock FROM variants WHERE id=?')
      .bind(variantId)
      .first('stock'),
  ).toBe(0);
  expect(
    (
      await post(`/api/payments/${winner.paymentId}/void`, {
        expectedVersion: 2,
        reason: 'Return',
      })
    ).status,
  ).toBe(200);
  expect(
    await a.DB.prepare('SELECT stock FROM variants WHERE id=?')
      .bind(variantId)
      .first('stock'),
  ).toBe(1);
  expect(
    (
      await post(`/api/payments/${winner.paymentId}/void`, {
        expectedVersion: 2,
        reason: 'Again',
      })
    ).status,
  ).toBe(409);
  const report = await (await get('/api/finance')).json();
  expect(report.totals.confirmed).toBe(10000);
  expect(report.totals.sales).toBe(0);
  expect((await get('/api/finance', 'alice')).status).toBe(403);
  expect((await get('/api/payments', 'visitor')).status).toBe(403);
  expect((await (await get('/api/finance?export=csv')).json()).csv).toContain(
    'Importe centavos',
  );
});
it('pending and expired memberships cannot consume entries and business histories remain private', async () => {
  const post = (path: string, value: unknown, user = 'ops-admin') =>
    handle(req(path, value), a, asUser(user));
  const memberId = (
    await (await post('/api/members', { name: 'Expired member' })).json()
  ).id;
  const planId = (
    await (
      await post('/api/plans', {
        name: 'Old period',
        kind: 'period',
        quantity: 1,
        price: 500,
      })
    ).json()
  ).id;
  const pending = await (
    await post('/api/payments', {
      memberId,
      planId,
      startDay: '2020-01-01',
      method: 'transfer',
      reference: '',
    })
  ).json();
  const c = await (
    await post('/api/credentials', { memberId }, 'alice')
  ).json();
  expect(
    (
      await post(
        '/api/visits',
        {
          credentialId: c.id,
          membershipId: pending.membershipId,
          consume: false,
        },
        'alice',
      )
    ).status,
  ).toBe(400);
  await post(`/api/payments/${pending.id}/confirm`, { expectedVersion: 1 });
  expect(
    (
      await post(
        '/api/visits',
        {
          credentialId: c.id,
          membershipId: pending.membershipId,
          consume: false,
        },
        'alice',
      )
    ).status,
  ).toBe(400);
  const ownerHistory = await handle(
    req(`/api/payments/${pending.id}/history`),
    a,
    asUser('ops-admin'),
  );
  expect(ownerHistory.status).toBe(200);
  expect((await ownerHistory.json()).history).toHaveLength(2);
  expect(
    (
      await handle(
        req(`/api/payments/${pending.id}/history`),
        a,
        asUser('alice'),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await post(`/api/payments/${pending.id}/void`, {
        expectedVersion: 2,
        reason: 'Old membership',
      })
    ).status,
  ).toBe(200);
  expect(
    await a.DB.prepare('SELECT status FROM memberships WHERE id=?')
      .bind(pending.membershipId)
      .first('status'),
  ).toBe('revoked');
  const entry = await (
    await post(
      '/api/entries',
      { routeId: 'route-a', attempts: 1, result: 'ascenso', notes: '' },
      'presentation-owner',
    )
  ).json();
  expect(
    (
      await handle(
        req(`/api/entries/${entry.id}/presentation`),
        a,
        asUser('other-user'),
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await handle(
        req(`/api/entries/${entry.id}/presentation`),
        a,
        asUser('presentation-owner'),
      )
    ).status,
  ).toBe(200);
});

it('a multi-line sale rolls back all stock when one line is unavailable', async () => {
  const post = (path: string, value: unknown) =>
    handle(req(path, value), a, asUser('ops-admin'));
  const first = await (
    await post('/api/products', {
      name: 'Available',
      variant: 'One',
      sku: 'multi-available',
      price: 100,
      stock: 1,
    })
  ).json();
  const second = await (
    await post('/api/products', {
      name: 'Unavailable',
      variant: 'Zero',
      sku: 'multi-empty',
      price: 100,
      stock: 0,
    })
  ).json();
  const sale = await (
    await post('/api/sales', {
      lines: [
        { variantId: first.variantId, quantity: 1 },
        { variantId: second.variantId, quantity: 1 },
      ],
      method: 'cash',
      reference: '',
    })
  ).json();
  expect(
    (
      await post(`/api/payments/${sale.paymentId}/confirm`, {
        expectedVersion: 1,
      })
    ).status,
  ).toBe(409);
  expect(
    await a.DB.prepare('SELECT stock FROM variants WHERE id=?')
      .bind(first.variantId)
      .first('stock'),
  ).toBe(1);
  expect(
    await a.DB.prepare('SELECT status FROM payments WHERE id=?')
      .bind(sale.paymentId)
      .first('status'),
  ).toBe('pending');
});

it('keeps incomplete drafts private and rejects publishing without the complete presentation', async () => {
  const draft = {
    name: '',
    grade: '',
    sector: '',
    beta: '',
    status: 'borrador',
    holds: [],
  };
  const created = await handle(req('/api/routes', draft), a, asUser('alice'));
  expect(created.status).toBe(201);
  const d = await created.json();
  const visitor = async () => {
    throw new Error('An unauthenticated request must not read a draft');
  };
  expect(
    (await handle(req(`/api/routes/${d.id}`), a, asUser('visitor'))).status,
  ).toBe(403);
  const pub = await (await handle(req('/api/routes'), a, visitor)).json();
  expect(pub.routes.some((r: any) => r.id === d.id)).toBe(false);
  expect(
    (await handle(req('/api/routes?status=borrador'), a, asUser('visitor')))
      .status,
  ).toBe(403);
  expect(
    (
      await handle(
        req('/api/projects', { routeId: d.id, notes: '' }),
        a,
        asUser('visitor'),
      )
    ).status,
  ).toBe(404);
  const list = await (
    await handle(req('/api/routes?status=borrador'), a, asUser('alice'))
  ).json();
  expect(list.routes.some((r: any) => r.id === d.id)).toBe(true);
  expect(
    (
      await handle(
        req('/api/entries', { routeId: d.id, attempts: 1, result: 'intento' }),
        a,
        asUser('visitor'),
      )
    ).status,
  ).toBe(404);
  const request = new Request(`https://local.test/api/routes/${d.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...draft,
      name: 'Incomplete',
      grade: 'V2',
      sector: 'Wall',
      sectionId: 'section-gym-a',
      status: 'activa',
      expectedRevision: 1,
    }),
  });
  expect((await handle(request, a, asUser('alice'))).status).toBe(400);
});
it('idempotent concurrent activity requests preserve ownership and reject changed payloads and stale revisions', async () => {
  const row = await a.DB.prepare(
    "SELECT MAX(revision) AS n FROM route_revisions WHERE route_id='route-a'",
  ).first<{ n: number }>();
  const payload = {
    routeId: 'route-a',
    expectedRevision: row!.n,
    attempts: 2,
    result: 'intento',
    notes: 'Private note',
    requestId: 'request-test-1234',
  };
  const responses = await Promise.all([
    handle(req('/api/entries', payload), a, asUser('retry-owner')),
    handle(req('/api/entries', payload), a, asUser('retry-owner')),
  ]);
  expect(responses.map((r) => r.status)).toEqual([201, 201]);
  const ids = await Promise.all(responses.map((r) => r.json()));
  expect(ids[0].id).toBe(ids[1].id);
  expect(
    await a.DB.prepare(
      "SELECT COUNT(*) AS n FROM entries WHERE user_id='retry-owner'",
    ).first<number>('n'),
  ).toBe(1);
  expect(
    (
      await handle(
        req('/api/entries', { ...payload, notes: 'Changed' }),
        a,
        asUser('retry-owner'),
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await handle(
        req('/api/entries', {
          ...payload,
          requestId: 'stale-request',
          expectedRevision: 0,
        }),
        a,
        asUser('retry-owner'),
      )
    ).status,
  ).toBe(409);
  expect(
    (await handle(req('/api/entries', payload), b, asUser('retry-owner')))
      .status,
  ).toBe(404);
  const other = await handle(
    req('/api/entries', payload),
    a,
    asUser('another-owner'),
  );
  expect(other.status).toBe(201);
  expect((await other.json()).id).not.toBe(ids[0].id);
  const undo = new Request('https://local.test/api/entries/' + ids[0].id, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedVersion: 1 }),
  });
  expect((await handle(undo, a, asUser('retry-owner'))).status).toBe(200);
  expect(
    (await handle(req('/api/entries', payload), a, asUser('retry-owner')))
      .status,
  ).toBe(201);
  expect(
    await a.DB.prepare(
      "SELECT COUNT(*) AS n FROM entries WHERE user_id='retry-owner' AND deleted_at IS NULL",
    ).first<number>('n'),
  ).toBe(0);
});
it('reports retain categories, idempotency and a private resolution response without changing routes', async () => {
  const current = await a.DB.prepare(
    "SELECT MAX(revision) AS n FROM route_revisions WHERE route_id='route-a'",
  ).first<number>('n');
  const payload = {
    routeId: 'route-a',
    expectedRevision: current,
    description: 'Loose hold',
    category: 'agarre_suelto',
    requestId: 'report-retry-123',
  };
  const first = await (
    await handle(req('/api/reports', payload), a, asUser('report-author'))
  ).json();
  const repeat = await (
    await handle(req('/api/reports', payload), a, asUser('report-author'))
  ).json();
  expect(repeat.id).toBe(first.id);
  expect(
    (
      await handle(
        req(`/api/staff/reports/${first.id}/assign`, {}),
        a,
        asUser('visitor'),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await handle(
        req(`/api/staff/reports/${first.id}/assign`, {}),
        a,
        asUser('alice'),
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await handle(
        req(`/api/staff/reports/${first.id}/resolve`, {}),
        a,
        asUser('alice'),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await handle(
        req(`/api/staff/reports/${first.id}/resolve`, {
          resolution: 'Agarre fijado y revisado',
        }),
        a,
        asUser('alice'),
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await handle(
        req(`/api/staff/reports/${first.id}/resolve`, {
          resolution: 'Overwrite',
        }),
        a,
        asUser('alice'),
      )
    ).status,
  ).toBe(409);
  const author = await (
    await handle(req('/api/reports'), a, asUser('report-author'))
  ).json();
  expect(author.reports[0].resolution).toBe('Agarre fijado y revisado');
  expect(author.reports[0].category).toBe('agarre_suelto');
  const other = await (
    await handle(req('/api/reports'), a, asUser('other-reader'))
  ).json();
  expect(other.reports).toEqual([]);
  expect(
    await a.DB.prepare(
      "SELECT MAX(revision) AS n FROM route_revisions WHERE route_id='route-a'",
    ).first<number>('n'),
  ).toBe(current);
});
it('aggregate events reject personal fields and unsupported event names', async () => {
  expect(
    (await handle(req('/api/ux-events', { event: 'detail_ready' }), a)).status,
  ).toBe(200);
  expect(
    (
      await handle(
        req('/api/ux-events', { event: 'detail_ready', notes: 'private' }),
        a,
      )
    ).status,
  ).toBe(400);
  expect(
    (await handle(req('/api/ux-events', { event: 'unknown' }), a)).status,
  ).toBe(400);
  expect(
    await a.DB.prepare(
      "SELECT count FROM ux_events WHERE event='detail_ready'",
    ).first<number>('count'),
  ).toBe(1);
});
it('rejects a stale image when publishing a new camera or marker presentation', async () => {
  const payload = await presentation({
    name: 'Image integrity',
    grade: 'V2',
    sector: 'Wall',
    sectionId: 'section-gym-a',
    status: 'activa',
    beta: '',
    holds: [],
  });
  expect(
    (
      await handle(
        req('/api/routes', {
          ...payload,
          camera: { ...payload.camera, yaw: 0.3 },
        }),
        a,
        asUser('alice'),
      )
    ).status,
  ).toBe(400);
  expect(
    (await handle(req('/api/routes', payload), a, asUser('alice'))).status,
  ).toBe(201);
});
