import { spawn, spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rm,
  lstat,
  realpath,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { manifest, seedSql, poster } from './demo-data.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const persist = join(root, '.wrangler', 'demo');
const mode = process.argv[2] || 'check';
const config = JSON.parse(
  await readFile(join(root, 'wrangler.demo.json'), 'utf8'),
);
if (
  process.cwd() !== root ||
  config.vars.GYM_ID !== 'gym-demo' ||
  config.d1_databases[0].database_id !==
    '00000000-0000-0000-0000-000000000003' ||
  config.r2_buckets[0].bucket_name !== 'climbing-lab-demo-local-assets'
)
  throw new Error(
    'Destino demo inválido. Ejecuta desde la raíz del repositorio.',
  );
const wranglerBase = [
  '--config',
  'wrangler.demo.json',
  '--persist-to',
  persist,
];
const run = (args) => {
  const result = spawnSync('npx', ['wrangler', ...args, ...wranglerBase], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0)
    throw new Error(`Wrangler falló: ${args.slice(0, 3).join(' ')}`);
};
export async function freePort(port) {
  await new Promise((accept, reject) => {
    const server = net.createServer();
    server.once('error', () =>
      reject(
        new Error(
          `Puerto ${port} ocupado. Detén tu servidor demo; no se cerrará ningún proceso ajeno.`,
        ),
      ),
    );
    server.listen(port, '127.0.0.1', () => server.close(accept));
  });
}
export async function assertSafePath() {
  const parent = dirname(persist);
  await mkdir(parent, { recursive: true });
  if ((await realpath(parent)) !== parent)
    throw new Error(
      'Persistencia demo: directorio padre enlazado; operación cancelada.',
    );
  try {
    if (
      (await lstat(persist)).isSymbolicLink() ||
      (await realpath(persist)) !== persist
    )
      throw new Error('Persistencia demo no segura.');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}
const children = new Set();
function start(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    detached: true,
  });
  children.add(child);
  child.once('error', (e) => {
    console.error(e.message);
    stop();
  });
  return child;
}
function stop() {
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
  }
  children.clear();
}
process.on('SIGINT', () => {
  stop();
  process.exit(130);
});
process.on('SIGTERM', () => {
  stop();
  process.exit(143);
});
const worker = () =>
  start('npx', [
    'wrangler',
    'dev',
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    '8789',
    ...wranglerBase,
  ]);
export async function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:8789/api/health');
      const health = await response.json();
      if (health.gymId === 'gym-demo' && health.ready) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Worker demo no disponible en 8789.');
}
async function check() {
  const base = 'http://127.0.0.1:8789/api';
  const health = await (await fetch(`${base}/health`)).json();
  if (health.gymId !== 'gym-demo' || !health.ready)
    throw new Error('El Worker no pertenece al demo.');
  const active = await (await fetch(`${base}/routes`)).json();
  const retired = await (await fetch(`${base}/routes?status=retirada`)).json();
  for (const r of manifest.routes.filter((r) => r.status !== 'borrador')) {
    if (![...active.routes, ...retired.routes].some((x) => x.id === r.id))
      throw new Error(
        `Falta ${r.id}. Ejecuta demo:setup; no se modificó ningún dato.`,
      );
    const detail = await (await fetch(`${base}/routes/${r.id}`)).json();
    if (!detail.snapshot || !detail.revision)
      throw new Error(`Snapshot ausente: ${r.id}`);
    const image = await fetch(`${base}/demo-assets/${r.illustrationId}`);
    if (
      !image.ok ||
      !image.headers.get('Content-Type')?.includes('image/svg+xml')
    )
      throw new Error(`Ilustración ausente: ${r.illustrationId}`);
  }
  if (
    [...active.routes, ...retired.routes].some((r) => r.id === 'demo-route-08')
  )
    throw new Error('El borrador aparece en público.');
  const draft = await fetch(`${base}/routes/demo-route-08`);
  if (draft.status !== 401) throw new Error('El borrador no está protegido.');
  console.log(
    'Demo verificado: D1 y R2 reales locales, rutas e imágenes disponibles, borrador protegido. AVISOS: sin captura 3D ni cuentas autorizadas; L1–L3 pendientes.',
  );
}
try {
  if (mode === 'setup') {
    await freePort(8789);
    await assertSafePath();
    run(['d1', 'migrations', 'apply', 'DB', '--local']);
    const temp = await mkdtemp(join(tmpdir(), 'climbing-demo-'));
    try {
      await writeFile(join(temp, 'seed.sql'), seedSql());
      run(['d1', 'execute', 'DB', '--local', '--file', join(temp, 'seed.sql')]);
      for (const route of manifest.routes.filter((r) => r.illustrationId)) {
        const file = join(temp, `${route.illustrationId}.svg`);
        await writeFile(file, poster(route));
        run([
          'r2',
          'object',
          'put',
          `climbing-lab-demo-local-assets/demo/v1/${route.illustrationId}.svg`,
          '--local',
          '--file',
          file,
          '--content-type',
          'image/svg+xml',
        ]);
      }
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
    worker();
    await waitForHealth();
    await check();
    stop();
  } else if (mode === 'run') {
    await freePort(8789);
    await freePort(5174);
    await assertSafePath();
    const api = worker();
    await waitForHealth();
    const web = start('npx', [
      'vite',
      '--mode',
      'demo',
      '--host',
      '127.0.0.1',
      '--port',
      '5174',
      '--strictPort',
    ]);
    console.log(
      'Demo local: http://127.0.0.1:5174/ — enlaces locales, sin acceso desde internet.',
    );
    await Promise.race(
      [api, web].map(
        (c) =>
          new Promise((resolve) => c.once('exit', (code) => resolve(code))),
      ),
    ).then((code) => {
      stop();
      if (code) process.exitCode = 1;
    });
  } else if (mode === 'check') {
    await check();
  } else if (mode === 'reset') {
    if (process.argv[3] !== '--confirm=gym-demo' || process.argv.length !== 4)
      throw new Error(
        'Reset requiere --confirm=gym-demo y elimina únicamente .wrangler/demo.',
      );
    await freePort(8789);
    await freePort(5174);
    await assertSafePath();
    await rm(persist, { recursive: true, force: true });
    console.log(
      'Solo la persistencia demo fue eliminada. Ejecuta npm run demo:setup.',
    );
  } else throw new Error('Usa setup, run, check o reset.');
} catch (e) {
  stop();
  console.error(e.message);
  process.exitCode = 1;
}
