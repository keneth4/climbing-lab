<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { api, supabase } from './auth';
  import SplatViewer from './SplatViewer.svelte';
  import type { Capture, Section, Fiducial } from './twin';
  import SectionEditor from './SectionEditor.svelte';
  import type { SectionTool } from './section-tool';
  import type { Point } from '../shared/alignment';
  import type { Route, CameraView } from './domain';
  let {
    routes,
    onPublished,
    currentCapture,
    owner,
    onCreateRoute,
  }: {
    routes: Route[];
    onPublished: () => void;
    currentCapture?: Capture;
    owner: string;
    onCreateRoute: (id: string) => void;
  } = $props();
  const captureOwner = untrack(() => owner);
  let captures = $state<Capture[]>([]),
    sections = $state<Section[]>([]),
    fiducials = $state<Fiducial[]>([]),
    selectedId = $state(''),
    generation = $state(0),
    activeId = $state<string | null>(null),
    message = $state(''),
    busy = $state(false),
    progress = $state('');
  let readyStamp = $state('');
  let selected = $derived(captures.find((c) => c.id === selectedId));
  let referenceLabel = $state(''),
    referencePosition = $state(''),
    observations = $state<Record<string, string>>({}),
    changed = $state<string[]>([]),
    imports = $state<string[]>([]),
    reviewed = $state<string[]>([]),
    reviewedAlignment = $state(false);
  let sceneBounds = $state<Section['bounds'] | undefined>();
  let picked = $state<{ raw: Point; world: Point } | undefined>();
  let sectionTool = $state<SectionTool>();
  async function saveInitial(view: CameraView) {
    if (!selected) return;
    const c = selected;
    await operation(async () => {
      await api(`/captures/${c.id}/camera`, {
        expectedVersion: c.version,
        camera: view,
      });
      await refresh();
      message = 'Cámara inicial guardada. Se restaurará al abrir esta captura.';
    });
  }
  const coordinates = (value: string) => {
    const parts = value.split(',');
    if (
      parts.length !== 3 ||
      parts.some((p) => !p.trim() || !Number.isFinite(Number(p)))
    )
      throw new Error('Indica tres coordenadas separadas por comas.');
    return parts.map(Number);
  };
  async function refresh() {
    const [a, b, c] = await Promise.all([
      api('/captures'),
      api('/sections'),
      api('/fiducials'),
    ]);
    captures = a.captures;
    generation = a.state.generation;
    activeId = a.state.active_capture_id;
    sections = b.sections;
    fiducials = c.fiducials;
    if (!selectedId)
      selectedId =
        activeId || captures.find((c) => c.upload_state === 'ready')?.id || '';
  }
  onMount(() => {
    refresh().catch((e) => (message = e.message));
  });
  async function operation(run: () => Promise<void>) {
    busy = true;
    message = '';
    try {
      await run();
    } catch (e) {
      message = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function upload(file: File) {
    await operation(async () => {
      if (!/\.(ply|sog)$/i.test(file.name) || file.size > 1024 * 1024 * 1024)
        throw new Error('Selecciona un splat completo PLY/SOG de hasta 1 GB.');
      const metadata = await api('/captures', {
        filename: file.name,
        size: file.size,
      });
      const { data } = await supabase.auth.getSession();
      if (!data.session || data.session.user.id !== captureOwner)
        throw new Error(
          'La sesión cambió. Revisa la cuenta antes de subir la captura.',
        );
      for (
        let offset = 0, n = 1;
        offset < file.size;
        offset += metadata.partSize, n++
      ) {
        progress = `Subiendo ${Math.round((offset / file.size) * 100)} %`;
        const response = await fetch(
          `/api/captures/${metadata.id}/parts/${n}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
              'Content-Type': 'application/octet-stream',
            },
            body: file.slice(offset, offset + metadata.partSize),
          },
        );
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Falló la subida.');
        }
      }
      await api(`/captures/${metadata.id}/complete`, {});
      await refresh();
      selectedId = metadata.id;
      picked = undefined;
      reviewedAlignment = false;
      progress = 'Captura completa subida como borrador.';
    });
  }
  async function alignCapture() {
    if (!selected) return;
    const capture = selected;
    await operation(async () => {
      const references = fiducials
        .filter((f) => observations[f.id]?.trim())
        .map((f) => ({ id: f.id, observed: coordinates(observations[f.id]) }));
      await api(`/captures/${capture.id}/align`, {
        expectedVersion: capture.version,
        references,
      });
      reviewedAlignment = false;
      await refresh();
    });
  }
  async function publish() {
    if (!selected) return;
    const capture = selected;
    await operation(async () => {
      await api(`/captures/${capture.id}/publish`, {
        expectedGeneration: generation,
        expectedVersion: capture.version,
        changedSectionIds: changed,
        importRouteIds: imports,
        reviewedRouteIds: reviewed.filter((id) =>
          routes.some(
            (r) =>
              r.id === id &&
              !!r.sectionId &&
              (r.status === 'activa' || imports.includes(id)),
          ),
        ),
        reviewedAlignment,
        routePresentations: presentations,
      });
      await refresh();
      onPublished();
      message = 'Captura publicada. Las rutas se actualizaron por sección.';
    });
  }
  let reviewingRoute = $state('');
  const reviewRoute = $derived(routes.find((r) => r.id === reviewingRoute));
  let presentations = $state<
    Record<string, { imageId: string; camera: CameraView }>
  >({});
  let reviewCamera = $state<CameraView | undefined>();
  let rollbackReason = $state('');
  $effect(() => {
    selected?.version;
    selected?.id;
    presentations = {};
    reviewingRoute = '';
    reviewCamera = undefined;
  });
  async function prepareRouteImage(blob: Blob) {
    if (!selected || !reviewRoute || !reviewCamera) return;
    const capture = selected,
      r = reviewRoute,
      view = reviewCamera;
    await operation(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || data.session.user.id !== captureOwner)
        throw new Error(
          'La sesión cambió. Revisa la cuenta antes de guardar el respaldo.',
        );
      const response = await fetch('/api/route-images', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${data.session?.access_token || ''}`,
          'Content-Type': 'image/png',
          'X-Capture-Id': capture.id,
          'X-Presentation': JSON.stringify({
            camera: view,
            holds: r.holds3D || [],
          }),
        },
        body: blob,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      presentations[r.id] = { camera: view, imageId: result.id };
      message = 'Respaldo de ruta preparado para la captura nueva.';
    });
  }
  async function rollback() {
    if (!selected) return;
    const id = selected.id;
    await operation(async () => {
      await api(`/captures/${id}/rollback`, {
        reason: rollbackReason,
        expectedGeneration: generation,
      });
      await refresh();
      onPublished();
      message = 'Captura anterior restaurada. El historial se conserva.';
    });
  }
</script>

<h1>Capturas completas del gimnasio</h1>
<p>
  Solo administradores. Cada versión sustituye el splat completo; las secciones
  indican qué armado cambió.
</p>
<label
  >Subir un splat completo<input
    type="file"
    accept=".ply,.sog"
    disabled={busy}
    onchange={(e) => {
      const file = e.currentTarget.files?.[0];
      if (file) upload(file);
    }}
  /></label
>
<p role="status">{progress}</p>
<label
  >Versión para revisar<select
    bind:value={selectedId}
    onchange={() => {
      reviewedAlignment = false;
      picked = undefined;
      reviewed = [];
      imports = [];
    }}
    ><option value="">Selecciona una captura</option
    >{#each captures as c}<option value={c.id}
        >{c.filename} · {c.status} · {c.upload_state}{c.id === activeId
          ? ' · vigente'
          : ''}</option
      >{/each}</select
  ></label
>
{#if selected?.upload_state === 'ready'}<SplatViewer
    capture={selected}
    {fiducials}
    onReady={(id, version) => (readyStamp = id + ':' + version)}
    onInitialSave={selected.status === 'draft' ? saveInitial : undefined}
    onPoint={(raw, world) => {
      picked = { raw, world };
      sectionTool?.pick(world);
    }}
    onBounds={(bounds) => {
      sceneBounds = bounds;
    }}
    continuousPick={sectionTool?.picking || false}
    spatialMode={sectionTool?.active
      ? sectionTool.picking
        ? 'pick-hold'
        : 'explore'
      : undefined}
    section={sectionTool?.section}
    sectionCamera={sectionTool?.camera}
    sectionEditing={sectionTool?.active}
    selectedHoldId={sectionTool?.selected}
    focusPoint={sectionTool?.focusPoint}
    focusRequest={sectionTool?.focusRequest || 0}
    onHoldSelect={sectionTool?.active ? sectionTool.select : undefined}
    onModeChange={sectionTool?.active
      ? (mode) => sectionTool?.setPicking(mode === 'pick-hold')
      : undefined}
    onCancelTool={sectionTool?.cancel}
    routeId={reviewingRoute || 'capture-preview'}
    saved={reviewCamera}
    holds3D={sectionTool?.markers.length
      ? sectionTool.markers
      : reviewRoute?.holds3D || []}
    staff={!!reviewRoute}
    onSave={(view) => {
      reviewCamera = view;
      if (reviewingRoute) delete presentations[reviewingRoute];
    }}
    onImage={reviewRoute
      ? (blob, view) => {
          reviewCamera = view;
          prepareRouteImage(blob);
        }
      : undefined}
  />
  {#if selected.initialCamera}<p>Cámara inicial del gimnasio guardada.</p>{/if}
  {#if picked && !sectionTool?.active}<section class="point-review">
      <h2>Confirmar posición seleccionada</h2>
      <p>Centro gaussiano aproximado. Comprueba el marcador antes de usarlo.</p>
      <p>
        Gimnasio: {picked.world.map((n) => n.toFixed(4)).join(', ')} · Captura original:
        {picked.raw.map((n) => n.toFixed(4)).join(', ')}
      </p>
      <div class="actions">
        <button onclick={() => (referencePosition = picked!.world.join(', '))}
          >Usar como referencia permanente</button
        >
        <button onclick={() => (picked = undefined)}>Descartar posición</button>
      </div>
    </section>{/if}
{:else}<SplatViewer
    capture={currentCapture}
    staff={false}
    routeId="gym-overview"
    onSave={() => {}}
  />
{/if}
<div class="forms">
  <SectionEditor
    {sections}
    capture={selected}
    bounds={sceneBounds}
    {routes}
    onTool={(tool) => (sectionTool = tool)}
    onRefresh={refresh}
    {onCreateRoute}
  />
  <form
    onsubmit={(e) => {
      e.preventDefault();
      operation(async () => {
        await api('/fiducials', {
          label: referenceLabel,
          position: coordinates(referencePosition),
        });
        await refresh();
        referenceLabel = '';
      });
    }}
  >
    <h2>Referencia permanente</h2>
    <label
      >Nombre de referencia<input
        bind:value={referenceLabel}
        required
        maxlength="80"
      /></label
    ><label
      >Posición del gimnasio X, Y, Z<input
        bind:value={referencePosition}
        placeholder="0, 0, 0"
        required
      /></label
    ><button disabled={busy}>Crear referencia</button>
    <p>
      Ubica las marcas en estructura fija. Usa la misma unidad; las posiciones
      medidas en metros permiten calibrar la escala.
    </p>
  </form>
</div>
{#if selected?.status === 'draft' && selected.upload_state === 'ready'}<section>
    <h2>Alineación asistida</h2>
    <p>
      En la vista, verde indica la posición permanente y naranja la referencia
      observada después de alinearla.
    </p>
    <p>
      Indica la posición de cada referencia en las coordenadas originales de
      esta captura. Usa al menos tres puntos no alineados, distribuidos por el
      gimnasio.
    </p>
    {#each fiducials as f}<label
        >{f.label} · gimnasio {f.position.join(', ')}<input
          bind:value={observations[f.id]}
          placeholder="X, Y, Z de la captura"
        /></label
      >
      {#if picked}<button
          disabled={busy}
          onclick={() => (observations[f.id] = picked!.raw.join(', '))}
          >Usar punto seleccionado para {f.label}</button
        >{/if}
    {/each}<button
      disabled={busy || fiducials.length < 3}
      onclick={alignCapture}>Calcular alineación</button
    >{#if selected.alignment}<p>
        Error RMS: {selected.alignment.rms.toFixed(5)} unidades del gimnasio · escala:
        {selected.transform.scale.toFixed(5)}
      </p>{/if}
    <h2>Armado actualizado</h2>
    {#each sections as s}<label class="toggle"
        ><input type="checkbox" bind:group={changed} value={s.id} />{s.name}: el
        armado cambió</label
      >{/each}
    <h3>Rutas que se conservarán o importarán</h3>
    {#each routes.filter((r) => r.status !== 'borrador') as r}<article>
        <strong
          >{r.name} · {sections.find((s) => s.id === r.sectionId)?.name ||
            'Pendiente de asignar sección'}</strong
        >{#if r.gradeScale}<button
            onclick={() => {
              reviewingRoute = r.id;
              reviewCamera =
                r.camera && selected
                  ? { ...r.camera, captureId: selected.id }
                  : undefined;
            }}>Preparar cámara y respaldo de {r.name}</button
          >
          <p>
            {presentations[r.id]
              ? 'Respaldo nuevo preparado'
              : 'Respaldo pendiente para la captura nueva'}
          </p>{/if}{#if !r.sectionId && !r.captureId}<p>
            Esta ruta aún no está vinculada al clon. No bloquea la publicación y
            permanecerá intacta. Después de publicar, asígnale una sección desde
            Staff o Editar ruta.
          </p>{:else}{#if r.status === 'retirada' || changed.includes(r.sectionId || '')}<label
              class="toggle"
              ><input
                type="checkbox"
                bind:group={imports}
                value={r.id}
              />Importar esta ruta del armado anterior</label
            >{:else}<p>Sección sin cambios: conservar la ruta.</p>{/if}<label
            class="toggle"
            ><input
              type="checkbox"
              bind:group={reviewed}
              value={r.id}
              disabled={r.status === 'retirada' && !imports.includes(r.id)}
            />Revisé que esta ruta sigue siendo válida</label
          >
        {/if}
      </article>{/each}<label class="toggle"
      ><input type="checkbox" bind:checked={reviewedAlignment} />Revisé
      visualmente la alineación y la captura completa</label
    >
    <p>
      {activeId
        ? 'La captura nueva requiere alineación por referencias.'
        : 'La primera captura define el marco inicial; puedes calibrarlo con referencias antes de publicarla.'}
    </p>
    <button
      disabled={busy ||
        !reviewedAlignment ||
        readyStamp !== selected.id + ':' + selected.version}
      onclick={publish}>Publicar actualización completa</button
    >
  </section>{/if}
{#if selected?.status === 'published' && selected.id !== activeId}<section>
    <h2>Restaurar captura anterior</h2>
    <p>
      Se crearán revisiones nuevas desde esta captura. Las rutas sin
      presentación compatible se retirarán. Se conservará la bitácora histórica.
    </p>
    <label
      >Motivo de restauración<textarea
        bind:value={rollbackReason}
        maxlength="2000"></textarea></label
    ><button disabled={busy || !rollbackReason.trim()} onclick={rollback}
      >Confirmar restauración de captura anterior</button
    >
  </section>{/if}
{#if message}<p role="status">{message}</p>{/if}

<style>
  .point-review {
    padding: 12px;
    background: white;
    border: 1px solid #d9dfe5;
  }
</style>
