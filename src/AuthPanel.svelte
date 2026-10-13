<script lang="ts">
  import { supabase } from './auth';
  let email = $state(''),
    password = $state(''),
    message = $state(''),
    busy = $state(false);
  let recovery = $state(location.pathname === '/auth/reset-password');
  async function run(
    action: 'login' | 'signup' | 'reset' | 'update' | 'google',
  ) {
    busy = true;
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
          message = 'Contraseña actualizada.';
          recovery = false;
          history.replaceState(null, '', '/');
        }
      }
      if (error) throw error;
    } catch (e) {
      message = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<section class="auth">
  <h2>{recovery ? 'Nueva contraseña' : 'Acceder a Climbing Lab'}</h2>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      run(recovery ? 'update' : 'login');
    }}
  >
    {#if !recovery}<label
        >Correo<input
          type="email"
          bind:value={email}
          autocomplete="email"
          required
        /></label
      >{/if}
    <label
      >Contraseña<input
        type="password"
        bind:value={password}
        minlength="8"
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
  {#if message}<p role="status">{message}</p>{/if}
</section>
