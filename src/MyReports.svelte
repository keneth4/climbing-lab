<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './auth';
  let reports = $state<
      {
        id: string;
        route_id: string;
        revision: number;
        category: string;
        description: string;
        status: string;
        resolution?: string;
      }[]
    >([]),
    error = $state('');
  let disposed = false,
    request = 0,
    busy = $state(false);
  async function load() {
    const ticket = ++request;
    busy = true;
    error = '';
    try {
      const d = await api('/reports');
      if (!disposed && ticket === request) reports = d.reports || [];
    } catch (e) {
      if (!disposed && ticket === request) error = (e as Error).message;
    } finally {
      if (!disposed && ticket === request) busy = false;
    }
  }
  onMount(() => {
    load();
    return () => {
      disposed = true;
      request++;
    };
  });
</script>

<section aria-label="Mis reportes">
  <h1 tabindex="-1">Mis reportes</h1>
  <p>
    {reports.filter((r) => r.status === 'pendiente').length} pendientes · {reports.filter(
      (r) => r.status === 'resuelto',
    ).length} resueltos
  </p>
  <p>
    Si hay un agarre suelto, avisa directamente al staff. El reporte no
    sustituye ese aviso.
  </p>
  <button disabled={busy} onclick={load}
    >{busy ? 'Actualizando reportes…' : 'Actualizar reportes'}</button
  >
  {#if error}<p role="alert">{error}</p>
    <button onclick={load}>Reintentar reportes</button>{/if}
  {#each reports as r}<article>
      <a href={`/?ruta=${encodeURIComponent(r.route_id)}`}
        >Ver ruta · Revisión reportada {r.revision}</a
      >
      <p>{r.category} · Revisión {r.revision} · {r.status}</p>
      <p>{r.description}</p>
      {#if r.resolution}<p>Respuesta del staff: {r.resolution}</p>{/if}
    </article>{/each}
  {#if !reports.length && !error}<p>Aún no hay reportes en esta cuenta.</p>{/if}
</section>

<style>
  a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
</style>
