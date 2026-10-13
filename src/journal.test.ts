import { expect, it } from 'vitest';
import {
  localBoundary,
  journalCsv,
  activityUtc,
  localActivityTime,
} from './journal';
it('converts local calendar dates to a half-open interval and rejects invalid dates', () => {
  expect(localBoundary('2026-10-12', true)).toBe(localBoundary('2026-10-13'));
  expect(() => localBoundary('2026-02-30')).toThrow();
  expect(() => localBoundary('bad')).toThrow();
});
it('exports the historical fields and quotes notes while neutralizing spreadsheet formulas', () => {
  const csv = journalCsv([
    {
      id: 'e',
      routeId: 'r',
      routeName: '=HYPERLINK("x")',
      grade: 'V2',
      revision: 1,
      date: '2026-10-12T00:00:00.000Z',
      attempts: 3,
      result: 'ascenso',
      notes: 'note, "quoted"\nnext',
    },
  ]);
  expect(csv).toContain('"\'=HYPERLINK(""x"")"');
  expect(csv).toContain('"note, ""quoted""\nnext"');
  expect(csv).toContain('"ascenso","3"');
});

it('converts explicit local activity time and rejects invalid and future input', () => {
  const local = '2020-01-15T12:30';
  expect(localActivityTime(new Date(activityUtc(local)))).toBe(local);
  for (const value of ['bad', '2020-02-30T12:30', '2999-01-01T12:30'])
    expect(() => activityUtc(value)).toThrow();
});
