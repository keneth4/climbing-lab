<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from './auth';
  import type { Capture, Section, Fiducial } from './twin';
  import {
    applyTransform,
    type Point,
    type Transform,
  } from '../shared/alignment';
  import type { CameraView } from './domain';
  let {
    saved,
    onSave,
    staff,
    routeId,
    capture,
    section,
    onReady,
    fiducials,
  }: {
    saved?: CameraView;
    onSave: (view: CameraView) => void;
    staff: boolean;
    routeId: string;
    capture?: Capture;
    section?: Section;
    onReady?: (id: string, version: number) => void;
    fiducials?: Fiducial[];
  } = $props();
  let canvas: HTMLCanvasElement;
  let status = $state('Carga un PLY o SOG local para explorar la captura.');
  let initialized = $state(false);
  let ready = $state(false);
  let loading = $state(false);
  let correctVertical = $state(true);
  let controller:
    | {
        load: (file: File, managed?: Capture) => Promise<void>;
        loadManaged: (capture: Capture) => Promise<void>;
        section: (section?: Section) => void;
        markers: (
          references: Fiducial[],
          observed: { id: string; observed: Point }[],
          transform?: Transform,
        ) => void;
        apply: (view?: CameraView) => void;
        save: () => CameraView;
        reset: () => void;
        orient: () => void;
      }
    | undefined;
  $effect(() => {
    const view = saved;
    void routeId;
    controller?.apply(view);
  });
  $effect(() => {
    const source = capture;
    const initializedNow = initialized;
    if (initializedNow && source) controller?.loadManaged(source);
  });
  $effect(() => {
    const selected = section;
    if (initialized) controller?.section(selected);
  });
  $effect(() => {
    const refs = fiducials || [];
    const observed = capture?.alignment?.references || [];
    const transform = capture?.transform;
    if (initialized) controller?.markers(refs, observed, transform);
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
        let fileId = '';
        let managedModel: Capture | undefined;
        let requestedId = '';
        let downloadAbort: AbortController | undefined;
        let markersRoot: InstanceType<typeof pc.Entity> | undefined;
        const markerMaterial = (color: InstanceType<typeof pc.Color>) => {
          const m = new pc.StandardMaterial();
          m.emissive = color;
          m.update();
          return m;
        };
        const green = markerMaterial(new pc.Color(0.1, 0.8, 0.4)),
          red = markerMaterial(new pc.Color(0.95, 0.25, 0.1));
        let sectionEntity: InstanceType<typeof pc.Entity> | undefined;
        const frame = () => {
          if (!entity || !asset) return;
          if (managedModel) {
            entity.setLocalPosition(...managedModel.transform.translation);
            entity.setLocalScale(
              managedModel.transform.scale,
              managedModel.transform.scale,
              managedModel.transform.scale,
            );
            const q = managedModel.transform.rotation;
            entity.setLocalRotation(q[0], q[1], q[2], q[3]);
          } else entity.setLocalEulerAngles(0, 0, correctVertical ? 180 : 0);
          const bounds = new pc.BoundingBox();
          bounds.setFromTransformedAabb(
            (asset.resource as InstanceType<typeof pc.GSplatResource>).aabb,
            entity.getWorldTransform(),
          );
          target.copy(bounds.center);
          distance = Math.max(bounds.halfExtents.length() * 2.5, 0.5);
          yaw = 0;
          pitch = 0;
          captureId =
            managedModel?.id || fileId + (correctVertical ? ':z180' : '');
          defaultView = {
            captureId,
            yaw,
            pitch,
            distance,
            target: [target.x, target.y, target.z],
          };
          update();
          apply(saved);
        };
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
          markers: (references, observed, transform) => {
            markersRoot?.destroy();
            markersRoot = new pc.Entity('fiducials');
            const pin = (
              position: Point,
              material: InstanceType<typeof pc.StandardMaterial>,
            ) => {
              const node = new pc.Entity('reference');
              node.addComponent('render', { type: 'sphere' });
              node.setLocalPosition(...position);
              node.setLocalScale(0.08, 0.08, 0.08);
              for (const mesh of node.render!.meshInstances)
                mesh.material = material;
              markersRoot!.addChild(node);
            };
            for (const f of references) pin(f.position, green);
            if (transform)
              for (const f of observed)
                pin(applyTransform(f.observed, transform), red);
            app.root.addChild(markersRoot);
          },
          section: (selected) => {
            sectionEntity?.destroy();
            sectionEntity = undefined;
            if (!selected) return;
            const { min, max } = selected.bounds;
            sectionEntity = new pc.Entity('section');
            sectionEntity.addComponent('render', { type: 'box' });
            sectionEntity.setLocalPosition(
              ...(min.map((n, i) => (n + max[i]) / 2) as [
                number,
                number,
                number,
              ]),
            );
            sectionEntity.setLocalScale(
              ...(min.map((n, i) => max[i] - n) as [number, number, number]),
            );
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(0.1, 0.8, 0.4);
            material.emissive = new pc.Color(0.1, 0.8, 0.4);
            material.opacity = 0.12;
            material.blendType = pc.BLEND_NORMAL;
            material.depthWrite = false;
            material.update();
            for (const mesh of sectionEntity.render!.meshInstances)
              mesh.material = material;
            app.root.addChild(sectionEntity);
          },
          loadManaged: async (source) => {
            if (managedModel?.id === source.id && asset) {
              managedModel = source;
              if (entity) entity.enabled = true;
              ready = true;
              frame();
              onReady?.(source.id, source.version);
              return;
            }
            if (requestedId === source.id) return;
            requestedId = source.id;
            downloadAbort?.abort();
            downloadAbort = new AbortController();
            if (entity) entity.enabled = false;
            ready = false;
            loading = true;
            status = 'Cargando captura del gimnasio…';
            try {
              const { data } = await supabase.auth.getSession();
              const response = await fetch(source.fileUrl, {
                signal: downloadAbort.signal,
                headers: data.session
                  ? { Authorization: `Bearer ${data.session.access_token}` }
                  : {},
              });
              if (!response.ok) throw new Error('Captura no disponible.');
              const blob = await response.blob();
              if (disposed || capture?.id !== source.id) return;
              await controller?.load(new File([blob], source.filename), source);
            } catch {
              if (!disposed && capture?.id === source.id)
                status = 'No se pudo cargar la captura del gimnasio.';
            } finally {
              if (requestedId === source.id) requestedId = '';
              if (!disposed && capture?.id === source.id) loading = false;
            }
          },
          orient: frame,
          save: () => ({
            captureId,
            yaw,
            pitch,
            distance,
            target: [target.x, target.y, target.z],
          }),
          reset: () => apply(defaultView),
          load: async (file, managed) => {
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
              managedModel = managed;
              entity = new pc.Entity('splat');
              entity.addComponent('gsplat', { asset: next });
              app.root.addChild(entity);
              fileId = `${file.name}:${file.size}:${file.lastModified}`;
              frame();
              ready = true;
              if (managed) onReady?.(managed.id, managed.version);
              status = `${file.name} · ${Math.round(file.size / 1024 / 1024)} MB · ${managed ? 'captura del gimnasio' : 'vista local'}`;
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
          downloadAbort?.abort();
          abort.abort();
          resize.disconnect();
          controller = undefined;
          app.destroy();
          green.destroy();
          red.destroy();
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
  <h3>Captura 3D del gimnasio</h3>
  {#if !capture}<p>
      No hay una captura publicada. El administrador debe subirla desde
      Capturas.
    </p>{:else}<p>{capture.filename} · Versión del gimnasio</p>{/if}
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
    La captura se carga desde el almacenamiento del gimnasio. SPZv4, marcadores
    3D y LOD por ruta están pendientes.
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
