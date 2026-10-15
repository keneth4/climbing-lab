<script lang="ts">
  import { illustrationUrl, illustrationLabel } from './illustrations';
  import QRCode from 'qrcode';
  import { cardPalette } from './site';
  import { api } from './auth';
  import { routeUrl, type Route, type Entry } from './domain';
  import { downloadBlob, renderCard } from './media';
  import { sharedPersonal, measure, type ShareFields } from './pilot';
  let {
    route,
    entry,
    fields,
    name = '',
    gym,
  }: {
    route?: Route;
    entry?: Entry;
    fields: ShareFields;
    name?: string;
    gym: string;
  } = $props();
  let preview = $state(''),
    error = $state(''),
    busy = $state(false);
  let output = $state<Blob | undefined>();
  let printable = $state(false);
  let request = 0;
  $effect(() => {
    const values = {
      route,
      entry,
      fields: { ...fields },
      name,
      gym,
      printable,
    };
    const ticket = ++request;
    preview = '';
    output = undefined;
    error = '';
    busy = true;
    (async () => {
      try {
        const r: Route | undefined = values.entry
          ? (await api(`/entries/${values.entry.id}/presentation`)).snapshot
          : values.route;
        if (!r) throw new Error('Presentación no disponible.');
        const id = values.entry?.routeId || r.id;
        const revision = values.entry?.revision || r.revision;
        const url = routeUrl(id);
        let canvas: HTMLCanvasElement;
        if (values.printable) {
          canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 1350;
          const c = canvas.getContext('2d')!;
          c.fillStyle = 'white';
          c.fillRect(0, 0, 1080, 1350);
          c.fillStyle = cardPalette().background;
          c.font = 'bold 48px system-ui';
          wrap(
            c,
            `${values.entry?.routeName || r.name} · ${values.entry?.grade || r.grade}`,
            60,
            90,
            960,
            60,
          );
          c.font = '32px system-ui';
          wrap(c, `${values.gym} · ${r.sector || ''}`, 60, 240, 960, 42);
          const qr = await image(
            await QRCode.toDataURL(url, {
              width: 680,
              margin: 4,
              errorCorrectionLevel: 'M',
            }),
          );
          c.drawImage(qr, 200, 360, 680, 680);
          c.font = '24px system-ui';
          c.fillText('VISTA PREVIA · impresión pública pendiente', 60, 320);
          wrap(c, url, 60, 1120, 960, 32);
          c.fillText(`Revisión ${revision} · Escanea para consultar`, 60, 1300);
        } else {
          if (!r.imageId && !illustrationUrl(r))
            throw new Error(
              'Esta revisión no tiene imagen de respaldo. Prepara la tarjeta histórica 3D; no se usará el muro actual.',
            );
          const img = await image(
            r.imageId ? `/api/route-images/${r.imageId}` : illustrationUrl(r)!,
          );
          const source = document.createElement('canvas');
          source.width = img.naturalWidth;
          source.height = img.naturalHeight;
          source.getContext('2d')!.drawImage(img, 0, 0);
          canvas = renderCard(source, {
            title: `${values.entry?.routeName || r.name}${!r.imageId && r.illustrationId ? ` · ${illustrationLabel}` : ''}`,
            grade: values.entry?.grade || r.grade,
            gym: values.gym,
            revision,
            url,
            personal: values.entry
              ? sharedPersonal(values.entry, values.fields, values.name)
              : undefined,
          });
        }
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) =>
              b
                ? resolve(b)
                : reject(new Error('No se pudo preparar la tarjeta.')),
            'image/png',
          ),
        );
        if (ticket !== request) return;
        output = blob;
        preview = canvas.toDataURL('image/png');
      } catch (e) {
        if (ticket === request) {
          error = (e as Error).message;
          measure('export_error');
        }
      } finally {
        if (ticket === request) busy = false;
      }
    })();
    return () => {
      request++;
    };
  });
  function image(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error('No se pudo cargar la imagen de esta revisión.'));
      img.src = src;
    });
  }
  function wrap(
    c: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    let line = '';
    for (const char of text) {
      if (c.measureText(line + char).width > width) {
        c.fillText(line, x, y);
        y += height;
        line = '';
      }
      line += char;
    }
    c.fillText(line, x, y);
  }
</script>

<section aria-label="Vista previa para compartir">
  <h3>Vista previa para compartir</h3>
  <p>Descargar guarda un archivo en tu dispositivo; no publica en redes.</p>
  <label class="toggle"
    ><input type="checkbox" bind:checked={printable} />Vista previa de tarjeta
    QR (108 × 135 mm a 254 ppp)</label
  >
  {#if busy}<p role="status">Preparando vista previa…</p>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
  {#if preview}<img
      src={preview}
      alt="Vista previa exacta del archivo que se descargará"
    />{/if}
  <button
    disabled={!output || busy}
    onclick={() => {
      if (output) {
        downloadBlob(
          output,
          printable ? 'ruta-qr-vista-previa.png' : 'ruta-tarjeta.png',
        );
        measure('export_done');
        error = '';
      }
    }}>Descargar tarjeta (PNG)</button
  >
  <button disabled>Imprimir QR público</button>
  {#if preview}<p>
      Vista previa lista. La impresión pública permanece pendiente de verificar
      el origen HTTPS y el acceso remoto.
    </p>{/if}
</section>
