<script lang="ts">
  import { api } from './auth';
  import { untrack, onMount, onDestroy } from 'svelte';
  import SplatViewer from './SplatViewer.svelte';
  import type { Point } from '../shared/alignment';
  import type { Section, Capture } from './twin';
  import type { Route, Hold3D, CameraView } from './domain';
  let {
    route,
    onSaved,
    onPreparing,
  }: {
    route?: Route;
    onSaved: (id: string) => void;
    onPreparing?: (active: boolean) => void;
  } = $props();
  let currentCapture = $state<Capture | undefined>();
  let preparing3D = $state(false);
  let candidate = $state<Point | undefined>();
  let holdRole = $state<Hold3D['role']>('intermedio');
  let sections = $state<Section[]>([]),
    sectionId = $state('');
  onMount(() => {
    api('/captures/current')
      .then((data) => (currentCapture = data.capture || undefined))
      .catch((e) => (message = e.message));
    api('/sections')
      .then((data) => {
        sections = data.sections;
        sectionId = route?.sectionId || '';
      })
      .catch((e) => (message = e.message));
  });
  onDestroy(() => onPreparing?.(false));
  const initial = untrack(() => route);
  let holds3D = $state<Hold3D[]>(
    (initial?.holds3D || []).map((h) => ({ ...h, position: [...h.position] })),
  );
  let camera = $state<CameraView | undefined>(
    initial?.captureId ? initial.camera : undefined,
  );
  function addHold() {
    if (
      !candidate ||
      !candidate.every(
        (n) =>
          typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e6,
      )
    ) {
      message = 'Revisa las tres coordenadas del agarre.';
      return;
    }
    if (holds3D.length + (route?.holds.length || 0) >= 40) {
      message = 'Máximo 40 marcadores por ruta.';
      return;
    }
    holds3D = [
      ...holds3D,
      { id: crypto.randomUUID(), role: holdRole, position: [...candidate] },
    ];
    candidate = undefined;
    message = 'Marcador preparado. Guarda la ruta para confirmarlo.';
  }
  let name = $state(initial?.name || ''),
    grade = $state(initial?.grade || 'V1'),
    sector = $state(initial?.sector || 'Spray wall'),
    beta = $state(initial?.beta || ''),
    status = $state(initial?.status || 'activa'),
    message = $state(''),
    busy = $state(false);
  async function save() {
    busy = true;
    message = '';
    try {
      const result = await api(
        route ? `/routes/${route.id}` : '/routes',
        {
          name,
          grade,
          sector: sections.find((s) => s.id === sectionId)?.name || sector,
          sectionId,
          ...(route?.captureId || currentCapture?.id
            ? { captureId: route?.captureId || currentCapture?.id }
            : {}),
          beta,
          status,
          holds: route?.holds || [],
          holds3D,
          ...(camera ? { camera } : {}),
          ...(route ? { expectedRevision: route.revision } : {}),
        },
        route ? 'PUT' : 'POST',
      );
      onSaved(result.id);
    } catch (e) {
      message = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    save();
  }}
>
  <h2>{route ? 'Editar ruta' : 'Crear ruta'}</h2>
  <label
    >Nombre de ruta<input bind:value={name} required maxlength="80" /></label
  ><label
    >Grado de ruta<input bind:value={grade} required maxlength="15" /></label
  ><label
    >Sección<select bind:value={sectionId} required
      ><option value="">Selecciona una sección</option
      >{#each sections.filter((s) => s.kind !== 'accessible-area') as s}<option
          value={s.id}>{s.name}</option
        >{/each}</select
    ></label
  ><label>Beta<textarea bind:value={beta} maxlength="2000"></textarea></label
  ><label
    >Estado<select bind:value={status}
      ><option value="activa">Activa</option><option value="retirada"
        >Retirada</option
      ></select
    ></label
  ><button disabled={busy}>{busy ? 'Guardando…' : 'Guardar ruta en D1'}</button
  >{#if message}<p role="status">{message}</p>{/if}
</form>

<section class="route-markers">
  <h3>Agarres 3D de la ruta</h3>
  <p>
    Los marcadores se guardan con la revisión de ruta en las coordenadas
    alineadas del gimnasio. La selección es aproximada: revisa cada posición
    antes de confirmar.
  </p>
  {#if currentCapture && (!route?.captureId || route.captureId === currentCapture.id)}
    <button
      type="button"
      onclick={() => {
        preparing3D = !preparing3D;
        onPreparing?.(preparing3D);
        candidate = undefined;
      }}
      >{preparing3D
        ? 'Cerrar preparación 3D'
        : 'Preparar agarres en 3D'}</button
    >
    {#if preparing3D}<SplatViewer
        capture={currentCapture}
        section={sections.find((s) => s.id === sectionId)}
        routeId={route?.id || 'new-route'}
        saved={camera}
        staff={true}
        onSave={(view) => {
          camera = view;
          message = 'Cámara preparada. Guarda la ruta para confirmarla.';
        }}
        {holds3D}
        onPoint={(_, world) => (candidate = [...world])}
      />
      {#if candidate}<div>
          <h4>Confirmar agarre seleccionado</h4>
          {#each ['X', 'Y', 'Z'] as axis, i}<label
              >Posición del agarre {axis}<input
                type="number"
                step="any"
                bind:value={candidate[i]}
              /></label
            >{/each}
          <label
            >Función del agarre<select bind:value={holdRole}
              ><option value="inicio">Inicio</option><option value="intermedio"
                >Intermedio</option
              ><option value="final">Final</option></select
            ></label
          >
          <button type="button" onclick={addHold}
            >Añadir agarre a la ruta</button
          ><button type="button" onclick={() => (candidate = undefined)}
            >Descartar agarre seleccionado</button
          >
        </div>{/if}
    {/if}
  {:else}<p>
      {currentCapture
        ? 'Importa esta ruta a la captura vigente antes de preparar marcadores.'
        : 'Publica una captura del gimnasio para preparar los agarres en 3D.'}
    </p>{/if}
  <ol>
    {#each holds3D as h, i}<li>
        Agarre {i + 1} · {h.role} · {h.position
          .map((n) => n.toFixed(3))
          .join(', ')}<button
          type="button"
          onclick={() => (holds3D = holds3D.filter((x) => x.id !== h.id))}
          >Eliminar agarre {i + 1}</button
        >
      </li>{/each}
  </ol>
  {#if holds3D.length || camera}<button
      type="button"
      onclick={() => {
        holds3D = (initial?.holds3D || []).map((h) => ({
          ...h,
          position: [...h.position],
        }));
        camera = initial?.captureId ? initial.camera : undefined;
        candidate = undefined;
        message = 'Cambios 3D descartados; la ruta guardada sigue intacta.';
      }}>Descartar cambios 3D</button
    >{/if}
  <p>
    Hasta pulsar Guardar ruta en D1, los cambios de cámara y agarres son un
    borrador.
  </p>
</section>

<style>
  .route-markers {
    border-top: 1px solid #d9dfe5;
    margin-top: 16px;
    padding-top: 12px;
  }
  li button {
    margin-left: 8px;
  }
</style>
