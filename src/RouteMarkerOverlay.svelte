<script lang="ts">
  import { markerColor, type MarkerLayout, type Rect } from './marker-layout';
  let {
    markers,
    viewport,
    onSelect,
    disabled = false,
    clipBottom = 0,
    selectionLabel = 'Seleccionar agarre',
  }: {
    markers: MarkerLayout[];
    viewport: Rect & { zoom?: number };
    onSelect?: (id: string) => void;
    disabled?: boolean;
    clipBottom?: number;
    selectionLabel?: string;
  } = $props();
</script>

<div
  class="route-marker-overlay"
  aria-label="Marcadores sobre el muro"
  style:zoom={1 / (viewport.zoom || 1)}
  style:left={`${viewport.x}px`}
  style:top={`${viewport.y}px`}
  style:width={`${viewport.width}px`}
  style:height={`${viewport.height}px`}
  style:clip-path={`inset(0 0 ${clipBottom}px 0)`}
>
  <svg width={viewport.width} height={viewport.height} aria-hidden="true">
    {#each markers as m (m.id)}
      {#if m.labelPoint}<line
          class="halo"
          x1={m.x}
          y1={m.y}
          x2={m.labelPoint.x}
          y2={m.labelPoint.y}
        /><line
          x1={m.x}
          y1={m.y}
          x2={m.labelPoint.x}
          y2={m.labelPoint.y}
        />{/if}
      <circle
        cx={m.x}
        cy={m.y}
        r="3"
        fill={markerColor(m.role)}
        stroke={m.active ? '#ffdf55' : '#fff'}
        stroke-width="2"
      />
    {/each}
  </svg>
  {#each markers as m (m.id)}
    {#if m.labelPoint && m.labelPoint.y + 24 <= viewport.height - clipBottom}
      {#if onSelect && m.role !== 'candidate'}
        <button
          type="button"
          {disabled}
          aria-label={`${selectionLabel} ${m.label} · ${m.role}`}
          aria-pressed={!!m.active}
          style:left={`${m.labelPoint.x}px`}
          style:top={`${m.labelPoint.y}px`}
          onclick={() => onSelect?.(m.id)}
          ><span class:active={m.active} style:background={markerColor(m.role)}
            >{m.label}</span
          ></button
        >
      {:else}
        <span
          class="readonly-label"
          role="img"
          aria-label={m.role === 'candidate'
            ? 'Punto en preparación'
            : `Agarre ${m.label} · ${m.role}`}
          style:left={`${m.labelPoint.x}px`}
          style:top={`${m.labelPoint.y}px`}
          ><span
            class:active={m.active}
            class:provisional={m.role === 'candidate'}
            style:background={markerColor(m.role)}>{m.label}</span
          ></span
        >
      {/if}
    {/if}
  {/each}
</div>

<style>
  .route-marker-overlay {
    position: fixed;
    z-index: 8;
    pointer-events: none;
    overflow: hidden;
  }
  svg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  line {
    stroke: #152534;
    stroke-width: 1;
  }
  line.halo {
    stroke: white;
    stroke-width: 3;
  }
  button,
  .readonly-label {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 48px;
    height: 48px;
    min-width: 48px;
    min-height: 48px;
    padding: 0;
    border: 0;
    background: transparent;
    display: grid;
    place-items: center;
    margin: 0;
    box-shadow: none;
  }
  button {
    pointer-events: auto;
  }
  button:disabled {
    pointer-events: none;
  }
  button:hover {
    background: transparent;
  }
  button:focus-visible {
    outline: 2px solid #ffdf55;
    outline-offset: -2px;
    border-radius: 8px;
  }
  span span,
  button span {
    display: grid;
    place-items: center;
    width: 28px;
    height: 24px;
    border: 2px solid white;
    border-radius: 7px;
    color: white;
    font: bold 13px system-ui;
    box-sizing: border-box;
    box-shadow: 0 1px 3px #0008;
  }
  span.active {
    outline: 2px solid #ffdf55;
    outline-offset: 2px;
  }
  span.provisional {
    border-style: dashed;
  }
</style>
