<script lang="ts">
  import { tick, onDestroy, onMount } from 'svelte';
  import { api } from './auth';
  import TourPoster from './TourPoster.svelte';
  import SplatViewer from './SplatViewer.svelte';
  import type { TourView, TourCamera } from '../shared/tours';
  let {
    tourId,
    stopId,
    onSelect,
    onRoute,
    onZone,
  }: {
    tourId: string;
    stopId: string;
    onSelect: (id: string, stop: string, replace?: boolean) => void;
    onRoute: (id: string) => void;
    onZone: (id: string) => void;
  } = $props();
  let tour = $state<TourView | null>(null),
    loading = $state(true),
    error = $state(''),
    scene = $state(false),
    free = $state(false),
    request = 0,
    loadedId = '',
    command = $state<{ id: number; camera: TourCamera } | undefined>(),
    commandId = 0;
  let heading: HTMLHeadingElement;
  onMount(() => {
    const revalidate = () => {
      if (!document.hidden) void load(tourId, true);
    };
    window.addEventListener('focus', revalidate);
    return () => window.removeEventListener('focus', revalidate);
  });
  onDestroy(() => request++);
  const current = $derived(
    tour?.content.stops.find(
      (s) => s.id === (stopId || tour?.content.startStopId),
    ),
  );
  const index = $derived(
    tour?.content.stops.findIndex((s) => s.id === current?.id) ?? -1,
  );
  async function load(id: string, force = false) {
    if (!force && tour && loadedId === id) return;
    const ticket = ++request;
    loading = true;
    error = '';
    if (loadedId !== id) {
      scene = false;
      tour = null;
    }
    try {
      const result = await api(
        '/tours' + (id ? '/' + encodeURIComponent(id) : ''),
      );
      if (ticket !== request) return;
      if (JSON.stringify(tour) !== JSON.stringify(result.tour))
        tour = result.tour;
      loadedId = id;
      if (tour && !id) {
        loadedId = tour.id;
        onSelect(
          tour.id,
          stopId ||
            tour?.content.startStopId ||
            tour.content.stops[0]?.id ||
            '',
          true,
        );
      }
    } catch (e) {
      if (ticket === request) error = (e as Error).message;
    } finally {
      if (ticket === request) loading = false;
    }
  }
  $effect(() => {
    void load(tourId);
  });
  $effect(() => {
    if (scene && current?.camera) {
      command = { id: ++commandId, camera: current.camera };
      free = false;
    }
  });
  $effect(() => {
    if (!tour?.sceneAvailable) scene = false;
  });
  function select(id: string) {
    if (!tour) return;
    onSelect(tour.id, id);
    tick().then(() => heading?.focus({ preventScroll: true }));
  }
</script>

<section class="tour-page" aria-label="Recorrido del gimnasio">
  <h1 tabindex="-1" bind:this={heading}>
    {tour?.content.title || 'Recorrer el gimnasio'}
  </h1>
  {#if loading}<p role="status">Consultando recorrido…</p>{/if}
  {#if error}<p role="alert">No se pudo consultar el recorrido. {error}</p>
    <button
      onclick={() => {
        void load(tourId, true);
      }}>Reintentar recorrido</button
    >{/if}
  {#if tour}
    <p>{tour.content.description}</p>
    {#if tour.status === 'retired'}<p role="status">
        Recorrido retirado. Su enlace e imágenes se conservan; la entrada 3D
        está desactivada.
      </p>{:else if !tour.sceneAvailable}<p role="status">
        El recorrido necesita revisión de su captura. Puedes consultar sus
        imágenes y textos.
      </p>{/if}
    {#if !current}<p role="alert">
        La parada indicada no existe en este recorrido.
      </p>
      <button
        onclick={() =>
          select(tour!.content.startStopId || tour!.content.stops[0]?.id || '')}
        >Ir a la primera parada</button
      >
    {:else}
      <p aria-live="polite">
        Parada {index + 1} de {tour.content.stops.length}{free
          ? ' · Exploración libre'
          : ''}
      </p>
      <h2>{current.title}</h2>
      <p>{current.description}</p>
      {#if current.imageId}<TourPoster
          imageId={current.imageId}
          title={current.title}
        />{/if}
      <div class="actions">
        <button
          disabled={index <= 0}
          onclick={() => select(tour!.content.stops[index - 1].id)}
          >Parada anterior</button
        ><button
          disabled={index >= tour.content.stops.length - 1}
          onclick={() => select(tour!.content.stops[index + 1].id)}
          >Parada siguiente</button
        >
      </div>
      {#if tour.sceneAvailable && current.camera}
        {#if !scene}<button
            class="primary"
            onclick={async () => {
              await load(tourId, true);
              if (!error && tour?.sceneAvailable) scene = true;
            }}>Iniciar recorrido en 3D</button
          >{:else}<div class="actions">
            <button onclick={() => (free = true)}>Explorar libremente</button
            ><button
              onclick={() => {
                if (current?.camera)
                  command = { id: ++commandId, camera: current.camera };
                free = false;
              }}>Volver a esta parada</button
            ><button onclick={() => (scene = false)}>Cerrar recorrido 3D</button
            >
          </div>{/if}
      {/if}
      {#if current.section}<button onclick={() => onZone(current!.section!.id)}
          >Ver rutas de esta zona</button
        >{/if}
      {#if current.linkedRouteId}<button
          onclick={() => onRoute(current!.linkedRouteId!)}
          >Ver ruta de la parada</button
        >{/if}
    {/if}
    <nav aria-label="Paradas del recorrido">
      <ol>
        {#each tour.content.stops as stop, i}<li>
            <button
              aria-current={stop.id === current?.id ? 'step' : undefined}
              onclick={() => select(stop.id)}>{i + 1}. {stop.title}</button
            >
          </li>{/each}
      </ol>
    </nav>
    {#if scene && tour.capture && current?.camera}<SplatViewer
        capture={tour.capture}
        routeId={`tour-${tour.id}-${tour.revision}`}
        staff={false}
        onSave={() => {}}
        tourMode
        tourCommand={command}
        onExplore={() => (free = true)}
        onExit={() => (scene = false)}
        holds3D={tour.content.stops
          .filter((s) => s.hotspot)
          .map((s) => ({ id: s.id, position: s.hotspot!, role: 'intermedio' }))}
        onHoldSelect={(id) => select(id)}
        selectedHoldId={current.id}
      />{/if}
  {:else if !loading && !error}<p>
      No hay un recorrido publicado todavía. El catálogo de rutas sigue
      disponible.
    </p>{/if}
  {#if location.hostname === 'localhost' || location.hostname === '127.0.0.1'}<p
      class="example-note"
    >
      Demo local: estos enlaces no son accesibles desde internet.
    </p>{/if}
</section>

<style>
  .tour-page {
    min-width: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.75rem 0;
  }
  nav {
    padding: 0;
    display: block;
  }
  ol {
    padding-left: 1.5rem;
  }
  li {
    margin: 0.5rem 0;
  }
  button[aria-current] {
    border: 2px solid var(--accent);
  }
</style>
