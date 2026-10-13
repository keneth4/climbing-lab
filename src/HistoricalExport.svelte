<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './auth';
  import SplatViewer from './SplatViewer.svelte';
  import type { Entry } from './domain';
  import type { Capture } from './twin';
  let {
    entry,
    personal,
    onClose,
    gym = 'Gimnasio piloto',
  }: {
    entry: Entry;
    personal?: { name: string; result: string; attempts: number };
    onClose: () => void;
    gym?: string;
  } = $props();
  let capture = $state<Capture | undefined>(),
    snapshot = $state<any>(),
    error = $state(''),
    loading = $state(true);
  let disposed = false;
  onMount(() => {
    (async () => {
      try {
        const d = await api(`/entries/${entry.id}/presentation`);
        if (disposed) return;
        if (!d.snapshot.captureId)
          throw new Error(
            'Este registro no tiene captura histórica. No se sustituirá por el armado actual.',
          );
        const c = await api(`/captures/${d.snapshot.captureId}/metadata`);
        if (disposed) return;
        if (!c.capture) throw new Error('Captura histórica no disponible.');
        capture = c.capture;
        snapshot = d.snapshot;
      } catch (e) {
        if (!disposed) error = (e as Error).message;
      } finally {
        if (!disposed) loading = false;
      }
    })();
    return () => {
      disposed = true;
    };
  });
</script>

<section aria-label="Tarjeta histórica 3D">
  <h2>Tarjeta histórica · {entry.routeName}</h2>
  <p>Revisión {entry.revision} · {entry.date}</p>
  {#if loading}<p role="status">
      Buscando captura histórica…
    </p>{/if}{#if error}<p role="alert">{error}</p>{/if}
  {#if capture && snapshot}<SplatViewer
      {capture}
      routeId={`historical-${entry.id}`}
      staff={false}
      saved={snapshot.camera}
      holds3D={snapshot.holds3D || []}
      exportInfo={{ title: entry.routeName, grade: entry.grade, gym, personal }}
      onSave={() => {}}
    />{/if}<button onclick={onClose}>Cerrar tarjeta histórica</button>
</section>
