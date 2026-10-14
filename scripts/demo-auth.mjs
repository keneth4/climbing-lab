import { chromium, firefox } from '@playwright/test';
import { privateSessionState } from './demo-private-guards.mjs';
import { isAbsolute } from 'node:path';
import {
  writeFile,
  rm,
  lstat,
  chmod,
  readFile,
  realpath,
} from 'node:fs/promises';
import {
  assertDemoTarget,
  privateDirectory,
  authDirectory,
  profilePath,
  requireDemoServer,
  demoOrigin,
  demoOrigins,
} from './demo-local.mjs';
const profile = process.argv[2];
const browserName = process.argv[3] || 'internal';
let browser;
try {
  await assertDemoTarget();
  await privateDirectory();
  if (profile === 'clear') {
    if (process.argv[3] !== '--confirm=gym-demo' || process.argv.length !== 4)
      throw new Error('Limpieza requiere --confirm=gym-demo.');
    await rm(authDirectory, { recursive: true });
    console.log(
      'Sesiones privadas locales eliminadas. No revoca sesiones remotas ni permisos D1.',
    );
  } else if (profile === 'import') {
    const role = process.argv[3],
      source = process.argv[4];
    if (
      process.argv.length !== 6 ||
      process.argv[5] !== '--confirm=gym-demo' ||
      !isAbsolute(source)
    )
      throw new Error(
        'Importación requiere perfil, archivo absoluto y confirmación gym-demo.',
      );
    const destination = profilePath(role);
    const stat = await lstat(source);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      (await realpath(source)) !== source ||
      stat.size > 65536
    )
      throw new Error('Archivo de sesión no seguro.');
    await chmod(source, 0o600);
    const state = JSON.parse(await readFile(source, 'utf8'));
    privateSessionState(state);
    const session = JSON.parse(state.origins[0].localStorage[0].value);
    await requireDemoServer();
    const response = await fetch(`${demoOrigin}/api/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) throw new Error('Sesión no válida.');
    const me = await response.json();
    if (
      me.gymId !== 'gym-demo' ||
      me.userId !== session.user?.id ||
      (role === 'escalador'
        ? !!me.staff
        : !['admin', 'editor'].includes(me.staff))
    )
      throw new Error('Identidad o rol incorrectos.');
    const previous = await lstat(destination).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
    });
    if (previous?.isSymbolicLink()) throw new Error('Destino enlazado.');
    await writeFile(destination, JSON.stringify(state), { mode: 0o600 });
    await chmod(destination, 0o600);
    console.log(
      JSON.stringify({
        profile: role,
        userId: me.userId,
        role: me.staff,
        sessionSaved: true,
      }),
    );
  } else {
    if (
      process.argv.length > 4 ||
      !['internal', 'firefox', 'chrome'].includes(browserName)
    )
      throw new Error('Usa staff|escalador [internal|firefox|chrome].');
    const destination = profilePath(profile);
    await lstat(destination).then(
      (s) => {
        if (s.isSymbolicLink())
          throw new Error('Sesión enlazada no permitida.');
      },
      (e) => {
        if (e.code !== 'ENOENT') throw e;
      },
    );
    await requireDemoServer();
    if (browserName === 'internal') {
      console.log(
        `Abre ${demoOrigin}/demo-auth.html?profile=${profile} en el navegador interno. Descarga la sesión e impórtala con demo:auth import; este comando no abre un navegador externo.`,
      );
      process.exit(0);
    }
    browser = await (browserName === 'firefox'
      ? firefox.launch({ headless: false })
      : chromium.launch({ channel: 'chrome', headless: false }));
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${demoOrigin}/?vista=Cuenta`);
    console.log(
      `Login manual de ${profile} en la ventana ${browserName} abierta. No envíes contraseñas por chat. Esperando hasta 15 minutos.`,
    );
    const deadline = Date.now() + 15 * 60 * 1000;
    let me;
    while (Date.now() < deadline && browser.isConnected()) {
      me = await page
        .evaluate(async () => {
          const raw = localStorage.getItem(
            'sb-defblrjdwgnqyzzgozdf-auth-token',
          );
          let session;
          try {
            session = JSON.parse(raw || 'null');
          } catch {
            return null;
          }
          if (!session?.access_token) return null;
          // Verify the token with the real Worker; stored claims never grant roles.
          const response = await fetch('/api/me', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (!response.ok) return null;
          const value = await response.json();
          return { userId: value.userId, staff: value.staff || null };
        })
        .catch(() => null);
      if (me?.userId) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (!me?.userId)
      throw new Error('Login no completado. No se guardó sesión.');
    if (profile === 'escalador' && me.staff)
      throw new Error('El perfil escalador debe carecer de privilegios staff.');
    const state = await context.storageState();
    const saved = {
      cookies: [],
      origins: state.origins
        .filter((o) => o.origin === demoOrigin)
        .map((o) => ({
          origin: o.origin,
          localStorage: o.localStorage.filter(
            (item) => item.name === 'sb-defblrjdwgnqyzzgozdf-auth-token',
          ),
        })),
    };
    await writeFile(destination, JSON.stringify(saved), { mode: 0o600 });
    await chmod(destination, 0o600);
    console.log(
      JSON.stringify({
        profile,
        userId: me.userId,
        role: me.staff,
        sessionSaved: true,
      }),
    );
    if (profile === 'staff' && !me.staff)
      console.log(
        'Aún sin rol; el propietario debe indicar este UUID para demo:staff. No se asignaron permisos.',
      );
  }
} catch {
  console.error(
    'Perfil no guardado: revisa destino demo, argumentos, sesión descargada o completa el login manual. Los navegadores externos solo se usan con opción explícita.',
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
}
