import assert from 'node:assert/strict';
import { uuidPattern, demoOrigins } from './demo-local.mjs';
export function privateArguments(args) {
  assert(
    args.length === 2 &&
      uuidPattern.test(args[0]) &&
      args[1] === '--confirm=gym-demo',
  );
  return args[0];
}
export function privateIdentities(staff, climber) {
  assert(staff.gymId === 'gym-demo' && climber.gymId === 'gym-demo');
  assert(
    uuidPattern.test(staff.userId) &&
      uuidPattern.test(climber.userId) &&
      staff.userId !== climber.userId,
  );
  assert(['admin', 'editor'].includes(staff.staff) && !climber.staff);
}
export function verifiedPresentation(route) {
  const s = route.snapshot;
  assert.equal(route.status, 'activa');
  assert(
    s.markersVerified &&
      s.imageId &&
      s.camera &&
      s.camera.captureId === s.captureId,
  );
  assert(
    s.holds3D?.some((h) => h.role === 'inicio') &&
      s.holds3D.some((h) => h.role === 'final'),
  );
  const keys = [
    'name',
    'grade',
    'sector',
    'beta',
    'holds',
    'holds3D',
    'camera',
    'sectionId',
    'captureId',
    'gradeScale',
    'rules',
    'imageId',
    'markersVerified',
  ];
  return Object.fromEntries(
    keys.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]),
  );
}

export function privateSessionState(state) {
  assert(state.cookies?.length === 0 && state.origins?.length === 1);
  const origin = state.origins[0];
  assert(demoOrigins.includes(origin.origin));
  assert(
    origin.localStorage?.length === 1 &&
      origin.localStorage[0].name === 'sb-defblrjdwgnqyzzgozdf-auth-token',
  );
  return state;
}
