export type XY = { x: number; y: number };
export type Rect = XY & { width: number; height: number };
export type LabelVisibility = 'all' | 'ends' | 'hidden';
export type ProjectedMarker = XY & {
  id: string;
  label: string;
  role: 'inicio' | 'intermedio' | 'final' | 'candidate';
  active?: boolean;
};
export type MarkerLayout = ProjectedMarker & { labelPoint?: XY };
export const HIT_SIZE = 48;
export function overlaps(a: Rect, b: Rect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
export function viewportToLocal(point: XY, rect: Rect): XY {
  return { x: point.x - rect.x, y: point.y - rect.y };
}
export function cssToPng(
  point: XY,
  viewport: { width: number; height: number },
  pixels: { width: number; height: number },
): XY {
  return {
    x: (point.x * pixels.width) / viewport.width,
    y: (point.y * pixels.height) / viewport.height,
  };
}
/** Eight stable choices, reserving hit areas as well as the precise anchors. */
export function layoutMarkers(
  markers: ProjectedMarker[],
  width: number,
  height: number,
  visibility: LabelVisibility = 'all',
  blocked: Rect[] = [],
): MarkerLayout[] {
  if (!Number.isFinite(width + height) || width <= 0 || height <= 0) return [];
  const visible = markers.filter(
    (m) =>
      Number.isFinite(m.x + m.y) &&
      m.x >= 3 &&
      m.y >= 3 &&
      m.x <= width - 3 &&
      m.y <= height - 3,
  );
  const occupied = [
    ...blocked,
    ...visible.map((m) => ({ x: m.x - 8, y: m.y - 8, width: 16, height: 16 })),
  ];
  const placed = new Map<string, XY>();
  const ranked = [...visible].sort(
    (a, b) =>
      Number(!!b.active) - Number(!!a.active) ||
      Number(b.role === 'candidate') - Number(a.role === 'candidate') ||
      Number(b.role !== 'intermedio') - Number(a.role !== 'intermedio'),
  );
  const directions = [
    [1, -1],
    [1, 1],
    [-1, -1],
    [-1, 1],
    [1, 0],
    [-1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const m of ranked) {
    if (
      !m.active &&
      m.role !== 'candidate' &&
      (visibility === 'hidden' ||
        (visibility === 'ends' && m.role === 'intermedio'))
    )
      continue;
    if (width < HIT_SIZE + 12 || height < HIT_SIZE + 12) continue;
    for (const [dx, dy] of directions) {
      const center = {
        x: Math.max(30, Math.min(width - 30, m.x + dx * 36)),
        y: Math.max(30, Math.min(height - 30, m.y + dy * 36)),
      };
      const box = {
        x: center.x - 24,
        y: center.y - 24,
        width: HIT_SIZE,
        height: HIT_SIZE,
      };
      if (occupied.some((r) => overlaps(box, r))) continue;
      placed.set(m.id, center);
      occupied.push(box);
      break;
    }
  }
  // Preserve editorial order for keyboard navigation, regardless of placement priority.
  return visible.map((m) => ({ ...m, labelPoint: placed.get(m.id) }));
}
export function markerColor(role: ProjectedMarker['role']) {
  return role === 'inicio'
    ? '#12603b'
    : role === 'final'
      ? '#984115'
      : role === 'candidate'
        ? '#263343'
        : '#173e69';
}
/** Same CSS geometry as the DOM overlay. Caller scales the context once for PNG. */
export function drawMarkerLayout(
  c: CanvasRenderingContext2D,
  markers: MarkerLayout[],
) {
  c.save();
  for (const m of markers) {
    const p = m.labelPoint;
    c.lineWidth = 3;
    c.strokeStyle = '#fff';
    if (p) {
      c.beginPath();
      c.moveTo(m.x, m.y);
      c.lineTo(p.x, p.y);
      c.stroke();
      c.lineWidth = 1;
      c.strokeStyle = '#152534';
      c.stroke();
      c.fillStyle = markerColor(m.role);
      c.beginPath();
      c.roundRect(p.x - 13, p.y - 11, 26, 22, 6);
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = m.active ? '#ffdf55' : '#fff';
      c.stroke();
      c.fillStyle = '#fff';
      c.font = 'bold 13px system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(m.label, p.x, p.y);
    }
    c.beginPath();
    c.arc(m.x, m.y, 3, 0, Math.PI * 2);
    c.fillStyle = markerColor(m.role);
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = m.active ? '#ffdf55' : '#fff';
    c.stroke();
  }
  c.restore();
}
