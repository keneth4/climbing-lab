<script lang="ts">
  import { untrack, tick } from 'svelte';
  import { api, ApiError } from './auth';
  import type { Section, Capture } from './twin';
  import type { Route } from './domain';
  import type { Point } from '../shared/alignment';
  import type { SectionTool } from './section-tool';
  import {
    polygonGeometry,
    polygonBounds,
    geometryVertices,
    geometryPlane,
    planeFromPoints,
    projectVertex,
    worldToUV,
    uvToWorld,
    type SectionGeometry,
    type OrientedPlane,
    type AxisPolygon,
  } from '../shared/sections';
  let {
    sections,
    capture,
    bounds,
    routes,
    onTool,
    onRefresh,
    onCreateRoute,
  }: {
    sections: Section[];
    capture?: Capture;
    bounds?: Section['bounds'];
    routes: Route[];
    onTool: (tool: SectionTool) => void;
    onRefresh: () => Promise<void>;
    onCreateRoute: (id: string) => void;
  } = $props();
  type Draft = {
    name: string;
    kind: 'wall' | 'accessible-area';
    mode: 'box' | 'contour' | 'inclined';
    axis: AxisPolygon['plane'];
    elevation: number;
    thickness: number;
    points: Point[];
    vertices: Point[];
    center: Point;
    size: Point;
    closed: boolean;
  };
  const fresh = (): Draft => ({
    name: '',
    kind: 'wall',
    mode: 'box',
    axis: 'XY',
    elevation: 0,
    thickness: 0.5,
    points: [],
    vertices: [],
    center: [0, 0, 0],
    size: [2, 2, 1],
    closed: false,
  });
  let draft = $state<Draft>(fresh()),
    active = $state(false),
    step = $state(1),
    selectedId = $state(''),
    editId = $state(''),
    revision = $state(0),
    message = $state(''),
    busy = $state(false),
    conflict = $state(false),
    baseLoaded = $state(false),
    reviewed = $state(false),
    savedId = $state('');
  let past = $state<Draft[]>([]),
    future = $state<Draft[]>([]),
    temporary = $state<{ index: number; position: Point } | undefined>(),
    adding = $state(false),
    surfacePicking = $state(true),
    selectedVertex = $state(-1),
    height = $state('medium');
  let history = $state<
    { revision: number; section: Section; createdAt: string }[]
  >([]);
  let camera = $state<SectionTool['camera']>(),
    cameraId = 0;
  let root: HTMLElement;
  let originControl: HTMLElement | undefined;
  let focusRequest = $state(0);
  const clone = (value: Draft): Draft =>
    structuredClone($state.snapshot(value));
  function change(next: Draft) {
    if (JSON.stringify(next) === JSON.stringify(draft)) return;
    past = [...past, clone(draft)].slice(-50);
    future = [];
    draft = next;
    reviewed = false;
    message = 'Cambios sin guardar';
  }
  function undo(redo = false) {
    if (busy) return;
    if (temporary) {
      message = 'Aplica o cancela el ajuste antes de deshacer.';
      return;
    }
    const source = redo ? future : past;
    if (!source.length) return;
    if (redo) {
      past = [...past, clone(draft)];
      future = future.slice(0, -1);
    } else {
      future = [...future, clone(draft)];
      past = past.slice(0, -1);
    }
    draft = clone(source[source.length - 1]);
    reviewed = false;
  }
  let plane = $derived.by(() => {
    try {
      return draft.mode === 'inclined'
        ? planeFromPoints(draft.points)
        : undefined;
    } catch {
      return undefined;
    }
  });
  let shape = $derived.by((): SectionGeometry | undefined => {
    if (draft.mode === 'box') return;
    if (draft.mode === 'inclined')
      return plane
        ? {
            type: 'oriented-polygon',
            plane,
            thickness: draft.thickness,
            verticesUV: displayedVertices.map((p) => worldToUV(p, plane!)),
          }
        : undefined;
    return {
      type: 'polygon',
      plane: draft.axis,
      elevation: draft.elevation,
      thickness: draft.thickness,
      vertices: displayedVertices.map((p) =>
        projectVertex(p, draft.axis, draft.elevation),
      ),
    };
  });
  let preview = $derived.by((): Section | undefined => {
    if (!active) return sections.find((s) => s.id === selectedId);
    const min = draft.center.map((n, i) => n - draft.size[i] / 2) as Point,
      max = draft.center.map((n, i) => n + draft.size[i] / 2) as Point;
    return {
      id: editId || 'section-preview',
      name: draft.name || 'Zona en preparación',
      kind: draft.kind,
      geometry: shape,
      bounds:
        shape && geometryVertices(shape).length
          ? polygonBounds(shape)
          : { min, max },
    };
  });
  let problems = $derived.by(() => {
    const errors: string[] = [];
    if (!draft.name.trim()) errors.push('Escribe un nombre para la zona.');
    if (draft.mode === 'inclined' && !plane)
      errors.push('Selecciona tres puntos distintos y no alineados.');
    if (draft.mode !== 'box') {
      if (!draft.closed) errors.push('Cierra el contorno.');
      try {
        polygonGeometry(shape);
      } catch (e) {
        errors.push((e as Error).message);
      }
    } else if (
      ![...draft.center, ...draft.size].every(Number.isFinite) ||
      draft.size.some((n) => n < 0.01) ||
      preview?.bounds.min.some(
        (n, i) => Math.abs(n) > 1e6 || Math.abs(preview!.bounds.max[i]) > 1e6,
      )
    )
      errors.push(
        'La caja debe tener tamaños positivos y coordenadas finitas.',
      );
    return errors;
  });
  const dependencies = $derived(routes.filter((r) => r.sectionId === editId));
  let displayedVertices = $derived(
    temporary
      ? draft.vertices.map((p, i) =>
          i === temporary!.index ? temporary!.position : p,
        )
      : draft.vertices,
  );
  function pick(world: Point) {
    if (!active || busy || (step === 2 && !surfacePicking)) return;
    const next = clone(draft);
    if (step === 2 && draft.mode === 'inclined' && draft.points.length < 3) {
      if (
        draft.points.some(
          (p) => Math.hypot(...p.map((n, i) => n - world[i])) < 1e-5,
        )
      ) {
        message = 'Este punto ya está seleccionado.';
        return;
      }
      next.points.push([...world]);
      if (next.points.length === 3)
        try {
          planeFromPoints(next.points);
        } catch (e) {
          message = (e as Error).message;
          return;
        }
      change(next);
      return;
    }
    if (step === 2 && draft.mode === 'box') {
      surfacePicking = false;
      next.center = [...world];
      change(next);
      return;
    }
    if (step !== 3 || !adding || draft.closed || draft.vertices.length >= 32)
      return;
    const projected = plane
      ? uvToWorld(worldToUV(world, plane), plane)
      : projectVertex(world, draft.axis, draft.elevation);
    next.vertices.push(projected);
    change(next);
  }
  function cancelAdjustment() {
    temporary = undefined;
    adding = false;
    surfacePicking = false;
    const origin = originControl;
    tick().then(
      () => origin?.isConnected && origin.focus({ preventScroll: true }),
    );
    message = 'Ajuste cancelado; geometría conservada.';
  }
  function inspect(index: number) {
    if (busy) return;
    if (temporary) {
      message = 'Aplica o cancela el ajuste actual.';
      return;
    }
    originControl =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    selectedVertex = index;
    focusRequest++;
    adding = false;
    temporary = { index, position: [...draft.vertices[index]] };
  }
  function nudge(axis: number, delta: number) {
    if (!temporary || !shape) return;
    const basis = geometryPlane(shape),
      uv = worldToUV(temporary.position, basis);
    uv[axis] += delta;
    temporary = { ...temporary, position: uvToWorld(uv, basis) };
  }
  function apply() {
    if (!temporary) return;
    const next = clone(draft);
    next.vertices[temporary.index] = [...temporary.position];
    temporary = undefined;
    change(next);
  }
  function navigate(next: number) {
    if (temporary) {
      message = 'Aplica o cancela el ajuste antes de cambiar de paso.';
      return;
    }
    adding = false;
    step = next;
    tick().then(() => {
      const heading = root?.querySelector<HTMLElement>('.step-heading');
      const pane =
        getComputedStyle(root).position === 'fixed'
          ? root
          : root.closest<HTMLElement>('#tools-panel');
      if (heading && pane) {
        const y =
          heading.getBoundingClientRect().top -
          pane.getBoundingClientRect().top;
        pane.scrollTop = Math.max(0, pane.scrollTop + y - 64);
        heading.focus({ preventScroll: true });
      }
    });
  }
  function begin(mode: Draft['mode']) {
    if (temporary) {
      message = 'Aplica o cancela el ajuste antes de cambiar de herramienta.';
      return;
    }
    const next = clone(draft);
    next.mode = mode;
    next.vertices = [];
    next.points = [];
    next.closed = false;
    if (!active && bounds) {
      next.center = bounds.min.map((n, i) => (n + bounds.max[i]) / 2) as Point;
      next.size = bounds.min.map((n, i) =>
        Math.max(0.1, (bounds.max[i] - n) * 0.3),
      ) as Point;
    }
    active = true;
    surfacePicking = true;
    change(next);
    step = 2;
    adding = false;
  }
  function edit(section: Section, baseRevision = section.revision || 1) {
    if (temporary) {
      message = 'Aplica o cancela el ajuste actual.';
      return;
    }
    const next = fresh();
    next.name = section.name;
    next.kind = section.kind || 'wall';
    next.center = section.bounds.min.map(
      (n, i) => (n + section.bounds.max[i]) / 2,
    ) as Point;
    next.size = section.bounds.min.map(
      (n, i) => section.bounds.max[i] - n,
    ) as Point;
    if (section.geometry) {
      const g = section.geometry;
      next.mode = g.type === 'polygon' ? 'contour' : 'inclined';
      next.vertices = geometryVertices(g).map((p) => [...p]);
      next.thickness = g.thickness;
      next.closed = true;
      if (g.type === 'polygon') {
        next.axis = g.plane;
        next.elevation = g.elevation;
      } else {
        next.points = [
          g.plane.origin,
          uvToWorld([1, 0], g.plane),
          uvToWorld([0, 1], g.plane),
        ];
      }
    }
    draft = next;
    active = true;
    editId = section.id;
    revision = baseRevision;
    past = [];
    future = [];
    conflict = false;
    reviewed = false;
    step = 1;
    adding = false;
    savedId = '';
  }
  function cancel() {
    draft = fresh();
    active = false;
    editId = '';
    revision = 0;
    temporary = undefined;
    adding = false;
    past = [];
    future = [];
    conflict = false;
    reviewed = false;
    selectedVertex = -1;
    camera = undefined;
    message = 'Preparación cancelada; no se guardaron cambios.';
  }
  let stamp = untrack(() => capture?.id + ':' + capture?.version);
  $effect(() => {
    const next = capture?.id + ':' + capture?.version;
    if (next !== stamp) {
      stamp = next;
      untrack(cancel);
      message = 'La captura cambió; preparación cancelada.';
    }
  });
  $effect(() => {
    const vertices = displayedVertices,
      points = draft.points;
    onTool({
      active,
      focusRequest,
      focusPoint:
        selectedVertex >= 0 ? displayedVertices[selectedVertex] : undefined,
      section: preview,
      markers: (!active
        ? []
        : draft.mode === 'inclined' && step === 2
          ? points
          : vertices
      ).map((position, i) => ({
        id: 'zone-' + i,
        position,
        role: 'intermedio',
      })),
      selected: selectedVertex >= 0 ? 'zone-' + selectedVertex : undefined,
      picking:
        active &&
        ((step === 2 &&
          surfacePicking &&
          (draft.mode === 'box' ||
            (draft.mode === 'inclined' && points.length < 3))) ||
          (step === 3 && adding && !draft.closed)),
      pick,
      select: (id) => {
        const index = Number(id.replace('zone-', ''));
        if (active && step === 3 && index >= 0 && index < draft.vertices.length)
          inspect(index);
      },
      cancel: cancelAdjustment,
      setPicking: (value) => {
        if (step === 2) surfacePicking = value;
        else if (step === 3 && !draft.closed) adding = value;
      },
      camera,
    });
  });
  async function save() {
    if (busy || temporary || conflict || problems.length || !reviewed) return;
    busy = true;
    message = 'Guardando zona…';
    try {
      const result = await api(
        editId ? '/sections/' + editId : '/sections',
        {
          ...(editId ? { expectedRevision: revision } : {}),
          name: draft.name,
          kind: draft.kind,
          ...(shape
            ? { geometry: polygonGeometry(shape) }
            : { min: preview!.bounds.min, max: preview!.bounds.max }),
        },
        editId ? 'PUT' : 'POST',
      );
      savedId = result.id;
      selectedId = result.id;
      active = false;
      editId = '';
      past = [];
      future = [];
      await onRefresh();
      message =
        'Zona guardada. Las rutas anteriores conservan su revisión histórica.';
    } catch (e) {
      conflict = e instanceof ApiError && e.status === 409;
      baseLoaded = false;
      message = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function loadHistory() {
    try {
      const response = await api('/sections/' + selectedId + '/revisions');
      history = response.revisions;
    } catch (e) {
      message = (e as Error).message;
    }
  }
  function keyboard(e: KeyboardEvent) {
    if (!active || busy) return;
    if (
      e.target instanceof HTMLElement &&
      e.target.closest('input,textarea,select,[contenteditable=true]')
    )
      return;
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelAdjustment();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo(e.shiftKey);
    }
  }
</script>

<svelte:window onkeydown={keyboard} />
<section
  bind:this={root}
  class="section-editor"
  class:preparing={active}
  data-height={height}
  aria-label="Editor de zonas"
>
  <h2>Definir sección estable</h2>
  <p role="status">{message}</p>
  {#if !active}
    <label
      >Mostrar sección en la vista<select
        bind:value={selectedId}
        disabled={active || busy}
        onchange={() => (history = [])}
        ><option value="">Ninguna</option>{#each sections as section}<option
            value={section.id}>{section.name}</option
          >{/each}</select
      ></label
    >
    <div class="actions">
      <button
        type="button"
        disabled={active || busy || !selectedId}
        onclick={() => edit(sections.find((s) => s.id === selectedId)!)}
        >Editar sección seleccionada</button
      ><button
        type="button"
        disabled={busy || !selectedId}
        onclick={loadHistory}>Ver historial de sección</button
      >
    </div>
    {#if history.length}<details>
        <summary>Historial de sección</summary>
        <ol>
          {#each history as entry}<li>
              Revisión {entry.revision} · {entry.section.name}<button
                type="button"
                disabled={busy}
                onclick={() =>
                  edit(
                    entry.section,
                    sections.find((s) => s.id === selectedId)?.revision || 1,
                  )}>Preparar esta revisión para restaurar</button
              >
            </li>{/each}
        </ol>
      </details>{/if}
  {/if}
  {#if !active}<p>
      Elige una herramienta para crear una zona. Las áreas visitables no pueden
      recibir agarres de rutas.
    </p>
    <div class="actions">
      <button
        type="button"
        disabled={!capture || busy}
        onclick={() => begin('box')}>Preparar sección visual</button
      ><button
        type="button"
        disabled={!capture || busy}
        onclick={() => begin('contour')}>Delimitar con vértices</button
      ><button
        type="button"
        disabled={!capture || busy}
        onclick={() => begin('inclined')}>Plano inclinado · tres puntos</button
      >
    </div>
    {#if savedId && sections.find((s) => s.id === savedId)?.kind !== 'accessible-area'}<button
        type="button"
        onclick={() => onCreateRoute(savedId)}>Crear ruta en esta zona</button
      >{/if}
  {:else}
    <div
      class="mobile-heights"
      role="group"
      aria-label="Altura del panel de zonas"
    >
      {#each [['compact', 'Compacto'], ['medium', 'Medio'], ['expanded', 'Ampliado']] as [value, label]}<button
          type="button"
          aria-pressed={height === value}
          onclick={() => (height = value)}>{label}</button
        >{/each}
    </div>
    <label
      >Paso de zona<select
        disabled={busy}
        value={step}
        onchange={(e) => {
          navigate(Number(e.currentTarget.value));
          e.currentTarget.value = String(step);
        }}
        >{#each ['Tipo', 'Superficie', 'Contorno y espesor', 'Revisar y guardar'] as label, i}<option
            value={i + 1}>{i + 1}. {label}</option
          >{/each}</select
      ></label
    >
    <h3 class="step-heading" tabindex="-1">
      {['Tipo', 'Superficie', 'Contorno y espesor', 'Revisar y guardar'][
        step - 1
      ]}
    </h3>
    <fieldset disabled={busy}>
      {#if step === 1}
        <label
          >Nombre de sección<input
            value={draft.name}
            maxlength="80"
            oninput={(e) => {
              const next = clone(draft);
              next.name = e.currentTarget.value;
              change(next);
            }}
          /></label
        >
        <label
          >Tipo de región<select
            value={draft.kind}
            onchange={(e) => {
              const next = clone(draft);
              next.kind = e.currentTarget.value as Draft['kind'];
              change(next);
            }}
            ><option value="wall">Zona de escalada</option><option
              value="accessible-area">Área visitable</option
            ></select
          ></label
        >
        <label
          >Herramienta<select
            value={draft.mode}
            onchange={(e) => begin(e.currentTarget.value as Draft['mode'])}
            ><option value="box">Caja rápida</option><option value="contour"
              >Contorno</option
            ><option value="inclined">Plano inclinado</option></select
          ></label
        >
      {:else if step === 2}
        {#if draft.mode !== 'contour'}<button
            type="button"
            aria-pressed={surfacePicking}
            onclick={() => (surfacePicking = !surfacePicking)}
            >{surfacePicking
              ? 'Pausar selección de superficie'
              : 'Seleccionar superficie'}</button
          >{/if}
        {#if draft.mode === 'inclined'}<p>
            Elige tres puntos distintos sobre la superficie. El primero fija el
            origen; el segundo y el tercero definen la orientación.
          </p>
          <ol>
            {#each draft.points as point, i}<li>
                Punto {i + 1} · {point.map((n) => n.toFixed(3)).join(', ')}
              </li>{/each}
          </ol>
          <p>
            {plane
              ? 'Plano definido. Continúa al contorno.'
              : `${draft.points.length} de 3 puntos`}
          </p>
          <button
            type="button"
            onclick={() => {
              const next = clone(draft);
              surfacePicking = true;
              next.points = [];
              next.vertices = [];
              next.closed = false;
              change(next);
            }}>Reiniciar tres puntos</button
          >
        {:else if draft.mode === 'contour'}<label
            >Plano de referencia<select
              value={draft.axis}
              onchange={(e) => {
                const next = clone(draft);
                next.axis = e.currentTarget.value as AxisPolygon['plane'];
                next.vertices = [];
                next.closed = false;
                change(next);
              }}
              ><option>XY</option><option>XZ</option><option>YZ</option></select
            ></label
          ><label
            >Posición del plano<input
              type="number"
              step="0.01"
              value={draft.elevation}
              onchange={(e) => {
                const next = clone(draft);
                next.elevation = e.currentTarget.valueAsNumber;
                next.vertices = next.vertices.map((p) =>
                  projectVertex(p, next.axis, next.elevation),
                );
                change(next);
              }}
            /></label
          >
        {:else}<p>
            Selecciona un punto del muro para centrar la caja. Ajusta sus
            dimensiones en el siguiente paso.
          </p>{/if}
      {:else if step === 3}
        {#if draft.mode === 'box'}<div class="spatial-fields">
            {#each ['X', 'Y', 'Z'] as axis, i}<label
                >Centro {axis}<input
                  type="number"
                  step="0.01"
                  value={draft.center[i]}
                  onchange={(e) => {
                    const next = clone(draft);
                    next.center[i] = e.currentTarget.valueAsNumber;
                    change(next);
                  }}
                /></label
              ><label
                >Tamaño {axis}<input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={draft.size[i]}
                  onchange={(e) => {
                    const next = clone(draft);
                    next.size[i] = e.currentTarget.valueAsNumber;
                    change(next);
                  }}
                /></label
              >{/each}
          </div>
        {:else}<p>
            Marca el contorno en orden sobre el muro; cada punto se proyecta al
            plano. Mínimo 3, máximo 32 vértices.
          </p>
          <button
            type="button"
            disabled={!!temporary ||
              draft.closed ||
              (draft.mode === 'inclined' && !plane)}
            aria-pressed={adding}
            onclick={() => (adding = !adding)}
            >{adding ? 'Terminar de añadir' : 'Añadir vértices'}</button
          >
          <ol>
            {#each draft.vertices as point, i}<li>
                <button
                  type="button"
                  disabled={!!temporary}
                  onclick={() => inspect(i)}>Seleccionar vértice {i + 1}</button
                ><button
                  type="button"
                  disabled={!!temporary}
                  onclick={() => {
                    const next = clone(draft);
                    next.vertices.splice(i, 1);
                    next.closed = false;
                    change(next);
                  }}>Eliminar vértice {i + 1}</button
                >
              </li>{/each}
          </ol>
          <button
            type="button"
            disabled={!!temporary || draft.vertices.length < 3}
            onclick={() => {
              try {
                polygonGeometry(shape);
                const next = clone(draft);
                next.closed = true;
                change(next);
                adding = false;
                message = 'Contorno cerrado.';
              } catch (e) {
                message = (e as Error).message;
              }
            }}>Cerrar contorno</button
          ><button
            type="button"
            disabled={!!temporary || !draft.closed}
            onclick={() => {
              const next = clone(draft);
              next.closed = false;
              change(next);
            }}>Reabrir contorno</button
          ><label
            >Espesor de región<input
              type="number"
              min="0.01"
              max="10000"
              step="0.01"
              value={draft.thickness}
              onchange={(e) => {
                const next = clone(draft);
                next.thickness = e.currentTarget.valueAsNumber;
                change(next);
              }}
            /></label
          >{/if}
        <p>Unidades del clon; no equivalen a metros.</p>
      {:else}
        <p>
          {editId
            ? `Editando revisión ${revision}; guardar creará una revisión nueva.`
            : 'Nueva zona.'}
        </p>
        <p>
          {dependencies.length} rutas dependen de esta zona. Conservarán su geometría
          y revisión histórica.
        </p>
        {#if dependencies.length}<ul>
            {#each dependencies as route}<li>
                {route.name} · revisión de sección {route.sectionRevision || 1}
              </li>{/each}
          </ul>{/if}
        <dl>
          <dt>Nombre</dt>
          <dd>{draft.name || 'Pendiente'}</dd>
          <dt>Tipo</dt>
          <dd>
            {draft.kind === 'wall' ? 'Zona de escalada' : 'Área visitable'}
          </dd>
          <dt>Geometría</dt>
          <dd>{draft.mode} · {draft.vertices.length} vértices</dd>
        </dl>
        {#if problems.length}<ul role="alert">
            {#each problems as problem}<li>{problem}</li>{/each}
          </ul>{/if}
        <label class="toggle"
          ><input
            type="checkbox"
            bind:checked={reviewed}
            disabled={problems.length > 0}
          />Revisé la superficie y el volumen desde dos ángulos</label
        >
        {#if conflict}<p role="alert">
            La zona cambió. Tu preparación se conserva; revisa la nueva base
            antes de volver a guardar.
          </p>
          <button
            type="button"
            disabled={busy}
            onclick={async () => {
              busy = true;
              try {
                await onRefresh();
                await tick();
                baseLoaded = true;
                message =
                  'Base actualizada; compara el historial antes de confirmar.';
              } catch (e) {
                message = (e as Error).message;
              } finally {
                busy = false;
              }
            }}>Consultar nueva base</button
          >
          {#if baseLoaded}
            {@const latest = sections.find((s) => s.id === editId)}
            <p>
              Base actual: revisión {latest?.revision} · {latest?.name} · {latest
                ?.geometry?.type || 'caja'}. Tu preparación: {draft.name} · {draft.mode}.
            </p>
            <details>
              <summary>Diferencias de geometría</summary>
              <p>
                {JSON.stringify(latest?.geometry || latest?.bounds) ===
                JSON.stringify(preview?.geometry || preview?.bounds)
                  ? 'La geometría coincide.'
                  : 'La geometría es diferente; revisa contorno y espesor.'}
              </p>
              <p>
                Base: {latest?.geometry
                  ? geometryVertices(latest.geometry).length
                  : 8} vértices · espesor {latest?.geometry?.thickness ??
                  'caja'}.
              </p>
              <p>
                Preparación: {shape ? geometryVertices(shape).length : 8} vértices
                · espesor {shape?.thickness ?? 'caja'}.
              </p>
              {#if latest}<p>
                  Límites de la base: {latest.bounds.min
                    .map((n) => n.toFixed(3))
                    .join(', ')} → {latest.bounds.max
                    .map((n) => n.toFixed(3))
                    .join(', ')}
                </p>{/if}
              {#if preview}<p>
                  Límites preparados: {preview.bounds.min
                    .map((n) => n.toFixed(3))
                    .join(', ')} → {preview.bounds.max
                    .map((n) => n.toFixed(3))
                    .join(', ')}
                </p>{/if}
            </details>
            <button
              type="button"
              disabled={busy}
              onclick={async () => {
                try {
                  const response = await api(
                    '/sections/' + editId + '/revisions',
                  );
                  history = response.revisions;
                } catch (e) {
                  message = (e as Error).message;
                }
              }}>Comparar historial de la zona</button
            >
            {#if history.length}<ol aria-label="Revisiones para comparar">
                {#each history as entry}<li>
                    Revisión {entry.revision} · {entry.section.name} · {entry
                      .section.geometry?.type || 'caja'}
                  </li>{/each}
              </ol>{/if}
            <button
              type="button"
              disabled={busy}
              onclick={() => {
                revision = latest?.revision || revision;
                conflict = false;
                baseLoaded = false;
                reviewed = false;
                message =
                  'Revisa de nuevo el volumen antes de guardar sobre esta revisión.';
              }}>Revisé la nueva revisión y las diferencias</button
            >
          {/if}
        {/if}
        <button
          type="button"
          disabled={busy ||
            !!temporary ||
            conflict ||
            problems.length > 0 ||
            !reviewed}
          onclick={save}
          >{busy
            ? 'Guardando…'
            : editId
              ? 'Guardar cambios de sección'
              : 'Crear sección'}</button
        >
      {/if}
    </fieldset>
    {#if temporary}<section
        class="vertex-inspector"
        aria-label="Ajustar vértice"
      >
        <h3>Vértice {temporary.index + 1}</h3>
        <p>Ajuste dentro del plano; unidades del clon.</p>
        {#each ['U', 'V'] as axis, i}<div class="actions">
            <button
              type="button"
              disabled={busy}
              onclick={() => nudge(i, -0.01)}>Disminuir {axis}</button
            ><button
              type="button"
              disabled={busy}
              onclick={() => nudge(i, 0.01)}>Aumentar {axis}</button
            >
          </div>{/each}<button type="button" disabled={busy} onclick={apply}
          >Aplicar ajuste</button
        ><button type="button" disabled={busy} onclick={cancelAdjustment}
          >Cancelar ajuste</button
        >
      </section>{/if}
    <div class="actions">
      <button
        type="button"
        disabled={busy || !!temporary || !past.length}
        onclick={() => undo()}>Deshacer zona</button
      ><button
        type="button"
        disabled={busy || !!temporary || !future.length}
        onclick={() => undo(true)}>Rehacer zona</button
      >{#if shape}<button
          type="button"
          disabled={busy}
          onclick={() =>
            (camera = { id: ++cameraId, plane: geometryPlane(shape) })}
          >Vista perpendicular</button
        ><button
          type="button"
          disabled={busy}
          onclick={() => (camera = { id: ++cameraId })}>Restaurar cámara</button
        >{/if}
    </div>
    <div class="actions">
      <button
        type="button"
        disabled={busy}
        onclick={() => navigate(Math.max(1, step - 1))}>Anterior</button
      ><button
        type="button"
        disabled={busy || step === 4}
        onclick={() => navigate(Math.min(4, step + 1))}>Siguiente</button
      ><button type="button" disabled={busy} onclick={cancel}
        >Cancelar edición de sección</button
      >
    </div>
  {/if}
</section>

<style>
  .section-editor {
    min-width: 0;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
  }
  fieldset {
    border: 0;
    padding: 0;
    min-width: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.5rem 0;
  }
  label {
    display: block;
    margin: 0.5rem 0;
  }
  input,
  select {
    max-width: 100%;
    width: 100%;
  }
  li {
    margin: 0.5rem 0;
  }
  .toggle {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .toggle input {
    width: auto;
  }
  .mobile-heights {
    display: none;
  }
  .spatial-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .step-heading:focus {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .vertex-inspector {
    position: sticky;
    bottom: 0;
    background: var(--surface);
    padding: 0.5rem;
    border: 2px solid var(--accent);
    z-index: 1;
  }
  .preparing > h2 {
    font-size: 18px;
    margin: 0 0 6px;
  }
  .preparing > [role='status'] {
    font-size: 13px;
    margin: 0 0 8px;
  }
  @media (max-width: 767px) {
    .preparing {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      top: calc(
        var(--workspace-top, 0px) +
          (var(--viewport-height, 100dvh) - var(--workspace-top, 0px)) * 0.48
      );
      overflow: auto;
      z-index: 12;
      overscroll-behavior: contain;
    }
    .preparing[data-height='compact'] {
      top: calc(
        var(--workspace-top, 0px) +
          (var(--viewport-height, 100dvh) - var(--workspace-top, 0px)) * 0.62
      );
    }
    .preparing[data-height='expanded'] {
      top: calc(
        var(--workspace-top, 0px) +
          (var(--viewport-height, 100dvh) - var(--workspace-top, 0px)) * 0.28
      );
    }
    .mobile-heights {
      display: flex;
      gap: 0.5rem;
      position: sticky;
      top: 0;
      background: var(--surface);
      z-index: 2;
    }
  }
</style>
