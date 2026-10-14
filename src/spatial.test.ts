import { expect, it } from 'vitest';
import { principalBounds, selectCenter } from './spatial';
it('frames the dense core without including distant background outliers', () => {
  const centers = new Float32Array(103 * 3);
  for (let i = 0; i < 100; i++) centers.set([i / 100, i / 100, i / 100], i * 3);
  centers.set([-50, -50, -50], 300);
  centers.set([50, 50, 50], 303);
  centers.set([NaN, NaN, NaN], 306);
  const bounds = principalBounds(centers)!;
  expect(bounds.min.every((n) => n >= 0)).toBe(true);
  expect(bounds.max.every((n) => n <= 1)).toBe(true);
  expect(principalBounds(new Float32Array())).toBeUndefined();
});
it('selects a nearby center along the ray, ignoring points behind the camera and distant background', () => {
  const centers = new Float32Array([0, 0, -1, 0, 0, 50, 0, 0, 5, 10, 10, 5]);
  expect(selectCenter(centers, [0, 0, 0], [0, 0, 1], 5, 0.02)).toEqual([
    0, 0, 5,
  ]);
  expect(selectCenter(centers, [0, 0, 0], [1, 0, 0], 5, 0.02)).toBeUndefined();
});
it('rejects background centers outside the selected section instead of guessing a point', () => {
  const centers = new Float32Array([0, 0, 50, 0.01, 0, 5]);
  const inSection = (p: [number, number, number]) => p[2] >= 4 && p[2] <= 6;
  expect(
    selectCenter(centers, [0, 0, 0], [0, 0, 1], 50, 0.02, inSection),
  ).toEqual([centers[3], 0, 5]);
  expect(
    selectCenter(
      new Float32Array([0, 0, 50]),
      [0, 0, 0],
      [0, 0, 1],
      50,
      0.02,
      inSection,
    ),
  ).toBeUndefined();
});
