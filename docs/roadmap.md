# Roadmap — demo web canónico y evolución del producto

**Actualizado:** 13 de octubre de 2026.  
**Referencia del diagnóstico inicial:** `main`, commit `6fce9a7b2f70eab81df0799fbfc234d72bb27ec1`.  
**Plan ejecutable siguiente:** [Plan de implementación del demo web](planes/2026-10-demo-web-canonico.md).

## Estado al integrar el trabajo local

Los cambios de implementación locales se incorporan desde el commit `c929cc2` y los 22 commits locales anteriores. El diagnóstico de la sección 2 y del plan enlazado se realizó sobre `6fce9a7b2f70`: sirve como punto de partida histórico, no describe todas las capacidades actuales.

La fuente de implementación vigente es [Implementación y límites](implementacion.md), la [matriz de 36 hallazgos](auditoria-ux-implementacion.md) y el [sitio base de ejemplo con comparación de 17 hallazgos](sitio-base-ejemplo.md). Ya existen conexión frontend/API, autenticación, portada, navegación, borradores/publicación, capturas versionadas, bitácora, proyectos y exportaciones. El cierre de contratos tipados/validados sigue siendo candidato para la primera rebanada del nuevo plan; el despliegue remoto y la validación física siguen pendientes.

Se conserva la nueva dirección D0–D4. El historial local al final registra trabajo previo y sus comprobaciones; sus expresiones «siguiente entrega» son históricas y no sustituyen las prioridades de este plan. Los módulos comerciales existentes se conservan, sin ampliar su alcance ahora.

## 1. Dirección del producto (acuerdo de alcance)

**Primero se desarrollará y demostrará UN sitio ejemplo, de UN gimnasio ficticio o piloto, con una UX/UI genérica, digna, accesible y completamente funcional para el alcance acordado.** No se crearán ahora tres sitios visuales ni tres personalizaciones.

Climbing Lab se conserva como **base canónica** para funcionalidades, modelos, contratos, correcciones, accesibilidad y componentes comunes. Solo **después de estabilizar la aplicación funcional** se crearán diseños propios para cada uno de los tres gimnasios de la ciudad, manteniendo esa base compartida.

- **Un sitio visible ahora:** portada, catálogo, ficha, visor, cuenta/bitácora y staff, según los hitos; contenido de un gimnasio de ejemplo sin mezclar marcas reales.
- **Más gimnasios previstos en datos:** entidades, contratos, permisos, IDs y seeds preparados para distintos gimnasios; la prueba de aislamiento con A/B se conserva. La existencia de varios gimnasios en datos **no obliga a publicar múltiples frontends**.
- **Decisión técnica vigente:** [ADR-0001](decisiones/0001-backend-cloudflare.md) establece **una D1 por gimnasio y un Worker por gimnasio**, no una tabla compartida sin aislamiento. «Soportar varios gimnasios en la DB» se traduce por ahora a **modelo de producto multigimnasio y despliegues/almacenamientos aislados**. Cambiar a una base multitenant central requeriría un ADR nuevo y pruebas de seguridad.
- **Sin forks por cliente:** el core, el sistema de diseño base y la lógica se mantienen actualizables desde un solo repositorio. Las futuras capas de marca, contenido, variantes visuales y extensiones concretas se aíslan del core mediante interfaces/versiones estables; una corrección funcional no se rehace tres veces.
- **No confundir etapas:** demo navegable ≠ demo público seguro ≠ piloto funcional completo ≠ despliegues personalizados.

## 2. Evidencia del diagnóstico inicial de `main`

| Capacidad | Estado real al revisar el código | Archivo de referencia |
| --- | --- | --- |
| UI local | Catálogo, bitácora, QR, exportaciones PNG y staff demo en una pantalla | `src/App.svelte`; [implementación](implementacion.md) |
| Visor | PlayCanvas PLY/SOG desde archivo local; cámara local | `src/SplatViewer.svelte` |
| API por gimnasio | Worker, D1 A/B locales, lectura de rutas, bitácora/reporte y autorización probada | `worker/index.ts`; [API local](api-local.md) |
| Autenticación | Verificación JWT preparada; emisor configurado como `auth.invalid`; sin login ni identidad desplegada | `worker/index.ts`, `wrangler.jsonc` |
| Integración web/API | **Pendiente**: el frontend continúa en `localStorage` | `src/domain.ts` y `src/App.svelte` |
| Publicación de rutas y capturas | **Pendiente**: no existen endpoints de editor/versión de captura ni assets remotos publicados | [API local](api-local.md); [piloto](piloto.md) |
| Presentación/UX | CSS y estructura de demo, sin home real, sin shells separadas, sin tematización configurable | `src/styles.css`; [interfaz base](interfaz-base.md) |
| Operación/hosting | Sin recursos de producción ni dominio para demo verificados en la documentación | [ADR](decisiones/0001-backend-cloudflare.md) |
| Calidad | Tests de dominio, API y navegador, pero no validación con escena real, dispositivos representativos o accesibilidad integral | `tests/pilot.spec.ts`; `worker/api.test.ts` |

