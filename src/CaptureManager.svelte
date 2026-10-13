<script lang="ts">
  import { onMount } from 'svelte';
  import { api, supabase } from './auth';
  import SplatViewer from './SplatViewer.svelte';
  import type { Capture, Section, Fiducial } from './twin';
  import type { Route } from './domain';
  let { routes, onPublished }: { routes: Route[]; onPublished: () => void } =
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
              r.id === id && (r.status === 'activa' || imports.includes(id)),
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
    section={sections.find((s) => s.id === previewSectionId)}
    routeId="capture-preview"
    staff={false}
    onSave={() => {}}
  />{/if}
<div class="forms">
  <form
    onsubmit={(e) => {
      e.preventDefault();
      operation(async () => {
        await api('/sections', {
          name: sectionName,
          min: coordinates(minimum),
          max: coordinates(maximum),
        });
        await refresh();
        sectionName = '';
      });
    }}
  >
    <h2>Definir sección estable</h2>
    <label
      >Nombre de sección<input
        bind:value={sectionName}
        required
        maxlength="80"
      /></label
    ><label
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
    ><button disabled={busy}>Crear sección</button>
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
      >{/each}<button
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
            'Sin sección: asígnala antes de publicar'}</strong
        >{#if r.status === 'retirada' || changed.includes(r.sectionId || '')}<label
            class="toggle"
            ><input type="checkbox" bind:group={imports} value={r.id} />Importar
            esta ruta del armado anterior</label
          >{:else}<p>Sección sin cambios: conservar la ruta.</p>{/if}<label
          class="toggle"
          ><input
            type="checkbox"
            bind:group={reviewed}
            value={r.id}
            disabled={r.status === 'retirada' && !imports.includes(r.id)}
          />Revisé que esta ruta sigue siendo válida</label
        >
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
