# Editor de rutas sobre D1

Implementación local, 12 de octubre de 2026.

## Comportamiento

El staff local crea rutas desde su panel y edita nombre, grado, sector, beta y estado desde la ficha. Guardar genera una revisión nueva e inmutable. El botón de cámara del visor guarda una revisión con sus parámetros y la referencia provisional del archivo local.

Las rutas retiradas permanecen disponibles por enlace y pueden incluirse en el catálogo. No se borran sus registros de bitácora. Nombre, grado y esquema exportado de un ascenso provienen de su revisión histórica.

## API

- POST /api/routes: crea una ruta y revisión 1; solo staff local.
- PUT /api/routes/:id: requiere expectedRevision de la ficha consultada y crea la siguiente versión.
- GET /api/routes?status=retirada: lista histórica paginada.

Cada escritura utiliza un batch transaccional para revisión, metadatos y auditoría. La clave única de ruta/revisión protege contra ediciones simultáneas; una versión obsoleta recibe 409 y debe recargarse. No se sobrescribe automáticamente una edición ajena.

Se validan tamaños de textos, estado, hasta 40 marcadores 2D distintos y parámetros finitos de cámara con distancia positiva. El cuerpo sigue limitado a 8 KiB. Las posiciones 2D son el esquema de demostración, no picking sobre el splat. Marcadores en coordenadas 3D, R2 y referencias persistentes de captura son un incremento posterior.

## Pruebas

Pruebas D1: escritura restringida a staff del gimnasio, creación con cámara, aislamiento entre bases, historial de ascenso tras cambio de nombre, rechazo de cámara inválida y edición concurrente (200/409).

Pruebas de interfaz con sesión/API simuladas: editar, guardar revisión y retirar conservando la ficha, en escritorio y móvil. Las pruebas no otorgan permisos a cuentas reales.

## Operación

Tu cuenta autenticada todavía necesita una asignación inicial de staff en la base local para mostrar el editor. Esta asignación debe autorizarla el propietario y usar el UUID del proveedor; no se concede por email enviado desde el navegador ni por registrarse.

Cámaras: guardadas en D1, pero vinculadas a nombre/tamaño/fecha del archivo local. No se presupone que sean reutilizables con una captura diferente. Los archivos continúan cargándose localmente, sin subida al servidor.

El propietario puede dar de alta al administrador local con `npm run staff:local -- UUID_DE_SUPABASE`, tomando el UUID de Authentication → Users. El comando lleva --local, valida el UUID y registra auditoría. No se ejecutó automáticamente ni modifica Cloudflare remoto.

## Orientación de splats

El visor aplica por defecto una rotación de 180° alrededor de Z para corregir la orientación vertical de capturas con convención Y descendente, siguiendo el ejemplo de PlayCanvas. El control «Corregir orientación vertical» permite volver a la orientación original sin recargar el archivo. El encuadre utiliza la caja transformada, no las coordenadas originales.

La referencia de cámara incluye la orientación; una cámara guardada para la original no se aplica silenciosamente a la corregida. Tras cambiar de orientación hay que volver a guardar la cámara. No se modifica el archivo de captura. El resultado del splat del usuario todavía necesita confirmación visual.

## Capturas administradas

El flujo de carga por ruta queda sustituido por capturas completas del gimnasio. Consulta [clon digital](clon-digital.md): el administrador publica la captura y el staff crea rutas sobre la versión vigente.

## Preparación espacial UX-P0 (14 de octubre de 2026)

Sobre una captura administrada, abre preparación 3D y selecciona un punto. Revisa el candidato antes de confirmarlo; puedes descartarlo o ajustar su posición con pulsaciones de 0,01/0,001 unidades del clon (no metros). XYZ permanece plegado. La referencia visual usa un ancla pequeña, línea y etiqueta desplazada; si no cabe la etiqueta, selecciona desde la lista.

Seleccionar un agarre abre una copia temporal: **Aplicar** confirma posición/rol y **Cancelar** conserva el original. Aplicar valores idénticos conserva el respaldo y la verificación. Cambios confirmados, deshacer y rehacer requieren preparar nuevamente respaldo y revisión cuando corresponda. Escape cancela la herramienta activa. Cambiar captura o sección cancela la preparación temporal.

El selector de etiquetas ofrece Todos, Inicio y final u Ocultar etiquetas; la edición activa permanece visible. El PNG utiliza el mismo layout que el visor. Guardar/publicar siguen usando los permisos, revisiones y validaciones existentes.
