import { test, expect, type Page } from '@playwright/test';
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAZ0AAAAASUVORK5CYII=',
  'base64',
);
const routes = [
  {
    id: 'site-a',
    name: 'Travesía de equilibrio con un nombre muy largo para comprobar lectura y reflow',
    grade: 'V2',
    gradeScale: 'V',
    sector: 'Sur',
    status: 'activa',
    revision: 2,
    imageId: 'site-image',
    holds: [],
    rules: 'Pies libres',
    beta: 'Consejo opcional',
  },
  {
    id: 'site-old',
    name: 'Ruta anterior',
    grade: 'V4',
    gradeScale: 'V',
    sector: 'Norte',
    status: 'retirada',
    revision: 3,
    holds: [],
  },
];
async function fixture(page: Page, outage = () => false) {
  await page.route('**/api/**', async (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.includes('/route-images/'))
      return r.fulfill({ body: image, contentType: 'image/png' });
    if (u.pathname === '/api/routes' && outage())
      return r.fulfill({
        status: 503,
        json: { error: 'Catálogo no disponible' },
      });
    const route = routes.find((x) => u.pathname === `/api/routes/${x.id}`);
    if (u.pathname.startsWith('/api/routes/') && !route)
      return r.fulfill({ status: 404, json: { error: 'Ruta no encontrada' } });
    await r.fulfill({
      json: route
        ? { snapshot: route, status: route.status, revision: route.revision }
        : u.pathname === '/api/routes'
          ? {
              routes: routes
                .filter((x) => x.status === u.searchParams.get('status'))
                .map((x) => ({ ...x, snapshot: x })),
            }
          : u.pathname === '/api/sections'
            ? { sections: [] }
            : u.pathname === '/api/captures/current'
              ? { capture: null }
              : {},
    });
  });
}
test('public home, compact catalog, FAQ and account work at all planned widths and both themes', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await fixture(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['default', 'warm']) {
      await page.goto('/');
      await page.evaluate(
        (t) => localStorage.setItem('climbing-theme', t),
        theme,
      );
      await page.reload();
      await expect(page).toHaveTitle(/Inicio · Climbing Lab/);
      await expect(
        page.getByRole('heading', { name: 'Encuentra tu siguiente reto.' }),
      ).toBeVisible();
      await expect(page.locator('vite-error-overlay')).toHaveCount(0);
      await expect(page.getByLabel('Visor de Gaussian Splatting')).toHaveCount(
        0,
      );
      await expect(
        page.getByRole('button', { name: 'Staff', exact: true }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/climbing-site-home-${info.project.name}-${width}-${theme}.png`,
        fullPage: true,
      });
      await page
        .getByRole('button', { name: 'Explorar rutas', exact: true })
        .click();
      await expect(page).toHaveTitle(/Rutas ·/);
      await expect(
        page.getByRole('heading', { name: 'Rutas', exact: true }),
      ).toBeFocused();
      await expect(page.getByLabel('Ficha de ruta')).toHaveCount(0);
      await page.getByLabel('Buscar', { exact: true }).fill('sur');
      await expect(page.locator('.route-card')).toHaveCount(1);
      await page.getByRole('button', { name: 'Quitar Búsqueda: sur' }).click();
      await page.getByLabel('Buscar', { exact: true }).fill('inexistente');
      await expect(
        page.getByRole('heading', { name: 'No hay rutas con estos filtros' }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Mostrar todas las rutas' })
        .click();
      await page.screenshot({
        path: `/tmp/climbing-site-catalog-${info.project.name}-${width}-${theme}.png`,
        fullPage: true,
      });
      await page.locator('.route-card').first().click();
      await expect(page).toHaveURL(/ruta=site-a/);
      await expect(
        page.getByLabel('Ficha de ruta').getByRole('heading').first(),
      ).toBeFocused();
      await page
        .getByRole('button', { name: 'El gimnasio', exact: true })
        .click();
      await expect(
        page.getByRole('heading', { name: 'Preguntas frecuentes' }),
      ).toBeVisible();
      await page
        .getByText('¿Dónde está el gimnasio y cuáles son sus horarios?', {
          exact: true,
        })
        .click();
      await expect(
        page.getByText('Este gimnasio es ficticio.', { exact: false }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Mi cuenta', exact: true })
        .click();
      await expect(
        page.getByRole('navigation', { name: 'Cuenta', exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Mi actividad', exact: true })
        .click();
      await expect(
        page.getByText('Inicia sesión para consultar tu bitácora personal.'),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
test('legacy filter links, back/forward, retired and invalid routes, and catalog retries stay usable', async ({
  page,
}) => {
  let offline = false;
  await fixture(page, () => offline);
  await page.goto('/?orden=recientes&buscar=sur');
  await expect(
    page.getByRole('heading', { name: 'Rutas', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Buscar', { exact: true }).fill('travesia');
  await expect(page).toHaveURL(/buscar=travesia/);
  await page.reload();
  await expect(page.getByLabel('Buscar', { exact: true })).toHaveValue(
    'travesia',
  );
  await page.getByLabel('Buscar', { exact: true }).fill('sur');
  await page.locator('.route-card').click();
  await page.goBack();
  await expect(page.getByLabel('Buscar', { exact: true })).toHaveValue('sur');
  await page.goForward();
  await expect(page).toHaveURL(/ruta=site-a/);
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.reload();
  await expect(page).toHaveTitle(/Inicio ·/);
  await page.goto('/?ruta=site-old');
  await expect(
    page.getByText('Ruta retirada. El enlace y su historial se conservan.', {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto('/?ruta=invalid');
  await expect(
    page.getByText('Ruta no encontrada o no disponible.'),
  ).toBeVisible();
  offline = true;
  await page.goto('/?vista=Rutas');
  await expect(
    page.getByRole('heading', { name: 'No se pudo cargar el catálogo' }),
  ).toBeVisible();
  offline = false;
  await page.getByRole('button', { name: 'Reintentar catálogo' }).click();
  await expect(page.locator('.route-card')).toHaveCount(1);
});
test('keyboard skip link and 200 percent zoom preserve reading and navigation', async ({
  page,
}, info) => {
  await fixture(page);
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Saltar al contenido' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  // CSS zoom exercises actual 2x layout/paint scaling, in addition to narrow reflow.
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => (document.documentElement.style.zoom = '2'));
  await page.getByRole('button', { name: 'Rutas', exact: true }).click();
  await expect(page.locator('.route-card').first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/climbing-site-reflow-${info.project.name}.png`,
    fullPage: true,
  });
});

