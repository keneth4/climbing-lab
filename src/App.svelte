<script lang="ts">
  import QRCode from 'qrcode';
  import SplatViewer from './SplatViewer.svelte';
  import { createEntry, loadState, routeUrl, type Entry } from './domain';
  let db = $state(loadState());
  let tab = $state('Catálogo');
  let staff = $state(false);
  let selectedId = $state(
    new URLSearchParams(location.search).get('ruta') || db.routes[0].id,
  );
  let selected = $derived(db.routes.find((r) => r.id === selectedId));
  let query = $state('');
  let grade = $state('');
  let showRetired = $state(false);
  let filtered = $derived(
    db.routes.filter(
      (r) =>
        (showRetired || r.status === 'activa') &&
        (!grade || r.grade === grade) &&
        r.name.toLowerCase().includes(query.toLowerCase()),
    ),
  );
  let attempts = $state(1);
  let result = $state<Entry['result']>('intento');
  let notes = $state('');
  let report = $state('');
  let message = $state('');
  let qr = $state('');
  let newName = $state('');
  let newGrade = $state('V1');
  let privacy = $state(false);
  let name = $state('');
  $effect(() => {
    try {
      localStorage.setItem('climbing-lab:v1', JSON.stringify(db));
    } catch {
      message = 'No se pudo guardar en este dispositivo.';
    }
  });
  $effect(() => {
    const id = selectedId;
    qr = '';
    QRCode.toDataURL(routeUrl(id), { width: 220, margin: 2 })
      .then((value) => {
        if (selectedId === id) qr = value;
      })
      .catch(() => {
        message = 'No se pudo generar el QR.';
      });
  });
  function select(id: string) {
    selectedId = id;
    history.replaceState(null, '', routeUrl(id));
    message = '';
  }
  function record() {
    if (!selected || selected.status !== 'activa') return;
    try {
      db.entries.unshift(createEntry(selected, attempts, result, notes));
      notes = '';
      message = 'Actividad guardada en tu bitácora local.';
    } catch (e) {
      message = (e as Error).message;
    }
  }
  function sendReport() {
    if (!selected || !report.trim()) return;
    db.reports.unshift({
      id: crypto.randomUUID(),
      routeId: selected.id,
      revision: selected.revision,
      description: report.trim(),
      status: 'pendiente',
    });
    report = '';
    message = 'Reporte enviado a la bandeja de demostración del staff.';
  }
  function addRoute() {
    if (!staff || !newName.trim()) return;
    const id = crypto.randomUUID();
    db.routes.push({
      id,
      revision: 1,
      name: newName.trim(),
      grade: newGrade,
      sector: 'Spray wall',
      beta: '',
      status: 'activa',
      holds: [],
    });
    newName = '';
    select(id);
    tab = 'Catálogo';
  }
  function download(data: string, filename: string) {
    const a = document.createElement('a');
    a.href = data;
    a.download = filename;
    a.click();
  }
  function exportImage(entry?: Entry) {
    const route = entry
      ? db.routes.find((r) => r.id === entry.routeId)
      : selected;
    if (!route) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f4f6f8';
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = '#172c3e';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('Climbing Lab · Gimnasio demo', 60, 100);
    ctx.font = 'bold 60px sans-serif';
    ctx.fillText((entry?.routeName || route.name).slice(0, 27), 60, 195);
    ctx.font = '36px sans-serif';
    ctx.fillText(entry?.grade || route.grade, 60, 255);
    ctx.fillStyle = '#d9dfe5';
    ctx.fillRect(60, 310, 960, 650);
    // Historical cards must not silently use a newer route presentation.
    for (const h of entry?.holds ||
      (!entry || entry.revision === route.revision ? route.holds : [])) {
      ctx.beginPath();
      ctx.arc(60 + h.x * 9.6, 310 + h.y * 6.5, 20, 0, Math.PI * 2);
      ctx.fillStyle =
        h.role === 'inicio'
          ? '#137a58'
          : h.role === 'final'
            ? '#b34c0b'
            : '#2867ad';
      ctx.fill();
    }
    ctx.fillStyle = '#172c3e';
    ctx.font = '30px sans-serif';
    ctx.fillText('Esquema de demostración · sin captura 3D', 60, 1020);
    if (entry) {
      ctx.fillText(
        `Ascenso · ${new Date(entry.date).toLocaleDateString('es-MX')}`,
        60,
        1090,
      );
      if (privacy)
        ctx.fillText(
          `${name.slice(0, 35)} · ${entry.attempts} intentos`,
          60,
          1140,
        );
    }
    ctx.font = '22px sans-serif';
    ctx.fillText(routeUrl(route.id).slice(0, 78), 60, 1220);
    ctx.fillText('Por Creativivid', 60, 1280);
    download(
      canvas.toDataURL('image/png'),
      `${route.id}${entry ? '-ascenso' : ''}.png`,
    );
  }
