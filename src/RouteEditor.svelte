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
  import PointAdjuster from './PointAdjuster.svelte';
  import {
    copyHold,
    applyHoldEdit,
    validPoint,
    type SpatialInteraction,
  } from './route-editing';
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
  let interaction = $state<SpatialInteraction>({ mode: 'explore' });
  const candidate = $derived(
    interaction.mode === 'review-candidate' ? interaction.candidate : undefined,
  );
  const editing = $derived(
    interaction.mode === 'edit-hold' ? interaction.hold : undefined,
  );
  const adjustingHold = $derived(editing?.id || '');
  const toolBusy = $derived(
    !['explore', 'review-route'].includes(interaction.mode),
  );
  let returnFocus: HTMLElement | undefined;
  function revealInspector(id: string, documentNavigation = false) {
    requestAnimationFrame(() => {
      const node = document.getElementById(id);
      const panel = node?.closest<HTMLElement>('#tools-panel');
      if (node && panel) {
        const n = node.getBoundingClientRect(),
          p = panel.getBoundingClientRect();
        if (preparing3D && (n.top < p.top || n.bottom > p.bottom))
          panel.scrollTop += n.top - p.top - 12;
        else if (!preparing3D && documentNavigation)
          window.scrollTo({ top: window.scrollY + n.top - 16 });
        node.focus({ preventScroll: true });
      }
    });
  }
  function cancelTool() {
    interaction = { mode: 'explore' };
    requestAnimationFrame(() => {
      if (returnFocus?.isConnected) {
        const panel = returnFocus.closest<HTMLElement>('#tools-panel');
        if (
          preparing3D &&
          panel &&
          !returnFocus.closest('.route-marker-overlay')
        ) {
          const n = returnFocus.getBoundingClientRect(),
            p = panel.getBoundingClientRect();
          if (n.top < p.top || n.bottom > p.bottom)
            panel.scrollTop += n.top - p.top - 12;
        }
        returnFocus.focus({ preventScroll: true });
      }
    });
  }
  function beginEditHold(id: string) {
    if (editing?.id === id) return;
    if (toolBusy) {
      message =
        'Aplica o cancela la preparación actual antes de seleccionar otro agarre.';
      return;
    }
    const h = holds3D.find((h) => h.id === id);
    if (!h) return;
    returnFocus = document.activeElement as HTMLElement;
    interaction = {
      mode: 'edit-hold',
      hold: copyHold(h),
      captureId: currentCapture?.id || '',
      sectionId,
    };
    revealInspector(`edit-${id}`);
  }
  function applyEdit() {
    if (!editing) return;
    try {
      if (!insideSection(editing.position)) {
        message =
          'El punto queda fuera de la sección elegida. Ajusta o cancela.';
        return;
      }
      const next = applyHoldEdit(holds3D, editing);
      if (next !== holds3D) {
        checkpoint();
        holds3D = next;
        message =
          'Cambio aplicado al borrador; respaldo y verificación pendientes.';
      } else message = 'Sin cambios: respaldo y verificación conservados.';
      cancelTool();
    } catch (e) {
      message = (e as Error).message;
    }
  }
  $effect(() => {
    const context =
      interaction.mode === 'review-candidate'
        ? interaction.candidate
        : interaction.mode === 'edit-hold'
          ? interaction
          : undefined;
    if (
      context &&
      (context.captureId !== currentCapture?.id ||
        context.sectionId !== sectionId)
    ) {
      cancelTool();
      message = 'La captura o sección cambió; preparación temporal cancelada.';
    }
  });
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
  const displayHolds = $derived(
    holds3D.map((h) => (editing?.id === h.id ? editing : h)),
  );
  let camera = $state<CameraView | undefined>(
    restored?.camera || (initial?.captureId ? initial.camera : undefined),
  );
  function insideSection(point: Point) {
    const section = sections.find((s) => s.id === sectionId);
    return (
      validPoint(point) &&
      (!section ||
        point.every(
          (n, i) => n >= section.bounds.min[i] && n <= section.bounds.max[i],
        ))
    );
  }
  function addHold() {
    if (!candidate || !validPoint(candidate.positionWorld)) {
      message = 'Revisa las tres coordenadas del agarre.';
      return;
    }
    if (holds3D.length + (route?.holds.length || 0) >= 40) {
      message = 'Máximo 40 marcadores por ruta.';
      return;
    }
    if (!insideSection(candidate.positionWorld)) {
      message =
        'El candidato queda fuera de la sección elegida. Ajusta o descarta.';
      return;
    }
    checkpoint();
    holds3D = [
      ...holds3D,
      {
        id: crypto.randomUUID(),
        role: candidate.role,
        position: [...candidate.positionWorld],
      },
    ];
    markersVerified = false;
    clearImage();
    cancelTool();
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
    if (busy || imageBusy || toolBusy) return;
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
    const imageContext = JSON.stringify({
      captureId: route?.captureId || currentCapture?.id,
      sectionId,
      camera,
      holds3D,
    });
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
      if (
        imageContext !==
        JSON.stringify({
          captureId: route?.captureId || currentCapture?.id,
          sectionId,
          camera,
          holds3D,
        })
      )
        throw new Error(
          'La preparación cambió durante la carga. Genera un respaldo nuevo.',
        );
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
  let undoStack = $state<Hold3D[][]>([]),
    redoStack = $state<Hold3D[][]>([]);
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
      cancelTool();
      message = 'Geometría restaurada; respaldo y verificación pendientes.';
    }
  }
  let reuseRoute = $state('');
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
    revealInspector(`editor-${initial?.id || 'new'}-${value}`, true);
    if (value === 4 && !toolBusy) interaction = { mode: 'review-route' };
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && toolBusy) {
      e.preventDefault();
      e.stopPropagation();
      cancelTool();
    }
  }}
