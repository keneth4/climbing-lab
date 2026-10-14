import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertDemoTarget, demoPersist, uuidPattern } from './demo-local.mjs';
export function validateStaffArgs(args) {
  const [id, role, confirm] = args;
  if (
    args.length !== 3 ||
    !uuidPattern.test(id || '') ||
    !['admin', 'editor', 'revoke'].includes(role) ||
    confirm !== '--confirm=gym-demo'
  )
    throw new Error(
      'Usa demo:staff UUID admin|editor|revoke --confirm=gym-demo. UUID expresamente autorizado por el propietario.',
    );
  return { id, role };
}
export async function changeStaff(db, id, role) {
  validateStaffArgs([id, role, '--confirm=gym-demo']);
  const audit = crypto.randomUUID();
  // Batch is atomic; revocation is audited even when already absent.
  const write =
    role === 'revoke'
      ? db.prepare('DELETE FROM staff WHERE user_id=?').bind(id)
      : db
          .prepare(
            'INSERT INTO staff(user_id,role) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role',
          )
          .bind(id, role);
  const record = db
    .prepare(
      "INSERT INTO audit_events(id,user_id,action,object_id,created_at) VALUES(?,'local-owner',?,?,?)",
    )
    .bind(audit, `demo.staff.${role}`, id, new Date().toISOString());
  await db.batch([write, record]);
}
async function main() {
  const { id, role } = validateStaffArgs(process.argv.slice(2));
  const config = await assertDemoTarget();
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("local")}}',
      compatibilityDate: config.compatibility_date,
      d1Databases: { DB: config.d1_databases[0].database_id },
      resourcePersistencePath: join(demoPersist, 'v3'),
    }),
  );
  try {
    const db = await mf.getD1Database('DB');
    await db.prepare('SELECT COUNT(*) FROM staff').first();
    await changeStaff(db, id, role);
    console.log(
      JSON.stringify({
        gymId: 'gym-demo',
        userId: id,
        role: role === 'revoke' ? null : role,
        audited: true,
      }),
    );
  } finally {
    await mf.dispose();
  }
}
if (import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(`No se cambió staff: ${error.message}`);
    process.exitCode = 1;
  });
