# Implementación de la auditoría UX y UI del piloto

13 de octubre de 2026.

Los incrementos A–C se implementan sobre la versión actual de Climbing Lab. La auditoría original revisó un commit anterior: autenticación, D1/R2, corrección de registros, proyectos y referencias históricas ya existían y se conservan. Los módulos de expansión que ya estaban en el repositorio siguen disponibles en navegación secundaria; esta entrega no amplía pagos, video, tienda, membresías ni exterior.

## Comportamiento del piloto

Los enlaces `/?ruta=ID` abren una ficha pública con identidad, imagen, reglas y acciones sin cargar PlayCanvas. Catálogo, detalle y vistas personales tienen URLs; Atrás/Adelante recuperan filtros y selección. Las rutas retiradas conservan su enlace. Un destino inexistente muestra un error, no otra ruta.

Los borradores de actividad y reportes se separan por UUID de cuenta, ruta y revisión. Cambiar ruta no traslada datos ni abre su beta. Un conflicto de revisión refresca la ficha, conserva el borrador y exige revisar la nueva revisión antes de enviarlo. Una petición en curso usa la identidad capturada al iniciar; las respuestas de otra sesión se descartan. Cerrar o cambiar cuenta limpia información personal. El retorno desde login conserva la ruta iniciada; un borrador de login se guarda temporalmente en sessionStorage y se consume al regresar.

Guardar muestra estado y recuperación junto al formulario. Se bloquean envíos simultáneos y un segundo envío inmediato después del éxito; “Registrar otra actividad” inicia uno nuevo. Los reintentos mantienen la clave de petición. “Deshacer” retira lógicamente el último registro guardado; las correcciones siguen disponibles en Bitácora. Cada registro cuenta intentos de esa actividad. Guardar proyecto es independiente del ascenso.

El editor organiza datos, captura/cámara, agarres/reglas y previsualización. Puede guardar rutas incompletas como borradores privados. Para publicar exige nombre, escala/grado, sector, captura publicada y vigente, cámara compatible, inicio/final 3D, respaldo y revisión de todos los agarres desde dos ángulos. La imagen se puede generar en el visor o subir como PNG anotado; se liga en servidor a captura, cámara y marcadores. Cambiar estos últimos obliga a generar una imagen compatible. Retiro/reactivación requieren motivo. Los borradores editoriales se conservan en memoria por cuenta/ruta/revisión al navegar.

El editor separa navegación y selección, permite corregir coordenadas, deshacer/rehacer y copiar agarres de otra ruta de la misma captura con confirmación. Copiar no modifica la fuente ni su beta. La previsualización utiliza la misma presentación de la ficha pública.

Una captura nueva exige revisar las rutas conservadas. Las rutas con presentación completa requieren cámara y respaldo nuevos antes de activarla; las presentaciones antiguas siguen disponibles para la bitácora. Administración puede restaurar una captura publicada anterior con motivo y generación esperada: crea revisiones nuevas y retira rutas sin presentación histórica en esa captura, sin reescribir ascensos.

El visor se activa por intención, ofrece cancelación/reintento, órbita/desplazamiento, zoom, pinza y pan con dos dedos, recuperación de ruta/gimnasio, calidad y salida a la ficha. Un único runtime conserva contexto entre vistas; pausa render al ocultarse y mantiene hasta 50 cámaras en memoria. La selección de presas sigue siendo aproximada y requiere revisión visual; no hay segmentación ni garantía de oclusión física.

Compartir tiene vista previa y descarga del mismo PNG. Nombre, fecha, intentos y notas tienen controles independientes y están desactivados inicialmente. Las tarjetas históricas consultan la revisión del registro; una imagen ausente no se sustituye por la actual. La tarjeta QR de vista previa incluye identidad y enlace completo; la impresión pública permanece deshabilitada hasta verificación remota, según Ola 0.

Los reportes tienen categoría, revisión, responsable y resolución trazable. Los pendientes de agarre suelto aparecen primero e indican avisar directamente al staff. El staff puede tomar un reporte; el autor ve su respuesta en Mis reportes. Resolver no modifica la ruta.

Se registran exclusivamente eventos de vocabulario fijo, conteos diarios UTC y suma de tiempos: apertura QR, ficha/vista 3D disponibles, inicio/guardado y exportación, con errores. No se guardan notas, ruta, cuenta, correo ni identificadores de dispositivo en esas métricas. Los promedios agregados no son percentiles ni pruebas de usabilidad; descarga terminada significa preparación e inicio de descarga, no confirmación de guardado del sistema operativo.

