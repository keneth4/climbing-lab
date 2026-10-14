import { supabase } from './auth';
import { mount, unmount } from 'svelte';
import AuthPanel from './AuthPanel.svelte';
const result = document.querySelector<HTMLParagraphElement>('#result')!;
const profile = document.querySelector<HTMLSelectElement>('#profile')!;
const save = document.querySelector<HTMLButtonElement>('#save')!;
const requestedProfile = new URL(location.href).searchParams.get('profile');
if (requestedProfile === 'staff' || requestedProfile === 'escalador')
  profile.value = requestedProfile;
let auth: ReturnType<typeof mount> | undefined;
async function identity() {
  if (
    !['http://127.0.0.1:5174', 'http://localhost:5174'].includes(
      location.origin,
    )
  )
    throw new Error('Solo demo local en 5174.');
  const health = await (await fetch('/api/health')).json();
  if (health.gymId !== 'gym-demo')
    throw new Error('Destino distinto de gym-demo.');
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Inicia sesión primero.');
  const response = await fetch('/api/me', {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  if (!response.ok) throw new Error('Sesión no confirmada por el servidor.');
  const me = await response.json();
  if (me.gymId !== 'gym-demo' || me.userId !== data.session.user.id)
    throw new Error('La cuenta cambió.');
  if (
    profile.value === 'escalador'
      ? !!me.staff
      : !['admin', 'editor'].includes(me.staff)
  )
    throw new Error('La cuenta no corresponde al perfil seleccionado.');
  return { me, session: data.session };
}
async function inspect() {
  save.disabled = true;
  try {
    const { me } = await identity();
    result.textContent = `UUID ${me.userId} · ${me.staff || 'Sin permisos staff'} · gym-demo`;
    save.disabled = false;
  } catch (e) {
    result.textContent = (e as Error).message;
  }
}
profile.onchange = inspect;
document.querySelector<HTMLButtonElement>('#inspect')!.onclick = inspect;
document.querySelector<HTMLButtonElement>('#login')!.onclick = async () => {
  if (auth) await unmount(auth);
  auth = mount(AuthPanel, { target: document.querySelector('#auth')! });
};
save.onclick = async () => {
  save.disabled = true;
  try {
    const { session } = await identity();
    const state = {
      cookies: [],
      origins: [
        {
          origin: location.origin,
          localStorage: [
            {
              name: 'sb-defblrjdwgnqyzzgozdf-auth-token',
              value: JSON.stringify(session),
            },
          ],
        },
      ],
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(state)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `d04-${profile.value}-session.json`;
    a.click();
    URL.revokeObjectURL(url);
    result.textContent =
      'Descarga preparada. Importa el archivo con demo:auth y no lo compartas.';
  } catch (e) {
    result.textContent = (e as Error).message;
  }
  await inspect();
};
await inspect();
