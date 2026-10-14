import type { Entry, Route } from './domain';
export type EditorDraft = Partial<
  Pick<
    Route,
    | 'name'
    | 'grade'
    | 'gradeScale'
    | 'sector'
    | 'beta'
    | 'status'
    | 'rules'
    | 'sectionId'
    | 'holds3D'
    | 'camera'
    | 'imageId'
    | 'markersVerified'
  >
> & { changeReason?: string };
export const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function gradeScale(grade: string): string {
  return /^V\d+$/i.test(grade)
    ? 'V'
    : /^\d+[abc][+]?$/i.test(grade)
      ? 'Font'
      : 'Otra';
}
export function gradeRank(grade: string, scale: string): number | undefined {
  if (scale === 'V' && /^V\d+$/i.test(grade)) return Number(grade.slice(1));
  const font = grade.match(/^(\d+)([abc])(\+?)$/i);
  if (scale === 'Font' && font)
    return (
      Number(font[1]) * 6 +
      'abc'.indexOf(font[2].toLowerCase()) * 2 +
      Number(!!font[3])
    );
}
export function publicationProblems(route: Partial<Route>): string[] {
  const problems: string[] = [];
  if (!route.name?.trim()) problems.push('Nombre');
  if (!route.grade?.trim() || !route.gradeScale)
    problems.push('Escala y grado');
  if (!route.sector?.trim() || !route.sectionId) problems.push('Sector');
  if (!route.captureId) problems.push('Captura publicada');
  if (!route.camera || route.camera.captureId !== route.captureId)
    problems.push('Cámara de la captura');
  if (
    !route.holds3D?.some((h) => h.role === 'inicio') ||
    !route.holds3D?.some((h) => h.role === 'final')
  )
    problems.push('Inicio y final');
  if (!route.imageId) problems.push('Imagen de respaldo');
  if (!route.markersVerified)
    problems.push('Agarres revisados desde dos ángulos');
  return problems;
}
export type ActivityDraft = {
  attempts: number;
  result: Entry['result'];
  notes: string;
  report: string;
  category: string;
  activityKey: string;
  reportKey: string;
  approvedRevision: number;
};
export function newDraft(revision: number): ActivityDraft {
  return {
    attempts: 1,
    result: 'intento',
    notes: '',
    report: '',
    category: 'contenido',
    activityKey: crypto.randomUUID(),
    reportKey: crypto.randomUUID(),
    approvedRevision: revision,
  };
}
export type ShareFields = {
  name: boolean;
  date: boolean;
  attempts: boolean;
  notes: boolean;
};
export const privateFields = (): ShareFields => ({
  name: false,
  date: false,
  attempts: false,
  notes: false,
});
export function sharedPersonal(
  entry: Entry,
  fields: ShareFields,
  name: string,
) {
  return {
    ...(fields.name ? { name } : {}),
    ...(fields.date
      ? { date: new Date(entry.date).toLocaleDateString('es-MX') }
      : {}),
    ...(fields.attempts ? { attempts: entry.attempts } : {}),
    ...(fields.notes ? { notes: entry.notes } : {}),
  };
}
export function measure(
  event:
    | 'qr_open'
    | 'detail_ready'
    | 'scene_ready'
    | 'activity_start'
    | 'activity_saved'
    | 'export_done'
    | 'scene_error'
    | 'activity_error'
    | 'export_error',
  durationMs?: number,
) {
  // Fixed vocabulary only: no route, account, notes or device identifiers.
  void fetch('/api/ux-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      ...(durationMs === undefined
        ? {}
        : {
            durationMs: Math.min(3600000, Math.max(0, Math.round(durationMs))),
          }),
    }),
  }).catch(() => {});
}
