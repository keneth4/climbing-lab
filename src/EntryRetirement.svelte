<script lang="ts">
  import { onDestroy } from 'svelte';
  import { api } from './auth';
  import type { Entry } from './domain';
  let {
    entry,
    onDone,
    onCancel,
  }: { entry: Entry; onDone: () => Promise<void>; onCancel: () => void } =
    $props();
  let busy = $state(false),
    error = $state(''),
    disposed = false;
  onDestroy(() => (disposed = true));
  async function retire() {
    if (busy) return;
    busy = true;
    error = '';
    try {
      await api(
        `/entries/${entry.id}`,
        { expectedVersion: entry.entryVersion || 1 },
        'DELETE',
      );
      if (!disposed) await onDone();
    } catch (e) {
      if (!disposed) error = (e as Error).message;
    } finally {
      if (!disposed) busy = false;
    }
  }
</script>

<section class="retire">
  <h2>Retirar registro</h2>
  <p>
    {entry.routeName} · {entry.result} · {entry.attempts} intentos · {new Date(
      entry.date,
    ).toLocaleDateString('es-MX')}
  </p>
  <p>
    Al confirmar dejará de contar en tu actividad vigente. Sus datos y cambios
    permanecerán en el historial de registros retirados.
  </p>
  <button disabled={busy} onclick={retire}>Confirmar retiro</button><button
    disabled={busy}
    onclick={onCancel}>Cancelar retiro</button
  >{#if error}<p role="alert">{error}</p>{/if}
</section>

<style>
  .retire {
    padding: 16px;
    background: white;
    border: 1px solid #d9dfe5;
    margin: 16px 0;
  }
</style>
