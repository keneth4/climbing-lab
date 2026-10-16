<script lang="ts">
  import { site } from './site';
  let {
    navigate,
    locked,
  }: { navigate: (view: string) => void; locked: boolean } = $props();
</script>

<footer class="site-footer">
  <div>
    <strong>{site.brand.name} — {site.brand.subtitle.toLowerCase()}</strong>
    <p>{site.content.exampleNotice}</p>
  </div>
  <div class="actions">
    <button disabled={locked} onclick={() => navigate('El gimnasio')}
      >Información y preguntas frecuentes</button
    ><button disabled={locked} onclick={() => navigate('Productos')}
      >Productos disponibles</button
    >
  </div>
</footer>