## Interfaces y operación

Migración **0009_pilot_ux.sql**, aplicada en D1 local A y B. Es aditiva: publicación privada de borradores, reportes operativos, claves idempotentes, imágenes, motivos de cambios y métricas. Los snapshots existentes no se reescriben. Se usa el binding R2 existente del gimnasio; esta entrega no ejecuta migraciones remotas ni despliega.

- Rutas: `status: borrador` para staff; `gradeScale`, `rules`, `imageId`, `markersVerified`, `changeReason`. GET público excluye borradores; consultar uno exige staff. El listado incluye snapshot y revisión para evitar una petición por ruta; el frontend pagina de 100 en 100 hasta el límite de offset existente.
- Actividad y reportes: `requestId` opcional y `expectedRevision` opcional, usados por el formulario del catálogo. Una clave se limita a cuenta y operación; repetir el mismo contenido devuelve el mismo ID, cambiarlo devuelve 409. La creación de actividad comprueba revisión/estado de ruta dentro de la transacción.
- Imágenes: `POST /api/route-images` recibe PNG de hasta 4 MiB y 4096 × 4096, `X-Capture-Id` y `X-Presentation` con cámara/agarres. Solo staff, o admin para capturas borrador. GET por ID es público cuando figura en una presentación publicada; antes requiere staff. Los objetos históricos permanecen disponibles.
- Capturas: publicación admite `routePresentations` para las rutas completas conservadas; `POST /api/captures/:id/rollback` exige admin, `expectedGeneration` y motivo.
- Reportes: POST acepta categoría y revisión; GET devuelve solo los propios. Staff puede tomar uno con `/assign` y resolver con `/resolve` y motivo obligatorio. No se sobrescribe una resolución ya realizada.
- Métricas: POST `/api/ux-events` acepta evento y `durationMs` acotado; GET requiere staff y devuelve agregados, no actividad personal.

La migración de actividad demo es voluntaria, con selección explícita y deduplicación por ID de origen/cuenta. Solo se ofrecen rutas/revisiones aún coincidentes, hasta 50 registros por selección. Los registros incompatibles no se importan como si fueran otra ruta o revisión; el original se conserva en el dispositivo. No se importa ni se atribuye automáticamente actividad local a una cuenta.

## Matriz de los 36 hallazgos

“Resuelto” significa implementado o comprobado en el código y pruebas locales. “Validación física pendiente” identifica resultados que el software y la emulación no demuestran. La puerta física no queda aprobada por esta entrega.

