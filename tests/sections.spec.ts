import { test, expect, type Page } from '@playwright/test';
import { gaussianFixture } from './fixtures';
import {
  polygonBounds,
  planeFromPoints,
  type OrientedPolygon,
} from '../shared/sections';
const geometry: OrientedPolygon = {
  type: 'oriented-polygon',
  plane: planeFromPoints([
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0.2],
  ]),
  verticesUV: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
  thickness: 0.5,
};
async function fixture(page: Page) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'owner', exp })).toString('base64url')}.test`;
  await page.addInitScript(
    ({ token, exp }) =>
      localStorage.setItem(
        'sb-defblrjdwgnqyzzgozdf-auth-token',
        JSON.stringify({
          access_token: token,
          refresh_token: 'test',
          expires_at: exp,
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'owner',
            email: 'fixture@example.com',
            aud: 'authenticated',
            app_metadata: { provider: 'email' },
            user_metadata: {},
            created_at: '2026-10-14',
          },
        }),
      ),
    { token, exp },
  );
  const capture = {
    id: 'section-fixture',
    filename: 'section-fixture.ply',
    size: 100,
    status: 'published',
    upload_state: 'ready',
    version: 1,
    transform: { scale: 1, rotation: [0, 0, 0, 1], translation: [0, 0, 0] },
    alignment: null,
    initialCamera: {
      captureId: 'section-fixture',
      yaw: 0,
      pitch: 0,
      distance: 3,
      target: [0, 0, 0],
    },
    fileUrl: '/api/captures/section-fixture/file/scene.ply',
  };
  const sections: any[] = [
    {
      id: 'tilted-zone',
      name: 'Zona inclinada',
      kind: 'wall',
      revision: 1,
      geometry: structuredClone(geometry),
      bounds: polygonBounds(geometry),
    },
  ];
  const state = { sections, writes: 0, fail: 0, delay: 0 };
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    let json: any = {};
    if (path.endsWith('/file/scene.ply')) {
      await route.fulfill({
        body: gaussianFixture(),
        contentType: 'application/octet-stream',
      });
      return;
    }
    if (path === '/api/me') json = { userId: 'owner', staff: 'admin' };
    else if (path === '/api/captures/current')
      json = { capture, generation: 1 };
    else if (path === '/api/captures')
      json = {
        captures: [capture],
        state: { generation: 1, active_capture_id: capture.id },
      };
    else if (path === '/api/sections' && request.method() === 'GET')
      json = { sections };
    else if (
      (path === '/api/sections' || path === '/api/sections/tilted-zone') &&
      request.method() !== 'GET'
    ) {
      state.writes++;
      if (state.delay)
        await new Promise((resolve) => setTimeout(resolve, state.delay));
      if (state.fail) {
        if (state.fail === 409) sections[0].revision++;
        await route.fulfill({
          status: state.fail,
          json: {
            error:
              state.fail === 409
                ? 'La sección cambió. Recarga y revisa antes de guardar.'
                : 'Error de red simulado',
          },
        });
        return;
      }
      const body = request.postDataJSON();
      const section = {
        id: request.method() === 'POST' ? 'new-zone' : 'tilted-zone',
        ...body,
        revision: request.method() === 'POST' ? 1 : sections[0].revision + 1,
        bounds: body.geometry
          ? polygonBounds(body.geometry)
          : { min: body.min, max: body.max },
      };
      if (request.method() === 'POST') sections.push(section);
      else sections[0] = section;
      json = { id: section.id, revision: section.revision, section };
    } else if (path.endsWith('/revisions'))
      json = {
        revisions: [
          {
            revision: 1,
            section: {
              id: 'tilted-zone',
              name: 'Zona inclinada',
              revision: 1,
              kind: 'wall',
              geometry,
              bounds: polygonBounds(geometry),
            },
            createdAt: '2026-10-14',
          },
        ],
      };
    else if (path === '/api/routes') json = { routes: [] };
    else if (path === '/api/fiducials') json = { fiducials: [] };
    else if (path === '/api/entries') json = { entries: [] };
    else if (path === '/api/staff/reports') json = { reports: [] };
    await route.fulfill({ json });
  });
  await page.goto('/?vista=Capturas');
  await expect(
    page.getByRole('heading', { name: 'Definir sección estable' }),
  ).toBeVisible();
  return { state, errors };
}
const zoneStep = (page: Page, step: number) =>
  page
    .getByRole('combobox', { name: 'Paso de zona', exact: true })
    .selectOption(String(step));
async function edit(page: Page) {
  await page
    .getByRole('combobox', { name: 'Mostrar sección en la vista', exact: true })
    .selectOption('tilted-zone');
  await page
    .getByRole('button', { name: 'Editar sección seleccionada', exact: true })
    .click();
}

test('section conflicts, network errors and double submission preserve preparation until explicit review', async ({
  page,
}) => {
  const { state, errors } = await fixture(page);
  await edit(page);
  await page
    .getByLabel('Nombre de sección', { exact: true })
    .fill('Mi preparación');
  await zoneStep(page, 4);
  await page
    .getByLabel('Revisé la superficie y el volumen desde dos ángulos')
    .check();
  state.fail = 409;
  await page
    .getByRole('button', { name: 'Guardar cambios de sección', exact: true })
    .click();
  await expect(
    page.getByText('La zona cambió. Tu preparación se conserva;', {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Consultar nueva base', exact: true })
    .click();
  await expect(
    page.getByText('Base actual: revisión 2', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Revisé la nueva revisión y las diferencias',
      exact: true,
    })
    .click();
  await zoneStep(page, 1);
  await expect(
    page.getByLabel('Nombre de sección', { exact: true }),
  ).toHaveValue('Mi preparación');
  await zoneStep(page, 4);
  await page
    .getByLabel('Revisé la superficie y el volumen desde dos ángulos')
    .check();
  state.fail = 503;
  await page
    .getByRole('button', { name: 'Guardar cambios de sección', exact: true })
    .click();
  await expect(
    page.getByText('Error de red simulado', { exact: true }),
  ).toBeVisible();
  state.fail = 0;
  state.delay = 500;
  await page
    .getByRole('button', { name: 'Guardar cambios de sección', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Guardando…', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText('Zona guardada.', { exact: false }),
  ).toBeVisible();
  expect(state.writes).toBe(3);
  expect(state.sections[0].name).toBe('Mi preparación');
  expect(errors).toEqual([]);
});

test('section inspector supports reversible vertex edits, responsive themes and a single persistent canvas', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const { state, errors } = await fixture(page);
  await edit(page);
  await zoneStep(page, 3);
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-camera-view', /distance/);
  await canvas.evaluate((element) =>
    element.setAttribute('data-section-identity', 'same'),
  );
  await page
    .getByRole('button', { name: 'Seleccionar vértice 1', exact: true })
    .click();
  await page.getByRole('button', { name: 'Aumentar U', exact: true }).click();
  await zoneStep(page, 1);
  await expect(
    page.getByRole('heading', { name: 'Contorno y espesor', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Cancelar ajuste', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Seleccionar vértice 1', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Aplicar ajuste', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Deshacer zona', exact: true }),
  ).toBeDisabled();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['first', 'second']) {
      await zoneStep(page, 1);
      await expect(
        page.getByLabel('Nombre de sección', { exact: true }),
      ).toHaveValue('Zona inclinada');
      await page
        .getByRole('button', { name: 'Cambiar tema', exact: true })
        .click();
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: `/tmp/p1b-${info.project.name}-${width}-${theme}.png`,
      });
      await zoneStep(page, 3);
      await expect(canvas).toHaveAttribute('data-section-identity', 'same');
      expect(await canvas.count()).toBe(1);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['Compacto', 'Medio', 'Ampliado'])
    await page.getByRole('button', { name, exact: true }).click();
  await page.evaluate(() => (document.documentElement.style.zoom = '2'));
  await zoneStep(page, 4);
  await expect(
    page.getByRole('button', {
      name: 'Guardar cambios de sección',
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => (document.documentElement.style.zoom = '1'));
  await page
    .getByRole('button', { name: 'Cancelar edición de sección', exact: true })
    .click();
  expect(state.writes).toBe(0);
  expect(state.sections[0].geometry).toEqual(geometry);
  expect(errors).toEqual([]);
});

test('box and visitable areas save deliberately and route creation receives the saved wall section', async ({
  page,
}) => {
  const { state } = await fixture(page);
  await page
    .getByRole('button', { name: 'Preparar sección visual', exact: true })
    .click();
  await zoneStep(page, 1);
  await page
    .getByLabel('Nombre de sección', { exact: true })
    .fill('Nueva pared');
  await zoneStep(page, 4);
  await page
    .getByLabel('Revisé la superficie y el volumen desde dos ángulos')
    .check();
  await page
    .getByRole('button', { name: 'Crear sección', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Crear ruta en esta zona', exact: true })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Sección', exact: true }),
  ).toHaveValue('new-zone');
  expect(state.writes).toBe(1);
  await page
    .getByLabel('Nombre de ruta', { exact: true })
    .fill('Preparación conservada');
  await page.getByRole('button', { name: 'Capturas', exact: true }).click();
  await page.getByRole('button', { name: 'Staff', exact: true }).click();
  await expect(page.getByLabel('Nombre de ruta', { exact: true })).toHaveValue(
    'Preparación conservada',
  );
});

test('visitable areas have no create-route action and incomplete inclined preparation cancels on capture change', async ({
  page,
}) => {
  const { state } = await fixture(page);
  await page
    .getByRole('button', { name: 'Preparar sección visual', exact: true })
    .click();
  await zoneStep(page, 1);
  await page
    .getByLabel('Nombre de sección', { exact: true })
    .fill('Área de circulación');
  await page
    .getByRole('combobox', { name: 'Tipo de región', exact: true })
    .selectOption('accessible-area');
  await zoneStep(page, 4);
  await page
    .getByLabel('Revisé la superficie y el volumen desde dos ángulos')
    .check();
  await page
    .getByRole('button', { name: 'Crear sección', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Crear ruta en esta zona', exact: true }),
  ).toHaveCount(0);
  expect(state.sections.at(-1).kind).toBe('accessible-area');
  await page
    .getByRole('button', { name: 'Plano inclinado · tres puntos', exact: true })
    .click();
  await zoneStep(page, 4);
  await expect(
    page.getByRole('button', { name: 'Crear sección', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('combobox', { name: 'Versión para revisar', exact: true })
    .selectOption('');
  await expect(
    page.getByRole('combobox', { name: 'Paso de zona', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('La captura cambió; preparación cancelada.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.writes).toBe(1);
});

test('no WebGL leaves section data and validation usable without losing the prepared contour', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      context: string,
      ...args: any[]
    ) {
      if (context.startsWith('webgl')) return null;
      return original.call(this, context as any, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  const { state } = await fixture(page);
  await expect(
    page.getByText('El visor 3D no está disponible en este navegador.', {
      exact: true,
    }),
  ).toBeVisible();
  await edit(page);
  await zoneStep(page, 3);
  await expect(
    page.getByRole('button', { name: 'Seleccionar vértice 1', exact: true }),
  ).toBeVisible();
  await zoneStep(page, 4);
  await expect(
    page.getByText('Zona inclinada', { exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Cancelar edición de sección', exact: true })
    .click();
  expect(state.writes).toBe(0);
});
