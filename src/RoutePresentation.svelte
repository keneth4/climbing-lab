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
        : `Imagen anotada de ${route.name}, revisión ${route.revision}. Inicio I y final F.`}
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
    {route.sector} · Revisión {route.revision} · Inicio I · Final F
  </figcaption>
</figure>
<details>
  <summary>Agarres y reglas sin beta</summary>
  <p>
    {route.rules ||
      'No hay restricciones de pies publicadas. Consulta al staff si tienes dudas.'}
  </p>
  <ol>
    {#each route.holds3D?.length ? route.holds3D : route.holds as h, i}<li>
        Agarre {i + 1}: {h.role === 'inicio'
          ? 'Inicio (I)'
          : h.role === 'final'
            ? 'Final (F)'
            : 'Intermedio'}
      </li>{/each}
  </ol>
</details>
