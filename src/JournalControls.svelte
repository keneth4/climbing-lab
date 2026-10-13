<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './auth';
  import type { Entry } from './domain';
  import { localBoundary, journalCsv, journalEntry } from './journal';
  let { onEntries }: { onEntries: (entries: Entry[]) => void } = $props();
  let from = $state(''),
    to = $state(''),
    result = $state(''),
    recordState = $state('active');
  let summary = $state<
    | { records: number; attempts: number; ascents: number; routes: number }
    | undefined
  >();
  let offset = $state(0),
    hasMore = $state(false),
    busy = $state(false),
    error = $state(''),
    exporting = $state(false),
    exportNotice = $state(''),
    entries = $state<Entry[]>([]),
    days = $state<any[]>([]),
    timezone = $state('');
  let applied = $state(''),
    request = 0,
    disposed = false;
  async function load(next = 0, query = applied) {
    const ticket = ++request;
    busy = true;
    error = '';
    summary = undefined;
    days = [];
    entries = [];
    onEntries([]);
    try {
      const data = await api(`/entries?limit=50&offset=${next}${query}`);
      if (disposed || ticket !== request) return;
      entries = data.entries.map(journalEntry);
      summary = data.summary || undefined;
      offset = next;
      hasMore = !!data.pagination?.hasMore;
      applied = query;
      onEntries(entries);
      const daily = await api(`/entries?group=day${query}`);
      if (!disposed && ticket === request) {
        days = daily.days || [];
        timezone = daily.timezone || '';
      }
    } catch (e) {
      if (!disposed && ticket === request) error = (e as Error).message;
    } finally {
      if (!disposed && ticket === request) busy = false;
    }
  }
  function apply() {
    try {
      if (from && to && from > to)
        throw new Error('La fecha inicial no puede ser posterior a la final.');
      const q = new URLSearchParams();
      if (from) q.set('from', localBoundary(from));
      if (to) q.set('until', localBoundary(to, true));
      if (result) q.set('result', result);
      q.set('state', recordState);
      load(0, q.size ? '&' + q.toString() : '');
    } catch (e) {
      error = (e as Error).message;
    }
  }
  onMount(() => {
    load();
    return () => {
      disposed = true;
      request++;
    };
  });
  function downloadCsv(content: string, filename: string) {
    const url = URL.createObjectURL(
      new Blob([content], { type: 'text/csv;charset=utf-8;' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportAll() {
    if (exporting || busy) return;
    exporting = true;
    error = '';
    exportNotice = '';
    const ticket = request;
    try {
      const data = await api(`/entries?export=csv${applied}`);
      if (disposed || ticket !== request) return;
      downloadCsv(data.csv, 'bitacora-intervalo.csv');
      exportNotice = `${data.records} registros exportados del intervalo aplicado.`;
    } catch (e) {
      if (!disposed && ticket === request) error = (e as Error).message;
    } finally {
      if (!disposed) exporting = false;
    }
  }
  function csv() {
    const url = URL.createObjectURL(
      new Blob([journalCsv(entries)], { type: 'text/csv;charset=utf-8;' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bitacora-pagina-' + (Math.floor(offset / 50) + 1) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<p>
  Actividad personal de este gimnasio. Los ascensos son declarados por ti; estos
  registros no son visitas ni cobros.
</p>
<form
  onsubmit={(e) => {
    e.preventDefault();
    apply();
  }}
>
  <div class="filters">
    <label>Desde<input type="date" bind:value={from} /></label><label
      >Hasta<input type="date" bind:value={to} /></label
    ><label
      >Resultado de bitácora<select bind:value={result}
        ><option value="">Todos</option><option value="ascenso">Ascensos</option
        ><option value="intento">Intentos</option></select
      ></label
    >
  </div>
  <label
    >Estado de registros<select bind:value={recordState}
      ><option value="active">Vigentes</option><option value="deleted"
        >Retirados</option
      ></select
    ></label
  >
  <button disabled={busy || exporting}>Aplicar filtros</button><button
    type="button"
    disabled={busy || exporting}
    onclick={() => {
      recordState = 'active';
      from = '';
      to = '';
      result = '';
      load(0, '');
    }}>Limpiar filtros</button
  >
</form>
{#if summary}<dl class="summary">
    <div>
      <dt>Registros</dt>
      <dd>{summary.records}</dd>
    </div>
    <div>
      <dt>Intentos registrados</dt>
      <dd>{summary.attempts}</dd>
    </div>
    <div>
      <dt>Registros con ascenso</dt>
      <dd>{summary.ascents}</dd>
    </div>
    <div>
      <dt>Rutas distintas</dt>
      <dd>{summary.routes}</dd>
    </div>
  </dl>
  <p>
    Resumen de {applied.includes('state=deleted')
      ? 'registros retirados'
      : 'registros vigentes'} del intervalo aplicado, incluyendo otras páginas.
  </p>{/if}
{#if days.length}<details>
    <summary
      >{applied.includes('state=deleted')
        ? 'Registros retirados por día del gimnasio'
        : 'Actividad por día del gimnasio'}</summary
    >
    <p>Zona horaria: {timezone}. No representa visitas.</p>
    {#each days as day}<article>
        <h3>{day.date}</h3>
        <p>
          {day.records} registros · {day.attempts} intentos · {day.ascents} ascensos
          · {day.routes} rutas
        </p>
      </article>{/each}
  </details>{/if}
{#if busy}<p role="status">Cargando bitácora…</p>{/if}{#if error}<p
    role="alert"
  >
    {error}
  </p>{/if}
<div class="actions">
  <button
    type="button"
    disabled={busy || offset === 0}
    onclick={() => load(Math.max(0, offset - 50))}>Página anterior</button
  ><span>Página {Math.floor(offset / 50) + 1}</span><button
    type="button"
    disabled={busy || !hasMore}
    onclick={() => load(offset + 50)}>Página siguiente</button
  ><button type="button" disabled={busy || !entries.length} onclick={csv}
    >Exportar esta página (CSV)</button
  ><button
    type="button"
    disabled={busy || exporting || !summary?.records}
    onclick={exportAll}
    >{exporting
      ? 'Preparando exportación…'
      : 'Exportar intervalo completo (CSV)'}</button
  >
</div>
<p>
  La exportación completa usa los filtros aplicados, hasta 2000 registros. Si
  cambias los campos, aplica los filtros primero.
</p>
{#if exportNotice}<p role="status">{exportNotice}</p>{/if}
{#if !busy && !error && !entries.length}<p>
    No hay registros con estos filtros. Puedes registrar actividad desde el
    catálogo.
  </p>{/if}

<style>
  .filters,
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }
  .summary {
    padding: 16px;
    background: white;
    border: 1px solid #d9dfe5;
  }
  .summary div {
    min-width: 0;
  }
  dd {
    font-size: 24px;
    margin: 4px 0;
  }
  dt {
    font-size: 14px;
  }
  form {
    margin-bottom: 16px;
  }
  .actions {
    margin: 16px 0;
  }
</style>
