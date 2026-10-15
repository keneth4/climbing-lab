import { point, type Point, type Transform } from './alignment';
export type TourCamera = {
  captureId: string;
  yaw: number;
  pitch: number;
  distance: number;
  target: Point;
  fov: number;
};
export type TourStop = {
  id: string;
  title: string;
  description: string;
  camera?: TourCamera;
  imageId?: string;
  verified: boolean;
  section?: { id: string; revision: number };
  linkedRouteId?: string;
  hotspot?: Point;
};
export type TourContent = {
  title: string;
  description: string;
  captureId: string;
  captureVersion: number;
  captureTransform: Transform;
  startStopId?: string;
  stops: TourStop[];
};
export type TourView = {
  id: string;
  revision: number;
  status: 'published' | 'retired';
  content: TourContent;
  sceneAvailable: boolean;
  capture?: {
    id: string;
    filename: string;
    size: number;
    status: 'draft' | 'published';
    upload_state: string;
    version: number;
    transform: Transform;
    alignment: {
      rms: number;
      references: { id: string; observed: Point }[];
    } | null;
    initialCamera?: Omit<TourCamera, 'fov'> | null;
    fileUrl: string;
  };
};
const object = (v: unknown, keys: string[]) => {
  if (
    !v ||
    typeof v !== 'object' ||
    Array.isArray(v) ||
    Object.keys(v).some((k) => !keys.includes(k))
  )
    throw new Error('Campos de recorrido inválidos.');
  return v as Record<string, unknown>;
};
const string = (v: unknown, max: number, empty = false) => {
  if (typeof v !== 'string' || v.length > max || (!empty && !v.trim()))
    throw new Error('Texto de recorrido inválido.');
  return v.trim();
};
export const tourId = (v: unknown) => {
  const id = string(v, 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Identificador inválido.');
  return id;
};
const integer = (v: unknown) => {
  if (!Number.isInteger(v) || Number(v) < 1)
    throw new Error('Versión inválida.');
  return Number(v);
};
export function tourCamera(value: unknown): TourCamera {
  const v = object(value, [
    'captureId',
    'yaw',
    'pitch',
    'distance',
    'target',
    'fov',
  ]);
  if (
    !['yaw', 'pitch', 'distance', 'fov'].every(
      (k) => typeof v[k] === 'number' && Number.isFinite(v[k]),
    ) ||
    Math.abs(Number(v.yaw)) > 1e6 ||
    Math.abs(Number(v.pitch)) > Math.PI / 2 ||
    Number(v.distance) <= 0 ||
    Number(v.distance) > 1e6 ||
    Number(v.fov) < 10 ||
    Number(v.fov) > 120
  )
    throw new Error('Cámara del recorrido inválida.');
  return {
    captureId: tourId(v.captureId),
    yaw: Number(v.yaw),
    pitch: Number(v.pitch),
    distance: Number(v.distance),
    target: point(v.target),
    fov: Number(v.fov),
  };
}
export function tourContent(value: unknown): TourContent {
  const v = object(value, [
    'title',
    'description',
    'captureId',
    'captureVersion',
    'captureTransform',
    'startStopId',
    'stops',
  ]);
  const t = object(v.captureTransform, ['scale', 'rotation', 'translation']);
  if (
    typeof t.scale !== 'number' ||
    !Number.isFinite(t.scale) ||
    t.scale <= 0 ||
    t.scale > 1e6 ||
    !Array.isArray(t.rotation) ||
    t.rotation.length !== 4 ||
    !t.rotation.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
    Math.abs(Math.hypot(...t.rotation) - 1) > 1e-5
  )
    throw new Error('Transformación inválida.');
  const captureTransform: Transform = {
    scale: t.scale,
    rotation: t.rotation as Transform['rotation'],
    translation: point(t.translation),
  };
  if (!Array.isArray(v.stops) || v.stops.length > 20)
    throw new Error('Usa hasta 20 paradas.');
  const captureId = tourId(v.captureId);
  const stops: TourStop[] = v.stops.map((value) => {
    const s = object(value, [
      'id',
      'title',
      'description',
      'camera',
      'imageId',
      'verified',
      'section',
      'linkedRouteId',
      'hotspot',
    ]);
    if (typeof s.verified !== 'boolean')
      throw new Error('Verificación inválida.');
    const camera = s.camera === undefined ? undefined : tourCamera(s.camera);
    if (camera && camera.captureId !== captureId)
      throw new Error('La cámara pertenece a otra captura.');
    const section =
      s.section === undefined
        ? undefined
        : object(s.section, ['id', 'revision']);
    return {
      id: tourId(s.id),
      title: string(s.title, 80, true),
      description: string(s.description, 1000, true),
      verified: s.verified,
      ...(camera ? { camera } : {}),
      ...(s.imageId ? { imageId: tourId(s.imageId) } : {}),
      ...(section
        ? {
            section: {
              id: tourId(section.id),
              revision: integer(section.revision),
            },
          }
        : {}),
      ...(s.linkedRouteId ? { linkedRouteId: tourId(s.linkedRouteId) } : {}),
      ...(s.hotspot ? { hotspot: point(s.hotspot) } : {}),
    };
  });
  if (new Set(stops.map((s) => s.id)).size !== stops.length)
    throw new Error('Hay paradas repetidas.');
  const startStopId = v.startStopId ? tourId(v.startStopId) : undefined;
  if (startStopId && !stops.some((s) => s.id === startStopId))
    throw new Error('La parada inicial no existe.');
  return {
    title: string(v.title, 80, true),
    description: string(v.description, 1000, true),
    captureId,
    captureVersion: integer(v.captureVersion),
    captureTransform,
    ...(startStopId ? { startStopId } : {}),
    stops,
  };
}
export const captureStamp = (
  c: Pick<TourContent, 'captureId' | 'captureVersion' | 'captureTransform'>,
) =>
  JSON.stringify([
    c.captureId,
    c.captureVersion,
    c.captureTransform.scale,
    c.captureTransform.rotation,
    c.captureTransform.translation,
  ]);
export const tourPresentation = (
  content: Pick<
    TourContent,
    'captureId' | 'captureVersion' | 'captureTransform'
  >,
  camera: TourCamera,
) => JSON.stringify([captureStamp(content), tourCamera(camera)]);
export function tourProblems(c: TourContent): string[] {
  const p: string[] = [];
  if (!c.title) p.push('Título del recorrido');
  if (c.stops.length < 3) p.push('Al menos tres paradas');
  if (!c.startStopId) p.push('Parada inicial');
  for (const [i, s] of c.stops.entries()) {
    if (!s.title) p.push(`Parada ${i + 1}: título`);
    if (!s.camera) p.push(`Parada ${i + 1}: cámara`);
    if (!s.imageId) p.push(`Parada ${i + 1}: imagen`);
    if (!s.verified) p.push(`Parada ${i + 1}: revisión humana`);
  }
  return p;
}
// Explicit adapter: route camera contracts remain unchanged.
export const tourPose = (c: TourCamera) => ({
  captureId: c.captureId,
  yaw: c.yaw,
  pitch: c.pitch,
  distance: c.distance,
  target: [...c.target] as Point,
});
export const tourPosition = (c: TourCamera): Point => [
  c.target[0] + c.distance * Math.cos(c.pitch) * Math.sin(c.yaw),
  c.target[1] + c.distance * Math.sin(c.pitch),
  c.target[2] + c.distance * Math.cos(c.pitch) * Math.cos(c.yaw),
];
