export type TourOrigin = { tour: string; stop: string; revision: number };
const id = (s: string | null) => !!s && /^[a-zA-Z0-9_-]{1,100}$/.test(s);
export function readTourOrigin(url: URL): TourOrigin | undefined {
  const tour = url.searchParams.get('tourOrigen'),
    stop = url.searchParams.get('paradaOrigen'),
    revision = Number(url.searchParams.get('revisionOrigen'));
  return id(tour) && id(stop) && Number.isSafeInteger(revision) && revision > 0
    ? { tour: tour!, stop: stop!, revision }
    : undefined;
}
export function putTourOrigin(url: URL, origin?: TourOrigin) {
  for (const k of ['tourOrigen', 'paradaOrigen', 'revisionOrigen'])
    url.searchParams.delete(k);
  if (origin) {
    url.searchParams.set('tourOrigen', origin.tour);
    url.searchParams.set('paradaOrigen', origin.stop);
    url.searchParams.set('revisionOrigen', String(origin.revision));
  }
}
export function tourReturnUrl(o: TourOrigin) {
  const u = new URLSearchParams({
    vista: 'Recorrido',
    tour: o.tour,
    parada: o.stop,
    revision: String(o.revision),
  });
  return '/?' + u;
}
export function tourRevision(value: string | null): number | undefined {
  if (value === null) return;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}
