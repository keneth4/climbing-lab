import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { assertDemoTarget, demoPersist } from './demo-local.mjs';

async function main() {
  const config = await assertDemoTarget();
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("local")}}',
      compatibilityDate: config.compatibility_date,
      d1Databases: { DB: config.d1_databases[0].database_id },
      r2Buckets: { CAPTURES: config.r2_buckets[0].bucket_name },
      resourcePersistencePath: join(demoPersist, 'v3'),
    }),
  );
  try {
    const db = await mf.getD1Database('DB');
    const row = await db
      .prepare(
        "SELECT id,size,object_key,status,upload_state FROM captures WHERE filename='Crux 1.ply' ORDER BY created_at DESC LIMIT 1",
      )
      .first();
    if (!row || row.upload_state !== 'ready')
      throw new Error('Crux no está listo en el demo.');
    const bucket = await mf.getR2Bucket('CAPTURES');
    const object = await bucket.get(row.object_key);
    if (!object) throw new Error('Objeto R2 ausente.');
    const original = createHash('sha256');
    for await (const chunk of createReadStream(
      '/Users/keneth4/Downloads/Crux 1.ply',
    ))
      original.update(chunk);
    const uploaded = createHash('sha256');
    for await (const chunk of object.body) uploaded.update(chunk);
    const matches = original.digest('hex') === uploaded.digest('hex');
    if (!matches || object.size !== row.size)
      throw new Error('Integridad de carga incorrecta.');
    console.log(
      JSON.stringify({
        captureId: row.id,
        bytes: object.size,
        status: row.status,
        sha256Matches: matches,
      }),
    );
  } finally {
    await mf.dispose();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
