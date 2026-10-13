<script lang="ts">
  import { onMount } from 'svelte';
  import { api, supabase } from './auth';
  import SplatViewer from './SplatViewer.svelte';
  import type { Capture, Section, Fiducial } from './twin';
  import {
    projectVertex,
    polygonGeometry,
    polygonBounds,
    planeAxes,
    type SectionGeometry,
  } from '../shared/sections';
  import type { Point } from '../shared/alignment';
  import type { Route, CameraView } from './domain';
  let {
    routes,
    onPublished,
    currentCapture,
  }: { routes: Route[]; onPublished: () => void; currentCapture?: Capture } =
    $props();
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
  let sectionName = $state(''),
    minimum = $state(''),
    maximum = $state(''),
    referenceLabel = $state(''),
    referencePosition = $state(''),
    observations = $state<Record<string, string>>({}),
    changed = $state<string[]>([]),
    imports = $state<string[]>([]),
    reviewed = $state<string[]>([]),
    reviewedAlignment = $state(false),
    previewSectionId = $state('');
  let editingSection = $state(false);
  let center = $state<Point>([0, 0, 0]);
  let dimensions = $state<Point>([2, 2, 1]);
  let sceneBounds = $state<{ min: Point; max: Point } | undefined>();
  let boundsStamp = '';
  let picked = $state<{ raw: Point; world: Point } | undefined>();
  let draftSection = $derived<Section>({
    id: 'preview',
    name: sectionName || 'Sección en preparación',
    bounds: {
      min: center.map((n, i) => n - dimensions[i] / 2) as Point,
      max: center.map((n, i) => n + dimensions[i] / 2) as Point,
    },
  });
  function startSection() {
    if (sceneBounds) {
      center = sceneBounds.min.map(
        (n, i) => (n + sceneBounds!.max[i]) / 2,
      ) as Point;
      dimensions = sceneBounds.min.map((n, i) =>
        Math.max((sceneBounds!.max[i] - n) * 0.3, 0.1),
      ) as Point;
    }
    editingSection = true;
  }
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
  let polygonMode = $state(false),
    vertices = $state<Point[]>([]);
  let plane = $state<SectionGeometry['plane']>('XY'),
    elevation = $state(0),
    thickness = $state(0.5);
  let gridVisible = $state(true),
    gridStep = $state(0.5),
    snapGrid = $state(false);
  let sectionKind = $state<'wall' | 'accessible-area'>('wall');
  let polygon = $derived<SectionGeometry>({
    type: 'polygon',
    plane,
    elevation,
    thickness,
    vertices: vertices.map((p) => projectVertex(p, plane, elevation)),
  });
  let polygonPreview = $derived<Section>({
    id: 'polygon-preview',
    name: sectionName || 'Contorno en preparación',
    geometry: polygon,
    kind: sectionKind,
    bounds: vertices.length ? polygonBounds(polygon) : draftSection.bounds,
  });
  function addVertex(world: Point) {
    if (vertices.length >= 32) {
      message = 'Máximo 32 vértices por sección.';
      return;
    }
    vertices = [
      ...vertices,
      projectVertex(world, plane, elevation, snapGrid ? gridStep : 0),
    ];
  }
  function beginPolygon() {
    editingSection = true;
    polygonMode = true;
    vertices = [];
  }
  let editId = $state(''),
    editRevision = $state(0);
  let sectionHistory = $state<
    { revision: number; section: Section; createdAt: string }[]
  >([]);
  let historyId = $state('');
  function cancelRegion() {
    editId = '';
    editRevision = 0;
    editingSection = false;
    polygonMode = false;
    vertices = [];
    sectionName = '';
    minimum = '';
    maximum = '';
    message = 'Edición cancelada; no se guardaron cambios.';
  }
  function editRegion(region: Section) {
    editId = region.id;
    editRevision = region.revision || 1;
    sectionName = region.name;
    sectionKind = region.kind || 'wall';
    editingSection = true;
    center = region.bounds.min.map(
      (n, i) => (n + region.bounds.max[i]) / 2,
    ) as Point;
    dimensions = region.bounds.min.map(
      (n, i) => region.bounds.max[i] - n,
    ) as Point;
    minimum = region.bounds.min.join(', ');
    maximum = region.bounds.max.join(', ');
    polygonMode = !!region.geometry;
    if (region.geometry) {
      plane = region.geometry.plane;
      elevation = region.geometry.elevation;
      thickness = region.geometry.thickness;
      vertices = region.geometry.vertices.map((p) => [...p] as Point);
    } else vertices = [];
    message =
      'Editando revisión ' +
      editRevision +
      '. Las rutas conservarán su revisión de sección anterior hasta que sean revisadas.';
  }
  async function historyRegion() {
    if (!previewSectionId) return;
    const id = previewSectionId;
    await operation(async () => {
      const data = await api(`/sections/${id}/revisions`);
      if (previewSectionId === id) {
        sectionHistory = data.revisions;
        historyId = id;
      }
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
      if (!data.session) throw new Error('Inicia sesión.');
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
      editingSection = false;
      editId = '';
      editRevision = 0;
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
      });
      await refresh();
      onPublished();
      message = 'Captura publicada. Las rutas se actualizaron por sección.';
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
      editingSection = false;
      editId = '';
      editRevision = 0;
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
{#if selected?.upload_state === 'ready'}<label
    >Mostrar sección en la vista<select bind:value={previewSectionId}
      ><option value="">Ninguna</option>{#each sections as s}<option
          value={s.id}>{s.name}</option
        >{/each}</select
    ></label
  ><SplatViewer
    capture={selected}
    {fiducials}
    onReady={(id, version) => (readyStamp = id + ':' + version)}
    onInitialSave={selected.status === 'draft' ? saveInitial : undefined}
    onPoint={(raw, world) => {
      picked = { raw, world };
      if (polygonMode && editingSection) addVertex(world);
    }}
    onBounds={(bounds) => {
      sceneBounds = bounds;
      if (boundsStamp !== selectedId) {
        boundsStamp = selectedId;
        center = bounds.min.map((n, i) => (n + bounds.max[i]) / 2) as Point;
      }
    }}
    continuousPick={polygonMode && editingSection}
    grid={gridVisible
      ? { plane, elevation, step: gridStep, center: center }
      : undefined}
    section={editingSection
      ? polygonMode
        ? polygonPreview
        : draftSection
      : sections.find((s) => s.id === previewSectionId)}
    routeId="capture-preview"
    staff={false}
    onSave={() => {}}
  />
  {#if selected.initialCamera}<p>Cámara inicial del gimnasio guardada.</p>{/if}
  {#if picked}<section class="point-review">
      <h2>Confirmar posición seleccionada</h2>
      <p>Centro gaussiano aproximado. Comprueba el marcador antes de usarlo.</p>
      <p>
        Gimnasio: {picked.world.map((n) => n.toFixed(4)).join(', ')} · Captura original:
        {picked.raw.map((n) => n.toFixed(4)).join(', ')}
      </p>
      <div class="actions">
        <button
          onclick={() => {
            center = [...picked!.world];
            editingSection = true;
          }}>Centrar sección en este punto</button
        >
        <button onclick={() => (referencePosition = picked!.world.join(', '))}
          >Usar como referencia permanente</button
        >
        <button onclick={() => (elevation = picked!.world[planeAxes(plane)[2]])}
          >Posicionar plano en este punto</button
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
  <form
    onsubmit={(e) => {
      e.preventDefault();
      operation(async () => {
        await api(
          editId ? `/sections/${editId}` : '/sections',
          {
            ...(editId ? { expectedRevision: editRevision } : {}),
            name: sectionName,
            kind: sectionKind,
            ...(polygonMode && editingSection
              ? { geometry: polygonGeometry(polygon) }
              : {}),
            min: editingSection
              ? draftSection.bounds.min
              : coordinates(minimum),
            max: editingSection
              ? draftSection.bounds.max
              : coordinates(maximum),
          },
          editId ? 'PUT' : 'POST',
        );
        await refresh();
        editId = '';
        editRevision = 0;
        sectionHistory = [];
        sectionName = '';
        editingSection = false;
        polygonMode = false;
        vertices = [];
        message = 'Sección guardada en las coordenadas del gimnasio.';
      });
    }}
  >
    <h2>Definir sección estable</h2>
    <div class="actions">
      <button
        type="button"
        disabled={busy || !previewSectionId}
        onclick={() => {
          const r = sections.find((s) => s.id === previewSectionId);
          if (r) editRegion(r);
        }}>Editar sección seleccionada</button
      >
      <button
        type="button"
        disabled={busy || !previewSectionId}
        onclick={historyRegion}>Ver historial de sección</button
      >
    </div>
    {#if editId}<p>
        Editando sección existente · revisión {editRevision}. Guardar conserva
        su identidad.
      </p>
      <button type="button" disabled={busy} onclick={cancelRegion}
        >Cancelar edición de sección</button
      >{/if}
    {#if historyId === previewSectionId && sectionHistory.length}<details open>
        <summary>Historial de sección</summary>
        <ol>
          {#each sectionHistory as r}<li>
              Revisión {r.revision} · {r.section.name} · {r.createdAt}<button
                type="button"
                onclick={() => {
                  editRegion(r.section);
                  editRevision =
                    sections.find((s) => s.id === r.section.id)?.revision || 1;
                  message =
                    'Revisión histórica preparada como borrador. Guardar creará una revisión nueva.';
                }}>Preparar esta revisión para restaurar</button
              >
            </li>{/each}
        </ol>
      </details>{/if}
    <label
      >Tipo de región<select bind:value={sectionKind}
        ><option value="wall">Sección de pared</option><option
          value="accessible-area">Área accesible</option
        ></select
      ></label
    >
    <button
      type="button"
      disabled={!selected || !sceneBounds}
      onclick={beginPolygon}>Delimitar con vértices</button
    >
    <label
      >Plano de referencia<select
        bind:value={plane}
        onchange={() => {
          vertices = [];
        }}><option>XY</option><option>XZ</option><option>YZ</option></select
      ></label
    >
    <label
      >Posición del plano<input
        type="number"
        step="any"
        bind:value={elevation}
      /></label
    >
    <label
      >Espesor de región<input
        type="number"
        min="0.01"
        step="any"
        bind:value={thickness}
      /></label
    >
    <label
      >Paso de cuadrícula<input
        type="number"
        min="0.01"
        step="any"
        bind:value={gridStep}
      /></label
    >
    <label class="toggle"
      ><input type="checkbox" bind:checked={gridVisible} />Mostrar cuadrícula</label
    >
    <label class="toggle"
      ><input type="checkbox" bind:checked={snapGrid} />Ajustar nuevos vértices
      a cuadrícula</label
    >
    <p>
      XY suele servir para paredes; XZ para suelo, si Y es vertical. Usa
      coordenadas alineadas del gimnasio. El paso representa unidades del clon,
      no metros hasta calibrar escala.
    </p>
    {#if polygonMode && editingSection}<p>
        Activa Seleccionar punto en el visor y marca el contorno en orden. Cada
        punto se proyecta al plano elegido. Usa al menos tres vértices; no
        cruces los bordes.
      </p>
      <ol>
        {#each vertices as v, i}<li>
            <div class="spatial-fields">
              {#each planeAxes(plane).slice(0, 2) as axis}<label
                  >Vértice {i + 1}
                  {['X', 'Y', 'Z'][axis]}<input
                    type="number"
                    step="any"
                    required
                    bind:value={vertices[i][axis]}
                  /></label
                >{/each}
            </div>
            Vértice {i + 1}: {projectVertex(v, plane, elevation)
              .map((n) => n.toFixed(3))
              .join(', ')}
            <button
              type="button"
              onclick={() => (vertices = vertices.filter((_, j) => j !== i))}
              >Eliminar vértice {i + 1}</button
            >
          </li>{/each}
      </ol>
      <button
        type="button"
        disabled={!vertices.length}
        onclick={() => (vertices = vertices.slice(0, -1))}
        >Deshacer vértice</button
      >
    {/if}
    <button
      type="button"
      disabled={!selected || !sceneBounds}
      onclick={() => {
        polygonMode = false;
        startSection();
      }}>Preparar sección visual</button
    >
    {#if editingSection && !polygonMode}<p>
        El volumen verde muestra la sección en preparación. Ajusta su centro y
        tamaño; guardar confirma los límites.
      </p>
      <div class="spatial-fields">
        {#each ['X', 'Y', 'Z'] as axis, i}
          <label
            >Centro {axis}<input
              type="number"
              step="any"
              required
              bind:value={center[i]}
            /></label
          >
          <label
            >Tamaño {axis}<input
              type="number"
              min="0.01"
              step="any"
              required
              bind:value={dimensions[i]}
            /></label
          >
        {/each}
      </div>
      <p>
        Límites: {draftSection.bounds.min.map((n) => n.toFixed(3)).join(', ')} → {draftSection.bounds.max
          .map((n) => n.toFixed(3))
          .join(', ')}
      </p>
      <button
        type="button"
        onclick={() => {
          if (editId) cancelRegion();
          else editingSection = false;
        }}>Cancelar preparación visual</button
      >
    {/if}
    <label
      >Nombre de sección<input
        bind:value={sectionName}
        required
        maxlength="80"
      /></label
    >{#if !editingSection}<label
        >Límite mínimo X, Y, Z<input
          bind:value={minimum}
          placeholder="0, 0, 0"
          required
        /></label
      ><label
        >Límite máximo X, Y, Z<input
          bind:value={maximum}
          placeholder="5, 4, 1"
          required
        /></label
      >{/if}<button
      disabled={busy || (polygonMode && editingSection && vertices.length < 3)}
      >{editId ? 'Guardar cambios de sección' : 'Crear sección'}</button
    >
    <p>
      Los límites están en el sistema de coordenadas del gimnasio y permanecen
      entre capturas.
    </p>
  </form>
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
    {#each routes as r}<article>
        <strong
          >{r.name} · {sections.find((s) => s.id === r.sectionId)?.name ||
            'Pendiente de asignar sección'}</strong
        >{#if !r.sectionId && !r.captureId}<p>
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
{#if message}<p role="status">{message}</p>{/if}

<style>
  .spatial-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .point-review {
    padding: 12px;
    background: white;
    border: 1px solid #d9dfe5;
  }
</style>
