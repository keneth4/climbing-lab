import { expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
it('streams binary multipart upload through the actual Worker runtime', async () => {
  const output = await build({
    stdin: {
      contents:
        "import {handle} from './worker/index.ts'; export default { fetch(req,env){ return handle(req,env,async()=> 'owner'); } };",
      resolveDir: process.cwd(),
      sourcefile: 'runtime-test.ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
  });
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: output.outputFiles[0].text,
      compatibilityDate: '2026-10-12',
      d1Databases: { DB: 'runtime-upload' },
      r2Buckets: { CAPTURES: 'runtime-upload' },
      bindings: {
        GYM_ID: 'test',
        AUTH_ISSUER: 'https://auth.invalid',
        AUTH_AUDIENCE: 'authenticated',
      },
    }),
  );
  try {
    const db = await mf.getD1Database('DB');
    for (const file of [
      '0001_initial.sql',
      '0002_digital_twin.sql',
      '0003_capture_camera.sql',
      '0004_section_geometry.sql',
      '0005_section_revisions.sql',
      '0006_entry_history.sql',
    ]) {
      const sql = await readFile(
        new URL('../migrations/' + file, import.meta.url),
        'utf8',
      );
      for (const statement of sql.split(';').filter((s) => s.trim()))
        await db.prepare(statement).run();
    }
    await db.prepare("INSERT INTO staff VALUES('owner','admin')").run();
    const bytes = new TextEncoder().encode(
      'ply\nformat binary_little_endian 1.0\nelement vertex 0\nend_header\n',
    );
    const create = await mf.dispatchFetch('https://local.test/api/captures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'runtime.ply', size: bytes.length }),
    });
    expect(create.status).toBe(201);
    const { id } = (await create.json()) as { id: string };
    const part = await mf.dispatchFetch(
      `https://local.test/api/captures/${id}/parts/1`,
      { method: 'PUT', body: bytes },
    );
    expect(part.status).toBe(200);
    const complete = await mf.dispatchFetch(
      `https://local.test/api/captures/${id}/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      },
    );
    expect(complete.status).toBe(200);
    const file = await mf.dispatchFetch(
      `https://local.test/api/captures/${id}/file/scene.ply`,
    );
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
  } finally {
    await mf.dispose();
  }
}, 30000);
