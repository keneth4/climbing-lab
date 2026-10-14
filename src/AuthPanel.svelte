<script lang="ts">
  import { site } from './site';
  import { supabase } from './auth';
  let { onPasswordUpdated }: { onPasswordUpdated?: () => void } = $props();
  let email = $state(''),
    password = $state(''),
    message = $state(''),
    failed = $state(false),
    busy = $state(false);
  let recovery = $state(location.pathname === '/auth/reset-password');
  async function run(
    action: 'login' | 'signup' | 'reset' | 'update' | 'google',
  ) {
    if (busy) return;
    busy = true;
    failed = false;
    message = '';
    try {
      let error;
      if (action === 'google')
        ({ error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${location.origin}/auth/callback` },
        }));
      if (action === 'login')
        ({ error } = await supabase.auth.signInWithPassword({
          email,
          password,
        }));
      if (action === 'signup') {
        ({ error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        }));
        if (!error) message = 'Revisa tu correo para confirmar el registro.';
      }
      if (action === 'reset') {
        ({ error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/auth/reset-password`,
        }));
        if (!error)
          message = 'Si la cuenta existe, recibirás un enlace de recuperación.';
      }
      if (action === 'update') {
        ({ error } = await supabase.auth.updateUser({ password }));
        if (!error) {
          message = onPasswordUpdated ? '' : 'Contraseña actualizada.';
          recovery = false;
          history.replaceState(null, '', '/?vista=Cuenta');
          onPasswordUpdated?.();
        }
      }
      if (error) throw error;
    } catch (e) {
      failed = true;
      message = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<section class="auth">
  <h2>{recovery ? 'Nueva contraseña' : `Acceder a ${site.brand.name}`}</h2>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      run(recovery ? 'update' : 'login');
    }}
  >
    {#if !recovery}<label
        >Correo<input
          aria-invalid={failed}
          aria-describedby={message ? 'auth-result' : undefined}
          type="email"
          bind:value={email}
          autocomplete="email"
          required
        /></label
      >{/if}
    <label
      >Contraseña<input
        aria-invalid={failed}
        aria-describedby={message ? 'auth-result' : undefined}
        type="password"
        bind:value={password}
        minlength={recovery ? 8 : undefined}
        autocomplete={recovery ? 'new-password' : 'current-password'}
        required
      /></label
    >
    <button disabled={busy}>{recovery ? 'Guardar contraseña' : 'Entrar'}</button
    >
    {#if !recovery}<button
        type="button"
        disabled={busy || !email || password.length < 8}
        onclick={() => run('signup')}>Crear cuenta</button
      >{/if}
  </form>
  {#if !recovery}<button disabled={busy} onclick={() => run('google')}
      >Continuar con Google</button
    ><button disabled={busy || !email} onclick={() => run('reset')}
      >Recuperar contraseña</button
    >{/if}
  {#if message}<p id="auth-result" role={failed ? 'alert' : 'status'}>
      {message}
    </p>{/if}
</section>
