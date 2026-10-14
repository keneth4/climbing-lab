<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './auth';
  let events = $state<
      { day: string; event: string; count: number; average_ms: number | null }[]
    >([]),
    error = $state('');
  const labels: Record<string, string> = {
    qr_open: 'Aperturas por QR',
    detail_ready: 'Fichas disponibles',
    scene_ready: 'Vistas 3D disponibles',
    activity_start: 'Inicio de actividad',
    activity_saved: 'Actividades guardadas',
    export_done: 'Exportaciones terminadas',
    scene_error: 'Errores de 3D',
    activity_error: 'Errores al guardar',
    export_error: 'Errores de exportación',
  };
  onMount(() => {
    let disposed = false;
    api('/ux-events')
      .then((d) => {
        if (!disposed) events = d.events || [];
      })
      .catch((e) => {
        if (!disposed) error = e.message;
      });
    return () => (disposed = true);
  });
</script>

<details>
  <summary>Actividad agregada del piloto</summary>
  <p>
    Conteos por día UTC. No identifican personas ni incluyen notas. Los tiempos
    son promedios de las mediciones disponibles, no garantías de rendimiento.
  </p>
  {#if error}<p role="alert">{error}</p>{/if}
  {#each events as e}<p>
      {e.day} · {labels[e.event] || e.event}: {e.count}{e.average_ms === null
        ? ''
        : ` · ${Math.round(e.average_ms)} ms promedio`}
    </p>{/each}
  {#if !events.length && !error}<p>Aún no hay eventos registrados.</p>{/if}
</details>
