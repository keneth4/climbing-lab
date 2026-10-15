import { it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { handle } from './index';
import { HttpError } from './http';
let mf: Miniflare, a: Env, b: Env;
const transform = { scale: 1, rotation: [0, 0, 0, 1], translation: [0, 0, 0] };
const content = {
  title: 'Tour local',
  description: 'Ilustrativo',
  captureId: 'capture',
  captureVersion: 1,
  captureTransform: transform,
  stops: [] as any[],
};
const camera = {
  captureId: 'capture',
  yaw: 0,
  pitch: 0,
  distance: 3,
  target: [0, 0, 0],
  fov: 60,
};
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAZ0AAAAASUVORK5CYII=',
  'base64',
);
function call(
  path: string,
  value?: unknown,
  user = 'admin',
  env = a,
  method = value === undefined ? 'GET' : 'POST',
) {
  return handle(
    new Request('https://local.test' + path, {
      method,
      headers:
        value === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(value === undefined ? {} : { body: JSON.stringify(value) }),
    }),
    env,
    async () => {
      if (user === 'anonymous') throw new HttpError(401, 'Inicia sesión.');
      return user;
    },
  );
}
const create = async (title = 'Tour local') =>
  (
    await (
      await call('/api/staff/tours', {
        content: { ...content, title },
        requestId: crypto.randomUUID(),
      })
    ).json()
  ).id as string;
