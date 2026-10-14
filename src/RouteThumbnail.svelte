<script lang="ts">
  import type { Route } from './domain';
  let { route }: { route: Route } = $props();
  let failed = $state(false);
  $effect(() => {
    route.imageId;
    failed = false;
  });
</script>

{#if route.imageId && !failed}<img
    class="route-thumbnail"
    src={`/api/route-images/${route.imageId}`}
    alt={`Vista de ${route.name}`}
    loading="lazy"
    onerror={() => (failed = true)}
  />{:else}<span
    class="route-thumbnail thumbnail-placeholder"
    aria-hidden="true">I · F</span
  >{/if}
