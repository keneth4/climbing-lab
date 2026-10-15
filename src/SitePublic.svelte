<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from './auth';
  import TourPoster from './TourPoster.svelte';
  let poster = $state<{ imageId: string; title: string } | undefined>();
  onMount(() => {
    let active = true;
    api('/tours')
      .then((d) => {
        const s =
          d.tour?.content.stops.find(
            (s: any) => s.id === d.tour.content.startStopId,
          ) || d.tour?.content.stops[0];
        if (active && s?.imageId)
          poster = { imageId: s.imageId, title: s.title };
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  });
  import { site } from './site';
  let { view, navigate }: { view: string; navigate: (view: string) => void } =
    $props();
</script>

{#if view === 'Inicio'}
  <section class="home-hero" aria-labelledby="home-title">
    <div>
      <p class="eyebrow">Escala · Explora · Progresa</p>
      <h1 id="home-title" tabindex="-1">{site.content.headline}</h1>
      {#if site.editorial.hero}<img
          src={site.editorial.hero.src}
          alt={site.editorial.hero.alt}
        />{/if}
      <p class="hero-description">{site.content.description}</p>
      <div class="actions">
        <button class="primary" onclick={() => navigate('Catálogo')}
          >Explorar rutas</button
        ><button onclick={() => navigate('El gimnasio')}
          >Conocer el gimnasio</button
        >
      </div>
      <p class="example-note">{site.content.exampleNotice}</p>
    </div>
    <div class="home-art" aria-hidden="true">
      <svg viewBox="0 0 400 440" focusable="false"
        ><path
          d="M40 420 110 40 340 20 380 420Z"
          fill="currentColor"
          opacity=".12"
        /><path
          d="m150 365 50-90-65-70 110-90"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-dasharray="8 10"
        /><g fill="currentColor"
          ><ellipse
            cx="150"
            cy="365"
            rx="26"
            ry="15"
            transform="rotate(-20 150 365)"
          /><ellipse cx="200" cy="275" rx="22" ry="16" /><ellipse
            cx="135"
            cy="205"
            rx="28"
            ry="13"
            transform="rotate(25 135 205)"
          /><ellipse cx="245" cy="115" rx="26" ry="17" /></g
        ><g font-size="22" font-family="system-ui" fill="currentColor"
          ><text x="90" y="375">I</text><text x="290" y="122">F</text></g
        ></svg
      >
    </div>
  </section>
  <section aria-labelledby="home-tour-title">
    <h2 id="home-tour-title">Conoce el muro antes de explorar</h2>
    <p>Consulta las paradas y sus imágenes; el 3D es opcional.</p>
    {#if poster}<TourPoster
        imageId={poster.imageId}
        title={poster.title}
      />{/if}
    <button onclick={() => navigate('Recorrido')}>Recorrer el gimnasio</button>
  </section>
  <section class="home-benefits" aria-label="Cómo usar el sitio">
    {#each [{ title: 'Descubre una ruta', text: 'Busca por nombre, sector o dificultad. Consulta las reglas y abre la beta cuando quieras.' }, { title: 'Reconoce los agarres', text: 'Empieza por la ficha y su imagen. Explora en 3D bajo demanda, sin perder la información esencial.' }, { title: 'Registra tu progreso', text: 'Guarda intentos, ascensos y proyectos en tu cuenta. Comparte solo los datos que elijas.' }] as item}<article
      >
        <h2>{item.title}</h2>
        <p>{item.text}</p>
      </article>{/each}
  </section>
{:else}
  <section class="gym-intro">
    <p class="eyebrow">{site.brand.name} — {site.brand.subtitle}</p>
    <h1 tabindex="-1">El gimnasio</h1>
    <p>{site.content.exampleNotice}</p>
    <p>
      Esta base muestra cómo consultar rutas y registrar progreso. Para planear
      una visita se necesitan datos oficiales del gimnasio: ubicación, horarios,
      servicios, precios y contacto.
    </p>
    <button onclick={() => navigate('Recorrido')}>Recorrer el gimnasio</button>
    <button class="primary" onclick={() => navigate('Catálogo')}
      >Explorar rutas</button
    >
  </section>
  {#if site.editorial.location}<section>
      <h2>Ubicación</h2>
      <p>{site.editorial.location.text}</p>
      {#if site.editorial.location.mapUrl}<a
          href={site.editorial.location.mapUrl}>Ver ubicación en el mapa</a
        >{/if}
    </section>{/if}
  {#if site.editorial.hours}<section>
      <h2>Horarios</h2>
      <p>{site.editorial.hours}</p>
    </section>{/if}
  {#if site.editorial.services?.length}<section>
      <h2>Servicios</h2>
      <ul>
        {#each site.editorial.services as service}<li>{service}</li>{/each}
      </ul>
    </section>{/if}
  {#if site.editorial.contacts?.length}<section>
      <h2>Contacto</h2>
      {#each site.editorial.contacts as c}<p>
          <a href={c.url}>{c.label}</a>
        </p>{/each}
    </section>{/if}
  <section aria-labelledby="faq-title">
    <h2 id="faq-title">Preguntas frecuentes</h2>
    {#each site.content.faq as item}<details class="faq">
        <summary>{item.question}</summary>
        <p>{item.answer}</p>
      </details>{/each}
  </section>
{/if}
