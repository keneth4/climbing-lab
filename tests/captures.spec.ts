import { test, expect } from '@playwright/test';
import { gaussianFixture } from './fixtures';
test('admin uploads one complete scene, previews and publishes it', async ({
  page,
}) => {
  const exp = Math.floor(Date.now() / 1000) + 3600,
    token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'owner', exp })).toString('base64url')}.test`;
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
            id: 'owner',
            email: 'owner@example.com',
            aud: 'authenticated',
            app_metadata: { provider: 'email' },
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      ),
    { token, exp },
  );
  let capture: any = null,
    active: any = null,
    generation = 0;
  let parts = 0;
  let sections: any[] = [];
  let fiducials: any[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname,
      method = route.request().method();
    let json: any = {};
    if (path.includes('/file/scene.ply')) {
      await route.fulfill({
        body: gaussianFixture(),
        contentType: 'application/octet-stream',
      });
      return;
    }
    if (path === '/api/me') json = { userId: 'owner', staff: 'admin' };
    else if (path === '/api/routes') json = { routes: [] };
    else if (path === '/api/entries') json = { entries: [] };
    else if (path === '/api/staff/reports') json = { reports: [] };
    else if (path === '/api/sections' && method === 'POST') {
      const b = route.request().postDataJSON();
      sections.push({
        id: 'section-test',
        name: b.name,
        bounds: { min: b.min, max: b.max },
      });
      json = { id: 'section-test' };
    } else if (path === '/api/sections') json = { sections };
    else if (path === '/api/fiducials' && method === 'POST') {
      const b = route.request().postDataJSON();
      fiducials.push({
        id: 'reference-test',
        label: b.label,
        position: b.position,
      });
      json = { id: 'reference-test' };
    } else if (path === '/api/fiducials') json = { fiducials };
    else if (path === '/api/captures/current')
      json = { capture: active, generation };
    else if (path === '/api/captures' && method === 'POST') {
      const payload = route.request().postDataJSON();
      capture = {
        id: 'capture-test',
        filename: payload.filename,
        size: payload.size,
        status: 'draft',
        upload_state: 'uploading',
        version: 1,
        transform: { scale: 1, rotation: [0, 0, 1, 0], translation: [0, 0, 0] },
        alignment: null,
        fileUrl: '/api/captures/capture-test/file/scene.ply',
      };
      json = { id: capture.id, partSize: 10 * 1024 * 1024 };
    } else if (path === '/api/captures')
      json = {
        captures: capture ? [capture] : [],
        state: { generation, active_capture_id: active?.id || null },
      };
    else if (path.includes('/parts/')) {
      parts++;
      json = { part: 1 };
    } else if (path.endsWith('/complete')) {
      capture.upload_state = 'ready';
      json = { capture };
    } else if (path.endsWith('/camera')) {
      const b = route.request().postDataJSON();
      expect(b.expectedVersion).toBe(capture.version);
      capture.initialCamera = b.camera;
      capture.version++;
      json = { capture };
    } else if (path.endsWith('/publish')) {
      expect(route.request().postDataJSON().reviewedAlignment).toBe(true);
      capture.status = 'published';
      active = capture;
      generation++;
      json = { capture };
    }
    await route.fulfill({ json });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Capturas', exact: true }).click();
  await page.getByLabel('Subir un splat completo').setInputFiles({
    name: 'fixture.ply',
    mimeType: 'application/octet-stream',
    buffer: gaussianFixture(),
  });
  await expect(
    page.getByText('Captura completa subida como borrador.'),
  ).toBeVisible();
  await expect(
    page.getByText('fixture.ply · 0 MB · captura del gimnasio'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Publicar actualización completa' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Acercar', exact: true }).click();
  await page
    .getByRole('button', { name: 'Guardar cámara inicial del gimnasio' })
    .click();
  await expect(
    page.getByText('Cámara inicial del gimnasio guardada.', { exact: true }),
  ).toBeVisible();
  expect(capture.initialCamera.distance).toBeGreaterThan(0);
  const initialCamera = structuredClone(capture.initialCamera);
  await page.reload();
  await page.getByRole('button', { name: 'Capturas', exact: true }).click();
  await expect(
    page.getByText('Cámara inicial del gimnasio guardada.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Acercar', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Guardar cámara inicial del gimnasio' })
    .click();
  await expect.poll(() => capture.version).toBe(3);
  expect(capture.initialCamera).toEqual(initialCamera);
  await page.getByRole('button', { name: 'Preparar sección visual' }).click();
  await page
    .getByLabel('Nombre de sección', { exact: true })
    .fill('Spray izquierda');
  await page.getByLabel('Centro X', { exact: true }).fill('0.25');
  await page.getByLabel('Tamaño X', { exact: true }).fill('0.5');
  await page
    .getByRole('button', { name: 'Crear sección', exact: true })
    .click();
  await expect(
    page.getByText('Sección guardada en las coordenadas del gimnasio.'),
  ).toBeVisible();
  expect(sections[0].bounds.min[0]).toBe(0);
  expect(sections[0].bounds.max[0]).toBe(0.5);
  await page.locator('canvas').scrollIntoViewIfNeeded();
  await page
    .getByRole('button', { name: 'Seleccionar punto', exact: true })
    .click();
  const canvasBox = await page.locator('canvas').boundingBox();
  const pixelsPerUnit =
    canvasBox!.height /
    (2 * Math.tan(Math.PI / 8) * capture.initialCamera.distance);
  await page
    .locator('canvas')
    .click({
      position: {
        x:
          canvasBox!.width / 2 -
          capture.initialCamera.target[0] * pixelsPerUnit,
        y:
          canvasBox!.height / 2 +
          capture.initialCamera.target[1] * pixelsPerUnit,
      },
    });
  await expect(
    page.getByRole('heading', { name: 'Confirmar posición seleccionada' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Usar como referencia permanente' })
    .click();
  await page
    .getByLabel('Nombre de referencia', { exact: true })
    .fill('Referencia prueba');
  await page
    .getByRole('button', { name: 'Crear referencia', exact: true })
    .click();
  await expect.poll(() => fiducials.length).toBe(1);
  expect(fiducials[0].position.every(Number.isFinite)).toBe(true);
  await page
    .getByRole('button', {
      name: 'Usar punto seleccionado para Referencia prueba',
    })
    .click();
  await expect(page.getByPlaceholder('X, Y, Z de la captura')).not.toHaveValue(
    '',
  );
  await page
    .getByLabel('Revisé visualmente la alineación y la captura completa')
    .check();
  await page
    .getByRole('button', { name: 'Publicar actualización completa' })
    .click();
  await expect(
    page.getByText('Captura publicada. Las rutas se actualizaron por sección.'),
  ).toBeVisible();
  expect(parts).toBe(1);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/climbing-twin-${test.info().project.name}.png`,
    fullPage: true,
  });
});
