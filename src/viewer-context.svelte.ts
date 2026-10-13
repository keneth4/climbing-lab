import type { ComponentProps } from 'svelte';
import type SplatRuntime from './SplatRuntime.svelte';
export const VIEWER_CONTEXT = Symbol('gym-viewer');
export type ViewerOptions = ComponentProps<typeof SplatRuntime>;
export class ViewerWorkspace {
  locked = $state(false);
  private tools = new Map<
    symbol,
    { owner: symbol; options: ViewerOptions; target: HTMLElement }
  >();
  active = $state<
    { owner: symbol; options: ViewerOptions; target: HTMLElement } | undefined
  >();
  set(owner: symbol, options: ViewerOptions, target: HTMLElement) {
    const tool = { owner, options, target };
    this.tools.set(owner, tool);
    this.active = tool;
  }
  release(owner: symbol) {
    this.tools.delete(owner);
    if (this.active?.owner === owner)
      this.active = [...this.tools.values()].at(-1);
  }
}
