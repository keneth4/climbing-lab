<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './auth';
  let { entryId }: { entryId: string } = $props();
  let rows = $state<
      {
        version: number;
        action: string;
        changedAt: string;
        snapshot: {
          attempts: number;
          result: string;
          notes: string;
          routeRevision: number;
        };
      }[]
    >([]),
    error = $state(''),
    loading = $state(true),
    disposed = false;
  const labels: Record<string, string> = {
    baseline: 'Datos anteriores al historial',
    created: 'Registro creado',
    updated: 'Registro corregido',
    deleted: 'Registro retirado',
  };
  onMount(() => {
    api(`/entries/${entryId}/history`)
      .then((d) => {
        if (!disposed) rows = d.history;
      })
      .catch((e) => {
        if (!disposed) error = e.message;
      })
      .finally(() => {
        if (!disposed) loading = false;
      });
    return () => {
      disposed = true;
    };
  });
</script>

<section aria-label="Historial del registro">
  <h3>Historial del registro</h3>
  {#if loading}<p role="status">Cargando historial…</p>{/if}{#if error}<p
      role="alert"
    >
      {error}
    </p>{/if}
  <ol>
    {#each rows as row}<li>
        <strong
          >Versión {row.version} · {labels[row.action] || row.action}</strong
        >
        <p>
          {new Date(row.changedAt).toLocaleString('es-MX')} · {row.snapshot
            .result} · {row.snapshot.attempts} intentos · Revisión de ruta {row
            .snapshot.routeRevision}
        </p>
        <p>{row.snapshot.notes}</p>
      </li>{/each}
  </ol>
</section>
