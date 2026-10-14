import { expect, it } from 'vitest';
import {
  normalize,
  gradeRank,
  newDraft,
  privateFields,
  sharedPersonal,
  publicationProblems,
} from './pilot';
import type { Entry } from './domain';
it('keeps grade systems separate and finds accented names', () => {
  expect(normalize('Travesía')).toBe('travesia');
  expect(gradeRank('V10', 'V')).toBeGreaterThan(gradeRank('V3', 'V')!);
  expect(gradeRank('7a+', 'Font')).toBeGreaterThan(gradeRank('7a', 'Font')!);
  expect(gradeRank('V3', 'Font')).toBeUndefined();
});
it('new drafts and retries belong to a specific revision', () => {
  const a = newDraft(1),
    b = newDraft(2);
  a.notes = 'Only A';
  expect(b.notes).toBe('');
  expect(b.approvedRevision).toBe(2);
  expect(a.activityKey).not.toBe(b.activityKey);
});
it('shares exactly the selected fields, including zero disclosure by default', () => {
  const entry = {
    date: '2026-10-12T12:00:00.000Z',
    attempts: 3,
    notes: 'Private',
  } as Entry;
  expect(sharedPersonal(entry, privateFields(), 'Name')).toEqual({});
  expect(
    sharedPersonal(entry, { ...privateFields(), notes: true }, 'Name'),
  ).toEqual({ notes: 'Private' });
  expect(
    sharedPersonal(
      entry,
      { ...privateFields(), name: true, attempts: true },
      'Name',
    ),
  ).toEqual({ name: 'Name', attempts: 3 });
});
it('publication requires both endpoints, a matching camera, image and review', () => {
  const r = {
    name: 'Route',
    grade: 'V2',
    gradeScale: 'V',
    sector: 'Wall',
    sectionId: 'wall',
    captureId: 'cap',
    imageId: 'image',
    markersVerified: true,
    camera: {
      captureId: 'cap',
      yaw: 0,
      pitch: 0,
      distance: 2,
      target: [0, 0, 0] as [number, number, number],
    },
    holds3D: [
      {
        id: 'a',
        position: [0, 0, 0] as [number, number, number],
        role: 'inicio' as const,
      },
      {
        id: 'b',
        position: [1, 1, 0] as [number, number, number],
        role: 'final' as const,
      },
    ],
  };
  expect(publicationProblems(r)).toEqual([]);
  expect(publicationProblems({ ...r, imageId: undefined })).toContain(
    'Imagen de respaldo',
  );
  expect(
    publicationProblems({ ...r, camera: { ...r.camera, captureId: 'other' } }),
  ).toContain('Cámara de la captura');
});
