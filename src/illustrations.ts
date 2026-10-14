import manifest from '../shared/demo-manifest.json';
import type { Route } from './domain';
export const illustrationLabel =
  'Ilustración de ejemplo; no fotografía del muro';
export function illustrationUrl(
  route: Pick<Route, 'illustrationId'>,
): string | undefined {
  const id = route.illustrationId;
  return id && manifest.routes.some((r) => r.illustrationId === id)
    ? `/api/demo-assets/${id}`
    : undefined;
}
