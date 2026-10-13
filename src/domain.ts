export type Hold = {
  id: string;
  x: number;
  y: number;
  role: 'inicio' | 'intermedio' | 'final';
};
export type CameraView = {
  captureId: string;
  yaw: number;
  pitch: number;
  distance: number;
  target: [number, number, number];
};
export type Route = {
  sectionId?: string;
  sectionRevision?: number;
  captureId?: string;
  id: string;
  revision: number;
  name: string;
  grade: string;
  sector: string;
  beta: string;
  status: 'activa' | 'retirada';
  holds: Hold[];
  camera?: CameraView;
};
export type Entry = {
  id: string;
  routeId: string;
  revision: number;
  routeName: string;
  grade: string;
  date: string;
  attempts: number;
  result: 'intento' | 'ascenso';
  notes: string;
  holds?: Hold[];
};
export type Report = {
  id: string;
  routeId: string;
  revision: number;
  description: string;
  status: 'pendiente' | 'resuelto';
};
export type State = { routes: Route[]; entries: Entry[]; reports: Report[] };
export const initialState = (): State => ({
  routes: [
    {
      id: 'travesia',
      revision: 1,
      name: 'La travesía',
      grade: 'V3',
      sector: 'Spray wall',
      beta: 'Inicio con ambas manos abajo. Busca el cruce hacia la derecha antes de subir al final.',
      status: 'activa',
      holds: [
        { id: 'a', x: 25, y: 78, role: 'inicio' },
        { id: 'b', x: 42, y: 62, role: 'intermedio' },
        { id: 'c', x: 61, y: 46, role: 'intermedio' },
        { id: 'd', x: 74, y: 22, role: 'final' },
      ],
    },
    {
      id: 'equilibrio',
      revision: 1,
      name: 'Equilibrio',
      grade: 'V2',
      sector: 'Spray wall',
      beta: 'Mantén los pies altos y desplaza el peso antes de alcanzar el final.',
      status: 'activa',
      holds: [
        { id: 'e', x: 45, y: 82, role: 'inicio' },
        { id: 'f', x: 37, y: 55, role: 'intermedio' },
        { id: 'g', x: 49, y: 26, role: 'final' },
      ],
    },
  ],
  entries: [],
  reports: [],
});
export function createEntry(
  route: Route,
  attempts: number,
  result: Entry['result'],
  notes: string,
): Entry {
  if (!Number.isInteger(attempts) || attempts < 1)
    throw new Error('Indica al menos un intento entero.');
  return {
    id: crypto.randomUUID(),
    routeId: route.id,
    revision: route.revision,
    routeName: route.name,
    grade: route.grade,
    date: new Date().toISOString(),
    attempts,
    result,
    notes: notes.trim(),
    holds: route.holds.map((h) => ({ ...h })),
  };
}
export function routeUrl(id: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('ruta', id);
  return url.href;
}
export function loadState(): State {
  try {
    const saved = JSON.parse(localStorage.getItem('climbing-lab:v1') || 'null');
    if (isState(saved)) return saved;
  } catch {
    /* Recover demo after invalid local data. */
  }
  return initialState();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}
function isHold(value: unknown): value is Hold {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y) &&
    ['inicio', 'intermedio', 'final'].includes(String(value.role))
  );
}
function isCamera(value: unknown): value is CameraView {
  return (
    isRecord(value) &&
    typeof value.captureId === 'string' &&
    ['yaw', 'pitch', 'distance'].every(
      (key) => typeof value[key] === 'number' && Number.isFinite(value[key]),
    ) &&
    Number(value.distance) > 0 &&
    Array.isArray(value.target) &&
    value.target.length === 3 &&
    value.target.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}
export function isState(value: unknown): value is State {
  if (
    !isRecord(value) ||
    !Array.isArray(value.routes) ||
    !value.routes.length ||
    !Array.isArray(value.entries) ||
    !Array.isArray(value.reports)
  )
    return false;
  return (
    value.routes.every(
      (r) =>
        isRecord(r) &&
        ['id', 'name', 'grade', 'sector', 'beta'].every(
          (k) => typeof r[k] === 'string',
        ) &&
        Number.isInteger(r.revision) &&
        ['activa', 'retirada'].includes(String(r.status)) &&
        Array.isArray(r.holds) &&
        r.holds.every(isHold) &&
        (r.camera === undefined || isCamera(r.camera)),
    ) &&
    value.entries.every(
      (e) =>
        isRecord(e) &&
        ['id', 'routeId', 'routeName', 'grade', 'date', 'notes'].every(
          (k) => typeof e[k] === 'string',
        ) &&
        !Number.isNaN(Date.parse(String(e.date))) &&
        Number.isInteger(e.revision) &&
        Number.isInteger(e.attempts) &&
        Number(e.attempts) > 0 &&
        ['intento', 'ascenso'].includes(String(e.result)) &&
        (e.holds === undefined ||
          (Array.isArray(e.holds) && e.holds.every(isHold))),
    ) &&
    value.reports.every(
      (r) =>
        isRecord(r) &&
        ['id', 'routeId', 'description'].every(
          (k) => typeof r[k] === 'string',
        ) &&
        Number.isInteger(r.revision) &&
        ['pendiente', 'resuelto'].includes(String(r.status)),
    )
  );
}
