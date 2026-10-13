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

## Uso

Inicia sesión y abre **Bitácora**. Selecciona Desde/Hasta y resultado, después **Aplicar filtros**. Hasta incluye todo el día elegido; el navegador convierte el calendario local a un intervalo UTC semiabierto. El listado usa la fecha local y el CSV conserva la fecha UTC.

El resumen cuenta todos los registros que cumplen esos filtros. **Rutas distintas** cuenta IDs de ruta, no sus revisiones. **Registros con ascenso** cuenta declaraciones de ascenso, incluyendo repeticiones. **Intentos registrados** suma el campo de intentos de cada registro, incluidos los que terminaron en ascenso. No constituye control de visitas ni verificación deportiva.

**Página anterior/siguiente** conserva el intervalo aplicado. **Exportar esta página (CSV)** descarga hasta 50 registros visibles, con fecha UTC, nombre y grado históricos, revisión, resultado, intentos y notas. No exporta otras páginas silenciosamente ni transmite datos a otro servicio. Las tarjetas personales mantienen la inclusión de nombre/intentos como opción explícita.

## Seguridad y persistencia

El Worker deriva la cuenta del JWT; no acepta elegir otro usuario mediante parámetros. Todos los cálculos se limitan a `user_id` y la base del gimnasio. Las respuestas privadas usan `Cache-Control: no-store`. La consulta utiliza el índice existente de propietario/fecha, parámetros preparados y límites de paginación.

No se agregan tablas ni se modifican ascensos anteriores. Nombre/grado y representación histórica proceden del snapshot de ruta asociado al registro. Cerrar/cambiar sesión elimina datos del panel y preferencias de identidad de tarjeta. La renovación/revalidación de sesión remonta el panel, reiniciando los filtros para evitar mezclar resultados anteriores.

## Límites y pendientes

- [ ] Exportación completa de un intervalo mediante un flujo separado de la exportación de página.
- [ ] Agrupar intentos por sesiones de escalada y definir proyectos personales.
- [ ] Corregir/eliminar registros propios con auditoría y reglas de producto.
- [ ] Consultar cámara/captura histórica desde un registro.
- [ ] Incorporar vistas 3D en tarjetas compartibles; las tarjetas actuales usan el esquema 2D histórico cuando existe.
- [ ] Validar flujo con usuarios y dispositivos físicos.

La paginación actual conserva el límite de offset 10 000 del API; filtros más acotados permiten consultar intervalos menores. Si se agregan registros durante una consulta paginada, conviene aplicar los filtros nuevamente. No hay ranking de grados ni estadísticas financieras en esta entrega.

## Verificación — 12 de octubre de 2026

29 pruebas backend, 11 de dominio/geometría/CSV y 12 de navegador pasaron; tipos frontend/backend y build pasaron. Pruebas con más de 50 registros verifican resumen completo, página siguiente, filtros, descarga de CSV, tarjeta de ruta ausente del catálogo y desaparición de notas privadas al cerrar sesión. D1 local prueba aislamiento por cuenta y gimnasio. Auth/API de navegador se simulan; no se cargan ni exportan registros reales de usuarios durante QA.

Escritorio 1440 × 1000 y viewport móvil 390 × 844, sin errores de aplicación ni desbordamiento en los flujos probados. Persiste la advertencia conocida de tamaño del paquete PlayCanvas.
