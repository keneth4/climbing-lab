import type { Point } from '../shared/alignment';
import type { Hold3D } from './domain';
export type SpatialMode =
  'explore' | 'pick-hold' | 'review-candidate' | 'edit-hold' | 'review-route';
export type CandidateState = {
  positionWorld: Point;
  captureId: string;
  sectionId: string;
  role: Hold3D['role'];
  source: 'gaussian-center';
};
export type SpatialInteraction =
  | { mode: 'explore' | 'pick-hold' | 'review-route' }
  | { mode: 'review-candidate'; candidate: CandidateState }
  | { mode: 'edit-hold'; hold: Hold3D; captureId: string; sectionId: string };
export function copyHold(h: Hold3D): Hold3D {
  return { ...h, position: [...h.position] };
}
export function validPoint(p: Point) {
  return (
    p.length === 3 &&
    p.every(
      (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e6,
    )
  );
}
export function applyHoldEdit(holds: Hold3D[], draft: Hold3D): Hold3D[] {
  if (
    !validPoint(draft.position) ||
    !['inicio', 'intermedio', 'final'].includes(draft.role)
  )
    throw new Error('Revisa la posición y función del agarre.');
  const existing = holds.find((h) => h.id === draft.id);
  if (!existing) throw new Error('El agarre ya no pertenece a esta ruta.');
  if (
    existing.role === draft.role &&
    existing.position.every((n, i) => n === draft.position[i])
  )
    return holds;
  return holds.map((h) => (h.id === draft.id ? copyHold(draft) : h));
}
export function nudgePoint(point: Point, axis: number, amount: number): Point {
  const next = [...point] as Point;
  next[axis] = Math.round((next[axis] + amount) * 1e6) / 1e6;
  return next;
}
