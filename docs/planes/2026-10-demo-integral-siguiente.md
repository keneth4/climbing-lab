# Plan ejecutable siguiente — Demo integral canónico de un gimnasio

**Fecha:** 13 de octubre de 2026  
**Referencia del código:** [`main@416eb32a1205`](https://github.com/keneth4/climbing-lab/commit/416eb32a1205287c3d96b8a3842eb1d0ca08f625)  
**Rama futura de implementación:** `feat/demo-integral-canonico`, nueva desde `main` después de integrar este plan.  
**Roadmap rector:** [`docs/roadmap.md`](../roadmap.md).

## Resultado esperado

Producir una demostración **local completa, reproducible y honesta** de **un gimnasio ficticio** usando los módulos que ya existen. El objetivo inmediato es **L0**: que alguien clone el repositorio, prepare el ambiente, abra la web y entienda el producto con rutas, captura/fallback y datos útiles. Dejar listo el paso a una única URL pública de staging (L1), sin exigir recursos cloud para cerrar los avances de desarrollo local.

El ejemplo sigue siendo la referencia **canónica**, incluso tras crear después tres diseños distintos. No crear ahora tres sitios, forks, marcas ni copias de `App.svelte`. No introducir un selector de gimnasios público: modelo preparado para varios, despliegues y D1/R2 aislados por gimnasio conforme a ADR-0001.

## 1. Hallazgos comprobados y alcance NO duplicable

| Ya implementado en `main` | No rehacer |
| --- | --- |
| Portada, FAQ, shell público/cuenta/staff, catálogo, filtros, enlaces QR | No iniciar otra app de marketing ni implementar un router completo por impulso |
| Supabase Auth, Worker API, D1/R2 locales, roles | No reconstruir login ni sustituir comprobaciones de servidor por modo demo |
| Capturas completas, secciones/revisiones, cámaras, agarrres 3D, PlayCanvas | No introducir otro renderer ni duplicar escenas por ruta |
| Bitácora versionada, proyectos, reportes, historial, tarjetas PNG | No crear modelos paralelos ni almacenar nuevas entradas solo en navegador |
| Socios/visitas QR, planes, cobros manuales, inventario, ventas y video básico | Preservar; no ampliar checkout/finanzas/video para completar L0 |
| Tests unitarios, Worker y Playwright con mocks en browser | Extender con un **smoke integrado real**, no sustituirlos |

**Brecha primaria observada:** `scripts/seed-local.mjs` crea únicamente un registro sencillo por entorno y sin captura pública publicada, por lo que un clon nuevo del repo carece de un escenario rico y consistente. El demo debe contar una historia, no obligar al operador a construir todo el catálogo manualmente.

**Brecha de aceptación:** no hay un protocolo integrado automatizado que pruebe **navegador → Vite → Worker → D1/R2 locales** con datos demo sin mocks HTTP. Los tests existentes siguen siendo valiosos, pero no demuestran por sí solos este recorrido de extremo a extremo.

**Brecha externa:** aun no hay staging público, validación física móvil, segundo splat completo ni recuperación remota D1+R2. No presentarlo como una falla de implementación del catálogo existente.

## 2. Alcance demostrable y dataset de un solo gimnasio

El gimnasio de ejemplo ya se llama «Climbing Lab · Gimnasio de ejemplo» en `src/site.ts`. Mantener aviso ficticio en portada, pie y cualquier texto que pueda confundirse con un negocio existente. No inventar ubicación, WhatsApp, teléfono, tarifas, testimonios ni nombres de gimnasios reales.

Preparar una muestra pequeña pero convincente:

| Elemento | Sugerencia de datos | Razón |
| --- | --- | --- |
| Sectores | 2–3 sectores/áreas de ejemplo con nombres claramente ilustrativos | Demostrar navegación y filtros |
| Rutas activas | 4–6 problemas con grados variados, regla y beta opcional | Demostrar búsqueda, detalle y dificultad |
| Ruta histórica | Al menos una retirada con revisión estable | QR/historial y diferenciación del estado |
| Ruta en borrador | Una incompleta, invisible al público | Flujo de staff y mínimos de publicación |
| Captura | Un asset autorizado de prueba y imagen estática por ruta cuando se disponga | Vista/3D reales; no incluir PLY pesado en Git |
| Cuentas | Usuario y staff **existentes y autorizados**, no tokens/JWT falsos ni contraseñas en Git | Demostrar 401/403 y operaciones privadas |
| Estado personal | Actividad/proyectos opcionales cargados mediante API autorizada o creados durante la demo | Evitar crear o atribuir bitácoras a un tercero |
| Operaciones | Plan, producto/variante de prueba opcional solo en entorno aislado | Enseñar módulos existentes sin simular cobros reales |

**Regla de datos:** cualquier fixture D1 debe respetar migraciones, snapshots y requisitos de publicación. Una ruta antigua sin sección/captura no puede aparecer como ruta 3D validada. Si no hay escena publicable, el demo **debe decir que ofrece vista de respaldo** y reservar 3D para la sesión local con captura autorizada.

## 3. Plan por commits Markdown y rebanadas de Codex

Cada rebanada se describe en **su propio archivo Markdown y commit de planificación** en la rama de feature nueva. Luego implementar y comprobar antes de comenzar la siguiente. No es necesario crear de una vez todos los documentos si el alcance cambia tras las pruebas. Mantener un solo PR final del feature a `main`.

| Entrega | Markdown (un commit por documento) | Implementación | DoD verificable |
| --- | --- | --- | --- |
| **D01** | `docs/planes/demo-integral/01-escenario-y-datos.md` | Datos ficticios curados, fixtures, capturas/posters permitidos y seed versionado | Un gimnasio tiene listado rico con rutas activas, histórica y borrador correctamente aislado |
| **D02** | `docs/planes/demo-integral/02-bootstrap-local.md` | Preparación idempotente en D1/R2 local, comando(s) de setup/run/reset, chequeos y documentación | Un clon nuevo levanta el demo sin tener que editar SQL manualmente; reset no destruye A/B existente |
| **D03** | `docs/planes/demo-integral/03-recorrido-publico.md` | QA/integración del sitio actual: portada, filtros, ficha, fallback, beta, QR, compartir y 3D bajo demanda cuando haya asset | E2E sin interceptar `/api` consulta D1 real; la ruta es correcta al recargar y en móvil |
| **D04** | `docs/planes/demo-integral/04-recorrido-cuenta-y-staff.md` | Flujos con sesión real controlada: bitácora/proyectos/reportes, edición/publicación y roles por gimnasio | API real, errores 401/403, revisión histórica y protección cruzada; nunca se crea staff por seed público |
| **D05** | `docs/planes/demo-integral/05-presentacion-y-staging.md` | Pulir detalles que bloqueen tareas, guion, screenshots, checklist de accesibilidad/rendimiento, staging preliminar y runbook | L0 aprobado, bloqueo externo de L1/L2 enumerado; ningún paso del demo depende de mocks |

### D01 — Dataset y narrativa

1. Definir **una sola identidad editorial** (la actual) y un guion corto: visitante descubre una ruta → estudia beta/3D → usuario registra → staff cambia/publica → QR enlaza revisión estable.
2. Agregar fixtures y funciones de seed seguros. Semillas en D1 de desarrollo con nombres y IDs reservados para demo, manteniendo A/B separados. La nueva semilla no debe activar roles de staff ni mutar datos personales.
3. Preparar diversidad visual, estados y dificultad, datos completos de revisiones y campos requeridos por la UI. Mantener registros antiguos compatibles y no reescribir manualmente snapshots históricos.
4. Documentar qué partes son ficticias y qué assets provienen de material autorizado.
5. Pruebas: idempotencia, solo rutas de demo, listas públicas excluyen borradores, actualizaciones no borran bitácora, gym-b sigue aislado.

### D02 — Arranque reproducible

1. Añadir comando `demo:setup` que comprueba prerequisitos, aplica las migraciones locales **solo al destino seleccionado**, carga fixtures idempotentes y verifica `/api/health`, rutas y recursos de demo. No modificar D1 remotas ni ejecutar deploy.
2. Comando `demo:run` puede invocar `dev:local`; evitar servidores duplicados.
3. Opcional `demo:reset` **solo con confirmación y con destino de demo aislado**; nunca borrar bases locales A/B existentes sin selección explícita. Preferir namespace D1/R2 dedicado si el entorno y la CLI lo permiten.
4. Un `demo:check` comprueba datos críticos y explica faltantes (captura, credentials, R2, navegador). Salida distinta para bloqueo crítico vs aviso de 3D.
5. Probar instalación desde copia limpia y reejecución, sin variables secretas en artefactos.

### D03 — Visitante público íntegro

1. Reutilizar `SitePublic`, `RouteCatalog`, `RoutePresentation` y `SplatRuntime`. Ajustar únicamente problemas observados de comprensión, jerarquía o integración.
2. Sin mocks: `/` → Rutas → filtrar por sector/grado → abrir detalle y beta → vista estática / botón 3D → compartir QR / URL → recargar → retirada histórica.
3. Probar error de red/reintento, sin 3D, sin imagen, sin rutas, 320/390/768/1440 px, foco y teclado.
4. Ningún asset debe depender de `localhost` para el eventual L1. Para L0 se permite `localhost` explícito: los QR locales se etiquetan como no compartibles externamente.
5. Registrar foto/captura visible del estado final del navegador; no inferir calidad visual solo de ausencia de overflow.

### D04 — Escalador y staff, sin bypass

1. Usar **Supabase real de configuración conocida** con una cuenta de escalador controlada; `/api/me` confirma rol local, jamás por casilla.
2. Crear actividad mediante UI, verificar persistencia tras recarga y privacidad entre usuarios; registrar proyecto, reportar y exportar tarjeta sin incluir campos privados por defecto.
3. Con staff autorizado previamente por procedimiento local administrativo, crear borrador, editar cámara/agarres cuando haya captura, previsualizar, publicar/retirar, revisar reporte y preservar registros históricos.
4. Contrastar API D1 A/B para protección de datos y roles; cuentas ajenas deben obtener 401/403 sin exponer detalles.
5. Si faltan credenciales o assets autorizados, ejecutar pruebas públicas/worker y marcar recorrido privado como pendiente externo. **Nunca crear tokens de demostración reutilizables o un atajo de auth.**

### D05 — Cierre local y staging pendiente

1. Incorporar `demo:smoke` o test e2e separado con API real, instrumentando lectura/acciones seguras en una **base desechable dedicada** y garantizando limpieza sin tocar usuario real.
2. Ejecutar suite de checks: `check`, `check:api`, `format:check`, tests de dominio, API, build, e2e mocks existentes y nuevo smoke real.
3. Revisar responsive, teclado, lector con personas cuando sea posible; registrar problemas, estado de mitigación y limitaciones.
4. Preparar staging de **un solo gimnasio ficticio** bajo [`docs/piloto-remoto.md`](../piloto-remoto.md), con scripts existentes `pilot:check/dry-run/migrate/deploy`. Esto requiere credenciales/recursos/bucket y aprobación de gasto/despliegue; no forzar como requisito para merge del demo local.
5. Documentar operaciones de cuenta/staff, errores frecuentes, recuperación y procedimientos de respaldo D1 **y** objetos R2. Evitar capturas o videos que revelen datos privados.
6. Grabar una narrativa de demo/guion reproducible (no exigir grabación de video como parte del código).

## 4. Criterios de aceptación consolidada

- [ ] Un entorno nuevo puede preparar el gimnasio ejemplo con instrucciones y comandos claros.
- [ ] `demo:setup` repetido no duplica rutas ni borra datos no relacionados.
- [ ] `demo:check` comprueba contratos D1/R2 locales o informa claramente faltantes.
- [ ] La portada muestra una identidad demo genérica digna y aviso ficticio.
- [ ] Hay varias rutas consultables de diferentes grados/sectores, una retirada y borrador oculto al visitante.
- [ ] La ficha funciona sin WebGL ni 3D; imagen publicada o fallback indica su alcance.
- [ ] QR y enlaces profundos resuelven la misma ruta; URLs `localhost` no se prometen compartibles por internet.
- [ ] El 3D, si se incluye, usa el mismo asset/cámara/agarres versionados que la ruta; no mezcla versiones.
- [ ] Escalador autenticado conserva sus datos entre recargas; un usuario no accede a la actividad ajena.
- [ ] Staff se verifica en Worker/D1 y edita solo su gimnasio; cliente no determina rol o DB.
- [ ] Edición/publicación/retiro preservan revisiones y bitácora histórica.
- [ ] Tests sin mocks para visitante y Worker sobre D1/R2 locales pasan; QA con mocks existente continúa.
- [ ] 320/390/768/1440 px sin overflow, foco claro y recorrido por teclado; pendiente manual WCAG identificado.
- [ ] No hay credenciales, dumps, identificadores privados ni splats pesados en el repositorio público.
- [ ] Comandos, hallazgos, scripts y bloqueadores externos están documentados.
- [ ] No se crean tres diseños ni forks por gimnasio; demo canónico sigue la referencia para correcciones.

## 5. Puerta posterior: L1, L2 y L3

**L1, publicación anónima:** solo después de recursos Cloudflare/R2/URL verificados, capturas con permiso, HTTPS, cookies/headers adecuados, callbacks configurados y QR testeado desde un teléfono externo. Pueden prepararse despliegues de staging sin cuentas reales, pero no afirmar disponibilidad hasta verificar la URL.

**L2, sesión y escrituras remotas:** requiere control de admin y cuentas de prueba, rate limiting, logs sin PII, políticas de respaldo/restore real y validación D1/R2/sesión sin mocks. Evitar pagos o visitas reales.

**L3, core para personalización:** tras pruebas físicas con Crux y segundo splat cuando corresponda, iPhone/Android, red limitada, lectores de pantalla, ergonomía de editor, oclusión y QA de errores. Afinar bases/tokens/slots solo donde haya un caso real.

**Futuros diseños por gimnasio:** nueva rama por sitio o PR de branding; configuración y assets/versiones separados, posible composición propia, pero rutas/bitácora/servicios/3D compartidos. No confundir «tema más dos colores» con capacidad futura de diseño único: definir slots y contratos según los proyectos reales; proteger el demo base con regresiones.

## 6. Guion de exhibición

1. «Climbing Lab / Gimnasio de ejemplo» y aviso de que no corresponde a un establecimiento real.
2. Catálogo con varios problemas y sectores; filtrar y abrir una ruta.
3. Imagen/beta y 3D bajo demanda con captura permitida; si falta, explicar fallback honesto.
4. Compartir enlace local, QR y estados históricos. En público remoto, comprobar la URL de staging, no de localhost.
5. Escalador de prueba inicia sesión: proyecto, intento/ascenso, privacidad y tarjeta.
6. Staff autorizado: borrador → publicar/revisar → catálogo actualizado; reporte y estados.
7. Opcional: recepción/productos/planes usando datos exclusivamente ficticios y sin cobros reales.
8. Mostrar cómo una futura marca cambia presentación/contenido sin alterar el core ni el modelo de datos.

**No mostrar un flujo como terminado si su evidencia es solamente una prueba con API simulada.**

## 7. Fuentes y riesgos

Fuentes revisadas: [`src/site.ts`](https://github.com/keneth4/climbing-lab/blob/416eb32a1205287c3d96b8a3842eb1d0ca08f625/src/site.ts), [`src/App.svelte`](https://github.com/keneth4/climbing-lab/blob/416eb32a1205287c3d96b8a3842eb1d0ca08f625/src/App.svelte), [`src/auth.ts`](https://github.com/keneth4/climbing-lab/blob/416eb32a1205287c3d96b8a3842eb1d0ca08f625/src/auth.ts), [`scripts/seed-local.mjs`](https://github.com/keneth4/climbing-lab/blob/416eb32a1205287c3d96b8a3842eb1d0ca08f625/scripts/seed-local.mjs), [`tests/site.spec.ts`](https://github.com/keneth4/climbing-lab/blob/416eb32a1205287c3d96b8a3842eb1d0ca08f625/tests/site.spec.ts), [`docs/implementacion.md`](../implementacion.md), [`docs/continuacion-integral.md`](../continuacion-integral.md), [`docs/piloto-remoto.md`](../piloto-remoto.md), [`docs/validacion-formatos-dispositivos.md`](../validacion-formatos-dispositivos.md).

**Riesgos a vigilar:** fixtures sin validación de publicación, borrar D1 equivocada, tokens/cuentas de prueba expuestos, mezclar marca con permiso, performance ficticio de 3D, archivos R2 sin backup, declaración prematura de readiness y divergencia de capas individuales respecto del demo canónico.

**Estado de este documento:** plan listo para implementación, **sin cambios de aplicación**, sin fixtures implementados y sin ejecución de tests en esta tarea.
