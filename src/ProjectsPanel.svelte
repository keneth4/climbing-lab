<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './auth';
  import type { Route } from './domain';
  let { routes }: { routes: Route[] } = $props();
  let projects = $state<any[]>([]),
    routeId = $state(''),
    notes = $state(''),
    busy = $state(false),
    error = $state(''),
    history = $state<any[]>([]),
    editing = $state(''),
    editNotes = $state(''),
    editStatus = $state('pendiente');
  let disposed = false;
  async function load() {
    const d = await api('/projects');
    if (!disposed) projects = d.projects || [];
  }
  onMount(() => {
    load().catch((e) => {
      if (!disposed) error = e.message;
    });
    return () => {
      disposed = true;
    };
  });
  async function save(p?: any) {
    if (busy) return;
    busy = true;
    error = '';
    try {
      await api(
        p ? `/projects/${p.id}` : '/projects',
        p
          ? { expectedVersion: p.version, notes: editNotes, status: editStatus }
          : { routeId, notes },
        p ? 'PUT' : 'POST',
      );
      if (!disposed) {
        editing = '';
        notes = '';
        history = [];
        await load();
      }
    } catch (e) {
      if (!disposed) error = (e as Error).message;
    } finally {
      if (!disposed) busy = false;
    }
  }
  async function showHistory(id: string) {
    try {
      const d = await api(`/projects/${id}`);
      if (!disposed) history = d.history || [];
    } catch (e) {
      if (!disposed) error = (e as Error).message;
    }
  }
</script>

<details>
  <summary>Mis proyectos de escalada</summary>
  <p>
    Proyectos privados. Un ascenso no cambia automáticamente el estado del
    proyecto.
  </p>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      save();
    }}
    aria-label="Nuevo proyecto"
  >
    <label
      >Ruta del proyecto<select bind:value={routeId} required
        ><option value="">Selecciona ruta</option>{#each routes as r}<option
            value={r.id}>{r.name} · {r.grade} · {r.status}</option
          >{/each}</select
      ></label
    ><label
      >Notas del proyecto<textarea bind:value={notes} maxlength="2000"
      ></textarea></label
    ><button disabled={busy}>Crear proyecto</button>
  </form>
  {#each projects as p (p.id)}<article>
      <h3>{p.name} · {p.grade}</h3>
      <p>{p.status} · Ruta {p.route_status} · Revisión {p.route_revision}</p>
      <p>{p.notes}</p>
      {#if editing === p.id}<form
          onsubmit={(e) => {
            e.preventDefault();
            save(p);
          }}
        >
          <label
            >Estado del proyecto<select bind:value={editStatus}
              ><option value="pendiente">Pendiente</option><option
                value="completado">Completado</option
              ><option value="archivado">Archivado</option></select
            ></label
          ><label
            >Corregir notas del proyecto<textarea
              bind:value={editNotes}
              maxlength="2000"></textarea></label
          ><button disabled={busy}>Guardar proyecto</button><button
            type="button"
            disabled={busy}
            onclick={() => (editing = '')}>Cancelar proyecto</button
          >
        </form>{:else}<button
          disabled={busy}
          onclick={() => {
            editing = p.id;
            editNotes = p.notes;
            editStatus = p.status;
          }}>Editar proyecto</button
        >{/if}<button disabled={busy} onclick={() => showHistory(p.id)}
        >Historial del proyecto</button
      >
    </article>{/each}
  {#if history.length}<ol>
      {#each history as h}<li>
          Versión {h.version} · {JSON.parse(h.snapshot).status} · {JSON.parse(
            h.snapshot,
          ).notes}
        </li>{/each}
    </ol>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
</details>
