import { test, expect } from '@playwright/test';
test('real local visitor uses D1 catalog and R2 illustrations without HTTP mocks', async ({
  page,
  request,
}, info) => {
  const health = await (await request.get('/api/health')).json();
  expect(health.gymId).toBe('gym-demo');
  const catalog = await (await request.get('/api/routes')).json();
  const activeCount = catalog.routes.length;
  expect(activeCount).toBeGreaterThanOrEqual(6);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await expect(page).toHaveTitle(/Inicio · Climbing Lab/);
  await page
    .getByRole('button', { name: 'Explorar rutas', exact: true })
    .click();
  await expect(page.locator('.route-card')).toHaveCount(activeCount);
  await page.getByLabel('Buscar', { exact: true }).fill('travesia');
  await expect(page.locator('.route-card')).toHaveCount(1);
  await page.locator('.route-card').click();
  await expect(page).toHaveURL(/ruta=demo-route-01/);
  const photo = page.locator('.route-presentation img');
  await expect(photo).toBeVisible();
  expect(
    await photo.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
    ),
  ).toBe(true);
  await expect(
    page.getByText('Sin captura 3D verificada.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Explorar en 3D', exact: true }),
  ).toHaveCount(0);
  await page.getByText('Ver beta', { exact: true }).click();
  await expect(page.getByText(/Consejo ilustrativo:/)).toBeVisible();
  await page.getByText('Compartir', { exact: true }).click();
  await expect(
    page.getByText('Enlace y QR locales: no accesibles desde internet.'),
  ).toBeVisible();
  await page.getByText('Vista previa del QR', { exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Imprimir QR público' }),
  ).toBeDisabled();
  await expect(
    page.getByText('Pendiente de verificación remota.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Descargar vista previa del QR' }),
  ).toBeEnabled();
  await page.reload();
  await expect(photo).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /Travesía tranquila V0/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/climbing-demo-detail-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto('/?ruta=demo-route-07');
  await expect(
    page.getByText('Ruta retirada. El enlace y su historial se conservan.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Guardar actividad', exact: true }),
  ).toBeDisabled();
  expect((await request.get('/api/routes/demo-route-08')).status()).toBe(401);
  expect((await request.get('/api/routes?status=borrador')).status()).toBe(401);
  expect(
    (
      await request.post('/api/routes', { data: { name: 'Forbidden' } })
    ).status(),
  ).toBe(401);
  await page.goto('/?ruta=does-not-exist');
  await expect(
    page.getByText('Ruta no encontrada o no disponible.'),
  ).toBeVisible();
  // Expected 404 from invalid route is a handled state, not a runtime failure.
  expect(
    errors.filter((e) => !e.includes('404') && !e.includes('401')),
  ).toEqual([]);
});
test('real catalog supports all widths, keyboard, empty filters and share illustration export', async ({
  page,
  request,
}, info) => {
  expect((await (await request.get('/api/health')).json()).gymId).toBe(
    'gym-demo',
  );
  const catalog = await (await request.get('/api/routes')).json();
  const activeCount = catalog.routes.length;
  const plateCount = catalog.routes.filter(
    (r: { sector: string }) => r.sector === 'Placa de ejemplo',
  ).length;
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Saltar al contenido' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    await page.getByRole('button', { name: 'Rutas', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Rutas', exact: true }),
    ).toBeFocused();
    await page
      .getByText(`Filtros ${activeCount} resultados`, { exact: true })
      .click();
    await page
      .getByRole('combobox', { name: 'Sector', exact: true })
      .selectOption('Placa de ejemplo');
    await expect(page.locator('.route-card')).toHaveCount(plateCount);
    await page
      .getByRole('button', { name: 'Limpiar filtros', exact: true })
      .click();
    await page.getByLabel('Buscar', { exact: true }).fill('no-existe');
    await expect(
      page.getByRole('heading', { name: 'No hay rutas con estos filtros' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Mostrar todas las rutas' }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/climbing-demo-catalog-${info.project.name}-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto('/?ruta=demo-route-01');
  await page.getByText('Compartir', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Preparar imagen de ruta', exact: true })
    .click();
  const preview = page.getByRole('img', {
    name: 'Vista previa exacta del archivo que se descargará',
  });
  await expect(preview).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar tarjeta (PNG)' }).click();
  expect((await download).suggestedFilename()).toBe('ruta-tarjeta.png');
});

test('real network failure preserves catalog and retry restores API reading', async ({
  page,
  request,
}) => {
  expect((await (await request.get('/api/health')).json()).gymId).toBe(
    'gym-demo',
  );
  const catalog = await (await request.get('/api/routes')).json();
  const activeCount = catalog.routes.length;
  await page.goto('/?vista=Catálogo');
  await expect(page.locator('.route-card')).toHaveCount(activeCount);
  await page.context().setOffline(true);
  await page
    .getByRole('button', { name: 'Actualizar rutas', exact: true })
    .click();
  await expect(
    page.getByText('No se pudo actualizar.', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.route-card')).toHaveCount(activeCount);
  await page.context().setOffline(false);
  await page
    .getByRole('button', { name: 'Reintentar catálogo', exact: true })
    .click();
  await expect(
    page.getByText('No se pudo actualizar.', { exact: false }),
  ).toHaveCount(0);
  await expect(page.locator('.route-card')).toHaveCount(activeCount);
});
