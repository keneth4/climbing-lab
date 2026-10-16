import { expect, it } from 'vitest';
import { site, viewFromUrl } from './site';
import { normalizeSiteConfig } from './site-config';
import {
  readTourOrigin,
  putTourOrigin,
  tourReturnUrl,
  tourRevision,
} from './tour-origin';
import { recentJournalQuery } from './journal';
it('normalizes editorial v1 without inventing data and validates optional links/assets', () => {
  expect(
    normalizeSiteConfig({ ...site, version: 1, editorial: undefined })
      .editorial,
  ).toEqual({});
  expect(
    normalizeSiteConfig({
      ...site,
      editorial: {
        hours: 'Confirmado',
        contacts: [{ label: 'Correo', url: 'mailto:test@example.com' }],
      },
    }).editorial.hours,
  ).toBe('Confirmado');
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,hello',
    'http://example.com',
    'https://a:b@example.com',
  ])
    expect(() =>
      normalizeSiteConfig({
        ...site,
        editorial: { contacts: [{ label: 'Sitio', url }] },
      }),
    ).toThrow();
  expect(() =>
    normalizeSiteConfig({
      ...site,
      editorial: { hero: { src: 'https://example.com/muro.png', alt: 'Muro' } },
    }),
  ).toThrow();
});
it('roundtrips only IDs and a positive published tour revision without accepting return URLs', () => {
  const origin = { tour: 'tour-1', stop: 'stop-2', revision: 19 };
  const u = new URL('https://local.test/?zona=zone-1');
  putTourOrigin(u, origin);
  expect(readTourOrigin(u)).toEqual(origin);
  expect(tourReturnUrl(origin)).toBe(
    '/?vista=Recorrido&tour=tour-1&parada=stop-2&revision=19',
  );
  for (const rev of ['0', '-1', 'NaN', '1.5']) {
    u.searchParams.set('revisionOrigen', rev);
    expect(readTourOrigin(u)).toBeUndefined();
    expect(tourRevision(rev)).toBeUndefined();
  }
  u.searchParams.set('tourOrigen', 'https://evil.test');
  expect(readTourOrigin(u)).toBeUndefined();
  expect(viewFromUrl(new URL('https://local.test/?vista=Mi%20escalada'))).toBe(
    'Bitácora',
  );
  expect(viewFromUrl(new URL('https://local.test/?ruta=old'))).toBe('Catálogo');
});
it('defines seven days as 168 hours in UTC across daylight saving changes', () => {
  const now = new Date('2026-11-02T10:00:00.000Z');
  const q = recentJournalQuery(now);
  const p = new URLSearchParams(q.query.slice(1));
  expect(Date.parse(p.get('until')!) - Date.parse(p.get('from')!)).toBe(
    168 * 3600000,
  );
  expect(q.offset).toBe(0);
  expect(q.label).toContain('168 horas');
});
