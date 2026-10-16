<script lang="ts">
  import { illustrationUrl, illustrationLabel } from './illustrations';
  import type { Route } from './domain';
  import { supabase } from './auth';
  let { route, imageUrl }: { route: Route; imageUrl?: string } = $props();
  let failed = $state(false);
  let photo = $state('');
  $effect(() => {
    const id = route.imageId,
      preview = imageUrl,
      draft = route.status === 'borrador';
    failed = false;
    photo =
      preview ||
      (id && !draft ? `/api/route-images/${id}` : illustrationUrl(route) || '');
    let disposed = false,
      objectUrl = '';
    if (id && draft && !preview)
      (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          const r = await fetch(`/api/route-images/${id}`, {
            headers: {
              Authorization: `Bearer ${data.session?.access_token || ''}`,
            },
          });
          if (!r.ok) throw new Error();
          const blob = await r.blob();
          if (disposed) return;
          objectUrl = URL.createObjectURL(blob);
          photo = objectUrl;
        } catch {
          if (!disposed) failed = true;
        }
      })();
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  });
</script>

<figure class="route-presentation">
  {#if photo && !failed}
    <img
      src={photo}
      alt={route.illustrationId && !route.imageId
        ? `${illustrationLabel}: ${route.name}`
        : `Imagen anotada de ${route.name}. Inicio I y final F.`}
      onerror={() => (failed = true)}
    />
  {:else}
    <div class="image-placeholder">
      <strong>{route.name}</strong>
      <p>
        {failed
          ? 'No se pudo cargar la imagen. Puedes consultar la ficha y registrar actividad.'
          : 'Imagen del muro pendiente. Esta ficha conserva la información de la ruta.'}
      </p>
    </div>
  {/if}
  <figcaption>
    {#if route.illustrationId && !route.imageId}<p>
        {illustrationLabel}. Sin captura 3D verificada.
      </p>{/if}
    {#if route.markersVerified}<p class="marker-legend">
        I Inicio · F Final · • Intermedio
      </p>{/if}
  </figcaption>
</figure>
<section aria-label="Información de ruta">
  <h3>Información de ruta</h3>
  <dl>
    <dt>Grado</dt>
    <dd>{route.grade}</dd>
    <dt>Sector</dt>
    <dd>{route.sector}</dd>
    <dt>Inicio (I)</dt>
    <dd>
      {route.markersVerified
        ? (route.holds3D || route.holds).filter((h) => h.role === 'inicio')
            .length
        : 'Por verificar'}
    </dd>
    <dt>Final (F)</dt>
    <dd>
      {route.markersVerified
        ? (route.holds3D || route.holds).filter((h) => h.role === 'final')
            .length
        : 'Por verificar'}
    </dd>
  </dl>
  {#if route.rules?.trim()}<h3>Reglas</h3>
    <p>{route.rules}</p>{/if}
</section>

<style>
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.4rem 1rem;
  }
  dt,
  .marker-legend {
    font-weight: 700;
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
</style>
