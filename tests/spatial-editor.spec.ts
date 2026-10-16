import { test, expect, type Page } from '@playwright/test';
import { gaussianFixture, editorStep as go } from './fixtures';
const original = {
  id: 'route-spatial',
  revision: 1,
  name: 'Ruta espacial P0',
  grade: 'V1',
  gradeScale: 'V',
  sector: 'Muro',
  status: 'borrador',
  sectionId: 'section-p0',
  captureId: 'capture-p0',
  rules: 'Prueba aislada',
  beta: '',
  holds: [],
  holds3D: [
    { id: 'start', role: 'inicio', position: [0, 0, 0] },
    { id: 'finish', role: 'final', position: [0.2, 0.2, 0] },
  ],
  imageId: 'image-original',
  markersVerified: true,
  camera: {
    captureId: 'capture-p0',
    yaw: 0,
    pitch: 0,
    distance: 4,
    target: [0, 0, 0],
  },
};
async function setup(page: Page, published = false, sectionUpdated = false) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token =
    'eyJhbGciOiJIUzI1NiJ9.' +
    Buffer.from(
      JSON.stringify({ sub: 'spatial-test', exp, aud: 'authenticated' }),
    ).toString('base64url') +
    '.test';
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
            id: 'spatial-test',
            email: 'fixture@example.com',
            app_metadata: { provider: 'email' },
            user_metadata: {},
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          },
        }),
      ),
    { token, exp },
  );
  const state = {
    route: {
      ...structuredClone(original),
      status: published ? 'activa' : 'borrador',
    },
    errorStatus: 0,
    errorMessage: '',
    failAsset: false,
    assetRequests: 0,
    delay: 0,
    writes: [] as any[],
    images: [] as any[],
    imageBuffers: [] as Buffer[],
  };
  await page.route('**/api/**', async (handler) => {
    const url = new URL(handler.request().url()),
      path = url.pathname,
      method = handler.request().method();
    if (path.includes('/file/scene.ply')) {
      state.assetRequests += 1;
      if (state.failAsset) {
        await handler.fulfill({ status: 503, body: 'Asset unavailable' });
        return;
      }
      await handler.fulfill({
        body: gaussianFixture(),
        contentType: 'application/octet-stream',
      });
      return;
    }
    if (path.startsWith('/api/route-images') && method === 'GET') {
      await handler.fulfill({
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4V8AAAAASUVORK5CYII=',
          'base64',
        ),
        contentType: 'image/png',
      });
      return;
    }
    let payload: any = {};
    if (path === '/api/me')
      payload = { userId: 'spatial-test', staff: 'editor' };
    if (path === '/api/routes')
      payload = {
        routes:
          url.searchParams.get('status') === state.route.status
            ? [state.route]
            : [],
      };
    if (path === `/api/routes/${original.id}`) {
      if (method === 'PUT') {
        if (state.delay)
          await new Promise((resolve) => setTimeout(resolve, state.delay));
        if (state.errorStatus) {
          await handler.fulfill({
            status: state.errorStatus,
            json: {
              error:
                state.errorMessage ||
                (state.errorStatus === 409
                  ? 'Conflicto de revisión'
                  : 'Error de red temporal'),
            },
          });
          return;
        }
        const body = handler.request().postDataJSON();
        state.writes.push(body);
        state.route = {
          ...state.route,
          ...body,
          revision: state.route.revision + 1,
        };
      }
      payload = {
        id: state.route.id,
        revision: state.route.revision,
        status: state.route.status,
        snapshot: state.route,
      };
    }
    if (path === '/api/sections')
      payload = {
        sections: ['section-p0', 'section-other'].map((id) => ({
          id,
          name: id === 'section-p0' ? 'Muro' : 'Otra sección',
          bounds: { min: [-2, -2, -1], max: [2, 2, 1] },
          revision: sectionUpdated && id === 'section-p0' ? 2 : 1,
          ...(sectionUpdated && id === 'section-p0'
            ? {
                kind: 'accessible-area',
                bounds: { min: [10, 10, 10], max: [20, 20, 20] },
              }
            : {}),
        })),
      };
    if (path === '/api/sections/section-p0/revisions/1')
      payload = {
        section: {
          id: 'section-p0',
          name: 'Muro histórico',
          revision: 1,
          kind: 'wall',
          bounds: { min: [-2, -2, -1], max: [2, 2, 1] },
        },
      };
    if (path === '/api/captures/current')
      payload = {
        capture: {
          id: 'capture-p0',
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
          initialCamera: original.camera,
          fileUrl: '/api/captures/capture-p0/file/scene.ply',
        },
      };
    if (path === '/api/route-images' && method === 'POST') {
      state.images.push(
        JSON.parse(handler.request().headers()['x-presentation']),
      );
      state.imageBuffers.push(handler.request().postDataBuffer()!);
      payload = { id: 'image-new' };
    }
    if (path === '/api/entries') payload = { entries: [] };
    if (path === '/api/projects') payload = { projects: [] };
    if (path === '/api/staff/reports') payload = { reports: [] };
    await handler.fulfill({ json: payload });
  });
  await page.goto(`/?ruta=${original.id}`);
  await expect(page.getByText('Permisos confirmados · Staff')).toBeVisible();
  await page.getByRole('button', { name: 'Editar ruta', exact: true }).click();
  await expect(
    page.getByRole('combobox', { name: 'Sección', exact: true }),
  ).toHaveValue('section-p0');
  await go(page, 3);
  return state;
}
const verified = (page: Page) =>
  page.getByLabel(
    'Confirmé todos los agarres desde dos ángulos y el inicio/final son legibles',
  );
