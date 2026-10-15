import { test, expect } from '@playwright/test';
import { gaussianFixture } from './fixtures';
import { polygonBounds } from '../shared/sections';
test('admin uploads one complete scene, previews and publishes it', async ({
  page,
}) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(5000);
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
  const sectionHistories: Record<string, any[]> = {};
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
    else if (path === '/api/routes')
      json = {
        routes:
          new URL(route.request().url()).searchParams.get('status') ===
          'retirada'
            ? []
            : [
                {
                  id: 'legacy-demo',
                  name: 'Demo',
                  grade: 'V1',
                  sector: 'Spray wall',
                  status: 'activa',
                },
              ],
      };
    else if (path === '/api/routes/legacy-demo')
      json = {
        revision: 1,
        status: 'activa',
        snapshot: { name: 'Demo', holds: [] },
      };
    else if (path === '/api/entries') json = { entries: [] };
    else if (path === '/api/staff/reports') json = { reports: [] };
    else if (path === '/api/sections' && method === 'POST') {
      const b = route.request().postDataJSON();
      sections.push({
        geometry: b.geometry || null,
        kind: b.kind || 'wall',
        id: 'section-' + (sections.length + 1),
        revision: 1,
        name: b.name,
        bounds: b.geometry
          ? polygonBounds(b.geometry)
          : { min: b.min, max: b.max },
      });
      const r = sections.at(-1);
      sectionHistories[r.id] = [
        { revision: 1, section: structuredClone(r), createdAt: '2026-10-12' },
      ];
      json = { id: r.id, revision: 1 };
    } else if (/^\/api\/sections\/[^/]+$/.test(path) && method === 'PUT') {
      const b = route.request().postDataJSON(),
        id = path.split('/')[3],
        r = sections.find((r) => r.id === id);
      expect(b.expectedRevision).toBe(r.revision);
      Object.assign(r, {
        name: b.name,
        kind: b.kind,
        bounds: b.geometry
          ? polygonBounds(b.geometry)
          : { min: b.min, max: b.max },
        geometry: b.geometry || null,
        revision: r.revision + 1,
      });
      sectionHistories[id].unshift({
        revision: r.revision,
        section: structuredClone(r),
        createdAt: '2026-10-12',
      });
      json = { id: r.id, section: r };
    } else if (path.endsWith('/revisions'))
      json = { revisions: sectionHistories[path.split('/')[3]] || [] };
    else if (path === '/api/sections') json = { sections };
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
  await page.goto('/?vista=Catálogo');
  await page.getByRole('button', { name: 'Staff', exact: true }).click();
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
  await page.getByRole('button', { name: 'Staff', exact: true }).click();
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
  const zoneStep = async (step: number) => {
    await page
      .getByRole('combobox', { name: 'Paso de zona', exact: true })
      .selectOption(String(step));
  };
  const reviewZone = async () => {
    await zoneStep(4);
    await page
      .getByLabel('Revisé la superficie y el volumen desde dos ángulos')
      .check();
  };
  await page.getByRole('button', { name: 'Preparar sección visual' }).click();
  await zoneStep(1);
  await page
    .getByLabel('Nombre de sección', { exact: true })
    .fill('Spray izquierda');
  await zoneStep(3);
  await page.getByLabel('Centro X', { exact: true }).fill('0.25');
  await page.getByLabel('Tamaño X', { exact: true }).fill('0.5');
  await reviewZone();
  await page
    .getByRole('button', { name: 'Crear sección', exact: true })
    .click();
  await expect(
    page.getByText(
      'Zona guardada. Las rutas anteriores conservan su revisión histórica.',
    ),
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
  await page.locator('canvas').click({
    position: {
      x: canvasBox!.width / 2 - capture.initialCamera.target[0] * pixelsPerUnit,
      y:
        canvasBox!.height / 2 + capture.initialCamera.target[1] * pixelsPerUnit,
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
    .getByRole('button', { name: 'Delimitar con vértices', exact: true })
    .click();
  await zoneStep(1);
  await page
    .getByLabel('Nombre de sección', { exact: true })
    .fill('Contorno prueba');
  await zoneStep(3);
  await page
    .getByRole('button', { name: 'Añadir vértices', exact: true })
    .click();

  for (const [x, y] of [
    [0.4, 0.4],
    [-0.4, 0.4],
    [-0.4, -0.4],
    [0.4, -0.4],
  ]) {
    const box = await page.locator('canvas').boundingBox();
    const ratio =
      box!.height /
      (2 * Math.tan(Math.PI / 8) * capture.initialCamera.distance);
    await page.locator('canvas').click({
      position: {
        x: box!.width / 2 + (x - capture.initialCamera.target[0]) * ratio,
        y: box!.height / 2 - (y - capture.initialCamera.target[1]) * ratio,
      },
    });
  }
  await expect(
    page.getByRole('button', { name: 'Eliminar vértice 4', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Cerrar contorno', exact: true })
    .click();
  await reviewZone();
  await page
    .getByRole('button', { name: 'Crear sección', exact: true })
    .click();
  await expect.poll(() => sections.length).toBe(2);
  expect(sections[1].geometry.vertices).toHaveLength(4);
  expect(
    sections[1].geometry.vertices
      .flat()
      .every((n: number) => Number.isFinite(n)),
  ).toBe(true);
  await page
    .getByLabel('Mostrar sección en la vista')
    .selectOption(sections[0].id);
  await page
    .getByRole('button', { name: 'Editar sección seleccionada' })
    .click();
  await page
    .getByLabel('Nombre de sección', { exact: true })
    .fill('Cancelled name');
  await page
    .getByRole('button', { name: 'Cancelar edición de sección' })
    .click();
  expect(sections[0].revision).toBe(1);
  expect(sections[0].name).toBe('Spray izquierda');
  await page
    .getByRole('button', { name: 'Editar sección seleccionada' })
    .click();
  await page
    .getByLabel('Nombre de sección', { exact: true })
    .fill('Spray revisada');
  await zoneStep(3);
  await page.getByLabel('Centro X', { exact: true }).fill('0.3');
  await page
    .locator('.section-editor')
    .filter({
      has: page.getByRole('heading', {
        name: 'Definir sección estable',
        exact: true,
      }),
    })
    .screenshot({ path: `/tmp/section-edit-${test.info().project.name}.png` });
  await reviewZone();
  await page
    .getByRole('button', { name: 'Guardar cambios de sección' })
    .click();
  await expect.poll(() => sections[0].revision).toBe(2);
  expect(sections[0].id).toBe('section-1');
  await page.getByRole('button', { name: 'Ver historial de sección' }).click();
  await page.getByText('Historial de sección', { exact: true }).click();
  await expect(
    page.getByText('Revisión 1 · Spray izquierda', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Preparar esta revisión para restaurar' })
    .last()
    .click();
  await reviewZone();
  await page
    .getByRole('button', { name: 'Guardar cambios de sección' })
    .click();
  await expect.poll(() => sections[0].revision).toBe(3);
  expect(sections[0].name).toBe('Spray izquierda');
  // Oriented contour uses real Gaussian picking, not injected geometry.
  await page
    .getByRole('button', { name: 'Plano inclinado · tres puntos', exact: true })
    .click();
  await zoneStep(1);
  await page
    .getByLabel('Nombre de sección', { exact: true })
    .fill('Plano D04 sintético');
  await zoneStep(2);
  const pickAt = async (x: number, y: number) => {
    const box = await page.locator('canvas').boundingBox();
    const ratio =
      box!.height /
      (2 * Math.tan(Math.PI / 8) * capture.initialCamera.distance);
    await page.locator('canvas').click({
      position: {
        x: box!.width / 2 + (x - capture.initialCamera.target[0]) * ratio,
        y: box!.height / 2 - (y - capture.initialCamera.target[1]) * ratio,
      },
    });
  };
  await pickAt(-0.6, 0.6);
  await pickAt(0.6, 0.6);
  await pickAt(-0.6, 0.2);
  await expect(
    page.getByText('Plano definido. Continúa al contorno.', { exact: true }),
  ).toBeVisible();
  await zoneStep(3);
  await page
    .getByRole('button', { name: 'Añadir vértices', exact: true })
    .click();
  await pickAt(-0.6, 0.6);
  await pickAt(0.6, 0.6);
  await pickAt(0.6, 0.2);
  await pickAt(-0.6, 0.2);
  await page
    .getByRole('button', { name: 'Terminar de añadir', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Seleccionar vértice 1', exact: true })
    .click();
  await page.getByRole('button', { name: 'Aumentar U', exact: true }).click();
  await page
    .getByRole('button', { name: 'Cancelar ajuste', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Seleccionar vértice 1', exact: true })
    .click();
  await page.getByRole('button', { name: 'Aumentar U', exact: true }).click();
  await page
    .getByRole('button', { name: 'Aplicar ajuste', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Deshacer zona', exact: true })
    .click();
  await page.getByRole('button', { name: 'Rehacer zona', exact: true }).click();
  await page
    .getByRole('button', { name: 'Cerrar contorno', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Vista perpendicular', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Restaurar cámara', exact: true })
    .click();
  await reviewZone();
  await page
    .getByRole('button', { name: 'Crear sección', exact: true })
    .click();
  await expect.poll(() => sections.length).toBe(3);
  expect(sections[2].geometry.type).toBe('oriented-polygon');
  expect(sections[2].geometry.verticesUV).toHaveLength(4);
  await expect(
    page.getByText('Esta ruta aún no está vinculada al clon.', {
      exact: false,
    }),
  ).toBeVisible();
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
