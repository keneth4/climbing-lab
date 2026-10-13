import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const mode = process.argv[2] || 'check',
  path = 'wrangler.pilot.json';
let config;
try {
  config = JSON.parse(await readFile(path, 'utf8'));
} catch {
  throw new Error(
    'Copia wrangler.pilot.example.json a wrangler.pilot.json y completa los recursos reales antes de ejecutar el piloto.',
  );
}
if (
  JSON.stringify(config).includes('replace-') ||
  !config.vars?.GYM_ID ||
  ['gym-a', 'gym-b'].includes(config.vars.GYM_ID)
)
  throw new Error(
    'La configuración todavía usa placeholders o un gimnasio local.',
  );
const db = config.d1_databases?.find((d) => d.binding === 'DB'),
  bucket = config.r2_buckets?.find((b) => b.binding === 'CAPTURES');
if (
  !/^[0-9a-f]{32}$/i.test(config.account_id || '') ||
  !/^[0-9a-f-]{36}$/i.test(db?.database_id || '') ||
  db.database_id.startsWith('00000000-') ||
  !bucket?.bucket_name
)
  throw new Error('Verifica cuenta, UUID D1 y bucket R2 del piloto.');
if (
  config.assets?.not_found_handling !== 'single-page-application' ||
  !config.assets?.run_worker_first?.includes('/api/*')
)
  throw new Error(
    'La configuración debe servir el frontend SPA y preservar rutas API.',
  );
const run = (args) => {
  const r = spawnSync('npx', ['wrangler', ...args, '--config', path], {
    stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status || 1);
};
if (mode === 'check')
  console.log(
    `Configuración válida: ${config.name}, gimnasio ${config.vars.GYM_ID}. No verifica existencia de recursos ni publica.`,
  );
else if (mode === 'dry-run') run(['deploy', '--dry-run']);
else if (mode === 'migrate')
  run(['d1', 'migrations', 'apply', 'DB', '--remote']);
else if (mode === 'deploy') run(['deploy']);
else if (mode === 'backup') {
  await mkdir('private-backups', { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-'),
    output = `private-backups/${config.vars.GYM_ID}-${stamp}.sql`;
  run(['d1', 'export', 'DB', '--remote', '--output', output]);
  await writeFile(
    output + '.json',
    JSON.stringify(
      {
        gymId: config.vars.GYM_ID,
        databaseId: db.database_id,
        bucket: bucket.bucket_name,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    `Backup SQL privado: ${output}. Copia aparte los objetos R2 y prueba restauración en una base nueva.`,
  );
} else
  throw new Error(
    'Modo no permitido. Usa check, dry-run, migrate, deploy o backup.',
  );
