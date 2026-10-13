import { expect, it } from 'vitest';
import { createEntry, initialState, isState } from './domain';
it('keeps ascent identity after route changes', () => {
  const route = initialState().routes[0];
  const entry = createEntry(route, 3, 'ascenso', 'Listo');
  route.name = 'Nombre corregido';
  route.revision = 2;
  expect(entry.routeName).toBe('La travesía');
  expect(entry.revision).toBe(1);
});
it('rejects invalid attempt counts', () => {
  for (const count of [0, -1, 1.5, NaN])
    expect(() =>
      createEntry(initialState().routes[0], count, 'intento', ''),
    ).toThrow();
});

it('rejects malformed persisted data', () => {
  expect(isState({ routes: [{}], entries: [], reports: [] })).toBe(false);
  expect(isState(initialState())).toBe(true);
});
it('snapshots holds for historical exports', () => {
  const route = initialState().routes[0];
  const entry = createEntry(route, 1, 'ascenso', '');
  route.holds[0].x = 90;
  expect(entry.holds?.[0].x).toBe(25);
});
