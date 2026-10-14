import { readFile, realpath, lstat, mkdir, chmod } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
export const demoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const demoPersist = join(demoRoot, '.wrangler', 'demo');
export const authDirectory = join(demoRoot, '.playwright', 'demo-auth');
export const demoOrigin = 'http://127.0.0.1:5174';
export const demoOrigins = [demoOrigin, 'http://localhost:5174'];
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function assertDemoTarget() {
  const config = JSON.parse(
    await readFile(join(demoRoot, 'wrangler.demo.json'), 'utf8'),
  );
  if (
    process.cwd() !== demoRoot ||
    config.vars.GYM_ID !== 'gym-demo' ||
    config.d1_databases.length !== 1 ||
    config.d1_databases[0].binding !== 'DB' ||
    config.d1_databases[0].database_id !==
      '00000000-0000-0000-0000-000000000003' ||
    config.r2_buckets[0].bucket_name !== 'climbing-lab-demo-local-assets'
  )
    throw new Error('Solo se permite el destino local gym-demo.');
  if (
    (await realpath(demoPersist)) !== demoPersist ||
    (await lstat(demoPersist)).isSymbolicLink()
  )
    throw new Error('Persistencia demo no segura o sin preparar.');
  return config;
}
export async function privateDirectory() {
  await mkdir(authDirectory, { recursive: true, mode: 0o700 });
  if (
    (await realpath(authDirectory)) !== authDirectory ||
    (await lstat(authDirectory)).isSymbolicLink()
  )
    throw new Error('Directorio de sesiones no seguro.');
  await chmod(authDirectory, 0o700);
}
export function profilePath(profile) {
  if (!['staff', 'escalador'].includes(profile))
    throw new Error('Usa staff o escalador.');
  return join(authDirectory, `${profile}.json`);
}
export async function requireDemoServer() {
  const response = await fetch(`${demoOrigin}/api/health`);
  if (!response.ok || (await response.json()).gymId !== 'gym-demo')
    throw new Error('Inicia el demo correcto con npm run demo:run.');
}
