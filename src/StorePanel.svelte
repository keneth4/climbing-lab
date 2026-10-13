<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './auth';
  let products = $state<any[]>([]),
    currency = $state('MXN'),
    error = $state(''),
    disposed = false;
  onMount(() => {
    api('/products')
      .then((d) => {
        if (!disposed) {
          products = d.products || [];
          currency = d.currency || 'MXN';
        }
      })
      .catch((e) => {
        if (!disposed) error = e.message;
      });
    return () => {
      disposed = true;
    };
  });
</script>

<h1>Productos de escalada</h1>
<p>
  Consulta disponibilidad y compra en recepción. Los pagos en línea todavía no
  están habilitados.
</p>
{#each products as p}<article>
    <h2>{p.product_name}</h2>
    <p>
      {p.name} · {new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency,
      }).format(p.price / 100)} · {p.stock > 0 ? 'Disponible' : 'Agotado'}
    </p>
  </article>{/each}{#if !products.length && !error}<p>
    No hay productos publicados.
  </p>{/if}{#if error}<p role="alert">{error}</p>{/if}
