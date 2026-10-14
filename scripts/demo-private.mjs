import { readFile, writeFile, lstat, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  privateSessionState,
  privateArguments,
  privateIdentities,
  verifiedPresentation,
} from './demo-private-guards.mjs';
import assert from 'node:assert/strict';
import {
  assertDemoTarget,
  requireDemoServer,
  demoOrigin,
  demoOrigins,
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
  privateSessionState(state);
  return state;
}
const receiptPath = `${authDirectory}/private-run.json`;
let receipt;
async function saveReceipt() {
  const previous = await lstat(receiptPath).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
  });
  assert(!previous?.isSymbolicLink());
  await writeFile(receiptPath, JSON.stringify(receipt), { mode: 0o600 });
}
let stage = 'prerrequisitos';
try {
  const cleanup = process.argv[2] === 'cleanup';
  const routeId = privateArguments(process.argv.slice(cleanup ? 3 : 2));
  await assertDemoTarget();
  await requireDemoServer();
  const states = await Promise.all(['staff', 'escalador'].map(loadProfile));
  const actors = states.map((state) =>
    JSON.parse(state.origins[0].localStorage[0].value),
  );
  const [staff, climber] = actors;
  async function call(
    actor,
    path,
    method = 'GET',
    body,
    expected = 200,
    anonymous = false,
  ) {
    const response = await fetch(`${demoOrigin}/api${path}`, {
      method,
      headers: {
        ...(!anonymous
          ? { Authorization: `Bearer ${actor.access_token}` }
          : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(
      response.status,
      expected,
      `${method} ${path}: estado inesperado`,
    );
    return response.json();
  }
  const [a, b] = await Promise.all(actors.map((p) => call(p, '/me')));
  privateIdentities(a, b);
  if (cleanup) {
    receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    assert.equal(receipt.sourceRouteId, routeId);
    assert.equal(receipt.staffId, a.userId);
    assert.equal(receipt.climberId, b.userId);
    assert.equal(receipt.status, 'api-passed');
    const history = await call(climber, `/entries/${receipt.entryId}/history`);
    if (history.history[0]?.action !== 'deleted')
      await call(climber, `/entries/${receipt.entryId}`, 'DELETE', {
        expectedVersion: 2,
      });
    const projects = await call(climber, '/projects');
    const project = projects.projects.find((p) => p.id === receipt.projectId);
    assert(project);
    if (project.status !== 'archivado')
      await call(climber, `/projects/${receipt.projectId}`, 'PUT', {
        status: 'archivado',
        notes: receipt.run,
        expectedVersion: project.version,
      });
    receipt.status = 'cleanup-done';
    await saveReceipt();
    console.log(
      JSON.stringify({
        result: 'limpieza lógica completada',
        testRouteId: receipt.testRouteId,
      }),
    );
    process.exit(0);
  }
  const previous = await readFile(receiptPath, 'utf8').catch((e) => {
    if (e.code !== 'ENOENT') throw e;
  });
  assert(
    !previous || JSON.parse(previous).status === 'cleanup-done',
    'Existe un recorrido pendiente de revisar/limpiar.',
  );

  await call(climber, '/entries', 'GET', undefined, 401, true);
  await call(climber, '/staff/reports', 'GET', undefined, 403);
  const original = await call(staff, `/routes/${routeId}`);
  const payload = verifiedPresentation(original);
  stage = 'ruta aislada de prueba';
  const run = `D04 smoke ${randomUUID()}`;
  receipt = {
    sourceRouteId: routeId,
    staffId: a.userId,
    climberId: b.userId,
    run,
    status: 'started',
  };
  await saveReceipt();
  // Reuse the HUMAN-VERIFIED presentation unchanged, never invent geometry.
  const route = await call(
    staff,
    '/routes',
    'POST',
    { ...payload, name: run, status: 'activa' },
    201,
  );
  const id = route.id;
  receipt.testRouteId = id;
  await saveReceipt();
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
  receipt.projectId = project.project.id;
  await saveReceipt();
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
  receipt.entryId = entry.id;
  await saveReceipt();
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
  receipt.status = 'api-passed';
  receipt.historicalRevision = historic.revision;
  await saveReceipt();
  console.log(
    JSON.stringify({
      result: 'API real aprobada; revisión UI pendiente',
      testRouteId: id,
      historicalRevision: historic.revision,
      entryId: entry.id,
    }),
  );
} catch (error) {
  if (typeof error.actual === 'number' && typeof error.expected === 'number')
    console.error(
      JSON.stringify({ stage, status: error.actual, expected: error.expected }),
    );
  console.error(
    `D04 privado pendiente/fallido en ${stage}. Comprueba dos sesiones reales privadas, roles y ruta D04 publicada. No se concedieron permisos. Si hubo escrituras, revisa la ruta de prueba indicada; no se borró historial.`,
  );
  process.exitCode = 1;
}
