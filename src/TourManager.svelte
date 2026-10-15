<script lang="ts">
  import { untrack } from 'svelte';
  import { api, ApiError, supabase } from './auth';
  import TourPoster from './TourPoster.svelte';
  import SplatViewer from './SplatViewer.svelte';
  import type { Capture, Section } from './twin';
  import type { Route } from './domain';
  import {
    captureStamp,
    tourPresentation,
    tourProblems,
    type TourContent,
    type TourCamera,
    type TourStop,
  } from '../shared/tours';
  let {
    admin,
    available,
    owner,
    routes,
  }: { admin: boolean; available: boolean; owner: string; routes: Route[] } =
    $props();
  const actor = untrack(() => owner);
  type Item = {
    id: string;
    draft_revision: number;
    published_revision: number | null;
    status: string;
  };
  let list = $state<Item[]>([]),
    capture = $state<Capture>(),
    sections = $state<Section[]>([]),
    id = $state(''),
    revision = $state(0),
    published = $state<number | null>(null),
    status = $state('draft'),
    content = $state<TourContent>(),
    baseline = $state(''),
    selected = $state(''),
    message = $state(''),
    busy = $state(false),
    scene = $state(false),
    preview = $state(false),
    reviewed = $state(false),
    conflict = $state(false),
    base = $state<{ revision: number; content: TourContent } | undefined>();
  let past = $state<TourContent[]>([]),
    future = $state<TourContent[]>([]),
    candidate = $state<
      | { stopId: string; point: [number, number, number]; context: string }
      | undefined
    >();
  let command = $state<{ id: number; camera: TourCamera } | undefined>(),
    commandId = 0;
  let mutation: { key: string; requestId: string } | undefined;
  let imageRetry = $state<
    { key: string; requestId: string; blob: Blob } | undefined
  >();
  const copy = (v: TourContent) => structuredClone($state.snapshot(v));
  const stop = $derived(content?.stops.find((s) => s.id === selected));
  const dirty = $derived(!!content && JSON.stringify(content) !== baseline);
  const compatible = $derived(
    !!content &&
      !!capture &&
      captureStamp(content) ===
        captureStamp({
          captureId: capture.id,
          captureVersion: capture.version,
          captureTransform: capture.transform,
        }),
  );
  const problems = $derived(
    content ? tourProblems(content) : ['Crea un borrador'],
  );
  async function refresh() {
    try {
      const [a, b, c] = await Promise.all([
        api('/staff/tours'),
        api('/captures/current'),
        api('/sections'),
      ]);
      list = a.tours;
      capture = b.capture || undefined;
      sections = c.sections;
    } catch (e) {
      message = (e as Error).message;
    }
  }
  $effect(() => {
    if (available) void refresh();
  });
  function change(next: TourContent) {
    if (!content || JSON.stringify(next) === JSON.stringify(content)) return;
    past = [...past, copy(content)].slice(-40);
    future = [];
    content = next;
    reviewed = false;
  }
  function updateStop(patch: Partial<TourStop>) {
    if (!content || !stop) return;
    const next = copy(content),
      index = next.stops.findIndex((s) => s.id === selected);
    next.stops[index] = { ...next.stops[index], ...patch };
    change(next);
  }
  function selectStop(value: string) {
    if (candidate) {
      message =
        'Aplica o cancela el punto de interés antes de cambiar de parada.';
      return;
    }
    selected = value;
    const s = content?.stops.find((s) => s.id === value);
    if (s?.camera && compatible)
      command = { id: ++commandId, camera: s.camera };
  }
  async function open(value: string) {
    if (busy) return;
    if (dirty) {
      message =
        'Guarda o descarta la preparación antes de abrir otro recorrido.';
      return;
    }
    busy = true;
    try {
      const r = await api('/staff/tours/' + value);
      id = r.id;
      revision = r.revision;
      published = r.publishedRevision;
      status = r.status;
      content = r.content;
      baseline = JSON.stringify(r.content);
      selected = r.content.startStopId || r.content.stops[0]?.id || '';
      past = [];
      future = [];
      reviewed = false;
      conflict = false;
      candidate = undefined;
      scene = false;
      base = undefined;
      mutation = undefined;
      imageRetry = undefined;
      pendingImage = undefined;
    } catch (e) {
      message = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  function newTour() {
    if (dirty) {
      message = 'Guarda o descarta la preparación actual.';
      return;
    }
    if (!capture) {
      message = 'Publica primero una captura del gimnasio.';
      return;
    }
    imageRetry = undefined;
    pendingImage = undefined;
    mutation = undefined;
    id = '';
    revision = 0;
    published = null;
    status = 'draft';
    content = {
      title: '',
      description: '',
      captureId: capture.id,
      captureVersion: capture.version,
      captureTransform: structuredClone($state.snapshot(capture.transform)),
      stops: [],
    };
    baseline = JSON.stringify(content);
    selected = '';
    past = [];
    future = [];
    candidate = undefined;
    scene = false;
    conflict = false;
    reviewed = false;
    base = undefined;
  }
  function discard() {
    if (busy) return;
    imageRetry = undefined;
    pendingImage = undefined;
    content = baseline ? JSON.parse(baseline) : undefined;
    past = [];
    future = [];
    candidate = undefined;
    reviewed = false;
    scene = false;
    selected = content?.startStopId || content?.stops[0]?.id || '';
    message = 'Preparación descartada; la versión pública no cambió.';
  }
  function undo(redo = false) {
    if (!content || busy || candidate) return;
    const source = redo ? future : past;
    if (!source.length) return;
    const next = copy(source[source.length - 1]);
    if (redo) {
      past = [...past, copy(content)];
      future = future.slice(0, -1);
    } else {
      future = [...future, copy(content)];
      past = past.slice(0, -1);
    }
    content = next;
    reviewed = false;
    if (!next.stops.some((s) => s.id === selected))
      selected = next.stops[0]?.id || '';
  }
  function add() {
    if (!content || content.stops.length >= 20 || candidate) return;
    const next = copy(content),
      stopId = crypto.randomUUID();
    next.stops.push({
      id: stopId,
      title: '',
      description: '',
      verified: false,
    });
    next.startStopId ||= stopId;
    change(next);
    selectStop(stopId);
  }
  function rebaseCapture() {
    if (!content || !capture || busy) return;
    const next = copy(content);
    next.captureId = capture.id;
    next.captureVersion = capture.version;
    next.captureTransform = structuredClone($state.snapshot(capture.transform));
    next.stops = next.stops.map(({ camera, imageId, hotspot, ...s }) => ({
      ...s,
      verified: false,
    }));
    change(next);
    candidate = undefined;
    command = undefined;
    scene = false;
    message =
      'Contexto actualizado. Revisa todas las cámaras e imágenes antes de publicar.';
  }
  async function save(action = 'save') {
    if (!available || !content || busy || candidate || conflict) return;
    if (action === 'retire' && dirty) return;
    if (action === 'publish' && (!admin || !reviewed || problems.length))
      return;
    const payload = {
      ...(action !== 'retire' ? { content: copy(content) } : {}),
      expectedRevision: revision,
      ...(action === 'publish' ? { reviewed: true } : {}),
    };
    const signature = JSON.stringify([id, action, payload]);
    if (mutation?.key !== signature)
      mutation = { key: signature, requestId: crypto.randomUUID() };
    busy = true;
    message = 'Guardando…';
    try {
      const result = await api(
        '/staff/tours' +
          (id ? '/' + id : '') +
          (action !== 'save' ? '/' + action : ''),
        { ...payload, requestId: mutation.requestId },
        id && action === 'save' ? 'PUT' : 'POST',
        actor,
      );
      id = result.id;
      revision = result.revision;
      baseline = JSON.stringify(content);
      if (action === 'publish') {
        published = result.revision;
        status = 'published';
      }
      if (action === 'retire') status = 'retired';
      mutation = undefined;
      conflict = false;
      message =
        action === 'publish'
          ? 'Recorrido publicado en este entorno.'
          : action === 'retire'
            ? 'Recorrido retirado; conserva su enlace y respaldo.'
            : 'Borrador guardado; la versión pública no cambió.';
      await refresh();
    } catch (e) {
      conflict = e instanceof ApiError && e.status === 409;
      message = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  function snapshotFor(stopId: string) {
    const context = content ? captureStamp(content) : '',
      tour = id;
    return async (blob: Blob, camera: TourCamera) => {
      if (
        !content ||
        !tour ||
        id !== tour ||
        captureStamp(content) !== context ||
        !content.stops.some((s) => s.id === stopId)
      ) {
        message = 'El contexto cambió; imagen descartada.';
        return;
      }
      busy = true;
      message = 'Guardando imagen de la parada…';
      const key = JSON.stringify([
        tour,
        stopId,
        tourPresentation(content, camera),
      ]);
      imageRetry = { key, requestId: crypto.randomUUID(), blob };
      await uploadImage(stopId, camera, context);
    };
  }
  async function uploadImage(
    stopId: string,
    camera: TourCamera,
    context: string,
  ) {
    if (!imageRetry || !content) return;
    if (
      captureStamp(content) !== context ||
      !content.stops.some((s) => s.id === stopId) ||
      imageRetry.key !==
        JSON.stringify([id, stopId, tourPresentation(content, camera)])
    ) {
      imageRetry = undefined;
      pendingImage = undefined;
      message = 'El contexto cambió; captura otra imagen.';
      return;
    }
    busy = true;
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user.id !== actor)
        throw new Error('La sesión cambió; revisa la cuenta.');
      const headers = {
        'Content-Type': 'image/png',
        'X-Tour-Id': id,
        'X-Request-Id': imageRetry.requestId,
        'X-Tour-Presentation': JSON.stringify({
          title: '',
          description: '',
          captureId: content.captureId,
          captureVersion: content.captureVersion,
          captureTransform: content.captureTransform,
          camera,
        }),
        Authorization: 'Bearer ' + data.session.access_token,
      };
      const response = await fetch('/api/tour-images', {
        method: 'POST',
        headers,
        body: imageRetry.blob,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falló la imagen.');
      if (
        captureStamp(content) !== context ||
        !content.stops.some((s) => s.id === stopId)
      )
        throw new Error('El contexto cambió; imagen sin aplicar.');
      const next = copy(content);
      const index = next.stops.findIndex((s) => s.id === stopId);
      next.stops[index] = {
        ...next.stops[index],
        camera,
        imageId: result.id,
        verified: false,
      };
      change(next);
      imageRetry = undefined;
      message =
        'Cámara e imagen preparadas. Revisa la parada desde dos ángulos y guarda el borrador.';
    } catch (e) {
      message = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  let pendingImage = $state<
    { stopId: string; camera: TourCamera; context: string } | undefined
  >();
  function snapshot(stopId: string) {
    const capture = snapshotFor(stopId);
    const context = content ? captureStamp(content) : '';
    return (blob: Blob, camera: TourCamera) => {
      pendingImage = { stopId, camera, context };
      void capture(blob, camera);
    };
  }
  function keydown(event: KeyboardEvent) {
    if (
      !content ||
      busy ||
      (event.target instanceof HTMLElement &&
        (event.target.matches('input,textarea,select') ||
          event.target.isContentEditable))
    )
      return;
    if (event.key === 'Escape' && candidate) {
      event.preventDefault();
      candidate = undefined;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo(event.shiftKey);
    }
  }
</script>

<svelte:window onkeydown={keydown} />

{#if !available}<p role="status">
    Verifica la sesión y los permisos de staff para continuar. La preparación de
    esta cuenta se conserva.
  </p>{/if}
<section
  hidden={!available}
  class="tour-manager"
  aria-label="Editor de recorridos"
>
  <h1 tabindex="-1">Recorridos del gimnasio</h1>
  <p>
    Staff prepara; administración publica o retira. Los borradores no cambian el
    recorrido público.
  </p>
  <p role="status">{message}</p>
  <div class="actions">
    <button disabled={busy} onclick={refresh}
      >Actualizar recorridos y captura</button
    ><button disabled={busy || dirty || !capture} onclick={newTour}
      >Crear recorrido</button
    >
  </div>
  <ul>
    {#each list as item}<li>
        <button disabled={busy || dirty} onclick={() => open(item.id)}
          >Abrir recorrido {item.id.slice(0, 8)} · {item.status} · borrador {item.draft_revision}</button
        >
      </li>{/each}
  </ul>
  {#if content}<p>
      {id ? 'Borrador ' + revision : 'Preparación local sin guardar'} · {published
        ? 'Revisión publicada ' + published
        : 'Sin versión pública'} · {dirty
        ? 'Cambios sin guardar'
        : 'Sin cambios pendientes'}
    </p>
    <fieldset disabled={busy}>
      <label
        >Título del recorrido<input
          maxlength="80"
          value={content.title}
          oninput={(e) => {
            const next = copy(content!);
            next.title = e.currentTarget.value;
            change(next);
          }}
        /></label
      >
      <label
        >Descripción del recorrido<textarea
          maxlength="1000"
          value={content.description}
          oninput={(e) => {
            const next = copy(content!);
            next.description = e.currentTarget.value;
            change(next);
          }}></textarea></label
      >
      <p>
        Captura: {capture?.filename || 'No disponible'} · versión del borrador {content.captureVersion}.
      </p>
      {#if !compatible}<p role="alert">
          La captura vigente cambió. Se conserva tu texto; las cámaras
          anteriores no se aplicarán al contexto nuevo.
        </p>
        <button onclick={rebaseCapture}
          >Usar captura vigente y revisar paradas</button
        >{/if}
      <div class="actions">
        <button
          disabled={content.stops.length >= 20 || !!candidate}
          onclick={add}>Añadir parada</button
        ><button disabled={!past.length || !!candidate} onclick={() => undo()}
          >Deshacer recorrido</button
        ><button
          disabled={!future.length || !!candidate}
          onclick={() => undo(true)}>Rehacer recorrido</button
        >
      </div>
      <ol aria-label="Paradas del borrador">
        {#each content.stops as s, i}<li>
            <button
              aria-current={s.id === selected ? 'step' : undefined}
              onclick={() => selectStop(s.id)}
              >{i + 1}. {s.title || 'Parada sin título'}</button
            ><button
              aria-label={`Subir parada ${i + 1}`}
              disabled={!i || !!candidate}
              onclick={() => {
                const next = copy(content!);
                [next.stops[i - 1], next.stops[i]] = [
                  next.stops[i],
                  next.stops[i - 1],
                ];
                change(next);
              }}>Subir</button
            ><button
              aria-label={`Bajar parada ${i + 1}`}
              disabled={i === content!.stops.length - 1 || !!candidate}
              onclick={() => {
                const next = copy(content!);
                [next.stops[i + 1], next.stops[i]] = [
                  next.stops[i],
                  next.stops[i + 1],
                ];
                change(next);
              }}>Bajar</button
            ><button
              aria-label={`Eliminar parada ${i + 1}`}
              disabled={!!candidate}
              onclick={() => {
                const next = copy(content!);
                next.stops = next.stops.filter((stop) => stop.id !== s.id);
                if (next.startStopId === s.id)
                  next.startStopId = next.stops[0]?.id;
                change(next);
                if (selected === s.id) selected = next.stops[0]?.id || '';
              }}>Eliminar</button
            >
          </li>{/each}
      </ol>
      {#if stop}<h2>
          Preparar parada {content.stops.findIndex((s) => s.id === stop.id) + 1}
        </h2>
        <label
          >Título de parada<input
            maxlength="80"
            value={stop.title}
            oninput={(e) => updateStop({ title: e.currentTarget.value })}
          /></label
        ><label
          >Descripción de parada<textarea
            maxlength="1000"
            value={stop.description}
            oninput={(e) => updateStop({ description: e.currentTarget.value })}
          ></textarea></label
        >
        <label class="toggle"
          ><input
            type="checkbox"
            checked={content.startStopId === stop.id}
            onchange={() => {
              const next = copy(content!);
              next.startStopId = stop!.id;
              change(next);
            }}
          />Parada inicial</label
        >
        <label
          >Zona vinculada<select
            value={stop.section?.id || ''}
            onchange={(e) => {
              const section = sections.find(
                (s) => s.id === e.currentTarget.value,
              );
              updateStop({
                section: section
                  ? { id: section.id, revision: section.revision || 1 }
                  : undefined,
              });
            }}
            ><option value="">Sin zona</option>{#each sections as s}<option
                value={s.id}>{s.name}</option
              >{/each}</select
          ></label
        >
        <label
          >Ruta vinculada<select
            value={stop.linkedRouteId || ''}
            onchange={(e) =>
              updateStop({ linkedRouteId: e.currentTarget.value || undefined })}
            ><option value="">Sin ruta</option
            >{#each routes.filter((r) => r.status !== 'borrador') as r}<option
                value={r.id}>{r.name}</option
              >{/each}</select
          ></label
        >
        {#if stop.imageId}<TourPoster
            imageId={stop.imageId}
            title={stop.title}
            privateOwner={actor}
          />{/if}
        <p>
          {stop.camera
            ? 'Cámara preparada · FOV ' + stop.camera.fov + '°'
            : 'Cámara e imagen pendientes'}
        </p>
        <label class="toggle"
          ><input
            type="checkbox"
            disabled={!stop.camera || !stop.imageId || !compatible}
            checked={stop.verified}
            onchange={(e) => updateStop({ verified: e.currentTarget.checked })}
          />Revisé esta parada y su punto de interés desde dos ángulos</label
        >
        <p>
          Guarda el borrador antes de preparar imágenes. En el visor, encuadra y
          usa «Guardar cámara e imagen de parada». Cambiar la cámara exige una
          imagen nueva.
        </p>
        <button disabled={!id || !compatible} onclick={() => (scene = !scene)}
          >{scene
            ? 'Cerrar preparación del recorrido'
            : 'Preparar parada en 3D'}</button
        >
        {#if stop.hotspot}<button
            onclick={() => updateStop({ hotspot: undefined, verified: false })}
            >Quitar punto de interés</button
          >{/if}
      {/if}
      {#if candidate}<section aria-label="Punto de interés provisional">
          <p>Revisa el punto desde otro ángulo antes de aplicarlo.</p>
          <button
            onclick={() => {
              if (content && captureStamp(content) === candidate!.context) {
                const next = copy(content);
                const s = next.stops.find((s) => s.id === candidate!.stopId);
                if (s) {
                  s.hotspot = candidate!.point;
                  s.verified = false;
                  change(next);
                }
              }
              candidate = undefined;
            }}>Aplicar punto de interés</button
          ><button onclick={() => (candidate = undefined)}
            >Cancelar punto de interés</button
          >
        </section>{/if}
      <div class="actions">
        <button disabled={!id} onclick={() => (preview = !preview)}
          >{preview
            ? 'Cerrar previsualización'
            : 'Previsualizar recorrido'}</button
        ><button
          disabled={!content || !compatible || !!candidate || conflict}
          onclick={() => save()}>Guardar borrador de recorrido</button
        ><button onclick={discard}>Descartar preparación local</button>
      </div>
      {#if conflict}<p role="alert">
          Conflicto: tu preparación se conserva. Consulta la nueva base antes de
          volver a guardar.
        </p>
        <button
          onclick={async () => {
            try {
              base = await api('/staff/tours/' + id);
            } catch (e) {
              message = (e as Error).message;
            }
          }}>Consultar nueva base del recorrido</button
        >{#if base}<p>
            Base: revisión {base.revision}, {base.content.title}, {base.content
              .stops.length} paradas. Preparación: {content.title}, {content
              .stops.length} paradas.
          </p>
          <button
            onclick={() => {
              revision = base!.revision;
              conflict = false;
              base = undefined;
              reviewed = false;
              mutation = undefined;
            }}>Revisé la nueva base del recorrido</button
          >{/if}{/if}
      {#if imageRetry && pendingImage}<button
          onclick={() =>
            void uploadImage(
              pendingImage!.stopId,
              pendingImage!.camera,
              pendingImage!.context,
            )}>Reintentar imagen de parada</button
        >{/if}
      {#if preview && stop}<section
          class="tour-preview"
          aria-label="Previsualización pública del recorrido"
        >
          <h2>{content.title || 'Título pendiente'}</h2>
          <p>{content.description}</p>
          <h3>{stop.title || 'Parada pendiente'}</h3>
          <p>{stop.description}</p>
          {#if stop.imageId}<TourPoster
              imageId={stop.imageId}
              title={stop.title}
              privateOwner={actor}
            />{/if}
          <p>
            {content.stops.findIndex((s) => s.id === stop.id) + 1} de {content
              .stops.length} paradas. Usa la lista para revisar todas.
          </p>
        </section>{/if}
      <details>
        <summary>Pendientes para publicar · {problems.length}</summary>
        <ul>
          {#each problems as problem}<li>{problem}</li>{/each}
        </ul>
      </details>
      {#if admin}<label class="toggle"
          ><input
            type="checkbox"
            disabled={problems.length > 0 || !compatible}
            bind:checked={reviewed}
          />Confirmo la revisión humana de todas las paradas antes de publicar</label
        >
        <p>
          Publicar hará visible esta versión en este entorno. Retirar conservará
          el enlace y las imágenes y desactivará el 3D.
        </p>
        <div class="actions">
          <button
            disabled={!id ||
              !reviewed ||
              problems.length > 0 ||
              !compatible ||
              conflict ||
              !!candidate}
            onclick={() => save('publish')}>Publicar recorrido</button
          ><button
            disabled={dirty ||
              !published ||
              status === 'retired' ||
              conflict ||
              !!candidate}
            onclick={() => save('retire')}>Retirar recorrido</button
          >
        </div>{/if}
    </fieldset>
    {#if scene && capture && compatible && stop}<SplatViewer
        {capture}
        routeId={'tour-editor-' + (id || 'new')}
        staff={false}
        tourMode
        tourCommand={command}
        onSave={() => {}}
        toolsDisabled={busy || !!candidate}
        onTourSnapshot={snapshot(stop.id)}
        onPoint={(_, world) => {
          candidate = {
            stopId: stop!.id,
            point: world,
            context: captureStamp(content!),
          };
        }}
        previewPoint={candidate?.point}
        spatialMode={candidate ? 'review-candidate' : undefined}
        onCancelTool={() => (candidate = undefined)}
        onExit={() => (scene = false)}
      />{/if}
  {/if}
</section>

<style>
  .tour-manager {
    min-width: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0.75rem 0;
  }
  fieldset {
    border: 0;
    padding: 0;
    min-width: 0;
  }
  .toggle {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .toggle input {
    width: auto;
  }
  .tour-preview {
    max-width: 390px;
    border: 1px solid var(--border);
    padding: 1rem;
    border-radius: 8px;
  }
  ol {
    padding-left: 1.5rem;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0.5rem 0;
  }
  input,
  textarea,
  select {
    max-width: 100%;
  }
</style>
