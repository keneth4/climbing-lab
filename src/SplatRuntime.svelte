<script lang="ts">
  import { untrack } from 'svelte';
  import { renderCard, downloadBlob, type CardInfo } from './media';
  import { planeAxes } from '../shared/sections';
  import { principalBounds, selectCenter } from './spatial';
  import RouteMarkerOverlay from './RouteMarkerOverlay.svelte';
  import type { SpatialMode } from './route-editing';
  import {
    layoutMarkers,
    drawMarkerLayout,
    cssToPng,
    viewportToLocal,
    type MarkerLayout,
    type LabelVisibility,
    type Rect,
  } from './marker-layout';
  import { onMount, tick } from 'svelte';
  import { measure } from './pilot';
  import { supabase } from './auth';
  import type { Capture, Section, Fiducial } from './twin';
  import {
    applyTransform,
    type Point,
    type Transform,
  } from '../shared/alignment';
  import type { CameraView, Hold3D } from './domain';
  let {
    exportInfo,
    visible = true,
    onImage,
    onExit,
    onRecording,
    mount,
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
    holds3D = [],
    previewPoint,
    selectedHoldId,
    onHoldSelect,
    spatialMode,
    onModeChange,
    onCancelTool,
    focusPoint,
    toolsDisabled = false,
    editorStep,
    focusRequest = 0,
  }: {
    exportInfo?: CardInfo;
    visible?: boolean;
    onImage?: (blob: Blob, view: CameraView) => void;
    onExit?: () => void;
    onRecording?: (active: boolean) => void;
    mount?: (node: HTMLElement) => void;
    holds3D?: Hold3D[];
    previewPoint?: Point;
    selectedHoldId?: string;
    onHoldSelect?: (id: string) => void;
    spatialMode?: SpatialMode;
    onModeChange?: (mode: SpatialMode) => void;
    onCancelTool?: () => void;
    focusPoint?: Point;
    toolsDisabled?: boolean;
    editorStep?: number;
    focusRequest?: number;
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
  $effect(() => {
    const request = focusRequest;
    if (request)
      untrack(() => {
        if (focusPoint?.every(Number.isFinite)) controller?.focus(focusPoint);
      });
  });
  function mountViewer(node: HTMLElement) {
    mount?.(node);
  }
  let recording = $state(false),
    mediaError = $state(''),
    mediaNotice = $state('');
  let cancelRecording: (() => void) | undefined;
  let recordedCaptureId = '';
  let cancelButton = $state<HTMLButtonElement>();
  let canvas: HTMLCanvasElement;
  let screenMarkers = $state<MarkerLayout[]>([]);
  let markerViewport = $state<Rect & { zoom?: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  let cardPreview = $state(''),
    cardBlob = $state<Blob | undefined>();
  function exportPng() {
    if (!ready || loading || !exportInfo) return;
    const card = renderCard(controller?.annotated() || canvas, exportInfo);
    card.toBlob((blob) => {
      if (blob) {
        cardBlob = blob;
        cardPreview = card.toDataURL('image/png');
      }
    }, 'image/png');
  }
  async function recordSweep() {
    if (recording || !ready || loading || !exportInfo || !controller) return;
    mediaError = '';
    mediaNotice = '';
    if (typeof MediaRecorder === 'undefined') {
      mediaError =
        'Este navegador no permite grabar video. Descarga una imagen 3D.';
      return;
    }
    const mime = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ].find((t) => MediaRecorder.isTypeSupported(t));
    if (!mime) {
      mediaError =
        'No hay formato de video compatible. Descarga una imagen 3D.';
      return;
    }
    const original = controller.save(),
      info = exportInfo,
      source = canvas,
      card = renderCard(source, info);
    if (typeof card.captureStream !== 'function') {
      mediaError =
        'Este navegador no permite grabar video. Descarga una imagen 3D.';
      return;
    }
    let stream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined,
      raf = 0,
      cancelled = false;
    const focused = document.activeElement as HTMLElement | null;
    recordedCaptureId = original.captureId;
    recording = true;
    onRecording?.(true);
    try {
      await tick();
      cancelButton?.focus();
      stream = card.captureStream(30);
      recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 4_000_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      const done = new Promise<void>((resolve, reject) => {
        recorder!.onstop = () => resolve();
        recorder!.onerror = () =>
          reject(new Error('No se pudo grabar el video.'));
      });
      cancelRecording = () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        if (recorder?.state === 'recording') recorder.stop();
      };
      recorder.start();
      const start = performance.now();
      const animate = (now: number) => {
        if (cancelled) return;
        const t = Math.min((now - start) / 6000, 1);
        controller?.apply({
          ...original,
          yaw: original.yaw + (t - 0.5) * 0.45,
        });
        try {
          renderCard(source, info, card);
        } catch (e) {
          mediaError = (e as Error).message;
          cancelled = true;
          recorder?.stop();
          return;
        }
        if (t < 1) raf = requestAnimationFrame(animate);
        else recorder?.stop();
      };
      raf = requestAnimationFrame(animate);
      await done;
      if (!cancelled) {
        downloadBlob(
          new Blob(chunks, { type: mime }),
          mime.includes('mp4') ? 'ruta-barrido.mp4' : 'ruta-barrido.webm',
        );
        mediaNotice = `Video descargado · ${mime.split(';')[0]}`;
      }
    } catch (e) {
      mediaError = (e as Error).message;
    } finally {
      cancelAnimationFrame(raf);
      if (recorder?.state === 'recording') recorder.stop();
      stream?.getTracks().forEach((t) => t.stop());
      controller?.apply(original);
      cancelRecording = undefined;
      recording = false;
      onRecording?.(false);
      await tick();
      if (focused && document.contains(focused)) focused.focus();
    }
  }

  let status = $state('Selecciona una captura para explorarla.');
  let labelVisibility = $state<LabelVisibility>('all');
  let quality = $state('auto');
  let navigation = $state<'orbit' | 'pan'>('orbit');
  let picking = $state(false);
  let selectedPoint = $state<Point | undefined>();
  const preparing = $derived(
    spatialMode !== undefined &&
      !['explore', 'review-route'].includes(spatialMode),
  );
  $effect(() => {
    if (spatialMode !== undefined) picking = spatialMode === 'pick-hold';
  });
  let initialized = $state(false);
  let ready = $state(false);
  let loading = $state(false);
  let correctVertical = $state(true);
  let controller:
    | {
        clear: () => void;
        visibility: (visible: boolean) => void;
        quality: (value: string) => void;
        cancel: () => void;
        retry: () => void;
        annotated: () => HTMLCanvasElement;
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
    if (initialized) controller?.visibility(visible);
  });
  $effect(() => {
    exportInfo;
    capture?.id;
    routeId;
    cardBlob = undefined;
    cardPreview = '';
  });
  $effect(() => {
    if (!continuousPick && spatialMode === undefined) picking = false;
  });
  const cameras = new Map<string, CameraView>();
  let viewKey = '';
  $effect(() => {
    const key = `${capture?.id || ''}:${routeId}`;
    const view = saved;
    if (!initialized || !controller) return;
    if (viewKey !== key) {
      const previous = controller.save();
      if (viewKey) {
        cameras.set(viewKey, previous);
        if (cameras.size > 50) cameras.delete(cameras.keys().next().value!);
      }
      const restored = cameras.get(key);
      if (restored) controller.apply(restored);
      else if (view) controller.apply(view);
      else if (previous.captureId === capture?.id) controller.apply(previous);
      viewKey = key;
    }
  });
  $effect(() => {
    const source = capture;
    const initializedNow = initialized;
    if (initializedNow) {
      if (recording && source?.id !== recordedCaptureId) cancelRecording?.();
      if (source) controller?.loadManaged(source);
      else controller?.clear();
    }
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
          apply(
            cameras.get(`${managedModel?.id || ''}:${routeId}`) ||
              saved ||
              managedModel?.initialCamera ||
              undefined,
          );
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
          canvas.dataset.cameraView = JSON.stringify({
            yaw,
            pitch,
            distance,
            target: [target.x, target.y, target.z],
          });
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
          // CameraComponent uses device.clientRect (CSS pixels), not framebuffer pixels.
          const { x, y } = viewportToLocal(
            { x: e.clientX, y: e.clientY },
            {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height,
            },
          );
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
            section && onHoldSelect
              ? (point) => {
                  const aligned = entity!
                    .getWorldTransform()
                    .transformPoint(new pc.Vec3(...point));
                  return [aligned.x, aligned.y, aligned.z].every(
                    (n, i) =>
                      n >= section!.bounds.min[i] &&
                      n <= section!.bounds.max[i],
                  );
                }
              : undefined,
          );
          if (!raw) {
            status =
              onHoldSelect && section
                ? 'No se encontró un centro gaussiano dentro de esta sección. Acerca el muro, cambia de vista e intenta de nuevo.'
                : 'No se encontró un punto cerca del cursor. Acércate y vuelve a seleccionar.';
            return;
          }
          const world = entity
            .getWorldTransform()
            .transformPoint(new pc.Vec3(...raw));
          selectedPoint = [world.x, world.y, world.z];
          pickedWorld = selectedPoint;
          pickedEntity?.destroy();
          if (!onHoldSelect) {
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
          }
          picking = continuousPick;
          onPoint?.(raw, selectedPoint);
        };
        let drag: { x: number; y: number } | undefined;
        const pointers = new Map<number, { x: number; y: number }>();
        let pinchDistance = 0,
          pinchCenter = { x: 0, y: 0 };
        const gesture = () => {
          const [a, b] = [...pointers.values()];
          return {
            distance: Math.hypot(a.x - b.x, a.y - b.y),
            center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          };
        };
        canvas.addEventListener(
          'pointerdown',
          (e) => {
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 2) {
              const g = gesture();
              pinchDistance = g.distance;
              pinchCenter = g.center;
              drag = undefined;
              canvas.setPointerCapture(e.pointerId);
              return;
            }
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
            if (!pointers.has(e.pointerId)) return;
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 2) {
              const g = gesture();
              if (g.distance > 0 && pinchDistance > 0)
                zoom(pinchDistance / g.distance);
              move(g.center.x - pinchCenter.x, g.center.y - pinchCenter.y);
              pinchDistance = g.distance;
              pinchCenter = g.center;
              return;
            }
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
        const endPointer = (e: PointerEvent) => {
          pointers.delete(e.pointerId);
          drag = undefined;
          pinchDistance = 0;
        };
        canvas.addEventListener('pointerup', endPointer, {
          signal: abort.signal,
        });
        canvas.addEventListener('pointercancel', endPointer, {
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
              if (onCancelTool && preparing) {
                e.preventDefault();
                e.stopPropagation();
                onCancelTool();
                picking = false;
                return;
              }
              if (!picking) onExit?.();
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
        const projectMarkers = (includePreparation = true) => {
          const rect = canvas.getBoundingClientRect();
          const points = [
            ...holds3D.map((h, i) => ({
              ...h,
              label:
                h.role === 'inicio'
                  ? `I${i + 1}`
                  : h.role === 'final'
                    ? `F${i + 1}`
                    : String(i + 1),
              active: includePreparation && h.id === selectedHoldId,
            })),
            ...(includePreparation && previewPoint
              ? [
                  {
                    id: 'candidate',
                    position: previewPoint,
                    role: 'candidate' as const,
                    label: '?',
                    active: true,
                  },
                ]
              : []),
          ];
          const projected = points.flatMap((h) => {
            const p = camera.camera!.worldToScreen(new pc.Vec3(...h.position));
            return p.z > 0
              ? [
                  {
                    id: h.id,
                    label: h.label,
                    role: h.role,
                    active: h.active,
                    x: p.x,
                    y: p.y,
                  },
                ]
              : [];
          });
          const blocked = Array.from(
            document.querySelectorAll<HTMLElement>(
              '.drawer-toggle,.scene-exit,.cancel-recording',
            ),
          )
            .filter((n) => !n.hidden)
            .map((n) => {
              const r = n.getBoundingClientRect();
              return {
                x: r.left - rect.left,
                y: r.top - rect.top,
                width: r.width,
                height: r.height,
              };
            });
          return layoutMarkers(
            projected,
            rect.width,
            rect.height,
            labelVisibility,
            blocked,
          );
        };
        controller = {
          quality: (value) => {
            app.graphicsDevice.maxPixelRatio =
              value === 'low'
                ? 1
                : value === 'high'
                  ? Math.min(devicePixelRatio, 2)
                  : Math.min(devicePixelRatio, 1.5);
            const rect = canvas.getBoundingClientRect();
            app.graphicsDevice.resizeCanvas(rect.width, rect.height);
          },
          visibility: (value) => {
            app.autoRender = value && !document.hidden;
            app.renderNextFrame = value;
          },
          cancel: () => {
            downloadAbort?.abort();
            generation++;
            requestedId = '';
            loading = false;
            status = 'Carga cancelada. Puedes reintentar o seguir con imagen.';
          },
          retry: () => {
            requestedId = '';
            if (capture) void controller?.loadManaged(capture);
          },
          annotated: () => {
            const out = document.createElement('canvas');
            out.width = canvas.width;
            out.height = canvas.height;
            const c = out.getContext('2d')!;
            c.drawImage(canvas, 0, 0);
            const rect = canvas.getBoundingClientRect();
            const scale = cssToPng({ x: 1, y: 1 }, rect, out);
            c.save();
            c.scale(scale.x, scale.y);
            drawMarkerLayout(c, projectMarkers(false));
            c.restore();
            return out;
          },
          clear: () => {
            if (!managedModel && !requestedId) return;
            generation++;
            downloadAbort?.abort();
            requestedId = '';
            entity?.destroy();
            entity = undefined;
            if (asset) {
              asset.unload();
              app.assets.remove(asset);
              asset = undefined;
            }
            managedModel = undefined;
            ready = false;
            loading = false;
            status = 'Selecciona una captura para explorarla.';
          },
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
              const changedInitial =
                JSON.stringify(managedModel.initialCamera) !==
                JSON.stringify(source.initialCamera);
              managedModel = source;
              if (entity) entity.enabled = true;
              ready = true;
              if (changedTransform) frame();
              else if (changedInitial && source.initialCamera)
                apply(source.initialCamera);
              const bounds = frameBounds();
              if (bounds) {
                const min = bounds.getMin(),
                  max = bounds.getMax();
                onBounds?.({
                  min: [min.x, min.y, min.z],
                  max: [max.x, max.y, max.z],
                });
              }

              onReady?.(source.id, source.version);
              return;
            }
            if (requestedId === source.id) return;
            requestedId = source.id;
            const loadTicket = ++generation;
            downloadAbort?.abort();
            downloadAbort = new AbortController();
            if (entity) entity.enabled = false;
            ready = false;
            loading = true;
            status = `Descargando captura (${Math.round(source.size / 1024 / 1024)} MB)…`;
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
              if (
                disposed ||
                capture?.id !== source.id ||
                loadTicket !== generation
              )
                return;
              status = 'Preparando escena 3D…';
              await controller?.load(new File([blob], source.filename), source);
            } catch {
              if (
                !disposed &&
                capture?.id === source.id &&
                loadTicket === generation
              ) {
                status = 'No se pudo cargar la captura del gimnasio.';
                measure('scene_error');
              }
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
            status = 'Preparando escena 3D…';
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
              const remembered = cameras.get(`${managed?.id || ''}:${routeId}`);
              if (remembered) apply(remembered);
              else if (saved) apply(saved);
              ready = true;
              if (managed) onReady?.(managed.id, managed.version);
              status = `${file.name} · ${Math.round(file.size / 1024 / 1024)} MB · ${managed ? 'captura del gimnasio' : 'vista local'}`;
            } catch {
              if (!disposed && ticket === generation)
                status =
                  'No se pudo cargar. Usa un PLY de Gaussian Splatting o SOG válido.';
              measure('scene_error');
            } finally {
              URL.revokeObjectURL(url);
              if (!disposed && ticket === generation) loading = false;
            }
          },
        };
        app.on('update', () => {
          if (!visible || document.hidden) return;
          const rect = canvas.getBoundingClientRect();
          const viewport = {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            zoom: canvas.offsetWidth > 0 ? rect.width / canvas.offsetWidth : 1,
          };
          if (JSON.stringify(viewport) !== JSON.stringify(markerViewport))
            markerViewport = viewport;
          const projected = ready && !loading ? projectMarkers() : [];
          if (JSON.stringify(projected) !== JSON.stringify(screenMarkers))
            screenMarkers = projected;
          if (onHoldSelect && !previewPoint && pickedWorld) {
            pickedWorld = undefined;
            pickedEntity?.destroy();
            pickedEntity = undefined;
          }
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
          if (pickedWorld && !onHoldSelect) {
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
        document.addEventListener(
          'visibilitychange',
          () => {
            if (controller) controller.visibility(visible);
          },
          { signal: abort.signal },
        );
        app.autoRender = visible;
        app.start();
        update();
        initialized = true;
        cleanup = () => {
          generation++;
          downloadAbort?.abort();
          abort.abort();
          resize.disconnect();
          controller = undefined;
          markersRoot?.destroy();
          pickedEntity?.destroy();
          sectionEntity?.destroy();
          green.destroy();
          red.destroy();
          app.destroy();
        };
      })
      .catch(() => {
        if (!disposed) {
          status = 'El visor 3D no está disponible en este navegador.';
          measure('scene_error');
        }
      });
    return () => {
      disposed = true;
      cancelRecording?.();
      cleanup();
    };
  });
