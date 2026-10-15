# UX-P1A — Flujo guiado del editor de rutas

## Implementación acordada

Base: main con D04 integrado, rama `codex/route-editor-guided-ux`. Seis pasos funcionales: Datos → Encuadre → Agarres → Verificación → Imagen/respaldo → Publicar. Navegación libre con estados pendiente/listo/modificado y bloqueo durante una edición temporal. Una sola instancia del visor conserva cámara y contexto.

Guardar borradores incompletos de rutas nuevas o borradores mediante contratos actuales. Para rutas publicadas, «Conservar preparación local» mantiene intacta la versión pública y usa aislamiento por cuenta/ruta/revisión; no garantiza recuperación tras recarga. Publicar, actualizar, retirar y reactivar serán acciones explícitas con revisión de diferencias y motivos actuales.

Inspector compacto, XYZ plegado, foco y edición reversible existentes. Revisión humana desde dos ángulos; cambios confirmados invalidan respaldo/verificación y cambios idénticos o cancelados los conservan. Panel lateral en escritorio y panel inferior de tres alturas mediante controles accesibles en móvil. Atajos F, Escape, Ctrl/Cmd+Z y Ctrl/Cmd+Shift+Z sin interceptar escritura.

Sin endpoints, migraciones, cambios de snapshots, geometría de secciones, tour ni nuevas funciones por lote. Conservar Crux y ruta D04, sin setup/reset. Prueba funcional con 3–8 agarres sin cambiar el máximo actual ni la ruta original de nueve agarres.

## Aceptación y entrega

Probar estados y diferencias, navegación, candidato/ajuste, no-op, invalidación, undo/redo, contexto y foco; borradores incompletos, edición publicada local, concurrencia, sesión cambiada, error de red y doble envío. Verificar 320/390/768/1440 px, ambos temas, zoom 200 %, teclado y fallback sin WebGL; teclado móvil emulado, sin afirmar prueba física.

Ejecutar tipos frontend/backend, formato, dominio/API, build, e2e y smoke público con reutilización explícita. QA real en navegador interno; revisión humana antes de cualquier publicación o cambio de agarres reales. Commits separados para documento, funciones puras, interfaz, publicación/verificación y QA. PR independiente a main; sin merge ni despliegue automático. Teléfonos, lector y rendimiento físico pendientes.


## Entrega y evidencia local — 14 de octubre de 2026

UX-P1A implementado en esta rama. Los seis pasos muestran únicamente sus controles, clasifican pendientes y diferencias y conservan una sola instancia del visor. El inspector móvil dispone de tres alturas y selector compacto de paso; la navegación lleva el foco al encabezado sin ocultarlo bajo controles fijos. Las etiquetas se recortan en la zona tapada por el inspector sin cambiar su proyección ni la exportación.

La edición temporal exige Aplicar/Cancelar; inspección y cambios idénticos conservan las dependencias. Geometría confirmada, undo/redo y cambio de contexto dejan revisión/respaldo pendientes cuando corresponde. La preparación de una ruta publicada queda aislada por cuenta/ruta/revisión, únicamente en memoria; la interfaz explica que no es un guardado en servidor ni garantiza recuperación tras recargar. Una revisión concurrente conserva el trabajo y exige revisar la nueva base antes de enviar. Los rechazos del servidor señalan el paso responsable sin borrar la preparación. Retiro/reactivación tienen acciones y motivos separados.

### Pruebas automatizadas

- Tipos frontend/backend, formato y build aprobados; 30 pruebas frontend, 50 API y 4 controles de herramientas demo aprobados.
- Suite e2e: 76 aprobadas en escritorio/móvil. Incluye publicación sintética con 3 y 8 agarres, edición reversible, borrador incompleto, preparación publicada local, conflicto 409, rechazo de respaldo, doble envío, conservación de contexto y fallback sin WebGL.
- Cobertura visual: 320/390/768/1440 px, ambos temas, zoom al 200 %, teclado, teclado móvil emulado y renderer persistente; proyección CSS/PNG con offsets y DPR 1/2/3. Un asset fallido espera Reintentar explícito y conserva el formulario.
- Smoke público integrado: 6 aprobadas con `DEMO_REUSE_SERVER=1 npx playwright test --config playwright.demo.config.ts`, contra Vite → Worker → D1/R2 existentes, sin interceptar API, setup ni reset.
- Capturas comparativas locales fuera de Git: `/tmp/p1a-{desktop,mobile}-{320,390,768,1440}-{first,second}.png` y `/tmp/p1a-{desktop,mobile}-zoom.png`. Corresponden a fixtures sintéticos, no son evidencia de una nueva ruta física.

### QA real y límites

Navegador interno, sesión administradora real, Crux local y ruta D04 original: recorrido de lectura por los seis pasos, preparación 3D, lista de nueve agarres, alturas del panel y previsualización. La respuesta API de la ruta original se comparó íntegramente antes/después: sin cambios (activa, revisión 4). No se modificaron agarres reales ni se publicó una ruta durante esta entrega.

El build conserva la advertencia conocida de tamaño del chunk PlayCanvas. La consola del demo muestra avisos preexistentes de bindings de formularios de actividad durante HMR; no se observaron errores que bloquearan el editor. Las pruebas de tipos no reportaron errores ni advertencias.

La selección/publicación de otra ruta real requiere revisión humana. Teléfonos reales, lector de pantalla y rendimiento físico siguen pendientes; el teclado móvil fue emulado. D04 conserva su cierre funcional previo, sin sustituirlo por estos fixtures. UX-P1B, tour, despliegue y fusión quedan fuera de esta entrega.
