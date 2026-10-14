<script lang="ts">
  import { untrack, onDestroy } from 'svelte';
  import { api } from './auth';
  import type { Route, Entry } from './domain';
  let {
    routes,
    owner,
    onImported,
  }: { routes: Route[]; owner: string; onImported: () => Promise<void> } =
    $props();
  const stored = untrack(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem('climbing-lab:v1') || 'null',
      )?.entries;
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  });
  const candidates = $derived(
    (stored as Entry[]).filter(
      (e) =>
        !!e &&
        typeof e === 'object' &&
        typeof e.id === 'string' &&
        typeof e.notes === 'string' &&
        routes.some(
          (r) =>
            r.id === e.routeId &&
            r.revision === e.revision &&
            r.status === 'activa',
        ) &&
        Number.isInteger(e.attempts) &&
        e.attempts > 0 &&
        e.attempts <= 10000 &&
        e.notes.length <= 2000 &&
        ['ascenso', 'intento'].includes(e.result) &&
        Number.isFinite(Date.parse(e.date)) &&
        Date.parse(e.date) <= Date.now(),
    ),
  );
  let choices = $state<string[]>([]),
    busy = $state(false),
    notice = $state('');
  let disposed = false;
  onDestroy(() => (disposed = true));
  async function importSelected() {
    if (busy) return;
    busy = true;
    notice = '';
    try {
      for (const entry of candidates.filter((e) => choices.includes(e.id))) {
        if (disposed) return;
        const hash = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(entry.id),
        );
        const requestId =
          'demo_' +
          Array.from(new Uint8Array(hash), (n) =>
            n.toString(16).padStart(2, '0'),
          ).join('');
        await api('/entries', {
          routeId: entry.routeId,
          expectedRevision: entry.revision,
          attempts: entry.attempts,
          result: entry.result,
          notes: entry.notes,
          occurredAt: new Date(entry.date).toISOString(),
          requestId,
        });
      }
      if (!disposed) {
        notice =
          'Importación confirmada. Repetir la selección no crea duplicados.';
        choices = [];
        await onImported();
      }
    } catch (e) {
      if (!disposed) notice = (e as Error).message;
    } finally {
      if (!disposed) busy = false;
    }
  }
</script>

{#if stored.length}<details>
    <summary>Revisar actividad demo para importar</summary>
    <p>
      Importarás únicamente los registros seleccionados a {owner}. Solo se
      ofrecen rutas y revisiones que aún coinciden con el catálogo. Hasta 50 por
      selección; el original se conserva en este dispositivo.
    </p>
    {#each candidates as e}<label class="toggle"
        ><input
          type="checkbox"
          value={e.id}
          bind:group={choices}
          disabled={busy}
        />{e.routeName} · {e.date} · {e.attempts} intentos · {e.notes}</label
      >{/each}
    {#if !candidates.length}<p>
        No hay registros demo compatibles con las revisiones actuales.
      </p>{/if}
    <button
      disabled={busy || !choices.length || choices.length > 50}
      onclick={importSelected}
      >{busy ? 'Importando…' : 'Importar selección revisada'}</button
    >
    {#if notice}<p role="status">{notice}</p>{/if}
  </details>{/if}
