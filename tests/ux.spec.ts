import { test, expect, type Page } from '@playwright/test';
const wall = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAZ0AAAAASUVORK5CYII=',
  'base64',
);
async function setup(
  page: Page,
  authenticated = true,
  intercept?: (path: string, method: string, data: any) => Promise<any>,
) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  if (authenticated)
    await page.addInitScript(
      ({ exp }) =>
        localStorage.setItem(
          'sb-defblrjdwgnqyzzgozdf-auth-token',
          JSON.stringify({
            access_token:
              'eyJhbGciOiJIUzI1NiJ9.' +
              btoa(JSON.stringify({ sub: 'ux-user', exp })) +
              '.test',
            refresh_token: 'test',
            expires_at: exp,
            expires_in: 3600,
            token_type: 'bearer',
            user: {
              id: 'ux-user',
              email: 'ux@example.com',
              aud: 'authenticated',
              app_metadata: { provider: 'email' },
              user_metadata: {},
              created_at: '2020-01-01T00:00:00Z',
            },
          }),
        ),
      { exp },
    );
  await page.route('https://defblrjdwgnqyzzgozdf.supabase.co/auth/v1/**', (r) =>
    r.fulfill({ json: {} }),
  );
  const routes = [
    {
      id: 'a',
      name: 'Travesía',
      grade: 'V2',
      sector: 'Sur',
      beta: 'Beta privada de A',
      status: 'activa',
      imageId: 'image-a',
      gradeScale: 'V',
    },
    {
      id: 'b',
      name: 'Equilibrio',
      grade: 'V10',
      sector: 'Norte',
      beta: 'Beta privada de B',
      status: 'activa',
      imageId: 'image-b',
      gradeScale: 'V',
    },
  ];
  await page.route('**/api/**', async (r) => {
    const url = new URL(r.request().url()),
      path = url.pathname,
      method = r.request().method();
    if (path.startsWith('/api/route-images/')) {
      await r.fulfill({ body: wall, contentType: 'image/png' });
      return;
    }
    const data = r.request().postData()
      ? r.request().postDataJSON()
      : undefined;
    const custom = await intercept?.(path, method, data);
    if (custom) {
      await r.fulfill(custom);
      return;
    }
    const route = routes.find((x) => path === `/api/routes/${x.id}`);
    await r.fulfill({
      json: route
        ? {
            snapshot: { ...route, holds: [], rules: 'Pies libres' },
            status: route.status,
            revision: 1,
          }
        : path === '/api/routes'
          ? {
              routes:
                url.searchParams.get('status') === 'retirada' ||
                url.searchParams.get('status') === 'borrador'
                  ? []
                  : routes,
            }
          : path === '/api/me'
            ? { userId: 'ux-user', staff: null }
            : path === '/api/entries'
              ? method === 'POST'
                ? { id: 'saved-entry' }
                : {
                    entries: [],
                    summary: { records: 0, attempts: 0, ascents: 0, routes: 0 },
                    pagination: { hasMore: false },
                  }
              : path === '/api/sections'
                ? { sections: [] }
                : path === '/api/captures/current'
                  ? { capture: null }
                  : path === '/api/config'
                    ? {
                        config: {
                          name: 'Gimnasio de prueba',
                          currency: 'MXN',
                          timezone: 'America/Mexico_City',
                        },
                      }
                    : path === '/api/reports'
                      ? { reports: [] }
                      : path === '/api/projects'
                        ? { projects: [] }
                        : {},
    });
  });
}
test('route drafts, reports and optional beta never transfer to another route; back restores selection', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  await page.goto('/?ruta=a');
  const form = page.getByRole('form', { name: 'Registrar actividad' });
  if (
    !(await page
      .locator('#activity-form')
      .getByLabel('Notas', { exact: true })
      .isVisible())
  )
    await page
      .locator('#activity-form')
      .getByText('Añadir detalles', { exact: true })
      .click();
  await form.getByLabel('Notas', { exact: true }).fill('Nota solo A');
  await form.getByLabel('Intentos', { exact: true }).fill('3');
  await page.getByText('Ver beta', { exact: true }).click();
  await expect(page.getByText('Beta privada de A')).toBeVisible();
  await page
    .locator('summary')
    .filter({ hasText: 'Reportar un error' })
    .click();
  await page.getByLabel('Descripción', { exact: true }).fill('Reporte solo A');
  await page.getByRole('button', { name: 'Volver al catálogo' }).click();
  await page.getByRole('button', { name: 'Equilibrio V10' }).click();
  await expect(form.getByLabel('Notas', { exact: true })).toHaveValue('');
  await expect(form.getByLabel('Intentos', { exact: true })).toHaveValue('1');
  await expect(page.getByText('Beta privada de B')).not.toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(/ruta=a/);
  await expect(form.getByLabel('Notas', { exact: true })).toHaveValue(
    'Nota solo A',
  );
  await expect(page.getByText('Beta privada de A')).not.toBeVisible();
  await page
    .locator('summary')
    .filter({ hasText: 'Reportar un error' })
    .click();
  await expect(page.getByLabel('Descripción', { exact: true })).toHaveValue(
    'Reporte solo A',
  );
  expect(errors).toEqual([]);
});
test('QR opens the public detail without 3D, filters normalize accents, navigation restores filters and themes fit mobile', async ({
  page,
}) => {
  let sceneRequests = 0;
  await setup(page, false, async (path) => {
    if (path.includes('/file/')) sceneRequests++;
  });
  await page.route('**/api/route-images/*', (r) =>
    r.fulfill({ status: 404, body: 'Missing asset' }),
  );
  await page.goto('/?ruta=a');
  await expect(
    page.getByRole('heading', { name: 'Travesía V2' }),
  ).toBeVisible();
  await expect(page.getByLabel('Visor de Gaussian Splatting')).toHaveCount(0);
  expect(sceneRequests).toBe(0);
  await expect(
    page.getByRole('button', { name: 'Guardar actividad' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Volver al catálogo' }).click();
  await page.getByLabel('Buscar', { exact: true }).fill('travesia');
  await page.getByRole('button', { name: 'Travesía V2' }).click();
  await page.getByRole('button', { name: 'Volver al catálogo' }).click();
  await expect(page.getByLabel('Buscar', { exact: true })).toHaveValue(
    'travesia',
  );
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(
    page.getByRole('button', { name: 'Equilibrio V10' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar tema' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'warm');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Travesía V2' }).click();
  await expect(
    page.getByText(
      'No se pudo cargar la imagen. Puedes consultar la ficha y registrar actividad.',
    ),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/climbing-ux-fallback-${test.info().project.name}.png`,
    fullPage: false,
  });
});
test('failed activity keeps the draft and request identity; rapid taps create one successful write with undo', async ({
  page,
}) => {
  const requests: any[] = [];
  let failed = true;
  await setup(page, true, async (path, method, data) => {
    if (path === '/api/entries' && method === 'POST') {
      requests.push(data);
      if (failed) {
        failed = false;
        return { status: 503, json: { error: 'Conexión perdida. Reintenta.' } };
      }
      return { json: { id: 'one-entry' } };
    }
    if (path === '/api/entries/one-entry' && method === 'DELETE')
      return { json: { entry: { deletedAt: 'now' } } };
  });
  await page.goto('/?ruta=a');
  const form = page.getByRole('form', { name: 'Registrar actividad' });
  if (
    !(await page
      .locator('#activity-form')
      .getByLabel('Notas', { exact: true })
      .isVisible())
  )
    await page
      .locator('#activity-form')
      .getByText('Añadir detalles', { exact: true })
      .click();
  await form.getByLabel('Notas', { exact: true }).fill('Conservar borrador');
  await expect(
    form.getByRole('button', { name: 'Guardar actividad' }),
  ).toBeEnabled();
  await form.getByRole('button', { name: 'Guardar actividad' }).click();
  await expect(form.getByRole('alert')).toContainText('Conexión perdida');
  await expect(form.getByLabel('Notas', { exact: true })).toHaveValue(
    'Conservar borrador',
  );
  await form.getByRole('button', { name: 'Guardar actividad' }).dblclick();
  await expect(form.getByRole('status')).toContainText('Actividad guardada');
  expect(requests).toHaveLength(2);
  expect(requests[0].requestId).toBe(requests[1].requestId);
  expect(requests[1].routeId).toBe('a');
  expect(requests[1].expectedRevision).toBe(1);
  await form.getByRole('button', { name: 'Deshacer' }).click();
  await expect(form.getByRole('status')).toContainText('Registro retirado');
});
test('invalid QR stays on an explicit not-found state and loose hold report explains direct staff contact', async ({
  page,
}) => {
  await setup(page, true, async (path) =>
    path === '/api/routes/missing'
      ? { status: 404, json: { error: 'No encontrada' } }
      : undefined,
  );
  await page.goto('/?ruta=missing');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Ruta no encontrada' }),
  ).toBeVisible();
  await page.goto('/?ruta=a');
  await page
    .locator('summary')
    .filter({ hasText: 'Reportar un error' })
    .click();
  await page.getByLabel('Categoría').selectOption('agarre_suelto');
  await expect(page.getByRole('alert')).toContainText(
    'Avisa directamente al staff',
  );
});

test('a new route revision preserves the draft and requires an explicit review before retrying', async ({
  page,
}) => {
  let revision = 1;
  const writes: any[] = [];
  await setup(page, true, async (path, method, data) => {
    if (path === '/api/routes/a')
      return {
        json: {
          revision,
          status: 'activa',
          snapshot: {
            name: 'Travesía',
            grade: 'V2',
            sector: 'Sur',
            beta: 'Consejo',
            holds: [],
            rules: 'Reglas actualizadas',
          },
        },
      };
    if (path === '/api/entries' && method === 'POST') {
      writes.push(data);
      if (revision === 1) {
        revision = 2;
        return {
          status: 409,
          json: { error: 'La revisión cambió. Revisa la ruta.' },
        };
      }
      return { json: { id: 'new-revision-entry' } };
    }
  });
  await page.goto('/?ruta=a');
  const form = page.getByRole('form', { name: 'Registrar actividad' });
  if (
    !(await page
      .locator('#activity-form')
      .getByLabel('Notas', { exact: true })
      .isVisible())
  )
    await page
      .locator('#activity-form')
      .getByText('Añadir detalles', { exact: true })
      .click();
  await form
    .getByLabel('Notas', { exact: true })
    .fill('Conservar en revisión nueva');
  await form.getByRole('button', { name: 'Guardar actividad' }).click();
  await expect(form.getByRole('alert')).toContainText(
    'La ruta tiene una revisión nueva',
  );
  await expect(form.getByLabel('Notas', { exact: true })).toHaveValue(
    'Conservar en revisión nueva',
  );
  await expect(
    form.getByRole('button', { name: 'Guardar actividad' }),
  ).toBeDisabled();
  await form.getByRole('button', { name: 'Revisé la nueva revisión' }).click();
  await form.getByRole('button', { name: 'Guardar actividad' }).click();
  await expect(form.getByRole('status')).toContainText('Actividad guardada');
  expect(writes.map((w) => w.expectedRevision)).toEqual([1, 2]);
  expect(writes[1].notes).toBe('Conservar en revisión nueva');
});
