<script lang="ts">
  import { getContext } from 'svelte';
  import {
    VIEWER_CONTEXT,
    type ViewerWorkspace,
    type ViewerOptions,
  } from './viewer-context.svelte';
  let options: ViewerOptions = $props();
  const workspace = getContext<ViewerWorkspace>(VIEWER_CONTEXT);
  const owner = Symbol('viewer-tool');
  let target: HTMLDivElement;
  $effect(() => {
    workspace.set(owner, { ...options }, target);
  });
  $effect(() => () => workspace.release(owner));
</script>

<div bind:this={target} class="viewer-tools"></div>
