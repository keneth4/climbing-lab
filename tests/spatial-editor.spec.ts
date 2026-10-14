import { test, expect, type Page } from '@playwright/test';
import { gaussianFixture } from './fixtures';
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
async function setup(page: Page) {
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
    route: structuredClone(original),
    writes: [] as any[],
    images: [] as any[],
    imageBuffers: [] as Buffer[],
  };
  await page.route('**/api/**', async (handler) => {
    const url = new URL(handler.request().url()),
      path = url.pathname,
      method = handler.request().method();
    if (path.includes('/file/scene.ply')) {
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
          url.searchParams.get('status') === 'borrador' ? [state.route] : [],
      };
    if (path === `/api/routes/${original.id}`) {
      if (method === 'PUT') {
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
          revision: 1,
        })),
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
  await page
    .locator('summary')
    .filter({ hasText: /^Editar ruta$/ })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Sección', exact: true }),
  ).toHaveValue('section-p0');
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
    .getByRole('combobox', { name: 'Sección', exact: true })
    .selectOption('section-other');
  await expect(
    page.getByText(
      'La captura o sección cambió; preparación temporal cancelada.',
      { exact: true },
    ),
  ).toBeVisible();
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
      await expect(
        page.getByRole('button', {
          name: 'Seleccionar agarre 3 · intermedio',
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole('combobox', { name: 'Etiquetas de agarres', exact: true })
        .selectOption('hidden');
      await expect(
        page.getByRole('button', {
          name: 'Seleccionar agarre 3 · intermedio',
          exact: true,
        }),
      ).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Ajustar agarre 3', exact: true })
        .click();
      await expect(
        page.getByRole('button', {
          name: 'Seleccionar agarre 3 · intermedio',
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
          name: 'Seleccionar agarre 3 · intermedio',
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
