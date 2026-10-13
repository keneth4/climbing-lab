import { gaussianFixture } from './fixtures';
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/file/scene.ply')) {
      await route.fulfill({
        body: gaussianFixture(),
        contentType: 'application/octet-stream',
      });
      return;
    }
    const payload =
      path === '/api/captures/current'
        ? {
            capture: {
              id: 'cap-a',
              filename: 'fixture.ply',
              size: 100,
              status: 'published',
              upload_state: 'ready',
              version: 1,
              transform: {
                scale: 1,
                rotation: [0, 0, 1, 0],
                translation: [0, 0, 0],
              },
              alignment: null,
              fileUrl: '/api/captures/cap-a/file/scene.ply',
            },
          }
        : path === '/api/sections'
          ? {
              sections: [
                {
                  id: 'section-a',
                  name: 'Spray wall',
                  bounds: { min: [-2, -2, -1], max: [2, 2, 1] },
                },
              ],
            }
          : path === '/api/routes'
            ? {
                routes: [
                  {
                    id: 'route-a',
                    name: 'Ruta A',
                    grade: 'V2',
                    sector: 'Spray wall',
                    beta: 'Beta de prueba',
                    status: 'activa',
                  },
                ],
              }
            : path === '/api/routes/route-a'
              ? {
                  revision: 1,
                  snapshot: {
                    holds: [],
                    sectionId: 'section-a',
                    captureId: 'cap-a',
                  },
                  status: 'activa',
                }
              : path === '/api/me'
                ? { userId: 'test', staff: null }
                : path === '/api/entries'
                  ? { entries: [] }
                  : {};
    await route.fulfill({ json: payload });
  });
});
test('anonymous catalog, login controls, QR and responsive layout', async ({
  page,
}) => {
  const errors: string[] = [];
  const appErrors: string[] = [];
  page.on('pageerror', (e) => appErrors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ruta A V2' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Guardar actividad' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Staff', exact: true }),
  ).toHaveCount(0);
  const canvas = page.getByLabel('Visor de Gaussian Splatting');
  await expect(canvas).toBeVisible();
  const expanded = await canvas.boundingBox();
  await page.getByRole('button', { name: 'Plegar herramientas' }).click();
  await expect(canvas).toBeVisible();
  const collapsed = await canvas.boundingBox();
  expect(collapsed!.width * collapsed!.height).toBeGreaterThan(
    expanded!.width * expanded!.height,
  );
  await expect(
    page.getByRole('heading', { name: 'Ruta A V2' }),
  ).not.toBeVisible();
  await page.screenshot({
    path: `/tmp/workspace-closed-${test.info().project.name}.png`,
  });
  await page.getByRole('button', { name: 'Abrir herramientas' }).click();
  await expect(page.getByRole('heading', { name: 'Ruta A V2' })).toBeVisible();
  await page.screenshot({
    path: `/tmp/workspace-open-${test.info().project.name}.png`,
  });
  await page.getByText('QR de la ruta', { exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar QR' }).click();
  expect((await download).suggestedFilename()).toBe('route-a-qr.png');
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Continuar con Google' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Crear cuenta' }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `/tmp/climbing-auth-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('password login → protected request → logout clears personal data', async ({
  page,
}) => {
  const user = {
    id: 'test',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.com',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'test', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`;
  await page.route(
    'https://defblrjdwgnqyzzgozdf.supabase.co/auth/v1/**',
    async (route) =>
      route.fulfill({
        json: route.request().url().includes('/logout')
          ? {}
          : {
              access_token: token,
              token_type: 'bearer',
              expires_in: 3600,
              refresh_token: 'test-refresh',
              user,
            },
      }),
  );
  await page.route('**/api/entries*', async (route) => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    await route.fulfill({
      json: {
        entries: [
          {
            id: 'entry',
            route_id: 'route-a',
            revision: 1,
            route_name: 'Ruta A',
            grade: 'V2',
            created_at: new Date().toISOString(),
            attempts: 3,
            result: 'ascenso',
            notes: 'Mi registro privado',
          },
        ],
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click();
  await page.getByLabel('Correo', { exact: true }).fill('test@example.com');
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('Test-password-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Cerrar sesión' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Bitácora', exact: true }).click();
  await expect(page.getByText('Mi registro privado')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByText('Mi registro privado')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Iniciar sesión' }),
  ).toBeVisible();
});
test('published capture loads automatically without a route file input', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ruta A V2' })).toBeVisible();
  await expect(
    page.getByText('fixture.ply · 0 MB · captura del gimnasio'),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  const canvas = page.getByLabel('Visor de Gaussian Splatting');
  await canvas.evaluate((el) =>
    el.setAttribute('data-persistent-test', 'original'),
  );
  await canvas.press('ArrowRight');
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const viewBefore = await canvas.getAttribute('data-camera-view');
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/file')) requests.push(request.url());
  });
  await page.getByRole('button', { name: 'Cuenta', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-persistent-test', 'original');
  await expect(
    page.getByRole('button', { name: 'Continuar con Google' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Bitácora', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-persistent-test', 'original');
  await page.getByRole('button', { name: 'Catálogo', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-persistent-test', 'original');
  expect(requests).toEqual([]);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  expect(await canvas.getAttribute('data-camera-view')).toBe(viewBefore);
  await expect(canvas).toHaveCount(1);
  await page.screenshot({
    path: `/tmp/persistent-viewer-${test.info().project.name}.png`,
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar vista 3D' }).click();
  expect((await download).suggestedFilename()).toBe('captura-3d.png');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('staff editor saves a version and keeps retired routes accessible', async ({
  page,
}) => {
  const appErrors: string[] = [];
  page.on('pageerror', (e) => appErrors.push(e.message));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'staff-test', exp })).toString('base64url')}.test`;
  await page.addInitScript(
    ({ token, exp }) =>
      localStorage.setItem(
        'sb-defblrjdwgnqyzzgozdf-auth-token',
        JSON.stringify({
          access_token: token,
          refresh_token: 'test-refresh',
          expires_at: exp,
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'staff-test',
            email: 'staff@example.com',
            app_metadata: { provider: 'email' },
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          },
        }),
      ),
    { token, exp },
  );
  let current = {
    id: 'route-a',
    revision: 1,
    name: 'Ruta A',
    grade: 'V2',
    sector: 'Spray wall',
    beta: 'Beta de prueba',
    status: 'activa',
    holds: [],
    holds3D: [] as any[],
    sectionId: 'section-a',
    captureId: 'cap-a',
  };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let json: any = {};
    if (path.includes('/file/scene.ply')) {
      await route.fulfill({
        body: gaussianFixture(),
        contentType: 'application/octet-stream',
      });
      return;
    }
    if (path === '/api/captures/current') {
      await route.fulfill({
        json: {
          capture: {
            id: 'cap-a',
            filename: 'fixture.ply',
            size: 100,
            status: 'published',
            upload_state: 'ready',
            version: 1,
            transform: {
              scale: 1,
              rotation: [0, 0, 1, 0],
              translation: [0, 0, 0],
            },
            alignment: null,
            fileUrl: '/api/captures/cap-a/file/scene.ply',
          },
        },
      });
      return;
    }
    if (path === '/api/sections') {
      await route.fulfill({
        json: {
          sections: [
            {
              id: 'section-a',
              name: 'Spray wall',
              bounds: { min: [-2, -2, -1], max: [2, 2, 1] },
            },
          ],
        },
      });
      return;
    }
    if (path === '/api/me') json = { userId: 'staff-test', staff: 'editor' };
    else if (path === '/api/entries') json = { entries: [] };
    else if (path === '/api/staff/reports') json = { reports: [] };
    else if (path === '/api/routes')
      json = {
        routes:
          current.status === (url.searchParams.get('status') || 'activa')
            ? [current]
            : [],
      };
    else if (path === '/api/routes/route-a') {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON();
        expect(body.expectedRevision).toBe(current.revision);
        current = { ...current, ...body, revision: current.revision + 1 };
      }
      json = {
        id: current.id,
        revision: current.revision,
        snapshot: current,
        status: current.status,
      };
    }
    await route.fulfill({ json });
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Staff', exact: true }),
  ).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Editar ruta' }).click();
  await page
    .getByLabel('Nombre de ruta', { exact: true })
    .fill('Ruta revisada');
  const markerEditor = page.locator('.route-markers');
  await markerEditor
    .getByRole('button', { name: 'Preparar agarres en 3D', exact: true })
    .click();
  await expect(
    markerEditor.getByRole('button', {
      name: 'Seleccionar punto',
      exact: true,
    }),
  ).toBeEnabled();
  await markerEditor
    .getByRole('button', { name: 'Seleccionar punto', exact: true })
    .click();
  const bounds = await markerEditor.locator('canvas').boundingBox();
  const ratio =
    bounds!.height /
    (2 * Math.tan(Math.PI / 8) * (Math.sqrt(0.9 ** 2 * 2) * 2.5));
  await markerEditor.locator('canvas').click({
    position: {
      x: bounds!.width / 2 - 0.1 * ratio,
      y: bounds!.height / 2 + 0.1 * ratio,
    },
  });
  await expect(
    markerEditor.getByRole('heading', {
      name: 'Confirmar agarre seleccionado',
    }),
  ).toBeVisible();
  await markerEditor.getByLabel('Función del agarre').selectOption('inicio');
  await markerEditor
    .getByRole('button', { name: 'Añadir agarre a la ruta' })
    .click();
  expect(current.revision).toBe(1);
  expect(current.holds3D).toEqual([]);
  await markerEditor
    .getByRole('button', { name: 'Guardar cámara para esta ruta' })
    .click();
  expect(current.revision).toBe(1);
  await markerEditor
    .locator('canvas')
    .screenshot({ path: `/tmp/route-markers-${test.info().project.name}.png` });
  await page.getByRole('button', { name: 'Guardar ruta en D1' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ruta revisada V2' }),
  ).toBeVisible();
  await expect(
    page.getByText('Spray wall · Revisión 2 · activa', { exact: true }),
  ).toBeVisible();
  expect(current.holds3D).toHaveLength(1);
  expect(current.holds3D[0].role).toBe('inicio');
  await expect(page.getByLabel('Mostrar agarres 3D (1)')).toBeVisible();
  await page.getByLabel('Mostrar agarres 3D (1)').uncheck();
  await page.getByLabel('Mostrar agarres 3D (1)').check();
  await page.locator('summary').filter({ hasText: 'Editar ruta' }).click();
  await page
    .getByRole('combobox', { name: 'Estado', exact: true })
    .selectOption('retirada');
  await page.getByRole('button', { name: 'Guardar ruta en D1' }).click();
  await expect(
    page.getByText('Spray wall · Revisión 3 · retirada', { exact: true }),
  ).toBeVisible();
  expect(appErrors).toEqual([]);
  await page.screenshot({
    path: `/tmp/climbing-editor-${test.info().project.name}.png`,
    fullPage: true,
  });
});