| Nº  | Hallazgo                  | Estado                      | Evidencia o puerta restante                                                                                          |
| --- | ------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 01  | Entrada centrada en ruta  | Resuelto                    | QR abre detalle sin 3D ni cuenta; caso de navegador.                                                                 |
| 02  | Búsqueda y filtros        | Resuelto                    | Acentos, sector, escala, rango separado, orden, cantidad y limpieza.                                                 |
| 03  | Jerarquía de acciones     | Resuelto                    | Actividad principal, proyecto secundario, compartir/reportar bajo demanda.                                           |
| 04  | Historial de navegación   | Resuelto                    | URLs y pruebas Atrás con ruta y filtros.                                                                             |
| 05  | Borradores por ruta       | Resuelto                    | Cuenta/ruta/revisión; prueba A→B→A y conflicto de revisión.                                                          |
| 06  | Beta opcional             | Resuelto                    | Cierra por cambio de ruta/revisión; reglas separadas.                                                                |
| 07  | Guardado recuperable      | Resuelto                    | Mensaje local, error/reintento, idempotencia, doble toque, retiro y corrección.                                      |
| 08  | Sesiones y proyectos      | Resuelto para piloto        | Intentos por actividad, fecha y proyectos existentes; sesiones explícitas excluidas por decisión.                    |
| 09  | Captura y respaldo        | Resuelto                    | Imagen por presentación en R2, ficha funcional ante ausencia/fallo, 3D opcional.                                     |
| 10  | Gestos y teclado          | Validación física pendiente | Controles, dos dedos, pinza y salida implementados; comprobar ergonomía en teléfonos.                                |
| 11  | Cámara por tarea          | Validación física pendiente | Ver ruta/gimnasio, cámara persistente; confirmar encuadres de inicio/final en ambas orientaciones.                   |
| 12  | Marcadores precisos       | Validación física pendiente | Referencia de captura/revisión, I/F, corrección y confirmación de dos ángulos; picking/oclusión requieren muro real. |
| 13  | Carga por intención       | Resuelto                    | Runtime diferido, descarga/preparación/listo, cancelación y reintento.                                               |
| 14  | Continuidad y dispositivo | Validación física pendiente | Runtime único, cámara conservada, render pausado, calidad y caché acotada; medir batería/memoria.                    |
| 15  | Elección de formato       | Validación física pendiente | Protocolo reproducible separado; sin elección basada solo en tamaño.                                                 |
| 16  | LOD legible               | Validación física pendiente | Mantener entrega actual; adoptar streaming únicamente después de medir mejora y legibilidad.                         |
| 17  | Crear como borrador       | Resuelto                    | Privacidad y mínimos de publicación comprobados en Worker/D1.                                                        |
| 18  | Editor explícito          | Resuelto                    | Navegar/seleccionar, undo/redo, lista, roles, reglas y copia confirmada sin modificar fuente.                        |
| 19  | Revisión y reemplazo      | Resuelto                    | Snapshots inmutables, imagen compatible, respaldo nuevo, rollback auditado y actividad histórica.                    |
| 20  | Permisos y reversión      | Resuelto                    | Staff local/admin de captura, motivo de retiro/reactivación, guards y aislamiento.                                   |
| 21  | Exportación fiel          | Resuelto                    | Presentación histórica y preview del mismo archivo; texto medido sin cortar enlaces/nombres.                         |
| 22  | Privacidad por campo      | Resuelto                    | Cuatro opciones independientes; pruebas unitarias y tarjetas en navegador.                                           |
| 23  | QR impreso                | Validación física pendiente | Tarjeta imprimible y URL estable implementadas; comprobar dominio final, tamaño, luz y teléfonos.                    |
| 24  | Reportes operativos       | Resuelto                    | Categoría, prioridad, responsable, respuesta propia y resolución sin cambio de ruta.                                 |
| 25  | Identidad y tokens        | Resuelto                    | Tema común y cálido, tokens y estados semánticos compartidos; ambos en QA.                                           |
| 26  | Lectura en gimnasio       | Validación física pendiente | Cuerpo 16 px y controles de 44 px; validar brillo, contraste real y uso con una mano.                                |
| 27  | Alternativa al canvas     | Validación física pendiente | Imagen anotada, lista y reglas, foco/controles; completar revisión manual con lector y zoom.                         |
| 28  | Estados y microtexto      | Resuelto                    | Pluralización, errores junto a acción, vacíos, ruta inexistente/retirada y pérdida de conexión.                      |
| 29  | Video                     | Expansión D                 | No ampliar el barrido experimental existente.                                                                        |
| 30  | Socios y visitas          | Expansión D                 | Conservar módulos existentes, sin ampliar su alcance.                                                                |
| 31  | Planes y pagos            | Expansión D                 | Conservar operación existente; sin nuevas integraciones ni cobros.                                                   |
| 32  | Dashboard y tienda        | Expansión D                 | Navegación secundaria; expansión posterior.                                                                          |
| 33  | Navegación por perfil     | Resuelto                    | Público, Proyectos/Bitácora/Cuenta y Staff/Capturas; otros módulos secundarios.                                      |
| 34  | Exterior                  | Expansión D                 | Piloto centrado en gimnasio.                                                                                         |
| 35  | Persistencia y confianza  | Resuelto                    | Auth/API existentes, limpieza por cuenta, importación voluntaria compatible e idempotente.                           |
| 36  | Medir tareas completas    | Validación física pendiente | Eventos agregados implementados; completar observación con personas y presupuesto acordado.                          |

## Verificación y puerta del piloto

Verificación local: 19 pruebas de dominio/cliente, 45 de API/runtime D1/R2 y 34 casos de navegador. Pruebas automatizadas con bases D1/R2 aisladas y Auth/API simulados en Chrome: tipos frontend/backend, dominio, API/runtime, build y navegador en 1440 × 1000 y 390 × 844. Cubren QR sin sesión, ruta inexistente, borradores separados, beta cerrada, Atrás, reintento, doble toque, conflicto de revisión, privacidad, edición/retiro, publicación incompleta, imágenes compatibles, restauración y aislamiento por gimnasio/cuenta. No se escribió actividad ni se publicó una captura real para QA. Se utilizó Playwright porque el plugin Browser no está disponible en esta sesión; capturas de QA en /tmp, sin overlays del framework ni errores de ejecución en los flujos comprobados. El fallo de imagen se provoca deliberadamente para comprobar la recuperación.

