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
    entry_version: 1,
    deleted_at: null as string | null,
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
  const snap = (e: any) => ({
    attempts: e.attempts,
    result: e.result,
    notes: e.notes,
    routeRevision: e.revision,
    createdAt: e.created_at,
  });
  const histories: Record<string, any[]> = {};
  for (const e of entries)
    histories[e.id] = [
      {
        version: 1,
        action: 'baseline',
        changedAt: e.created_at,
        snapshot: snap(e),
      },
    ];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    let json: any = {};
    if (path === '/api/me') json = { userId: 'journal-test', staff: null };
    else if (path === '/api/routes')
      json = {
        routes:
          url.searchParams.get('status') === 'retirada'
            ? []
            : [
                {
                  id: 'active-route',
                  name: 'Ruta actual',
                  grade: 'V3',
                  sector: 'Spray wall',
                  status: 'activa',
                },
              ],
      };
    else if (path === '/api/routes/active-route')
      json = {
        revision: 1,
        status: 'activa',
        snapshot: { name: 'Ruta actual', grade: 'V3', holds: [] },
      };
    else if (path === '/api/captures/current') json = { capture: null };
    else if (path === '/api/sections') json = { sections: [] };
    else if (/^\/api\/entries\/[^/]+/.test(path)) {
      const id = path.split('/')[3],
        e = entries.find((e) => e.id === id)!;
      expect(route.request().headers().authorization).toBe('Bearer ' + token);
      if (path.endsWith('/history')) json = { history: histories[id] };
      else {
        const value = route.request().postDataJSON();
        expect(value.expectedVersion).toBe(e.entry_version);
        const deleting = route.request().method() === 'DELETE';
        if (deleting) e.deleted_at = new Date().toISOString();
        else
          Object.assign(e, {
            attempts: value.attempts,
            result: value.result,
            notes: value.notes,
          });
        e.entry_version++;
        histories[id].unshift({
          version: e.entry_version,
          action: deleting ? 'deleted' : 'updated',
          changedAt: new Date().toISOString(),
          snapshot: snap(e),
        });
        json = { entry: snap(e) };
      }
    } else if (path === '/api/entries') {
      expect(route.request().headers().authorization).toBe('Bearer ' + token);
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON();
        expect(data.routeId).toBe('active-route');
        entries.unshift({
          id: 'new-entry',
          entry_version: 1,
          deleted_at: null,
          route_id: data.routeId,
          revision: 1,
          route_name: 'Ruta actual',
          grade: 'V3',
          created_at: new Date().toISOString(),
          attempts: data.attempts,
          result: data.result,
          notes: data.notes,
          route_snapshot: JSON.stringify({ holds: [] }),
        });
        histories['new-entry'] = [
          {
            version: 1,
            action: 'created',
            changedAt: new Date().toISOString(),
            snapshot: snap(entries[0]),
          },
        ];
        await route.fulfill({ json: { id: 'new-entry' }, status: 201 });
        return;
      }
      const from = url.searchParams.get('from'),
        until = url.searchParams.get('until'),
        result = url.searchParams.get('result');
      const state = url.searchParams.get('state') || 'active';
      const rows = entries.filter(
        (e) =>
          (state === 'deleted' ? !!e.deleted_at : !e.deleted_at) &&
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
          attempts: rows.reduce((n, e) => n + e.attempts, 0),
          ascents: rows.filter((e) => e.result === 'ascenso').length,
          routes: new Set(rows.map((e) => e.route_id)).size,
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
  await page
    .getByRole('button', { name: 'Añadir registro', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Cancelar registro', exact: true })
    .click();
  expect(entries).toHaveLength(55);
  await page
    .getByRole('button', { name: 'Añadir registro', exact: true })
    .click();
  await page.getByLabel('Ruta del registro').selectOption('active-route');
  await page.getByLabel('Intentos del registro').fill('2');
  await page.getByLabel('Resultado del registro').selectOption('ascenso');
  await page.getByLabel('Notas del registro').fill('Registro nuevo probado');
  await page
    .getByRole('form', { name: 'Nuevo registro de bitácora' })
    .screenshot({ path: `/tmp/journal-add-${test.info().project.name}.png` });
  await page
    .getByRole('button', { name: 'Guardar registro', exact: true })
    .click();
  await expect(
    page.getByText('Registro añadido a tu bitácora.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Registro nuevo probado', { exact: true }),
  ).toBeVisible();
  expect(entries).toHaveLength(56);
  await page
    .getByRole('button', { name: 'Corregir registro', exact: true })
    .first()
    .click();
  await page.getByLabel('Notas del registro').fill('Cancelled edit');
  await page.getByRole('button', { name: 'Cancelar corrección' }).click();
  expect(entries[0].notes).toBe('Registro nuevo probado');
  await page
    .getByRole('button', { name: 'Corregir registro', exact: true })
    .first()
    .click();
  await page.getByLabel('Intentos del registro').fill('3');
  await page.getByLabel('Resultado del registro').selectOption('intento');
  await page.getByLabel('Notas del registro').fill('Corrección probada');
  await page
    .getByRole('button', { name: 'Guardar corrección', exact: true })
    .click();
  await expect(
    page.getByText('Registro corregido; historial conservado.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(entries[0].entry_version).toBe(2);
  expect(entries[0].revision).toBe(1);
  await page
    .getByRole('button', { name: 'Ver historial del registro' })
    .first()
    .click();
  await expect(
    page.getByText('Versión 2 · Registro corregido', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/journal-history-${test.info().project.name}.png`,
    fullPage: false,
  });
  await page
    .getByRole('button', { name: 'Retirar registro', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Cancelar retiro' }).click();
  expect(entries[0].deleted_at).toBeNull();
  await page
    .getByRole('button', { name: 'Retirar registro', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Confirmar retiro' }).click();
  await expect(
    page.getByText('Registro retirado de tu actividad vigente.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('Estado de registros').selectOption('deleted');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(
    page.getByText('Registro retirado · versión 3', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Ver historial del registro' })
    .first()
    .click();
  await expect(
    page.getByText('Versión 3 · Registro retirado', { exact: true }),
  ).toBeVisible();

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
