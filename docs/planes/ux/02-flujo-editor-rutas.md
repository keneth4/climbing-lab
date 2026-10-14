# UX-P1A — Flujo guiado del editor de rutas

## Implementación acordada

Base: main con D04 integrado, rama `codex/route-editor-guided-ux`. Seis pasos funcionales: Datos → Encuadre → Agarres → Verificación → Imagen/respaldo → Publicar. Navegación libre con estados pendiente/listo/modificado y bloqueo durante una edición temporal. Una sola instancia del visor conserva cámara y contexto.

Guardar borradores incompletos de rutas nuevas o borradores mediante contratos actuales. Para rutas publicadas, «Conservar preparación local» mantiene intacta la versión pública y usa aislamiento por cuenta/ruta/revisión; no garantiza recuperación tras recarga. Publicar, actualizar, retirar y reactivar serán acciones explícitas con revisión de diferencias y motivos actuales.

Inspector compacto, XYZ plegado, foco y edición reversible existentes. Revisión humana desde dos ángulos; cambios confirmados invalidan respaldo/verificación y cambios idénticos o cancelados los conservan. Panel lateral en escritorio y panel inferior de tres alturas mediante controles accesibles en móvil. Atajos F, Escape, Ctrl/Cmd+Z y Ctrl/Cmd+Shift+Z sin interceptar escritura.

Sin endpoints, migraciones, cambios de snapshots, geometría de secciones, tour ni nuevas funciones por lote. Conservar Crux y ruta D04, sin setup/reset. Prueba funcional con 3–8 agarres sin cambiar el máximo actual ni la ruta original de nueve agarres.

## Aceptación y entrega

Probar estados y diferencias, navegación, candidato/ajuste, no-op, invalidación, undo/redo, contexto y foco; borradores incompletos, edición publicada local, concurrencia, sesión cambiada, error de red y doble envío. Verificar 320/390/768/1440 px, ambos temas, zoom 200 %, teclado y fallback sin WebGL; teclado móvil emulado, sin afirmar prueba física.

Ejecutar tipos frontend/backend, formato, dominio/API, build, e2e y smoke público con reutilización explícita. QA real en navegador interno; revisión humana antes de cualquier publicación o cambio de agarres reales. Commits separados para documento, funciones puras, interfaz, publicación/verificación y QA. PR independiente a main; sin merge ni despliegue automático. Teléfonos, lector y rendimiento físico pendientes.