/>

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
    disabled={busy ||
      imageBusy ||
      toolBusy ||
      (status === 'activa' && pending.length > 0)}
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
  <p role="status">
    Modo: {{
      explore: 'Explorar',
      'pick-hold': 'Seleccionar punto',
      'review-candidate': 'Revisar candidato',
      'edit-hold': 'Editar agarre',
      'review-route': 'Revisar ruta',
    }[interaction.mode]}
  </p>
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
        cancelTool();
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
          if (JSON.stringify(camera) !== JSON.stringify(view)) {
            camera = view;
            clearImage();
            message =
              'Cámara preparada; respaldo pendiente. Guarda la ruta para confirmarla.';
          } else message = 'Cámara sin cambios; respaldo conservado.';
        }}
        onImage={(blob, view) => {
          if (JSON.stringify(camera) !== JSON.stringify(view)) clearImage();
          camera = view;
          uploadImage(blob);
        }}
        holds3D={displayHolds}
        previewPoint={candidate?.positionWorld}
        focusPoint={candidate?.positionWorld || editing?.position}
        spatialMode={interaction.mode}
        onModeChange={(mode) => {
          if (mode === 'pick-hold') {
            returnFocus = document.activeElement as HTMLElement;
            interaction = { mode };
          } else cancelTool();
        }}
        onCancelTool={cancelTool}
        toolsDisabled={busy || imageBusy}
        selectedHoldId={adjustingHold}
        onHoldSelect={beginEditHold}
        onPoint={(_, world) => {
          interaction = {
            mode: 'review-candidate',
            candidate: {
              positionWorld: [...world],
              captureId: currentCapture!.id,
              sectionId,
              role: holds3D.length ? 'intermedio' : 'inicio',
              source: 'gaussian-center',
            },
          };
          revealInspector(`candidate-${initial?.id || 'new'}`);
        }}
      />
      {#if candidate}<div
          id={`candidate-${initial?.id || 'new'}`}
          class="candidate-panel"
          tabindex="-1"
        >
          <h4>Confirmar agarre seleccionado</h4>
          <p role="status">
            El marcador «?» muestra el punto en preparación. Elige su función y
            confirma para añadirlo.
          </p>
          <details>
            <summary>Ajustar posición del candidato</summary>
            <PointAdjuster
              position={candidate.positionWorld}
              prefix="Candidato"
              disabled={busy || imageBusy}
              onChange={(position) => {
                if (interaction.mode === 'review-candidate')
                  interaction.candidate.positionWorld = position;
              }}
            />
          </details>
          <label
            >Función del agarre<select bind:value={candidate.role}
              ><option value="inicio">Inicio</option><option value="intermedio"
                >Intermedio</option
              ><option value="final">Final</option></select
            ></label
          >
          <button type="button" onclick={addHold}
            >Añadir agarre a la ruta</button
          ><button type="button" onclick={cancelTool}
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
      disabled={toolBusy ||
        busy ||
        imageBusy ||
        !reuseIds.length ||
        holds3D.length + reuseIds.length > 40}
      onclick={reuse}>Confirmar copia de agarres</button
    >
  </details>
  <ol>
    {#each holds3D as h, i}<li
        id={`hold-${h.id}`}
        class:selected={adjustingHold === h.id}
      >
        Agarre {i + 1} · {h.role} · {h.position
          .map((n) => n.toFixed(3))
          .join(', ')}<button
          type="button"
          disabled={toolBusy && adjustingHold !== h.id}
          onclick={() => {
            beginEditHold(h.id);
          }}>Ajustar agarre {i + 1}</button
        ><button
          type="button"
          disabled={toolBusy}
          onclick={() => {
            checkpoint();
            holds3D = holds3D.filter((x) => x.id !== h.id);
            cancelTool();
            message = 'Agarre eliminado del borrador; puedes deshacer.';
          }}>Eliminar agarre {i + 1}</button
        >
        {#if editing?.id === h.id}<div
            id={`edit-${h.id}`}
            tabindex="-1"
            class="candidate-panel"
          >
            <h4>Editar agarre {i + 1} · cambios temporales</h4>
            <details>
              <summary>Ajustar posición del agarre {i + 1}</summary>
              <PointAdjuster
                position={editing.position}
                prefix={`Agarre ${i + 1}`}
                disabled={busy || imageBusy}
                onChange={(position) => {
                  if (interaction.mode === 'edit-hold')
                    interaction.hold.position = position;
                }}
              />
            </details>
            <label
              >Rol del agarre {i + 1}<select bind:value={editing.role}
                ><option value="inicio">Inicio</option><option
                  value="intermedio">Intermedio</option
                ><option value="final">Final</option></select
              ></label
            >
            <button type="button" onclick={applyEdit}>Aplicar ajuste</button
            ><button type="button" onclick={cancelTool}>Cancelar ajuste</button>
          </div>{/if}
      </li>{/each}
  </ol>
  <div class="actions">
    <button
      type="button"
      disabled={toolBusy || !undoStack.length}
      onclick={() => undo()}>Deshacer marcador</button
    ><button
      type="button"
      disabled={toolBusy || !redoStack.length}
      onclick={() => undo(true)}>Rehacer marcador</button
    >
  </div>
  <label class="toggle"
    ><input
      type="checkbox"
      bind:checked={markersVerified}
      disabled={toolBusy || busy || imageBusy}
    />Confirmé todos los agarres desde dos ángulos y el inicio/final son
    legibles</label
  >
  <label
    >Imagen anotada de respaldo (PNG, hasta 4 MB)<input
      type="file"
      accept="image/png"
      disabled={imageBusy || toolBusy}
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
        cancelTool();
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
  .candidate-panel {
    padding: 12px;
    border: 2px solid var(--accent, #235987);
    border-radius: 8px;
    margin-block: 12px;
  }
  li.selected {
    outline: 2px solid var(--accent, #235987);
    outline-offset: 4px;
  }
  .route-markers {
    border-top: 1px solid #d9dfe5;
    margin-top: 16px;
    padding-top: 12px;
  }
  li button {
    margin-left: 8px;
  }
</style>
