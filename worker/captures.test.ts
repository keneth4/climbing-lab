import { beforeAll, afterAll, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { handle } from './index';
let mf: Miniflare, a: Env, b: Env, first: string, next: string;
const identity =
  (user = 'owner') =>
  async () =>
    user;
const req = (path: string, value?: unknown) =>
  new Request(
    'https://local.test' + path,
    value === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value),
        },
  );
const get = (path: string, env = a, user = 'owner') =>
  handle(req(path), env, identity(user));
const post = (path: string, value: unknown, env = a, user = 'owner') =>
  handle(req(path, value), env, identity(user));
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: ['a', 'b'].map((name) => ({
        name,
        modules: true,
        script: 'export default {fetch(){return new Response("test")}}',
        compatibilityDate: '2026-10-12',
        d1Databases: { DB: name },
        r2Buckets: { CAPTURES: name },
      })),
    }),
  );
  const envs = [];
  for (const name of ['a', 'b']) {
    const db = await mf.getD1Database('DB', name);
    for (const file of [
      '0001_initial.sql',
      '0002_digital_twin.sql',
      '0003_capture_camera.sql',
      '0004_section_geometry.sql',
      '0005_section_revisions.sql',
      '0006_entry_history.sql',
      '0007_projects.sql',
      '0008_operations.sql',
      '0009_pilot_ux.sql',
    ]) {
      const sql = await readFile(
        new URL('../migrations/' + file, import.meta.url),
        'utf8',
      );
      for (const statement of sql.split(';').filter((s) => s.trim()))
        await db.prepare(statement).run();
    }
    await db
      .prepare("INSERT INTO staff VALUES('owner','admin'),('editor','editor')")
      .run();
    envs.push({
      DB: db,
      CAPTURES: await mf.getR2Bucket('CAPTURES', name),
      GYM_ID: 'gym-' + name,
      AUTH_ISSUER: 'https://auth.invalid',
      AUTH_AUDIENCE: 'authenticated',
    });
  }
  [a, b] = envs as Env[];
}, 30000);
afterAll(() => mf.dispose());
async function upload() {
  const bytes = Buffer.from(
    'ply\nformat binary_little_endian 1.0\nelement vertex 0\nend_header\n',
  );
  const response = await post('/api/captures', {
    filename: 'gym.ply',
    size: bytes.length,
  });
  expect(response.status).toBe(201);
  const { id } = await response.json();
  const row = await a.DB.prepare(
    'SELECT object_key,upload_id FROM captures WHERE id=?',
  )
    .bind(id)
    .first<{ object_key: string; upload_id: string }>();
  const part = await a.CAPTURES.resumeMultipartUpload(
    row!.object_key,
    row!.upload_id,
  ).uploadPart(1, bytes);
  await a.DB.prepare('INSERT INTO capture_parts VALUES(?,?,?,?)')
    .bind(id, 1, part.etag, bytes.length)
    .run();
  expect((await post(`/api/captures/${id}/complete`, {})).status).toBe(200);
  return id;
}
it('restricts captures to admins and rejects incomplete publication', async () => {
  expect(
    (await post('/api/captures', { filename: 'a.ply', size: 20 }, a, 'editor'))
      .status,
  ).toBe(403);
  const response = await post('/api/captures', { filename: 'a.ply', size: 20 });
  const { id } = await response.json();
  expect(
    (
      await post(`/api/captures/${id}/publish`, {
        expectedGeneration: 0,
        expectedVersion: 1,
        changedSectionIds: [],
        importRouteIds: [],
        reviewedRouteIds: [],
        reviewedAlignment: true,
      })
    ).status,
  ).toBe(409);
});
it('stores a complete draft privately and publishes the initial capture', async () => {
  await a.DB.prepare(
    "INSERT INTO routes(id,name,grade,sector) VALUES('unassigned-demo','Demo','V1','Spray wall')",
  ).run();
  await a.DB.prepare(
    "INSERT INTO route_revisions(route_id,revision,snapshot) VALUES('unassigned-demo',1,?)",
  )
    .bind(
      JSON.stringify({
        name: 'Demo',
        grade: 'V1',
        holds: [],
        camera: {
          captureId: 'legacy-local-file',
          target: [0, 0, 0],
          yaw: 0,
          pitch: 0,
          distance: 3,
        },
      }),
    )
    .run();
  first = await upload();
  expect(
    (await get(`/api/captures/${first}/file/scene.ply`, a, 'editor')).status,
  ).toBe(403);
  expect((await get(`/api/captures/${first}/metadata`, b)).status).toBe(404);
  const sections = [
    ['left', 'Left'],
    ['right', 'Right'],
  ];
  for (const [id, name] of sections)
    await a.DB.prepare('INSERT INTO sections(id,name,bounds) VALUES(?,?,?)')
      .bind(id, name, JSON.stringify({ min: [0, 0, 0], max: [1, 1, 1] }))
      .run();
  expect(
    (
      await post(`/api/captures/${first}/publish`, {
        expectedGeneration: 0,
        expectedVersion: 1,
        changedSectionIds: [],
        importRouteIds: [],
        reviewedRouteIds: [],
        reviewedAlignment: true,
      })
    ).status,
  ).toBe(200);
  expect(
    (await get(`/api/captures/${first}/file/scene.ply`, a, 'visitor')).status,
  ).toBe(200);
  const demo = await (await get('/api/routes/unassigned-demo')).json();
  expect(demo.revision).toBe(1);
  expect(demo.snapshot.captureId).toBeUndefined();
  expect(demo.snapshot.camera.captureId).toBe('legacy-local-file');
  for (const [id, section] of [
    ['old-left', 'left'],
    ['old-right', 'right'],
    ['import-left', 'left'],
  ]) {
    await a.DB.prepare(
      "INSERT INTO routes(id,name,grade,sector,section_id) VALUES(?,?,'V2',?,?)",
    )
      .bind(id, id, section, section)
      .run();
    await a.DB.prepare(
      'INSERT INTO route_revisions(route_id,revision,snapshot,capture_id) VALUES(?,1,?,?)',
    )
      .bind(
        id,
        JSON.stringify({
          name: id,
          grade: 'V2',
          sectionId: section,
          captureId: first,
          holds: [],
          camera: {
            captureId: first,
            yaw: 0,
            pitch: 0,
            distance: 4,
            target: [0, 0, 0],
          },
        }),
        first,
      )
      .run();
  }
  await a.DB.prepare(
    "INSERT INTO entries(id,user_id,route_id,revision,attempts,result,notes,created_at) VALUES('ascent','visitor','old-left',1,2,'ascenso','','2026-10-12')",
  ).run();
});
it('aligns a replacement from fiducials and updates only selected sections', async () => {
  next = await upload();
  const refs = [];
  for (const [id, p] of [
    ['a', [0, 0, 0]],
    ['b', [1, 0, 0]],
    ['c', [0, 1, 0]],
  ] as const) {
    await a.DB.prepare('INSERT INTO fiducials VALUES(?,?,?)')
      .bind(id, id, JSON.stringify(p))
      .run();
    refs.push({ id, observed: [...p] });
  }
  const aligned = await post(`/api/captures/${next}/align`, {
    expectedVersion: 1,
    references: refs,
  });
  expect(aligned.status).toBe(200);
  const payload = {
    expectedGeneration: 1,
    expectedVersion: 2,
    changedSectionIds: ['left'],
    importRouteIds: ['import-left'],
    reviewedRouteIds: ['old-right', 'import-left'],
    reviewedAlignment: true,
  };
  expect(
    (
      await post(`/api/captures/${next}/publish`, {
        ...payload,
        reviewedRouteIds: [],
      })
    ).status,
  ).toBe(400);
  expect((await post(`/api/captures/${next}/publish`, payload)).status).toBe(
    200,
  );
  const retired = await (await get('/api/routes/old-left')).json(),
    preserved = await (await get('/api/routes/old-right')).json(),
    imported = await (await get('/api/routes/import-left')).json();
  expect(
    (await (await get('/api/routes/unassigned-demo')).json()).revision,
  ).toBe(1);
  expect(retired.status).toBe('retirada');
  expect(retired.snapshot.captureId).toBe(first);
  expect(preserved.snapshot.captureId).toBe(next);
  expect(preserved.snapshot.camera.captureId).toBe(next);
  expect(imported.status).toBe('activa');
  expect(
    await a.DB.prepare("SELECT revision FROM entries WHERE id='ascent'").first(
      'revision',
    ),
  ).toBe(1);
  expect((await post(`/api/captures/${next}/publish`, payload)).status).toBe(
    409,
  );
});
it('does not let an editor upload or align a published capture', async () => {
  expect(
    (
      await post(
        `/api/captures/${next}/align`,
        { expectedVersion: 2, references: [] },
        a,
        'editor',
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await post(`/api/captures/${next}/align`, {
        expectedVersion: 2,
        references: [],
      })
    ).status,
  ).toBe(409);
});

it('imports a retired route from an older capture without rewriting ascents', async () => {
  const third = await upload();
  const references = [
    { id: 'a', observed: [0, 0, 0] },
    { id: 'b', observed: [1, 0, 0] },
    { id: 'c', observed: [0, 1, 0] },
  ];
  expect(
    (
      await post(`/api/captures/${third}/align`, {
        expectedVersion: 1,
        references,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await post(`/api/captures/${third}/publish`, {
        expectedGeneration: 2,
        expectedVersion: 2,
        changedSectionIds: [],
        importRouteIds: ['old-left'],
        reviewedRouteIds: ['old-left', 'old-right', 'import-left'],
        reviewedAlignment: true,
      })
    ).status,
  ).toBe(200);
  const restored = await (await get('/api/routes/old-left')).json();
  expect(restored.status).toBe('activa');
  expect(restored.snapshot.captureId).toBe(third);
  expect(restored.snapshot.camera.captureId).toBe(third);
  expect(
    await a.DB.prepare("SELECT revision FROM entries WHERE id='ascent'").first(
      'revision',
    ),
  ).toBe(1);
});

it('persists an initial camera, rejects stale/invalid/unauthorized edits and clears it on alignment', async () => {
  const id = await upload();
  const camera = {
    captureId: id,
    yaw: 0.2,
    pitch: 0.1,
    distance: 3,
    target: [0, 1, 0],
  };
  expect(
    (
      await post(
        `/api/captures/${id}/camera`,
        { expectedVersion: 1, camera },
        a,
        'editor',
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await post(`/api/captures/${id}/camera`, {
        expectedVersion: 1,
        camera: { ...camera, distance: -1 },
      })
    ).status,
  ).toBe(400);
  expect(
    (await post(`/api/captures/${id}/camera`, { expectedVersion: 1, camera }))
      .status,
  ).toBe(200);
  expect(
    (await (await get(`/api/captures/${id}/metadata`)).json()).capture
      .initialCamera,
  ).toEqual(camera);
  expect(
    (await post(`/api/captures/${id}/camera`, { expectedVersion: 1, camera }))
      .status,
  ).toBe(409);
  const references = [
    { id: 'a', observed: [0, 0, 0] },
    { id: 'b', observed: [1, 0, 0] },
    { id: 'c', observed: [0, 1, 0] },
  ];
  expect(
    (
      await post(`/api/captures/${id}/align`, {
        expectedVersion: 2,
        references,
      })
    ).status,
  ).toBe(200);
  expect(
    (await (await get(`/api/captures/${id}/metadata`)).json()).capture
      .initialCamera,
  ).toBeNull();
  expect(
    (
      await post(`/api/captures/${next}/camera`, {
        expectedVersion: 2,
        camera: { ...camera, captureId: next },
      })
    ).status,
  ).toBe(409);
});
it('stores polygon sections and accessible areas with validation and admin isolation', async () => {
  const geometry = {
    type: 'polygon',
    plane: 'XZ',
    elevation: 0,
    thickness: 0.2,
    vertices: [
      [0, 0, 0],
      [2, 0, 0],
      [2, 0, 2],
      [0, 0, 2],
    ],
  };
  expect(
    (
      await post(
        '/api/sections',
        { name: 'Floor', kind: 'accessible-area', geometry },
        a,
        'editor',
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await post('/api/sections', {
        name: 'Crossed',
        geometry: {
          ...geometry,
          vertices: [
            [0, 0, 0],
            [2, 0, 2],
            [0, 0, 2],
            [2, 0, 0],
          ],
        },
      })
    ).status,
  ).toBe(400);
  const response = await post('/api/sections', {
    name: 'Floor',
    kind: 'accessible-area',
    geometry,
  });
  expect(response.status).toBe(201);
  const { id } = await response.json();
  const data = await (await get('/api/sections', a, 'visitor')).json();
  const region = data.sections.find((r: { id: string }) => r.id === id);
  expect(region.geometry).toEqual(geometry);
  expect(region.kind).toBe('accessible-area');
  expect(region.bounds).toEqual({ min: [0, -0.1, 0], max: [2, 0.1, 2] });
  expect((await (await get('/api/sections', b)).json()).sections).toEqual([]);
});
it('revises a section atomically, preserves route snapshots and restores through a new revision', async () => {
  const value = {
    name: 'Revision wall',
    min: [0, 0, 0],
    max: [2, 2, 1],
    kind: 'wall',
  };
  const created = await (await post('/api/sections', value)).json();
  const id = created.id;
  const edit = (body: unknown, user = 'owner') =>
    handle(
      new Request(`https://local.test/api/sections/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      a,
      identity(user),
    );
  await a.DB.prepare(
    "INSERT INTO routes(id,name,grade,sector,section_id) VALUES('pinned','Pinned','V1','Wall',?)",
  )
    .bind(id)
    .run();
  const original = JSON.stringify({
    name: 'Pinned',
    sectionId: id,
    sectionRevision: 1,
    holds: [],
  });
  await a.DB.prepare(
    "INSERT INTO route_revisions(route_id,revision,snapshot) VALUES('pinned',1,?)",
  )
    .bind(original)
    .run();
  expect(
    (await edit({ ...value, name: 'Forbidden', expectedRevision: 1 }, 'editor'))
      .status,
  ).toBe(403);
  expect((await get(`/api/sections/${id}/revisions`, a, 'editor')).status).toBe(
    403,
  );
  expect(
    (await edit({ ...value, min: [3, 3, 3], expectedRevision: 1 })).status,
  ).toBe(400);
  const results = await Promise.all([
    edit({ ...value, name: 'Changed A', expectedRevision: 1 }),
    edit({ ...value, name: 'Changed B', expectedRevision: 1 }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await edit({ ...value, expectedRevision: 1 })).status).toBe(409);
  const history = await (await get(`/api/sections/${id}/revisions`)).json();
  expect(
    history.revisions.map((r: { revision: number }) => r.revision),
  ).toEqual([2, 1]);
  expect(
    (await (await get(`/api/sections/${id}/revisions/1`, a, 'visitor')).json())
      .section.name,
  ).toBe(value.name);
  expect(
    await a.DB.prepare(
      "SELECT snapshot FROM route_revisions WHERE route_id='pinned' AND revision=1",
    ).first('snapshot'),
  ).toBe(original);
  expect((await edit({ ...value, expectedRevision: 2 })).status).toBe(200);
  expect(
    (await (await get(`/api/sections/${id}/revisions`)).json()).revisions,
  ).toHaveLength(3);
  expect(
    await a.DB.prepare(
      "SELECT COUNT(*) FROM audit_events WHERE object_id=? AND action='section.update'",
    )
      .bind(id)
      .first('COUNT(*)'),
  ).toBe(2);
  expect((await get(`/api/sections/${id}/revisions/99`)).status).toBe(404);
});
it('stores bounded PNG route images in R2, keeps drafts private and publishes matching presentations', async () => {
  const current = await a.DB.prepare(
    'SELECT active_capture_id FROM gym_state WHERE id=1',
  ).first<string>('active_capture_id');
  const section = await a.DB.prepare(
    "SELECT id FROM sections WHERE kind='wall' LIMIT 1",
  ).first<string>('id');
  const camera = {
    captureId: current,
    yaw: 0,
    pitch: 0,
    distance: 4,
    target: [0, 0, 0],
  };
  const holds = [
    { id: 'start-image', role: 'inicio', position: [0, 0, 0] },
    { id: 'end-image', role: 'final', position: [1, 1, 0] },
  ];
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAZ0AAAAASUVORK5CYII=',
    'base64',
  );
  const imageRequest = () =>
    new Request('https://local.test/api/route-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'X-Capture-Id': current!,
        'X-Presentation': JSON.stringify({ camera, holds }),
      },
      body: bytes,
    });
  expect((await handle(imageRequest(), a, identity('visitor'))).status).toBe(
    403,
  );
  const uploaded = await handle(imageRequest(), a, identity('editor'));
  expect(uploaded.status).toBe(201);
  const image = await uploaded.json();
  expect(
    (await get(`/api/route-images/${image.id}`, a, 'visitor')).status,
  ).toBe(403);
  const payload = {
    name: 'Route with image',
    grade: 'V2',
    gradeScale: 'V',
    sector: 'Wall',
    sectionId: section,
    captureId: current,
    camera,
    holds: [],
    holds3D: holds,
    imageId: image.id,
    markersVerified: true,
    beta: '',
    status: 'borrador',
  };
  const draft = await post('/api/routes', payload, a, 'editor');
  expect(draft.status).toBe(201);
  const route = await draft.json();
  const publish = new Request(`https://local.test/api/routes/${route.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, status: 'activa', expectedRevision: 1 }),
  });
  expect((await handle(publish, a, identity('editor'))).status).toBe(200);
  const publicImage = await get(`/api/route-images/${image.id}`, a, 'visitor');
  expect(publicImage.status).toBe(200);
  expect(Buffer.from(await publicImage.arrayBuffer())).toEqual(bytes);
  expect((await get(`/api/route-images/${image.id}`, b, 'editor')).status).toBe(
    404,
  );
});
it('restores a previous published capture with new revisions and preserves the activity snapshot', async () => {
  const target = await a.DB.prepare(
    "SELECT id FROM captures WHERE status='published' ORDER BY created_at LIMIT 1",
  ).first<string>('id');
  const active = await a.DB.prepare(
    'SELECT active_capture_id FROM gym_state WHERE id=1',
  ).first<string>('active_capture_id');
  expect(target).not.toBe(active);
  const now = new Date().toISOString();
  await a.DB.prepare(
    "INSERT INTO routes(id,name,grade,sector,status) VALUES('rollback-route','Current','V2','Wall','activa')",
  ).run();
  for (const [revision, captureId, name] of [
    [1, target, 'Old'],
    [2, active, 'Current'],
  ] as const)
    await a.DB.prepare('INSERT INTO route_revisions VALUES(?,?,?,?)')
      .bind(
        'rollback-route',
        revision,
        JSON.stringify({
          id: 'rollback-route',
          name,
          grade: 'V2',
          sector: 'Wall',
          status: 'activa',
          holds: [],
          captureId,
        }),
        captureId,
      )
      .run();
  const entry = await post(
    '/api/entries',
    { routeId: 'rollback-route', attempts: 1, result: 'ascenso' },
    a,
    'rollback-climber',
  );
  expect(entry.status).toBe(201);
  const e = await entry.json();
  const generation = await a.DB.prepare(
    'SELECT generation FROM gym_state WHERE id=1',
  ).first<number>('generation');
  expect(
    (
      await post(
        `/api/captures/${target}/rollback`,
        { reason: 'Confirm restore', expectedGeneration: generation },
        a,
        'editor',
      )
    ).status,
  ).toBe(403);
  const restored = await post(`/api/captures/${target}/rollback`, {
    reason: 'Confirmed earlier capture',
    expectedGeneration: generation,
  });
  expect(restored.status).toBe(200);
  const route = await (await get('/api/routes/rollback-route')).json();
  expect(route.revision).toBe(3);
  expect(route.snapshot.name).toBe('Old');
  expect(route.snapshot.captureId).toBe(target);
  const historical = await (
    await get(`/api/entries/${e.id}/presentation`, a, 'rollback-climber')
  ).json();
  expect(historical.revision).toBe(2);
  expect(historical.snapshot.name).toBe('Current');
  expect(
    await a.DB.prepare(
      "SELECT reason FROM route_changes WHERE route_id='rollback-route' AND revision=3",
    ).first<string>('reason'),
  ).toBe('Confirmed earlier capture');
  expect(
    (
      await post(`/api/captures/${target}/rollback`, {
        reason: 'Repeat',
        expectedGeneration: generation,
      })
    ).status,
  ).toBe(409);
});

it('validates oriented sections through the API and keeps old route geometry pinned', async () => {
  const { planeFromPoints } = await import('../shared/sections');
  const geometry = {
    type: 'oriented-polygon',
    plane: planeFromPoints([
      [1, 2, 3],
      [3, 2, 3],
      [1, 4, 5],
    ]),
    verticesUV: [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ],
    thickness: 0.3,
  };
  for (const invalid of [
    { ...geometry, plane: { ...geometry.plane, u: [2, 0, 0] } },
    {
      ...geometry,
      verticesUV: [
        [0, 0],
        [1, 1],
        [0, 1],
        [1, 0],
      ],
    },
    { ...geometry, thickness: 0 },
  ])
    expect(
      (
        await post('/api/sections', {
          name: 'Invalid tilted',
          geometry: invalid,
        })
      ).status,
    ).toBe(400);
  const created = await post('/api/sections', {
    name: 'Tilted wall',
    geometry,
  });
  expect(created.status).toBe(201);
  const { id } = await created.json();
  const first = (
    await (await get(`/api/sections/${id}/revisions/1`, a, 'visitor')).json()
  ).section;
  expect(first.geometry).toEqual(JSON.parse(JSON.stringify(geometry)));
  const original = JSON.stringify({
    name: 'Pinned oriented',
    sectionId: id,
    sectionRevision: 1,
    holds: [],
    holds3D: [{ id: 'h', position: [1, 2, 3], role: 'inicio' }],
    imageId: 'historical-image',
  });
  await a.DB.prepare(
    "INSERT INTO routes(id,name,grade,sector,section_id) VALUES('oriented-pinned','Pinned oriented','V1','Wall',?)",
  )
    .bind(id)
    .run();
  await a.DB.prepare(
    "INSERT INTO route_revisions(route_id,revision,snapshot) VALUES('oriented-pinned',1,?)",
  )
    .bind(original)
    .run();
  const edit = (expectedRevision: number) =>
    handle(
      new Request(`https://local.test/api/sections/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Tilted changed',
          geometry: { ...geometry, thickness: 0.6 },
          expectedRevision,
        }),
      }),
      a,
      identity(),
    );
  const results = await Promise.all([edit(1), edit(1)]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    (await (await get(`/api/sections/${id}/revisions/1`, a, 'visitor')).json())
      .section,
  ).toEqual(first);
  expect(
    await a.DB.prepare(
      "SELECT snapshot FROM route_revisions WHERE route_id='oriented-pinned'",
    ).first('snapshot'),
  ).toBe(original);
  expect(
    (await get(`/api/sections/${id}/revisions/1`, b, 'visitor')).status,
  ).toBe(404);
  const changeKind = await handle(
    new Request(`https://local.test/api/sections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Now visitable',
        kind: 'accessible-area',
        geometry,
        expectedRevision: 2,
      }),
    }),
    a,
    identity(),
  );
  expect(changeKind.status).toBe(200);
  const retired = await handle(
    new Request('https://local.test/api/routes/oriented-pinned', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pinned oriented',
        grade: 'V1',
        sector: 'Wall',
        beta: '',
        sectionId: id,
        expectedRevision: 1,
        status: 'retirada',
        changeReason: 'Prueba de continuidad histórica',
        holds: [],
        holds3D: [],
      }),
    }),
    a,
    identity(),
  );
  expect(retired.status).toBe(200);
  const updated = await (
    await get('/api/routes/oriented-pinned', a, 'visitor')
  ).json();
  expect(updated.snapshot.sectionRevision).toBe(1);
  expect(
    await a.DB.prepare(
      "SELECT snapshot FROM route_revisions WHERE route_id='oriented-pinned' AND revision=1",
    ).first('snapshot'),
  ).toBe(original);
  const area = await (
    await post('/api/sections', {
      name: 'Walk only',
      kind: 'accessible-area',
      geometry,
    })
  ).json();
  const rejected = await post(
    '/api/routes',
    {
      name: 'Forbidden area route',
      beta: '',
      grade: 'V1',
      gradeScale: 'V',
      sector: 'Floor',
      status: 'borrador',
      sectionId: area.id,
      holds: [],
      holds3D: [],
    },
    a,
    'editor',
  );
  expect(rejected.status).toBe(400);
  expect((await rejected.json()).error).toContain('visitables');
});
