import { point, type Point } from './alignment';
export type SectionGeometry = {
  type: 'polygon';
  plane: 'XY' | 'XZ' | 'YZ';
  elevation: number;
  thickness: number;
  vertices: Point[];
};
export const planeAxes = (plane: SectionGeometry['plane']) =>
  plane === 'XY' ? [0, 1, 2] : plane === 'XZ' ? [0, 2, 1] : [1, 2, 0];
export function projectVertex(
  p: Point,
  plane: SectionGeometry['plane'],
  elevation: number,
  snap = 0,
): Point {
  const [a, b, n] = planeAxes(plane),
    result = [...p] as Point;
  result[n] = elevation;
  if (snap > 0) {
    result[a] = Math.round(result[a] / snap) * snap;
    result[b] = Math.round(result[b] / snap) * snap;
  }
  return result;
}
export function polygonGeometry(value: unknown): SectionGeometry {
  const v = value as SectionGeometry;
  if (
    !v ||
    v.type !== 'polygon' ||
    !['XY', 'XZ', 'YZ'].includes(v.plane) ||
    !Number.isFinite(v.elevation) ||
    Math.abs(v.elevation) > 1e6 ||
    !Number.isFinite(v.thickness) ||
    v.thickness < 0.01 ||
    v.thickness > 1e4 ||
    !Array.isArray(v.vertices) ||
    v.vertices.length < 3 ||
    v.vertices.length > 32
  )
    throw new Error(
      'Polígono inválido: usa entre 3 y 32 vértices y un espesor positivo.',
    );
  const vertices = v.vertices.map(point),
    [a, b, n] = planeAxes(v.plane);
  if (vertices.some((p) => Math.abs(p[n] - v.elevation) > 1e-5))
    throw new Error('Los vértices deben estar en el plano elegido.');
  const orient = (p: Point, q: Point, r: Point) =>
    (q[a] - p[a]) * (r[b] - p[b]) - (q[b] - p[b]) * (r[a] - p[a]);
  const on = (p: Point, q: Point, r: Point) =>
    Math.abs(orient(p, q, r)) < 1e-8 &&
    r[a] >= Math.min(p[a], q[a]) - 1e-8 &&
    r[a] <= Math.max(p[a], q[a]) + 1e-8 &&
    r[b] >= Math.min(p[b], q[b]) - 1e-8 &&
    r[b] <= Math.max(p[b], q[b]) + 1e-8;
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const p = vertices[i],
      q = vertices[(i + 1) % vertices.length];
    if (Math.hypot(p[a] - q[a], p[b] - q[b]) < 1e-5)
      throw new Error('Hay vértices repetidos o demasiado cercanos.');
    area += p[a] * q[b] - q[a] * p[b];
    for (let j = i + 1; j < vertices.length; j++) {
      if (j === i + 1 || (i === 0 && j === vertices.length - 1)) continue;
      const r = vertices[j],
        s = vertices[(j + 1) % vertices.length];
      if (
        (orient(p, q, r) * orient(p, q, s) < 0 &&
          orient(r, s, p) * orient(r, s, q) < 0) ||
        on(p, q, r) ||
        on(p, q, s) ||
        on(r, s, p) ||
        on(r, s, q)
      )
        throw new Error(
          'El contorno se cruza. Ordena los vértices alrededor de la sección.',
        );
    }
  }
  if (Math.abs(area) < 1e-6)
    throw new Error('El polígono debe delimitar un área.');
  return {
    type: 'polygon',
    plane: v.plane,
    elevation: v.elevation,
    thickness: v.thickness,
    vertices,
  };
}
export function polygonBounds(g: SectionGeometry): { min: Point; max: Point } {
  const [, , n] = planeAxes(g.plane);
  const min = [0, 1, 2].map((a) =>
    Math.min(...g.vertices.map((p) => p[a])),
  ) as Point;
  const max = [0, 1, 2].map((a) =>
    Math.max(...g.vertices.map((p) => p[a])),
  ) as Point;
  min[n] = g.elevation - g.thickness / 2;
  max[n] = g.elevation + g.thickness / 2;
  return { min, max };
}
