import { spawnSync } from 'node:child_process';
const id = process.argv[2];
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id || '',
  )
)
  throw new Error(
    'Indica el UUID de la cuenta de Supabase autorizada por el propietario.',
  );
const sql = `INSERT INTO staff(user_id,role) VALUES('${id}','admin') ON CONFLICT(user_id) DO UPDATE SET role='admin'; INSERT INTO audit_events(id,user_id,action,object_id,created_at) VALUES('${crypto.randomUUID()}','local-owner','staff.bootstrap','${id}','${new Date().toISOString()}');`;
const r = spawnSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'DB', '--local', '--command', sql],
  { stdio: 'inherit' },
);
process.exit(r.status ?? 1);
