<script lang="ts">
  import { api } from './auth';
  import { tourReturnUrl, type TourOrigin } from './tour-origin';
  import type { TourView } from '../shared/tours';
  let {
    origin,
    onReturn,
  }: { origin: TourOrigin; onReturn: (origin: TourOrigin) => void } = $props();
  let title = $state(''),
    error = $state(''),
    loading = $state(true),
    retry = $state(0);
  $effect(() => {
    const o = origin;
    retry;
    let active = true;
    title = '';
    error = '';
    loading = true;
    api(`/tours/${o.tour}/revisions/${o.revision}`)
      .then((d) => {
        const tour: TourView = d.tour;
        const stop = tour.content.stops.find((s) => s.id === o.stop);
        if (!stop) throw new Error('La parada de origen no está disponible.');
        if (active) title = stop.title;
      })
      .catch(() => {
        if (active) error = 'El origen del recorrido no está disponible.';
      })
      .finally(() => {
        if (active) loading = false;
      });
    return () => {
      active = false;
    };
  });
</script>

<nav aria-label="Procedencia del recorrido">
  {#if title}<a
      href={tourReturnUrl(origin)}
      onclick={(e) => {
        e.preventDefault();
        onReturn(origin);
      }}>Volver a {title}</a
    ><span> · Recorrido · Revisión {origin.revision}</span>
  {:else if loading}<p role="status">Consultando parada de origen…</p>
  {:else}<p role="alert">{error}</p>
    <button onclick={() => retry++}>Reintentar origen</button><a
      href="/?vista=Recorrido">Ver recorrido vigente</a
    >{/if}
</nav>

<style>
  nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 0.75rem 0;
    overflow-wrap: anywhere;
  }
  a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
</style>
