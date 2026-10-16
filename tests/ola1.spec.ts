import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAZ0AAAAASUVORK5CYII=',
  'base64',
);
async function fixture(
  page: Page,
  privateAccount = false,
  count = 1,
  routeExtras: Record<string, unknown> = {},
) {
  const state = {
    blocked: false,
    fail: false,
    dailyFail: false,
    release: undefined as (() => void) | undefined,
    bytes: 0,
    writes: [] as any[],
    entryStatus: 201,
  };
  if (privateAccount) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'ola1', exp })).toString('base64url')}.fixture`;
    await page.addInitScript(
      ({ token, exp }) =>
        localStorage.setItem(
          'sb-defblrjdwgnqyzzgozdf-auth-token',
          JSON.stringify({
            access_token: token,
            refresh_token: 'fixture',
            expires_at: exp,
            expires_in: 3600,
            token_type: 'bearer',
            user: {
              id: 'ola1',
              email: 'ola1@example.com',
              aud: 'authenticated',
              app_metadata: { provider: 'email' },
              user_metadata: {},
              created_at: new Date().toISOString(),
            },
          }),
        ),
      { token, exp },
    );
    await page.route(
      'https://defblrjdwgnqyzzgozdf.supabase.co/auth/v1/**',
      (r) => r.fulfill({ json: {} }),
    );
  }
  const routes = Array.from({ length: count }, (_, i) => ({
    id: `route-${i}`,
    name: `Ruta clara ${i}`,
    grade: 'V2',
    gradeScale: 'V',
    sector: 'Sur',
    sectionId: 'zone-1',
    status: 'activa',
    revision: 4,
    holds: [],
    imageId: 'route-image',
    rules: 'Pies libres',
    beta: 'Consejo',
    updatedAt: new Date().toISOString(),
    ...routeExtras,
  }));
  const entries = Array.from({ length: 55 }, (_, i) => ({
    id: `entry-${i}`,
    user_id: 'ola1',
    route_id: 'route-0',
    revision: 4,
    route_name: `Actividad propia ${i}`,
    grade: 'V2',
    attempts: 1,
    result: 'intento',
    notes: 'Nota privada de fixture',
    created_at: new Date(Date.now() - i * 1000).toISOString(),
  }));
  await page.route('**/api/**', async (r) => {
    const u = new URL(r.request().url());
    const path = u.pathname;
    let json: any = {};
    if (path.includes('/route-images/') || path.includes('/tour-images/'))
      return r.fulfill({ body: image, contentType: 'image/png' });
    if (path === '/api/me') json = { userId: 'ola1', staff: null };
    else if (path === '/api/config')
      json = {
        name: 'Fixture',
        currency: 'MXN',
        timezone: 'America/Mexico_City',
      };
    else if (path === '/api/sections')
      json = {
        sections: [
          {
            id: 'zone-1',
            name: 'Muro Sur',
            bounds: { min: [0, 0, 0], max: [1, 1, 1] },
          },
        ],
      };
    else if (path === '/api/captures/current') json = { capture: null };
    else if (path === '/api/routes') {
      const offset = Number(u.searchParams.get('offset') || 0);
      const rows =
        u.searchParams.get('status') === 'activa'
          ? routes.slice(offset, offset + 100)
          : [];
      json = { routes: rows.map((route) => ({ ...route, snapshot: route })) };
      state.bytes += Buffer.byteLength(JSON.stringify(json));
    } else if (path.startsWith('/api/routes/'))
      json = { snapshot: routes[0], revision: 4, status: 'activa' };
    else if (path.startsWith('/api/tours')) {
      const historical = path.includes('/revisions/19');
      json = {
        tour: {
          id: 'tour-1',
          revision: historical ? 19 : 20,
          status: 'published',
          sceneAvailable: false,
          content: {
            title: 'Recorrido fixture',
            description: 'Consulta sin 3D',
            startStopId: 'stop-1',
            stops: [1, 2, 3].map((i) => ({
              id: `stop-${i}`,
              title: `Muro ${i}`,
              description: historical ? 'Texto histórico' : 'Texto vigente',
              imageId: `image-${i}`,
              section: { id: 'zone-1', revision: 1 },
              linkedRouteId: 'route-0',
            })),
          },
        },
      };
    } else if (path === '/api/reports')
      json = {
        reports: [
          {
            id: 'report-1',
            route_id: 'route-0',
            revision: 4,
            category: 'agarre_suelto',
            description: 'Reporte propio fixture',
            status: 'resuelto',
            resolution: 'Respuesta del staff fixture',
          },
        ],
      };
    else if (path === '/api/entries') {
      if (r.request().method() === 'POST') {
        state.writes.push(r.request().postDataJSON());
        return r.fulfill({
          status: state.entryStatus,
          json:
            state.entryStatus === 201
              ? { id: 'saved' }
              : { error: 'Espera y reintenta' },
        });
      }
      if (u.searchParams.has('group')) {
        if (state.dailyFail)
          return r.fulfill({ status: 503, json: { error: 'daily fail' } });
        json = { days: [], timezone: 'America/Mexico_City' };
      } else {
        if (state.blocked) {
          await new Promise<void>((resolve) => {
            state.release = resolve;
          });
          if (state.fail)
            return r.fulfill({
              status: 503,
              json: { error: 'Consulta fallida' },
            });
        }
        const offset = Number(u.searchParams.get('offset') || 0);
        json = {
          entries: entries.slice(offset, offset + 50),
          summary: { records: 55, attempts: 55, ascents: 0, routes: 1 },
          pagination: { hasMore: offset === 0 },
        };
      }
    } else if (path === '/api/projects') json = { projects: [] };
    return r.fulfill({ json });
  });
  return state;
}
test('tour origin preserves historical stop through zone, route, reload and explicit return', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/?vista=Recorrido&tour=tour-1&parada=stop-2&revision=19');
  await expect(
    page.getByText('Texto histórico', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ver rutas de esta zona' }).click();
  await expect(
    page.getByRole('button', { name: 'Quitar filtro de zona' }),
  ).toBeVisible();
  await expect(page.getByText('1 ruta de Muro Sur')).toBeVisible();
  await page.getByRole('button', { name: /Ruta clara 0/ }).click();
  await expect(page).toHaveURL(/revisionOrigen=19/);
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'Volver a Muro 2' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Volver a Muro 2' }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get('parada') === 'stop-2' &&
      url.searchParams.get('revision') === '19',
  );
  await expect(
    page.getByText('Texto histórico', { exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Ruta clara 0' }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByText('Texto histórico', { exact: true }),
  ).toBeVisible();
  await page.goto('/?vista=Recorrido&revision=-1');
  await expect(page.getByRole('alert')).toContainText('no es válida');
});
test('quick activity preserves details and retry identity after 429, with optional local date', async ({
  page,
}) => {
  const state = await fixture(page, true);
  state.entryStatus = 429;
  await page.goto('/?ruta=route-0');
  const form = page.getByRole('form', {
    name: 'Registrar actividad',
    exact: true,
  });
  await expect(form.getByLabel('Notas', { exact: true })).toBeHidden();
  await form.getByText('Añadir detalles', { exact: true }).click();
  await form.getByLabel('Notas', { exact: true }).fill('Conservar contenido');
  await form
    .getByLabel('Fecha y hora opcional (hora local del dispositivo)')
    .fill('2026-10-01T12:00');
  await form.getByText('Añadir detalles', { exact: true }).click();
  await expect(form.getByLabel('Notas', { exact: true })).toBeHidden();
  await form
    .getByRole('button', { name: 'Guardar actividad', exact: true })
    .click();
  await expect(form.getByRole('alert')).toHaveText('Espera y reintenta');
  state.entryStatus = 201;
  await form
    .getByRole('button', { name: 'Guardar actividad', exact: true })
    .click();
  await expect(
    form.getByText('Actividad guardada.', { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]).toEqual(state.writes[1]);
  expect(state.writes[0].occurredAt).toMatch(/Z$/);
  expect(state.writes[0].notes).toBe('Conservar contenido');
});
test('activity retains old page on failed pagination and report tracking is a separate private view', async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto('/?vista=Bitácora');
  await expect(
    page.getByRole('heading', { name: 'Actividad propia 0 · V2', exact: true }),
  ).toBeVisible();
  state.blocked = true;
  state.fail = true;
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(page.getByText('Actualizando actividad…')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Actividad propia 0 · V2', exact: true }),
  ).toBeVisible();
  await expect.poll(() => !!state.release).toBe(true);
  state.release!();
  await expect(page.getByRole('alert')).toHaveText('Consulta fallida');
  await expect(page.getByText('Página 1', { exact: true })).toBeVisible();
  state.blocked = false;
  state.fail = false;
  state.dailyFail = true;
  await page.getByRole('button', { name: 'Reintentar actividad' }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Actividad propia 50 · V2',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'La lista está disponible; no se pudo actualizar el resumen diario.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mis reportes', exact: true }).click();
  await expect(
    page.getByText('Respuesta del staff: Respuesta del staff fixture'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cuenta y privacidad' }).click();
  await expect(page.getByLabel('Identificador de cuenta (UUID)')).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.goto('/?vista=Bitácora');
  await expect(page.getByText('Nota privada de fixture')).toHaveCount(0);
});
for (const count of [100, 1000])
  test(`catalog measurement ${count} synthetic routes, no performance claim`, async ({
    page,
  }, info) => {
    const state = await fixture(page, false, count);
    await page.goto('/?vista=Catálogo');
    await expect(page.locator('.route-card')).toHaveCount(count);
    await page.getByLabel('Buscar', { exact: true }).fill('Ruta clara 9');
    await expect(page.locator('.route-card')).not.toHaveCount(count);
    const timings = await page.evaluate(() =>
      Object.fromEntries(
        ['download', 'filter', 'render'].map((phase) => [
          phase,
          performance
            .getEntriesByName(`catalog:${phase}`)
            .map((e) => e.duration),
        ]),
      ),
    );
    const report = {
      count,
      servedJsonBytes: state.bytes,
      viewport: info.project.name,
      timings,
    };
    await writeFile(
      `/tmp/climbing-ola1-catalog-${info.project.name}-${count}.json`,
      JSON.stringify(report, null, 2),
    );
    expect(Object.values(timings).every((values) => values.length > 0)).toBe(
      true,
    );
  });

test('late activity response cannot repopulate private data after logout', async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto('/?vista=Bitácora');
  await expect(
    page.getByRole('heading', { name: 'Actividad propia 0 · V2', exact: true }),
  ).toBeVisible();
  state.blocked = true;
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect.poll(() => !!state.release).toBe(true);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByText('Nota privada de fixture')).toHaveCount(0);
  const response = page.waitForResponse((r) => {
    const u = new URL(r.url());
    return (
      u.pathname === '/api/entries' && u.searchParams.get('offset') === '50'
    );
  });
  state.release!();
  await response;
  await expect(page.getByText('Nota privada de fixture')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: /Actividad propia/ }),
  ).toHaveCount(0);
});

test('public hierarchy omits empty beta, rules and internal IDs at all widths and themes', async ({
  page,
}, info) => {
  await fixture(page, false, 1, {
    beta: '  ',
    rules: ' ',
    markersVerified: true,
    holds3D: [
      { id: 'i-a', role: 'inicio', position: [0, 0, 0] },
      { id: 'i-b', role: 'inicio', position: [1, 0, 0] },
      { id: 'f-a', role: 'final', position: [1, 1, 0] },
      { id: 'f-b', role: 'final', position: [1, 2, 0] },
    ],
  });
  await page.goto('/?ruta=route-0');
  const detail = page.getByRole('region', {
    name: 'Ficha de ruta',
    exact: true,
  });
  await expect(
    detail.getByRole('heading', { name: 'Ruta clara 0', exact: true }),
  ).toBeVisible();
  await expect(detail.getByText('Ver beta', { exact: true })).toHaveCount(0);
  await expect(
    detail.getByRole('heading', { name: 'Reglas', exact: true }),
  ).toHaveCount(0);
  await expect(detail).not.toContainText('Identificador');
  await expect(detail).not.toContainText('Revisión 4');
  await expect(detail).not.toContainText('Agarre 1');
  await expect(
    detail.getByText('I Inicio · F Final · • Intermedio', { exact: true }),
  ).toBeVisible();
  await expect(detail.locator('dl').last().locator('dd')).toHaveText([
    'V2',
    'Sur',
    '2',
    '2',
  ]);
  await expect(page.getByLabel('Visor de Gaussian Splatting')).toHaveCount(0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['default', 'warm']) {
      await expect(detail.locator('.route-facts')).toContainText(/Grado\s*V2/);
      await expect(detail.locator('.route-facts')).toContainText(
        /Sector\s*Sur/,
      );
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: `/tmp/ola1-corrections-detail-${info.project.name}-${width}-${theme}.png`,
      });
      await page
        .getByRole('button', { name: 'Cambiar tema', exact: true })
        .click();
    }
  }
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  await page.screenshot({
    path: `/tmp/ola1-corrections-detail-${info.project.name}-zoom.png`,
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});

test('nonempty beta remains collapsed and withdrawn route keeps useful information', async ({
  page,
}) => {
  await fixture(page, false, 1, { status: 'retirada' });
  // Fixture list filtering is intentionally fixed; direct detail still returns the withdrawn snapshot.
  await page.goto('/?ruta=route-0');
  await expect(
    page.getByText('Ruta retirada. El enlace y su historial se conservan.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText('Consejo', { exact: true })).not.toBeVisible();
  await page.getByText('Ver beta', { exact: true }).click();
  await expect(page.getByText('Consejo', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Reglas', exact: true }),
  ).toBeVisible();
});
