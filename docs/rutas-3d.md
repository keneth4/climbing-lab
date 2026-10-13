# Agarres 3D y flujo de ruta

## Requisitos

- Staff prepara rutas sobre la captura publicada vigente, sin cargar un archivo por ruta.
- Cada marcador tiene ID, posición XYZ en coordenadas alineadas del gimnasio y función inicio/intermedio/final.
- Seleccionar un punto es una aproximación: revisar/corregir coordenadas y confirmar explícitamente su incorporación al borrador.
- Preparar cámara y marcadores no escribe en D1 hasta guardar la ruta.
- Guardar crea una revisión de ruta y conserva las revisiones utilizadas por ascensos anteriores.
- Catálogo público muestra los marcadores, con control para ocultarlos, junto a cámara, beta, enlace y QR existentes.
- Mantener esquemas 2D existentes; máximo combinado de 40 marcadores 2D/3D.

## Tareas cerradas

- [x] T1 — Modelo `holds3D` compatible con rutas existentes.
- [x] T2 — Validación de coordenadas, roles, IDs, límite y captura vigente en Worker.
- [x] T3 — Preparación y confirmación de marcadores en editor de ruta.
- [x] T4 — Cámara de ruta como borrador y descarte de cambios 3D.
- [x] T5 — Visualización por función en el splat del catálogo.
- [x] T6 — Pruebas de permisos, datos inválidos, revisiones e historial.
- [x] T7 — Prueba aislada con Crux y verificación de escritorio/viewport móvil.

## Uso

Abre **Editar ruta** o **Crear ruta**, selecciona su sección y pulsa **Preparar agarres en 3D**. El visor usa la captura del gimnasio. Selecciona un punto, revisa sus XYZ, elige función y pulsa **Añadir agarre a la ruta**. Puedes eliminar marcadores o descartar los cambios 3D. Guarda la cámara desde ese visor si necesitas preparar una nueva vista; sigue siendo un borrador. **Guardar ruta en D1** confirma cámara, marcadores, beta y datos en una nueva revisión.

En el catálogo, verde indica inicio, azul intermedio y naranja final. La beta sigue siendo opcional. El QR abre la ruta; no requiere subir ni duplicar una captura por cada una.

Una ruta de una captura anterior requiere importación a la vigente antes de editar sus marcadores. El flujo de publicación conserva posiciones en el sistema común; el administrador debe revisar su correspondencia con el nuevo armado.

## Persistencia y compatibilidad

Los marcadores se guardan en el snapshot JSON de la revisión de ruta; no requieren tabla nueva. Una actualización que omite `holds3D` conserva los marcadores existentes; una lista vacía explícita los elimina en la revisión nueva. Los esquemas 2D antiguos permanecen separados y no se convierten automáticamente.

El editor sustituye temporalmente al visor del catálogo mientras prepara la escena, evitando dos escenas simultáneas en esa vista. Se corrigió la liberación de materiales antes de destruir el dispositivo gráfico al cerrar el visor.

## Límites y próximos pasos

- Son marcas aproximadas, visibles a través de superficies; no segmentan agarres ni prueban contacto con la pared.
- Por ahora se añaden/eliminan y se corrige el punto candidato numéricamente. Cambiar posición/función de un marcador guardado requiere eliminarlo y añadir otro en el borrador.
- Falta secuencia de beta por agarre, selección de marcadores existentes y ajuste fino de profundidad.
- Las tarjetas/esquemas 2D no incorporan automáticamente posiciones 3D. La descarga de vista 3D permite capturar los marcadores visibles; las exportaciones compuestas/video quedan pendientes.
- Falta medir red, memoria y FPS en teléfonos físicos. No se implementa LOD en esta etapa.

## Logros verificados — 12 de octubre de 2026

28 pruebas backend, 9 de dominio/geometría y 10 de navegador pasaron; tipos y build pasaron. Las pruebas de navegador usan auth/API simulados y verifican que preparar cámara/agarres no guarda anticipadamente, que el catálogo muestra los marcadores y que el visor se cierra sin errores. Las pruebas del Worker ejercitan D1 local e historial de ascensos.

Prueba adicional con Crux 1.ply: selección y confirmación de un inicio, preparación de cámara, guardado de una revisión y consulta en catálogo, en Chrome escritorio y viewport móvil. Sesión/API simulados, sin modificar ni publicar datos del gimnasio. La advertencia conocida de tamaño del paquete PlayCanvas permanece.