**Corrección de lectura de documentación:** [implementación](implementacion.md) describe correctamente la UI local; donde indica que «no hay backend», leerlo como «la UI aún no consume el backend». La API local D1 sí existe. No considerar sus pruebas equivalentes a un despliegue remoto o a sesiones productivas.

## 3. Secuencia actual: un demo web antes del diseño por gimnasio

| Etapa | Objetivo | Criterio de salida |
| --- | --- | --- |
| **D0 — Integración de base** | Arquitectura mínima de rutas/pantallas, config de **gimnasio ejemplo** y cliente API real; contrato coherente frontend/Worker | Catálogo desde D1 local, estado vacío/error, sin datos de ejemplo incrustados como fuente principal |
| **D1 — Demo público compartible** | Portada y catálogo/ficha responsive; captura publicada y 3D remoto o fallback válido; QR y enlaces estables | Un visitante sin login abre el demo desde otro dispositivo; ficha es útil antes o sin 3D |
| **D2 — Demo interactivo seguro** | Auth gestionada real, bitácora/reportes vía API, roles staff e integración de edición/publicación mínimas | Flujo visitante → escalador → staff con datos persistentes y autorización, sin selector staff ficticio |
| **D3 — Base funcional canónica** | Completar el [piloto funcional](piloto.md): revisiones, agarres 3D, cámara, exportaciones consistentes, proyectos y pruebas de regresión | Un staff publica una ruta; un escalador la consulta, registra ascenso, exporta tarjeta y otro visitante abre el QR |
| **D4 — Validación y estabilización** | QA, rendimiento con captura real, accesibilidad, correcciones y documentación de operación/recuperación | Demo web presentable, reproducible, con fallbacks y métricas; core candidato a base reutilizable |
| **P — Diseños particulares (después)** | Diseños y contenido propios de gimnasio 1, 2 y 3 sobre el core estable; dominios/datos por sitio | Tres apariencias sin duplicar negocio ni perder actualizaciones del core |

Las fases D0–D4 pueden desarrollarse de forma incremental, con una demo visible desde D1. **La individualización visual P no bloquea avanzar con ninguna capacidad útil del core.**

### Funciones posteriores, separadas del objetivo demo

Se preserva el plan de evolución, pero no entra como condición para mostrar el demo:

| Etapa futura | Resultado esperado |
| --- | --- |
| F1. Video | Barridos de cámara configurables y exportación de clips |
| F2. Gestión de socios | Planes, vigencias, QR de visita, asistencia y cobros manuales |
| F3. Pagos | Compras, renovaciones, promociones y conciliación del proveedor |
| F4. Tienda | Productos, inventario y pedidos |
| F5. Escalada exterior/experiencias avanzadas | Ampliaciones tras validar utilidad real |

Pueden implementarse funcionalmente en la base canónica antes de habilitarse en un sitio particular, pero requieren planes y criterios de seguridad propios.

## 4. Prioridades inmediatas (en orden de dependencia)

1. **Fijar el contrato del gimnasio ejemplo y del demo:** marca neutra, datos ficticios, alcance y rutas públicas; conservar seeds de A/B para aislamiento.
2. **Cerrar discrepancias de API/dominio y conexión web:** actualmente `GET /api/routes` no entrega la misma representación de ruta/revisión que espera `App.svelte`; definir DTO, paginación y estados de UI.
3. **Crear shell público sencillo y responsive:** Inicio, Rutas, Detalle y navegación; estilos con tokens mínimos para cambiar de identidad después, **sin diseñar marcas propias ahora**.
4. **Probar escena REAL y preparar entrega remota:** elegir PLY/SOG/SPZ/streaming por mediciones; publicar captura/versiones en R2; miniatura o fallback disponible antes de cargar 3D.
5. **Completar modelo/editor/publicación:** captura, revisión, cámara, marcadores, borrador y retirada, vinculados a identidad de captura; preservar QR y bitácora histórica.
6. **Activar auth real y conectar bitácora/reportes/staff:** roles por gimnasio, sesión, estados de carga/error, prohibición de acceso cruzado y registro auditable.
7. **Unificar compartibles y calidad:** tarjeta de ascenso y PNG usando revisión histórica y captura correcta; prueba de QR físico y enlace remoto; responsive, teclado, fallbacks, tasa de errores y rendimiento.

**Plan de trabajo detallado por entregables y criterios:** [`docs/planes/2026-10-demo-web-canonico.md`](planes/2026-10-demo-web-canonico.md).

## 5. Reglas para mantener la base canónica

