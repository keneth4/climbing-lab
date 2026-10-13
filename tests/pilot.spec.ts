import { test, expect } from '@playwright/test';
test('route → ascent → card, report → staff, persists on reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?ruta=equilibrio');
  await expect(page).toHaveTitle('Climbing Lab');
  await expect(
    page.getByRole('heading', { name: 'Equilibrio V2' }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Resultado', exact: true })
    .selectOption('ascenso');
  await page.getByLabel('Intentos', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Guardar actividad' }).click();
  await page
    .getByLabel('Descripción', { exact: true })
    .fill('Revisar el agarre final');
  await page.getByRole('button', { name: 'Enviar reporte' }).click();
  await page.getByRole('button', { name: 'Bitácora', exact: true }).click();
  await expect(page.getByText('Ascenso · 3 intentos')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar tarjeta personal' }).click();
  expect((await download).suggestedFilename()).toBe('equilibrio-ascenso.png');
  await page.getByLabel('Modo staff de demostración').check();
  await page.getByRole('button', { name: 'Staff', exact: true }).click();
  await expect(page.getByText('Revisar el agarre final')).toBeVisible();
  await page.getByRole('button', { name: 'Marcar resuelto' }).click();
  await expect(page.getByText('resuelto', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Bitácora', exact: true }).click();
  await expect(page.getByText('Ascenso · 3 intentos')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('QR download and invalid route fallback', async ({ page }) => {
  await page.goto('/?ruta=travesia');
  await page.getByText('QR de la ruta', { exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar QR' }).click();
  expect((await download).suggestedFilename()).toBe('travesia-qr.png');
  await page.goto('/?ruta=no-existe');
  await expect(
    page.getByRole('heading', { name: 'Ruta no encontrada' }),
  ).toBeVisible();
});
test('loads a Gaussian PLY, saves camera and exports rendered view', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByLabel('Modo staff de demostración').check();
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
    const values = [
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
    ];
    values.forEach((v, j) => body.writeFloatLE(v, (i * props.length + j) * 4));
  }
  await input.setInputFiles({
    name: 'fixture.ply',
    mimeType: 'application/octet-stream',
    buffer: Buffer.concat([header, body]),
  });
  await expect(page.getByText('fixture.ply · 0 MB · vista local')).toBeVisible({
    timeout: 30000,
  });
  await page
    .getByRole('button', { name: 'Guardar cámara para esta ruta' })
    .click();
  await expect(
    page.getByText(
      'Cámara guardada. Se aplica al cargar el mismo archivo local.',
    ),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar vista 3D' }).click();
  expect((await download).suggestedFilename()).toBe('captura-3d.png');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/climbing-lab-${test.info().project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