const upload = (
  id: string,
  view = camera,
  key = crypto.randomUUID(),
  bytes = png,
  env = a,
  user = 'editor',
) =>
  handle(
    new Request('https://local.test/api/tour-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'X-Tour-Id': id,
        'X-Request-Id': key,
        'X-Tour-Presentation': JSON.stringify({
          ...content,
          stops: undefined,
          camera: view,
        }),
      },
      body: bytes,
    }),
    env,
    async () => user,
  );
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
    for (const file of (
      await readdir(new URL('../migrations/', import.meta.url))
    )
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      const sql = await readFile(
        new URL('../migrations/' + file, import.meta.url),
        'utf8',
      );
      for (const statement of sql.split(';').filter((s) => s.trim()))
        await db.prepare(statement).run();
    }
    await db
      .prepare("INSERT INTO staff VALUES('admin','admin'),('editor','editor')")
      .run();
    await db
      .prepare(
        "INSERT INTO captures(id,filename,size,object_key,upload_id,status,upload_state,transform,created_by,created_at) VALUES('capture','fixture.ply',100,'scene','local','published','ready',?,'admin','2026-10-14')",
      )
      .bind(JSON.stringify(transform))
      .run();
    await db
      .prepare("UPDATE gym_state SET active_capture_id='capture' WHERE id=1")
      .run();
    envs.push({
      DB: db,
      CAPTURES: await mf.getR2Bucket('CAPTURES', name),
      GYM_ID: 'gym-' + name,
      AUTH_ISSUER: 'https://auth.invalid',
      AUTH_AUDIENCE: 'authenticated',
      WRITE_LIMITER: { limit: async () => ({ success: true }) },
    });
  }
  [a, b] = envs as Env[];
}, 30000);
afterAll(() => mf.dispose());
it('keeps drafts private and requires authorized roles and valid context', async () => {
  const id = await create();
  expect((await call('/api/tours/' + id)).status).toBe(404);
  expect(
    (await call('/api/staff/tours/' + id, undefined, 'visitor')).status,
  ).toBe(403);
  expect(
    (await call('/api/staff/tours/' + id, undefined, 'anonymous')).status,
  ).toBe(401);
  expect(
    (
      await call(
        '/api/staff/tours/' + id + '/publish',
        {
          content,
          expectedRevision: 1,
          requestId: crypto.randomUUID(),
          reviewed: true,
        },
        'editor',
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await call('/api/staff/tours/' + id + '/publish', {
        content,
        expectedRevision: 1,
        requestId: crypto.randomUUID(),
        reviewed: true,
      })
    ).status,
  ).toBe(400);
  expect(
    (await call('/api/staff/tours/' + id, undefined, 'admin', b)).status,
  ).toBe(404);
  expect(
    (
      await call('/api/staff/tours', {
        requestId: crypto.randomUUID(),
        content: { ...content, captureVersion: 2 },
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await call('/api/staff/tours', {
        requestId: crypto.randomUUID(),
        content: { ...content, gymId: 'other' },
      })
    ).status,
  ).toBe(400);
});
it('retries writes exactly once, rejects changed retries and handles concurrent edits', async () => {
  const requestId = crypto.randomUUID(),
    value = { requestId, content };
  const one = await call('/api/staff/tours', value);
  const first = await one.json();
  expect(await (await call('/api/staff/tours', value)).json()).toEqual(first);
  expect(
    (
      await call('/api/staff/tours', {
        ...value,
        content: { ...content, title: 'Changed' },
      })
    ).status,
  ).toBe(409);
  const edit = (title: string) =>
    call(
      '/api/staff/tours/' + first.id,
      {
        content: { ...content, title },
        expectedRevision: 1,
        requestId: crypto.randomUUID(),
      },
      'editor',
      a,
      'PUT',
    );
  const results = await Promise.all([edit('A'), edit('B')]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
});
it('publishes immutable matching camera/FOV images and retirement preserves text and assets', async () => {
  const id = await create();
  const imageResponse = await upload(id);
  expect(imageResponse.status).toBe(201);
  const image = await imageResponse.json();
  expect(
    (await call('/api/tour-images/' + image.id, undefined, 'visitor')).status,
  ).toBe(403);
  expect(
    (await call('/api/tour-images/' + image.id, undefined, 'editor')).status,
  ).toBe(200);
  const stops = [0, 1, 2].map((i) => ({
    id: 'stop' + i,
    title: 'Parada ' + i,
    description: 'Texto',
    camera,
    imageId: image.id,
    verified: true,
  }));
  const published = { ...content, stops, startStopId: 'stop1' };
  const requestId = crypto.randomUUID();
  const payload = {
    content: published,
    reviewed: true,
    expectedRevision: 1,
    requestId,
  };
  expect(
    (await call('/api/staff/tours/' + id + '/publish', payload)).status,
  ).toBe(200);
  expect(
    (await call('/api/staff/tours/' + id + '/publish', payload)).status,
  ).toBe(200);
  const view = (await (await call('/api/tours/' + id)).json()).tour;
  expect(view.sceneAvailable).toBe(true);
  expect(view.content.stops[0].camera.fov).toBe(60);
  expect(
    (await call('/api/tour-images/' + image.id, undefined, 'visitor')).status,
  ).toBe(200);
  expect(
    (await call('/api/tour-images/' + image.id, undefined, 'admin', b)).status,
  ).toBe(404);
  const bad = {
    ...published,
    stops: stops.map((s) => ({ ...s, camera: { ...camera, fov: 45 } })),
  };
  expect(
    (
      await call(
        '/api/staff/tours/' + id,
        { content: bad, requestId: crypto.randomUUID(), expectedRevision: 2 },
        'editor',
        a,
        'PUT',
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await call(
        '/api/staff/tours/' + id,
        {
          content: { ...published, title: 'Private edit' },
          expectedRevision: 2,
          requestId: crypto.randomUUID(),
        },
        'editor',
        a,
        'PUT',
      )
    ).status,
  ).toBe(200);
  expect(
    (await (await call('/api/tours/' + id)).json()).tour.content.title,
  ).toBe('Tour local');
  expect(
    (
      await call(
        '/api/staff/tours/' + id + '/retire',
        { expectedRevision: 3, requestId: crypto.randomUUID() },
        'editor',
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await call('/api/staff/tours/' + id + '/retire', {
        expectedRevision: 3,
        requestId: crypto.randomUUID(),
      })
    ).status,
  ).toBe(200);
  const retired = (await (await call('/api/tours/' + id)).json()).tour;
  expect(retired.status).toBe('retired');
  expect(retired.sceneAvailable).toBe(false);
  expect(retired.content).toEqual(view.content);
  expect(
    (await (await call('/api/tours/' + id + '/revisions/2')).json()).tour
      .content,
  ).toEqual(view.content);
  expect(
    (await call('/api/tour-images/' + image.id, undefined, 'visitor')).status,
  ).toBe(200);
});
it('validates local links, PNG bounds and image retry identity', async () => {
  const id = await create();
  expect(
    (await upload(id, camera, crypto.randomUUID(), Buffer.from('bad'))).status,
  ).toBe(400);
  const key = crypto.randomUUID(),
    first = await (await upload(id, camera, key)).json();
  expect(await (await upload(id, camera, key)).json()).toEqual(first);
  expect((await upload(id, { ...camera, fov: 45 }, key)).status).toBe(409);
  for (const stop of [
    {
      id: 'stop',
      title: '',
      description: '',
      verified: false,
      linkedRouteId: 'foreign',
    },
    {
      id: 'stop',
      title: '',
      description: '',
      verified: false,
      section: { id: 'foreign', revision: 1 },
    },
  ])
    expect(
      (
        await call(
          '/api/staff/tours/' + id,
          {
            content: { ...content, stops: [stop] },
            expectedRevision: 1,
            requestId: crypto.randomUUID(),
          },
          'editor',
          a,
          'PUT',
        )
      ).status,
    ).toBe(400);
});
it('capture version changes reject writes while published fallback remains consultable', async () => {
  const list = await a.DB.prepare(
    'SELECT id FROM tours WHERE published_revision IS NOT NULL LIMIT 1',
  ).first<string>('id');
  await a.DB.prepare("UPDATE captures SET version=2 WHERE id='capture'").run();
  expect(
    (
      await call('/api/staff/tours', {
        content,
        requestId: crypto.randomUUID(),
      })
    ).status,
  ).toBe(409);
  const old = (await (await call('/api/tours/' + list + '/revisions/2')).json())
    .tour;
  expect(old.sceneAvailable).toBe(false);
  expect(old.content.stops).toHaveLength(3);
  await a.DB.prepare("UPDATE captures SET version=1 WHERE id='capture'").run();
});
it('enforces request limits, image ownership and explicit methods without exposing malformed public IDs', async () => {
  const id = await create('Limit fixtures'),
    other = await create('Other fixture');
  expect(
    (
      await call('/api/staff/tours', {
        requestId: crypto.randomUUID(),
        content: { ...content, description: 'x'.repeat(66000) },
      })
    ).status,
  ).toBe(413);
  expect(
    (
      await upload(
        id,
        camera,
        crypto.randomUUID(),
        Buffer.alloc(5 * 1024 * 1024 + 1),
      )
    ).status,
  ).toBe(413);
  const image = await (await upload(id)).json();
  expect(
    (await call('/api/tour-images/' + image.id, undefined, 'anonymous')).status,
  ).toBe(401);
  expect(
    (await call('/api/tour-images/' + image.id, undefined, 'visitor')).status,
  ).toBe(403);
  expect(
    (await call('/api/tour-images/' + image.id, undefined, 'admin', b)).status,
  ).toBe(404);
  expect(
    (
      await call(
        '/api/staff/tours/' + other,
        {
          expectedRevision: 1,
          requestId: crypto.randomUUID(),
          content: {
            ...content,
            stops: [
              {
                id: 'one',
                title: 'One',
                description: '',
                camera,
                imageId: image.id,
                verified: false,
              },
            ],
          },
        },
        'editor',
        a,
        'PUT',
      )
    ).status,
  ).toBe(400);
  expect(
    (await call('/api/tours/bad%20id', undefined, 'anonymous')).status,
  ).toBe(404);
  expect(
    (
      await call(
        '/api/staff/tours/' + id,
        { expectedRevision: 1, requestId: crypto.randomUUID(), content },
        'editor',
      )
    ).status,
  ).toBe(405);
});
