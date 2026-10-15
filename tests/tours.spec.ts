import { test, expect, type Page } from '@playwright/test';
import { gaussianFixture } from './fixtures';
const camera = {
  captureId: 'tour-capture',
  yaw: 0,
  pitch: 0,
  distance: 3,
  target: [0, 0, 0],
  fov: 55,
};
const capture = {
  id: 'tour-capture',
  version: 1,
  filename: 'tour-fixture.ply',
  size: 100,
  status: 'published',
  upload_state: 'ready',
  transform: { scale: 1, rotation: [0, 0, 0, 1], translation: [0, 0, 0] },
  alignment: null,
  initialCamera: camera,
  fileUrl: '/api/captures/tour-capture/file/scene.ply',
};
const content = {
  title: 'Un recorrido de prueba',
  description: 'Tres paradas ilustrativas',
  captureId: capture.id,
  captureVersion: 1,
  captureTransform: capture.transform,
  startStopId: 'stop-1',
  stops: [1, 2, 3].map((i) => ({
    id: 'stop-' + i,
    title: 'Parada ' + i,
    description: 'Contenido accesible ' + i,
    camera: { ...camera, yaw: (i - 1) * 0.4, fov: 55 + i },
    imageId: 'image-' + i,
    verified: true,
    ...(i === 2 ? { section: { id: 'zone-1', revision: 1 } } : {}),
  })),
};
async function fixture(page: Page, mode = 'public') {
  const state = {
    loads: 0,
    failAsset: false,
    failMetadata: false,
    retired: false,
    errors: [] as string[],
  };
  page.on('pageerror', (e) => state.errors.push(e.message));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/file/scene.ply')) {
      state.loads++;
      if (state.failAsset) return route.abort('failed');
      return route.fulfill({
        body: gaussianFixture(),
        contentType: 'application/octet-stream',
      });
    }
    if (path.startsWith('/api/tour-images/'))
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAZ0AAAAASUVORK5CYII=',
          'base64',
        ),
      });
    let json: any = {};
    if (path.startsWith('/api/tours')) {
      if (state.failMetadata)
        return route.fulfill({
          status: 503,
          json: { error: 'Error temporal de prueba' },
        });
      if (path.includes('missing'))
        return route.fulfill({
          status: 404,
          json: { error: 'Recorrido no encontrado' },
        });
      json = {
        tour:
          mode === 'empty'
            ? null
            : {
                id: 'tour-1',
                revision: 2,
                status: state.retired ? 'retired' : 'published',
                content,
                sceneAvailable: !state.retired,
                ...(!state.retired ? { capture } : {}),
              },
      };
    } else if (path === '/api/routes') json = { routes: [] };
    else if (path === '/api/sections') json = { sections: [] };
    else if (path === '/api/captures/current')
      json = { capture, generation: 1 };
    else if (path === '/api/me')
      return route.fulfill({ status: 401, json: { error: 'Inicia sesión' } });
    return route.fulfill({ json });
  });
  return state;
}
test('posters, stable stop URLs, history and zone filter work without starting WebGL', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto('/?vista=Recorrido&tour=tour-1&parada=stop-1');
  await expect(
    page.getByRole('heading', { name: content.title }),
  ).toBeVisible();
  await expect(page.getByAltText('Vista de Parada 1')).toBeVisible();
  expect(state.loads).toBe(0);
  await page
    .getByRole('button', { name: 'Parada siguiente', exact: true })
    .click();
  await expect(page).toHaveURL(/parada=stop-2/);
  await expect(page.getByText('Contenido accesible 2')).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Contenido accesible 1')).toBeVisible();
  await page.goForward();
  await expect(page.getByText('Contenido accesible 2')).toBeVisible();
  await page.getByRole('button', { name: 'Ver rutas de esta zona' }).click();
  await expect(page).toHaveURL(/zona=zone-1/);
  expect(state.loads).toBe(0);
  expect(state.errors).toEqual([]);
});
test('direct camera/FOV cuts reuse canvas and capture; exploration can return to a stop', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto('/?vista=Recorrido&tour=tour-1&parada=stop-1');
  await page.getByRole('button', { name: 'Iniciar recorrido en 3D' }).click();
  const canvas = page.locator('canvas[data-camera-view]');
  await expect(canvas).toBeVisible({ timeout: 30000 });
  await expect
    .poll(() => canvas.getAttribute('data-camera-view'))
    .toContain('"fov":56');
  await canvas.evaluate((el) => ((el as any).__tourIdentity = 'retained'));
  await page
    .getByRole('button', { name: 'Parada siguiente', exact: true })
    .click();
  await expect
    .poll(() => canvas.getAttribute('data-camera-view'))
    .toContain('"fov":57');
  expect(await canvas.evaluate((el) => (el as any).__tourIdentity)).toBe(
    'retained',
  );
  expect(state.loads).toBe(1);
  await canvas.hover();
  await page.mouse.wheel(0, 100);
  await expect(
    page.getByText(/Parada 2 de 3.*Exploración libre/),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Volver a esta parada', exact: true })
    .click();

  await page
    .getByRole('button', { name: 'Explorar libremente', exact: true })
    .click();
  await expect(
    page.getByText(/Parada 2 de 3.*Exploración libre/),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Volver a esta parada', exact: true })
    .click();
  await expect(page.getByText('Parada 2 de 3', { exact: true })).toBeVisible();
  expect(await page.locator('canvas').count()).toBe(1);
  expect(state.errors).toEqual([]);
});
test('invalid stop, unavailable metadata, retired tour and asset failure preserve text and recovery', async ({
  page,
}) => {
  const state = await fixture(page);
  state.failMetadata = true;
  await page.goto('/?vista=Recorrido&tour=tour-1&parada=invalid');
  await expect(page.getByRole('alert')).toContainText('Error temporal');
  state.failMetadata = false;
  await page.getByRole('button', { name: 'Reintentar recorrido' }).click();
  await expect(
    page.getByText('La parada indicada no existe en este recorrido.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ir a la primera parada' }).click();
  state.failAsset = true;
  await page.getByRole('button', { name: 'Iniciar recorrido en 3D' }).click();
  await expect(page.getByText('Contenido accesible 1')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Cerrar recorrido 3D', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Reintentar 3D', exact: true }),
  ).toBeVisible();
  state.failAsset = false;
  await page
    .getByRole('button', { name: 'Reintentar 3D', exact: true })
    .click();
  await expect
    .poll(() => page.locator('canvas').getAttribute('data-camera-view'))
    .toContain('"fov":56');

  await page
    .getByRole('button', { name: 'Cerrar recorrido 3D', exact: true })
    .click();
  state.retired = true;
  await page.reload();
  await expect(page.getByText(/Recorrido retirado\. Su enlace/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Iniciar recorrido en 3D' }),
  ).toHaveCount(0);
  await expect(page.getByAltText('Vista de Parada 1')).toBeVisible();
});
test('responsive poster and keyboard navigation remain usable in both themes', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/?vista=Recorrido&tour=tour-1&parada=stop-1');
  for (const width of [320, 390, 768, 1440])
    for (const theme of ['default', 'warm']) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      await expect(
        page.getByRole('button', { name: 'Parada siguiente', exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `/tmp/ux-p2b-${width}-${theme}.png`,
        fullPage: true,
      });
    }
  await page
    .getByRole('button', { name: 'Parada siguiente', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/parada=stop-2/);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});
