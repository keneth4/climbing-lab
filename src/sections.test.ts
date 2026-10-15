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

it('constructs a tilted right-handed plane and maps UV and symmetric depth', async () => {
  const { planeFromPoints, worldToUV, uvToWorld, geometryVertices } =
    await import('../shared/sections');
  const plane = planeFromPoints([
    [1, 2, 3],
    [3, 2, 3],
    [1, 4, 5],
  ]);
  const world = uvToWorld([2, 3], plane);
  const uv = worldToUV(world, plane);
  expect(uv[0]).toBeCloseTo(2);
  expect(uv[1]).toBeCloseTo(3);
  const geometry = polygonGeometry({
    type: 'oriented-polygon',
    plane,
    thickness: 0.4,
    verticesUV: [
      [0, 0],
      [2, 0],
      [2, 3],
      [0, 3],
    ],
  });
  expect(geometryVertices(geometry)).toHaveLength(4);
  const bounds = polygonBounds(geometry);
  for (const vertex of geometryVertices(geometry))
    vertex.forEach((n, i) => {
      expect(n).toBeGreaterThanOrEqual(bounds.min[i]);
      expect(n).toBeLessThanOrEqual(bounds.max[i]);
    });
  expect(bounds.min[0]).toBeCloseTo(1);
  expect(bounds.max[0]).toBeCloseTo(3);
});
it('rejects degenerate planes, invalid bases and invalid oriented contours', async () => {
  const { planeFromPoints } = await import('../shared/sections');
  for (const points of [
    [
      [0, 0, 0],
      [0, 0, 0],
      [1, 1, 1],
    ],
    [
      [0, 0, 0],
      [1, 1, 1],
      [2, 2, 2],
    ],
  ])
    expect(() =>
      planeFromPoints(points as [number, number, number][]),
    ).toThrow();
  const plane = planeFromPoints([
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 1],
  ]);
  for (const changed of [
    { ...plane, u: [2, 0, 0] },
    { ...plane, v: plane.u },
    { ...plane, normal: plane.normal.map((n) => -n) },
    { ...plane, origin: [NaN, 0, 0] },
  ])
    expect(() =>
      polygonGeometry({
        type: 'oriented-polygon',
        plane: changed,
        thickness: 1,
        verticesUV: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
      }),
    ).toThrow();
  for (const verticesUV of [
    [
      [0, 0],
      [1, 1],
      [0, 1],
      [1, 0],
    ],
    [
      [0, 0],
      [0, 0],
      [1, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [Infinity, 0],
      [1, 0],
      [0, 1],
    ],
  ])
    expect(() =>
      polygonGeometry({
        type: 'oriented-polygon',
        plane,
        thickness: 1,
        verticesUV,
      }),
    ).toThrow();
});
