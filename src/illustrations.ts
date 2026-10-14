import { isDemoIllustration } from '../shared/demo-illustrations';
import type { Route } from './domain';
export const illustrationLabel =
  'Ilustración de ejemplo; no fotografía del muro';
export function illustrationUrl(
  route: Pick<Route, 'illustrationId'>,
): string | undefined {
  const id = route.illustrationId;
  return isDemoIllustration(id) ? `/api/demo-assets/${id}` : undefined;
}
