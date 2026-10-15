import { readFile, mkdir, writeFile, chmod, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkPilot } from './pilot-config.mjs';
const mode = process.argv[2] || 'check',
  path = 'wrangler.pilot.json';
if (process.argv.length > 3)
  throw new Error(
    'El piloto no admite argumentos adicionales ni cambio de destino.',
  );
let config;
try {
  config = JSON.parse(await readFile(path, 'utf8'));
} catch {
  throw new Error(
    'Copia wrangler.pilot.example.json a wrangler.pilot.json y completa los recursos reales antes de ejecutar el piloto.',
  );
}
const readiness = checkPilot(config);
const db = config.d1_databases.find((d) => d.binding === 'DB');
const bucket = config.r2_buckets.find((b) => b.binding === 'CAPTURES');
const run = (args) => {
  const r = spawnSync('npx', ['wrangler', ...args, '--config', path], {
    stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status || 1);
};
if (mode === 'check') console.log(JSON.stringify(readiness, null, 2));
else if (mode === 'dry-run') run(['deploy', '--dry-run']);
else if (mode === 'migrate')
  run(['d1', 'migrations', 'apply', 'DB', '--remote']);
else if (mode === 'deploy') run(['deploy']);
else if (mode === 'backup') {
  await mkdir('private-backups', { recursive: true, mode: 0o700 });
  if ((await realpath('private-backups')) !== resolve('private-backups'))
    throw new Error('Raíz de respaldos no segura.');
  await chmod('private-backups', 0o700);
  const stamp = new Date().toISOString().replaceAll(':', '-'),
    output = `private-backups/${config.vars.GYM_ID}-${stamp}.sql`;
  run(['d1', 'export', 'DB', '--remote', '--output', output]);
  await chmod(output, 0o600);
  await writeFile(
    output + '.json',
    JSON.stringify(
      {
        scope: 'sql-only-incomplete',
        remotelyRestored: false,
        gymId: config.vars.GYM_ID,
        databaseId: db.database_id,
        bucket: bucket.bucket_name,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    { mode: 0o600, flag: 'wx' },
  );
  console.log(
    `Backup SQL privado: ${output}. Copia aparte los objetos R2 y prueba restauración en una base nueva.`,
  );
} else
  throw new Error(
    'Modo no permitido. Usa check, dry-run, migrate, deploy o backup.',
  );
