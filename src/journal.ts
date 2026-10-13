import type { Entry } from './domain';
export function localBoundary(value: string, next = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Fecha inválida.');
  const [y, m, d] = value.split('-').map(Number),
    date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  )
    throw new Error('Fecha inválida.');
  if (next) date.setDate(date.getDate() + 1);
  return date.toISOString();
}
export function journalCsv(entries: Entry[]): string {
  const cell = (v: unknown) => {
    let text = String(v ?? '');
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [
    [
      'Fecha UTC',
      'Ruta',
      'Grado',
      'Revisión de ruta',
      'Resultado',
      'Intentos',
      'Notas',
      'Estado registro',
      'Versión registro',
    ],
    ...entries.map((e) => [
      e.date,
      e.routeName,
      e.grade,
      e.revision,
      e.result,
      e.attempts,
      e.notes,
      e.deletedAt ? 'retirado' : 'vigente',
      e.entryVersion || 1,
    ]),
  ];
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

export function localActivityTime(date = new Date()): string {
  const part = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}
export function activityUtc(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('Fecha y hora inválidas.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || localActivityTime(date) !== value)
    throw new Error('Fecha y hora inválidas.');
  if (date.getTime() > Date.now())
    throw new Error('La actividad no puede estar en el futuro.');
  return date.toISOString();
}
