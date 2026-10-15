import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  readFile,
  writeFile,
  stat,
  rm,
  symlink,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { openLocal, fixture } from './recovery-local.mjs';
import {
  backupLocal,
  verifyBackup,
  restoreLocal,
  reserveRestoreTarget,
  validateSql,
} from './recovery.mjs';
const root = resolve('private-backups');
const id = `test-${Date.now()}-${process.pid}`;
const source = join(root, `fixture-${id}`),
  output = join(root, `set-${id}`);
const target = join(root, 'rehearsals', `restore-${id}`);
let adapter, manifest;
before(async () => {
  await mkdir(root, { recursive: true, mode: 0o700 });
  await mkdir(source, { mode: 0o700 });
  adapter = await openLocal(source);
  await fixture(adapter.db, adapter.bucket);
  manifest = await backupLocal({
    ...adapter,
    gymId: 'fixture',
    output,
    quiescent: true,
  });
});
after(async () => {
  await adapter?.close();
});
test('complete current schema and historical references survive paginated streamed D1/R2 restore', async () => {
  assert.ok(manifest.objects.length > 100);
  assert.ok(manifest.objects.some((o) => o.size >= 6 * 1024 * 1024));
  assert.ok(manifest.schema.some((t) => t.name === 'tour_revision_images'));
  assert.equal((await stat(join(output, 'database.sql'))).mode & 0o777, 0o600);
  assert.equal((await stat(output)).mode & 0o777, 0o700);
  const result = await restoreLocal({
    input: output,
    target,
    confirmation: 'restore-local',
    gymId: 'fixture',
    openTarget: openLocal,
  });
  assert.equal(result.verifiedRemotely, false);
  const restored = await openLocal(target);
  try {
    assert.equal(
      (await restored.db.prepare('SELECT revision FROM entries').first())
        .revision,
      1,
    );
    assert.equal(
      (
        await restored.db
          .prepare('SELECT count(*) AS n FROM route_revisions')
          .first()
      ).n,
      2,
    );
    const o = await restored.bucket.get('demo/v1/demo-poster-v1-01.svg');
    assert.equal(o.customMetadata.fixture, 'yes');
    assert.equal(o.httpMetadata.contentType, 'image/svg+xml');
  } finally {
    await restored.close();
  }
});
test('reject corrupt/missing objects, incompatible manifest and wrong gym before target creation', async () => {
  await assert.rejects(() => verifyBackup(output, 'wrong'), /incompatible/);
  const object = manifest.objects.find((o) => o.size < 100);
  const file = join(output, 'objects', object.file);
  const original = await readFile(file);
  try {
    await writeFile(file, 'corrupt');
    await assert.rejects(() => verifyBackup(output, 'fixture'), /corrupto/);
    await rm(file);
    await assert.rejects(() => verifyBackup(output, 'fixture'));
  } finally {
    await writeFile(file, original, { mode: 0o600 });
  }
  const path = join(output, 'manifest.json');
  const originalManifest = await readFile(path);
  try {
    await writeFile(path, JSON.stringify({ ...manifest, version: 99 }));
    await assert.rejects(() => verifyBackup(output, 'fixture'), /incompatible/);
  } finally {
    await writeFile(path, originalManifest);
  }
});
test('protected, existing and symlink destinations cannot be restored over', async () => {
  for (const path of [
    '.wrangler/demo',
    '.wrangler/state',
    '.wrangler/state/gym-b',
    target,
  ])
    await assert.rejects(() =>
      reserveRestoreTarget(resolve(path), 'restore-local'),
    );
  await assert.rejects(() =>
    reserveRestoreTarget(
      join(root, 'rehearsals', `restore-other-${id}`),
      'gym-demo',
    ),
  );
  const link = join(root, 'rehearsals', `restore-link-${id}`);
  await symlink(source, link);
  await assert.rejects(() => reserveRestoreTarget(link, 'restore-local'));
});
test('missing D1/R2 reference and interrupted inventories cannot produce a complete backup', async () => {
  const broken = join(root, `set-broken-${id}`);
  const bucket = { list: async () => ({ objects: [], truncated: false }) };
  await assert.rejects(
    () =>
      backupLocal({
        ...adapter,
        bucket,
        gymId: 'fixture',
        output: broken,
        quiescent: true,
      }),
    /ausentes/,
  );
  await assert.rejects(() => readFile(join(broken, 'manifest.json')));
  const interrupted = join(root, `set-interrupted-${id}`);
  await assert.rejects(
    () =>
      backupLocal({
        ...adapter,
        bucket: {
          list: () => adapter.bucket.list(),
          get: async () => {
            throw new Error('interrupted');
          },
        },
        gymId: 'fixture',
        output: interrupted,
        quiescent: true,
      }),
    /interrupted/,
  );
  await assert.rejects(() => verifyBackup(interrupted, 'fixture'));
});
test('requires quiescence and rejects invalid SQL foreign keys', async () => {
  await assert.rejects(
    () => backupLocal({ ...adapter, output, gymId: 'fixture' }),
    /escrituras/,
  );
  assert.throws(() =>
    validateSql(
      'CREATE TABLE p(id PRIMARY KEY); CREATE TABLE c(id REFERENCES p(id)); INSERT INTO c VALUES(1);',
    ),
  );
});

test('restore interruption never leaves a verified marker and does not overwrite its target', async () => {
  const failed = join(root, 'rehearsals', `restore-failed-${id}`);
  let aborted = false;
  await assert.rejects(
    () =>
      restoreLocal({
        input: output,
        target: failed,
        confirmation: 'restore-local',
        gymId: 'fixture',
        openTarget: async (path) => {
          const runtime = await openLocal(path);
          return {
            ...runtime,
            bucket: {
              list: (...args) => runtime.bucket.list(...args),
              createMultipartUpload: async () => ({
                uploadPart: async () => {
                  throw new Error('upload interrupted');
                },
                abort: async () => {
                  aborted = true;
                },
              }),
            },
          };
        },
      }),
    /upload interrupted/,
  );
  assert.equal(aborted, true);
  await assert.rejects(() => readFile(join(failed, 'verified.json')));
  await assert.rejects(() => reserveRestoreTarget(failed, 'restore-local'));
});
