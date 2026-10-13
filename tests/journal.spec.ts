import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('private journal filters, paginates and exports historical records, then clears on logout', async ({
  page,
}) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'journal-test', exp })).toString('base64url')}.test`;
  await page.addInitScript(
    ({ token, exp }) =>
      localStorage.setItem(
        'sb-defblrjdwgnqyzzgozdf-auth-token',
        JSON.stringify({
          access_token: token,
          refresh_token: 'test',
          expires_at: exp,
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'journal-test',
            email: 'journal@example.com',
            aud: 'authenticated',
            app_metadata: { provider: 'email' },
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      ),
    { token, exp },
  );
  await page.route('https://defblrjdwgnqyzzgozdf.supabase.co/auth/v1/**', (r) =>
    r.fulfill({ json: {} }),
  );
  const entries = Array.from({ length: 55 }, (_, i) => ({
    id: 'entry-' + i,
    route_id: 'old-route',
    revision: 1,
    route_name: 'Ruta histórica',
    grade: 'V2',
    created_at: i % 2 ? '2026-10-10T12:00:00.000Z' : '2026-10-11T12:00:00.000Z',
    attempts: 1,
    result: i % 2 ? 'intento' : 'ascenso',
    notes: 'Nota privada ' + i,
    route_snapshot: JSON.stringify({ holds: [] }),
  }));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    let json: any = {};
    if (path === '/api/me') json = { userId: 'journal-test', staff: null };
    else if (path === '/api/routes') json = { routes: [] };
    else if (path === '/api/captures/current') json = { capture: null };
    else if (path === '/api/sections') json = { sections: [] };
    else if (path === '/api/entries') {
      expect(route.request().headers().authorization).toBe('Bearer ' + token);
      const from = url.searchParams.get('from'),
        until = url.searchParams.get('until'),
        result = url.searchParams.get('result');
      const rows = entries.filter(
        (e) =>
          (!from || e.created_at >= from) &&
          (!until || e.created_at < until) &&
          (!result || e.result === result),
      );
      const offset = Number(url.searchParams.get('offset') || 0),
        limit = Number(url.searchParams.get('limit') || 50);
      json = {
        entries: rows.slice(offset, offset + limit),
        summary: {
          records: rows.length,
          attempts: rows.length,
          ascents: rows.filter((e) => e.result === 'ascenso').length,
          routes: rows.length ? 1 : 0,
        },
        pagination: {
          total: rows.length,
          offset,
          limit,
          hasMore: offset + limit < rows.length,
        },
      };
    }
    await route.fulfill({ json });
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Cerrar sesión' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Bitácora', exact: true }).click();
  await expect(
    page.locator('.summary').getByText('55', { exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole('heading', { name: 'Ruta histórica · V2' }),
  ).toHaveCount(50);
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ruta histórica · V2' }),
  ).toHaveCount(5);
  await expect(
    page.getByRole('button', { name: 'Página siguiente' }),
  ).toBeDisabled();
  const csvDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Exportar esta página (CSV)' })
    .click();
  const file = await csvDownload;
  expect(file.suggestedFilename()).toBe('bitacora-pagina-2.csv');
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv).toContain('Nota privada 50');
  expect(csv).not.toContain('Nota privada 0');
  await page.getByLabel('Resultado de bitácora').selectOption('ascenso');
  await page.getByLabel('Desde', { exact: true }).fill('2026-10-11');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-10-11');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ruta histórica · V2' }),
  ).toHaveCount(28);
  await expect(page.getByText('Página 1', { exact: true })).toBeVisible();
  const cardDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Exportar tarjeta personal' })
    .first()
    .click();
  expect((await cardDownload).suggestedFilename()).toMatch(/\.png$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/journal-${test.info().project.name}.png`,
    fullPage: false,
  });
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(
    page.getByText('Inicia sesión para consultar tu bitácora personal.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Ruta histórica · V2' }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
