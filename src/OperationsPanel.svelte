<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';
  import { api } from './auth';
  import { downloadBlob } from './media';
  let {
    admin,
    onConfig = () => {},
  }: {
    admin: boolean;
    onConfig?: (config: {
      name: string;
      currency: string;
      timezone: string;
    }) => void;
  } = $props();
  let members = $state<any[]>([]),
    plans = $state<any[]>([]),
    products = $state<any[]>([]),
    visits = $state<any[]>([]),
    memberships = $state<any[]>([]),
    finance = $state<any>(),
    config = $state({
      name: 'Gimnasio piloto',
      currency: 'MXN',
      timezone: 'America/Mexico_City',
    });
  let name = $state(''),
    memberId = $state(''),
    saleMemberId = $state(''),
    planId = $state(''),
    planName = $state(''),
    kind = $state('period'),
    quantity = $state(30),
    price = $state(0),
    startDay = $state(new Date().toISOString().slice(0, 10)),
    endDay = $state(''),
    method = $state('cash'),
    reference = $state('');
  let token = $state(''),
    resolved = $state<any>(),
    membershipId = $state(''),
    consume = $state(false),
    qr = $state(''),
    credentialId = $state(''),
    reason = $state(''),
    from = $state(''),
    until = $state('');
  let productName = $state(''),
    variantName = $state(''),
    sku = $state(''),
    productPrice = $state(0),
    stock = $state(0),
    variantId = $state(''),
    saleQuantity = $state(1),
    lines = $state<{ variantId: string; quantity: number }[]>([]),
    editingVariant = $state<any>(),
    productId = $state(''),
    editingPlan = $state<any>();
  let busy = $state(false),
    error = $state(''),
    notice = $state(''),
    operationHistory = $state<any[]>([]),
    disposed = false,
    video: HTMLVideoElement,
    stream: MediaStream | undefined,
    scanning = $state(false),
    scanTimer: ReturnType<typeof setTimeout> | undefined;
  const label: Record<string, string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmado',
    voided: 'Anulado',
    active: 'Activa',
    revoked: 'Revocada',
    period: 'Periodo',
    entries: 'Bono de entradas',
    cash: 'Efectivo',
    transfer: 'Transferencia',
    terminal: 'Terminal',
    sale: 'Venta',
    membership: 'Membresía',
  };
  const money = (n: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: config.currency,
    }).format(n / 100);
  async function load() {
    const [m, v, c, p] = await Promise.all([
      api('/members'),
      api('/visits'),
      api('/config'),
      api(admin ? '/inventory' : '/products'),
    ]);
    if (disposed) return;
    members = m.members || [];
    visits = v.visits || [];
    if (c.config) {
      config = c.config;
      onConfig(config);
    }
    products = p.products || [];
    if (admin) {
      const [pl, ms, f] = await Promise.all([
        api('/plans'),
        api('/memberships'),
        api(`/finance?from=${from}&until=${until}`),
      ]);
      if (disposed) return;
      plans = pl.plans || [];
      memberships = ms.memberships || [];
      finance = f;
    }
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    busy = true;
    error = '';
    notice = '';
    try {
      await action();
      if (!disposed) await load();
    } catch (e) {
      if (!disposed) error = (e as Error).message;
    } finally {
      if (!disposed) busy = false;
    }
  }
  onMount(() => {
    run(async () => {});
    return () => {
      disposed = true;
      stopCamera();
    };
  });
  async function resolve() {
    const d = await api('/reception/resolve', {
      token: token.replace(/^climbing-visit:/, '').trim(),
    });
    if (!disposed) {
      resolved = d;
      membershipId = '';
      consume = false;
    }
  }
  function stopCamera() {
    if (scanTimer) clearTimeout(scanTimer);
    stream?.getTracks().forEach((t) => t.stop());
    stream = undefined;
    scanning = false;
  }
  async function camera() {
    error = '';
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      error =
        'Este navegador no tiene lector QR integrado. Usa un lector externo o pega el código de la credencial.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (disposed) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      await video.play();
      scanning = true;
      const detector = new Detector({ formats: ['qr_code'] });
      async function scan() {
        if (!scanning || disposed) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length) {
            token = codes[0].rawValue;
            stopCamera();
            await run(resolve);
            return;
          }
        } catch (e) {
          error = (e as Error).message;
          stopCamera();
          return;
        }
        scanTimer = setTimeout(scan, 250);
      }
      scan();
    } catch (e) {
      error = (e as Error).message;
      stopCamera();
    }
  }
  async function issue() {
    const d = await api('/credentials', { memberId });
    if (!disposed) {
      credentialId = d.id;
      qr = await QRCode.toDataURL('climbing-visit:' + d.token, {
        width: 320,
        margin: 2,
      });
      notice =
        'Credencial emitida. Las anteriores quedaron revocadas. Descárgala ahora; el código no se vuelve a mostrar.';
    }
  }
  async function paymentAction(p: any, action: 'confirm' | 'void') {
    if (action === 'void' && !reason.trim())
      throw new Error('Indica motivo de anulación.');
    await api(`/payments/${p.id}/${action}`, {
      expectedVersion: p.version,
      ...(action === 'void' ? { reason } : {}),
    });
    notice =
      action === 'confirm'
        ? 'Cobro confirmado.'
        : 'Cobro anulado con historial.';
  }
  async function history(type: string, id: string) {
    const d = await api(`/${type}/${id}/history`);
    if (!disposed) operationHistory = d.history || [];
  }
  async function exportFinance() {
    const d = await api(`/finance?export=csv&from=${from}&until=${until}`);
    if (!disposed)
      downloadBlob(
        new Blob([d.csv], { type: 'text/csv;charset=utf-8;' }),
        'cobros.csv',
      );
  }
