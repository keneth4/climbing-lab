# Bitácora personal: resumen, filtros y exportación

## Requisitos

- Consultar únicamente actividad de la cuenta autenticada en ese gimnasio.
- Resumir todos los registros del intervalo, independientemente de la página visible.
- Filtrar por fechas del calendario local del usuario y resultado intento/ascenso.
- Mostrar páginas de 50 registros, conservando nombre, grado y revisión histórica de ruta.
- Exportar explícitamente la página actual a CSV y mantener exportación de tarjetas históricas.
- Limpiar datos y borradores personales al cerrar/cambiar sesión y descartar respuestas de componentes desmontados.

## Tareas cerradas

- [x] J1 — Filtros y paginación autenticada en API.
- [x] J2 — Totales completos de registros, intentos, registros con ascenso y rutas distintas.
- [x] J3 — Controles de bitácora con fechas, resultado y navegación de páginas.
- [x] J4 — CSV de página visible, con comillas y protección de celdas que parecen fórmulas.
- [x] J5 — Tarjeta histórica sin depender de que la ruta siga cargada en catálogo.
- [x] J6 — Privacidad de sesión, pruebas de aislamiento y regresiones en escritorio/móvil.
- [x] J7 — Acceso directo Añadir registro desde la bitácora, cancelación y actualización después de guardar.

## Uso

Inicia sesión y abre **Bitácora**. **Añadir registro** abre el formulario para elegir una ruta activa, indicar intentos, resultado y notas. **Guardar registro** confirma la actividad con la fecha actual y la revisión vigente de ruta; cancelar no escribe datos. Tras guardar, se actualizan el listado y el resumen, reiniciando los filtros. El formulario del catálogo sigue disponible. Selecciona Desde/Hasta y resultado, después **Aplicar filtros**. Hasta incluye todo el día elegido; el navegador convierte el calendario local a un intervalo UTC semiabierto. El listado usa la fecha local y el CSV conserva la fecha UTC.

El resumen cuenta todos los registros que cumplen esos filtros. **Rutas distintas** cuenta IDs de ruta, no sus revisiones. **Registros con ascenso** cuenta declaraciones de ascenso, incluyendo repeticiones. **Intentos registrados** suma el campo de intentos de cada registro, incluidos los que terminaron en ascenso. No constituye control de visitas ni verificación deportiva.

**Página anterior/siguiente** conserva el intervalo aplicado. **Exportar esta página (CSV)** descarga hasta 50 registros visibles, con fecha UTC, nombre y grado históricos, revisión, resultado, intentos y notas. No exporta otras páginas silenciosamente ni transmite datos a otro servicio. Las tarjetas personales mantienen la inclusión de nombre/intentos como opción explícita.

## Seguridad y persistencia

El Worker deriva la cuenta del JWT; no acepta elegir otro usuario mediante parámetros. Todos los cálculos se limitan a `user_id` y la base del gimnasio. Las respuestas privadas usan `Cache-Control: no-store`. La consulta utiliza el índice existente de propietario/fecha, parámetros preparados y límites de paginación.

La migración 0006 agrega versión de registro, retiro lógico e historial inmutable. Los registros existentes reciben una versión inicial; no se pueden reconstruir cambios anteriores. Nombre/grado y representación histórica proceden del snapshot de ruta asociado al registro. Cerrar/cambiar sesión elimina datos del panel y preferencias de identidad de tarjeta. La renovación/revalidación de sesión remonta el panel, reiniciando los filtros para evitar mezclar resultados anteriores.

## Límites y pendientes

- [ ] Exportación completa de un intervalo mediante un flujo separado de la exportación de página.
- [ ] Agrupar intentos por sesiones de escalada y definir proyectos personales.
- [x] J8 — Corregir intentos, resultado y notas propios con versión esperada e historial.
- [x] J9 — Retirar registros con confirmación, excluirlos de actividad vigente y consultar los retirados.
- [ ] Consultar cámara/captura histórica desde un registro.
- [ ] Incorporar vistas 3D en tarjetas compartibles; las tarjetas actuales usan el esquema 2D histórico cuando existe.
- [ ] Validar flujo con usuarios y dispositivos físicos.

La paginación actual conserva el límite de offset 10 000 del API; filtros más acotados permiten consultar intervalos menores. Si se agregan registros durante una consulta paginada, conviene aplicar los filtros nuevamente. No hay ranking de grados ni estadísticas financieras en esta entrega.

## Verificación — 12 de octubre de 2026

30 pruebas backend, 11 de dominio/geometría/CSV y 12 de navegador pasaron; tipos frontend/backend y build pasaron. Pruebas con más de 50 registros verifican resumen completo, página siguiente, filtros, descarga de CSV, tarjeta de ruta ausente del catálogo y desaparición de notas privadas al cerrar sesión. D1 local prueba aislamiento por cuenta y gimnasio. Auth/API de navegador se simulan; no se cargan ni exportan registros reales de usuarios durante QA.

Escritorio 1440 × 1000 y viewport móvil 390 × 844, sin errores de aplicación ni desbordamiento en los flujos probados. Persiste la advertencia conocida de tamaño del paquete PlayCanvas.

## Correcciones y retiro — 12 de octubre de 2026

En cada registro vigente aparecen **Corregir registro**, **Retirar registro** y **Ver historial del registro**. La corrección permite cambiar intentos, resultado y notas; conserva fecha, ruta y revisión histórica. Cancelar no escribe datos. Guardar incrementa la versión y conserva el contenido anterior. Una edición concurrente obsoleta se rechaza para evitar sobrescribir otra corrección.

El retiro exige **Confirmar retiro** y conserva el registro y sus versiones. Los registros retirados quedan fuera del listado y resumen vigentes; se consultan con **Estado de registros → Retirados → Aplicar filtros**. Su resumen cuenta únicamente retirados y no representa actividad vigente. El CSV incluye estado y versión. No existe restauración ni borrado definitivo en esta entrega. El historial muestra las últimas 100 versiones.

Sólo el propietario puede modificar o consultar el historial, incluso frente a una cuenta administrativa. Registro, historial y evento de auditoría se escriben en una transacción D1. Migración aplicada en ambos gimnasios locales; pendiente aplicar al preparar producción. Las pruebas usan datos aislados, sin corregir ni retirar actividad real del usuario.

Siguiente entrega: definir y habilitar fecha de actividad pasada y exportación completa del intervalo; después proyectos/sesiones y tarjetas 3D.
