<script lang="ts">
  import type { Route } from './domain';
  import { gradeRank, gradeScale } from './pilot';
  import RouteThumbnail from './RouteThumbnail.svelte';
  let {
    routes,
    filtered,
    query = $bindable(),
    grade = $bindable(),
    sectorFilter = $bindable(),
    scaleFilter = $bindable(),
    minGrade = $bindable(),
    maxGrade = $bindable(),
    order = $bindable(),
    showRetired = $bindable(),
    select,
    clearFilters,
    loading,
    loadError,
    retry,
  }: {
    routes: Route[];
    filtered: Route[];
    query: string;
    grade: string;
    sectorFilter: string;
    scaleFilter: string;
    minGrade: string;
    maxGrade: string;
    order: string;
    showRetired: boolean;
    select: (id: string) => void;
    clearFilters: () => void;
    loading: boolean;
    loadError: string;
    retry: () => void;
  } = $props();
</script>

<section class="catalog" aria-label="Catálogo de rutas">
  <h1 tabindex="-1">Rutas</h1>
  <p>Encuentra tu siguiente reto por grado o sector.</p>
  <button disabled={loading} onclick={retry}>Actualizar rutas</button
  >{#if loadError && filtered.length}<p role="alert">
      No se pudo actualizar. Se muestran las rutas cargadas anteriormente. {loadError}
    </p>
    <button onclick={retry}>Reintentar catálogo</button>{/if}
  <label>Buscar<input bind:value={query} placeholder="Nombre o sector" /></label
  >
  <details>
    <summary>Filtros {filtered.length} resultados</summary>
    <label
      >Sector<select bind:value={sectorFilter}
        ><option value="">Todos</option
        >{#each [...new Set(routes.map((r) => r.sector))] as sector}<option
            value={sector}>{sector}</option
          >{/each}</select
      ></label
    >
    <label
      >Escala<select
        bind:value={scaleFilter}
        onchange={() => {
          minGrade = '';
          maxGrade = '';
          grade = '';
        }}
        ><option value="">Todas</option><option>V</option><option>Font</option
        ><option>Otra</option></select
      ></label
    >
    <label
      >Grado<select bind:value={grade}
        ><option value="">Todos</option>{#each [...new Set(routes
              .filter((r) => !scaleFilter || (r.gradeScale || gradeScale(r.grade)) === scaleFilter)
              .map((r) => r.grade))] as g}<option value={g}>{g}</option
          >{/each}</select
      ></label
    >
    {#if scaleFilter === 'V' || scaleFilter === 'Font'}{#each ['desde', 'hasta'] as limit}<label
          >Grado {limit}<select
            value={limit === 'desde' ? minGrade : maxGrade}
            onchange={(e) => {
              if (limit === 'desde') minGrade = e.currentTarget.value;
              else maxGrade = e.currentTarget.value;
            }}
            ><option value="">Sin límite</option>{#each [...new Set(routes
                  .filter((r) => (r.gradeScale || gradeScale(r.grade)) === scaleFilter)
                  .map((r) => r.grade))].sort((a, b) => (gradeRank(a, scaleFilter) || 0) - (gradeRank(b, scaleFilter) || 0)) as g}<option
                value={g}>{g}</option
              >{/each}</select
          ></label
        >{/each}{/if}
    <label
      >Orden<select bind:value={order}
        ><option value="recientes">Recientes</option><option value="nombre"
          >Nombre</option
        ></select
      ></label
    >
    <label class="toggle"
      ><input type="checkbox" bind:checked={showRetired} />Incluir retiradas</label
    >
  </details>
  <p>
    {filtered.length}
    {filtered.length === 1 ? 'ruta' : 'rutas'}{query ||
    sectorFilter ||
    grade ||
    scaleFilter
      ? ' · Filtros activos'
      : ''}
  </p>
  <button onclick={clearFilters}>Limpiar filtros</button>
  <div class="filter-chips" aria-label="Filtros activos">
    {#each [{ value: query, label: `Búsqueda: ${query}`, clear: () => (query = '') }, { value: sectorFilter, label: `Sector: ${sectorFilter}`, clear: () => (sectorFilter = '') }, { value: scaleFilter, label: `Escala: ${scaleFilter}`, clear: () => {
            scaleFilter = '';
            minGrade = '';
            maxGrade = '';
            grade = '';
          } }, { value: grade, label: `Grado: ${grade}`, clear: () => (grade = '') }, { value: minGrade, label: `Desde: ${minGrade}`, clear: () => (minGrade = '') }, { value: maxGrade, label: `Hasta: ${maxGrade}`, clear: () => (maxGrade = '') }, { value: showRetired ? '1' : '', label: 'Incluye retiradas', clear: () => (showRetired = false) }] as chip}{#if chip.value}<button
          aria-label={`Quitar ${chip.label}`}
          onclick={chip.clear}>{chip.label} ×</button
        >{/if}{/each}
  </div>
  <div class="route-list site-route-list">
    {#each filtered as r}<button class="route-card" onclick={() => select(r.id)}
        ><RouteThumbnail route={r} /><span
          ><strong>{r.name}</strong>{#if r.illustrationId && !r.imageId}<span
              >Ilustración de ejemplo; no fotografía del muro</span
            >{/if}<span>{r.grade} · {r.sector}</span><span
            >{r.status === 'retirada' ? 'Retirada' : 'Activa'} · Revisión {r.revision}</span
          ></span
        ></button
      >{/each}
    {#if !filtered.length}<div class="empty-state" role="status">
        <h2>
          {loadError
            ? 'No se pudo cargar el catálogo'
            : loading
              ? 'Cargando rutas…'
              : 'No hay rutas con estos filtros'}
        </h2>
        <p>
          {loadError ||
            'Prueba otro grado o sector, o limpia los filtros para consultar todas las rutas disponibles.'}
        </p>
        {#if loadError}<button onclick={retry}>Reintentar catálogo</button
          >{:else if !loading}<button onclick={clearFilters}
            >Mostrar todas las rutas</button
          >{/if}
      </div>{/if}
  </div>
</section>
