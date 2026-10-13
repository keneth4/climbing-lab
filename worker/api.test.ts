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
  const migration = await readFile(
    new URL('../migrations/0001_initial.sql', import.meta.url),
    'utf8',
  );
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
      .prepare('INSERT INTO route_revisions VALUES(?,?,?)')
      .bind(route, 1, JSON.stringify({ name: id, holds: [] }))
      .run();
    await db
      .prepare('INSERT INTO staff VALUES(?,?)')
      .bind(id === 'gym-a' ? 'alice' : 'bob', 'editor')
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