</script>

<header>
  <div><strong>Climbing Lab</strong><span>Gimnasio de demostración</span></div>
  <label class="toggle"
    ><input type="checkbox" bind:checked={staff} /> Modo staff de demostración</label
  >
</header>
<div class="notice">
  Prototipo local: los datos se guardan en este navegador. Sin cuentas ni
  permisos reales todavía.
</div>
<nav aria-label="Principal">
  {#each ['Catálogo', 'Bitácora', ...(staff ? ['Staff'] : [])] as item}<button
      class:active={tab === item}
      onclick={() => (tab = item)}>{item}</button
    >{/each}
</nav>
<main>
  {#if tab === 'Catálogo'}
    <div class="layout">
      <aside>
        <h1>Rutas</h1>
        <label
          >Buscar<input
            bind:value={query}
            placeholder="Nombre de ruta"
          /></label
        ><label
          >Grado<select bind:value={grade}
            ><option value="">Todos</option
            >{#each [...new Set(db.routes.map((r) => r.grade))] as g}<option
                >{g}</option
              >{/each}</select
          ></label
        ><label class="toggle"
          ><input type="checkbox" bind:checked={showRetired} /> Incluir retiradas</label
        >
        <div class="route-list">
          {#each filtered as r}<button
              class:selected={selectedId === r.id}
              onclick={() => select(r.id)}
              ><strong>{r.name}</strong><span
                >{r.grade} · {r.sector} · {r.status}</span
              ></button
            >{/each}{#if !filtered.length}<p>
              No hay rutas con estos filtros.
            </p>{/if}
        </div>
      </aside>
      <section>
        {#if selected}<h2>{selected.name} <small>{selected.grade}</small></h2>
          <p>
            {selected.sector} · Revisión {selected.revision} · {selected.status}
          </p>
          <SplatViewer
            routeId={selected.id}
            saved={selected.camera}
            {staff}
            onSave={(view) => {
              if (selected) selected.camera = view;
            }}
          />
          <div class="wall" aria-label="Esquema de agarres de la ruta">
            <span class="wall-label"
              >Esquema de ruta · captura 3D pendiente</span
            >{#each selected.holds as hold}<span
                class="hold {hold.role}"
                style:left="{hold.x}%"
                style:top="{hold.y}%"
                title={hold.role}
                >{hold.role === 'inicio'
                  ? 'I'
                  : hold.role === 'final'
                    ? 'F'
                    : ''}</span
              >{/each}
          </div>
          <p class="legend">
            Verde: inicio · Azul: intermedio · Naranja: final
          </p>
          <details>
            <summary>Ver beta</summary>
            <p>{selected.beta || 'El staff aún no ha añadido una beta.'}</p>
          </details>
          <div class="actions">
            <button onclick={() => exportImage()}
              >Exportar imagen de ruta</button
            ><a href={routeUrl(selected.id)}>Enlace de ruta</a>
          </div>
          <details>
            <summary>QR de la ruta</summary>{#if qr}<img
                src={qr}
                alt="QR del enlace a esta ruta"
                width="220"
                height="220"
              /><button onclick={() => download(qr, `${selectedId}-qr.png`)}
                >Descargar QR</button
              >{/if}
            <p>
              Este enlace apunta al sitio actual; para compartirlo fuera del
              equipo necesita una publicación accesible.
            </p>
          </details>
          <div class="forms">
            <form
              onsubmit={(e) => {
                e.preventDefault();
                record();
              }}
            >
              <h3>Registrar actividad</h3>
              <label
                >Intentos<input
                  type="number"
                  min="1"
                  step="1"
                  bind:value={attempts}
                  required
                /></label
              ><label
                >Resultado<select bind:value={result}
                  ><option value="intento">Intento</option><option
                    value="ascenso">Ascenso</option
                  ></select
                ></label
              ><label>Notas<textarea bind:value={notes}></textarea></label
              ><button disabled={selected.status !== 'activa'}
                >Guardar actividad</button
              >
            </form>
            <form
              onsubmit={(e) => {
                e.preventDefault();
                sendReport();
              }}
            >
              <h3>Reportar un error</h3>
              <label
                >Descripción<textarea
                  bind:value={report}
                  required
                  maxlength="2000"></textarea></label
              ><button>Enviar reporte</button>
            </form>
          </div>
          {#if staff}<details>
              <summary>Editar ruta (demo)</summary><label
                >Nombre<input bind:value={selected.name} /></label
              ><label
                >Beta<textarea bind:value={selected.beta}></textarea></label
              ><button
                onclick={() => {
                  if (selected) {
                    selected.status =
                      selected.status === 'activa' ? 'retirada' : 'activa';
                  }
                }}
                >{selected.status === 'activa'
                  ? 'Retirar ruta'
                  : 'Reactivar ruta'}</button
              >
              <p>
                Edición de cámaras, marcadores y revisiones históricas
                pendiente.
              </p>
            </details>{/if}
        {:else}<h2>Ruta no encontrada</h2>
          <p>Selecciona una ruta del catálogo.</p>{/if}
      </section>
    </div>
  {:else if tab === 'Bitácora'}<h1>Mi bitácora local</h1>
    <label class="toggle"
      ><input type="checkbox" bind:checked={privacy} /> Incluir nombre e intentos
      en tarjeta</label
    >{#if privacy}<label
        >Nombre para la tarjeta<input bind:value={name} maxlength="35" /></label
      >{/if}{#each db.entries as entry}<article>
        <h2>{entry.routeName} · {entry.grade}</h2>
        <p>
          {entry.result === 'ascenso' ? 'Ascenso' : 'Intento'} · {entry.attempts}
          intentos · {new Date(entry.date).toLocaleDateString('es-MX')}
        </p>
        <p>{entry.notes}</p>
        {#if entry.result === 'ascenso'}<button
            onclick={() => exportImage(entry)}>Exportar tarjeta personal</button
          >{/if}
      </article>{/each}{#if !db.entries.length}<p>
        Aún no tienes actividad. Registra un intento desde el catálogo.
      </p>{/if}
  {:else if tab === 'Staff' && staff}<h1>Panel del staff · demo</h1>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        addRoute();
      }}
    >
      <h2>Crear ruta</h2>
      <label>Nombre<input bind:value={newName} required maxlength="80" /></label
      ><label
        >Grado<input bind:value={newGrade} required maxlength="15" /></label
      ><button>Crear ruta</button>
    </form>
    <h2>Reportes</h2>
    {#each db.reports as r}<article>
        <strong
          >{db.routes.find((route) => route.id === r.routeId)?.name ||
            r.routeId}</strong
        >
        <p>{r.description}</p>
        <p>{r.status}</p>
        {#if r.status === 'pendiente'}<button
            onclick={() => (r.status = 'resuelto')}>Marcar resuelto</button
          >{/if}
      </article>{/each}{#if !db.reports.length}<p>No hay reportes.</p>{/if}
  {:else}<p>Activa el modo de demostración para consultar el panel.</p>{/if}
  {#if message}<p class="message" role="status">{message}</p>{/if}
</main>
