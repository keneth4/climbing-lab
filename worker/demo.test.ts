import { beforeAll, afterAll, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { seedSql, manifest, poster } from '../scripts/demo-data.mjs';
import { handle } from './index';
let mf: Miniflare, env: Env;
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("demo")}}',
      compatibilityDate: '2026-10-12',
      d1Databases: { DB: 'demo-test' },
      r2Buckets: { CAPTURES: 'demo-test' },
    }),
  );
  const DB = await mf.getD1Database('DB'),
    CAPTURES = await mf.getR2Bucket('CAPTURES');
  for (const file of (await readdir('migrations'))
    .filter((x) => x.endsWith('.sql'))
    .sort()) {
    for (const sql of (await readFile(`migrations/${file}`, 'utf8'))
      .split(';')
      .filter((x) => x.trim()))
      await DB.prepare(sql).run();
  }
  env = {
    DB,
    CAPTURES,
    GYM_ID: 'gym-demo',
    AUTH_ISSUER: 'https://defblrjdwgnqyzzgozdf.supabase.co/auth/v1',
    AUTH_AUDIENCE: 'authenticated',
  } as Env;
  for (const sql of seedSql().split('\n')) await DB.prepare(sql).run();
  for (const r of manifest.routes.filter((r) => r.illustrationId))
    await CAPTURES.put(`demo/v1/${r.illustrationId}.svg`, poster(r));
});
afterAll(async () => mf?.dispose());
it('seed remains idempotent and preserves later snapshots, activity and unrelated routes', async () => {
  const original = await env.DB.prepare(
    'SELECT snapshot FROM route_revisions WHERE route_id=? AND revision=1',
  )
    .bind('demo-route-01')
    .first<{ snapshot: string }>();
  await env.DB.prepare(
    "UPDATE routes SET name='Edited' WHERE id='demo-route-01'",
  ).run();
  await env.DB.prepare(
    'INSERT INTO route_revisions(route_id,revision,snapshot) VALUES(?,2,?)',
  )
    .bind(
      'demo-route-01',
      JSON.stringify({
        ...JSON.parse(original!.snapshot),
        revision: 2,
        name: 'Edited',
      }),
    )
    .run();
  await env.DB.prepare(
    "INSERT INTO entries(id,user_id,route_id,revision,attempts,result,created_at) VALUES('entry','owner','demo-route-01',1,2,'intento','2026-10-13T12:00:00Z')",
  ).run();
  await env.DB.prepare(
    "INSERT INTO routes(id,name,grade,sector) VALUES('unrelated','Untouched','V0','Other')",
  ).run();
  for (const sql of seedSql().split('\n')) await env.DB.prepare(sql).run();
  expect(
    (await env.DB.prepare('SELECT COUNT(*) AS n FROM routes').first<{
      n: number;
    }>())!.n,
  ).toBe(9);
  expect(
    (await env.DB.prepare(
      "SELECT name FROM routes WHERE id='demo-route-01'",
    ).first<{ name: string }>())!.name,
  ).toBe('Edited');
  expect(
    (await env.DB.prepare('SELECT COUNT(*) AS n FROM entries').first<{
      n: number;
    }>())!.n,
  ).toBe(1);
  expect(
    (await env.DB.prepare('SELECT COUNT(*) AS n FROM staff').first<{
      n: number;
    }>())!.n,
  ).toBe(0);
  expect(
    (await env.DB.prepare(
      'SELECT snapshot FROM route_revisions WHERE route_id=? AND revision=1',
    )
      .bind('demo-route-01')
      .first<{ snapshot: string }>())!.snapshot,
  ).toBe(original!.snapshot);
});
it('public D1 reads exclude the draft and R2 only serves registered public illustrations in demo', async () => {
  const request = (path: string) => new Request(`http://demo.test/api/${path}`);
  const active = (await (await handle(request('routes'), env)).json()) as any;
  expect(
    active.routes.filter((r: any) => r.id.startsWith('demo-route')).length,
  ).toBe(6);
  expect((await handle(request('routes/demo-route-08'), env)).status).toBe(401);
  expect(
    (await handle(request('demo-assets/demo-poster-v1-01'), env)).status,
  ).toBe(200);
  expect((await handle(request('demo-assets/unknown'), env)).status).toBe(404);
  expect(
    (
      await handle(request('demo-assets/demo-poster-v1-01'), {
        ...env,
        GYM_ID: 'gym-a',
      })
    ).status,
  ).toBe(404);
  expect(
    (await handle(request('demo-assets/%2e%2e%2fsecret'), env)).status,
  ).toBe(404);
  const response = await handle(request('demo-assets/demo-poster-v1-01'), env);
  expect(await response.text()).toContain(
    'Ilustración de ejemplo; no fotografía del muro',
  );
  expect(response.headers.get('Content-Security-Policy')).toContain('sandbox');
});