test('empty tour has a recoverable public explanation without scene downloads', async ({
  page,
}) => {
  const state = await fixture(page, 'empty');
  await page.goto('/?vista=Recorrido');
  await expect(
    page.getByText(/No hay un recorrido publicado todavía/),
  ).toBeVisible();
  expect(state.loads).toBe(0);
});

async function staffFixture(page: Page, role = 'admin') {
  // Synthetic auth belongs only to this intercepted browser fixture, never the real demo.
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'tour-owner', exp })).toString('base64url')}.fixture`;
  await page.addInitScript(
    ({ token, exp }) =>
      localStorage.setItem(
        'sb-defblrjdwgnqyzzgozdf-auth-token',
        JSON.stringify({
          access_token: token,
          refresh_token: 'fixture',
          expires_at: exp,
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'tour-owner',
            aud: 'authenticated',
            email: 'fixture@example.com',
            app_metadata: { provider: 'email' },
            user_metadata: {},
            created_at: '2026-10-14',
          },
        }),
      ),
    { token, exp },
  );
  const state = {
    draft: structuredClone(content) as any,
    revision: 1,
    fail: 0,
    writes: [] as any[],
    imageAuth: false,
    published: false,
    images: [] as any[],
  };
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (path.endsWith('/file/scene.ply'))
      return route.fulfill({
        body: gaussianFixture(),
        contentType: 'application/octet-stream',
      });
    if (path.startsWith('/api/tour-images/') && req.method() === 'GET') {
      state.imageAuth = !!req.headers().authorization;
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jAZ0AAAAASUVORK5CYII=',
          'base64',
        ),
      });
    }
    if (path === '/api/tour-images' && req.method() === 'POST') {
      state.images.push(JSON.parse(req.headers()['x-tour-presentation']));
      return route.fulfill({ json: { id: 'captured-' + state.images.length } });
    }
    let json: any = {};
    if (path === '/api/me') json = { userId: 'tour-owner', staff: role };
    else if (path === '/api/routes') json = { routes: [] };
    else if (path === '/api/sections') json = { sections: [] };
    else if (path === '/api/captures/current')
      json = { capture, generation: 1 };
    else if (path === '/api/staff/tours' && req.method() === 'GET')
      json = {
        tours: [
          {
            id: 'tour-1',
            draft_revision: state.revision,
            published_revision: state.published ? 1 : null,
            status: state.published ? 'published' : 'draft',
          },
        ],
      };
    else if (path === '/api/staff/tours/tour-1' && req.method() === 'GET')
      json = {
        id: 'tour-1',
        revision: state.revision,
        content: state.draft,
        publishedRevision: state.published ? 1 : null,
        status: state.published ? 'published' : 'draft',
      };
    else if (path.startsWith('/api/staff/tours') && req.method() !== 'GET') {
      const body = req.postDataJSON();
      state.writes.push(body);
      if (state.fail)
        return route.fulfill({
          status: state.fail,
          json: {
            error:
              state.fail === 409
                ? 'El recorrido cambió'
                : 'Error de red simulado',
          },
        });
      if (body.content) state.draft = body.content;
      state.revision++;
      if (path.endsWith('/publish')) state.published = true;
      json = { id: 'tour-1', revision: state.revision };
    }
    return route.fulfill({ json });
  });
  return state;
}
test('staff draft edits preserve work on failures and use stable retry keys; public images require authentication', async ({
  page,
}) => {
  const state = await staffFixture(page);
  await page.goto('/?vista=Recorridos');
  await page.getByRole('button', { name: /Abrir recorrido tour-1/ }).click();
  await expect(page.getByAltText('Vista de Parada 1')).toBeVisible();
  expect(state.imageAuth).toBe(true);
  await page
    .getByLabel('Título del recorrido', { exact: true })
    .fill('Preparación conservada');
  state.fail = 503;
  await page
    .getByRole('button', { name: 'Guardar borrador de recorrido', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Error de red simulado' }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Título del recorrido', { exact: true }),
  ).toHaveValue('Preparación conservada');
  state.fail = 0;
  await page
    .getByRole('button', { name: 'Guardar borrador de recorrido', exact: true })
    .click();
  await expect(
    page.getByText('Borrador guardado; la versión pública no cambió.'),
  ).toBeVisible();
  expect(state.writes[0].requestId).toBe(state.writes[1].requestId);
  expect(state.published).toBe(false);
  await page
    .getByRole('button', { name: 'Eliminar parada 2', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '3. Parada 3', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Deshacer recorrido', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '3. Parada 3', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Bajar parada 1', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '1. Parada 2', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Descartar preparación local', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '1. Parada 1', exact: true }),
  ).toBeVisible();
});
test('editor cannot publish, incomplete drafts can save and conflicts retain preparation', async ({
  page,
}) => {
  const state = await staffFixture(page, 'editor');
  await page.goto('/?vista=Recorridos');
  await page.getByRole('button', { name: /Abrir recorrido tour-1/ }).click();
  await expect(
    page.getByRole('button', { name: 'Publicar recorrido', exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel('Título del recorrido', { exact: true })
    .fill('Edición en conflicto');
  state.fail = 409;
  state.revision = 2;
  await page
    .getByRole('button', { name: 'Guardar borrador de recorrido', exact: true })
    .click();
  await expect(
    page.getByText(/Conflicto: tu preparación se conserva/),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Consultar nueva base del recorrido' })
    .click();
  await page
    .getByRole('button', { name: 'Revisé la nueva base del recorrido' })
    .click();
  await expect(
    page.getByLabel('Título del recorrido', { exact: true }),
  ).toHaveValue('Edición en conflicto');
  state.fail = 0;
  await page
    .getByRole('button', { name: 'Guardar borrador de recorrido', exact: true })
    .click();
  expect(state.writes.at(-1).expectedRevision).toBe(2);
  await expect(
    page.getByText('Borrador guardado; la versión pública no cambió.'),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Crear recorrido', exact: true })
    .click();
  await page
    .getByLabel('Título del recorrido', { exact: true })
    .fill('Borrador incompleto');
  await page
    .getByRole('button', { name: 'Añadir parada', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Guardar borrador de recorrido', exact: true })
    .click();
  await expect(
    page.getByText('Borrador guardado; la versión pública no cambió.'),
  ).toBeVisible();
  expect(state.writes.at(-1).content.stops).toHaveLength(1);
});

test('a session recheck hides privileged controls without discarding the same account preparation', async ({
  page,
}) => {
  const state = await staffFixture(page);
  await page.goto('/?vista=Recorridos');
  await page.getByRole('button', { name: /Abrir recorrido tour-1/ }).click();
  await page
    .getByLabel('Título del recorrido', { exact: true })
    .fill('Trabajo de la misma cuenta');
  state.fail = 401;
  await page
    .getByRole('button', { name: 'Guardar borrador de recorrido', exact: true })
    .click();
  await expect(
    page.getByText(/Verifica la sesión y los permisos de staff/),
  ).toBeVisible();
  await expect(
    page.getByLabel('Título del recorrido', { exact: true }),
  ).toBeHidden();
  state.fail = 0;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(
    page.getByLabel('Título del recorrido', { exact: true }),
  ).toHaveValue('Trabajo de la misma cuenta');
});
test('posters and stop navigation survive unavailable WebGL and zoom 200 percent', async ({
  page,
}) => {
  await fixture(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: any[]
    ) {
      return /webgl/i.test(type) ? null : original.call(this, type, ...args);
    } as typeof original;
  });
  await page.goto('/?vista=Recorrido&tour=tour-1&parada=stop-1');
  await page.getByRole('button', { name: 'Iniciar recorrido en 3D' }).click();
  await expect(
    page.getByText('El visor 3D no está disponible en este navegador.', {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Contenido accesible 1')).toBeVisible();
  await page
    .getByRole('button', { name: 'Cerrar recorrido 3D', exact: true })
    .click();
  await page.evaluate(() => (document.documentElement.style.zoom = '2'));
  await page
    .getByRole('button', { name: 'Parada siguiente', exact: true })
    .click();
  await expect(page.getByText('Contenido accesible 2')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test('staff snapshot binds PNG to the selected stop camera and FOV and invalidates its review', async ({
  page,
}) => {
  const state = await staffFixture(page);
  await page.goto('/?vista=Recorridos');
  await page.getByRole('button', { name: /Abrir recorrido tour-1/ }).click();
  await page
    .getByRole('button', { name: 'Preparar parada en 3D', exact: true })
    .click();
  const canvas = page.locator('canvas[data-camera-view]');
  await expect
    .poll(() => canvas.getAttribute('data-camera-view'))
    .toContain('"fov":56');
  await page
    .getByRole('button', {
      name: 'Guardar cámara e imagen de parada',
      exact: true,
    })
    .click();
  await expect(page.getByText(/Cámara e imagen preparadas/)).toBeVisible();
  expect(state.images[0].camera.fov).toBe(56);
  await expect(
    page.getByLabel(
      'Revisé esta parada y su punto de interés desde dos ángulos',
    ),
  ).not.toBeChecked();
  await page
    .getByRole('button', { name: 'Guardar borrador de recorrido', exact: true })
    .click();
  await expect(
    page.getByText('Borrador guardado; la versión pública no cambió.'),
  ).toBeVisible();
  expect(state.draft.stops[0].imageId).toBe('captured-1');
  expect(state.draft.stops[0].camera.fov).toBe(56);
  expect(state.draft.stops[1].imageId).toBe('image-2');
  await page.getByRole('button', { name: '2. Parada 2', exact: true }).click();
  await expect
    .poll(() => canvas.getAttribute('data-camera-view'))
    .toContain('"fov":57');
  expect(await canvas.count()).toBe(1);
});
