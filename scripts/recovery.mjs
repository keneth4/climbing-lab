import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  mkdir,
  readFile,
  writeFile,
  lstat,
  realpath,
  chmod,
} from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform, Readable } from 'node:stream';
import { prepareRestore, splitSql } from './restore-sql.mjs';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const ident = (name) => '"' + name.replaceAll('"', '""') + '"';
const root = resolve('private-backups');
async function ensureRoot() {
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await lstat(root)).isSymbolicLink() || (await realpath(root)) !== root)
    throw new Error('Raíz privada no segura.');
  await chmod(root, 0o700);
}
async function privateDir(path) {
  await mkdir(path, { mode: 0o700 });
  await chmod(path, 0o700);
}
async function digestFile(path) {
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { sha256: hash.digest('hex'), size };
}
async function streamFile(body, path) {
  const hash = createHash('sha256');
  let size = 0;
  await pipeline(
    body,
    new Transform({
      transform(chunk, _, cb) {
        hash.update(chunk);
        size += chunk.length;
        cb(null, chunk);
      },
    }),
    createWriteStream(path, { flags: 'wx', mode: 0o600 }),
  );
  return { sha256: hash.digest('hex'), size };
}
async function rows(db, sql) {
  return (await db.prepare(sql).all()).results;
}
export async function* exportSql(db) {
  const schema = await rows(
    db,
    "SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,name",
  );
  for (const item of schema) {
    if (item.type !== 'table') continue;
    yield item.sql + ';\n';
    const columns = (
      await rows(db, `PRAGMA table_info(${ident(item.name)})`)
    ).map((c) => c.name);
    const select = columns
      .map((c) => `quote(${ident(c)}) AS ${ident(c)}`)
      .join(',');
    for (let offset = 0; ; offset += 100) {
      const page = await rows(
        db,
        `SELECT ${select} FROM ${ident(item.name)} LIMIT 100 OFFSET ${offset}`,
      );
      for (const row of page)
        yield `INSERT INTO ${ident(item.name)} (${columns.map(ident).join(',')}) VALUES(${columns.map((c) => row[c]).join(',')});\n`;
      if (page.length < 100) break;
    }
  }
  for (const item of schema) if (item.type !== 'table') yield item.sql + ';\n';
}
export async function references(db) {
  const refs = new Set();
  async function snapshotRefs(value, imageTable) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'imageId' && typeof item === 'string') {
        const row = await db
          .prepare(`SELECT object_key FROM ${imageTable} WHERE id=?`)
          .bind(item)
          .first();
        if (!row) throw new Error('Referencia histórica de imagen ausente.');
        refs.add(row.object_key);
      }
      if (key === 'captureId' && typeof item === 'string') {
        const capture = await db
          .prepare('SELECT id FROM captures WHERE id=?')
          .bind(item)
          .first();
        if (!capture)
          throw new Error('Referencia histórica de captura ausente.');
      }
      if (key === 'illustrationId' && typeof item === 'string')
        refs.add(`demo/v1/${item}.svg`);
      await snapshotRefs(item, imageTable);
    }
  }
  const tables = await rows(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
  );
  for (const { name } of tables) {
    const columns = await rows(db, `PRAGMA table_info(${ident(name)})`);
    if (columns.some((c) => c.name === 'object_key')) {
      const where = name === 'captures' ? " WHERE upload_state='ready'" : '';
      for (const r of await rows(
        db,
        `SELECT object_key FROM ${ident(name)}${where}`,
      ))
        refs.add(r.object_key);
    }
    for (const { name: column } of columns.filter((c) =>
      ['snapshot', 'draft'].includes(c.name),
    )) {
      for (const r of await rows(
        db,
        `SELECT ${ident(column)} AS value FROM ${ident(name)}`,
      )) {
        const value = JSON.parse(r.value);
        await snapshotRefs(
          value,
          ['tours', 'tour_revisions'].includes(name)
            ? 'tour_images'
            : 'route_images',
        );
      }
    }
  }
  return [...refs].sort();
}
export async function assertDatabase(db, keys) {
  if ((await rows(db, 'PRAGMA foreign_key_check')).length)
    throw new Error('Integridad SQL o claves foráneas inválidas.');
  const missing = (await references(db)).filter((key) => !keys.has(key));
  if (missing.length)
    throw new Error(`Referencias D1/R2 ausentes: ${missing.length}`);
}
export async function backupLocal({ db, bucket, gymId, output, quiescent }) {
  if (quiescent !== true)
    throw new Error('Detén escrituras y cargas antes del respaldo.');
  await ensureRoot();
  const base = await realpath(root);
  if (
    dirname(resolve(output)) !== base ||
    !/^set-[\w-]+$/.test(basename(output))
  )
    throw new Error('Destino de backup privado inválido.');
  const captureTable = await rows(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name='captures'",
  );
  if (
    captureTable.length &&
    (
      await rows(
        db,
        "SELECT id FROM captures WHERE upload_state IN ('uploading','finalizing')",
      )
    ).length
  )
    throw new Error(
      'Hay cargas pendientes; no se puede respaldar un estado en vuelo.',
    );
  await privateDir(output);
  await privateDir(join(output, 'objects'));
  const sql = await streamFile(
    Readable.from(exportSql(db)),
    join(output, 'database.sql'),
  );
  const objects = [];
  const keys = new Set();
  let cursor;
  do {
    const page = await bucket.list({
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    for (const item of page.objects) {
      if (keys.has(item.key))
        throw new Error('Inventario R2 duplicado o cambiante.');
      const object = await bucket.get(item.key);
      if (!object) throw new Error('Objeto desapareció durante backup.');
      const file = sha(item.key);
      const digest = await streamFile(
        object.body,
        join(output, 'objects', file),
      );
      if (digest.size !== object.size || object.etag !== item.etag)
        throw new Error('Objeto cambió durante backup.');
      objects.push({
        key: item.key,
        file,
        ...digest,
        httpMetadata: object.httpMetadata,
        customMetadata: object.customMetadata,
      });
      keys.add(item.key);
    }
    if (page.truncated && (!page.cursor || cursor === page.cursor))
      throw new Error('Paginación R2 inválida.');
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  await assertDatabase(db, keys);
  validateSql(await readFile(join(output, 'database.sql'), 'utf8'));
  const schema = await rows(
    db,
    "SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
  );
  const manifest = {
    version: 1,
    scope: 'local-only',
    gymId,
    createdAt: new Date().toISOString(),
    schema,
    sql,
    objects,
  };
  // Written last: an interrupted set is never a valid backup.
  await writeFile(
    join(output, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    { flag: 'wx', mode: 0o600 },
  );
  return manifest;
}
export function validateSql(sql) {
  const db = new DatabaseSync(':memory:');
  try {
    const prepared = prepareRestore(sql);
    for (const statement of splitSql(prepared)) {
      const clean = statement
        .replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, '')
        .trim();
      if (
        !/^(?:CREATE\s+TABLE\s|CREATE\s+(?:UNIQUE\s+)?INDEX\s|INSERT\s+INTO\s|PRAGMA\s+defer_foreign_keys\s*=\s*TRUE\s*;?$)/i.test(
          clean,
        )
      )
        throw new Error('Sentencia SQL fuera del formato de respaldo local.');
    }
    db.exec('PRAGMA foreign_keys=ON; BEGIN;' + prepared + 'COMMIT;');
    if (
      db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' ||
      db.prepare('PRAGMA foreign_key_check').all().length
    )
      throw new Error('Integridad SQL inválida.');
  } finally {
    db.close();
  }
}
export async function verifyBackup(input, gymId) {
  const base = await realpath(input);
  if (!(await lstat(join(base, 'manifest.json'))).isFile())
    throw new Error('Manifiesto inválido.');
  const m = JSON.parse(await readFile(join(base, 'manifest.json'), 'utf8'));
  if (
    m.version !== 1 ||
    m.scope !== 'local-only' ||
    m.gymId !== gymId ||
    !Array.isArray(m.schema) ||
    !Array.isArray(m.objects)
  )
    throw new Error('Manifiesto incompatible.');
  const files = [
    { ...m.sql, file: 'database.sql' },
    ...m.objects.map((o) => ({ ...o, file: `objects/${o.file}` })),
  ];
  const keys = new Set();
  for (const o of m.objects) {
    if (typeof o.key !== 'string' || o.file !== sha(o.key) || keys.has(o.key))
      throw new Error('Clave o archivo inválidos.');
    keys.add(o.key);
  }
  for (const f of files) {
    if (
      !/^[a-f0-9]{64}$/.test(f.sha256 ?? '') ||
      !Number.isSafeInteger(f.size) ||
      f.size < 0
    )
      throw new Error('Metadatos de integridad inválidos.');
    const path = join(base, f.file);
    if (
      (await lstat(path)).isSymbolicLink() ||
      !(await lstat(path)).isFile() ||
      (await realpath(path)) !== path
    )
      throw new Error('Archivo de backup inseguro.');
    const digest = await digestFile(path);
    if (digest.sha256 !== f.sha256 || digest.size !== f.size)
      throw new Error('Archivo ausente o corrupto.');
  }
  return m;
}
export async function reserveRestoreTarget(target, confirmation) {
  await ensureRoot();
  const parent = join(root, 'rehearsals');
  await mkdir(parent, { recursive: true, mode: 0o700 });
  if (
    confirmation !== 'restore-local' ||
    dirname(resolve(target)) !== (await realpath(parent)) ||
    !/^restore-[\w-]+$/.test(basename(target))
  )
    throw new Error('Destino protegido o confirmación inválida.');
  // Exclusive creation rejects existing, nonempty and symlink destinations alike.
  await privateDir(target);
  await writeFile(
    join(target, 'restore-target.json'),
    JSON.stringify({ kind: 'local-rehearsal', version: 1 }),
    { flag: 'wx', mode: 0o600 },
  );
}
export async function restoreLocal({
  input,
  target,
  confirmation,
  gymId,
  openTarget,
}) {
  const manifest = await verifyBackup(input, gymId);
  const originalSql = await readFile(join(input, 'database.sql'), 'utf8');
  validateSql(originalSql);
  const sql = prepareRestore(originalSql);
  await reserveRestoreTarget(target, confirmation);
  const { db, bucket, close } = await openTarget(target);
  try {
    if (
      (
        await rows(
          db,
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%'",
        )
      ).length ||
      (await bucket.list({ limit: 1 })).objects.length
    )
      throw new Error('El destino no está vacío.');
    await db.batch(splitSql(sql).map((statement) => db.prepare(statement)));
    for (const object of manifest.objects) {
      const options = {
        httpMetadata: {
          ...object.httpMetadata,
          ...(object.httpMetadata?.cacheExpiry
            ? { cacheExpiry: new Date(object.httpMetadata.cacheExpiry) }
            : {}),
        },
        customMetadata: object.customMetadata,
      };
      if (object.size === 0) {
        await bucket.put(object.key, new Uint8Array(), options);
        continue;
      }
      const upload = await bucket.createMultipartUpload(object.key, options);
      const parts = [];
      try {
        let buffer = Buffer.alloc(5 * 1024 * 1024),
          used = 0;
        for await (const chunk of createReadStream(
          join(input, 'objects', object.file),
        )) {
          let offset = 0;
          while (offset < chunk.length) {
            const length = Math.min(
              buffer.length - used,
              chunk.length - offset,
            );
            chunk.copy(buffer, used, offset, offset + length);
            used += length;
            offset += length;
            if (used === buffer.length) {
              parts.push(await upload.uploadPart(parts.length + 1, buffer));
              buffer = Buffer.alloc(5 * 1024 * 1024);
              used = 0;
            }
          }
        }
        if (used)
          parts.push(
            await upload.uploadPart(parts.length + 1, buffer.subarray(0, used)),
          );
        await upload.complete(parts);
      } catch (error) {
        await upload.abort();
        throw error;
      }
    }
    const keys = new Set();
    for (const object of manifest.objects) {
      const restored = await bucket.get(object.key);
      if (!restored) throw new Error('Objeto no restaurado.');
      const hash = createHash('sha256');
      let size = 0;
      for await (const chunk of restored.body) {
        hash.update(chunk);
        size += chunk.length;
      }
      if (size !== object.size || hash.digest('hex') !== object.sha256)
        throw new Error('Restauración R2 corrupta.');
      const metadata = (value) =>
        JSON.stringify(
          Object.fromEntries(
            Object.entries(value ?? {})
              .map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])
              .sort(([a], [b]) => a.localeCompare(b)),
          ),
        );
      if (
        metadata(restored.httpMetadata) !== metadata(object.httpMetadata) ||
        metadata(restored.customMetadata) !== metadata(object.customMetadata)
      )
        throw new Error('Metadatos R2 restaurados distintos.');
      keys.add(object.key);
    }
    await assertDatabase(db, keys);
    const schema = await rows(
      db,
      "SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
    );
    if (JSON.stringify(schema) !== JSON.stringify(manifest.schema))
      throw new Error('Esquema restaurado distinto.');
    await writeFile(
      join(target, 'verified.json'),
      JSON.stringify({
        gymId,
        verifiedLocally: true,
        verifiedRemotely: false,
        objects: keys.size,
      }),
      { mode: 0o600, flag: 'wx' },
    );
    return {
      objects: keys.size,
      verifiedLocally: true,
      verifiedRemotely: false,
    };
  } finally {
    await close();
  }
}
