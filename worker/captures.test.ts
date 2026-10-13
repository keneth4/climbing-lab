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
    await a.DB.prepare('INSERT INTO sections VALUES(?,?,?)')
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
    "INSERT INTO entries VALUES('ascent','visitor','old-left',1,2,'ascenso','','2026-10-12')",
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
