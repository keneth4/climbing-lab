<script lang="ts">
  import { site } from './site';
  let {
    tab,
    staff,
    admin,
    email,
    locked,
    theme = $bindable(),
    navigate,
    login,
    logout,
  }: {
    tab: string;
    staff: boolean;
    admin: boolean;
    email: string;
    locked: boolean;
    theme: string;
    navigate: (view: string) => void;
    login: () => void;
    logout: () => void;
  } = $props();
  const accountViews = ['Bitácora', 'Proyectos', 'Reportes', 'Cuenta'];
  const staffViews = ['Staff', 'Capturas', 'Recepción', 'Recorridos'];
</script>

<a class="skip-link" href="#tools-panel">Saltar al contenido</a>
<header class="site-header">
  <a
    class="brand"
    href="/?vista=Inicio"
    onclick={(e) => {
      e.preventDefault();
      if (!locked) navigate('Inicio');
    }}
    aria-label={`${site.brand.name}, Inicio`}
    ><strong>{site.brand.name}</strong><span>{site.brand.subtitle}</span></a
  >
  <div>
    <button
      aria-pressed={theme === 'warm'}
      onclick={() => (theme = theme === 'warm' ? 'default' : 'warm')}
      >Cambiar tema</button
    >
    {#if email}<button disabled={locked} onclick={logout}>Cerrar sesión</button
      >{:else}<button disabled={locked} onclick={login}>Iniciar sesión</button
      >{/if}
  </div>
</header>
<nav aria-label="Principal" class="site-nav">
  {#each [{ view: 'Inicio', label: 'Inicio' }, { view: 'Catálogo', label: 'Rutas' }, { view: 'Recorrido', label: 'Recorrido' }, { view: 'El gimnasio', label: 'El gimnasio' }, { view: 'Bitácora', label: 'Mi escalada' }] as item}
    <button
      disabled={locked}
      class:active={tab === item.view ||
        (item.view === 'Bitácora' && accountViews.includes(tab))}
      aria-current={tab === item.view ||
      (item.view === 'Bitácora' && accountViews.includes(tab))
        ? 'page'
        : undefined}
      onclick={() => navigate(item.view)}>{item.label}</button
    >
  {/each}
  {#if staff}<button
      disabled={locked}
      class:active={staffViews.includes(tab)}
      aria-current={staffViews.includes(tab) ? 'page' : undefined}
      onclick={() => navigate('Staff')}>Staff</button
    >{/if}
</nav>
{#if accountViews.includes(tab)}
  <nav aria-label="Cuenta" class="subnav">
    {#each [{ view: 'Bitácora', label: 'Mi actividad' }, { view: 'Proyectos', label: 'Proyectos' }, { view: 'Reportes', label: 'Mis reportes' }, { view: 'Cuenta', label: 'Cuenta y privacidad' }] as item}<button
        disabled={locked}
        aria-current={tab === item.view ? 'page' : undefined}
        onclick={() => navigate(item.view)}>{item.label}</button
      >{/each}
  </nav>
{:else if staffViews.includes(tab) && staff}
  <nav aria-label="Staff" class="subnav">
    <span>Operación · {site.brand.name}</span>
    {#each ['Staff', 'Recorridos', ...(admin ? ['Capturas'] : []), 'Recepción'] as view}<button
        disabled={locked}
        aria-current={tab === view ? 'page' : undefined}
        onclick={() => navigate(view)}
        >{view === 'Staff' ? 'Rutas y reportes' : view}</button
      >{/each}
  </nav>
{/if}
