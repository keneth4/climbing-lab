import { beforeAll, afterAll, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { changeStaff, validateStaffArgs } from '../scripts/demo-staff.mjs';

let mf: Miniflare, db: D1Database;
const id = '00000000-0000-4000-8000-000000000001';
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("test")}}',
      compatibilityDate: '2026-10-12',
      d1Databases: { DB: 'staff-tool-test' },
    }),
  );
  db = (await mf.getD1Database('DB')) as unknown as D1Database;
  await db
    .prepare('CREATE TABLE staff(user_id TEXT PRIMARY KEY,role TEXT NOT NULL)')
    .run();
  await db
    .prepare(
      'CREATE TABLE audit_events(id TEXT PRIMARY KEY,user_id TEXT,action TEXT,object_id TEXT,created_at TEXT)',
    )
    .run();
});
afterAll(async () => mf?.dispose());
it('rejects wrong confirmation, malformed identity, unknown role and extra destination', () => {
  for (const args of [
    [id, 'admin'],
    [id, 'admin', '--confirm=gym-a'],
    ['not-a-uuid', 'admin', '--confirm=gym-demo'],
    [id, 'owner', '--confirm=gym-demo'],
    [id, 'admin', '--confirm=gym-demo', '--remote'],
  ])
    expect(() => validateStaffArgs(args)).toThrow();
});
it('audits grants, role changes and repeated revocation', async () => {
  for (const role of ['admin', 'editor', 'revoke', 'revoke']) {
    await changeStaff(db, id, role);
    const row = await db
      .prepare('SELECT role FROM staff WHERE user_id=?')
      .bind(id)
      .first<{ role: string }>();
    expect(row?.role ?? null).toBe(role === 'revoke' ? null : role);
  }
  const events = await db
    .prepare('SELECT action,object_id,user_id FROM audit_events ORDER BY rowid')
    .all();
  expect(events.results.map((x) => x.action)).toEqual([
    'demo.staff.admin',
    'demo.staff.editor',
    'demo.staff.revoke',
    'demo.staff.revoke',
  ]);
  expect(
    events.results.every(
      (x) => x.object_id === id && x.user_id === 'local-owner',
    ),
  ).toBe(true);
});
it('rolls back the role write if audit fails', async () => {
  await db
    .prepare(
      "CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'audit unavailable'); END",
    )
    .run();
  await expect(changeStaff(db, id, 'admin')).rejects.toThrow();
  expect(
    await db.prepare('SELECT * FROM staff WHERE user_id=?').bind(id).first(),
  ).toBeNull();
});
