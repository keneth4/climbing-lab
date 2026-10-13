<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { activityUtc, localActivityTime } from './journal';
  import { api } from './auth';
  import type { Route, Entry } from './domain';
  let {
    entry,
    routes,
    onSaved,
    onCancel,
  }: {
    entry?: Entry;
    routes: Route[];
    onSaved: () => Promise<void>;
    onCancel: () => void;
  } = $props();
  const initial = untrack(() => entry);
  let routeId = $state(initial?.routeId || ''),
    attempts = $state(initial?.attempts || 1),
    result = $state<'intento' | 'ascenso'>(initial?.result || 'intento'),
    notes = $state(initial?.notes || ''),
    activityTime = $state(localActivityTime()),
    busy = $state(false),
    error = $state('');
  const active = $derived(routes.filter((r) => r.status === 'activa'));
  let disposed = false;
  onDestroy(() => (disposed = true));
  async function save() {
    if (busy) return;
    if (!entry && !active.some((r) => r.id === routeId)) {
      error = 'Selecciona una ruta activa.';
      return;
    }
    busy = true;
    error = '';
    try {
      await api(
        entry ? `/entries/${entry.id}` : '/entries',
        entry
          ? {
              expectedVersion: entry.entryVersion || 1,
              attempts,
              result,
              notes,
            }
          : {
              routeId,
              attempts,
              result,
              notes,
              occurredAt: activityUtc(activityTime),
            },
        entry ? 'PUT' : 'POST',
      );
      if (!disposed) await onSaved();
    } catch (e) {
      if (!disposed) error = (e as Error).message;
    } finally {
      if (!disposed) busy = false;
    }
  }
</script>

<form
  aria-label={entry
    ? 'Corregir registro de bitácora'
    : 'Nuevo registro de bitácora'}
  onsubmit={(e) => {
    e.preventDefault();
    save();
  }}
>
  <h2>{entry ? 'Corregir registro' : 'Añadir registro'}</h2>
  {#if entry || active.length}{#if entry}<p>
        {entry.routeName} · {entry.grade} · Revisión de ruta {entry.revision}.
        La ruta y la fecha del registro se conservan.
      </p>{:else}<label
        >Ruta del registro<select bind:value={routeId} required disabled={busy}
          ><option value="">Selecciona una ruta</option
          >{#each active as r}<option value={r.id}
              >{r.name} · {r.grade} · {r.sector}</option
            >{/each}</select
        ></label
      >
    {/if}
    {#if !entry}<label
        >Fecha y hora de actividad<input
          type="datetime-local"
          bind:value={activityTime}
          max={localActivityTime()}
          required
          disabled={busy}
        /></label
      >{/if}
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
    {#if !entry}<p>
        Se registrará con la fecha elegida y la revisión vigente de la ruta,
        incluso si la actividad ocurrió antes. No reconstruye armados
        anteriores.
      </p>{/if}
    <button disabled={busy}
      >{busy
        ? 'Guardando…'
        : entry
          ? 'Guardar corrección'
          : 'Guardar registro'}</button
    >
  {:else}<p>
      No hay rutas activas disponibles en el catálogo cargado. El staff debe
      preparar una ruta para poder registrar actividad.
    </p>{/if}
  <button type="button" disabled={busy} onclick={onCancel}
    >{entry ? 'Cancelar corrección' : 'Cancelar registro'}</button
  >
  {#if error}<p role="alert">{error}</p>{/if}
</form>
