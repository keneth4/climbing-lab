<script lang="ts">
  import { api, supabase } from './auth';
  import {
    gradeScale as inferScale,
    publicationProblems,
    type EditorDraft,
  } from './pilot';
  import { untrack, onMount, onDestroy } from 'svelte';
  import RoutePresentation from './RoutePresentation.svelte';
  import SplatViewer from './SplatViewer.svelte';
  import type { Point } from '../shared/alignment';
  import type { Section, Capture } from './twin';
  import type { Route, Hold3D, CameraView } from './domain';
  let {
    route,
    onSaved,
    onPreparing,
    draft,
    onDraft,
    owner,
    sourceRoutes = [],
  }: {
    route?: Route;
    owner: string;
    sourceRoutes?: Route[];
    draft?: EditorDraft;
    onDraft?: (
      owner: string,
      id: string,
      revision: number,
      values: EditorDraft,
    ) => void;
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
        sectionId = restored?.sectionId || route?.sectionId || '';
      })
      .catch((e) => (message = e.message));
  });
  onDestroy(() => {
    if (!savedDraft)
      onDraft?.(draftOwner, initial?.id || 'new', initial?.revision || 0, {
        name,
        grade,
        gradeScale,
        sector,
        beta,
        status,
        rules,
        sectionId,
        holds3D,
        camera,
        imageId,
        markersVerified,
        changeReason,
      });
    onPreparing?.(false);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  });
  const initial = untrack(() => route);
  const restored = untrack(() => draft);
  const draftOwner = untrack(() => owner);
  let savedDraft = false;
  let holds3D = $state<Hold3D[]>(
    (restored?.holds3D || initial?.holds3D || []).map((h) => ({
      ...h,
      position: [...h.position],
    })),
  );
  let camera = $state<CameraView | undefined>(
    restored?.camera || (initial?.captureId ? initial.camera : undefined),
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
    checkpoint();
    holds3D = [
      ...holds3D,
      { id: crypto.randomUUID(), role: holdRole, position: [...candidate] },
    ];
    markersVerified = false;
    clearImage();
    candidate = undefined;
    message = 'Marcador preparado. Guarda la ruta para confirmarlo.';
  }
  let name = $state(restored?.name ?? initial?.name ?? ''),
    grade = $state(restored?.grade || initial?.grade || 'V1'),
    sector = $state(restored?.sector || initial?.sector || 'Spray wall'),
    beta = $state(restored?.beta || initial?.beta || ''),
    status = $state(restored?.status || initial?.status || 'borrador'),
    gradeScale = $state(
      restored?.gradeScale ||
        initial?.gradeScale ||
        inferScale(initial?.grade || 'V1'),
    ),
    rules = $state(restored?.rules || initial?.rules || ''),
    imageId = $state(restored?.imageId || initial?.imageId || ''),
    imagePreview = $state(''),
    markersVerified = $state(
      restored?.markersVerified ?? initial?.markersVerified ?? false,
    ),
    changeReason = $state(restored?.changeReason || ''),
    step = $state(1),
    imageBusy = $state(false),
    message = $state(''),
    busy = $state(false);
  async function save() {
    if (busy || imageBusy) return;
    busy = true;
    message = '';
    try {
      const result = await api(
        route ? `/routes/${route.id}` : '/routes',
        {
          name,
          grade,
          gradeScale,
          rules,
          imageId,
          markersVerified,
          changeReason,
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
        draftOwner,
      );
      savedDraft = true;
      onDraft?.(draftOwner, initial?.id || 'new', initial?.revision || 0, {});
      onSaved(result.id);
    } catch (e) {
      message = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  const pending = $derived(
    publicationProblems({
      name,
      grade,
      gradeScale,
      sector: sections.find((s) => s.id === sectionId)?.name || sector,
      sectionId,
      captureId: route?.captureId || currentCapture?.id,
      camera,
      holds3D,
      imageId,
      markersVerified,
    }),
  );
  async function uploadImage(blob: Blob) {
    if (imageBusy) return;
    imageBusy = true;
    message = '';
    try {
      const preview = URL.createObjectURL(blob);
      try {
        const img = new Image();
        img.src = preview;
        await img.decode();
        if (img.width > 4096 || img.height > 4096)
          throw new Error('La imagen admite hasta 4096 × 4096 píxeles.');
      } finally {
        URL.revokeObjectURL(preview);
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session || data.session.user.id !== draftOwner)
        throw new Error(
          'La sesión cambió. Revisa la cuenta antes de guardar la imagen.',
        );
      const response = await fetch('/api/route-images', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          'Content-Type': 'image/png',
          'X-Capture-Id': route?.captureId || currentCapture?.id || '',
          'X-Presentation': JSON.stringify({ camera, holds: holds3D }),
        },
        body: blob,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'No se pudo guardar la imagen.');
      imageId = result.id;
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      imagePreview = URL.createObjectURL(blob);
      message =
        'Imagen preparada para esta revisión. Guarda el borrador o publica.';
    } catch (e) {
      message = (e as Error).message;
    } finally {
      imageBusy = false;
    }
  }
  const undoStack: Hold3D[][] = [],
    redoStack: Hold3D[][] = [];
  function clearImage() {
    imageId = '';
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    imagePreview = '';
  }
  function checkpoint() {
    undoStack.push(holds3D.map((h) => ({ ...h, position: [...h.position] })));
    redoStack.length = 0;
    markersVerified = false;
    clearImage();
  }
  function undo(redo = false) {
    const from = redo ? redoStack : undoStack,
      to = redo ? undoStack : redoStack;
    const next = from.pop();
    if (next) {
      to.push(holds3D);
      holds3D = next;
      markersVerified = false;
      clearImage();
    }
  }
  let reuseRoute = $state('');
  let adjustingHold = $state('');
  let reuseIds = $state<string[]>([]);
  const reusable = $derived(
    sourceRoutes.find((r) => r.id === reuseRoute)?.holds3D || [],
  );
  function reuse() {
    const picked = reusable.filter((h) => reuseIds.includes(h.id));
    if (!picked.length) return;
    checkpoint();
    holds3D = [
      ...holds3D,
      ...picked.map((h) => ({
        ...h,
        id: crypto.randomUUID(),
        position: [...h.position] as Point,
      })),
    ];
    reuseIds = [];
    message =
      'Agarres copiados a esta ruta. La beta y la ruta original se conservan.';
  }
  function goStep(value: number) {
    step = value;
    requestAnimationFrame(() =>
      document
        .getElementById(`editor-${initial?.id || 'new'}-${value}`)
        ?.scrollIntoView({ block: 'start' }),
    );
  }
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    save();
  }}