</script>

<h1>{admin ? 'Operación del gimnasio' : 'Recepción'}</h1>
<p>
  Visitas, membresías y cobros son independientes de intentos y ascensos. Una
  credencial QR no inicia sesión.
</p>
{#if busy}<p role="status">Procesando…</p>{/if}{#if error}<p role="alert">
    {error}
  </p>{/if}{#if notice}<p role="status">{notice}</p>{/if}
<details>
  <summary>Socios y tarjetas QR</summary>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      run(async () => {
        await api('/members', { name });
        name = '';
      });
    }}
  >
    <label
      >Nombre del socio<input
        disabled={busy}
        bind:value={name}
        required
        maxlength="100"
      /></label
    ><button disabled={busy}>Crear socio en recepción</button>
  </form>
  <label
    >Socio<select disabled={busy} bind:value={memberId}
      ><option value="">Selecciona socio</option>{#each members as m}<option
          value={m.id}>{m.name}</option
        >{/each}</select
    ></label
  ><button disabled={busy || !memberId} onclick={() => run(issue)}
    >Emitir o reemitir QR</button
  >{#if qr}<img src={qr} alt="Credencial de visita del socio" /><a
      href={qr}
      download="credencial-visita.png">Descargar credencial</a
    ><button
      disabled={busy}
      onclick={() =>
        run(async () => {
          await api(`/credentials/${credentialId}/revoke`, {});
          qr = '';
          notice = 'Credencial revocada.';
        })}>Revocar esta credencial</button
    >{/if}
</details>
<details>
  <summary>Registrar visita</summary>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      run(resolve);
    }}
  >
    <label
      >Código QR de visita<input
        disabled={busy}
        bind:value={token}
        required
        autocomplete="off"
      /></label
    ><button disabled={busy}>Identificar socio</button>
  </form>
  <button disabled={busy || scanning} onclick={camera}
    >Escanear QR con cámara</button
  ><video
    bind:this={video}
    playsinline
    muted
    style:display={scanning ? 'block' : 'none'}
    aria-label="Cámara para lectura QR"
  ></video>{#if scanning}<button onclick={stopCamera}>Cerrar cámara QR</button
    >{/if}
  {#if resolved}<h3>{resolved.credential.name}</h3>
    <p>Día del gimnasio: {resolved.today}</p>
    {#if resolved.visit}<p>
        Visita ya registrada hoy · {label[resolved.visit.status] ||
          resolved.visit.status}. No se consume otra entrada.
      </p>{:else}<label
        >Membresía a usar<select disabled={busy} bind:value={membershipId}
          ><option value="">Visita sin membresía / sin consumo</option
          >{#each resolved.memberships as ms}<option value={ms.id}
              >{label[ms.kind] || ms.kind} · {ms.start_day} a {ms.end_day} · {ms.remaining}
              entradas</option
            >{/each}</select
        ></label
      ><label class="toggle"
        ><input type="checkbox" bind:checked={consume} />Confirmo consumir una
        entrada del bono</label
      ><button
        disabled={busy}
        onclick={() =>
          run(async () => {
            await api('/visits', {
              credentialId: resolved.credential.id,
              membershipId: membershipId || null,
              consume,
            });
            await resolve();
            notice = 'Visita confirmada.';
          })}>Confirmar visita</button
      >{/if}{/if}
</details>
<details>
  <summary>Visitas y correcciones</summary><label
    >Motivo de corrección / anulación<textarea
      disabled={busy}
      bind:value={reason}
      maxlength="500"></textarea></label
  >{#each visits as v}<article>
      <h3>{v.name} · {v.day}</h3>
      <p>
        {label[v.status] || v.status} · {v.consumed
          ? 'Entrada consumida'
          : 'Sin consumo'}
      </p>
      <button disabled={busy} onclick={() => run(() => history('visits', v.id))}
        >Historial de visita</button
      >{#if v.status === 'confirmed'}<button
          disabled={busy || !reason.trim()}
          onclick={() =>
            run(async () => {
              await api(`/visits/${v.id}/void`, {
                expectedVersion: v.version,
                reason,
              });
              resolved = undefined;
              notice =
                'Visita anulada; entrada restituida cuando correspondía.';
            })}>Anular visita</button
        >{/if}
    </article>{/each}
</details>
{#if operationHistory.length}<details open>
    <summary>Historial de operación</summary>{#each operationHistory as h}<p>
        Versión {h.version} · {h.changed_at} · {JSON.parse(h.snapshot).reason ||
          JSON.parse(h.snapshot).status ||
          'Creación'}
      </p>{/each}<button onclick={() => (operationHistory = [])}
      >Cerrar historial</button
    >
  </details>{/if}
{#if admin}
  <details>
    <summary>Configuración del gimnasio</summary>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api('/config', config, 'PUT');
          notice = 'Configuración guardada.';
        });
      }}
    >
      <label
        >Nombre del gimnasio<input
          disabled={busy}
          bind:value={config.name}
          required
          maxlength="100"
        /></label
      ><label
        >Moneda<input
          disabled={busy}
          bind:value={config.currency}
          required
          maxlength="3"
        /></label
      ><label>Zona horaria<input bind:value={config.timezone} required /></label
      ><button disabled={busy}>Guardar configuración</button>
    </form>
  </details>
  <details>
    <summary>Planes y membresías</summary>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api('/plans', {
            name: planName,
            kind,
            quantity,
            price: Math.round(price * 100),
          });
          notice = 'Plan creado.';
        });
      }}
    >
      <label
        >Nombre del plan<input
          disabled={busy}
          bind:value={planName}
          required
          maxlength="100"
        /></label
      ><label
        >Tipo de plan<select disabled={busy} bind:value={kind}
          ><option value="period">Periodo por días</option><option
            value="entries">Bono de entradas</option
          ></select
        ></label
      ><label
        >Días o entradas<input
          disabled={busy}
          type="number"
          bind:value={quantity}
          min="1"
          max="366"
          required
        /></label
      ><label
        >Precio del plan ({config.currency})<input
          disabled={busy}
          type="number"
          bind:value={price}
          min="0"
          step="0.01"
          required
        /></label
      ><button disabled={busy}>Crear plan</button>
    </form>
    <ul>
      {#each plans as p}<li>
          {p.name} · {label[p.kind] || p.kind} · {p.quantity} · {money(p.price)} ·
          {p.active ? 'Activo' : 'Inactivo'}<button
            disabled={busy}
            onclick={() =>
              (editingPlan = {
                ...p,
                price: p.price / 100,
                active: !!p.active,
              })}>Editar plan</button
          >
        </li>{/each}
    </ul>
    {#if editingPlan}<form
        onsubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api(
              `/plans/${editingPlan.id}`,
              {
                expectedVersion: editingPlan.version,
                name: editingPlan.name,
                price: Math.round(editingPlan.price * 100),
                active: editingPlan.active,
              },
              'PUT',
            );
            editingPlan = undefined;
            notice = 'Plan actualizado para futuras membresías.';
          });
        }}
      >
        <label
          >Nombre actualizado del plan<input
            disabled={busy}
            bind:value={editingPlan.name}
            required
            maxlength="100"
          /></label
        ><label
          >Precio actualizado del plan<input
            disabled={busy}
            type="number"
            min="0"
            step="0.01"
            bind:value={editingPlan.price}
            required
          /></label
        ><label class="toggle"
          ><input
            disabled={busy}
            type="checkbox"
            bind:checked={editingPlan.active}
          />Plan activo para nuevas membresías</label
        ><button disabled={busy}>Guardar cambios del plan</button><button
          type="button"
          disabled={busy}
          onclick={() => (editingPlan = undefined)}
          >Cancelar cambios del plan</button
        >
      </form>{/if}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api('/payments', {
            memberId,
            planId,
            startDay,
            ...(plans.find((p) => p.id === planId)?.kind === 'entries'
              ? { endDay }
              : {}),
            method,
            reference,
          });
          notice =
            'Membresía y cobro pendientes. Confirma el cobro para activar.';
        });
      }}
    >
      <label
        >Socio de membresía<select
          disabled={busy}
          bind:value={memberId}
          required
          ><option value="">Selecciona</option>{#each members as m}<option
              value={m.id}>{m.name}</option
            >{/each}</select
        ></label
      ><label
        >Plan<select disabled={busy} bind:value={planId} required
          ><option value="">Selecciona</option
          >{#each plans.filter((p) => p.active) as p}<option value={p.id}
              >{p.name} · {money(p.price)}</option
            >{/each}</select
        ></label
      ><label
        >Inicio de vigencia<input
          disabled={busy}
          type="date"
          bind:value={startDay}
          required
        /></label
      >{#if plans.find((p) => p.id === planId)?.kind === 'entries'}<label
          >Fin de vigencia del bono<input
            disabled={busy}
            type="date"
            bind:value={endDay}
            required
          /></label
        >{/if}<label
        >Método de cobro<select disabled={busy} bind:value={method}
          ><option value="cash">Efectivo</option><option value="transfer"
            >Transferencia</option
          ><option value="terminal">Terminal</option></select
        ></label
      ><label>Referencia<input bind:value={reference} maxlength="200" /></label
      ><button disabled={busy}>Preparar membresía y cobro</button>
    </form>
    {#each memberships as ms}<p>
        {ms.name} · {label[ms.status] || ms.status} · {ms.start_day}–{ms.end_day}
        · {ms.remaining} entradas
      </p>{/each}
  </details>
  <details>
    <summary>Cobros y dashboard</summary>
    <p>Registro operativo. No incluye facturación fiscal ni gastos.</p>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        run(async () => {});
      }}
    >
      <label>Desde (día UTC)<input type="date" bind:value={from} /></label
      ><label>Hasta (día UTC)<input type="date" bind:value={until} /></label
      ><button disabled={busy}>Aplicar intervalo financiero</button>
    </form>
    {#if finance?.totals}<p>
        Confirmados: {money(finance.totals.confirmed)} · Pendientes: {money(
          finance.totals.pending,
        )} · Anulados: {money(finance.totals.voided)}
      </p>
      <p>
        Efectivo: {money(finance.totals.methods.cash)} · Transferencia: {money(
          finance.totals.methods.transfer,
        )} · Terminal: {money(finance.totals.methods.terminal)}
      </p>
      <p>
        Membresías vigentes: {finance.memberships?.active || 0} · Ventas: {money(
          finance.totals.sales,
        )}
      </p>
      <button disabled={busy} onclick={() => run(exportFinance)}
        >Exportar cobros CSV</button
      >{/if}<label
      >Motivo de anulación del cobro<textarea
        disabled={busy}
        bind:value={reason}
        maxlength="500"></textarea></label
    >{#each finance?.payments || [] as p}<article>
        <h3>
          {money(p.amount)} · {label[p.method] || p.method} · {label[
            p.status
          ] || p.status}
        </h3>
        <p>
          {label[p.source_type] || p.source_type} · {p.reference} · {p.created_at}
        </p>
        <button
          disabled={busy}
          onclick={() => run(() => history('payments', p.id))}
          >Historial del cobro</button
        >{#if p.status === 'pending'}<button
            disabled={busy}
            onclick={() => run(() => paymentAction(p, 'confirm'))}
            >Confirmar cobro</button
          >{/if}{#if p.status !== 'voided'}<button
            disabled={busy || !reason.trim()}
            onclick={() => run(() => paymentAction(p, 'void'))}
            >Anular cobro</button
          >{/if}
      </article>{/each}
  </details>
  <details>
    <summary>Productos, ventas e inventario</summary>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api(
            productId ? '/variants' : '/products',
            productId
              ? {
                  productId,
                  name: variantName,
                  sku,
                  price: Math.round(productPrice * 100),
                  stock,
                }
              : {
                  name: productName,
                  variant: variantName,
                  sku,
                  price: Math.round(productPrice * 100),
                  stock,
                },
          );
          notice = 'Producto creado.';
        });
      }}
    >
      <label
        >Producto existente para nueva variante<select
          disabled={busy}
          bind:value={productId}
          ><option value="">Crear producto nuevo</option
          >{#each [...new Map(products.map( (v) => [v.product_id, v] )).values()] as p}<option
              value={p.product_id}>{p.product_name}</option
            >{/each}</select
        ></label
      >
      {#if !productId}<label
          >Nombre del producto<input
            disabled={busy}
            bind:value={productName}
            required
            maxlength="100"
          /></label
        >{/if}<label
        >Variante<input
          disabled={busy}
          bind:value={variantName}
          required
          maxlength="100"
        /></label
      ><label>SKU<input bind:value={sku} required maxlength="100" /></label
      ><label
        >Precio ({config.currency})<input
          disabled={busy}
          type="number"
          bind:value={productPrice}
          min="0"
          step="0.01"
          required
        /></label
      ><label
        >Existencias<input
          disabled={busy}
          type="number"
          bind:value={stock}
          min="0"
          max="100000"
          required
        /></label
      ><button disabled={busy}>Crear producto</button>
    </form>
    {#each products as v}<article>
        <h3>{v.product_name} · {v.name}</h3>
        <p>{v.sku} · {money(v.price)} · Stock {v.stock}</p>
        <button
          disabled={busy}
          onclick={() =>
            (editingVariant = {
              ...v,
              price: v.price / 100,
              active: !!v.active,
            })}>Ajustar inventario</button
        >
      </article>{/each}
    {#if editingVariant}<form
        onsubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api(
              `/variants/${editingVariant.id}`,
              {
                expectedVersion: editingVariant.version,
                price: Math.round(editingVariant.price * 100),
                stock: editingVariant.stock,
                active: !!editingVariant.active,
                reason,
              },
              'PUT',
            );
            editingVariant = undefined;
            notice = 'Inventario ajustado con auditoría.';
          });
        }}
      >
        <label
          >Precio ajustado<input
            disabled={busy}
            type="number"
            min="0"
            step="0.01"
            bind:value={editingVariant.price}
            required
          /></label
        ><label
          >Stock ajustado<input
            disabled={busy}
            type="number"
            min="0"
            max="100000"
            bind:value={editingVariant.stock}
            required
          /></label
        ><label
          >Motivo del ajuste<textarea
            disabled={busy}
            bind:value={reason}
            required
            maxlength="500"></textarea></label
        ><label class="toggle"
          ><input
            disabled={busy}
            type="checkbox"
            bind:checked={editingVariant.active}
          />Variante activa en catálogo</label
        ><button disabled={busy}>Guardar ajuste de inventario</button><button
          type="button"
          disabled={busy}
          onclick={() => (editingVariant = undefined)}>Cancelar ajuste</button
        >
      </form>{/if}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api('/sales', {
            memberId: saleMemberId || null,
            lines,
            method,
            reference,
          });
          lines = [];
          notice = 'Venta pendiente. Confirma el cobro para descontar stock.';
        });
      }}
    >
      <label
        >Socio de la venta (opcional)<select
          disabled={busy}
          bind:value={saleMemberId}
          ><option value="">Venta sin socio asociado</option
          >{#each members as m}<option value={m.id}>{m.name}</option
            >{/each}</select
        ></label
      >
      <label
        >Producto de venta<select disabled={busy} bind:value={variantId}
          ><option value="">Selecciona</option
          >{#each products.filter((v) => v.active) as v}<option value={v.id}
              >{v.product_name} · {v.name} · {money(v.price)}</option
            >{/each}</select
        ></label
      ><label
        >Cantidad de venta<input
          disabled={busy}
          type="number"
          min="1"
          max="10000"
          bind:value={saleQuantity}
        /></label
      ><button
        type="button"
        disabled={busy || !variantId}
        onclick={() => {
          if (lines.some((l) => l.variantId === variantId)) {
            error = 'La variante ya está en la venta.';
            return;
          }
          lines = [...lines, { variantId, quantity: saleQuantity }];
        }}>Agregar línea</button
      >
      <ul>
        {#each lines as l, i}<li>
            {products.find((v) => v.id === l.variantId)?.product_name} × {l.quantity}<button
              type="button"
              onclick={() => (lines = lines.filter((_, n) => n !== i))}
              >Quitar línea</button
            >
          </li>{/each}
      </ul>
      <label
        >Método de venta<select disabled={busy} bind:value={method}
          ><option value="cash">Efectivo</option><option value="transfer"
            >Transferencia</option
          ><option value="terminal">Terminal</option></select
        ></label
      ><label
        >Referencia de venta<input
          disabled={busy}
          bind:value={reference}
          maxlength="200"
        /></label
      ><button disabled={busy || !lines.length}>Preparar venta y cobro</button>
    </form>
  </details>
{/if}

<style>
  video {
    width: 100%;
    max-height: 240px;
  }
  button {
    margin: 4px;
  }
</style>
