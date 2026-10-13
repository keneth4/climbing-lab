import type { ComponentProps } from 'svelte';
import type SplatRuntime from './SplatRuntime.svelte';
export const VIEWER_CONTEXT = Symbol('gym-viewer');
export type ViewerOptions = ComponentProps<typeof SplatRuntime>;
export class ViewerWorkspace {
  active = $state<
    { owner: symbol; options: ViewerOptions; target: HTMLElement } | undefined
  >();
  set(owner: symbol, options: ViewerOptions, target: HTMLElement) {
    this.active = { owner, options, target };
  }
  release(owner: symbol) {
    if (this.active?.owner === owner) this.active = undefined;
  }
}
