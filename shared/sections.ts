import { point, type Point } from './alignment';
export type AxisPolygon = {
  type: 'polygon';
  plane: 'XY' | 'XZ' | 'YZ';
  elevation: number;
  thickness: number;
  vertices: Point[];
};
export type OrientedPlane = {
  origin: Point;
  u: Point;
  v: Point;
  normal: Point;
};
export type OrientedPolygon = {
  type: 'oriented-polygon';
  plane: OrientedPlane;
  verticesUV: [number, number][];
  thickness: number;
};
export type SectionGeometry = AxisPolygon | OrientedPolygon;
const dot = (a: Point, b: Point) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const sub = (a: Point, b: Point) => a.map((n, i) => n - b[i]) as Point;
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Point): Point => {
  const size = Math.hypot(...a);
  if (size < 1e-5)
    throw new Error('Selecciona tres puntos distintos y no alineados.');
  return a.map((n) => n / size) as Point;
};
export function planeFromPoints(points: Point[]): OrientedPlane {
  if (points.length !== 3) throw new Error('Selecciona tres puntos del muro.');
  const [origin, second, third] = points.map(point);
  const u = unit(sub(second, origin)),
    direction = unit(sub(third, origin));
  const normal = unit(cross(u, direction)),
    v = cross(normal, u);
  return { origin, u, v, normal };
}
export function validatePlane(value: unknown): OrientedPlane {
  const p = value as OrientedPlane;
  if (!p) throw new Error('Plano inválido.');
  const origin = point(p.origin),
    u = point(p.u),
    v = point(p.v),
    normal = point(p.normal);
  if (
    [u, v, normal].some((a) => Math.abs(Math.hypot(...a) - 1) > 1e-5) ||
    Math.abs(dot(u, v)) > 1e-5 ||
    Math.abs(dot(u, normal)) > 1e-5 ||
    Math.abs(dot(v, normal)) > 1e-5 ||
    dot(cross(u, v), normal) < 1 - 1e-5
  )
    throw new Error('El plano debe tener una base ortonormal orientada.');
  return { origin, u, v, normal };
}
export function worldToUV(p: Point, plane: OrientedPlane): [number, number] {
  const relative = sub(p, plane.origin);
  return [dot(relative, plane.u), dot(relative, plane.v)];
}
export function uvToWorld(
  uv: [number, number],
  plane: OrientedPlane,
  offset = 0,
): Point {
  return plane.origin.map(
    (n, i) =>
      n + uv[0] * plane.u[i] + uv[1] * plane.v[i] + offset * plane.normal[i],
  ) as Point;
}
export function geometryPlane(g: SectionGeometry): OrientedPlane {
  if (g.type === 'oriented-polygon') return g.plane;
  const [a, b, n] = planeAxes(g.plane),
    origin: Point = [0, 0, 0],
    u: Point = [0, 0, 0],
    v: Point = [0, 0, 0];
  origin[n] = g.elevation;
  u[a] = 1;
  v[b] = 1;
  return { origin, u, v, normal: cross(u, v) };
}
export function geometryVertices(g: SectionGeometry): Point[] {
  return g.type === 'polygon'
    ? g.vertices
    : g.verticesUV.map((uv) => uvToWorld(uv, g.plane));
}
export const planeAxes = (plane: AxisPolygon['plane']) =>
  plane === 'XY' ? [0, 1, 2] : plane === 'XZ' ? [0, 2, 1] : [1, 2, 0];
export function projectVertex(
  p: Point,
  plane: AxisPolygon['plane'],
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
  if ((value as OrientedPolygon)?.type === 'oriented-polygon') {
    const v = value as OrientedPolygon,
      plane = validatePlane(v.plane);
    if (
      !Array.isArray(v.verticesUV) ||
      v.verticesUV.some(
        (uv) =>
          !Array.isArray(uv) ||
          uv.length !== 2 ||
          !uv.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e6),
      )
    )
      throw new Error('Vértices UV inválidos.');
    // Reuse the same contour validation and limits for both wire formats.
    const checked = polygonGeometry({
      type: 'polygon',
      plane: 'XY',
      elevation: 0,
      thickness: v.thickness,
      vertices: v.verticesUV.map((uv) => [uv[0], uv[1], 0]),
    }) as AxisPolygon;
    const result: OrientedPolygon = {
      type: 'oriented-polygon',
      plane,
      verticesUV: checked.vertices.map((p) => [p[0], p[1]]),
      thickness: checked.thickness,
    };
    geometryVertices(result).forEach(point);
    return result;
  }
  const v = value as AxisPolygon;
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
  const vertices = geometryVertices(g),
    normal = geometryPlane(g).normal;
  if (!vertices.length) throw new Error('El contorno no tiene vértices.');
  const corners = vertices.flatMap((p) =>
    [-1, 1].map(
      (sign) =>
        p.map((n, i) => n + ((sign * g.thickness) / 2) * normal[i]) as Point,
    ),
  );
  return {
    min: [0, 1, 2].map((a) => Math.min(...corners.map((p) => p[a]))) as Point,
    max: [0, 1, 2].map((a) => Math.max(...corners.map((p) => p[a]))) as Point,
  };
}
