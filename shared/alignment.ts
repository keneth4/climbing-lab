export type Point = [number, number, number];
export type Transform = {
  scale: number;
  rotation: [number, number, number, number];
  translation: Point;
};
export const defaultTransform: Transform = {
  scale: 1,
  rotation: [0, 0, 1, 0],
  translation: [0, 0, 0],
};
export function applyTransform(p: Point, t: Transform): Point {
  const [x, y, z, w] = t.rotation;
  const [a, b, c] = p;
  const tx = 2 * (y * c - z * b),
    ty = 2 * (z * a - x * c),
    tz = 2 * (x * b - y * a);
  return [
    t.scale * (a + w * tx + y * tz - z * ty) + t.translation[0],
    t.scale * (b + w * ty + z * tx - x * tz) + t.translation[1],
    t.scale * (c + w * tz + x * ty - y * tx) + t.translation[2],
  ];
}
export function point(value: unknown): Point {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some(
      (n) => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 1e6,
    )
  )
    throw new Error('Coordenadas inválidas.');
  return value as Point;
}
function spread(points: Point[]) {
  const o = points[0];
  return points.some((a) =>
    points.some((b) => {
      const u = a.map((n, i) => n - o[i]),
        v = b.map((n, i) => n - o[i]);
      const cross = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      return cross.reduce((s, n) => s + n * n, 0) > 1e-12;
    }),
  );
}
/** Least-squares proper similarity transform; Horn quaternion eigensystem via symmetric Jacobi. */
export function align(source: Point[], target: Point[]) {
  if (
    source.length < 3 ||
    source.length !== target.length ||
    source.length > 20 ||
    !spread(source) ||
    !spread(target)
  )
    throw new Error('Usa al menos tres referencias distintas no alineadas.');
  const mean = (p: Point[]) =>
    [0, 1, 2].map((i) => p.reduce((s, v) => s + v[i], 0) / p.length) as Point;
  const a = mean(source),
    b = mean(target);
  const s = source.map((p) => p.map((n, i) => n - a[i]) as Point),
    d = target.map((p) => p.map((n, i) => n - b[i]) as Point);
  const h = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) =>
      s.reduce((sum, p, k) => sum + p[i] * d[k][j], 0),
    ),
  );
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = h;
  const n = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ];
  const v: number[][] = Array.from({ length: 4 }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => (i === j ? 1 : 0)),
  );
  for (let iter = 0; iter < 80; iter++) {
    let p = 0,
      q = 1;
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++)
        if (Math.abs(n[i][j]) > Math.abs(n[p][q])) {
          p = i;
          q = j;
        }
    if (Math.abs(n[p][q]) < 1e-12) break;
    const angle = 0.5 * Math.atan2(2 * n[p][q], n[q][q] - n[p][p]),
      c = Math.cos(angle),
      sn = Math.sin(angle),
      pp = n[p][p],
      qq = n[q][q],
      pq = n[p][q];
    for (let k = 0; k < 4; k++)
      if (k !== p && k !== q) {
        const kp = n[k][p],
          kq = n[k][q];
        n[k][p] = n[p][k] = c * kp - sn * kq;
        n[k][q] = n[q][k] = sn * kp + c * kq;
      }
    n[p][p] = c * c * pp - 2 * c * sn * pq + sn * sn * qq;
    n[q][q] = sn * sn * pp + 2 * c * sn * pq + c * c * qq;
    n[p][q] = n[q][p] = 0;
    for (let k = 0; k < 4; k++) {
      const kp = v[k][p],
        kq = v[k][q];
      v[k][p] = c * kp - sn * kq;
      v[k][q] = sn * kp + c * kq;
    }
  }
  let best = 0;
  for (let i = 1; i < 4; i++) if (n[i][i] > n[best][best]) best = i;
  const rotation = [
    v[1][best],
    v[2][best],
    v[3][best],
    v[0][best],
  ] as Transform['rotation'];
  const unit: Transform = { rotation, scale: 1, translation: [0, 0, 0] };
  let numerator = 0,
    denominator = 0;
  for (let k = 0; k < s.length; k++) {
    const r = applyTransform(s[k], unit);
    for (let i = 0; i < 3; i++) {
      numerator += r[i] * d[k][i];
      denominator += s[k][i] * s[k][i];
    }
  }
  const scale = numerator / denominator;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1e6)
    throw new Error('No se pudo obtener una escala válida.');
  const ra = applyTransform(a, unit);
  const transform: Transform = {
    rotation,
    scale,
    translation: b.map((n, i) => n - scale * ra[i]) as Point,
  };
  const residuals = source.map((p, k) =>
    Math.hypot(...applyTransform(p, transform).map((n, i) => n - target[k][i])),
  );
  return {
    transform,
    rms: Math.sqrt(residuals.reduce((s, n) => s + n * n, 0) / source.length),
    residuals,
  };
}
