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
export { journalCsv } from '../shared/journal-csv';

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

export function journalEntry(e: any): Entry {
  return {
    id: e.id,
    entryVersion: e.entry_version || 1,
    deletedAt: e.deleted_at || null,
    routeId: e.route_id,
    revision: e.revision,
    routeName: e.route_name || e.route_id,
    grade: e.grade || '',
    date: e.created_at,
    attempts: e.attempts,
    result: e.result,
    notes: e.notes,
    holds: e.route_snapshot ? JSON.parse(e.route_snapshot).holds || [] : [],
  };
}
