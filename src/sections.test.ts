import { expect, it } from 'vitest';
import {
  polygonGeometry,
  polygonBounds,
  projectVertex,
} from '../shared/sections';
const square = {
  type: 'polygon',
  plane: 'XY',
  elevation: 2,
  thickness: 0.5,
  vertices: [
    [0, 0, 2],
    [2, 0, 2],
    [2, 2, 2],
    [0, 2, 2],
  ],
};
it('validates a simple contour and computes its extruded bounds', () => {
  const g = polygonGeometry(square);
  expect(polygonBounds(g)).toEqual({ min: [0, 0, 1.75], max: [2, 2, 2.25] });
});
it('rejects crossing, duplicate, collinear and off-plane vertices', () => {
  for (const vertices of [
    [
      [0, 0, 2],
      [2, 2, 2],
      [0, 2, 2],
      [2, 0, 2],
    ],
    [
      [0, 0, 2],
      [0, 0, 2],
      [2, 2, 2],
    ],
    [
      [0, 0, 2],
      [1, 0, 2],
      [2, 0, 2],
    ],
    [
      [0, 0, 2],
      [2, 0, 3],
      [2, 2, 2],
    ],
  ])
    expect(() => polygonGeometry({ ...square, vertices })).toThrow();
});
it('projects into a horizontal grid and snaps the two in-plane coordinates', () => {
  expect(projectVertex([0.74, 3, 1.24], 'XZ', 0, 0.5)).toEqual([0.5, 0, 1]);
});
