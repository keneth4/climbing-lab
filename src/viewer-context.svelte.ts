import type { ComponentProps } from 'svelte';
import type SplatRuntime from './SplatRuntime.svelte';
export const VIEWER_CONTEXT = Symbol('gym-viewer');
export type ViewerOptions = ComponentProps<typeof SplatRuntime>;
export class ViewerWorkspace {
  locked = $state(false);
  lastOptions = $state<ViewerOptions | undefined>();
  reset() {
    this.tools.clear();
    this.active = undefined;
    this.lastOptions = undefined;
  }
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
    this.lastOptions = options;
  }
  release(owner: symbol) {
    this.tools.delete(owner);
    if (this.active?.owner === owner) {
      this.lastOptions = {
        ...this.active.options,
        exportInfo: undefined,
        onImage: undefined,
        onPoint: undefined,
        onHoldSelect: undefined,
        onModeChange: undefined,
        onCancelTool: undefined,
        previewPoint: undefined,
        focusPoint: undefined,
        selectedHoldId: undefined,
        spatialMode: undefined,
        toolsDisabled: false,
        editorStep: undefined,
        focusRequest: 0,
        onReady: undefined,
        onExit: undefined,
        staff: false,
      };
      this.active = [...this.tools.values()].at(-1);
    }
  }
}