>
  <h2>{route ? 'Editar ruta' : 'Crear ruta'}</h2>
  <ol class="editor-steps">
    {#each ['Datos', 'Captura y cámara', 'Agarres y reglas', 'Previsualizar y publicar'] as title, i}<li
      >
        <button
          type="button"
          aria-current={step === i + 1 ? 'step' : undefined}
          onclick={() => goStep(i + 1)}>{i + 1}. {title}</button
        >
      </li>{/each}
  </ol>
  <p>
    Paso {step}. Puedes guardar un borrador incompleto en cualquier momento.
  </p>
  <h3 id={`editor-${initial?.id || 'new'}-1`}>Datos de la ruta</h3>
  <label>Nombre de ruta<input bind:value={name} maxlength="80" /></label><label
    >Grado de ruta<input bind:value={grade} maxlength="15" /></label
  ><label
    >Sección<select bind:value={sectionId}
      ><option value="">Selecciona una sección</option
      >{#each sections.filter((s) => s.kind !== 'accessible-area') as s}<option
          value={s.id}>{s.name}</option
        >{/each}</select
    ></label
  ><label
    >Escala<select bind:value={gradeScale}
      ><option>V</option><option>Font</option><option>Otra</option></select
    ></label
  ><label
    >Reglas de pies y restricciones<textarea bind:value={rules} maxlength="2000"
    ></textarea></label
  ><label>Beta<textarea bind:value={beta} maxlength="2000"></textarea></label
  ><label
    >Estado<select bind:value={status}
      >{#if !route || route.status === 'borrador'}<option value="borrador"
          >Borrador</option
        >{/if}<option value="activa">Publicar activa</option><option
        value="retirada">Retirada</option
      ></select
    ></label
  >
  {#if route && (route.status === 'retirada') !== (status === 'retirada')}
    <p>
      Retirar quita la ruta del catálogo activo; el QR y la bitácora se
      conservan. Reactivar la devuelve al catálogo.
    </p>
    <label
      >Motivo del cambio<textarea
        bind:value={changeReason}
        required
        maxlength="2000"></textarea></label
    >
  {/if}
  {#if pending.length}<p>
      Pendientes para publicar: {pending.join(', ')}.
    </p>{/if}
  <button
    disabled={busy || imageBusy || (status === 'activa' && pending.length > 0)}
  >
    {busy
      ? 'Guardando…'
      : status === 'borrador'
        ? 'Guardar borrador'
        : status === 'activa'
          ? 'Publicar ruta'
          : 'Confirmar retiro'}
  </button>
  {#if message}<p role="status">{message}</p>{/if}
</form>

<section class="route-markers">
  <h3 id={`editor-${initial?.id || 'new'}-2`}>Captura y cámara</h3>
  <p>{currentCapture?.filename || 'Captura pendiente'}</p>
  <h3 id={`editor-${initial?.id || 'new'}-3`}>Agarres 3D de la ruta</h3>
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
          imageId = '';
          imagePreview = '';
          message = 'Cámara preparada. Guarda la ruta para confirmarla.';
        }}
        onImage={(blob, view) => {
          camera = view;
          uploadImage(blob);
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
  <details>
    <summary>Reutilizar agarres de otra ruta</summary>
    <p>
      Se copiarán a este borrador; las otras rutas y sus consejos no cambian.
    </p>
    <label
      >Ruta de origen<select
        bind:value={reuseRoute}
        onchange={() => (reuseIds = [])}
        ><option value="">Selecciona ruta</option
        >{#each sourceRoutes.filter((r) => r.id !== initial?.id && r.captureId === (initial?.captureId || currentCapture?.id) && r.holds3D?.length) as r}<option
            value={r.id}>{r.name}</option
          >{/each}</select
      ></label
    >{#each reusable as h, i}<label class="toggle"
        ><input type="checkbox" bind:group={reuseIds} value={h.id} />Agarre {i +
          1} · {h.role}</label
      >{/each}<button
      type="button"
      disabled={!reuseIds.length || holds3D.length + reuseIds.length > 40}
      onclick={reuse}>Confirmar copia de agarres</button
    >
  </details>
  <ol>
    {#each holds3D as h, i}<li>
        Agarre {i + 1} · {h.role} · {h.position
          .map((n) => n.toFixed(3))
          .join(', ')}<button
          type="button"
          onclick={() => {
            checkpoint();
            adjustingHold = h.id;
          }}>Ajustar agarre {i + 1}</button
        ><button
          type="button"
          onclick={() => {
            checkpoint();
            holds3D = holds3D.filter((x) => x.id !== h.id);
          }}>Eliminar agarre {i + 1}</button
        >
        {#if adjustingHold === h.id}
          <p>
            Modo Ajustar: revisa el marcador desde dos ángulos antes de
            terminar.
          </p>
          {#each ['X', 'Y', 'Z'] as axis, j}<label
              >Coordenada {axis} del agarre {i + 1}<input
                type="number"
                step="any"
                bind:value={h.position[j]}
              /></label
            >{/each}
          <label
            >Rol del agarre {i + 1}<select bind:value={h.role}
              ><option value="inicio">Inicio</option><option value="intermedio"
                >Intermedio</option
              ><option value="final">Final</option></select
            ></label
          >
          <button type="button" onclick={() => (adjustingHold = '')}
            >Terminar ajuste</button
          >
        {/if}
      </li>{/each}
  </ol>
  <div class="actions">
    <button type="button" onclick={() => undo()}>Deshacer marcador</button
    ><button type="button" onclick={() => undo(true)}>Rehacer marcador</button>
  </div>
  <label class="toggle"
    ><input type="checkbox" bind:checked={markersVerified} />Confirmé todos los
    agarres desde dos ángulos y el inicio/final son legibles</label
  >
  <label
    >Imagen anotada de respaldo (PNG, hasta 4 MB)<input
      type="file"
      accept="image/png"
      disabled={imageBusy}
      onchange={(e) => {
        const file = e.currentTarget.files?.[0];
        if (file) uploadImage(file);
      }}
    /></label
  >
  <p>
    La imagen debe mostrar esta cámara y estos agarres. También puedes generarla
    desde la preparación 3D.
  </p>
  {#if imagePreview}<img
      src={imagePreview}
      alt="Imagen de respaldo preparada para publicar"
    />{/if}
  <div id={`editor-${initial?.id || 'new'}-4`}>
    <h3>Previsualización pública</h3>
    {#if step === 4}<RoutePresentation
        route={{
          id: initial?.id || 'preview',
          revision: (initial?.revision || 0) + 1,
          name,
          grade,
          gradeScale,
          sector: sections.find((s) => s.id === sectionId)?.name || sector,
          beta,
          rules,
          status: 'borrador',
          holds: initial?.holds || [],
          holds3D,
          imageId,
          camera,
        }}
        imageUrl={imagePreview}
      />
      <p>
        Publicación: {pending.length
          ? pending.join(', ')
          : 'Lista para publicar'}.
      </p>{:else}<button type="button" onclick={() => goStep(4)}
        >Previsualizar ficha móvil antes de publicar</button
      >{/if}
  </div>
  {#if holds3D.length || camera}<button
      type="button"
      onclick={() => {
        holds3D = (initial?.holds3D || []).map((h) => ({
          ...h,
          position: [...h.position],
        }));
        camera = initial?.captureId ? initial.camera : undefined;
        candidate = undefined;
        markersVerified = initial?.markersVerified || false;
        imageId = initial?.imageId || '';
        message = 'Cambios 3D descartados; la ruta guardada sigue intacta.';
      }}>Descartar cambios 3D</button
    >{/if}
  <p>
    Hasta guardar el borrador o publicar la ruta, los cambios de cámara y
    agarres son una preparación local.
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
