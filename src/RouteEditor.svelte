<script lang="ts">
  import { api } from './auth';
  import { untrack } from 'svelte';
  import type { Route } from './domain';
  let { route, onSaved }: { route?: Route; onSaved: (id: string) => void } =
    $props();
  const initial = untrack(() => route);
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
          sector,
          beta,
          status,
          holds: route?.holds || [],
          ...(route?.camera ? { camera: route.camera } : {}),
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
  ><label>Sector<input bind:value={sector} required maxlength="80" /></label
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
