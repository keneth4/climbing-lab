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
  onMount(() => {
    let disposed = false;
    api('/reports')
      .then((d) => {
        if (!disposed) reports = d.reports || [];
      })
      .catch((e) => {
        if (!disposed) error = e.message;
      });
    return () => (disposed = true);
  });
</script>

<details>
  <summary>Mis reportes</summary>
  {#if error}<p role="alert">{error}</p>{/if}
  {#each reports as r}<article>
      <p>{r.category} · Revisión {r.revision} · {r.status}</p>
      <p>{r.description}</p>
      {#if r.resolution}<p>Respuesta del staff: {r.resolution}</p>{/if}
    </article>{/each}
  {#if !reports.length && !error}<p>Aún no hay reportes en esta cuenta.</p>{/if}
</details>
