import { expect, it } from 'vitest';
import { copyHold, applyHoldEdit, nudgePoint } from './route-editing';
import type { Hold3D } from './domain';
it('inspection and cancelled edits never mutate source geometry or derived publication state', () => {
  const hold: Hold3D = { id: 'a', role: 'inicio', position: [1, 2, 3] };
  const state = {
    holds: [hold],
    imageId: 'valid-image',
    markersVerified: true,
  };
  const draft = copyHold(hold);
  draft.position[0] = 9;
  draft.role = 'final';
  expect(state).toEqual({
    holds: [{ id: 'a', role: 'inicio', position: [1, 2, 3] }],
    imageId: 'valid-image',
    markersVerified: true,
  });
  expect(applyHoldEdit(state.holds, copyHold(hold))).toBe(state.holds);
  const applied = applyHoldEdit(state.holds, draft);
  expect(applied).not.toBe(state.holds);
  expect(applied[0].position).toEqual([9, 2, 3]);
  draft.position[1] = 99;
  expect(applied[0].position[1]).toBe(2);
});
it('rejects invalid geometry and missing identities and supports precise reversible nudges', () => {
  const hold: Hold3D = { id: 'a', role: 'intermedio', position: [1, 2, 3] };
  expect(() =>
    applyHoldEdit([hold], { ...hold, position: [NaN, 2, 3] }),
  ).toThrow();
  expect(() => applyHoldEdit([hold], { ...hold, id: 'another' })).toThrow();
  expect(nudgePoint(nudgePoint(hold.position, 0, 0.001), 0, -0.001)).toEqual(
    hold.position,
  );
});
