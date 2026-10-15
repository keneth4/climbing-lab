import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { join, resolve, dirname, basename } from 'node:path';
import { readFile, readdir, mkdir, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { backupLocal, restoreLocal } from './recovery.mjs';
import { splitSql } from './restore-sql.mjs';
export async function openLocal(path) {
  const base = resolve('private-backups');
  const parent = dirname(resolve(path));
  if (
    (parent !== base || !/^fixture-[\w-]+$/.test(basename(path))) &&
    (parent !== join(base, 'rehearsals') ||
      !/^restore-[\w-]+$/.test(basename(path)))
  )
    throw new Error('Persistencia fuera del ensayo privado.');
  if (
    (await realpath(path)) !== resolve(path) ||
    (await realpath(base)) !== base
  )
    throw new Error('Persistencia no segura.');
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script:
        'export default {fetch(){return new Response("recovery-fixture")}}',
      compatibilityDate: '2026-10-12',
      d1Databases: { DB: 'recovery-only' },
      r2Buckets: { CAPTURES: 'recovery-only' },
      resourcePersistencePath: path,
    }),
  );
  try {
    return {
      db: await mf.getD1Database('DB'),
      bucket: await mf.getR2Bucket('CAPTURES'),
      close: () => mf.dispose(),
    };
  } catch (error) {
    await mf.dispose();
    throw error;
  }
}
export async function fixture(db, bucket) {
  for (const file of (await readdir('migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    for (const sql of splitSql(
      await readFile(join('migrations', file), 'utf8'),
    ))
      await db.prepare(sql).run();
  }
  await db
    .prepare(
      "INSERT INTO routes(id,name,grade,sector) VALUES('fixture-route','Fixture','V2','Fixture')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO route_revisions(route_id,revision,snapshot) VALUES('fixture-route',1,?)",
    )
    .bind(
      JSON.stringify({
        name: 'Histórica',
        imageId: 'fixture-route-image',
        captureId: 'fixture-capture',
        illustrationId: 'demo-poster-v1-01',
      }),
    )
    .run();
  await db
    .prepare(
      "INSERT INTO route_revisions(route_id,revision,snapshot) VALUES('fixture-route',2,?)",
    )
    .bind(JSON.stringify({ name: 'Actual' }))
    .run();
  await db
    .prepare(
      "INSERT INTO entries(id,user_id,route_id,revision,attempts,result,notes,created_at) VALUES('fixture-entry','synthetic-user','fixture-route',1,2,'intento',?, '2026-10-15')",
    )
    .bind("Nota sintética; con 'comillas'\ny otra línea")
    .run();
  await db
    .prepare(
      "INSERT INTO tours(id,draft_revision,draft,published_revision,status) VALUES('fixture-tour',1,'{}',1,'published')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO tour_revisions VALUES('fixture-tour',1,'{}','synthetic-admin','2026-10-15')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO tour_images VALUES('fixture-image','fixture-tour','fixture-presentation','tour/history.png','synthetic-admin','2026-10-15')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO tour_revision_images VALUES('fixture-tour',1,'fixture-image')",
    )
    .run();
  await bucket.put('demo/v1/demo-poster-v1-01.svg', '<svg>fixture</svg>', {
    httpMetadata: { contentType: 'image/svg+xml' },
    customMetadata: { fixture: 'yes' },
  });
  await bucket.put('tour/history.png', new Uint8Array([137, 80, 78, 71]));
  await db
    .prepare(
      "INSERT INTO captures(id,filename,size,object_key,upload_id,status,upload_state,transform,created_by,created_at) VALUES('fixture-capture','synthetic.ply',4,'capture/synthetic.ply','synthetic','published','ready','{}','synthetic-admin','2026-10-15')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO route_images VALUES('fixture-route-image','fixture-capture','route/history.png','synthetic-admin','2026-10-15','fixture-presentation')",
    )
    .run();
  await bucket.put('capture/synthetic.ply', 'fake');
  await bucket.put('route/history.png', new Uint8Array([137, 80, 78, 71]));

  // More than one inventory page; includes an object larger than usual images.
  for (let i = 0; i < 103; i++)
    await bucket.put(`orphans/${i}`, `fixture-${i}`);
  await bucket.put('../unsafe-key', new Uint8Array(6 * 1024 * 1024).fill(7));
}
export async function rehearse() {
  const stamp = `${Date.now()}-${process.pid}`;
  const root = resolve('private-backups');
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await realpath(root)) !== root)
    throw new Error('Raíz privada no segura.');
  const source = join(root, `fixture-${stamp}`);
  await mkdir(source, { mode: 0o700 });
  const output = join(root, `set-${stamp}`);
  const target = join(root, 'rehearsals', `restore-${stamp}`);
  const adapter = await openLocal(source);
  try {
    await fixture(adapter.db, adapter.bucket);
    await backupLocal({
      ...adapter,
      gymId: 'recovery-fixture',
      output,
      quiescent: true,
    });
  } finally {
    await adapter.close();
  }
  const result = await restoreLocal({
    input: output,
    target,
    confirmation: 'restore-local',
    gymId: 'recovery-fixture',
    openTarget: openLocal,
  });
  console.log(
    JSON.stringify(
      {
        ...result,
        output,
        target,
        note: 'Fixtures locales. Sin evidencia de recuperación remota.',
      },
      null,
      2,
    ),
  );
  return { output, target };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv[2] === 'rehearse' && process.argv.length === 3)
    await rehearse();
  else if (process.argv[2] === 'restore' && process.argv.length === 7) {
    const [, , , input, target, gymId, confirmation] = process.argv;
    console.log(
      await restoreLocal({
        input: resolve(input),
        target: resolve(target),
        gymId,
        confirmation,
        openTarget: openLocal,
      }),
    );
  } else
    throw new Error(
      'Usa rehearse, o restore <backup> <destino private-backups/rehearsals/restore-ID nuevo> <gimnasio> restore-local. Sólo local.',
    );
}
