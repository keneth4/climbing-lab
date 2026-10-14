<script lang="ts">
  import type { Point } from '../shared/alignment';
  import { nudgePoint } from './route-editing';
  let {
    position,
    onChange,
    prefix = 'Punto',
    disabled = false,
  }: {
    position: Point;
    onChange: (p: Point) => void;
    prefix?: string;
    disabled?: boolean;
  } = $props();
  let increment = $state(0.01);
  function nudge(axis: number, sign: number) {
    onChange(nudgePoint(position, axis, sign * increment));
  }
  function keyAdjust(e: KeyboardEvent) {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [1, 1],
      ArrowDown: [1, -1],
      PageUp: [2, 1],
      PageDown: [2, -1],
    };
    const d = directions[e.key];
    if (d) {
      e.preventDefault();
      e.stopPropagation();
      nudge(...d);
    }
  }
</script>

<fieldset {disabled} class="point-adjuster">
  <legend>Ajuste fino · {prefix}</legend>
  <label
    >Paso de ajuste<select bind:value={increment}
      ><option value={0.01}>0,01</option><option value={0.001}>0,001</option
      ></select
    ></label
  >
  <p>Unidades del clon; no equivalen a metros. Revisa desde otro ángulo.</p>
  <div
    class="nudge-pad"
    role="group"
    aria-label={`Ajuste con flechas de ${prefix}`}
  >
    {#each ['X', 'Y', 'Z'] as axis, i}<div>
        <button
          type="button"
          onkeydown={keyAdjust}
          aria-label={`${prefix}: disminuir ${axis}`}
          onclick={() => nudge(i, -1)}>−{axis}</button
        ><button
          type="button"
          onkeydown={keyAdjust}
          aria-label={`${prefix}: aumentar ${axis}`}
          onclick={() => nudge(i, 1)}>+{axis}</button
        >
      </div>{/each}
  </div>
  <details>
    <summary>Coordenadas avanzadas de {prefix}</summary
    >{#each ['X', 'Y', 'Z'] as axis, i}<label
        >Coordenada {axis} de {prefix}<input
          type="number"
          step="any"
          value={position[i]}
          oninput={(e) => {
            const next = [...position] as Point;
            next[i] = e.currentTarget.valueAsNumber;
            onChange(next);
          }}
        /></label
      >{/each}
  </details>
</fieldset>

<style>
  fieldset {
    border: 1px solid var(--border, #d9dfe5);
    border-radius: 8px;
    padding: 10px;
  }
  .nudge-pad {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .nudge-pad button {
    min-width: 44px;
    min-height: 44px;
  }
  p {
    font-size: 13px;
  }
</style>
