import { expect, it } from 'vitest';
import {
  align,
  applyTransform,
  type Point,
  type Transform,
} from '../shared/alignment';
it('recovers rotation, translation and scale from distributed references', () => {
  const points: Point[] = [
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 2, 3],
  ];
  const expected: Transform = {
    scale: 2.5,
    rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
    translation: [4, -3, 2],
  };
  const target = points.map((p) => applyTransform(p, expected));
  const result = align(points, target);
  expect(result.rms).toBeLessThan(1e-8);
  for (let i = 0; i < points.length; i++)
    expect(
      Math.hypot(
        ...applyTransform(points[i], result.transform).map(
          (n, j) => n - target[i][j],
        ),
      ),
    ).toBeLessThan(1e-8);
  expect(result.transform.scale).toBeCloseTo(2.5);
});
it('rejects collinear or coincident references', () => {
  expect(() =>
    align(
      [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
      ],
      [
        [0, 0, 0],
        [2, 0, 0],
        [4, 0, 0],
      ],
    ),
  ).toThrow();
});
it('accepts a planar fiducial distribution without reflecting the scene', () => {
  const source: Point[] = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    target = source.map((p) => [p[0] * 3 + 2, p[1] * 3 - 5, 7] as Point);
  const result = align(source, target);
  expect(result.rms).toBeLessThan(1e-8);
  expect(result.transform.scale).toBeCloseTo(3);
});
