export type XY = { x: number; y: number };
export type Rect = XY & { width: number; height: number };
export type LabelVisibility = 'all' | 'ends' | 'hidden';
export type ProjectedMarker = XY & {
  id: string;
  label: string;
  role: 'inicio' | 'intermedio' | 'final' | 'candidate';
  active?: boolean;
  tour?: boolean;
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
/** Public roles never imply a climbing sequence; tour stops remain numbered. */
export function markerLabel(
  role: ProjectedMarker['role'],
  index = 0,
  tour = false,
) {
  if (tour) return String(index + 1);
  return role === 'inicio'
    ? 'I'
    : role === 'final'
      ? 'F'
      : role === 'candidate'
        ? '?'
        : '•';
}
export function markerName(m: ProjectedMarker) {
  return m.tour
    ? `Parada ${m.label}`
    : m.role === 'inicio'
      ? 'Inicio (I)'
      : m.role === 'final'
        ? 'Final (F)'
        : m.role === 'candidate'
          ? 'Punto en preparación'
          : 'Agarre intermedio';
}
/** Identical paths used in SVG and PNG, in CSS pixels about the label center. */
export function markerPath(m: ProjectedMarker) {
  if (m.tour || m.role === 'candidate' || m.role === 'inicio')
    return 'M-7,-11 H7 Q13,-11 13,-5 V5 Q13,11 7,11 H-7 Q-13,11 -13,5 V-5 Q-13,-11 -7,-11 Z';
  return m.role === 'final'
    ? 'M0,-16 L16,0 L0,16 L-16,0 Z'
    : 'M5,0 A5,5 0 1,1 -5,0 A5,5 0 1,1 5,0 Z';
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
      c.translate(p.x, p.y);
      const shape = new Path2D(markerPath(m));
      c.fill(shape);
      c.lineWidth = 2;
      c.strokeStyle = m.active ? '#ffdf55' : '#fff';
      c.stroke(shape);
      if (m.tour || m.role !== 'intermedio') {
        c.fillStyle = '#fff';
        c.font = 'bold 13px system-ui';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(m.label, 0, 0);
      }
      c.translate(-p.x, -p.y);
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
