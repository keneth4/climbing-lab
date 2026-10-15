import { readFile, lstat, realpath } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const persist = join(root, '.wrangler', 'demo');
const config = JSON.parse(
  await readFile(join(root, 'wrangler.demo.json'), 'utf8'),
);
if (
  process.cwd() !== root ||
  process.argv.length !== 2 ||
  config.vars.GYM_ID !== 'gym-demo' ||
  config.d1_databases[0].database_id !==
    '00000000-0000-0000-0000-000000000003' ||
  config.r2_buckets[0].bucket_name !== 'climbing-lab-demo-local-assets'
)
  throw new Error('Destino fijo gym-demo requerido; no admite argumentos.');
for (const path of [dirname(persist), persist])
  if ((await lstat(path)).isSymbolicLink() || (await realpath(path)) !== path)
    throw new Error('Persistencia demo no segura.');
const health = await (await fetch('http://127.0.0.1:8789/api/health')).json();
if (health.gymId !== 'gym-demo' || !health.ready)
  throw new Error('El runtime local gym-demo debe estar disponible en 8789.');
const before = await (await fetch('http://127.0.0.1:8789/api/sections')).text();
const child = spawnSync(
  process.execPath,
  [
    join(root, 'node_modules/wrangler/wrangler-dist/cli.js'),
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--config',
    'wrangler.demo.json',
    '--persist-to',
    persist,
  ],
  { cwd: root, stdio: 'inherit' },
);
if (child.status !== 0)
  throw new Error('Migración local falló. No se ejecutó seed ni reset.');
const after = await (await fetch('http://127.0.0.1:8789/api/sections')).text();
if (before !== after)
  throw new Error(
    'Las secciones cambiaron durante la migración; revisar antes de continuar.',
  );
console.log(
  'Migraciones locales demo aplicadas. Sin seed/reset ni destino remoto.',
);