</script>

<div class="splat-viewer" use:mountViewer>
  <div hidden={!!editorStep && [1, 6].includes(editorStep)}>
    <h3>Captura 3D del gimnasio</h3>
    {#if !capture}<p>
        No hay una captura publicada. El administrador debe subirla desde
        Capturas.
      </p>{:else}<p>{capture.filename} · Versión del gimnasio</p>{/if}
    <details open={!editorStep}>
      <summary>Calidad y opciones avanzadas</summary><label
        >Calidad 3D<select
          bind:value={quality}
          onchange={() => controller?.quality(quality)}
          ><option value="auto">Automática</option><option value="low"
            >Baja</option
          ><option value="high">Alta</option></select
        ></label
      >
    </details>
  </div>
  <p role="status">{status}</p>
  {#if loading}<button onclick={() => controller?.cancel()}
      >Cancelar carga 3D</button
    >{:else if initialized && !ready && capture}<button
      onclick={() => controller?.retry()}>Reintentar 3D</button
    >{/if}
  <canvas
    class="workspace-canvas"
    bind:this={canvas}
    aria-label="Visor de Gaussian Splatting"
    tabindex="0"
  ></canvas>
  {#if visible}<RouteMarkerOverlay
      markers={screenMarkers}
      viewport={markerViewport}
      onSelect={onHoldSelect}
      disabled={recording || loading || toolsDisabled || preparing}
    />{/if}
  <div hidden={!!editorStep && [1, 6].includes(editorStep)}>
    <p>
      Arrastra para {navigation === 'orbit' ? 'orbitar' : 'desplazar'} · Rueda para
      acercar · Dos dedos para desplazar y pinza para acercar · Flechas para desplazar
      · + / − para zoom
    </p>
    <div class="actions navigation-tools" aria-label="Herramientas del visor">
      <button
        type="button"
        disabled={!ready}
        aria-pressed={navigation === 'orbit'}
        onclick={() => (navigation = 'orbit')}>Orbitar</button
      >
      <button
        type="button"
        disabled={!ready}
        aria-pressed={navigation === 'pan'}
        onclick={() => (navigation = 'pan')}>Desplazar</button
      >
      <button
        type="button"
        disabled={!ready}
        aria-label="Acercar"
        title="Acercar"
        onclick={() => controller?.zoom(0.8)}>+</button
      >
      <button
        type="button"
        disabled={!ready}
        aria-label="Alejar"
        title="Alejar"
        onclick={() => controller?.zoom(1.25)}>−</button
      >
      <details class="view-options">
        <summary>Encuadre y vistas</summary>
        <div class="actions">
          <button
            type="button"
            disabled={!ready}
            onclick={() => controller?.framePrincipal()}
            >Enfocar contenido principal</button
          >
          <button
            type="button"
            disabled={!ready}
            onclick={() => controller?.frameAll()}>Ver límites completos</button
          >
          <button
            type="button"
            disabled={!ready}
            onclick={() =>
              controller?.apply(saved || capture?.initialCamera || undefined)}
            >Ver ruta</button
          ><button
            type="button"
            disabled={!ready}
            onclick={() => controller?.reset()}>Ver gimnasio</button
          >
          {#if section}<button
              type="button"
              disabled={!ready}
              onclick={() => {
                const { min, max } = section.bounds;
                controller?.focus(min.map((n, i) => (n + max[i]) / 2) as Point);
              }}>Enfocar sección</button
            >{/if}
        </div>
      </details>
      {#if onPoint && (!editorStep || editorStep === 3)}<button
          type="button"
          disabled={!ready || toolsDisabled || (preparing && !picking)}
          aria-pressed={picking}
          onclick={() => {
            if (onModeChange) onModeChange(picking ? 'explore' : 'pick-hold');
            else picking = !picking;
          }}>{picking ? 'Cancelar selección' : 'Seleccionar punto'}</button
        >{/if}
      {#if onInitialSave}<button
          type="button"
          disabled={!ready || capture?.status !== 'draft'}
          onclick={() => {
            if (controller) onInitialSave(controller.save());
          }}>Guardar cámara inicial del gimnasio</button
        >{/if}
    </div>
    {#if focusPoint}<button
        type="button"
        disabled={!ready || toolsDisabled}
        onclick={() => {
          if (focusPoint?.every(Number.isFinite)) {
            controller?.focus(focusPoint);
            controller?.zoom(0.6);
          }
        }}>Acercar al punto seleccionado</button
      >{/if}
    {#if holds3D.length || onHoldSelect}<label
        >Etiquetas de agarres<select bind:value={labelVisibility}
          ><option value="all">Todos</option><option value="ends"
            >Solo inicio y final</option
          ><option value="hidden">Ocultar etiquetas</option></select
        ></label
      >
      <p>
        Selección aproximada: las anclas pueden verse a través del muro.
        Comprueba la profundidad desde otro ángulo. Las etiquetas sin espacio se
        seleccionan desde la lista.
      </p>{/if}
    {#if picking}<p role="status">
        Haz clic o toca sobre la pared para seleccionar un centro gaussiano
        aproximado. Escape cancela.
      </p>{/if}
    {#if selectedPoint && !onHoldSelect}<p>
        Punto aproximado del gimnasio: {selectedPoint
          .map((n) => n.toFixed(3))
          .join(', ')}. Confirma su posición antes de guardarlo.
      </p>{/if}
    <div class="actions">
      <button
        type="button"
        disabled={!ready}
        onclick={() => controller?.reset()}>Vista general</button
      >{#if staff && (!editorStep || editorStep === 2)}<button
          type="button"
          disabled={!ready || preparing || toolsDisabled}
          onclick={() => {
            if (controller) onSave(controller.save());
          }}>Guardar cámara para esta ruta</button
        >{/if}<button
        type="button"
        disabled={!ready}
        onclick={() => {
          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = 'captura-3d.png';
          a.click();
        }}>Descargar vista 3D</button
      >
    </div>
    {#if onImage && (!editorStep || editorStep === 5)}<button
        disabled={!ready || loading || preparing || toolsDisabled}
        onclick={() => {
          if (!controller) return;
          const view = controller.save();
          controller.annotated().toBlob((b) => {
            if (b) onImage?.(b, view);
          }, 'image/png');
        }}>Usar vista anotada como respaldo</button
      >{/if}
    {#if exportInfo}<details>
        <summary>Compartir visual 3D</summary>
        <p>
          Incluye nombre, grado y atribución. La tarjeta personal sólo incluye
          los datos que hayas elegido.
        </p>
        <button
          disabled={!ready ||
            loading ||
            recording ||
            preparing ||
            toolsDisabled}
          onclick={exportPng}>Preparar tarjeta 3D (PNG)</button
        >{#if cardPreview}<img
            src={cardPreview}
            alt="Vista previa exacta de la tarjeta 3D"
          /><button
            onclick={() => {
              if (cardBlob) {
                downloadBlob(cardBlob, 'ruta-3d.png');
                measure('export_done');
                mediaNotice = 'Descarga preparada.';
              }
            }}>Descargar tarjeta 3D (PNG)</button
          >{/if}<button
          disabled={!ready ||
            loading ||
            recording ||
            preparing ||
            toolsDisabled}
          onclick={recordSweep}>Grabar barrido de 6 segundos</button
        >
      </details>{/if}
    {#if recording}<button
        class="cancel-recording"
        bind:this={cancelButton}
        onkeydown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancelRecording?.();
          } else if (e.key === 'Tab') {
            e.preventDefault();
            cancelButton?.focus();
          }
        }}
        data-recording-control="true"
        onclick={() => cancelRecording?.()}>Cancelar video</button
      >
      <p role="status">
        Grabando barrido… Las herramientas están bloqueadas.
      </p>{/if}
    {#if mediaError}<p role="alert">{mediaError}</p>{/if}{#if mediaNotice}<p
        role="status"
      >
        {mediaNotice}
      </p>{/if}
    {#if saved}<p>Cámara de ruta guardada para esta captura.</p>{/if}
    <p hidden={!!editorStep}>
      La captura completa permanece intacta. El encuadre principal usa una
      estimación del contenido central; puedes revisar todos los límites. SPZv4
      y LOD por ruta están pendientes.
    </p>
  </div>
</div>

<style>
  [hidden] {
    display: none !important;
  }
  .cancel-recording {
    position: fixed;
    top: calc(var(--workspace-top) + 55px);
    left: 10px;
    z-index: 10;
  }
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
  .navigation-tools {
    align-items: flex-start;
    gap: 6px;
  }
  .view-options {
    margin: 0;
  }
  .view-options summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    padding: 0 10px;
  }
  .view-options[open] {
    flex-basis: 100%;
  }
  p {
    font-size: 13px;
  }
  h3 {
    margin-top: 0;
  }
</style>
