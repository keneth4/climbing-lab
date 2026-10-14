# Roadmap — demo web canónico y evolución del producto

**Actualizado:** 13 de octubre de 2026.  
**Estado del código revisado:** `main`, commit `6fce9a7b2f70eab81df0799fbfc234d72bb27ec1`.  
**Plan ejecutable siguiente:** [Plan de implementación del demo web](planes/2026-10-demo-web-canonico.md).

## 1. Dirección del producto (acuerdo de alcance)

**Primero se desarrollará y demostrará UN sitio ejemplo, de UN gimnasio ficticio o piloto, con una UX/UI genérica, digna, accesible y completamente funcional para el alcance acordado.** No se crearán ahora tres sitios visuales ni tres personalizaciones.

Climbing Lab se conserva como **base canónica** para funcionalidades, modelos, contratos, correcciones, accesibilidad y componentes comunes. Solo **después de estabilizar la aplicación funcional** se crearán diseños propios para cada uno de los tres gimnasios de la ciudad, manteniendo esa base compartida.

- **Un sitio visible ahora:** portada, catálogo, ficha, visor, cuenta/bitácora y staff, según los hitos; contenido de un gimnasio de ejemplo sin mezclar marcas reales.
- **Más gimnasios previstos en datos:** entidades, contratos, permisos, IDs y seeds preparados para distintos gimnasios; la prueba de aislamiento con A/B se conserva. La existencia de varios gimnasios en datos **no obliga a publicar múltiples frontends**.
- **Decisión técnica vigente:** [ADR-0001](decisiones/0001-backend-cloudflare.md) establece **una D1 por gimnasio y un Worker por gimnasio**, no una tabla compartida sin aislamiento. «Soportar varios gimnasios en la DB» se traduce por ahora a **modelo de producto multigimnasio y despliegues/almacenamientos aislados**. Cambiar a una base multitenant central requeriría un ADR nuevo y pruebas de seguridad.
- **Sin forks por cliente:** el core, el sistema de diseño base y la lógica se mantienen actualizables desde un solo repositorio. Las futuras capas de marca, contenido, variantes visuales y extensiones concretas se aíslan del core mediante interfaces/versiones estables; una corrección funcional no se rehace tres veces.
- **No confundir etapas:** demo navegable ≠ demo público seguro ≠ piloto funcional completo ≠ despliegues personalizados.

## 2. Evidencia del estado de `main`

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
