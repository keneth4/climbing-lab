import { expect, it } from 'vitest';
import {
  differences,
  geometryKey,
  problemStep,
  stepStates,
} from './editor-flow';
import type { Route } from './domain';
const route = {
  name: 'Ruta',
  grade: 'V1',
  gradeScale: 'V',
  sector: 'Muro',
  sectionId: 's',
  captureId: 'c',
  camera: { captureId: 'c', target: [0, 0, 0], yaw: 0, pitch: 0, distance: 4 },
  holds3D: [
    { id: 'i', role: 'inicio', position: [0, 0, 0] },
    { id: 'f', role: 'final', position: [1, 0, 0] },
  ],
  imageId: 'image',
  markersVerified: true,
  status: 'activa',
} as Partial<Route>;
it('maps publication blockers to their actionable step, without replacing server validation', () => {
  expect(stepStates({}, {})).toEqual(Array(6).fill('Pendiente'));
  expect(problemStep('Inicio y final')).toBe(3);
  expect(stepStates(route, route)).toEqual(Array(6).fill('Listo'));
  expect(stepStates({ ...route, name: 'Otra' }, route)[0]).toBe('Modificado');
  expect(
    stepStates(
      { ...route, camera: { ...route.camera!, captureId: 'other' } },
      route,
    )[1],
  ).toBe('Pendiente');
});
it('differences preserve identical geometry and distinguish presentation from metadata', () => {
  const copy = structuredClone(route);
  expect(differences(copy, route)).toEqual([]);
  expect(geometryKey(copy)).toBe(geometryKey(route));
  expect(differences({ ...copy, name: 'Otra' }, route)).toEqual(['Nombre']);
  expect(geometryKey({ ...copy, name: 'Otra' })).toBe(geometryKey(route));
  expect(geometryKey({ ...copy, sectionId: 'other' })).not.toBe(
    geometryKey(route),
  );
  expect(
    differences({ ...copy, markersVerified: false, imageId: '' }, route),
  ).toEqual(['Verificación', 'Respaldo']);
});

it('clips only the mobile inspector overlap without changing scene projection dimensions', async () => {
  const { visibleSceneHeight } = await import('./editor-flow');
  const viewport = { x: 0, y: 200, width: 390, height: 300 };
  expect(
    visibleSceneHeight(viewport, { x: 0, y: 440, width: 390, height: 500 }),
  ).toBe(240);
  expect(
    visibleSceneHeight(viewport, { x: 390, y: 200, width: 440, height: 500 }),
  ).toBe(300);
  expect(
    visibleSceneHeight(viewport, { x: 0, y: 150, width: 390, height: 500 }),
  ).toBe(0);
  expect(visibleSceneHeight(viewport)).toBe(300);
});
