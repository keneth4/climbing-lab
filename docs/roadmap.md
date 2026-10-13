# Etapas y decisiones pendientes

## Secuencia propuesta

| Etapa                 | Resultado                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------- |
| 0. Validación técnica | Comparación de formatos y prototipo de cámaras/marcadores con el spray wall                 |
| 1. Piloto funcional   | Catálogo 3D, permisos, bitácora, reportes e imágenes compartibles                           |
| 2. Video              | Recorridos preparados y exportación de clips                                                |
| 3. Gestión de socios  | Planes, vigencias, entradas, credenciales QR, visitas, pagos manuales y dashboard de cobros |
| 4. Pagos en línea     | Compras, renovaciones, promociones y conciliación de eventos del proveedor                  |
| 5. Tienda             | Variantes, inventario y pedidos; recogida en gimnasio como propuesta inicial                |

La personalización visual puede comenzar una vez validado el sitio funcional. Esta secuencia no implica fechas ni presupuestos comprometidos.

## Decisiones técnicas abiertas

- Motor actual: PlayCanvas. Comparar alternativas solo si las mediciones del piloto justifican un cambio.
- Formato de publicación: comparar SPZv4, SOG y, si las mediciones lo justifican, niveles de detalle.
- Evaluar bloques espaciales, carga progresiva y prioridad de detalle por región de ruta; ver [QR y LOD](qr-y-lod.md).
- Stack definido: Svelte/Vite, Supabase Auth y Worker/D1/R2 por gimnasio. Falta despliegue remoto, backups y validación operativa.
- Límites de archivos, tiempos de procesamiento y política de retención de capturas/exportaciones.
- Picking y oclusión de marcadores; posible geometría auxiliar para edición.
- Generación de video en dispositivo o servicio.
- Exportación estática del catálogo frente a publicación mediante servicios; cuentas y cobros necesitarán servicios persistentes.

## Decisiones de producto abiertas

- Gimnasio piloto y dispositivos representativos.
- Escalas de graduación y tipos de ascenso que se registrarán.
- Cómo contar intentos y agruparlos por sesión.
- Política de revisiones y correcciones de rutas.
- Roles definidos: administrador gestiona capturas y secciones; staff edita rutas y resuelve reportes. Falta gestión de invitaciones y revocación desde la interfaz.
- Reglas de atribución y datos visibles en tarjetas.
- Expiración, congelamiento y renovación de membresías.
- Conciliación de transferencias y terminal; conexión o registro manual.
- Proveedor de pagos y esquema de cuentas de cada gimnasio.
- Alcance del dashboard, gastos e inventario.
- Modelo comercial de Creativivid, todavía sin definir.
- Login mediante QR: definir un flujo temporal con prueba de identidad, separado de la tarjeta de visitas.

## Relación con MenuMaker

Se revisaron el README y package.json. El proyecto usa Svelte + Vite, exporta sitios estáticos e incluye PlayCanvas, Spark, Three y SplatTransform. Esto justifica investigar reutilización, pero no confirma todavía qué componentes se pueden trasladar.

Se propone mantener Climbing Lab como producto independiente y evaluar piezas compartidas. No se copiará código del repositorio privado a este repositorio público sin revisar qué se quiere publicar.

## Estado de la base funcional

- [x] Login Google/correo mediante Supabase y permisos locales por gimnasio.
- [x] Catálogo, cámaras de ruta, bitácora, reportes y QR de rutas.
- [x] Capturas completas versionadas, alineación asistida y conservación/importación por sección.
- [x] Cámara inicial del gimnasio y encuadre principal.
- [x] Secciones por caja o contorno, cuadrícula y selección aproximada de puntos.

Estas tareas describen capacidades locales verificadas, no certifican un servicio de producción. La selección de puntos, escala y alineación requieren revisión humana.

## Próximas entregas del piloto

