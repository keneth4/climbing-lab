import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, symlink, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
const root = resolve(import.meta.dirname, '..'),
  script = join(root, 'scripts/demo-migrate.mjs');
test('migration rejects remote/destination overrides and another working directory before any service access', () => {
  for (const [cwd, args] of [
    [root, ['--remote']],
    [root, ['--persist-to=/tmp']],
    [tmpdir(), []],
  ]) {
    const run = spawnSync(process.execPath, [script, ...args], {
      cwd,
      encoding: 'utf8',
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /Destino fijo gym-demo requerido/);
  }
});
test('migration rejects symlinked persistence before invoking Wrangler or a service', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tour-migration-guard-'));
  try {
    await mkdir(join(dir, 'scripts'));
    await mkdir(join(dir, '.wrangler'));
    await copyFile(script, join(dir, 'scripts/demo-migrate.mjs'));
    await copyFile(
      join(root, 'wrangler.demo.json'),
      join(dir, 'wrangler.demo.json'),
    );
    await symlink(tmpdir(), join(dir, '.wrangler/demo'));
    const run = spawnSync(
      process.execPath,
      [join(dir, 'scripts/demo-migrate.mjs')],
      { cwd: dir, encoding: 'utf8' },
    );
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /Persistencia demo no segura/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
