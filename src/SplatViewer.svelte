<script lang="ts">
  import { planeAxes } from '../shared/sections';
  import { principalBounds, selectCenter } from './spatial';
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
    onInitialSave,
    onPoint,
    onBounds,
    grid,
    continuousPick = false,
  }: {
    saved?: CameraView;
    onSave: (view: CameraView) => void;
    staff: boolean;
    routeId: string;
    capture?: Capture;
    section?: Section;
    onReady?: (id: string, version: number) => void;
    fiducials?: Fiducial[];
    onInitialSave?: (view: CameraView) => void;
    onPoint?: (raw: Point, world: Point) => void;
    grid?: {
      plane: 'XY' | 'XZ' | 'YZ';
      elevation: number;
      step: number;
      center: Point;
    };
    continuousPick?: boolean;
    onBounds?: (bounds: { min: Point; max: Point }) => void;
  } = $props();
  let canvas: HTMLCanvasElement;
  let status = $state('Selecciona una captura para explorarla.');
  let navigation = $state<'orbit' | 'pan'>('orbit');
  let picking = $state(false);
  let selectedPoint = $state<Point | undefined>();
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
        zoom: (factor: number) => void;
        move: (x: number, y: number) => void;
        focus: (point: Point) => void;
        frameAll: () => void;
        framePrincipal: () => void;
      }
    | undefined;
  $effect(() => {
    if (!continuousPick) picking = false;
  });
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
        let mainBounds: { min: Point; max: Point } | undefined;
        let pickedEntity: InstanceType<typeof pc.Entity> | undefined;
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
        let visibleSection: Section | undefined;
        let pickedWorld: Point | undefined;
        let sectionEntity: InstanceType<typeof pc.Entity> | undefined;
        const frameBounds = (principal = true) => {
          if (!asset || !entity) return;
          const bounds = new pc.BoundingBox();
          if (principal && mainBounds) {
            const local = new pc.BoundingBox(
              new pc.Vec3(
                ...mainBounds.min.map((n, i) => (n + mainBounds!.max[i]) / 2),
              ),
              new pc.Vec3(
                ...mainBounds.min.map((n, i) => (mainBounds!.max[i] - n) / 2),
              ),
            );
            bounds.setFromTransformedAabb(local, entity.getWorldTransform());
          } else
            bounds.setFromTransformedAabb(
              (asset.resource as InstanceType<typeof pc.GSplatResource>).aabb,
              entity.getWorldTransform(),
            );
          return bounds;
        };
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
          const bounds = frameBounds()!;
          const min = bounds.getMin(),
            max = bounds.getMax();
          onBounds?.({
            min: [min.x, min.y, min.z],
            max: [max.x, max.y, max.z],
          });
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
          apply(saved || managedModel?.initialCamera || undefined);
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
          if (!view || view.captureId !== captureId)
            view = managedModel?.initialCamera || defaultView;
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
        const move = (dx: number, dy: number) => {
          target
            .add(camera.right.clone().mulScalar(-dx * distance * 0.002))
            .add(camera.up.clone().mulScalar(dy * distance * 0.002));
          update();
        };
        const zoom = (factor: number) => {
          distance = Math.max(0.05, Math.min(10000, distance * factor));
          update();
        };
        const choosePoint = (e: PointerEvent) => {
          if (!asset || !entity) return;
          const rect = canvas.getBoundingClientRect();
          const x =
            ((e.clientX - rect.left) * app.graphicsDevice.width) / rect.width;
          const y =
            ((e.clientY - rect.top) * app.graphicsDevice.height) / rect.height;
          const far = camera.camera!.screenToWorld(x, y, 1);
          const worldOrigin = camera.getPosition();
          const inverse = entity.getWorldTransform().clone().invert();
          const origin = inverse.transformPoint(worldOrigin),
            next = inverse.transformPoint(far);
          const direction = next.clone().sub(origin).normalize();
          const localTarget = inverse.transformPoint(target);
          const raw = selectCenter(
            (asset.resource as InstanceType<typeof pc.GSplatResource>).centers,
            [origin.x, origin.y, origin.z],
            [direction.x, direction.y, direction.z],
            localTarget.distance(origin),
            (Math.tan((camera.camera!.fov * Math.PI) / 360) * 16) / rect.height,
          );
          if (!raw) {
            status =
              'No se encontró un punto cerca del cursor. Acércate y vuelve a seleccionar.';
            return;
          }
          const world = entity
            .getWorldTransform()
            .transformPoint(new pc.Vec3(...raw));
          selectedPoint = [world.x, world.y, world.z];
          pickedWorld = selectedPoint;
          pickedEntity?.destroy();
          pickedEntity = new pc.Entity('selected-point');
          pickedEntity.addComponent('render', { type: 'sphere' });
          pickedEntity.setPosition(world);
          pickedEntity.setLocalScale(
            distance * 0.012,
            distance * 0.012,
            distance * 0.012,
          );
          for (const mesh of pickedEntity.render!.meshInstances)
            mesh.material = red;
          app.root.addChild(pickedEntity);
          picking = continuousPick;
          onPoint?.(raw, selectedPoint);
        };
        let drag: { x: number; y: number } | undefined;
        canvas.addEventListener(
          'pointerdown',
          (e) => {
            if (picking) {
              choosePoint(e);
              return;
            }
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
            if (e.shiftKey || navigation === 'pan') {
              move(dx, dy);
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
        canvas.addEventListener(
          'keydown',
          (e) => {
            if (e.key === 'Escape') {
              picking = false;
              return;
            }
            if (
              [
                'ArrowLeft',
                'ArrowRight',
                'ArrowUp',
                'ArrowDown',
                '+',
                '-',
                '=',
              ].includes(e.key)
            ) {
              e.preventDefault();
              if (e.key === '+' || e.key === '=') zoom(0.8);
              else if (e.key === '-') zoom(1.25);
              else
                move(
                  e.key === 'ArrowLeft' ? -25 : e.key === 'ArrowRight' ? 25 : 0,
                  e.key === 'ArrowUp' ? -25 : e.key === 'ArrowDown' ? 25 : 0,
                );
            }
          },
          { signal: abort.signal },
        );
        controller = {
          zoom,
          move,
          focus: (p) => {
            target.set(...p);
            update();
          },
          frameAll: () => {
            const b = frameBounds(false);
            if (b) {
              target.copy(b.center);
              distance = Math.max(b.halfExtents.length() * 2.5, 0.5);
              update();
            }
          },
          framePrincipal: () => apply(defaultView),
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
            visibleSection = selected;
            sectionEntity?.destroy();
            sectionEntity = undefined;
            if (!selected || selected.geometry) return;
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
              const changedTransform =
                JSON.stringify(managedModel.transform) !==
                JSON.stringify(source.transform);
              managedModel = source;
              if (entity) entity.enabled = true;
              ready = true;
              if (changedTransform) frame();
              else if (source.initialCamera) apply(source.initialCamera);
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
              selectedPoint = undefined;
              pickedWorld = undefined;
              pickedEntity?.destroy();
              pickedEntity = undefined;
              mainBounds = principalBounds(
                (next.resource as InstanceType<typeof pc.GSplatResource>)
                  .centers,
              );
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
        app.on('update', () => {
          if (
            grid &&
            Number.isFinite(grid.step) &&
            grid.step >= 0.01 &&
            Number.isFinite(grid.elevation)
          ) {
            const [a, b, n] = planeAxes(grid.plane),
              step = grid.step;
            const base = [...grid.center] as Point;
            base[n] = grid.elevation;
            base[a] = Math.round(base[a] / step) * step;
            base[b] = Math.round(base[b] / step) * step;
            const color = new pc.Color(0.35, 0.55, 0.65);
            for (let j = -10; j <= 10; j++)
              for (const axis of [a, b]) {
                const other = axis === a ? b : a,
                  from = [...base] as Point,
                  to = [...base] as Point;
                from[axis] -= 10 * step;
                to[axis] += 10 * step;
                from[other] += j * step;
                to[other] += j * step;
                app.drawLine(
                  new pc.Vec3(...from),
                  new pc.Vec3(...to),
                  color,
                  false,
                );
              }
          }
          if (visibleSection?.geometry) {
            const g = visibleSection.geometry,
              [, , n] = planeAxes(g.plane),
              color = new pc.Color(0.1, 1, 0.4);
            for (let i = 0; i < g.vertices.length; i++) {
              const p = g.vertices[i],
                q = g.vertices[(i + 1) % g.vertices.length];
              const lower = [...p] as Point,
                upper = [...p] as Point;
              lower[n] -= g.thickness / 2;
              upper[n] += g.thickness / 2;
              app.drawLine(
                new pc.Vec3(...lower),
                new pc.Vec3(...upper),
                color,
                false,
              );
              if (g.vertices.length > 1)
                for (const offset of [-g.thickness / 2, 0, g.thickness / 2]) {
                  const start = [...p] as Point,
                    end = [...q] as Point;
                  start[n] += offset;
                  end[n] += offset;
                  app.drawLine(
                    new pc.Vec3(...start),
                    new pc.Vec3(...end),
                    color,
                    false,
                  );
                }
            }
          } else if (visibleSection) {
            const { min, max } = visibleSection.bounds;
            const corners = Array.from(
              { length: 8 },
              (_, i) =>
                new pc.Vec3(
                  i & 1 ? max[0] : min[0],
                  i & 2 ? max[1] : min[1],
                  i & 4 ? max[2] : min[2],
                ),
            );
            for (let i = 0; i < 8; i++)
              for (const bit of [1, 2, 4])
                if (!(i & bit))
                  app.drawLine(
                    corners[i],
                    corners[i | bit],
                    new pc.Color(0.1, 1, 0.4),
                    false,
                  );
          }
          if (pickedWorld) {
            const p = new pc.Vec3(...pickedWorld),
              r = Math.max(distance * 0.01, 0.01);
            for (const offset of [
              new pc.Vec3(r, 0, 0),
              new pc.Vec3(0, r, 0),
              new pc.Vec3(0, 0, r),
            ])
              app.drawLine(
                p.clone().sub(offset),
                p.clone().add(offset),
                new pc.Color(1, 0.3, 0.1),
                false,
              );
          }
        });
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
    Arrastra para {navigation === 'orbit' ? 'orbitar' : 'desplazar'} · Rueda para
    acercar · Flechas para desplazar · + / − para zoom
  </p>
  <div class="actions">
    <button
      disabled={!ready}
      aria-pressed={navigation === 'orbit'}
      onclick={() => (navigation = 'orbit')}>Orbitar</button
    >
    <button
      disabled={!ready}
      aria-pressed={navigation === 'pan'}
      onclick={() => (navigation = 'pan')}>Desplazar</button
    >
    <button disabled={!ready} onclick={() => controller?.zoom(0.8)}
      >Acercar</button
    >
    <button disabled={!ready} onclick={() => controller?.zoom(1.25)}
      >Alejar</button
    >
    <button disabled={!ready} onclick={() => controller?.framePrincipal()}
      >Enfocar contenido principal</button
    >
    <button disabled={!ready} onclick={() => controller?.frameAll()}
      >Ver límites completos</button
    >
    {#if section}<button
        disabled={!ready}
        onclick={() => {
          const { min, max } = section.bounds;
          controller?.focus(min.map((n, i) => (n + max[i]) / 2) as Point);
        }}>Enfocar sección</button
      >{/if}
    {#if onPoint}<button
        disabled={!ready}
        aria-pressed={picking}
        onclick={() => (picking = !picking)}
        >{picking ? 'Cancelar selección' : 'Seleccionar punto'}</button
      >{/if}
    {#if onInitialSave}<button
        disabled={!ready || capture?.status !== 'draft'}
        onclick={() => {
          if (controller) onInitialSave(controller.save());
        }}>Guardar cámara inicial del gimnasio</button
      >{/if}
  </div>
  {#if picking}<p role="status">
      Haz clic o toca sobre la pared para seleccionar un centro gaussiano
      aproximado. Escape cancela.
    </p>{/if}
  {#if selectedPoint}<p>
      Punto aproximado del gimnasio: {selectedPoint
        .map((n) => n.toFixed(3))
        .join(', ')}. Confirma su posición antes de guardarlo.
    </p>{/if}
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
  {#if saved}<p>Cámara de ruta guardada para esta captura.</p>{/if}
  <p>
    La captura completa permanece intacta. El encuadre principal usa una
    estimación del contenido central; puedes revisar todos los límites. SPZv4 y
    LOD por ruta están pendientes.
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