Antes de abrir el piloto, realizar una ronda con 5–8 escaladores y 2–3 integrantes de staff. Observar sin instrucciones: QR → reconocer inicio/final → reglas sin beta → registrar → corregir → compartir → reportar; staff prepara/publica/retira y reemplaza/restaura captura. Objetivo recomendado: al menos 80% de tareas sin ayuda, investigando cada confusión. Exigir cero atribuciones a otra ruta y cero divulgaciones de campos desactivados.

Usar Android representativos de gama media/baja e iPhone, red limitada y caché fría/caliente, ambas orientaciones, teclado abierto, sesión vencida, nombres largos y capturas fallidas. Revisar teclado, lector de pantalla, zoom y contraste manualmente. Staff debe reconocer todos los agarres desde los encuadres previstos. Registrar resultados en [validación de formatos y dispositivos](validacion-formatos-dispositivos.md). La emulación no aprueba precisión física, rendimiento GPU, QR impreso ni accesibilidad completa.

Límites deliberados: sin LOD nuevo ni adopción SPZv4, sin segmentación automática, sin presupuesto de rendimiento inventado, sin importación de revisiones incompatibles y sin despliegue remoto. La infraestructura debe conservar los objetos R2 referenciados al hacer backups/restauraciones; restaurar D1 solo no recupera archivos.

## Comparación posterior: sitio base de un gimnasio

Los 17 hallazgos de la auditoría de oportunidades multigimnasio se comparan con el código actual en [Sitio base de ejemplo](sitio-base-ejemplo.md). La nueva entrega añade portada, información/FAQ, configuración editorial versionada, navegación pública/cuenta/staff y catálogo con tarjetas/chips. `/` abre Inicio; `?ruta=` y enlaces con filtros siguen funcionando. La matriz de 36 hallazgos anterior conserva su numeración y su puerta de validación física. Las pruebas adicionales de sitio no convierten los pendientes físicos en resueltos.

## Ola 1 — auditoría integral de octubre de 2026

Fuente adicional: rama `docs/auditoria-flujo-integral-ux-2026-10`, commit `d0cefd5`. Los IDs siguientes pertenecen a esa auditoría, no reemplazan los 36 hallazgos originales ni la ampliación anterior. «Resuelto local» significa implementación y regresión local, no aceptación física o cumplimiento WCAG certificado.

| Hallazgo | Estado de implementación | Evidencia / pendiente |
| --- | --- | --- |
| A01 | Resuelto local | Recorrido en navegación persistente, conserva enlaces antiguos |
| A02 | Resuelto local | Explorar rutas primario; bloque secundario de recorrido con poster opcional |
| A03 | Resuelto local; contenido real pendiente | Config v2 validada y v1 normalizada; opcionales omitidos, sin datos inventados |
| A05 / F06 | Resuelto local, sólo texto | Productos disponibles / Consulta en recepción, sin checkout nuevo |
| B01 | Resuelto local | Nombre/grado/zona/imagen/estado primero; revisión en Información de ruta |
| B02 | Resuelto local | Nombre de zona, cantidad, recuperación y regreso a parada histórica |
| B03 | Parcial | Lectura/filtrado cliente conservados; mediciones 100/1000 sintéticas. Backend sólo tras decisión fundada en mediciones |
| B04 | Parcial | Recientes y contexto de zona disponibles; sin etiquetas ni niveles inferidos |
| B05 | Resuelto local | Registro breve con detalles opcionales, fecha, claves estables, 429/error sin pérdida |
| C01 | Resuelto local | Tarjetas de paradas en escritorio, selector/contador móvil |
| C02 | Resuelto local | Origen tour/parada/revisión en URL; reload, retorno y Atrás/Adelante probados |
| C03 | Resuelto local; validación física pendiente | Corte directo, posters/texto y errores; e2e conserva canvas y descarga única por escena |
| D01 | Resuelto local | Mi escalada; Actividad/Proyectos/Reportes/Cuenta, sin proyectos duplicados |
| D02 | Resuelto local | Reemplazo sólo tras éxito; fallo mantiene página; cambio de identidad desmonta datos privados |
| D03 | Resuelto local | Últimos 7 días (168 h), todo historial, resumen del intervalo, filtros/CSV secundarios |
| D04 | Resuelto local | UUID sólo en diagnóstico admin/dev/demo/loopback; sin nuevos roles |
| D05 | Resuelto local | Reportes propios visibles, conteos, respuesta, enlace y aviso físico por agarre suelto |

QR público sigue bloqueado según Ola 0. G01/G02 y L1–L3 conservan sus puertas remotas/físicas. A04, B07, C04, workspace staff/Ola 2, operaciones/Ola 3 y composición/Ola 4 siguen fuera de esta entrega.
