import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkPilot } from './pilot-config.mjs';
const template = JSON.parse(
  await readFile('wrangler.pilot.example.json', 'utf8'),
);
function valid() {
  return {
    ...template,
    name: 'climbing-pilot',
    account_id: 'a'.repeat(32),
    vars: {
      ...template.vars,
      GYM_ID: 'pilot-one',
      PUBLIC_ORIGIN: 'https://pilot.example.com',
    },
    d1_databases: [
      {
        binding: 'DB',
        database_name: 'pilot-db',
        migrations_dir: 'migrations',
        database_id: '12345678-1234-1234-1234-123456789abc',
      },
    ],
    r2_buckets: [{ binding: 'CAPTURES', bucket_name: 'pilot-assets' }],
  };
}
test('configuration does not certify resources or remote behavior', () => {
  const r = checkPilot(valid());
  assert.equal(r.configured, true);
  assert.equal(r.locallyVerified, false);
  assert.equal(r.remotelyVerified, false);
});
test('reject placeholders, protected gyms, local resources and insecure origins', () => {
  assert.throws(() => checkPilot(template));
  for (const id of ['gym-a', 'gym-b', 'gym-demo', '../../escape'])
    assert.throws(() =>
      checkPilot({ ...valid(), vars: { ...valid().vars, GYM_ID: id } }),
    );
  for (const origin of [
    'http://pilot.example.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://pilot.example.com/path',
    'https://u:p@pilot.example.com',
    'https://pilot.example.com?q=1',
  ])
    assert.throws(() =>
      checkPilot({
        ...valid(),
        vars: { ...valid().vars, PUBLIC_ORIGIN: origin },
      }),
    );
  assert.throws(() => checkPilot({ ...valid(), ratelimits: [] }));
  assert.throws(() => checkPilot({ ...valid(), assets: {} }));
});