| Orden | Entrega                             | Criterio para cerrarla                                                                                                                                 |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Corrección de regiones guardadas    | Editar cajas y contornos conservando identidad, historial y referencias de rutas; impedir sobrescrituras concurrentes; cancelar sin escribir datos     |
| 2     | Edición espacial más directa        | Seleccionar/mover un vértice, orientar el plano para paredes inclinadas y ajustar profundidad; conservar controles numéricos y comprobar móvil/teclado |
| 3     | Validación entre capturas completas | Probar con dos capturas reales alineadas; revisar escala, error de referencias y correspondencia de secciones/cámaras; conservar versiones anteriores  |
| 4     | Ruta real de principio a fin        | Elegir sección, cámara, puntos 3D de agarres y beta; consultar desde QR; registrar intento/ascenso y retirar ruta preservando historial                |
| 5     | Rendimiento y recuperación          | Medir carga, memoria y fluidez en dispositivos piloto; comparar PLY/SOG/SPZv4; reanudar/limpiar subidas interrumpidas; elegir LOD solo con evidencia   |
| 6     | Exportaciones compartibles          | Imagen y tarjeta con encuadre, datos y atribución; después barrido de cámara/video con límites de dispositivo conocidos                                |
| 7     | Piloto remoto con un gimnasio       | Configurar dominio y R2 remoto, backups/restauración, permisos y observabilidad; verificar flujos sin mocks antes de invitar socios                    |

## Siguiente entrega concreta: corrección de regiones

- [x] E1 — Definir revisión de sección y snapshot histórico; conservar su identidad al corregirla.
- [x] E2 — Migrar regiones existentes sin perder rutas ni capturas.
- [x] E3 — API administrativa con validación de geometría, versión esperada y auditoría atómica.
- [x] E4 — Cargar una región guardada en el editor, modificar nombre/tipo/volumen/vértices, previsualizar y guardar o cancelar.
- [x] E5 — Consultar historial y establecer cómo revisar correcciones sobre rutas existentes; no sobrescribir snapshots de ascensos.
- [x] E6 — Probar conflictos concurrentes, permisos, aislamiento, cancelación y persistencia en navegador.

La corrección geométrica no equivale a un cambio de armado: no retira rutas por sí sola. Cuando cambie el armado, se mantiene el flujo de publicación de captura completa por secciones. Las rutas guardadas conservan la revisión de sección anterior; al guardar explícitamente una edición de ruta, el staff adopta la revisión vigente. El historial anterior a la migración no puede reconstruirse: la geometría existente se registra como revisión inicial.

## Después del piloto visual

Gestión de socios y QR de visitas → planes, vigencias y cobros manuales → pagos en línea y conciliación → catálogo de ventas e inventario. Los gastos y el alcance de contabilidad se definirán como un módulo propio. Estas etapas siguen contempladas y no se adelantan mientras se valida el clon digital.

## Cierre de corrección de regiones — 12 de octubre de 2026

La edición administrativa mantiene ID, registra snapshots y auditoría, detecta revisión obsoleta y permite cancelar sin escribir. Historial y preparación de restauración disponibles en Capturas. Las restauraciones requieren confirmación y crean una revisión nueva. Los vértices admiten corrección numérica además de selección aproximada.

Verificación: 27 pruebas backend, 9 de dominio/geometría y 10 de navegador; tipos y build. Las pruebas de navegador usan auth/API simulados; las pruebas del Worker ejercitan D1 local y transacciones. Migración 0005 aplicada en bases A/B locales. Sigue pendiente la siguiente entrega: gizmos y plano de orientación libre.

## Continuación fuera del editor de secciones

La mejora de UX/UI, gizmos y orientación libre de secciones se mantiene pendiente por indicación del usuario. Se implementó el [flujo de agarres 3D de rutas](rutas-3d.md): preparación, cámara, beta y visualización con revisiones. El siguiente trabajo funcional es mejorar la relación entre beta/agarres y exportaciones, junto con la validación de continuidad usando dos capturas reales.

## Corrección de arranque del piloto

- [x] Rutas antiguas/de prueba sin sección ni captura no bloquean la primera publicación ni se vinculan automáticamente. Mantienen su snapshot y pueden prepararse tras publicar.
- [x] La interfaz identifica estas rutas como pendientes de asignación.
- [x] Pruebas de publicación inicial y reemplazo con ruta de prueba, conservación de cámara local/snapshot y navegador escritorio/móvil.

Se conserva el control para rutas ya vinculadas a una captura que perdieron su sección. Importar una ruta sin sección exige asignarla primero.

## Área personal del escalador

Se completó la [primera entrega de bitácora personal](bitacora-personal.md): resumen de intervalo completo, filtros locales de fecha/resultado, páginas, CSV de página y tarjetas históricas. Los siguientes candidatos fuera del editor de secciones son proyectos/sesiones de escalada y exportaciones 3D compartibles. Visitas QR, membresías y módulos comerciales siguen en etapas posteriores.

