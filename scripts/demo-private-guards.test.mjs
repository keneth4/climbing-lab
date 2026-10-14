import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  privateArguments,
  privateIdentities,
  verifiedPresentation,
} from './demo-private-guards.mjs';
const first = '00000000-0000-0000-0000-000000000001';
const second = '00000000-0000-0000-0000-000000000002';
const staff = { gymId: 'gym-demo', userId: first, staff: 'admin' };
const climber = { gymId: 'gym-demo', userId: second, staff: null };
test('fixed confirmation and explicit route required', () => {
  assert.equal(privateArguments([first, '--confirm=gym-demo']), first);
  for (const args of [
    [],
    [first],
    [first, '--confirm=gym-a'],
    ['demo-route-01', '--confirm=gym-demo'],
    [first, '--confirm=gym-demo', 'extra'],
  ])
    assert.throws(() => privateArguments(args));
});
test('different real identities and roles required before writes', () => {
  privateIdentities(staff, climber);
  privateIdentities({ ...staff, staff: 'editor' }, climber);
  for (const pair of [
    [staff, { ...climber, userId: first }],
    [{ ...staff, gymId: 'gym-a' }, climber],
    [staff, { ...climber, gymId: 'gym-b' }],
    [{ ...staff, staff: null }, climber],
    [staff, { ...climber, staff: 'editor' }],
  ])
    assert.throws(() => privateIdentities(...pair));
});
test('never clone unverified draft or mismatched presentation', () => {
  const route = {
    status: 'activa',
    snapshot: {
      id: first,
      revision: 3,
      captureId: first,
      camera: { captureId: first },
      imageId: second,
      markersVerified: true,
      holds3D: [
        { role: 'inicio', position: [1, 2, 3] },
        { role: 'final', position: [2, 3, 4] },
      ],
    },
  };
  const payload = verifiedPresentation(route);
  assert(!('revision' in payload) && !('id' in payload));
  assert.strictEqual(payload.holds3D, route.snapshot.holds3D);
  for (const bad of [
    { ...route, status: 'borrador' },
    { ...route, snapshot: { ...route.snapshot, markersVerified: false } },
    {
      ...route,
      snapshot: { ...route.snapshot, camera: { captureId: second } },
    },
    { ...route, snapshot: { ...route.snapshot, holds3D: [] } },
  ])
    assert.throws(() => verifiedPresentation(bad));
});