1. Código de negocio, D1/migraciones, contratos API, permisos, estados, accesibilidad y visor viven en el core.
2. El demo usa un **tema neutro único** y contenido/configuración del gimnasio ejemplo. Los tokens semánticos evitan colores y marcas codificados dentro de lógica o exportaciones.
3. El diseño particular futuro se implementa como **capa de branding/composición versionada** (configuración, tokens, layouts y assets) sin editar el core. Las excepciones requieren una extensión explícita, no copiar/pegar componentes comunes.
4. Cambios al core deben ejecutar pruebas del demo canónico y, cuando existan, smoke/regresión de los tres sitios personalizados. La base demo permanece disponible como referencia después de lanzar los sitios.
5. Versionar contratos, migraciones y cambios de interfaces para que un tema antiguo sea detectable e incompatible explícitamente, no silenciosamente.
6. Un único código fuente **no implica** mezclar datos de gimnasio ni ofrecer capacidades staff sin verificar en servidor.

## 6. Trabajo con Codex y Git

Para cualquier **feature de implementación**, crear una rama desde `main`. Documentar el plan en Markdown en esa rama, de manera incremental (**un documento de planificación por commit**, si se divide el alcance), validar entregables y abrir PR hacia `main`. Evitar desarrollo funcional directamente en `main`.

Este ajuste de planeación se puede integrar a `main` mediante PR documental antes de iniciar el feature técnico. El siguiente feature sugerido es **`feat/demo-web-base`** (nombre orientativo; abrirlo al arrancar desarrollo), cuyo plan inicial es el documento enlazado arriba.

## 7. Decisiones vigentes y pendientes

### Conservadas

- Piloto con una escena completa por gimnasio, sectores sobre la misma captura; ver [producto](producto.md).
- Cuenta compartida de identidad como posibilidad; staff/bitácoras/membresías de cada gimnasio siguen aislados.
- QR de ruta estable e independiente de la captura; los QR de login y visita **no se confunden**.
- Solo staff publica rutas; registros históricos referencian revisiones; la beta es opcional.
- AWS/otras plataformas no se introducen por costumbre: continuar evaluación dentro de la arquitectura Cloudflare decidida.
- Video, pagos, tienda y gestión de visitas siguen posteriores al piloto.

### Por validar (no bloquear el inicio de D0)

- Gimnasio/paleta neutros y copy del ejemplo; se pueden usar datos ficticios comprobables.
- Selección/configuración de proveedor de identidad gestionada y flujo de login (bloquea D2 y despliegue con cuentas).
- Captura real y formato de entrega; umbrales de rendimiento (bloquea afirmar D1 completo en 3D).
- Criterio de cuándo un ajuste de armado origina una nueva revisión o una nueva ruta.
- Quién puede publicar y resolver incidentes; roles y protocolo de agarre suelto.
- DNS, recursos cloud, almacenamiento, dominio, backups y rate limiting (bloquea compartir un demo con escritura).

### Preguntas de fases comerciales (sin adelantar)

Planes, caducidad, renovaciones, conciliación de cobros, costos de tienda, proveedor de pagos, exportación de video y modelo de cobro Creativivid. Revisar al arrancar cada fase, no incluir en la primera demo.

## Anexo: historial de implementación local anterior a la integración

Las siguientes notas conservan el registro previo. Para planificar, contrastarlas con las fuentes de estado actual indicadas arriba.

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

La mejora UX/UI de los incrementos A–C está implementada según la [matriz de auditoría](auditoria-ux-implementacion.md); queda pendiente su validación física. Gizmos y orientación libre de secciones siguen fuera de esta entrega. Se implementó el [flujo de agarres 3D de rutas](rutas-3d.md): preparación, cámara, beta y visualización con revisiones. El siguiente trabajo funcional es mejorar la relación entre beta/agarres y exportaciones, junto con la validación de continuidad usando dos capturas reales.

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

## Implementación integral — 13 de octubre de 2026

Fuente de estado actual: [continuación integral](continuacion-integral.md). Los candidatos descritos en cierres anteriores ya se implementaron localmente donde se indica abajo.

- [x] E1 — Estado de conexión/permisos, Reintentar y comando conjunto de desarrollo.
- [x] E2 — Proyectos privados versionados y agrupación diaria por zona del gimnasio.
- [x] E3 — PNG 3D, atribución y preparación histórica con privacidad explícita.
- [x] E4 — Barrido de video, detección de formato, cancelación y recuperación del visor.
- [ ] E5 — Piloto remoto/validación física completa. Preparación, Crux de escritorio y restauración D1 local probados; faltan recursos/datos/dispositivos externos.
- [x] E6 — Socios, credenciales QR revocables, recepción, visitas y consumo/corrección auditados.
- [x] E7 — Planes, vigencias, cobros manuales, historial, dashboard y CSV.
- [x] E8 — Productos/variantes, catálogo público, ventas e inventario atómicos.

No hay despliegue remoto ni cambios de facturación. [Pasos externos y publicación](piloto-remoto.md). Antes de operar con clientes/dinero real se exige QA físico y servicio sin mocks. Checkout, suscripciones, facturación fiscal, gastos y conciliación con proveedor mantienen su etapa posterior.
