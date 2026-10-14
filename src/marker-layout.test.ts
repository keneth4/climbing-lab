import { expect, it } from 'vitest';
import {
  layoutMarkers,
  overlaps,
  cssToPng,
  viewportToLocal,
} from './marker-layout';
it('keeps anchors fixed and separates nearby labels and their hit targets', () => {
  const marks = [
    { id: 'a', x: 100, y: 100, label: 'I', role: 'inicio' as const },
    { id: 'b', x: 110, y: 105, label: 'F', role: 'final' as const },
  ];
  const result = layoutMarkers(marks, 320, 200);
  expect(result.map((m) => [m.x, m.y])).toEqual([
    [100, 100],
    [110, 105],
  ]);
  expect(result.every((m) => m.labelPoint)).toBe(true);
  const [a, b] = result.map((m) => ({
    x: m.labelPoint!.x - 24,
    y: m.labelPoint!.y - 24,
    width: 48,
    height: 48,
  }));
  expect(overlaps(a, b)).toBe(false);
  expect(layoutMarkers(marks, 320, 200)).toEqual(result);
});
it('keeps labels inside borders at every supported width and leaves dense anchors recoverable', () => {
  for (const width of [320, 390, 768, 1440]) {
    const marks = Array.from({ length: 40 }, (_, i) => ({
      id: String(i),
      x: width - 4,
      y: 4,
      label: String(i),
      role: 'intermedio' as const,
    }));
    const result = layoutMarkers(marks, width, 180);
    expect(result).toHaveLength(40);
    expect(result.some((m) => !m.labelPoint)).toBe(true);
    for (const m of result.filter((m) => m.labelPoint)) {
      expect(m.labelPoint!.x - 24).toBeGreaterThanOrEqual(6);
      expect(m.labelPoint!.x + 24).toBeLessThanOrEqual(width - 6);
      expect(m.labelPoint!.y - 24).toBeGreaterThanOrEqual(6);
    }
  }
});
it('honors visibility but keeps active/candidate signals and reserves controls', () => {
  const marks = [
    {
      id: 'a',
      x: 120,
      y: 120,
      label: '1',
      role: 'intermedio' as const,
      active: true,
    },
    { id: 'b', x: 220, y: 120, label: '2', role: 'intermedio' as const },
    { id: 'c', x: 300, y: 120, label: 'F', role: 'final' as const },
  ];
  const hidden = layoutMarkers(marks, 390, 240, 'hidden');
  expect(hidden[0].labelPoint).toBeDefined();
  expect(hidden[1].labelPoint).toBeUndefined();
  const ends = layoutMarkers(marks, 390, 240, 'ends');
  expect(ends[2].labelPoint).toBeDefined();
  const blocked = layoutMarkers(marks, 390, 240, 'all', [
    { x: 0, y: 0, width: 390, height: 240 },
  ]);
  expect(blocked.every((m) => !m.labelPoint)).toBe(true);
});
it('maps CSS origin, offset and PNG scale independently of DPR and rejects nonfinite anchors', () => {
  const rect = { x: 80, y: 210, width: 320, height: 180 };
  const local = viewportToLocal({ x: 180, y: 250 }, rect);
  expect(local).toEqual({ x: 100, y: 40 });
  for (const dpr of [1, 2, 3])
    expect(
      cssToPng(local, rect, { width: 320 * dpr, height: 180 * dpr }),
    ).toEqual({ x: 100 * dpr, y: 40 * dpr });
  expect(
    layoutMarkers(
      [{ id: 'a', x: NaN, y: 10, label: '1', role: 'intermedio' }],
      320,
      180,
    ),
  ).toEqual([]);
});
