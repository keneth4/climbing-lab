import { it, expect } from 'vitest';
import {
  tourContent,
  tourCamera,
  tourPose,
  tourPosition,
  tourProblems,
  tourPresentation,
} from '../shared/tours';
const transform = {
  scale: 1,
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  translation: [0, 0, 0] as [number, number, number],
};
const camera = {
  captureId: 'capture',
  yaw: Math.PI / 2,
  pitch: 0,
  distance: 4,
  target: [1, 2, 3] as [number, number, number],
  fov: 60,
};
const draft = {
  title: 'Recorrido',
  description: 'Ejemplo',
  captureId: 'capture',
  captureVersion: 1,
  captureTransform: transform,
  stops: [],
};
it('keeps route pose and tour FOV separate with explicit camera conversion', () => {
  expect(tourCamera(camera)).toEqual(camera);
  expect(tourPose(camera)).not.toHaveProperty('fov');
  const p = tourPosition(camera);
  expect(p[0]).toBeCloseTo(5);
  expect(p[1]).toBeCloseTo(2);
  expect(p[2]).toBeCloseTo(3);
  expect(tourPresentation(draft, camera)).not.toBe(
    tourPresentation(draft, { ...camera, fov: 45 }),
  );
});
it('allows incomplete draft but identifies all publication requirements', () => {
  const c = tourContent(draft);
  expect(tourProblems(c)).toContain('Al menos tres paradas');
  const stops = [0, 1, 2].map((i) => ({
    id: 's' + i,
    title: 'Parada',
    description: '',
    camera,
    imageId: 'image' + i,
    verified: true,
  }));
  expect(
    tourProblems(tourContent({ ...draft, stops, startStopId: 's1' })),
  ).toEqual([]);
});
it('rejects arbitrary URLs, identity fields, duplicate stops and incompatible cameras', () => {
  for (const c of [
    { ...draft, gymId: 'other' },
    { ...draft, captureVersion: 0 },
    { ...draft, captureTransform: { ...transform, rotation: [2, 0, 0, 0] } },
    {
      ...draft,
      stops: [
        {
          id: 's',
          title: '',
          description: '',
          verified: false,
          imageId: 'https://external.test/a.png',
        },
      ],
    },
    {
      ...draft,
      stops: [
        {
          id: 's',
          title: '',
          description: '',
          verified: false,
          camera: { ...camera, captureId: 'other' },
        },
      ],
    },
  ])
    expect(() => tourContent(c)).toThrow();
  for (const changed of [
    { ...camera, fov: 0 },
    { ...camera, distance: 0 },
    { ...camera, target: [NaN, 0, 0] },
    { ...camera, position: [0, 0, 0] },
  ])
    expect(() => tourCamera(changed)).toThrow();
});
it('enforces stop count, title and description boundaries', () => {
  const stop = { id: 's', title: '', description: '', verified: false };
  expect(() => tourContent({ ...draft, stops: [stop, stop] })).toThrow();
  expect(() => tourContent({ ...draft, title: 'x'.repeat(81) })).toThrow();
  expect(() =>
    tourContent({ ...draft, description: 'x'.repeat(1001) }),
  ).toThrow();
  expect(() =>
    tourContent({
      ...draft,
      stops: Array.from({ length: 21 }, (_, i) => ({ ...stop, id: 's' + i })),
    }),
  ).toThrow();
});
