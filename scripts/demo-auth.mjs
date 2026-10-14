import { chromium } from '@playwright/test';
import { writeFile, rm, lstat, chmod } from 'node:fs/promises';
import {
  assertDemoTarget,
  privateDirectory,
  authDirectory,
  profilePath,
  requireDemoServer,
  demoOrigin,
} from './demo-local.mjs';
const profile = process.argv[2];
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
  } else {
    if (process.argv.length !== 3) throw new Error('Usa staff o escalador.');
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
    browser = await chromium.launch({ channel: 'chrome', headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${demoOrigin}/?vista=Cuenta`);
    console.log(
      `Login manual de ${profile} en la ventana Chrome abierta. No envíes contraseñas por chat. Esperando hasta 15 minutos.`,
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
    'Perfil no guardado: revisa destino demo, argumentos o completa el login manual.',
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
}
