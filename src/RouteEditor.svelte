<script lang="ts">
  import { api, ApiError, supabase } from './auth';
  import {
    editorSteps,
    stepStates,
    differences,
    geometryKey,
    problemStep,
    type EditorStep,
  } from './editor-flow';
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
    onReload,
    onPreparing,
    onState,
    draft,
    onDraft,
    owner,
    sourceRoutes = [],
    initialSectionId = '',
  }: {
    initialSectionId?: string;
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
    onReload?: () => void;
    onPreparing?: (active: boolean) => void;
    onState?: (state: { dirty: boolean; busy: boolean }) => void;
  } = $props();
  const initial = untrack(() => route);
  const restored = untrack(() => draft);
  const draftOwner = untrack(() => owner);
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
  let editorRoot: HTMLDivElement;
  function alignInspector(node: HTMLElement, documentNavigation = false) {
    const panel = node.closest<HTMLElement>('#tools-panel');
    if (!panel) return;
    const n = node.getBoundingClientRect(),
      p = panel.getBoundingClientRect();
    const nav = node.closest('.route-editor')?.querySelector('nav');
    const navHeight =
      nav && getComputedStyle(nav).position === 'sticky'
        ? nav.getBoundingClientRect().height
        : 0;
    const footerHeight =
      node
        .closest('.route-editor')
        ?.querySelector('.editor-save-bar')
        ?.getBoundingClientRect().height || 0;
    if (getComputedStyle(panel).position === 'fixed') {
      if (
        n.top < p.top + navHeight + 12 ||
        n.bottom > p.bottom - footerHeight - 12
      )
        panel.scrollTop += n.top - p.top - navHeight - 12;
    } else if (documentNavigation)
      window.scrollTo({ top: window.scrollY + n.top - navHeight - 16 });
  }
  function revealInspector(id: string, documentNavigation = false) {
    const origin = document.activeElement;
    requestAnimationFrame(() => {
      if (
        document.activeElement !== origin &&
        document.activeElement !== document.body
      )
        return;
      const node = document.getElementById(id);
      if (!node) return;
      alignInspector(node, documentNavigation);
      node.focus({ preventScroll: true });
      // Workspace/portal updates and responsive navigation can finish in the next frame.
      requestAnimationFrame(() => {
        if (document.activeElement === node)
          alignInspector(node, documentNavigation);
      });
    });
  }
  onMount(() => {
    const panel = editorRoot.closest('#tools-panel'),
      nav = editorRoot.querySelector('nav');
    const observer = new ResizeObserver(() => {
      const node = document.activeElement;
      if (
        node instanceof HTMLElement &&
        node.closest('.route-editor') === editorRoot &&
        node.id.startsWith('editor-')
      )
        alignInspector(node, true);
    });
    if (panel) observer.observe(panel);
    if (nav) observer.observe(nav);
    return () => observer.disconnect();
  });
  function cancelTool() {
    const origin = document.activeElement;
    interaction = { mode: 'explore' };
    requestAnimationFrame(() => {
      if (
        document.activeElement !== origin &&
        document.activeElement !== document.body
      )
        return;
      if (returnFocus?.isConnected) {
        if (!returnFocus.closest('.route-marker-overlay'))
          alignInspector(returnFocus);
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
    if (step !== 3) step = 3;
    selectedPoint = [...h.position];
    focusRequest += 1;
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
  let sectionVersionNotice = $state('');
  let sections = $state<Section[]>([]),
    sectionId = $state(
      restored?.sectionId ||
        initial?.sectionId ||
        untrack(() => initialSectionId),
    );
  onMount(() => {
    api('/captures/current')
      .then((data) => (currentCapture = data.capture || undefined))
      .catch((e) => (message = e.message));
    api('/sections')
      .then(async (data) => {
        const current = data.sections.find(
          (section: Section) => section.id === initial?.sectionId,
        );
        const pinned = initial?.sectionRevision || 1;
        if (
          initial?.sectionId &&
          current &&
          (current.revision || 1) !== pinned
        ) {
          const historical = await api(
            `/sections/${initial.sectionId}/revisions/${pinned}`,
          );
          data.sections = data.sections.map((section: Section) =>
            section.id === initial.sectionId ? historical.section : section,
          );
          sectionVersionNotice = `Esta ruta conserva la revisión ${pinned} de su zona. La zona actual tiene revisión ${current.revision}.`;
        }
        sections = data.sections;
        sectionId =
          restored?.sectionId || initial?.sectionId || initialSectionId;
      })
      .catch((e) => (message = e.message));
  });
  onDestroy(() => {
    if (!savedDraft && (changed.length || toolBusy))
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
        basedOnRevision: initial?.revision || 0,
      });
    onPreparing?.(false);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  });
  let savedDraft = $state(false);
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
    step = $state<EditorStep>(1),
    imageBusy = $state(false),
    message = $state(''),
    busy = $state(false);
  const published = $derived(!!initial && initial.status !== 'borrador');
  let sheetHeight = $state('medium');
  let previewWidth = $state('mobile');
  let firstAngle = $state(untrack(() => markersVerified)),
    secondAngle = $state(untrack(() => markersVerified));
  let focusRequest = $state(0);
  let selectedPoint = $state<Point | undefined>();
  let localKept = $state(false);
  let conflict = $state(
    !!restored?.basedOnRevision &&
      restored.basedOnRevision !== initial?.revision,
  );
  let serverProblem = $state<EditorStep | undefined>();
  function values(): EditorDraft {
    return {
      name,
      grade,
      gradeScale,
      sector: sections.find((s) => s.id === sectionId)?.name || sector,
      beta,
      status,
      rules,
      sectionId,
      holds3D,
      camera,
      imageId,
      markersVerified,
      changeReason,
      basedOnRevision: initial?.revision || 0,
    };
  }
  const baseline: EditorDraft = untrack(() => ({
    name: initial?.name || '',
    grade: initial?.grade || 'V1',
    gradeScale: initial?.gradeScale || inferScale(initial?.grade || 'V1'),
    sector: initial?.sector || 'Spray wall',
    beta: initial?.beta || '',
    status: initial?.status || 'borrador',
    rules: initial?.rules || '',
    sectionId: initial?.sectionId || '',
    holds3D: structuredClone($state.snapshot(initial?.holds3D || [])),
    camera: initial?.captureId ? initial.camera : undefined,
    imageId: initial?.imageId || '',
    markersVerified: initial?.markersVerified || false,
    changeReason: '',
  }));
  const changed = $derived(differences(values(), baseline));
  $effect(() => {
    onState?.({
      dirty: !savedDraft && (changed.length > 0 || toolBusy),
      busy: busy || imageBusy,
    });
  });
  const states = $derived.by(() => {
    const result = stepStates(
      { ...values(), captureId: initial?.captureId || currentCapture?.id },
      baseline,
    );
    if (serverProblem) result[serverProblem - 1] = 'Pendiente';
    return result;
  });
  let lastGeometry = untrack(() =>
    geometryKey({ ...values(), captureId: initial?.captureId }),
  );
  $effect(() => {
    const key = geometryKey({
      ...values(),
      captureId: initial?.captureId || currentCapture?.id,
    });
    if (key !== lastGeometry) {
      lastGeometry = key;
      untrack(() => {
        clearImage();
        markersVerified = false;
        firstAngle = false;
        secondAngle = false;
        serverProblem = undefined;
      });
    }
  });
  $effect(() => {
    const active = preparing3D,
      height = sheetHeight;
    const panel = document.getElementById('tools-panel');
    if (!panel || !active) return;
    panel.dataset.editorSheet = height;
    const syncScene = () => {
      if (
        document.activeElement?.matches('input,textarea,[contenteditable=true]')
      )
        return;
      document.documentElement.style.setProperty(
        '--editor-scene-height',
        `${Math.max(120, (window.innerHeight / (Number(getComputedStyle(document.documentElement).zoom) || 1) - parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--workspace-top'))) * 0.48)}px`,
      );
    };
    syncScene();
    window.addEventListener('resize', syncScene);
    // Keyboard affects the inspector only; the renderer remains in its existing workspace.
    const viewport = window.visualViewport;
    const resize = () =>
      panel.style.setProperty(
        '--keyboard-inset',
        `${Math.max(0, window.innerHeight - (viewport?.height || window.innerHeight) - (viewport?.offsetTop || 0))}px`,
      );
    resize();
    viewport?.addEventListener('resize', resize);
    return () => {
      delete panel.dataset.editorSheet;
      panel.style.removeProperty('--keyboard-inset');
      viewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', syncScene);
    };
  });
  function keepLocal() {
    if (toolBusy || busy || imageBusy) return;
    onDraft?.(
      draftOwner,
      initial?.id || 'new',
      initial?.revision || 0,
      structuredClone($state.snapshot(values())),
    );
    localKept = true;
    message =
      'Preparación conservada durante esta sesión. No se guardó en servidor; recargar puede perderla.';
  }
  async function save(target: Route['status'] = status) {
    if (busy || imageBusy || toolBusy || conflict) return;
    if (target !== 'borrador' && serverProblem) return;
    if (target === 'activa' && pending.length) {
      message = 'Completa los pasos pendientes antes de publicar.';
      return;
    }
    if (
      initial &&
      (initial.status === 'retirada') !== (target === 'retirada') &&
      !changeReason.trim()
    ) {
      message = 'Indica el motivo del cambio.';
      return;
    }
    busy = true;
    message = '';
    const rejectedImage = serverProblem === 5;
    serverProblem = undefined;
    try {
      const result = await api(
        route ? `/routes/${route.id}` : '/routes',
        {
          name,
          grade,
          gradeScale,
          rules,
          imageId: target === 'borrador' && rejectedImage ? '' : imageId,
          markersVerified,
          changeReason,
          sector: sections.find((s) => s.id === sectionId)?.name || sector,
          sectionId,
          ...(route?.captureId || currentCapture?.id
            ? { captureId: route?.captureId || currentCapture?.id }
            : {}),
          beta,
          status: target,
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
      if (e instanceof ApiError && e.status === 409) conflict = true;
      else if (/imagen|respaldo/i.test(message)) serverProblem = 5;
      else if (/c[aá]mara|captura/i.test(message)) serverProblem = 2;
      else if (/agarre|inicio|final/i.test(message)) serverProblem = 3;
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
      if (serverProblem === 5) serverProblem = undefined;
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
  function goStep(value: EditorStep) {
    if (toolBusy) {
      message =
        'Aplica o cancela la preparación actual antes de cambiar de paso.';
      return;
    }
    step = value;
    revealInspector(`editor-${initial?.id || 'new'}-${value}`, true);
    interaction = {
      mode: [4, 5, 6].includes(value) ? 'review-route' : 'explore',
    };
  }
</script>

<svelte:window
  onkeydown={(e) => {
    const target = e.target as HTMLElement;
    if (
      !target.closest('.route-editor') &&
      !target.matches('.workspace-canvas')
    )
      return;
    if (e.key === 'Escape' && toolBusy) {
      e.preventDefault();
      cancelTool();
      return;
    }
    if (target.closest('input,textarea,select,[contenteditable="true"]'))
      return;
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === 'z' &&
      !toolBusy &&
      !busy &&
      !imageBusy
    ) {
      if ((e.shiftKey ? redoStack : undoStack).length) {
        e.preventDefault();
        undo(e.shiftKey);
      }
      return;
    }
    if (
      e.key.toLowerCase() === 'f' &&
      preparing3D &&
      (candidate || editing || selectedPoint)
    ) {
      e.preventDefault();
      focusRequest += 1;
    }
    if (e.key === 'Escape' && toolBusy) {
      e.preventDefault();
      e.stopPropagation();
      cancelTool();
    }
  }}
/>

<div bind:this={editorRoot} class="route-editor" data-step={step}>
  <h2>{route ? 'Editar ruta' : 'Crear ruta'}</h2>
  {#if published}<p>
      Versión publicada · Revisión {initial?.revision}. La preparación no cambia
      esta versión.
    </p>{/if}
  <p role="status">
    {changed.length
      ? 'Cambios sin guardar'
      : 'Sin cambios pendientes'}{localKept && changed.length
      ? ' · Preparación local'
      : ''}
  </p>
  <nav aria-label="Pasos del editor">
    <div
      class="sheet-controls"
      hidden={!preparing3D}
      aria-label="Altura del inspector"
    >
      {#each [['compact', 'Compacto'], ['medium', 'Medio'], ['expanded', 'Ampliado']] as [value, label]}<button
          type="button"
          aria-pressed={sheetHeight === value}
          onclick={() => (sheetHeight = value)}>{label}</button
        >{/each}
    </div>

    <label class="compact-step-nav"
      >Paso del editor<select
        value={step}
        onchange={(e) => {
          goStep(Number(e.currentTarget.value) as EditorStep);
          e.currentTarget.value = String(step);
        }}
        >{#each editorSteps as title, i}<option value={i + 1}
            >{i + 1}. {title} · {states[i]}</option
          >{/each}</select
      ></label
    >
    <ol class="editor-steps">
      {#each editorSteps as title, i}<li>
          <button
            type="button"
            aria-current={step === i + 1 ? 'step' : undefined}
            onclick={() => goStep((i + 1) as EditorStep)}
            >{i + 1}. {title}<small>{states[i]}</small></button
          >
        </li>{/each}
    </ol>
  </nav>
  <p>
    Paso {step} de 6. Puedes volver a cualquier paso sin perder la preparación.
  </p>
  {#if message}<p role="status" class="editor-message">{message}</p>{/if}
  {#if serverProblem}<button
      type="button"
      onclick={() => goStep(serverProblem!)}
      >Revisar {editorSteps[serverProblem - 1]}</button
    >{/if}
  <form onsubmit={(e) => e.preventDefault()}>
    <div hidden={step !== 1}>
      {#if sectionVersionNotice && sectionId === initial?.sectionId}<p
          role="status"
        >
          {sectionVersionNotice}
        </p>{/if}
      <h3 tabindex="-1" id={`editor-${initial?.id || 'new'}-1`}>
        Datos de la ruta
      </h3>
      <label
        >Nombre de ruta<input
          bind:value={name}
          maxlength="80"
          aria-invalid={pending.includes('Nombre')}
          aria-describedby={`editor-name-error-${initial?.id || 'new'}`}
        /></label
      ><label
        >Grado de ruta<input
          bind:value={grade}
          maxlength="15"
          aria-invalid={pending.includes('Escala y grado')}
          aria-describedby={`editor-grade-error-${initial?.id || 'new'}`}
        /></label
      ><label
        >Sección<select
          bind:value={sectionId}
          aria-invalid={pending.includes('Sector')}
          aria-describedby={`editor-sector-error-${initial?.id || 'new'}`}
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
        >Reglas de pies y restricciones<textarea
          bind:value={rules}
          maxlength="2000"></textarea></label
      ><label
        >Beta<textarea bind:value={beta} maxlength="2000"></textarea></label
      >
      <p
        id={`editor-name-error-${initial?.id || 'new'}`}
        hidden={!pending.includes('Nombre')}
      >
        Nombre pendiente para publicar. Puedes guardar un borrador incompleto.
      </p>
      <p
        id={`editor-grade-error-${initial?.id || 'new'}`}
        hidden={!pending.includes('Escala y grado')}
      >
        Indica escala y grado antes de publicar.
      </p>
      <p
        id={`editor-sector-error-${initial?.id || 'new'}`}
        hidden={!pending.includes('Sector')}
      >
        Selecciona una sección antes de publicar.
      </p>
    </div>
  </form>

  <section class="route-markers">
    <div hidden={step !== 2}>
      <h3 tabindex="-1" id={`editor-${initial?.id || 'new'}-2`}>
        Encuadre de la ruta
      </h3>
      <p>{currentCapture?.filename || 'Captura pendiente'}</p>
      <p>
        Ajusta el encuadre y guarda la cámara de esta ruta. No cambia la cámara
        del gimnasio.
      </p>
    </div>
    <div hidden={step !== 3}>
      <h3 tabindex="-1" id={`editor-${initial?.id || 'new'}-3`}>
        Agarres 3D de la ruta
      </h3>
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
    </div>
    {#if currentCapture && (!route?.captureId || route.captureId === currentCapture.id)}
      <button
        hidden={![2, 3, 4, 5].includes(step) && !preparing3D}
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
          editorStep={step}
          {focusRequest}
          onSave={(view) => {
            if (JSON.stringify(camera) !== JSON.stringify(view)) {
              camera = view;
              clearImage();
              markersVerified = false;
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
          focusPoint={candidate?.positionWorld ||
            editing?.position ||
            selectedPoint}
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
              El marcador «?» muestra el punto en preparación. Elige su función
              y confirma para añadirlo.
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
                ><option value="inicio">Inicio</option><option
                  value="intermedio">Intermedio</option
                ><option value="final">Final</option></select
              ></label
            >
            <div class="transaction-actions">
              <button type="button" onclick={addHold}
                >Añadir agarre a la ruta</button
              ><button type="button" onclick={cancelTool}
                >Descartar agarre seleccionado</button
              >
            </div>
          </div>{/if}
      {/if}
    {:else}<p>
        {currentCapture
          ? 'Importa esta ruta a la captura vigente antes de preparar marcadores.'
          : 'Publica una captura del gimnasio para preparar los agarres en 3D.'}
      </p>{/if}
    <div hidden={step !== 3}>
      <details>
        <summary>Reutilizar agarres de otra ruta</summary>
        <p>
          Se copiarán a este borrador; las otras rutas y sus consejos no
          cambian.
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
            Agarre {i + 1} · {h.role}<button
              type="button"
              disabled={toolBusy && adjustingHold !== h.id}
              onclick={() => {
                beginEditHold(h.id);
              }}>Ajustar agarre {i + 1}</button
            ><button
              type="button"
              disabled={toolBusy || busy || imageBusy}
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
                <div class="transaction-actions">
                  <button type="button" onclick={applyEdit}
                    >Aplicar ajuste</button
                  ><button type="button" onclick={cancelTool}
                    >Cancelar ajuste</button
                  >
                </div>
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
    </div>
    <div hidden={step !== 4}>
      <h3 tabindex="-1" id={`editor-${initial?.id || 'new'}-4`}>
        Verificar desde dos ángulos
      </h3>
      <p>
        Primero observa la ruta de frente: reconoce cada ancla y los
        inicios/finales. Después orbita hacia un lateral: comprueba profundidad
        y que ningún punto quede delante o detrás del agarre. Si corriges
        geometría, repite la revisión.
      </p>
      <label class="toggle"
        ><input
          type="checkbox"
          bind:checked={firstAngle}
          disabled={toolBusy || busy || imageBusy}
          onchange={() => {
            if (!firstAngle) markersVerified = false;
          }}
        />Revisé la vista frontal</label
      >
      <label class="toggle"
        ><input
          type="checkbox"
          bind:checked={secondAngle}
          disabled={toolBusy || busy || imageBusy}
          onchange={() => {
            if (!secondAngle) markersVerified = false;
          }}
        />Revisé la vista lateral y la profundidad</label
      >
      <p>
        Estas confirmaciones son revisión humana, no reconocimiento automático
        del muro.
      </p>
      <label class="toggle"
        ><input
          type="checkbox"
          bind:checked={markersVerified}
          disabled={toolBusy ||
            busy ||
            imageBusy ||
            !firstAngle ||
            !secondAngle}
        />Confirmé todos los agarres desde dos ángulos y el inicio/final son
        legibles</label
      >
    </div>
    <div hidden={step !== 5}>
      <h3 tabindex="-1" id={`editor-${initial?.id || 'new'}-5`}>
        Imagen de respaldo
      </h3>
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
        La imagen debe mostrar esta cámara y estos agarres. También puedes
        generarla desde la preparación 3D.
      </p>
      {#if imagePreview}<img
          src={imagePreview}
          alt="Imagen de respaldo preparada para publicar"
        />{/if}
    </div>
    <div hidden={step !== 6}>
      <h3 tabindex="-1" id={`editor-${initial?.id || 'new'}-6`}>
        Revisar y publicar
      </h3>
      <label
        >Tamaño de previsualización<select bind:value={previewWidth}
          ><option value="mobile">Móvil</option><option value="desktop"
            >Escritorio</option
          ></select
        ></label
      >
      <div
        class="public-preview"
        class:mobile-preview={previewWidth === 'mobile'}
      >
        <div
          class="preview-content"
          class:desktop-preview={previewWidth === 'desktop'}
        >
          <h4>{name || 'Ruta sin nombre'} · {grade}</h4>
          <p>
            {sections.find((s) => s.id === sectionId)?.name || sector} · {initial?.status ||
              'borrador'}
          </p>
          {#if step === 6}<RoutePresentation
              route={{
                id: initial?.id || 'preview',
                revision: (initial?.revision || 0) + 1,
                name,
                grade,
                gradeScale,
                sector:
                  sections.find((s) => s.id === sectionId)?.name || sector,
                beta,
                rules,
                status: 'borrador',
                holds: initial?.holds || [],
                holds3D,
                imageId,
                camera,
                captureId: initial?.captureId || currentCapture?.id,
                illustrationId: initial?.illustrationId,
              }}
              imageUrl={imagePreview}
            />
          {/if}
        </div>
      </div>
      <p>
        Diferencias frente a la versión guardada: {changed.length
          ? changed.join(', ')
          : 'Ninguna'}.
      </p>
      {#if pending.length}<p>Pendientes para publicar:</p>
        <ul>
          {#each pending as problem}<li>
              <button type="button" onclick={() => goStep(problemStep(problem))}
                >{problem} · Ir a {editorSteps[
                  problemStep(problem) - 1
                ]}</button
              >
            </li>{/each}
        </ul>{:else}<p>Lista para publicar.</p>{/if}
      {#if published}<p>
          Actualizar conserva URL, QR y revisiones históricas. Retirar quita la
          ruta del catálogo activo; reactivar la devuelve. La bitácora se
          conserva.
        </p>
        <label
          >Motivo del cambio<textarea bind:value={changeReason} maxlength="2000"
          ></textarea></label
        >{/if}
      {#if conflict}<p role="alert">
          La revisión guardada cambió. Conserva la preparación local y vuelve a
          abrir la ruta actualizada para revisar las diferencias antes de
          enviarla.
        </p>
        {#if onReload}<button
            type="button"
            onclick={() => {
              keepLocal();
              onReload?.();
            }}>Recargar versión guardada</button
          >{/if}
      {/if}
      {#if conflict && restored?.basedOnRevision && restored.basedOnRevision !== initial?.revision}<p
        >
          Preparación basada en revisión {restored.basedOnRevision}; versión
          actual {initial?.revision}. Revisa los seis pasos antes de confirmar.
        </p>
        <button
          type="button"
          onclick={() => {
            conflict = false;
            message =
              'Comparación de revisiones confirmada; revisa los pendientes antes de publicar.';
          }}>Revisé la nueva revisión y las diferencias</button
        >{/if}
      <div class="actions">
        <button
          type="button"
          disabled={busy ||
            imageBusy ||
            toolBusy ||
            conflict ||
            !!serverProblem ||
            (initial?.status === 'retirada' && !changeReason.trim()) ||
            pending.length > 0}
          onclick={() => save('activa')}
          >{initial?.status === 'activa'
            ? 'Actualizar ruta'
            : initial?.status === 'retirada'
              ? 'Reactivar ruta'
              : 'Publicar ruta'}</button
        >
        {#if published && initial?.status === 'activa'}<button
            type="button"
            disabled={busy ||
              imageBusy ||
              toolBusy ||
              conflict ||
              !!serverProblem ||
              pending.length > 0 ||
              !changeReason.trim()}
            onclick={() => save('retirada')}>Confirmar retiro</button
          >{/if}
      </div>
    </div>
    {#if holds3D.length || camera}<button
        hidden={step !== 3}
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
  <div class="editor-save-bar">
    <button
      type="button"
      disabled={busy || imageBusy || toolBusy || (!published && conflict)}
      onclick={() => (published ? keepLocal() : save('borrador'))}
      >{busy
        ? 'Guardando…'
        : published
          ? 'Conservar preparación local'
          : 'Guardar borrador'}</button
    >
    {#if published}<small>Local, sin servidor. Recargar puede perderla.</small
      >{/if}
  </div>
</div>

<style>
  [hidden] {
    display: none !important;
  }
  .editor-steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    list-style: none;
    padding: 0;
    gap: 6px;
  }
  .editor-steps li button {
    margin: 0;
    width: 100%;
    min-height: 60px;
    text-align: left;
    overflow-wrap: anywhere;
  }
  .editor-steps small {
    display: block;
    font-weight: normal;
  }
  .editor-steps [aria-current] {
    outline: 2px solid var(--accent);
  }
  .route-editor {
    container-type: inline-size;
  }
  nav {
    padding: 0;
    position: sticky;
    top: 0;
    z-index: 5;
    display: block;
    background: var(--surface);
  }
  .compact-step-nav {
    display: none;
  }
  @container (max-width:280px) {
    nav {
      position: static;
    }
    .compact-step-nav {
      display: block;
    }
    .editor-steps {
      display: none;
    }
  }
  .editor-save-bar {
    position: sticky;
    bottom: 0;
    background: var(--surface);
    padding: 10px 0;
    border-top: 1px solid var(--border);
    z-index: 4;
  }
  .editor-save-bar small {
    display: block;
  }
  .public-preview {
    overflow: auto;
    max-width: 100%;
  }
  .preview-content.desktop-preview {
    width: 768px;
  }
  .public-preview.mobile-preview {
    max-width: 390px;
  }
  .sheet-controls {
    display: none;
  }
  @media (max-width: 750px) {
    .editor-steps {
      display: none;
    }
    .compact-step-nav {
      display: block;
    }
    .sheet-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  }
  .transaction-actions {
    position: sticky;
    bottom: 70px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-block: 8px;
    background: var(--surface);
    z-index: 3;
  }
  .candidate-panel {
    padding: 12px;
    border: 2px solid var(--accent, #235987);
    border-radius: 8px;
    margin-block: 12px;
    background: var(--surface);
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