test('inspection, cancellation and identical apply preserve backup and verified geometry', async ({
  page,
}) => {
  const state = await setup(page);
  await page
    .getByRole('button', { name: 'Ajustar agarre 1', exact: true })
    .click();
  await expect(verified(page)).toBeChecked();
  await page
    .locator('summary')
    .filter({ hasText: /^Ajustar posición del agarre 1$/ })
    .click();
  await page
    .getByRole('button', { name: 'Agarre 1: aumentar X', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'Rol del agarre 1', exact: true })
    .selectOption('final');
  await page
    .getByRole('button', { name: 'Cancelar ajuste', exact: true })
    .click();
  await expect(verified(page)).toBeChecked();
  await page
    .getByRole('button', { name: 'Ajustar agarre 1', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Aplicar ajuste', exact: true })
    .click();
  await expect(
    page.getByText('Sin cambios: respaldo y verificación conservados.', {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Guardar borrador', exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].imageId).toBe('image-original');
  expect(state.writes[0].markersVerified).toBe(true);
  expect(state.writes[0].holds3D).toEqual(original.holds3D);
});
test('applied edits, undo/redo and section changes preserve transaction boundaries', async ({
  page,
}) => {
  const state = await setup(page);
  await page
    .getByRole('button', { name: 'Ajustar agarre 1', exact: true })
    .click();
  await page
    .locator('summary')
    .filter({ hasText: /^Ajustar posición del agarre 1$/ })
    .click();
  await page
    .getByRole('combobox', { name: 'Paso de ajuste', exact: true })
    .selectOption('0.001');
  await page
    .getByRole('button', { name: 'Agarre 1: aumentar X', exact: true })
    .press('ArrowRight');
  await page
    .getByRole('button', { name: 'Aplicar ajuste', exact: true })
    .click();
  await expect(verified(page)).not.toBeChecked();
  await page
    .getByRole('button', { name: 'Deshacer marcador', exact: true })
    .click();
  await expect(
    page.getByText(
      'Geometría restaurada; respaldo y verificación pendientes.',
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Rehacer marcador', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Ajustar agarre 1', exact: true })
    .click();
  await page
    .locator('summary')
    .filter({ hasText: /^Ajustar posición del agarre 1$/ })
    .click();
  await page
    .getByRole('button', { name: 'Agarre 1: aumentar X', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Cancelar ajuste', exact: true })
    .click();
  await go(page, 1);
  await page
    .getByRole('combobox', { name: 'Sección', exact: true })
    .selectOption('section-other');
  await page
    .getByRole('button', { name: 'Guardar borrador', exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].holds3D[0].position[0]).toBe(0.001);
  expect(state.writes[0].imageId).toBe('');
  expect(state.writes[0].markersVerified).toBe(false);
});
for (const dpr of [1, 2, 3])
  test.describe(`CSS mapping DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr });
    test('candidate, labels, focus and annotated backup share the same scene', async ({
      page,
    }, info) => {
      // Eight responsive/theme screenshots at DPR 3 need a larger total budget
      // when this matrix shares GPU time with the rest of the browser suite.
      test.setTimeout(60000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const state = await setup(page);
      await page
        .getByRole('button', { name: 'Preparar agarres en 3D', exact: true })
        .click();
      await expect(
        page.getByText('fixture.ply · 0 MB · captura del gimnasio', {
          exact: true,
        }),
      ).toBeVisible();
      const canvas = page.getByLabel('Visor de Gaussian Splatting', {
        exact: true,
      });
      const first = await canvas.elementHandle();
      await page
        .getByRole('button', { name: 'Seleccionar punto', exact: true })
        .click();
      await canvas.press('Escape');
      await expect(
        page.getByText('Modo: Explorar', { exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Seleccionar punto', exact: true })
        .click();
      const box = (await canvas.boundingBox())!;
      await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
      await expect(
        page.getByRole('img', { name: 'Punto en preparación', exact: true }),
      ).toBeVisible();
      const anchor = page.locator('.route-marker-overlay circle').last();
      expect(
        Math.abs(Number(await anchor.getAttribute('cx')) - box.width / 2),
      ).toBeLessThan(16);
      expect(
        Math.abs(Number(await anchor.getAttribute('cy')) - box.height / 2),
      ).toBeLessThan(16);
      await page
        .getByRole('combobox', { name: 'Función del agarre', exact: true })
        .selectOption('intermedio');
      await page
        .getByRole('button', { name: 'Añadir agarre a la ruta', exact: true })
        .click();
      if (info.project.name === 'mobile') {
        // Medium sheet may leave no room for three nearby 48px targets.
        // Keep all anchors; compact exposes more scene without resizing it.
        await expect(page.locator('.route-marker-overlay circle')).toHaveCount(
          3,
        );
        await page
          .getByRole('button', { name: 'Compacto', exact: true })
          .click();
      }
      await expect(
        page.getByRole('button', {
          name: 'Seleccionar agarre · Agarre intermedio',
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole('combobox', { name: 'Etiquetas de agarres', exact: true })
        .selectOption('hidden');
      await expect(
        page.getByRole('button', {
          name: 'Seleccionar agarre · Agarre intermedio',
          exact: true,
        }),
      ).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Ajustar agarre 3', exact: true })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Seleccionar agarre · Agarre intermedio',
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Cancelar ajuste', exact: true })
        .click();
      await page
        .getByRole('combobox', { name: 'Etiquetas de agarres', exact: true })
        .selectOption('all');
      await page
        .getByRole('button', {
          name: 'Seleccionar agarre · Agarre intermedio',
          exact: true,
        })
        .focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByText('Editar agarre 3 · cambios temporales', { exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', {
          name: 'Acercar al punto seleccionado',
          exact: true,
        })
        .click();
      await page
        .getByRole('button', { name: 'Cancelar ajuste', exact: true })
        .click();
      await expect(
        page.getByText('Modo: Explorar', { exact: true }),
      ).toBeVisible();
      expect(
        await first!.evaluate((n) => n === document.querySelector('canvas')),
      ).toBe(true);
      const pin = page.locator('.route-marker-overlay circle').nth(1);
      const anchorCss = {
        x: Number(await pin.getAttribute('cx')),
        y: Number(await pin.getAttribute('cy')),
      };
      const viewport = (await canvas.boundingBox())!;
      await go(page, 5);
      await page
        .getByRole('button', {
          name: 'Usar vista anotada como respaldo',
          exact: true,
        })
        .click();
      await expect.poll(() => state.images.length).toBe(1);
      expect(state.images[0].holds).toHaveLength(3);
      expect(state.images[0].camera.captureId).toBe('capture-p0');
      const actualPixel = await page.evaluate(
        async ({ bytes, anchor, viewport }) => {
          const image = await createImageBitmap(
            new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
          );
          const output = document.createElement('canvas');
          output.width = image.width;
          output.height = image.height;
          const context = output.getContext('2d')!;
          context.drawImage(image, 0, 0);
          return Array.from(
            context.getImageData(
              Math.round((anchor.x * image.width) / viewport.width),
              Math.round((anchor.y * image.height) / viewport.height),
              1,
              1,
            ).data,
          ).slice(0, 3);
        },
        {
          bytes: Array.from(state.imageBuffers[0]),
          anchor: anchorCss,
          viewport,
        },
      );
      expect(actualPixel).toEqual([152, 65, 21]); // Final anchor uses the same location/color in DOM and PNG.

      await page.screenshot({
        path: `/tmp/p0-${info.project.name}-dpr${dpr}.png`,
      });
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const theme of ['first', 'second']) {
          await expect
            .poll(async () => {
              const c = (await canvas.boundingBox())!;
              const a = (await page
                .locator('.route-marker-overlay circle')
                .first()
                .boundingBox())!;
              return (
                Math.abs(a.x + a.width / 2 - (c.x + c.width / 2)) +
                Math.abs(a.y + a.height / 2 - (c.y + c.height / 2))
              );
            })
            .toBeLessThan(2);
          await page.screenshot({
            path: `/tmp/p0-dpr${dpr}-${width}-${theme}-${info.project.name}.png`,
          });
          await page
            .getByRole('button', { name: 'Cambiar tema', exact: true })
            .click();
        }
      }

      expect(errors).toEqual([]);
    });
  });

test('marker anchors survive resize, themes, inspector scroll and CSS zoom without moving the renderer', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await setup(page);
  await page
    .getByRole('button', { name: 'Preparar agarres en 3D', exact: true })
    .click();
  await expect(
    page.getByText('fixture.ply · 0 MB · captura del gimnasio', {
      exact: true,
    }),
  ).toBeVisible();
  const canvas = page.getByLabel('Visor de Gaussian Splatting', {
    exact: true,
  });
  const checkMapping = async () => {
    await expect
      .poll(async () => {
        const c = (await canvas.boundingBox())!;
        const a = (await page
          .locator('.route-marker-overlay circle')
          .first()
          .boundingBox())!;
        return (
          Math.abs(a.x + a.width / 2 - (c.x + c.width / 2)) +
          Math.abs(a.y + a.height / 2 - (c.y + c.height / 2))
        );
      })
      .toBeLessThan(2);
    // CSS zoom can center the old overlay before the next frame updates label clipping.
    await expect(page.locator('.route-marker-overlay button')).toHaveCount(2);
    const boxes = await page
      .locator('.route-marker-overlay button')
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }),
      );
    expect(boxes).toHaveLength(2);
    expect(boxes.every((b) => b.width >= 44 && b.height >= 44)).toBe(true);
    expect(
      boxes[0].x + boxes[0].width <= boxes[1].x ||
        boxes[1].x + boxes[1].width <= boxes[0].x ||
        boxes[0].y + boxes[0].height <= boxes[1].y ||
        boxes[1].y + boxes[1].height <= boxes[0].y,
    ).toBe(true);
  };
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['first', 'second']) {
      await checkMapping();
      await page.screenshot({
        path: `/tmp/p0-layout-${info.project.name}-${width}-${theme}.png`,
      });
      await page
        .getByRole('button', { name: 'Cambiar tema', exact: true })
        .click();
    }
  }
  await page.evaluate(
    () => (document.getElementById('tools-panel')!.scrollTop += 150),
  );
  await checkMapping();
  await page.evaluate(() => (document.documentElement.style.zoom = '2'));
  await checkMapping();
  await page.screenshot({ path: `/tmp/p0-zoom-${info.project.name}.png` });
});

test('guided steps preserve published preparation locally and require explicit conflict review', async ({
  page,
}) => {
  const state = await setup(page, true);
  await go(page, 1);
  await page
    .getByLabel('Nombre de ruta', { exact: true })
    .fill('Preparación conservada');
  await page
    .getByRole('button', { name: 'Conservar preparación local', exact: true })
    .click();
  expect(state.writes).toHaveLength(0);
  expect(state.route.name).toBe(original.name);
  await go(page, 6);
  await expect(
    page.getByRole('heading', { name: 'Revisar y publicar' }),
  ).toBeFocused();
  await expect(
    page.getByText('Diferencias frente a la versión guardada: Nombre.', {
      exact: true,
    }),
  ).toBeVisible();
  state.errorStatus = 409;
  await page
    .getByRole('button', { name: 'Actualizar ruta', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Actualizar ruta', exact: true }),
  ).toBeDisabled();
  state.route.revision = 2;
  state.route.name = 'Cambio concurrente';
  state.errorStatus = 0;
  await page
    .getByRole('button', { name: 'Recargar versión guardada', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Editar ruta · Cambio concurrente',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre de ruta', { exact: true })).toHaveValue(
    'Preparación conservada',
  );
  await go(page, 6);
  await expect(
    page.getByRole('button', { name: 'Actualizar ruta', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', {
      name: 'Revisé la nueva revisión y las diferencias',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: 'Actualizar ruta', exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].expectedRevision).toBe(2);
  expect(state.writes[0].name).toBe('Preparación conservada');
  await page.getByRole('button', { name: 'Editar ruta', exact: true }).click();
  await expect(
    page.getByText('Sin cambios pendientes', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Preparación basada en revisión', { exact: false }),
  ).toHaveCount(0);
});

test('temporary tools block step changes, Escape restores focus and keyboard undo avoids inputs', async ({
  page,
}) => {
  const state = await setup(page);
  const origin = page.getByRole('button', {
    name: 'Ajustar agarre 1',
    exact: true,
  });
  await origin.click();
  await go(page, 2);
  await expect(page.locator('.route-editor')).toHaveAttribute('data-step', '3');
  await page
    .getByRole('combobox', { name: 'Rol del agarre 1', exact: true })
    .selectOption('final');
  await page
    .getByRole('combobox', { name: 'Rol del agarre 1', exact: true })
    .press('Escape');
  await expect(origin).toBeFocused();
  await expect(verified(page)).toBeChecked();
  await origin.click();
  await page
    .getByRole('combobox', { name: 'Rol del agarre 1', exact: true })
    .selectOption('final');
  await page
    .getByRole('button', { name: 'Aplicar ajuste', exact: true })
    .click();
  await origin.press('ControlOrMeta+z');
  await expect(verified(page)).not.toBeChecked();
  await origin.press('ControlOrMeta+Shift+z');
  await go(page, 1);
  const input = page.getByLabel('Nombre de ruta', { exact: true });
  await input.fill('Texto editable');
  await input.press('ControlOrMeta+z');
  await page
    .getByRole('button', { name: 'Guardar borrador', exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].holds3D[0].role).toBe('final');
});

test('incomplete draft saves, publication blockers link to steps and errors retain work', async ({
  page,
}) => {
  const state = await setup(page);
  await go(page, 1);
  await page.getByLabel('Nombre de ruta', { exact: true }).fill('');
  await go(page, 6);
  await expect(
    page.getByRole('button', { name: 'Publicar ruta', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Nombre · Ir a Datos', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Datos de la ruta', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByLabel('Nombre de ruta', { exact: true }),
  ).toHaveAttribute('aria-invalid', 'true');
  state.errorStatus = 503;
  await page
    .getByRole('button', { name: 'Guardar borrador', exact: true })
    .click();
  await expect(
    page.getByText('Error de red temporal', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre de ruta', { exact: true })).toHaveValue(
    '',
  );
  state.errorStatus = 0;
  state.delay = 300;
  const button = page.getByRole('button', {
    name: 'Guardar borrador',
    exact: true,
  });
  await button.click();
  await expect(
    page.getByRole('button', { name: 'Guardando…', exact: true }),
  ).toBeDisabled();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].status).toBe('borrador');
  expect(state.writes[0].name).toBe('');
});

test('step navigation and mobile sheet heights retain one canvas, with usable no-WebGL fallback', async ({
  page,
}, info) => {
  page.setDefaultTimeout(5000);
  await setup(page);
  await page
    .getByRole('button', { name: 'Preparar agarres en 3D', exact: true })
    .click();
  const canvas = page.getByLabel('Visor de Gaussian Splatting', {
    exact: true,
  });
  await expect(
    page.getByText('fixture.ply · 0 MB · captura del gimnasio', {
      exact: true,
    }),
  ).toBeVisible();
  const first = await canvas.elementHandle();
  const before = await canvas.boundingBox();
  for (const step of [
    /^2\. Encuadre/,
    /^4\. Verificación/,
    /^5\. Imagen/,
    /^6\. Publicar/,
    /^3\. Agarres/,
  ]) {
    await go(page, Number(step.source[1]));
    expect(
      await first!.evaluate((n) => n === document.querySelector('canvas')),
    ).toBe(true);
    expect(await canvas.boundingBox()).toEqual(before);
  }
  if (info.project.name === 'mobile') {
    for (const label of ['Compacto', 'Medio', 'Ampliado']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      expect(await canvas.boundingBox()).toEqual(before);
      await expect
        .poll(async () => {
          const top = (await page.locator('#tools-panel').boundingBox())!.y;
          return page
            .locator('.route-marker-overlay button')
            .evaluateAll(
              (nodes, top) =>
                nodes.every((n) => n.getBoundingClientRect().bottom <= top + 1),
              top,
            );
        })
        .toBe(true);
    }
  }
  await page
    .getByRole('button', { name: 'Cerrar preparación 3D', exact: true })
    .click();
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      kind: any,
      ...args: any[]
    ) {
      if (String(kind).startsWith('webgl')) return null;
      return (original as any).call(this, kind, ...args);
    } as any;
  });
  await page.reload();
  await go(page, 2);
  await page
    .getByRole('button', { name: 'Preparar agarres en 3D', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Guardar borrador', exact: true }),
  ).toBeEnabled();
  await go(page, 6);
  await expect(
    page.getByRole('heading', { name: 'Revisar y publicar' }),
  ).toBeVisible();
});

for (const count of [3, 8])
  test(`guided fixture publishes ${count} holds without coordinate entry`, async ({
    page,
  }) => {
    const state = await setup(page);
    await page
      .getByRole('button', { name: 'Preparar agarres en 3D', exact: true })
      .click();
    const canvas = page.getByLabel('Visor de Gaussian Splatting', {
      exact: true,
    });
    await expect(
      page.getByText('fixture.ply · 0 MB · captura del gimnasio', {
        exact: true,
      }),
    ).toBeVisible();
    for (let n = 2; n < count; n++) {
      await page
        .getByRole('button', { name: 'Seleccionar punto', exact: true })
        .click();
      const box = (await canvas.boundingBox())!;
      await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
      await page
        .getByRole('combobox', { name: 'Función del agarre', exact: true })
        .selectOption('intermedio');
      await page
        .getByRole('button', { name: 'Añadir agarre a la ruta', exact: true })
        .click();
    }
    await go(page, 2);
    await page
      .getByRole('button', {
        name: 'Guardar cámara para esta ruta',
        exact: true,
      })
      .click();
    await go(page, 4);
    const verifiedBox = verified(page);
    await expect(verifiedBox).toBeDisabled();
    await page.getByLabel('Revisé la vista frontal', { exact: true }).check();
    await canvas.press('ArrowRight');
    await page
      .getByLabel('Revisé la vista lateral y la profundidad', { exact: true })
      .check();
    await verifiedBox.check();
    // Restore the reviewed route camera before exporting; navigating preserves the same canvas.
    await go(page, 5);
    await page
      .locator('summary')
      .filter({ hasText: /^Encuadre y vistas$/ })
      .click();
    await page.getByRole('button', { name: 'Ver ruta', exact: true }).click();
    await page
      .getByRole('button', {
        name: 'Usar vista anotada como respaldo',
        exact: true,
      })
      .click();
    await expect.poll(() => state.images.length).toBe(1);
    await go(page, 6);
    await expect(
      page.getByRole('button', { name: 'Publicar ruta', exact: true }),
    ).toBeEnabled();
    await page.getByLabel('Tamaño de previsualización').selectOption('desktop');
    await expect(page.locator('.preview-content')).toHaveClass(
      /desktop-preview/,
    );
    await page
      .getByRole('button', { name: 'Publicar ruta', exact: true })
      .click();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.writes[0].holds3D).toHaveLength(count);
    expect(state.writes[0].markersVerified).toBe(true);
    expect(state.writes[0].imageId).toBe('image-new');
    expect(state.writes[0].status).toBe('activa');
  });

test('failed scene recovers without replacing the canvas or discarding the draft', async ({
  page,
}) => {
  const state = await setup(page);
  state.failAsset = true;
  await go(page, 1);
  await page
    .getByLabel('Nombre de ruta', { exact: true })
    .fill('Conservar en fallo');
  await go(page, 2);
  await page
    .getByRole('button', { name: 'Preparar agarres en 3D', exact: true })
    .click();
  const canvas = page.getByLabel('Visor de Gaussian Splatting', {
    exact: true,
  });
  const first = await canvas.elementHandle();
  await expect(
    page.getByRole('button', { name: 'Reintentar 3D', exact: true }),
  ).toBeVisible();
  await go(page, 1);
  await expect(page.getByLabel('Nombre de ruta', { exact: true })).toHaveValue(
    'Conservar en fallo',
  );
  await go(page, 2);
  expect(state.assetRequests).toBe(1);
  state.failAsset = false;
  await page
    .getByRole('button', { name: 'Reintentar 3D', exact: true })
    .click();
  await expect(
    page.getByText('fixture.ply · 0 MB · captura del gimnasio', {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await first!.evaluate((n) => n === document.querySelector('canvas')),
  ).toBe(true);
  expect(state.writes).toHaveLength(0);
});

test('guided inspector stays readable at required widths, themes, zoom and emulated keyboard', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(5000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  await page
    .getByRole('button', { name: 'Preparar agarres en 3D', exact: true })
    .click();
  const canvas = page.getByLabel('Visor de Gaussian Splatting', {
    exact: true,
  });
  await expect(
    page.getByText('fixture.ply · 0 MB · captura del gimnasio', {
      exact: true,
    }),
  ).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['first', 'second']) {
      await go(page, 1);
      const name = page.getByLabel('Nombre de ruta', { exact: true });
      await name.fill(
        'Ruta con nombre largo para comprobar el inspector y sus pasos',
      );
      await expect(
        page.getByRole('button', { name: 'Guardar borrador', exact: true }),
      ).toBeVisible();
      const nav = await page
        .getByRole('navigation', { name: 'Pasos del editor' })
        .boundingBox();
      expect(nav!.width).toBeLessThanOrEqual(width);
      await go(page, 6);
      await expect(
        page.getByRole('heading', { name: 'Revisar y publicar', exact: true }),
      ).toBeFocused();
      await expect(
        page.getByRole('heading', { name: 'Revisar y publicar', exact: true }),
      ).toBeInViewport();
      await expect
        .poll(() =>
          page
            .getByRole('heading', { name: 'Revisar y publicar', exact: true })
            .evaluate((n) => {
              const r = n.getBoundingClientRect();
              const top = document.elementFromPoint(
                r.left + 10,
                r.top + r.height / 2,
              );
              return top === n || n.contains(top);
            }),
        )
        .toBe(true);
      await page.screenshot({
        path: `/tmp/p1a-${info.project.name}-${width}-${theme}.png`,
      });
      await page
        .getByRole('button', { name: 'Cambiar tema', exact: true })
        .click();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await canvas.boundingBox())?.width).toBe(390);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await go(page, 1);
  await page.getByLabel('Nombre de ruta', { exact: true }).focus();
  const before = await canvas.boundingBox();
  // Emulate the visual viewport shrinking; no real phone/keyboard is claimed.
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, 'height', {
      value: window.innerHeight - 260,
      configurable: true,
    });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  expect(await canvas.boundingBox()).toEqual(before);
  await expect(page.locator('#tools-panel')).toHaveCSS('bottom', '260px');
  await page.evaluate(() => {
    delete (window.visualViewport as any).height;
    window.visualViewport!.dispatchEvent(new Event('resize'));
    document.documentElement.style.zoom = '2';
  });
  await page
    .getByRole('combobox', { name: 'Paso del editor', exact: true })
    .selectOption('3');
  await page.screenshot({ path: `/tmp/p1a-${info.project.name}-zoom.png` });
  expect(errors).toEqual([]);
});

test('retirement and reactivation require reasons and preserve the prepared snapshot', async ({
  page,
}) => {
  const state = await setup(page, true);
  await go(page, 6);
  await expect(
    page.getByRole('button', { name: 'Confirmar retiro', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Motivo del cambio').fill('Retiro de prueba');
  await page
    .getByRole('button', { name: 'Confirmar retiro', exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].status).toBe('retirada');
  expect(state.writes[0].holds3D).toEqual(original.holds3D);
  await page.getByRole('button', { name: 'Editar ruta', exact: true }).click();
  await go(page, 6);
  await expect(
    page.getByRole('button', { name: 'Reactivar ruta', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Motivo del cambio').fill('Reactivación de prueba');
  await page
    .getByRole('button', { name: 'Reactivar ruta', exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[1].status).toBe('activa');
  expect(state.writes[1].expectedRevision).toBe(2);
  expect(state.writes[1].imageId).toBe('image-original');
});

test('server rejection marks the responsible step and incomplete draft can omit a rejected backup', async ({
  page,
}) => {
  const state = await setup(page);
  state.errorStatus = 400;
  state.errorMessage = 'La imagen debe pertenecer a la captura de la ruta.';
  await go(page, 6);
  await page
    .getByRole('button', { name: 'Publicar ruta', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Publicar ruta', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Revisar Imagen/respaldo', exact: true })
    .click();
  await expect(page.locator('.route-editor')).toHaveAttribute('data-step', '5');
  state.errorStatus = 0;
  await page
    .getByRole('button', { name: 'Guardar borrador', exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].status).toBe('borrador');
  expect(state.writes[0].imageId).toBe('');
  expect(state.writes[0].holds3D).toEqual(original.holds3D);
});

test('route preparation keeps the historical wall when its current section becomes a visitable area', async ({
  page,
}) => {
  const state = await setup(page, true, true);
  await go(page, 1);
  await expect(
    page.getByText(
      'Esta ruta conserva la revisión 1 de su zona. La zona actual tiene revisión 2.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Sección', exact: true }),
  ).toHaveValue('section-p0');
  await expect(
    page.getByRole('option', { name: 'Muro histórico', exact: true }),
  ).toHaveCount(1);
  await go(page, 3);
  await page
    .getByRole('button', { name: 'Preparar agarres en 3D', exact: true })
    .click();
  await expect(
    page.getByText('fixture.ply · 0 MB · captura del gimnasio', {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Seleccionar punto', exact: true })
    .click();
  const c = page.getByLabel('Visor de Gaussian Splatting', { exact: true });
  const r = (await c.boundingBox())!;
  await c.click({ position: { x: r.width / 2, y: r.height / 2 } });
  await expect(
    page.getByRole('heading', {
      name: 'Confirmar agarre seleccionado',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Descartar agarre seleccionado', exact: true })
    .click();
  expect(state.writes).toHaveLength(0);
  expect(state.images).toHaveLength(0);
});

test('separate editor guards navigation and discards only confirmed preparation across browser history', async ({
  page,
}) => {
  const state = await setup(page, true);
  await expect(page).toHaveURL(/vista=EditarRuta&editar=route-spatial/);
  await expect(
    page.getByRole('button', { name: 'Guardar actividad', exact: true }),
  ).toHaveCount(0);
  await go(page, 1);
  const name = page.getByLabel('Nombre de ruta', { exact: true });
  await name.fill('Cambios que se descartan');
  await page
    .getByRole('button', { name: 'Volver a la ficha', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(
    'Se descartarán los cambios locales de esta ruta',
  );
  await dialog
    .getByRole('button', { name: 'Seguir editando', exact: true })
    .click();
  await expect(name).toHaveValue('Cambios que se descartan');
  await page.goBack();
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/vista=EditarRuta/);
  await dialog
    .getByRole('button', { name: 'Seguir editando', exact: true })
    .click();
  await expect(name).toHaveValue('Cambios que se descartan');
  await page.goBack();
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Descartar cambios y salir', exact: true })
    .click();
  await expect(page).toHaveURL(/ruta=route-spatial/);
  await expect(
    page.getByRole('heading', { name: original.name, exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.goForward();
  await expect(name).toHaveValue(original.name);
  await expect(
    page.getByText('Sin cambios pendientes', { exact: true }),
  ).toBeVisible();
  await name.fill('Recarga descarta memoria');
  const unload = page.waitForEvent('dialog');
  const reload = page.reload();
  await (await unload).accept();
  await reload;
  await expect(name).toHaveValue(original.name);
});

test('private editor deep links preserve origin, reject nonstaff and never substitute an invalid route', async ({
  page,
}) => {
  await setup(page, true);
  await page.goto(
    '/?vista=EditarRuta&editar=route-spatial&tourOrigen=tour-one&paradaOrigen=stop-one&revisionOrigen=19',
  );
  await expect(page.getByLabel('Nombre de ruta', { exact: true })).toHaveValue(
    original.name,
  );
  await page
    .getByRole('button', { name: 'Volver a la ficha', exact: true })
    .click();
  await expect(page).toHaveURL(
    /tourOrigen=tour-one.*paradaOrigen=stop-one.*revisionOrigen=19/,
  );
  await page.goto('/?vista=EditarRuta&editar=%3Cinvalid%3E');
  await expect(
    page.getByText('Identificador de ruta no válido.', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.route-editor')).toHaveCount(0);
  await page.route('**/api/me', (r) =>
    r.fulfill({ json: { userId: 'spatial-test', staff: null } }),
  );
  await page.goto('/?vista=EditarRuta&editar=route-spatial');
  await expect(
    page.getByText(
      'Necesitas una sesión staff vigente para editar esta ruta.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre de ruta', { exact: true })).toHaveCount(
    0,
  );
});

test('discarding a preparation after concurrent reload does not resurrect its older base', async ({
  page,
}) => {
  const state = await setup(page, true);
  await go(page, 1);
  await page
    .getByLabel('Nombre de ruta', { exact: true })
    .fill('Base local obsoleta');
  await page
    .getByRole('button', { name: 'Conservar preparación local', exact: true })
    .click();
  state.route.revision = 2;
  state.route.name = 'Nueva versión guardada';
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('climbing-session-expired')),
  );
  // The same authorized account can recheck permissions without changing identity.
  await page
    .getByRole('button', {
      name: 'Reintentar',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Editar ruta · Nueva versión guardada',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel('Nombre de ruta', { exact: true })).toHaveValue(
    'Base local obsoleta',
  );
  await page
    .getByRole('button', { name: 'Volver a la ficha', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Descartar cambios y salir', exact: true })
    .click();
  await page.getByRole('button', { name: 'Editar ruta', exact: true }).click();
  await expect(page.getByLabel('Nombre de ruta', { exact: true })).toHaveValue(
    'Nueva versión guardada',
  );
  await expect(
    page.getByText('Sin cambios pendientes', { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
