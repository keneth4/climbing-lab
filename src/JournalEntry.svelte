<script lang="ts">
  import { onDestroy } from 'svelte';
  import { api } from './auth';
  import type { Route } from './domain';
  let {
    routes,
    onSaved,
    onCancel,
  }: { routes: Route[]; onSaved: () => Promise<void>; onCancel: () => void } =
    $props();
  let routeId = $state(''),
    attempts = $state(1),
    result = $state<'intento' | 'ascenso'>('intento'),
    notes = $state(''),
    busy = $state(false),
    error = $state('');
  const active = $derived(routes.filter((r) => r.status === 'activa'));
  let disposed = false;
  onDestroy(() => (disposed = true));
  async function save() {
    if (busy) return;
    if (!active.some((r) => r.id === routeId)) {
      error = 'Selecciona una ruta activa.';
      return;
    }
    busy = true;
    error = '';
    try {
      await api('/entries', { routeId, attempts, result, notes });
      if (!disposed) await onSaved();
    } catch (e) {
      if (!disposed) error = (e as Error).message;
    } finally {
      if (!disposed) busy = false;
    }
  }
</script>

<form
  aria-label="Nuevo registro de bitácora"
  onsubmit={(e) => {
    e.preventDefault();
    save();
  }}
>
  <h2>Añadir registro</h2>
  {#if active.length}<label
      >Ruta del registro<select bind:value={routeId} required disabled={busy}
        ><option value="">Selecciona una ruta</option>{#each active as r}<option
            value={r.id}>{r.name} · {r.grade} · {r.sector}</option
          >{/each}</select
      ></label
    >
    <label
      >Intentos del registro<input
        type="number"
        min="1"
        max="10000"
        step="1"
        bind:value={attempts}
        required
        disabled={busy}
      /></label
    >
    <label
      >Resultado del registro<select bind:value={result} disabled={busy}
        ><option value="intento">Intento</option><option value="ascenso"
          >Ascenso</option
        ></select
      ></label
    >
    <label
      >Notas del registro<textarea
        bind:value={notes}
        maxlength="2000"
        disabled={busy}></textarea></label
    >
    <p>Se registrará con la fecha actual y la revisión vigente de la ruta.</p>
    <button disabled={busy}
      >{busy ? 'Guardando registro…' : 'Guardar registro'}</button
    >
  {:else}<p>
      No hay rutas activas disponibles en el catálogo cargado. El staff debe
      preparar una ruta para poder registrar actividad.
    </p>{/if}
  <button type="button" disabled={busy} onclick={onCancel}
    >Cancelar registro</button
  >
  {#if error}<p role="alert">{error}</p>{/if}
</form>
