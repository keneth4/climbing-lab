<script lang="ts">
  import { illustrationUrl, illustrationLabel } from './illustrations';
  import type { Route } from './domain';
  let { route }: { route: Route } = $props();
  let failed = $state(false);
  $effect(() => {
    route.imageId;
    route.illustrationId;
    failed = false;
  });
</script>

{#if (route.imageId || illustrationUrl(route)) && !failed}<img
    class="route-thumbnail"
    src={route.imageId
      ? `/api/route-images/${route.imageId}`
      : illustrationUrl(route)}
    alt={route.imageId
      ? `Vista de ${route.name}`
      : `${illustrationLabel}: ${route.name}`}
    loading="lazy"
    onerror={() => (failed = true)}
  />{:else}<span
    class="route-thumbnail thumbnail-placeholder"
    aria-hidden="true">I · F</span
  >{/if}
