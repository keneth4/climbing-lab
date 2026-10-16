<script lang="ts">
  import { supabase } from './auth';
  let {
    imageId,
    title,
    privateOwner = '',
    decorative = false,
  }: {
    imageId: string;
    title: string;
    privateOwner?: string;
    decorative?: boolean;
  } = $props();
  let src = $state(''),
    error = $state(false);
  $effect(() => {
    const id = imageId,
      owner = privateOwner;
    let active = true,
      objectUrl = '';
    src = '';
    error = false;
    if (!owner) src = '/api/tour-images/' + encodeURIComponent(id);
    else
      void (async () => {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user.id !== owner)
            throw new Error('Sesión cambiada');
          const response = await fetch(
            '/api/tour-images/' + encodeURIComponent(id),
            {
              headers: { Authorization: 'Bearer ' + data.session.access_token },
            },
          );
          if (!response.ok) throw new Error('Imagen no disponible');
          const blob = await response.blob();
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          src = objectUrl;
        } catch {
          if (active) error = true;
        }
      })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  });
</script>

{#if error}<p role="status">
    Imagen de parada no disponible. El texto y la navegación siguen disponibles.
  </p>
{:else if src}<img
    {src}
    alt={decorative ? '' : `Vista de ${title || 'la parada'}`}
    onerror={() => (error = true)}
  />{/if}

<style>
  img {
    width: 100%;
    max-height: 320px;
    object-fit: contain;
    border-radius: 8px;
    background: var(--page);
  }
  @media (max-width: 750px) {
    img {
      max-height: 180px;
    }
  }
</style>
