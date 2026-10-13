import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const payload =
      path === '/api/routes'
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
          ? { revision: 1, snapshot: { holds: [] }, status: 'activa' }
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
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ruta A V2' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Guardar actividad' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Staff', exact: true }),
  ).toHaveCount(0);
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
  await page.route('**/api/entries', async (route) => {
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
test('local splat remains usable with the authenticated app shell', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ruta A V2' })).toBeVisible();
  const input = page.getByLabel('Archivo PLY o SOG');
  await expect(input).toBeEnabled();
  const props = [
    'x',
    'y',
    'z',
    'f_dc_0',
    'f_dc_1',
    'f_dc_2',
    'opacity',
    'scale_0',
    'scale_1',
    'scale_2',
    'rot_0',
    'rot_1',
    'rot_2',
    'rot_3',
  ];
  const header = Buffer.from(
    `ply\nformat binary_little_endian 1.0\nelement vertex 100\n${props.map((p) => `property float ${p}`).join('\n')}\nend_header\n`,
  );
  const body = Buffer.alloc(100 * props.length * 4);
  for (let i = 0; i < 100; i++) {
    [
      (i % 10) / 5 - 1,
      Math.floor(i / 10) / 5 - 1,
      0,
      1,
      0,
      0,
      5,
      -2.5,
      -2.5,
      -2.5,
      1,
      0,
      0,
      0,
    ].forEach((v, j) => body.writeFloatLE(v, (i * props.length + j) * 4));
  }
  await input.setInputFiles({
    name: 'fixture.ply',
    mimeType: 'application/octet-stream',
    buffer: Buffer.concat([header, body]),
  });
  await expect(page.getByText('fixture.ply · 0 MB · vista local')).toBeVisible({
    timeout: 30000,
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
  };
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let json: any = {};
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
  await page.getByRole('button', { name: 'Guardar ruta en D1' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ruta revisada V2' }),
  ).toBeVisible();
  await expect(
    page.getByText('Spray wall · Revisión 2 · activa', { exact: true }),
  ).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Editar ruta' }).click();
  await page
    .getByRole('combobox', { name: 'Estado', exact: true })
    .selectOption('retirada');
  await page.getByRole('button', { name: 'Guardar ruta en D1' }).click();
  await expect(
    page.getByText('Spray wall · Revisión 3 · retirada', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/climbing-editor-${test.info().project.name}.png`,
    fullPage: true,
  });
});
