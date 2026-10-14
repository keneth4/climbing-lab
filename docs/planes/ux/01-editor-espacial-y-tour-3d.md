# Plan de implementación UX — editor espacial de zonas, rutas, agarres y tour 3D

**Fecha:** 14 de octubre de 2026  
**Rama objetivo:** `codex/demo-integral-canonico`  
**Referencia congelada para esta planificación:** [`37081bc6a71771c78d9f75b82122f474cf675df3`](https://github.com/keneth4/climbing-lab/commit/37081bc6a71771c78d9f75b82122f474cf675df3) (`fix: make route picking visible and correct high density coordinates`).  
**Estado:** documento de especificación para Codex; **sin cambios de código ni tests ejecutados al crear este plan**.  
**Ámbito de producto:** un gimnasio demo canónico con lógica y visor reutilizables; **sin tres diseños de gimnasio por ahora**.  
**Documentos vinculados:** [corrección UX ya realizada](../../ux/editor-rutas-d04.md), [D04 privado abierto](../demo-integral/04-recorrido-cuenta-y-staff.md), [demo local](../../demo-local.md), [editor de rutas](../../editor-rutas.md), [secciones/cuadrícula](../../secciones-y-cuadricula.md), [validación física](../../validacion-formatos-dispositivos.md).

> **Instrucción de alcance para Codex:** continuar en la rama nombrada solo para el paquete **UX-P0**, que desbloquea la ruta real de D04. Tratar UX-P1 (flujo/editor y geometría) y UX-P2 (agarres reutilizables y tour) como **planes de features separados**: después de integrar el trabajo actual a `main`, abrir para cada feature una rama nueva desde el `main` actualizado, con **un documento Markdown por commit documental** y PR independiente. No ejecutar migraciones ni cambios de modelo de tour durante UX-P0. No reescribir `docs/ux/editor-rutas-d04.md` como si su evidencia pasada no hubiera ocurrido.

## 0. Objetivo de usuario y resultado visible

El setter debe poder **delimitar el sector del muro y señalar agarres con precisión** sin operar el software como un editor matemático 3D. Debe reconocer en todo momento: qué está editando, qué punto exacto ha seleccionado, qué falta para publicar y qué ya se guardó. La misma tarea debe resultar comprensible en PC y en móvil real, con ayudas táctiles y sin perder el muro de vista.

En paralelo, Climbing Lab debe dejar prevista una experiencia distinta: **«Recorrer el gimnasio»**, un tour de una única captura mediante paradas y cámaras guardadas, texto y enlaces a sectores/rutas; no duplicar el runtime ni exigir que el visitante aprenda controles 3D.

**Principios no negociables**

1. **La presa debe seguir visible:** separar *ancla geométrica* de *etiqueta accionable*, y el *hitbox* de la forma pintada.
2. **Modo explícito:** navegar ≠ marcar punto ≠ editar punto ≠ delimitar polígono ≠ visitar tour.
3. **No prometer precisión física:** el picker actual toma **centros gaussianos aproximados**, no reconoce automáticamente agarres ni su superficie real.
4. **Edición reversible:** seleccionar, previsualizar, aplicar/cancelar, deshacer/rehacer; invalidar imagen y verificación **solo cuando hay un cambio confirmado**.
5. **Historial seguro:** conservar captura, sección, ruta, revisión, permisos, QR y bitácora histórica; no transportar coordenadas a otro splat automáticamente.
6. **Una escena, varios modos:** seguir usando `ViewerWorkspace`/`SplatRuntime` en vez de crear una instancia de PlayCanvas por panel, ruta o parada.
7. **Diseño base canónico:** capas futuras de branding/composición son independientes de estados, controles, selección, datos y APIs.

## 1. Estado actual verificado y causas de fricción

| Fuente | Situación real en la rama | Consecuencia UX / decisión |
| --- | --- | --- |
| `src/SplatRuntime.svelte` | Proyecta `screenMarkers` a coordenadas CSS; elementos `.screen-marker` son círculos sólidos de **44×44 px** centrados en el punto, incluso el provisional `?` | **UX-P0:** conservar blanco táctil cómodo, mover etiqueta fuera de la presa, dejar ancla precisa |
| `SplatRuntime.svelte` | `choosePoint()` usa `screenToWorld`, `selectCenter()`, un cono ligado a foco y filtro de sección para rutas | Mantener corrección CSS/DPR ya realizada; añadir feedback de error y verificación, no elegir una falsa superficie exacta |
| `SplatRuntime.svelte` | Una esfera 3D sobre `pickedEntity` escala con la distancia; la vista se re-proyecta y `annotated()` compone círculos independientes | Evitar marcas de tamaño variable que tapen presas y **unificar dibujo/exportación** |
| `src/RouteEditor.svelte` | «Datos / Captura y cámara / Agarres / Previsualizar» existe, pero el formulario no se divide realmente por pasos | **UX-P1:** flujo guiado sin imponer wizard rígido |
| `RouteEditor.svelte` | `scrollIntoView()` para candidato y agarre en un workspace con visor y panel de scroll independiente | **UX-P0:** preservar encuadre/visibilidad del 3D; desplazar únicamente inspector y devolver foco con criterio |
| `RouteEditor.svelte` | Al pulsar «Ajustar agarre» ya llama a `checkpoint()`; `checkpoint()` invalida `markersVerified` y `imageId` | **UX-P0:** edición transaccional, `Aplicar`/`Cancelar`; seleccionar para inspeccionar no altera datos |
| `src/CaptureManager.svelte`, `shared/sections.ts` | Volumen caja o polígono sobre planos `XY/XZ/YZ`, rejilla, vértices y profundidad, edición versionada | **UX-P1:** manipulación de vértices y plano local orientable, conservando compatibilidad |
| `src/App.svelte`, `src/styles.css` | Canvas persistente; panel lateral en PC e inferior en móvil | Mantener arquitectura, crear inspector contextual y estados de altura/foco sin reinicializar splat |
| `docs/planes/demo-integral/04-recorrido-cuenta-y-staff.md` | Crux publicado **solo localmente**, cámara inicial y sección «Spray Wall Completo» preparadas. «Prueba D04 · Crux local» permanece **borrador** y falta revisión humana de agarres | UX-P0 desbloquea continuar D04. No marcar ruta ni D04 completos por editar la UI |

**Fuentes de código revisadas:** [SplatRuntime](https://github.com/keneth4/climbing-lab/blob/37081bc6a71771c78d9f75b82122f474cf675df3/src/SplatRuntime.svelte), [RouteEditor](https://github.com/keneth4/climbing-lab/blob/37081bc6a71771c78d9f75b82122f474cf675df3/src/RouteEditor.svelte), [CaptureManager](https://github.com/keneth4/climbing-lab/blob/37081bc6a71771c78d9f75b82122f474cf675df3/src/CaptureManager.svelte), [spatial.ts](https://github.com/keneth4/climbing-lab/blob/37081bc6a71771c78d9f75b82122f474cf675df3/src/spatial.ts), [sections.ts](https://github.com/keneth4/climbing-lab/blob/37081bc6a71771c78d9f75b82122f474cf675df3/shared/sections.ts).

## 2. UX-P0 — Primera implementación en la rama actual

**Resultado del paquete:** un setter observa el agarre completo, elige un punto, corrige sin perder la cámara, asigna función, confirma y puede volver a editar sin destruir una imagen válida hasta que efectivamente acepta un cambio. Debe funcionar con el Crux local autorizado y con tests automatizados aislados.

### P0.1 Ancla + línea + etiqueta, no disco encima de la presa

**Vista requerida:**

- **Ancla:** punto de 4–6 CSS px, o pequeña retícula no opaca de ~10–14 px, proyectada sobre la coordenada mundial exacta. Alto contraste con halo de contorno, sin tapar toda la presa.
- **Líder:** línea de 1–2 px desde ancla hacia etiqueta, opcionalmente con pequeño codo para esquivar otras etiquetas.
- **Etiqueta:** pastilla con `I`, número, `F` y nombre accesible por rol; colocarla inicialmente a 18–36 CSS px del ancla. Centro geométrico del agarre **no** coincide con centro de etiqueta.
- **Blanco táctil:** área invisible de alrededor de **44–48 CSS px** sobre etiqueta o control accesible equivalente. La geometría pintada puede ser pequeña; usar hit area independiente. Si varios blancos se solapan, ofrecer selección por lista/inspector y un algoritmo de resolución estable.
- **Estados:** provisional (por ejemplo etiqueta `?`), confirmado, seleccionado, advertencia de profundidad/oclusión, oculto. Distinguir con texto/forma/halo, nunca únicamente color.
- **Visibilidad:** `Todos / Solo inicio y final / Ocultar etiquetas`, manteniendo un modo claro de volver a activarlas. No ocultar la señal de edición activa.
- **Colisiones y bordes:** función determinista de colocación en 4–8 posiciones candidatas, considerando margen del canvas, solapamiento con etiquetas y controles. El ancla NO se desplaza. En densidad alta, priorizar anclas y lista lateral, no superponer docenas de etiquetas.

**Implementación propuesta (sin reemplazar PlayCanvas):**

1. Introducir componente `RouteMarkerOverlay.svelte` para representación accesible/interactiva, o extraer la lógica de `point-overlay` en un componente equivalente; no crear un segundo canvas ni controlar tenant desde el overlay.
2. Crear funciones puras en `src/spatial.ts` o módulo de UI compartido para `world→CSS`, `CSS→pixel PNG` y `layout de etiquetas` con el **mismo origen de coordenadas**. La proyección de ancla usa `worldToScreen` y `canvas.getBoundingClientRect()`; el plano DOM usa CSS px y exportación escala con `canvas.width / rect.width`, `canvas.height / rect.height`.
3. Evitar volver a introducir el bug de DPR: **no multiplicar posiciones de entrada de `screenToWorld` por la resolución del framebuffer**. Testear canvas desplazado dentro de viewport, scroll del panel, zoom CSS, DPR 1/2/3 y cambios de orientación.
4. Dibujar ancla, líderes y pastillas equivalentes en `controller.annotated()`, reutilizando posiciones resueltas, tamaño/escala y reglas de colisión; mantener snapshots e imágenes existentes. No dibujar sobre agarres en las tarjetas compartibles.
5. Mantener hit targets accesibles (`button`, `aria-label`, foco visible) y orden de teclado por lista de agarres, no por la posición variable en pantalla.

**Criterios de aceptación P0.1**

- [ ] Al menos dos agarres cercanos siguen reconocibles al estar marcados; no se oculta el centro de la presa con un disco.
- [ ] En 320, 390, 768 y 1440 CSS px, DPR 1/2/3, fullscreen/resize, el ancla queda en el punto guardado sin desviación de mapping.
- [ ] El marcador es seleccionable con ratón, toque y teclado aunque su símbolo pintado sea pequeño; no aparecen zonas tap-capturing que bloqueen orbitar.
- [ ] Sin solapamientos graves de etiquetas ni salida de los límites de la vista; los casos densos son recuperables desde la lista.
- [ ] La imagen generada/PNG y la vista 3D emplean la misma ancla y numeración, independientemente del tamaño de exportación.
- [ ] «Sin etiquetas» permite ver la presa limpia y se puede volver a la edición sin perder estado.

### P0.2 Selección y ajuste que no desorientan

Definir estados de interacción, no varios booleanos combinables:

```ts
type SpatialMode =
  | 'explore'
  | 'pick-hold'
  | 'review-candidate'
  | 'edit-hold'
  | 'review-route';
type CandidateState = {
  positionWorld: [number, number, number];
  captureId: string;
  sectionId: string;
  role: 'inicio' | 'intermedio' | 'final';
  source: 'gaussian-center';
  // Indica una aproximación revisable; no significa agarre detectado.
};
```

**Transiciones obligatorias:**

- Explorar → «Añadir agarre» → Seleccionar: siguiente toque propone **candidato provisional**; no mueve la cámara.
- Seleccionar → Revisar: ancla visible, panel contextual con rol y **Confirmar / Ajustar / Descartar**. Volver a Explorar conserva o descarta explícitamente el candidato.
- Revisar → Confirmar: agregar al borrador, actualizar UI/lista, generar entrada de undo, invalidar imagen/verificación que dependan de la geometría; **no publicar ni escribir en D1 automáticamente**.
- Agarre existente → Editar: crear **copia temporal** de `position/role`. Moverlo o cambiar rol no altera la ruta hasta «Aplicar». «Cancelar» restaura exactamente la versión anterior, incluido `imageId`/`markersVerified`.
- «Aplicar» con datos idénticos **no** crea checkpoint ni invalida respaldo. Aplicar cambio real sí.
- «Eliminar» confirmado crea undo; Deshacer/Rehacer deben restaurar también el estado derivado o marcar sus dependencias como desactualizadas de manera explícita.
- Cambiar captura/sección mientras se edita cancela o solicita guardar el borrador, sin aplicar puntos en otra captura.

**UX de precisión**

- *PC:* crosshair al señalar, hover sólo cuando el modo lo permite, clic para candidato, botón de centrar/foco, desplazamientos finos con teclado/botones cuando el foco esté en la herramienta.
- *Móvil:* toque para candidato; **lupa de zona** o recorte ampliado al ajustar, cuidando que el dedo no tape el punto. Usar pad de flechas o incrementos configurables para afinar sin arrastrar; cancelar/confirmar visibles en barra del inspector.
- La lupa puede introducirse tras un prototipo medido, pero como mínimo hay que ofrecer **zoom a punto seleccionado** y ajuste accesible sin coordenadas obligatorias.
- Nunca auto-desplazar toda la ventana o desmontar el canvas tras elegir un punto. Abrir el panel corto y desplazar **solo** su contenido si el foco está fuera; conservar perspectiva e identidad del renderer.
- Si el picker no encuentra punto dentro de la sección, mensaje específico + «Acercar / cambiar vista / intentar de nuevo». Si hay múltiples superficies plausibles, no afirmar que la primera es correcta: mostrar «selección aproximada» y facilitar revisión desde otra vista.
- XYZ se conserva como edición avanzada plegada; no es parte del flujo principal.

**Correcciones técnicas puntuales**

- En `src/RouteEditor.svelte`, separar `beginEditHold` de `applyEditHold` y de `cancelEditHold`; **retirar `checkpoint()` de la mera pulsación «Ajustar agarre»**.
- Revisar `onPoint`, `onHoldSelect` y llamadas a `scrollIntoView()`; enfocar un panel/campo solo cuando la acción lo requiere y sin perder el punto del canvas.
- En `src/SplatRuntime.svelte`, evitar mantener la esfera 3D sólida sobre la presa durante toda la revisión. Renderizar indicador de precisión en capa de overlay y limpiar candidato cuando se cambia de modo/captura.
- Conservar filtro `selectCenter(... accepts)` en la sección elegida; agregar pruebas de rechazo fuera de la sección, profundidad no finita y bordes del viewport.
- Mantener `aria-pressed` y feedback visible del modo de herramienta; `Escape` cancela selección/edición antes de salir de la experiencia.
- Deshabilitar acciones incompatibles durante preparación/exportación y restaurar foco al terminar.

**Criterios de aceptación P0.2**

- [ ] Seleccionar «Ajustar» y después «Cancelar» no cambia `holds3D`, `imageId` ni `markersVerified`.
- [ ] Aplicar cambio de posición o rol invalida sólo lo que corresponde y preserva borrador persistente hasta que se pulse Guardar.
- [ ] Confirmar un agarre, cambiar a explorar, seleccionar otro y deshacer funciona sin perder la cámara.
- [ ] Dos agarres cercanos pueden seleccionarse por lista si son ambiguos en la escena.
- [ ] El selector rechaza fuera de sección y la UI explica por qué; no inventa punto cuando no hay candidato.
- [ ] Teclado y controles de una pulsación permiten selección/corrección sin obligar a arrastrar.
- [ ] Test con Crux real en Firefox/Chrome y móvil físico pendiente de registrar; **no marcar validado solo por Playwright sintético**.

### P0.3 Entrega D04 y pruebas de regresión

**Archivos a inspeccionar/modificar según necesidad:** `src/SplatRuntime.svelte`, `src/RouteEditor.svelte`, `src/spatial.ts`, `src/styles.css`, un componente/ayudante de marcador, `src/viewer-context.svelte.ts`, `tests/pilot.spec.ts`, `tests/captures.spec.ts`, `tests/ux.spec.ts`, `src/spatial.test.ts`.

**Matriz automática mínima:**

1. Unit tests puros de ubicación de etiquetas (bordes, densidad, visibilidad y reproducción determinista) y mapping viewport→PNG.
2. Integración UI: escoger punto, cancelar, confirmar I/intermedio/F, cambiar rol y posición, guardar borrador, cancelar cambios, undo/redo, lista ↔ marca en visor.
3. Regresión DPR/zoom/offset canvas y del bug CSS/framebuffer ya corregido.
4. Captura/revisión incompatibles: no mostrar ni guardar agarres de otro asset; comprobar historial/QR.
5. Fallback de 3D, error de asset, permisos staff reales en Worker (suites existentes), D1 A/B/demo aislados.
6. E2E en 390 y 1440, además de revisión visual en 320/768; foco, teclado, HTML accesible; no usar únicamente snapshots de PNG.
7. No alterar los scripts locales que mantienen `gym-demo` separado de A/B, ni restaurar o borrar su captura Crux con `demo:reset`.

**Comandos base de Codex:**

```sh
npm run check
npm run check:api
npm run format:check
npm test
npm run test:api
npm run build
npm run test:e2e
```

`npm run demo:smoke` puede reinicializar el demo: **no ejecutarlo contra el estado D04 con Crux/roles** sin un entorno desechable o revisión del script. Usar las regresiones aisladas; las comprobaciones manuales del Crux deben conservar los datos locales y evitar escrituras no autorizadas.

**Puerta de continuación de D04:** reabrir «Prueba D04 · Crux local», colocar inicio/final e intermedios **por confirmación humana**, revisar desde dos ángulos, preparar cámara y PNG, guardar borrador y publicar **solo con autorización explícita del responsable**, después retomar recorridos de cuenta/staff con usuarios reales. El éxito del editor no completa automáticamente D04.

## 3. UX-P1A — Flujo del editor de rutas (feature posterior)

**Objetivo:** simplificar creación y revisión sin reconstruir el editor.

- Steps visibles y funcionales: **Datos → Encuadre → Agarres → Verificación → Imagen/respaldo → Publicar**; cada paso enseña su tarea principal, indicadores de estado (pendiente, listo, modificado) y acceso libre para volver a pasos anteriores.
- «Guardar borrador» siempre disponible, incluso incompleto. Mostrar explícitamente **«Cambios sin guardar»** y **«Versión publicada»**; no guardar automáticamente como si fuera una publicación.
- Inspector compacto para nombre/rol/acciones; esconder XYZ, cámara y restricciones avanzadas detrás de panel plegable.
- Lista de agarres: número/rol/estado, seleccionar → centrar/inspeccionar; cambios por lote sólo tras confirmación; permitir varios inicios/finales si las reglas del gimnasio lo exigen; no asumir secuencia de beta por orden de clic.
- «Verificar» guía dos ángulos de observación de la ruta, mostrando qué se está comprobando y qué falta. Checkbox final puede conservarse, pero **no reemplaza la inspección**. Los chequeos no significan reconocimiento físico automático.
- Preview pública desktop/móvil y resumen de diferencias antes de Publicar o Retirar; errores asociados a su paso (imagen vencida, cámara de otra captura, inicio/final faltantes). Preservar URL/QR, auditoría e historial inmutable.
- *PC:* visor dominante + panel inspector lateral; atajos `F` enfocar, `Esc` cancelar, `Ctrl/Cmd+Z` deshacer donde apliquen; no capturar atajos mientras se escribe en input.
- *Móvil:* visor dominante y bottom sheet de 2–3 alturas, navegación explícita, acciones confirmación persistentes, teclado virtual no oculta el punto. Evitar scroll a mitad de una interacción espacial.

**DoD UX-P1A:** setter crea/edita una ruta con 3–8 agarres en móvil y PC sin introducir coordenadas; al volver al paso anterior conserva contexto/cámara/borrador; publicar rechaza inconsistencias sin borrar el trabajo.

## 4. UX-P1B — Definir secciones y volúmenes del muro (feature posterior)

**Problema:** `CaptureManager` admite cajas y contornos sobre `XY/XZ/YZ` con espesor, pero el setter debe poder trabajar en desplomes/planos inclinados sin razonar sobre ejes del mundo.

**Flujo de usuario:**

1. «Crear zona de escalada» o «Crear área visitable» (esta última no puede recibir agarres de rutas).
2. Elegir captura, enfocar superficie y empezar con **Caja rápida**, **Contorno** o **Plano inclinado**.
3. En modo contorno, toque/clic añade vértices visibles **sin taparlos**; se puede seleccionar/mover/eliminar uno y deshacer último; «Cerrar contorno» explica error si cruza bordes.
4. Vista aproximadamente frontal/perpendicular al plano; ajustar profundidad/espesor con manejador o control numérico. Mostrar la misma zona en 3D para evaluar volumen real.
5. Previsualizar región resaltando bordes y esquinas sin ocultar textura. Guardar/Cambiar/Cancelar con revisión esperada y feedback de conflicto; historial de secciones preservado.
6. Ofrecer «Crear ruta en esta zona» al finalizar.

**Modelo conceptual, no migrar automáticamente sin pruebas:**

```ts
type OrientedSectionPlane = {
  origin: [number, number, number];
  u: [number, number, number];
  v: [number, number, number];
  normal: [number, number, number];
};
type PolygonGeometryV2 = {
  type: 'oriented-polygon';
  plane: OrientedSectionPlane;
  verticesUV: [number, number][];
  thickness: number;
};
```

**Restricciones técnicas:**

- Validar ortonormalidad, coordenadas finitas, espesor, auto-intersecciones y mínimos de área, **tanto en UI como en servidor**.
- Migración aditiva/versión de contrato para geometría inclinada; leer secciones previas `XY/XZ/YZ` sin reescribir snapshots ni alterar rutas guardadas. Un polígono obsoleto sigue consultable.
- Editar una sección estable genera nueva revisión; mostrar cuántas rutas dependen de ella, no retargetearles geometría silenciosamente.
- Mantener `shared/sections.ts` como fuente de validación común y revisar autorización en `worker/captures.ts`.
- Gizmos/manejadores con alternativa **sin arrastre** (seleccionar vértice y ajustar con botones/campos); atajos excluidos mientras un input tiene foco.
- No introducir segmentación automática ni reconstruir paredes curvas en este feature.

**DoD UX-P1B:** delimitación de caja, polígono y superficie inclinada en PC y móvil; editar/cancelar/revisión concurrente comprobados; ninguna ruta antigua pierde su volumen histórico.

## 5. UX-P2A — Biblioteca de agarres reutilizables (feature opcional, después de prueba con setters)

**Hipótesis:** en spray wall se reutiliza la misma presa al construir muchos problemas. Repetir picking 3D produce trabajo y pequeñas discrepancias.

**Propuesta:** `CaptureHold` (identidad por captura y sección, posición, revisión, verificación) y `RouteHold` (referencia o posición ad hoc, rol, orden editorial opcional). Contrato compatible con los `holds3D` ya publicados.

- Crear/reutilizar una presa solo dentro de una captura/sección compatible; una captura nueva necesita correspondencia supervisada.
- Hacer posible «Seleccionar de biblioteca» o «Crear punto nuevo»; sugerir duplicados cercanos sin unirlos automáticamente.
- Permitir varias presas inicio/final, roles y filtros; secuencia beta separada.
- Preservar **snapshot resuelto de posición/rol en revisión de ruta** para exportación e historia: modificar la biblioteca no debe mover ascensos antiguos.
- Requiere propuesta de migración D1, endpoint staff, guard de captureId/sectionId, pruebas de conflictos/autorización y UX del inspector.
- No incluir en UX-P0 si la mejora de marcadores resuelve el dolor inmediato.

**DoD UX-P2A:** la misma presa alimenta varias rutas sin compartir accidentalmente revisiones o datos personales; un cambio de captura no cambia rutas históricas ni colisiona con IDs de otro gimnasio.

## 6. UX-P2B — Tour virtual por cámaras/paradas (feature independiente)

**Concepto:** un visitante entra a **«Recorrer el gimnasio»**, ve imagen de entrada y decide cargar una sola escena 3D. Recorre posiciones guardadas (como diapositivas espaciales) con **Anterior/Siguiente**, títulos breves, indicador «2 de 5» y enlaces «Ver rutas de esta zona». Puede volver a exploración libre y retomar la parada. La escena sugerida por el usuario es [SuperSplat — Anatomy of a climbing gym](https://superspl.at/scene/19c59e8f), **solo referencia visual**; no copiar splat ni assets ajenos sin licencia explícita.

### Modelo, datos y seguridad (propuesta versionada)

```ts
type TourStop = {
  id: string;
  title: string;
  description?: string;
  order: number;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    fov?: number;
  };
  hotspot?: [number, number, number];
  posterAssetId?: string;
  sectionId?: string;
  linkedRouteId?: string;
};
type GymTour = {
  id: string;
  captureId: string;
  revision: number;
  status: 'draft' | 'published' | 'retired';
  startStopId?: string;
  stops: TourStop[];
};
```

- El gimnasio procede de **Worker/bindings**, no de un `gymId` arbitrario del navegador. `GymTour` es **local a su D1**. Solo staff con permiso crea/edita/publica; visitante recibe únicamente tours publicados.
- Revisiones de tour inmutables; paradas validan longitud/texto/cámaras finitas, captureId vigente, relaciones a sectores/rutas locales y poster R2 permitido. Limitar el número de paradas en piloto (configurable con validación servidor).
- La cámara actual de ruta usa `yaw/pitch/distance/target/captureId`. Proponer adaptador explícito y **pruebas de pose y FOV** para tour; no reutilizar silenciosamente estructuras incompatibles.
- Si cambia captura/transform, invalidar la edición del tour y marcar puntos para revisión humana; conservar histórico y no publicar coordenadas anteriores como si fueran actuales.
- Frontend público: incorporar un punto de entrada al tour en `SitePublic` y una ruta/query estable compatible con `?ruta=ID` (por ejemplo `?vista=Recorrido&tour=...&parada=...` al inicio).
- Editor staff: elegir captura, encuadrar, «Guardar parada», título/descripcion, hotspot opcional, reordenar, probar móvil, previsualizar y publicar versión.
- Un solo splat por captura y **un runtime**; al cambiar parada sólo se cambia la cámara. Cargar bajo demanda, mostrar poster y texto mientras tanto.
- Transición inicial: **corte/fundido corto** o interpolación controlada *solo* cuando no cruce geometría; no prometer caminar ni colisiones físicas. `prefers-reduced-motion` cambia instantáneamente; navegación rápida cancela movimiento anterior.
- **Sin autoplay obligatorio**, sin audio automático y sin forzar giros de cámara. Navegación por botones/teclado; los hotspots son opcionales.
- Móvil: tarjeta inferior compacta + «Anterior/Siguiente» y salir; PC: lista/timeline y contenido al costado. Todas las paradas ofrecen contenido accesible sin WebGL.
- Tour no reemplaza catálogo/ruta y no necesita personalización de los tres sitios.

**DoD UX-P2B:** admin crea tour borrador de al menos 3 paradas, publica revisión; visitante anónimo abre URL profunda, recorre paradas, explora libremente y vuelve; poster fallback funciona sin 3D; no descarga una escena nueva por parada y no muestra rutas/sectores de otro gimnasio.

**UX-P3 fuera de este documento:** recorrido cinematográfico con keyframes, colisiones, modo caminar, LOD/streaming nuevo y animaciones complejas. Requiere spike y mediciones independientes tras validar UX-P2B.

## 7. Diferencias por dispositivo (contratos de interacción)

| Acción | PC / puntero + teclado | Móvil / touch |
| --- | --- | --- |
| Explorar | Orbit/pan/zoom con cursor y wheel; botones y teclas alternativas | Gesto de un dedo + dos dedos donde sea necesario, botones de zoom/foco |
| Elegir agarre | Crosshair + clic → candidato + inspector; zoom a selección | Un toque → ancla provisional + panel corto, lupa/foco y ajuste por pulsaciones |
| Ajustar agarre | Arrastrar opcional o flechas/nudge → Aplicar/Cancelar | Flechas táctiles/ajuste de pasos → Aplicar/Cancelar, sin exigir drag |
| Delimitar zona | Click para vértices, cerrar, mover manejadores; vista frontal | Tap para vértices, Deshacer/Cerrar y edición de vértice desde sheet |
| Ajustar orientación/profundidad | Plano local y controles avanzados/medición | Orientación asistida, vista frontal y controles compactos |
| Navegar entre etapas de edición | Inspector lateral que no tapa canvas | Bottom sheet corta/media/expandida; nunca forzar scroll a perder el muro |
| Tour virtual | Lista de paradas a un costado + Anterior/Siguiente | Tarjeta inferior + Anterior/Siguiente y contador; swipe opcional |
| Sin visor compatible | Imagen/leyenda y texto útil | Igual, sin bloquear UI ni permisos |

**Accesibilidad como contrato:** objetivo WCAG 2.2 AA con evaluación manual; controles que dependen de arrastre deben tener una alternativa de un puntero sin arrastre, navegación teclado, foco y anuncios no invasivos. Se propone target visualmente discreto pero cómodo; no equiparar 44 px visuales con el requerimiento normativo.

## 8. Orden de ejecución en Codex y commits

### Ahora, misma rama `codex/demo-integral-canonico`

Realizar **solo UX-P0** para destrabar D04. Usar este Markdown como **commit de planificación**; posteriormente implementar en commits verificables:

| Commit funcional sugerido | Cambio | Evidencia exigida |
| --- | --- | --- |
| 1 | Funciones puras de proyección y layout ancla-líder-etiqueta + tests | CSS/DPR/export, bordes y colisiones |
| 2 | Overlay visual accesible y exportación equivalente + tests UI | Canvas legible, 320/390/1440, hit targets/teclado |
| 3 | Estado de selección y ajuste transaccional; eliminar invalidación prematura | Aplicar/Cancelar/Undo, foco y fallback |
| 4 | Regresiones/QA + documentación D04 | Firefox/Crux, browser suite, **pendiente** de prueba física si no disponible |

**Gate:** no mezclar UX-P1/P2 con este PR; reportar los nuevos defectos con pasos y capturas en el plan del incremento correcto. No borrar ni resetear el estado demo usado para el D04 real.

### Después, nueva rama desde `main` por feature

- `feat/route-editor-guided-ux` → `docs/planes/ux/02-flujo-editor-rutas.md` (UX-P1A).
- `feat/section-editor-oriented-geometry` → `docs/planes/ux/03-zonas-planos-inclinados.md` (UX-P1B).
- `feat/capture-hold-library` → `docs/planes/ux/04-biblioteca-agarres.md` (UX-P2A, condicionada a prueba con setters).
- `feat/gym-guided-tour` → `docs/planes/ux/05-tour-paradas.md` (UX-P2B).
- `feat/gym-cinematic-tour` → plan futuro de animación, **no dentro de L0/D04**.

**Regla documental:** un documento Markdown por commit de planificación; cada rama con PR propio a `main` y regresiones contra el sitio de ejemplo canónico. Si cambia el core, actualizar pruebas compartidas; no crear forks por gimnasio.

## 9. QA de usuario y puertas de calidad

**Prueba exploratoria con setters (2–3 personas, sin afirmar validez estadística):** en PC y teléfonos físicos, delimitar una zona, crear ruta de 3–8 presas, corregir una posición, comprobar inicio/final desde dos ángulos y preparar vista pública. Observar errores de selección, saltos de pantalla, éxito sin XYZ, visibilidad de presa, tiempo al primer agarre y confusión entre guardar/publicar.

**Visitantes para tour (3–5 personas):** entrar, elegir parada, reconocer zona, abrir una ruta y regresar; comprobar si comprenden controles/recorrido libre y si poster es suficiente cuando 3D falla.

**No cerrar con solo pruebas sintéticas:** probar al menos un Android, un iPhone, teclado y lector de pantalla; red real/limitada, DPR alto, luz fuerte, rotación, viewports reducidos y tiempo/consumo de GPU cuando haya condiciones. Probar Crux con precisión humana: selector de centros no garantiza agarre físico exacto.

**Estado de calidad que debe reportar Codex al cerrar cada bloque:** implementado / automatizado probado / QA local con escena real / QA física pendiente / validación de usuario. No hacer equivalentes esos estados.

## 10. Referencias de diseño y razones para adoptarlas

| Referencia | Patrón aplicable | Adaptación, no copia |
| --- | --- | --- |
| [SuperSplat Editor — Interface](https://developer.playcanvas.com/user-manual/supersplat/editor/interface/) y [Selection](https://developer.playcanvas.com/user-manual/supersplat/editor/editing-splats/) | Herramientas, profundidad de selección, overlays visibles/ocultables, vistas ortográficas y undo | Incorporar solo herramientas de delimitar muro y señalar agarres; no un editor general de splats |
| [PlayCanvas Editor — Viewport](https://developer.playcanvas.com/user-manual/editor/interface/viewport/) | Inspector y controles gizmo, vistas perpendiculares | Plano local y corrección de vértices, también con controles táctiles |
| [Stōkt — Features](https://www.getstokt.com/features) y [KAYA for Gyms](https://kayaclimb.com/forgyms) | Composición visual sobre un muro reconocible, relación ruta-presas y operación setter | Evitar reintroducir coordenadas técnicas como paso normal |
| [SuperSplat Studio — Annotations](https://developer.playcanvas.com/user-manual/supersplat/studio/annotations/) y [Cameras](https://developer.playcanvas.com/user-manual/supersplat/studio/cameras/) | Hotspots 3D con cámara propia, título, texto y anterior/siguiente | Tours por cámara versionada, mismo splat, sin autoplay exigido |
| [Matterport — Guided Tour Best Practices](https://support.matterport.com/s/article/Guided-Tour-Best-Practices?language=en_US) | Pocas paradas relevantes y recorrido guiado | No saltar por cada rincón; ruta pública útil con texto/poster |
| [WCAG 2.2 — Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) y [Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) | Punteros accesibles y alternativas sin drag | Hitbox amplio e invisible, botones para nudge y vértices |

**Escena de inspiración:** [https://superspl.at/scene/19c59e8f](https://superspl.at/scene/19c59e8f). Tratarla como referencia de potencial visual del recorrido, no como material con permiso de uso ni como prueba de tour integrado en ese enlace.

## 11. Qué queda expresamente fuera de este PR

No publicar rutas sin verificación humana, no crear tres marcas visuales, no trasladar coordenadas entre capturas automáticamente, no reconstruir el editor desde cero, no implementar detección perfecta de presas, no alterar pagos/miembros/tienda, no añadir un segundo runtime, no meter tour y geometría V2 en D04, no desplegar recursos remotos ni borrar los datos locales de Crux.

**Definición de listo para comenzar:** el paquete P0 describe estados, archivos, pruebas y no-regresiones; Codex puede iniciar cambios de forma incremental en esta rama, sin pedir un nuevo diseño conceptual. **La calidad final del gesto, la oclusión y la exactitud se confirman con equipos y escenas reales, no por el documento.**