## Prioridades tras habilitar registro directo en bitácora

1. **Completar la actividad personal**: corrección/eliminación de registros propios con auditoría, fecha explícita para actividad pasada y exportación del intervalo completo. Definir estas reglas antes de implementar cambios sobre registros históricos.
2. **Proyectos y sesiones de escalada**: agrupar intentos, marcar rutas en proyecto y consultar progreso sin confundirlo con visitas del gimnasio.
3. **Visuales compartibles**: tarjetas con vista 3D y datos elegidos por el usuario; después recorridos de cámara/video. Mejorar secuencia de beta por agarre en paralelo cuando las rutas reales lo requieran.
4. **Validación y piloto remoto**: continuidad con dos capturas completas reales, dispositivos físicos, formato/rendimiento, dominio, backups/restauración y pruebas del servicio sin mocks.
5. **Gestión del gimnasio**: credenciales QR revocables y registro de visitas por staff, planes/vigencias y registro de cobros manuales.
6. **Comercial**: pagos en línea/conciliación y catálogo de ventas/inventario; definir alcance de gastos y contabilidad como módulo propio.

Las mejoras del UX/UI de secciones, gizmos y orientación libre siguen registradas y diferidas por preferencia del usuario. La prioridad inmediata es cerrar flujos cotidianos del piloto, no ampliar módulos comerciales antes de validarlo.

- [x] Acceso visible **Añadir registro** en bitácora y prueba de guardar/cancelar en escritorio y móvil.

## Cierre: corrección y retiro de actividad personal

- [x] Historial privado y versión independiente de la revisión de ruta.
- [x] Corrección de intentos, resultado y notas sin alterar ruta ni fecha.
- [x] Retiro confirmado y filtro de retirados, con exclusión del resumen vigente.
- [x] Transacciones, conflictos concurrentes, aislamiento de propietario/gimnasio y cancelación.
- [x] Flujo de navegador escritorio/móvil y limpieza del historial al refrescar sesión.

Continúan pendientes fecha explícita de actividad pasada y CSV del intervalo completo. Luego: proyectos/sesiones, visuales 3D compartibles, piloto remoto y gestión comercial en el orden anterior.

## Prioridad de interfaz espacial

- [x] Visor fijo y herramientas en panel plegable, con distribución lateral/escritorio e inferior/móvil.
- [x] Desplazamiento independiente: editar rutas/secciones no desplaza el muro fuera del viewport.
- [x] Compartir renderer entre herramientas para preservar cámara y carga al cambiar de módulo.
- [ ] Validar ergonomía de selección de puntos con Crux y dispositivos físicos.

Este principio de interfaz aplica a futuras herramientas del clon digital. Fecha de actividad pasada, exportaciones y módulos comerciales mantienen su alcance previo.

## Cierre: fecha explícita de actividad

- [x] Registrar actividad pasada con fecha/hora local convertida a UTC.
- [x] Rechazar futuro/fechas inválidas y conservar fecha real de escritura en auditoría.
- [x] Explicar que se usa la revisión vigente, sin reconstruir armados históricos.

Siguiente entrega personal: CSV del intervalo completo, separado de exportar la página visible. La persistencia del renderer entre módulos sigue pendiente como mejora del espacio de trabajo.

## Cierre: exportación completa de bitácora

- [x] CSV de intervalo completo con filtros aplicados, independiente de página.
- [x] Consulta única privada, protección de fórmulas y límite explícito de 2000 registros.
- [x] Pruebas de contenido descargado, aislamiento y rechazo de intervalos demasiado grandes.

El bloque de fecha pasada y exportaciones personales queda cerrado para el piloto. Sigue conservar renderer/cámara entre herramientas del espacio de trabajo; después proyectos/sesiones y visuales 3D compartibles.

## Cierre: persistencia del espacio 3D

- [x] Renderer/canvas compartido por catálogo, cuenta, bitácora y editores.
- [x] Memoria de cámara por ruta/captura y reutilización de asset cuando se conserva la captura.
- [x] Pruebas de identidad de canvas, valores de cámara y ausencia de descargas repetidas al cambiar de módulo.

Siguiente bloque: proyectos personales y sesiones de escalada; después visuales 3D compartibles. Sigue pendiente validar el editor con Crux/dispositivos físicos y continuidad con dos capturas reales.
