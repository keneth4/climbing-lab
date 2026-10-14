import type { Route } from './domain';
import { publicationProblems, type EditorDraft } from './pilot';

export const editorSteps = [
  'Datos',
  'Encuadre',
  'Agarres',
  'Verificación',
  'Imagen/respaldo',
  'Publicar',
] as const;
export type EditorStep = 1 | 2 | 3 | 4 | 5 | 6;
export type StepState = 'Pendiente' | 'Listo' | 'Modificado';
const fields: (keyof EditorDraft)[][] = [
  ['name', 'grade', 'gradeScale', 'sector', 'sectionId', 'rules', 'beta'],
  ['camera'],
  ['holds3D'],
  ['markersVerified'],
  ['imageId'],
  ['status', 'changeReason'],
];
export function differences(
  current: EditorDraft,
  saved: EditorDraft,
): string[] {
  const labels: Partial<Record<keyof EditorDraft, string>> = {
    name: 'Nombre',
    grade: 'Grado',
    gradeScale: 'Escala',
    sector: 'Sector',
    sectionId: 'Sección',
    rules: 'Reglas',
    beta: 'Beta',
    camera: 'Cámara',
    holds3D: 'Agarres',
    markersVerified: 'Verificación',
    imageId: 'Respaldo',
    status: 'Estado',
    changeReason: 'Motivo',
  };
  return Object.entries(labels)
    .filter(
      ([key]) =>
        JSON.stringify(current[key as keyof EditorDraft] ?? '') !==
        JSON.stringify(saved[key as keyof EditorDraft] ?? ''),
    )
    .map(([, label]) => label!);
}
export function problemStep(problem: string): EditorStep {
  if (['Nombre', 'Escala y grado', 'Sector'].includes(problem)) return 1;
  if (['Captura publicada', 'Cámara de la captura'].includes(problem)) return 2;
  if (problem === 'Inicio y final') return 3;
  if (problem === 'Agarres revisados desde dos ángulos') return 4;
  return 5;
}
export function stepStates(
  current: Partial<Route>,
  saved: EditorDraft,
): StepState[] {
  const pending = publicationProblems(current).map(problemStep);
  return fields.map((keys, index) => {
    if (
      pending.includes((index + 1) as EditorStep) ||
      (index === 5 && pending.length)
    )
      return 'Pendiente';
    return keys.some(
      (key) =>
        JSON.stringify(current[key as keyof Route] ?? '') !==
        JSON.stringify(saved[key] ?? ''),
    )
      ? 'Modificado'
      : 'Listo';
  });
}
export function geometryKey(value: Partial<Route>): string {
  return JSON.stringify([
    value.captureId,
    value.sectionId,
    value.camera,
    value.holds3D,
  ]);
}
