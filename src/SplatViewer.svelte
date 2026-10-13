<script lang="ts">
  import { onMount } from 'svelte';
  import type { CameraView } from './domain';
  let {
    saved,
    onSave,
    staff,
    routeId,
  }: {
    saved?: CameraView;
    onSave: (view: CameraView) => void;
    staff: boolean;
    routeId: string;
  } = $props();
  let canvas: HTMLCanvasElement;
  let status = $state('Carga un PLY o SOG local para explorar la captura.');
  let initialized = $state(false);
  let ready = $state(false);
  let loading = $state(false);
  let controller:
    | {
        load: (file: File) => Promise<void>;
        apply: (view?: CameraView) => void;
        save: () => CameraView;
        reset: () => void;
      }
    | undefined;
  $effect(() => {
    const view = saved;
    void routeId;
    controller?.apply(view);
  });
  onMount(() => {
    let disposed = false;
    let cleanup = () => {};
    import('playcanvas')
      .then((pc) => {
        if (disposed) return;
        const app = new pc.Application(canvas, {
          graphicsDeviceOptions: {
            antialias: false,
            preserveDrawingBuffer: true,
          },
        });
        app.graphicsDevice.maxPixelRatio = Math.min(
          window.devicePixelRatio,
          1.5,
        );
        const camera = new pc.Entity('camera');
        camera.addComponent('camera', {
          clearColor: new pc.Color(0.09, 0.13, 0.17),
          nearClip: 0.01,
          farClip: 10000,
        });
        app.root.addChild(camera);
        let yaw = 0,
          pitch = 0,
          distance = 5,
          target = new pc.Vec3(),
          captureId = '',
          generation = 0;
        let entity: InstanceType<typeof pc.Entity> | undefined;
        let asset: InstanceType<typeof pc.Asset> | undefined;
        let defaultView = {
          yaw: 0,
          pitch: 0,
          distance: 5,
          target: [0, 0, 0] as [number, number, number],
          captureId: '',
        };
        const update = () => {
          camera.setPosition(
            target.x + distance * Math.cos(pitch) * Math.sin(yaw),
            target.y + distance * Math.sin(pitch),
            target.z + distance * Math.cos(pitch) * Math.cos(yaw),
          );
          camera.lookAt(target);
        };
        const apply = (view?: CameraView) => {
          if (!view || view.captureId !== captureId) view = defaultView;
          yaw = view.yaw;
          pitch = view.pitch;
          distance = view.distance;
          target.set(...view.target);
          update();
        };
        const resize = new ResizeObserver(() =>
          app.graphicsDevice.resizeCanvas(
            canvas.clientWidth,
            canvas.clientHeight,
          ),
        );
        resize.observe(canvas);
        const abort = new AbortController();
        let drag: { x: number; y: number } | undefined;
        canvas.addEventListener(
          'pointerdown',
          (e) => {
            drag = { x: e.clientX, y: e.clientY };
            canvas.setPointerCapture(e.pointerId);
          },
          { signal: abort.signal },
        );
        canvas.addEventListener(
          'pointermove',
          (e) => {
            if (!drag) return;
            const dx = e.clientX - drag.x,
              dy = e.clientY - drag.y;
            if (e.shiftKey) {
              const right = camera.right
                .clone()
                .mulScalar(-dx * distance * 0.002);
              const up = camera.up.clone().mulScalar(dy * distance * 0.002);
              target.add(right).add(up);
            } else {
              yaw -= dx * 0.008;
              pitch = Math.max(-1.4, Math.min(1.4, pitch + dy * 0.008));
            }
            drag = { x: e.clientX, y: e.clientY };
            update();
          },
          { signal: abort.signal },
        );
        canvas.addEventListener('pointerup', () => (drag = undefined), {
          signal: abort.signal,
        });
        canvas.addEventListener('pointercancel', () => (drag = undefined), {
          signal: abort.signal,
        });
        canvas.addEventListener(
          'wheel',
          (e) => {
            e.preventDefault();
            distance = Math.max(
              0.05,
              Math.min(10000, distance * Math.exp(e.deltaY * 0.001)),
            );
            update();
          },
          { signal: abort.signal, passive: false },
        );
        controller = {
          apply,
          save: () => ({
            captureId,
            yaw,
            pitch,
            distance,
            target: [target.x, target.y, target.z],
          }),
          reset: () => apply(defaultView),
          load: async (file) => {
            const ticket = ++generation;
            ready = false;
            loading = true;
            status = 'Cargando captura…';
            const url = URL.createObjectURL(file);
            try {
              const next = await new Promise<InstanceType<typeof pc.Asset>>(
                (resolve, reject) =>
                  app.assets.loadFromUrlAndFilename(
                    url,
                    file.name,
                    'gsplat',
                    (err, a) =>
                      err || !a
                        ? reject(new Error(String(err || 'Archivo inválido')))
                        : resolve(a),
                  ),
              );
              if (disposed || ticket !== generation) {
                next.unload();
                if (!disposed) app.assets.remove(next);
                return;
              }
              entity?.destroy();
              if (asset) {
                asset.unload();
                app.assets.remove(asset);
              }
              asset = next;
              entity = new pc.Entity('splat');
              entity.addComponent('gsplat', { asset: next });
              app.root.addChild(entity);
              const bounds = (
                next.resource as InstanceType<typeof pc.GSplatResource>
              ).aabb;
              target.copy(bounds.center);
              distance = Math.max(bounds.halfExtents.length() * 2.5, 0.5);
              yaw = 0;
              pitch = 0;
              captureId = `${file.name}:${file.size}:${file.lastModified}`;
              defaultView = {
                captureId,
                yaw,
                pitch,
                distance,
                target: [target.x, target.y, target.z],
              };
              update();
              apply(saved);
              ready = true;
              status = `${file.name} · ${Math.round(file.size / 1024 / 1024)} MB · vista local`;
            } catch {
              if (!disposed && ticket === generation)
                status =
                  'No se pudo cargar. Usa un PLY de Gaussian Splatting o SOG válido.';
            } finally {
              URL.revokeObjectURL(url);
              if (!disposed && ticket === generation) loading = false;
            }
          },
        };
        app.start();
        update();
        initialized = true;
        cleanup = () => {
          generation++;
          abort.abort();
          resize.disconnect();
          controller = undefined;
          app.destroy();
        };
      })
      .catch(() => {
        if (!disposed)
          status = 'El visor 3D no está disponible en este navegador.';
      });
    return () => {
      disposed = true;
      cleanup();
    };
  });
