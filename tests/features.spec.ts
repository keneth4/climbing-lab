import { test, expect, type Page } from '@playwright/test';
import { gaussianFixture } from './fixtures';
async function session(page: Page, id = 'feature-user') {
  const exp = Math.floor(Date.now() / 1000) + 3600,
    token =
      'eyJhbGciOiJIUzI1NiJ9.' +
      Buffer.from(
        JSON.stringify({ sub: id, exp, aud: 'authenticated' }),
      ).toString('base64url') +
      '.test';
  await page.addInitScript(
    ({ token, exp, id }) =>
      localStorage.setItem(
        'sb-defblrjdwgnqyzzgozdf-auth-token',
        JSON.stringify({
          access_token: token,
          refresh_token: 'test-refresh',
          expires_at: exp,
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id,
            email: 'features@example.com',
            app_metadata: { provider: 'email' },
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          },
        }),
      ),
    { token, exp, id },
  );
}
async function routes(
  page: Page,
  extra: (
    path: string,
    url: URL,
    method: string,
    data: any,
  ) => Promise<any> | any,
) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname,
      method = route.request().method(),
      data = route.request().postData()
        ? route.request().postDataJSON()
        : undefined;
    if (path.includes('/file/')) {
      await route.fulfill({
        body: gaussianFixture(),
        contentType: 'application/octet-stream',
      });
      return;
    }
    if (
      path === '/api/routes' &&
      url.searchParams.get('status') === 'retirada'
    ) {
      await route.fulfill({ json: { routes: [] } });
      return;
    }
    const custom = await extra(path, url, method, data);
    if (custom?.status) {
      await route.fulfill({ status: custom.status, json: custom.json });
      return;
    }
    const payload =
      custom ??
      (path === '/api/config'
        ? {
            config: {
              name: 'Crux piloto',
              currency: 'MXN',
              timezone: 'America/Mexico_City',
            },
          }
        : path === '/api/me'
          ? { userId: 'feature-user', staff: null }
          : path === '/api/routes'
            ? {
                routes: [
                  {
                    id: 'route-f',
                    name: 'Feature route',
                    grade: 'V2',
                    sector: 'Spray',
                    status: 'activa',
                  },
                ],
              }
            : path === '/api/routes/route-f'
              ? {
                  revision: 1,
                  status: 'activa',
                  snapshot: {
                    name: 'Feature route',
                    grade: 'V2',
                    holds: [],
                    holds3D: [
                      { id: 'h1', role: 'inicio', position: [0, 0, 0] },
                    ],
                    captureId: 'cap-f',
                  },
                }
              : path === '/api/captures/current'
                ? {
                    capture: {
                      id: 'cap-f',
                      version: 1,
                      status: 'published',
                      upload_state: 'ready',
                      filename: 'fixture.ply',
                      transform: {
                        scale: 1,
                        rotation: [0, 0, 1, 0],
                        translation: [0, 0, 0],
                      },
                      fileUrl: '/api/captures/cap-f/file/scene.ply',
                    },
                  }
                : path === '/api/entries'
                  ? {
                      entries: [],
                      summary: {
                        records: 0,
                        attempts: 0,
                        ascents: 0,
                        routes: 0,
                      },
                      pagination: { hasMore: false },
                    }
                  : path === '/api/sections'
                    ? { sections: [] }
                    : path === '/api/projects'
                      ? { projects: [] }
                      : path === '/api/products'
                        ? { products: [], currency: 'MXN' }
                        : path === '/api/staff/reports'
                          ? { reports: [] }
                          : {});
    await route.fulfill({ json: payload });
  });
}
test('API outage is distinct from lost admin and retry restores permissions', async ({
  page,
}) => {
  await session(page);
  let offline = true;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await routes(page, (path) =>
    path === '/api/me'
      ? offline
        ? { status: 503, json: { error: 'API detenida' } }
        : { userId: 'feature-user', staff: 'admin' }
      : undefined,
  );
  await page.goto('/?vista=Catálogo');
  await expect(
    page.getByText('API no disponible. No se pudieron verificar tus permisos.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Capturas', exact: true }),
  ).toHaveCount(0);
  offline = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByText('Permisos confirmados · Admin')).toBeVisible();
  await page.getByRole('button', { name: 'Staff', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Capturas', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/connection-retry-${test.info().project.name}.png`,
  });
  expect(errors).toEqual([]);
});
test('private projects can be explicitly completed and daily activity stays separate from visits', async ({
  page,
}) => {
  await session(page);
  const projects: any[] = [];
  await routes(page, (path, url, method, data) => {
    if (path === '/api/projects') {
      if (method === 'POST') {
        projects.push({
          id: 'project-f',
          route_id: data.routeId,
          route_revision: 1,
          status: 'pendiente',
          notes: data.notes,
          version: 1,
          name: 'Feature route',
          grade: 'V2',
          route_status: 'activa',
        });
        return { project: projects[0] };
      }
      return { projects };
    }
    if (path === '/api/projects/project-f' && method === 'PUT') {
      Object.assign(projects[0], {
        status: data.status,
        notes: data.notes,
        version: 2,
      });
      return { project: projects[0] };
    }
    if (path === '/api/entries' && url.searchParams.get('group') === 'day')
      return {
        timezone: 'America/Mexico_City',
        days: [
          {
            date: '2026-01-11',
            records: 55,
            attempts: 110,
            ascents: 55,
            routes: 1,
          },
        ],
      };
  });
  await page.goto('/?vista=Catálogo');
  await page.getByRole('button', { name: 'Mi escalada', exact: true }).click();
  await page.getByRole('button', { name: 'Mi actividad', exact: true }).click();
  await page.getByRole('button', { name: 'Proyectos', exact: true }).click();
  await page.getByLabel('Ruta del proyecto').selectOption('route-f');
  await page
    .getByLabel('Notas del proyecto', { exact: true })
    .fill('Mi proyecto');
  await page
    .getByRole('button', { name: 'Crear proyecto', exact: true })
    .click();
  await expect(page.getByText('Mi proyecto', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar proyecto' }).click();
  await page.getByLabel('Estado del proyecto').selectOption('completado');
  await page.getByRole('button', { name: 'Guardar proyecto' }).click();
  await expect(
    page.getByText('completado · Ruta activa · Revisión 1'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mi actividad', exact: true }).click();
  await page
    .getByText('Actividad por día del gimnasio', { exact: true })
    .click();
  await expect(
    page.getByText('55 registros · 110 intentos · 55 ascensos · 1 rutas'),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/projects-daily-${test.info().project.name}.png`,
  });
});
test('3D PNG and sweep video export preserve camera and support cancellation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await routes(page, () => undefined);
  await page.goto('/?ruta=route-f');
  await page.getByRole('button', { name: 'Explorar en 3D' }).click();
  await expect(
    page.getByText('fixture.ply · 0 MB · captura del gimnasio'),
  ).toBeVisible({ timeout: 30000 });
  await page.getByText('Compartir visual 3D', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Preparar tarjeta 3D (PNG)', exact: true })
    .click();
  const png = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Descargar tarjeta 3D (PNG)', exact: true })
    .click();
  expect((await png).suggestedFilename()).toBe('ruta-3d.png');
  const canvas = page.getByLabel('Visor de Gaussian Splatting');
  const before = await canvas.getAttribute('data-camera-view');
  await page
    .getByRole('button', { name: 'Grabar barrido de 6 segundos' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Mi escalada', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Cancelar video' }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Cancelar video' }).press('Escape');
  await expect(
    page.getByRole('button', { name: 'Mi escalada', exact: true }),
  ).toBeEnabled();
  expect(await canvas.getAttribute('data-camera-view')).toBe(before);
  const video = page.waitForEvent('download', { timeout: 20000 });
  await page
    .getByRole('button', { name: 'Grabar barrido de 6 segundos' })
    .click();
  expect((await video).suggestedFilename()).toMatch(/ruta-barrido\.(webm|mp4)/);
  await expect(
    page.getByRole('button', { name: 'Mi escalada', exact: true }),
  ).toBeEnabled();
  expect(await canvas.getAttribute('data-camera-view')).toBe(before);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `/tmp/media-export-${test.info().project.name}.png`,
  });
});

test('admin reception confirms membership, QR visit and manual sale while public products remain available', async ({
  page,
}) => {
  await session(page, 'ops-browser');
  const members: any[] = [],
    plans: any[] = [],
    payments: any[] = [],
    memberships: any[] = [],
    products: any[] = [],
    visits: any[] = [];
  let credential: any;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await routes(page, (path, url, method, data) => {
    if (path === '/api/me') return { userId: 'ops-browser', staff: 'admin' };
    if (path === '/api/members') {
      if (method === 'POST') {
        members.push({ id: 'member-browser', name: data.name });
        return { id: 'member-browser' };
      }
      return { members };
    }
    if (path === '/api/plans') {
      if (method === 'POST') {
        plans.push({ id: 'plan-browser', ...data, version: 1, active: 1 });
        return { id: 'plan-browser' };
      }
      return { plans };
    }
    if (path === '/api/memberships') return { memberships };
    if (path === '/api/payments' && method === 'POST') {
      memberships.push({
        id: 'membership-browser',
        member_id: data.memberId,
        name: members[0].name,
        kind: 'entries',
        start_day: data.startDay,
        end_day: data.endDay,
        remaining: 1,
        status: 'pending',
      });
      payments.push({
        id: 'pay-membership',
        amount: 10000,
        source_type: 'membership',
        status: 'pending',
        method: data.method,
        reference: data.reference,
        version: 1,
      });
      return { id: 'pay-membership', membershipId: 'membership-browser' };
    }
    if (path === '/api/credentials' && method === 'POST') {
      credential = {
        id: 'credential-browser',
        member_id: members[0].id,
        name: members[0].name,
      };
      return { ...credential, token: 'token-browser' };
    }
    if (path === '/api/reception/resolve')
      return {
        credential,
        memberships: memberships.filter((m) => m.status === 'active'),
        visit: visits[0] || null,
        today: '2026-10-13',
      };
    if (path === '/api/visits') {
      if (method === 'POST') {
        visits.push({
          id: 'visit-browser',
          name: members[0].name,
          day: '2026-10-13',
          status: 'confirmed',
          consumed: data.consume ? 1 : 0,
          version: 1,
        });
        memberships[0].remaining--;
        return { id: 'visit-browser' };
      }
      return { visits };
    }
    if (path === '/api/inventory') return { products, currency: 'MXN' };
    if (path === '/api/products') {
      if (method === 'POST') {
        products.push({
          id: 'variant-browser',
          product_name: data.name,
          name: data.variant,
          sku: data.sku,
          price: data.price,
          stock: data.stock,
          active: 1,
          version: 1,
        });
        return { id: 'product-browser', variantId: 'variant-browser' };
      }
      return { products, currency: 'MXN' };
    }
    if (path === '/api/sales' && method === 'POST') {
      payments.push({
        id: 'pay-sale',
        source_type: 'sale',
        amount: 2000,
        status: 'pending',
        method: data.method,
        reference: data.reference,
        version: 1,
      });
      return { id: 'sale-browser', paymentId: 'pay-sale' };
    }
    const pay = path.match(/^\/api\/payments\/([^/]+)\/(confirm|void)$/);
    if (pay) {
      const p = payments.find((p) => p.id === pay[1]);
      p.status = pay[2] === 'confirm' ? 'confirmed' : 'voided';
      p.version++;
      if (p.source_type === 'membership') memberships[0].status = 'active';
      else products[0].stock += pay[2] === 'confirm' ? -1 : 1;
      return { ok: true };
    }
    if (path === '/api/finance') {
      const sum = (s: string) =>
        payments
          .filter((p) => p.status === s)
          .reduce((n, p) => n + p.amount, 0);
      return {
        payments,
        totals: {
          confirmed: sum('confirmed'),
          pending: sum('pending'),
          voided: sum('voided'),
          methods: { cash: 0, transfer: 10000, terminal: 0 },
          sales: sum('confirmed') - 10000,
        },
        memberships: { active: 1 },
      };
    }
  });
  await page.goto('/?vista=Catálogo');
  await expect(page.getByText('Permisos confirmados · Admin')).toBeVisible();
  await page.getByRole('button', { name: 'Staff', exact: true }).click();
  await page.getByRole('button', { name: 'Recepción', exact: true }).click();
  await page.getByText('Socios y tarjetas QR', { exact: true }).click();
  await page.getByLabel('Nombre del socio').fill('Socio piloto');
  await page.getByRole('button', { name: 'Crear socio en recepción' }).click();
  await page
    .getByRole('combobox', { name: 'Socio', exact: true })
    .selectOption('member-browser');
  await page.getByRole('button', { name: 'Emitir o reemitir QR' }).click();
  await expect(
    page.getByRole('img', { name: 'Credencial de visita del socio' }),
  ).toBeVisible();
  await page.getByText('Planes y membresías', { exact: true }).click();
  await page.getByLabel('Nombre del plan').fill('Entrada piloto');
  await page
    .getByRole('combobox', { name: 'Tipo de plan' })
    .selectOption('entries');
  await page.getByLabel('Días o entradas').fill('1');
  await page.getByLabel('Precio del plan').fill('100');
  await page.getByRole('button', { name: 'Crear plan', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Plan', exact: true })
    .selectOption('plan-browser');
  await page.getByLabel('Fin de vigencia del bono').fill('2999-01-01');
  await page
    .getByRole('combobox', { name: 'Método de cobro' })
    .selectOption('transfer');
  await page
    .getByRole('button', { name: 'Preparar membresía y cobro' })
    .click();
  await page.getByText('Cobros y dashboard', { exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar cobro' }).click();
  await expect(
    page.getByText('Cobro confirmado.', { exact: true }),
  ).toBeVisible();
  await page.getByText('Registrar visita', { exact: true }).click();
  await page.getByLabel('Código QR de visita').fill('token-browser');
  await page.getByRole('button', { name: 'Identificar socio' }).click();
  await page
    .getByRole('combobox', { name: 'Membresía a usar' })
    .selectOption('membership-browser');
  await page.getByLabel('Confirmo consumir una entrada del bono').check();
  await page.getByRole('button', { name: 'Confirmar visita' }).click();
  await expect(
    page.getByText(
      'Visita ya registrada hoy · Confirmado. No se consume otra entrada.',
    ),
  ).toBeVisible();
  expect(memberships[0].remaining).toBe(0);
  await page
    .getByText('Productos, ventas e inventario', { exact: true })
    .click();
  await page.getByLabel('Nombre del producto').fill('Magnesia');
  await page.getByLabel('Variante', { exact: true }).fill('Bolsa');
  await page.getByLabel('SKU', { exact: true }).fill('sku-browser');
  await page.getByLabel('Precio (MXN)', { exact: true }).fill('20');
  await page.getByLabel('Existencias').fill('1');
  await page
    .getByRole('button', { name: 'Crear producto', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'Producto de venta' })
    .selectOption('variant-browser');
  await page.getByRole('button', { name: 'Agregar línea' }).click();
  await page.getByRole('button', { name: 'Preparar venta y cobro' }).click();
  await page.getByRole('button', { name: 'Confirmar cobro' }).click();
  await expect(page.getByText('sku-browser · $20.00 · Stock 0')).toBeVisible();
  await page.getByLabel('Motivo de anulación del cobro').fill('Devolución');
  await page
    .locator('article')
    .filter({ hasText: 'Venta ·' })
    .getByRole('button', { name: 'Anular cobro' })
    .click();
  await expect(page.getByText('sku-browser · $20.00 · Stock 1')).toBeVisible();
  await page.screenshot({
    path: `/tmp/operations-${test.info().project.name}.png`,
  });
  await page
    .getByRole('button', { name: 'Productos disponibles', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Magnesia', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('unsupported video retains image export and historical cards reject missing captures', async ({
  page,
}) => {
  await session(page);
  await page.addInitScript(() =>
    Object.defineProperty(window, 'MediaRecorder', {
      value: undefined,
      configurable: true,
    }),
  );
  await routes(page, (path, url) => {
    if (path === '/api/entries' && !url.searchParams.has('group'))
      return {
        entries: [
          {
            id: 'entry-old',
            route_id: 'route-f',
            revision: 3,
            route_name: 'Old route',
            grade: 'V1',
            created_at: '2020-01-01T00:00:00.000Z',
            attempts: 2,
            result: 'ascenso',
            notes: 'Private',
            entry_version: 1,
          },
        ],
        summary: { records: 1, attempts: 2, ascents: 1, routes: 1 },
        pagination: { hasMore: false },
      };
    if (path === '/api/entries/entry-old/presentation')
      return {
        snapshot: { name: 'Old route', grade: 'V1', holds3D: [] },
        revision: 3,
      };
  });
  await page.goto('/?ruta=route-f');
  await page.getByRole('button', { name: 'Explorar en 3D' }).click();
  await page.getByText('Compartir visual 3D', { exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Grabar barrido de 6 segundos' }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Grabar barrido de 6 segundos' })
    .click();
  await expect(
    page.getByText(
      'Este navegador no permite grabar video. Descarga una imagen 3D.',
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Preparar tarjeta 3D (PNG)', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Descargar tarjeta 3D (PNG)' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Mi escalada', exact: true }).click();
  await page.getByRole('button', { name: 'Mi actividad', exact: true }).click();
  await page
    .getByRole('button', { name: 'Preparar tarjeta histórica 3D' })
    .click();
  await expect(
    page.getByText(
      'Este registro no tiene captura histórica. No se sustituirá por el armado actual.',
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Descargar tarjeta 3D (PNG)' }),
  ).toHaveCount(0);
});

test('historical 3D cards use the stored capture and camera with personal data only when selected', async ({
  page,
}) => {
  await session(page);
  await routes(page, (path, url) => {
    if (path === '/api/entries' && !url.searchParams.has('group'))
      return {
        entries: [
          {
            id: 'entry-history',
            route_id: 'route-f',
            revision: 3,
            route_name: 'Historical route',
            grade: 'V1',
            created_at: '2020-01-01T00:00:00.000Z',
            attempts: 2,
            result: 'ascenso',
            notes: '',
            entry_version: 1,
          },
        ],
        summary: { records: 1, attempts: 2, ascents: 1, routes: 1 },
        pagination: { hasMore: false },
      };
    if (path === '/api/entries/entry-history/presentation')
      return {
        snapshot: {
          captureId: 'cap-history',
          camera: {
            captureId: 'cap-history',
            yaw: 0.3,
            pitch: 0,
            distance: 5,
            target: [0, 0, 0],
          },
          holds3D: [],
        },
        revision: 3,
      };
    if (path === '/api/captures/cap-history/metadata')
      return {
        capture: {
          id: 'cap-history',
          version: 1,
          status: 'published',
          upload_state: 'ready',
          filename: 'history.ply',
          transform: {
            scale: 1,
            rotation: [0, 0, 1, 0],
            translation: [0, 0, 0],
          },
          fileUrl: '/api/captures/cap-history/file/scene.ply',
        },
      };
  });
  await page.goto('/?vista=Catálogo');
  await page.getByRole('button', { name: 'Mi escalada', exact: true }).click();
  await page.getByRole('button', { name: 'Mi actividad', exact: true }).click();
  await page
    .getByRole('button', { name: 'Preparar tarjeta histórica 3D' })
    .click();
  await expect(
    page.getByText('history.ply · 0 MB · captura del gimnasio'),
  ).toBeVisible();
  await page.getByText('Compartir visual 3D', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Preparar tarjeta 3D (PNG)', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Descargar tarjeta 3D (PNG)' }),
  ).toBeEnabled();
  const canvas = page.getByLabel('Visor de Gaussian Splatting');
  expect(JSON.parse((await canvas.getAttribute('data-camera-view'))!).yaw).toBe(
    0.3,
  );
  const anonymous = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Descargar tarjeta 3D (PNG)' })
    .click();
  const anonFile = await anonymous;
  const fs = await import('node:fs/promises');
  const anonymousBytes = await fs.readFile((await anonFile.path())!);
  await page.getByLabel('Incluir nombre', { exact: true }).check();
  await page.getByLabel('Incluir intentos', { exact: true }).check();
  await page.getByLabel('Nombre para la tarjeta').fill('Nombre elegido');
  await page
    .getByRole('button', { name: 'Preparar tarjeta 3D (PNG)', exact: true })
    .click();
  const personal = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Descargar tarjeta 3D (PNG)' })
    .click();
  const personalFile = await personal;
  const personalBytes = await fs.readFile((await personalFile.path())!);
  expect(personalBytes.readUInt32BE(16)).toBe(1280);
  expect(personalBytes.readUInt32BE(20)).toBe(720);
  expect(personalBytes.equals(anonymousBytes)).toBe(false);
  await page.getByRole('button', { name: 'Cerrar tarjeta histórica' }).click();
  await expect(
    page.getByText('Compartir visual 3D', { exact: true }),
  ).toHaveCount(0);
  await expect(canvas).toHaveCount(1);
});
