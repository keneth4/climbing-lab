import { firefox, expect } from '@playwright/test';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  privateArguments,
  privateIdentities,
  verifiedPresentation,
} from './demo-private-guards.mjs';
import assert from 'node:assert/strict';
import {
  assertDemoTarget,
  requireDemoServer,
  demoOrigin,
  profilePath,
  authDirectory,
} from './demo-local.mjs';

// Only manually captured sessions; never construct claims or assign roles.
async function loadProfile(profile) {
  const file = profilePath(profile);
  for (const path of [authDirectory, file]) {
    const stat = await lstat(path);
    assert(!stat.isSymbolicLink() && (await realpath(path)) === path);
    assert.equal(stat.mode & 0o077, 0, 'Sesiones requieren permisos privados.');
  }
  const state = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(state.cookies.length, 0);
  assert.equal(state.origins.length, 1);
  assert.equal(state.origins[0].origin, demoOrigin);
  assert.equal(state.origins[0].localStorage.length, 1);
  assert.equal(
    state.origins[0].localStorage[0].name,
    'sb-defblrjdwgnqyzzgozdf-auth-token',
  );
  return state;
}
let browser;
let stage = 'prerrequisitos';
try {
  const routeId = privateArguments(process.argv.slice(2));
  await assertDemoTarget();
  await requireDemoServer();
  // Read both profiles BEFORE opening a browser or performing any write.
  const states = await Promise.all(['staff', 'escalador'].map(loadProfile));
  browser = await firefox.launch();
  const pages = await Promise.all(
    states.map(async (storageState) => {
      const context = await browser.newContext({ storageState });
      const page = await context.newPage();
      await page.goto(`${demoOrigin}/?vista=Cuenta`);
      return page;
    }),
  );
  const [staff, climber] = pages;
  async function call(
    page,
    path,
    method = 'GET',
    body,
    expected = 200,
    anonymous = false,
  ) {
    const response = await page.evaluate(
      async ({ path, method, body, anonymous }) => {
        const stored = JSON.parse(
          localStorage.getItem('sb-defblrjdwgnqyzzgozdf-auth-token') || 'null',
        );
        const r = await fetch(`/api${path}`, {
          method,
          headers: {
            ...(!anonymous && stored?.access_token
              ? { Authorization: `Bearer ${stored.access_token}` }
              : {}),
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: r.status, data: await r.json() };
      },
      { path, method, body, anonymous },
    );
    // Assertion messages never include personal response payloads or tokens.
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: estado inesperado`,
    );
    return response.data;
  }
  const [a, b] = await Promise.all(pages.map((p) => call(p, '/me')));
  privateIdentities(a, b);
  await call(climber, '/entries', 'GET', undefined, 401, true);
  await call(climber, '/staff/reports', 'GET', undefined, 403);
  const original = await call(staff, `/routes/${routeId}`);
  const payload = verifiedPresentation(original);
  stage = 'ruta aislada de prueba';
  const run = `D04 smoke ${randomUUID()}`;
  // Reuse the HUMAN-VERIFIED presentation unchanged, never invent geometry.
  const route = await call(
    staff,
    '/routes',
    'POST',
    { ...payload, name: run, status: 'activa' },
    201,
  );
  const id = route.id;
  console.log(
    JSON.stringify({ stage, testRouteId: id, sourceRouteId: routeId }),
  );
  stage = 'proyecto y actividad';
  const before = await call(climber, '/entries');
  const project = await call(
    climber,
    '/projects',
    'POST',
    { routeId: id, notes: run },
    201,
  );
  assert.equal(
    (await call(climber, '/entries')).summary.records,
    before.summary.records,
  );
  const entry = await call(
    climber,
    '/entries',
    'POST',
    {
      routeId: id,
      attempts: 2,
      result: 'intento',
      notes: run,
      expectedRevision: route.revision,
      requestId: randomUUID(),
    },
    201,
  );
  await climber.reload();
  const journal = await call(climber, '/entries');
  const persisted = journal.entries.find((e) => e.id === entry.id);
  assert(
    persisted &&
      persisted.attempts === 2 &&
      persisted.result === 'intento' &&
      persisted.route_id === id,
  );
  assert(
    (await call(climber, '/projects')).projects.some(
      (p) => p.id === project.project.id,
    ),
  );
  await call(staff, `/entries/${entry.id}/history`, 'GET', undefined, 404);
  await call(staff, `/entries/${entry.id}/presentation`, 'GET', undefined, 404);
  await call(
    staff,
    `/entries/${entry.id}`,
    'PUT',
    { expectedVersion: 1, attempts: 1, result: 'ascenso', notes: run },
    404,
  );
  await call(climber, `/entries/${entry.id}`, 'PUT', {
    expectedVersion: 1,
    attempts: 3,
    result: 'ascenso',
    notes: run,
  });
  await call(
    climber,
    `/entries/${entry.id}`,
    'PUT',
    { expectedVersion: 1, attempts: 9, result: 'intento', notes: run },
    409,
  );
  const historic = await call(climber, `/entries/${entry.id}/presentation`);
  stage = 'reporte e historial';
  const report = await call(
    climber,
    '/reports',
    'POST',
    {
      routeId: id,
      category: 'contenido',
      description: run,
      expectedRevision: route.revision,
      requestId: randomUUID(),
    },
    201,
  );
  assert(
    (await call(staff, '/staff/reports')).reports.some(
      (r) => r.id === report.id,
    ),
  );
  await call(staff, `/staff/reports/${report.id}/assign`, 'POST', {});
  await call(staff, `/staff/reports/${report.id}/resolve`, 'POST', {
    resolution: `${run}: comprobación local`,
  });
  assert.equal((await call(staff, `/routes/${id}`)).revision, route.revision);
  const edited = await call(staff, `/routes/${id}`, 'PUT', {
    ...payload,
    name: `${run} editada`,
    status: 'activa',
    expectedRevision: route.revision,
  });
  await call(
    staff,
    `/routes/${id}`,
    'PUT',
    {
      ...payload,
      name: run,
      status: 'activa',
      expectedRevision: route.revision,
    },
    409,
  );
  await call(staff, `/routes/${id}`, 'PUT', {
    ...payload,
    name: `${run} editada`,
    status: 'retirada',
    expectedRevision: edited.revision,
    changeReason: `${run}: cierre de prueba`,
  });
  const retired = await call(
    climber,
    `/routes/${id}`,
    'GET',
    undefined,
    200,
    true,
  );
  assert.equal(retired.status, 'retirada');
  const after = await call(climber, `/entries/${entry.id}/presentation`);
  assert.deepEqual(after, historic);
  stage = 'ficha retirada, QR y fallback sin WebGL';
  const publicContext = await browser.newContext();
  await publicContext.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return ['webgl', 'webgl2', 'experimental-webgl'].includes(type)
        ? null
        : original.call(this, type, ...args);
    };
  });
  const visitor = await publicContext.newPage();
  await visitor.goto(`${demoOrigin}/?ruta=${id}`);
  await expect(
    visitor.getByRole('heading', {
      name: `${run} editada ${payload.grade}`,
      exact: true,
    }),
  ).toBeVisible();
  const photo = visitor.locator('.route-presentation img');
  await expect(photo).toBeVisible();
  assert(await photo.evaluate((img) => img.complete && img.naturalWidth > 0));
  await visitor.getByText('Compartir', { exact: true }).click();
  await expect(
    visitor.getByRole('link', { name: 'Enlace de ruta', exact: true }),
  ).toHaveAttribute('href', `${demoOrigin}/?ruta=${id}`);
  await visitor.getByText('QR de la ruta', { exact: true }).click();
  await expect(visitor.getByAltText('QR del enlace a esta ruta')).toBeVisible();
  await visitor.reload();
  await expect(photo).toBeVisible();
  await publicContext.close();
  stage = 'privacidad del render y respaldo histórico';
  await climber.evaluate(
    async ({ persisted, historic }) => {
      const { sharedPersonal } = await import('/src/pilot.ts');
      const { renderCard } = await import('/src/media.ts');
      const image = new Image();
      image.src = `/api/route-images/${historic.snapshot.imageId}`;
      await image.decode();
      const source = document.createElement('canvas');
      source.width = image.naturalWidth;
      source.height = image.naturalHeight;
      source.getContext('2d').drawImage(image, 0, 0);
      const entry = {
        date: persisted.created_at,
        attempts: 3,
        notes: persisted.notes,
        result: 'ascenso',
      };
      for (let mask = 0; mask < 16; mask++) {
        const fields = {
          name: !!(mask & 1),
          date: !!(mask & 2),
          attempts: !!(mask & 4),
          notes: !!(mask & 8),
        };
        const personal = sharedPersonal(entry, fields, 'D04 nombre de prueba');
        for (const key of ['name', 'date', 'attempts', 'notes'])
          if ((personal[key] !== undefined) !== fields[key])
            throw new Error('Privacidad no coincide');
        const canvas = renderCard(source, {
          title: historic.snapshot.name,
          grade: historic.snapshot.grade,
          gym: 'Climbing Lab — gimnasio de ejemplo',
          revision: historic.revision,
          personal,
        });
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, 'image/png'),
        );
        if (!blob || !(await blob.arrayBuffer()).byteLength)
          throw new Error('PNG vacío');
        const preview = canvas.toDataURL('image/png');
        const exported = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        if (preview !== exported)
          throw new Error('Vista previa y PNG no coinciden');
      }
    },
    { persisted, historic },
  );
  stage = 'tarjeta desde la interfaz real';
  await climber.goto(`${demoOrigin}/?vista=Bit%C3%A1cora`);
  const article = climber.locator('article').filter({
    has: climber.getByRole('heading', {
      name: `${run} · ${payload.grade}`,
      exact: true,
    }),
  });
  await expect(article).toBeVisible();
  for (const key of ['nombre', 'fecha', 'intentos', 'notas'])
    await expect(
      climber.getByLabel(`Incluir ${key}`, { exact: true }),
    ).not.toBeChecked();
  await article
    .getByRole('button', { name: 'Exportar tarjeta personal', exact: true })
    .click();
  const previewImage = climber.getByAltText(
    'Vista previa exacta del archivo que se descargará',
  );
  await expect(previewImage).toBeVisible();
  for (let mask = 0; mask < 16; mask++) {
    for (const [index, key] of [
      'nombre',
      'fecha',
      'intentos',
      'notas',
    ].entries()) {
      const checkbox = climber.getByLabel(`Incluir ${key}`, { exact: true });
      const selected = !!(mask & (1 << index));
      if ((await checkbox.isChecked()) !== selected) {
        const previous = await previewImage.getAttribute('src');
        await checkbox.setChecked(selected);
        await expect(previewImage).toBeVisible();
        await expect(previewImage).not.toHaveAttribute('src', previous);
      }
    }
    if (mask & 1) {
      const name = climber.getByLabel('Nombre para la tarjeta', {
        exact: true,
      });
      if ((await name.inputValue()) !== 'D04 nombre de prueba') {
        await name.fill('D04 nombre de prueba');
        await expect(previewImage).toBeVisible();
      }
    }
    const downloadButton = climber.getByRole('button', {
      name: 'Descargar tarjeta (PNG)',
      exact: true,
    });
    await expect(downloadButton).toBeEnabled();
    const preview = await previewImage.getAttribute('src');
    const downloaded = climber.waitForEvent('download');
    await downloadButton.click();
    const download = await downloaded;
    const stream = await download.createReadStream();
    assert(stream);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert(
      Buffer.concat(chunks).equals(
        Buffer.from(preview.split(',')[1], 'base64'),
      ),
      'Vista previa y descarga difieren',
    );
  }
  stage = 'retiro lógico de datos de prueba';
  await call(climber, `/entries/${entry.id}`, 'DELETE', { expectedVersion: 2 });
  await call(climber, `/projects/${project.project.id}`, 'PUT', {
    status: 'archivado',
    notes: run,
    expectedVersion: 1,
  });
  console.log(
    JSON.stringify({
      result: 'aprobado',
      testRouteId: id,
      historicalRevision: historic.revision,
      privacyCombinations: 16,
      cleanup: 'retiro lógico; historial conservado',
    }),
  );
} catch {
  console.error(
    `D04 privado pendiente/fallido en ${stage}. Comprueba dos sesiones reales privadas, roles, Firefox instalado y ruta D04 publicada. No se concedieron permisos. Si hubo escrituras, revisa la ruta de prueba indicada; no se borró historial.`,
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
}