</script>

<div class="splat-viewer">
  <h3>Captura 3D local</h3>
  <label
    >Archivo PLY o SOG<input
      type="file"
      accept=".ply,.sog"
      disabled={loading || !initialized}
      onchange={(e) => {
        const file = e.currentTarget.files?.[0];
        if (file) controller?.load(file);
      }}
    /></label
  >
  <p role="status">{status}</p>
  <canvas
    bind:this={canvas}
    aria-label="Visor de Gaussian Splatting"
    tabindex="0"
  ></canvas>
  <p>
    Arrastra para orbitar · Rueda para acercar · Shift y arrastre para desplazar
  </p>
  <div class="actions">
    <button disabled={!ready} onclick={() => controller?.reset()}
      >Vista general</button
    >{#if staff}<button
        disabled={!ready}
        onclick={() => {
          if (controller) onSave(controller.save());
        }}>Guardar cámara para esta ruta</button
      >{/if}<button
      disabled={!ready}
      onclick={() => {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = 'captura-3d.png';
        a.click();
      }}>Descargar vista 3D</button
    >
  </div>
  {#if saved}<p>
      Cámara guardada. Se aplica al cargar el mismo archivo local.
    </p>{/if}
  <p>
    El archivo permanece en tu dispositivo. No se sube al servidor. SPZv4,
    marcadores 3D y LOD por ruta están pendientes.
  </p>
</div>

<style>
  .splat-viewer {
    margin-top: 20px;
    padding: 18px;
    background: white;
    border: 1px solid #d9dfe5;
    border-radius: 6px;
  }
  canvas {
    display: block;
    width: 100%;
    height: 360px;
    touch-action: none;
    background: #172c3e;
  }
  p {
    font-size: 13px;
  }
  h3 {
    margin-top: 0;
  }
</style>
