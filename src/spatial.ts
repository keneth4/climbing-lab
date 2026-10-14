import type { Point } from '../shared/alignment';
/** Sampled 10–90 percentiles: a framing aid, never a crop of the original data. */
export function principalBounds(
  centers: Float32Array,
): { min: Point; max: Point } | undefined {
  const axes: number[][] = [[], [], []];
  const step = Math.max(1, Math.ceil(centers.length / 3 / 20000));
  for (let i = 0; i < centers.length; i += step * 3) {
    if ([centers[i], centers[i + 1], centers[i + 2]].every(Number.isFinite))
      for (let a = 0; a < 3; a++) axes[a].push(centers[i + a]);
  }
  if (!axes[0].length) return;
  axes.forEach((a) => a.sort((x, y) => x - y));
  const min = axes.map((a) => a[Math.floor((a.length - 1) * 0.1)]) as Point;
  const max = axes.map((a) => a[Math.ceil((a.length - 1) * 0.9)]) as Point;
  return { min, max };
}
/** Approximate Gaussian center within an angular cone, preferring proximity to the current focus depth. */
export function selectCenter(
  centers: Float32Array,
  origin: Point,
  direction: Point,
  focusDepth: number,
  cone: number,
  accepts?: (point: Point) => boolean,
): Point | undefined {
  let best = Infinity,
    selected: Point | undefined;
  for (let i = 0; i < centers.length; i += 3) {
    if (accepts && !accepts([centers[i], centers[i + 1], centers[i + 2]]))
      continue;
    const x = centers[i] - origin[0],
      y = centers[i + 1] - origin[1],
      z = centers[i + 2] - origin[2];
    const depth = x * direction[0] + y * direction[1] + z * direction[2];
    if (depth <= 0 || !Number.isFinite(depth)) continue;
    const angle2 =
      Math.max(0, x * x + y * y + z * z - depth * depth) / (depth * depth);
    if (angle2 > cone * cone) continue;
    const score =
      angle2 / (cone * cone) +
      0.15 * Math.abs(Math.log(depth / Math.max(focusDepth, 0.01)));
    if (score < best) {
      best = score;
      selected = [centers[i], centers[i + 1], centers[i + 2]];
    }
  }
  return selected;
}