test('login from a route restores its draft and saving stays attributed to that route', async ({
  page,
}) => {
  await fixture(page);
  const user = {
    id: 'site-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'site@example.com',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: user.id, exp })).toString('base64url')}.test`;
  await page.route('https://defblrjdwgnqyzzgozdf.supabase.co/auth/v1/**', (r) =>
    r.fulfill({
      json: {
        access_token: token,
        refresh_token: 'test',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: exp,
        user,
      },
    }),
  );
  await page.route('**/api/me', (r) =>
    r.fulfill({ json: { userId: user.id, staff: null } }),
  );
  const writes: any[] = [];
  await page.route('**/api/entries', (r) => {
    if (r.request().method() === 'POST') {
      writes.push(r.request().postDataJSON());
      return r.fulfill({ json: { id: 'entry-site' } });
    }
    return r.fulfill({ json: { entries: [] } });
  });
  await page.goto('/?ruta=site-a');
  await page
    .getByRole('form', { name: 'Registrar actividad' })
    .getByLabel('Notas', { exact: true })
    .fill('Mi borrador de esta ruta');
  await page
    .getByRole('button', { name: 'Iniciar sesión', exact: true })
    .click();
  await expect(page).toHaveURL(/vista=Cuenta/);
  await page.getByLabel('Correo', { exact: true }).fill(user.email);
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('Test-password-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/ruta=site-a/);
  const form = page.getByRole('form', { name: 'Registrar actividad' });
  await expect(form.getByLabel('Notas', { exact: true })).toHaveValue(
    'Mi borrador de esta ruta',
  );
  await form
    .getByRole('button', { name: 'Guardar actividad', exact: true })
    .click();
  await expect(
    page.getByText('Actividad guardada.', { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    routeId: 'site-a',
    expectedRevision: 2,
    notes: 'Mi borrador de esta ruta',
  });
});

test('password recovery keeps its form visible for an authenticated recovery session', async ({
  page,
}) => {
  await fixture(page);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = {
    id: 'site-user',
    email: 'site@example.com',
    aud: 'authenticated',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2020-01-01T00:00:00Z',
  };
  await page.addInitScript(
    ({ exp, user }) =>
      localStorage.setItem(
        'sb-defblrjdwgnqyzzgozdf-auth-token',
        JSON.stringify({
          access_token:
            'eyJhbGciOiJIUzI1NiJ9.' +
            btoa(JSON.stringify({ sub: user.id, exp })) +
            '.test',
          refresh_token: 'test',
          expires_at: exp,
          expires_in: 3600,
          token_type: 'bearer',
          user,
        }),
      ),
    { exp, user },
  );
  await page.route('https://defblrjdwgnqyzzgozdf.supabase.co/auth/v1/**', (r) =>
    r.fulfill({ json: { user } }),
  );
  await page.route('**/api/me', (r) =>
    r.fulfill({ json: { userId: user.id, staff: null } }),
  );
  await page.route('**/api/entries', (r) =>
    r.fulfill({ json: { entries: [] } }),
  );
  await page.goto('/auth/reset-password');
  await expect(
    page.getByRole('button', { name: 'Cerrar sesión', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Nueva contraseña' }),
  ).toBeVisible();
  await page
    .getByLabel('Contraseña', { exact: true })
    .fill('New-test-password-123');
  await page
    .getByRole('button', { name: 'Guardar contraseña', exact: true })
    .click();
  await expect(
    page.getByText('Contraseña actualizada.', { exact: true }),
  ).toBeVisible();
});
