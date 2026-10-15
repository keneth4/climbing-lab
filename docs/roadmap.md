# Roadmap — Climbing Lab canónico y demo de un gimnasio

**Actualización:** 13 de octubre de 2026 (nueva revisión del estado de `main`).  
**Código revisado:** [`main@416eb32a1205`](https://github.com/keneth4/climbing-lab/commit/416eb32a1205287c3d96b8a3842eb1d0ca08f625).  
**Siguiente plan ejecutable:** [Demo integral reproducible de un gimnasio](planes/2026-10-demo-integral-siguiente.md).  
**Naturaleza de la revisión:** lectura de repositorio, documentación, interfaces, scripts y tests existentes. No se ejecutaron aquí pruebas de navegador, dispositivos ni un despliegue.

> **Esta sección es la referencia vigente de prioridades.** El [plan de demo anterior](planes/2026-10-demo-web-canonico.md) documenta una etapa histórica (`main@6fce9a7`): no ejecutar sus pasos iniciales como si API, login, sitio público, editor y bitácora siguieran pendientes. Los cierres de desarrollos anteriores permanecen en el historial Git de este archivo y sus documentos especializados.

## 1. Objetivo de producto confirmado

**Primero un sitio completo, útil y visualmente digno de UN gimnasio de ejemplo.** Debe existir y mantenerse como la **implementación canónica** de la plataforma: referencia funcional, de componentes, UX/UI, accesibilidad, pruebas y correcciones. No se necesita publicar tres gimnasios ni diseñar tres marcas para demostrarlo.

**Después de estabilizar el ejemplo funcional**, crear cada diseño particular como trabajo independiente sobre la misma plataforma; los sitios de los tres gimnasios pueden variar significativamente de composición y marca, pero no deben duplicar la lógica común. Una corrección del core se aplica a la base canónica y se verifica en cada sitio particular.

### Límites de la arquitectura

- **Un frontend visible ahora:** gimnasio ficticio/de ejemplo, con aviso inequívoco y sin dirección, precios, horarios o credenciales inventadas de un negocio real.
- **Preparado para más gimnasios:** IDs y contratos de dominio compatibles, permisos por gimnasio, pruebas A/B y migraciones compartidas. Mantener un sitio visible **no** impide que existan más gimnasios en el modelo ni en ambientes de pruebas.
- **Aislamiento actual:** según [ADR-0001](decisiones/0001-backend-cloudflare.md), **un Worker, una D1 y un R2 por gimnasio**. «Más gimnasios en DB» NO significa mezclar los datos de los tres en la misma D1; un cambio de estrategia exige ADR de migración y seguridad. El navegador no selecciona el binding por una variable de cliente.
- **Identidad y código comunes; datos y permisos locales:** Supabase Auth es la identidad compartida integrada; la autorización de staff/admin procede del Worker y D1 correspondiente. Un staff de A no hereda permisos de B/C.
- **Fuente canónica permanente:** el gimnasio demo sigue ejecutándose y pasando QA después de lanzar los diseños individuales.

## 2. Estado REAL del repositorio al revisar `main`

| Componente/capacidad | Evidencia vigente | Estado |
| --- | --- | --- |
| Sitio público | `src/site.ts`, `SiteHeader.svelte`, `SitePublic.svelte`, `RouteCatalog.svelte`; Inicio, Rutas, El gimnasio y FAQ | **Implementado localmente**; contenido ficticio |
| Navegación/UX | ficha independiente, filtros/URL, dos temas, estados, fallback de imagen, responsive | **Implementado localmente**; QA físico pendiente |
| API, sesiones y permisos | `src/auth.ts`, `worker/index.ts`; Supabase Auth, D1/R2 y roles locales | **Integrado localmente**; falta smoke remoto sin mocks |
| Rutas/3D | `RouteEditor`, `CaptureManager`, `SplatRuntime`, capturas/secciones/revisiones, agarres 3D, cámaras | **Implementado localmente**; precisión/rendimiento físico pendientes |
| Bitácora/compartir | fecha de actividad, edición/retiro e historial, CSV, proyectos, tarjetas PNG históricas y QR | **Implementado localmente** |
| Staff | borradores, publicar/retirar, reportes, capturas, cambios auditados | **Implementado localmente** |
| Operación gimnasio | socios/visitas QR, planes, cobros manuales, dashboard, inventario y ventas manuales | **Implementado localmente**; no apto aún para dinero real |
| Video | barrido experimental de seis segundos y descarga compatible | **Implementado localmente**; no prometer compatibilidad universal |
| QA automática | scripts `check`, `check:api`, `test`, `test:api`, `test:e2e`, `build`; pruebas de dos gimnasios | **Suites presentes**; resultados documentados, no reejecutados en esta revisión |
| Demo con datos útiles | `scripts/seed-local.mjs` solo inserta una ruta heredada simple por gimnasio (sin captura, sector/agarres completos ni imagen) | **Brecha real de demostración** |
| Publicación accesible | `wrangler.pilot.example.json`, `scripts/pilot.mjs`, runbook | **Preparado documentalmente; NO publicado** |
| Validación en campo | Crux real probado en escritorio local; faltan segundo splat, teléfonos físicos, QR impreso, lector, red remota | **Pendiente** |

**Documentación de fuente:** [implementación](implementacion.md), [sitio de ejemplo](sitio-base-ejemplo.md), [continuación integral](continuacion-integral.md), [matriz UX](auditoria-ux-implementacion.md), [piloto remoto](piloto-remoto.md), [medición de formatos](validacion-formatos-dispositivos.md). Los cierres «locales» no certifican funcionamiento en el servicio publicado ni con usuarios reales.

### Implicación inmediata

No reiniciar D0–D3 del plan anterior: **API ↔ frontend, autenticación, portada, editor, visor, proyectos y módulos de gestión ya existen**. El siguiente trabajo es hacer que todo ello sea fácil de montar, mostrar y evaluar con datos coherentes, sin mocks ni dependencias innecesarias durante la demo local.

## 3. Definiciones de terminado: no confundir cuatro estados

| Nivel | Qué demuestra | Condición de cierre |
| --- | --- | --- |
| **L0 — Demo local integral** | Un operador instala/arranca el gimnasio ficticio con datos coherentes y muestra recorridos principales | Setup y reset seguros, catálogo real D1, poster/3D disponible o fallback honesto, scripts de verificación y guion; no depende de interceptar API con mocks |
| **L1 — Demo web compartible** | Visitante abre una URL pública del único gimnasio ejemplo en teléfono externo | Frontend/API/asset publicados, DNS/HTTPS, QR correcto, lectura anónima y estados de error comprobados; no requiere cuenta de visitante |
| **L2 — Demo interactiva controlada** | Escalador y staff prueban acciones persistentes desde URL real | Auth/callbacks, roles, D1/R2, medidas antiabuso, aislamiento, backup+restore y cuentas de prueba autorizadas; ninguna operación financiera real |
| **L3 — Base canónica lista para especialización** | UX y operación estables para adoptar como referencia permanente | QA física/lector, escena real en varios equipos, errores corregidos, regresión visual/funcional y contrato de extensiones de presentación documentado |
| **P — Sitios particulares** | Tres gimnasios diferenciados visualmente sobre el core estable | Trabajos independientes de marca, contenido/variantes y despliegue con regresiones del core; cada uno mantiene sus propios datos |

**Primera meta del siguiente feature: L0.** Trabajar en preparación de L1 simultáneamente, pero **no afirmar L1/L2** sin recursos remotos y evidencias reales. L0 puede usar una captura de demostración autorizada; si falta, mostrar fallback y declarar la limitación.

## 4. Prioridades restantes, en orden de retorno

| Prioridad | Trabajo concreto y alcance | Qué se puede avanzar hoy | Dependencias |
| --- | --- | --- | --- |
| **P0-A** | **Dataset curado y bootstrap reproducible** para un gimnasio ejemplo: rutas, sectores, grados, revisiones, portada, fotos/posters permitidos, staff de prueba controlado, estados útiles | **Sí, sin recursos cloud**: fixtures seguros, migraciones locales, scripts de setup/reset, dataset y e2e integrados | Ninguna externa; assets reales solo con permiso |
| **P0-B** | **Guion y modo de exhibición responsable:** rutas destacadas, estados coherentes, instrucciones de arranque, fallbacks, avisos de datos ficticios; que nada parezca vacío o roto | **Sí**: presentación y estados sobre componentes actuales; no rediseñar la app | P0-A |
| **P0-C** | **Pruebas sin mocks de flujo real local** (Vite → Worker → D1/R2) y regresiones UX; automatizar smoke de portada, catálogo, QR, sesión si está disponible, staff autorizado | **Sí**: API pública, seed, 3D mock-free si hay asset local apropiado; tareas privadas requieren auth real o harness aislado | P0-A; credenciales controladas para pruebas humanas |
| **P1-A** | **Staging público de un único gimnasio ejemplo**, Worker+Static Assets+D1+R2, origen, callbacks, semillas seguras, dominio, demo URL, backup/restauración | Preparar automatización/config sin desplegar ni cobrar | Cloudflare R2 habilitado, cuenta/DNS, identidad/roles y contenido publicable |
| **P1-B** | **QA física y rendimiento real:** Android/iPhone, Crux, segunda captura, lectura de agarres, red móvil, QR impreso y accesibilidad | Preparar protocolo, métricas y matriz; desktop existente como baseline | Dispositivos/capturas y acceso presencial |
| **P1-C** | **Endurecer para cuentas reales:** limites, rate limiting, rollback, auditoría, restore D1+R2, errores de sesión, monitoreo | Código/scripts y tests; no certificar remoto sin prueba | Recursos y sesiones reales |
| **P2-A** | Ajustes ergonómicos del editor: gizmos, plano libre, oclusión/precisión, LOD/streaming | Prototipos y pruebas controladas | Evidencia de escena/dispositivos que justifique costo |
| **P2-B** | Mejoras del core/comercial: operaciones, vídeo, checkouts/pagos, nuevas utilidades | Planificación separada; preservar lo ya implementado | Alcance, reglas de negocio y seguridad |
| **P3** | Marcas particulares A/B/C | Solo diseñar contrato de extensión y pruebas ahora | Cierre L3, identidad y materiales de cada gimnasio |

**No crear un segundo catálogo, login, editor, sistema de proyectos o gestión de socios.** Mejorar o reparar el componente existente en su sitio.

## 5. Plan de siguiente entrega aprobado para planificación

**Feature propuesto:** `feat/demo-integral-canonico`.  
**Documento ejecutable:** [`docs/planes/2026-10-demo-integral-siguiente.md`](planes/2026-10-demo-integral-siguiente.md).

Secuencia de implementación sugerida:

1. **D01 — Definición de demo y datos:** inventario de rutas/sectores/estados, fixtures versionados, identidad del ejemplo, seed idempotente. No usar información no autorizada de gimnasios reales.
2. **D02 — Bootstrap aislado:** un comando de preparación, arranque y verificación, sin borrar bases locales existentes; A/B conservan aislamiento y migraciones. Documentar reset seguro.
3. **D03 — Recorrido de visitante sin mocks:** Inicio → Rutas → filtro → detalle → beta/imagen → visor bajo demanda si hay asset → QR URL correcta; estados de carga/error y móvil.
4. **D04 — Recorrido de escalador/staff real:** cuenta/bitácora/proyectos/reportes, editor/publicación y revisiones sobre API persistente; auth real y rol local solo en entorno privado/controlado. Sin bypass de permisos.
5. **D05 — Presentación y puerta de salida:** e2e integrado, script smoke, capturas desktop/mobile, guion, checklist para staging remoto, resultados honestos y vínculo a QA físico.

### Criterio de aceptación general de L0

`npm ci` + migraciones/seed/arranque documentados deben permitir reproducir **una historia completa de rutas del mismo gimnasio**: una ruta activa visible, una retirada histórica y otra apta para editar/publicar, con grados/sectores/beta legibles; usuario sin sesión puede consultar; ruta seleccionada tiene imagen o estado de fallback claro; QR abre la misma ruta; staff autorizado no es reemplazado por un toggle; escrituras en D1 quedan registradas y no cruzan a B. Si hay escena permitida, debe asociarse correctamente a la captura y no presentarse como rendimiento móvil validado.

## 6. Independencia entre core canónico y futuro diseño por sitio

**Establecer límites hoy, no tres implementaciones hoy:**

```text
climbing-lab (repositorio y versión canónica)
├── lógica y servicios compartidos: dominio, API, auth, visor, flujos
├── componentes/estados/accesibilidad compartidos
├── demo canónico: un tema neutro + contenido del gimnasio ficticio
└── interfaz de extensiones de presentación (progresiva)
    ├── futuro sitio A: marca, contenido, composición y assets A
    ├── futuro sitio B: marca, contenido, composición y assets B
    └── futuro sitio C: marca, contenido, composición y assets C
```

- **No forks ni ramas permanentes de producto por gimnasio.** Preferir paquetes/módulos o carpetas de sitios versionados, con PR de diseño por sitio; el core se actualiza centralmente. Monorepo o distribución en paquetes se decidirá al integrar el **primer diseño real**, no como refactor anticipado.
- **Diferenciación visual significativa:** tokens, tipografías, imágenes, secciones, layouts/slots y componentes de presentación intercambiables; no permitir copiar lógica, endpoints, permisos o estados de negocio.
- **Contrato mínimo:** `GymSiteConfig` v1 existente en `src/site.ts`, dos temas de muestra; extraer dependencias de marca en exportaciones y shell según necesidades reales. Cambios al contrato deben versionarse y tener pruebas de retrocompatibilidad; no desarrollar CMS drag-and-drop ahora.
- **Pruebas comunes:** mantener demo canónico como referencia de historias críticas y añadir regresiones por sitio/tema cuando A/B/C existan.
- **Despliegues separados:** publicar solo una instancia demo ahora. A/B/C futuros con bindings/D1/R2/domino propios según ADR; usuario o frontend nunca elige otro gimnasio para una operación.

## 7. Puertas, dependencias externas y calidad

### Se puede avanzar independientemente

Crear fixtures, scripts, documentación de instalación, tests con API/D1/R2 locales, smoke, demo narrativa y arreglos de estados/visibilidad, mejoras de accesibilidad verificables y versión de tema demo. **No se necesita esperar los tres gimnasios**.

### Bloqueadores de demo pública y piloto real

- Recursos y condiciones de Cloudflare/R2, DNS/URL y configuración real del Worker/D1; no reutilizar placeholders locales.
- Callback/origen de Supabase y cuentas autorizadas para escenarios privados; scripts de seed **nunca** fabrican JWT ni privilegios públicos.
- Captura real autorizada (Crux u otra), segundo splat para continuidad y poster/thumbnail cuya licencia permita publicarlo.
- Android/iPhone físicos, red representativa, validación de agarres desde dos ángulos, QR impreso, lectores de pantalla y tareas de visitantes/staff.
- Backups **D1 + archivos R2**, restauración remota aislada, límites y controles operativos. No usar dinero ni datos personales reales en demo sin aprobación.

### Checklist de calidad

- Tests: `npm run check`, `npm run check:api`, `npm run format:check`, `npm test`, `npm run test:api`, `npm run build`, `npm run test:e2e` y smoke integrado adicional.
- 320/390/768/1440 px, teclado, estados sin JS de 3D, cargas lentas, error de red, 401/403, ruta inexistente/retirada y privacidad de exportación.
- Objetivo WCAG 2.2 AA sujeto a revisión manual; las pruebas automatizadas **no** certifican cumplimiento.
- Rendimiento GPU, LOD, formatos y bytes hasta vista útil se decidirán **tras medidas**, según [protocolo](validacion-formatos-dispositivos.md), no por promesas del prototipo.
- Guion completo con datos **ficticios** y captura/escena **autorizada**; ningún ingreso, socio o credencial de producción alterado.

## 8. Trabajo con Codex y control de cambios

1. Para cada feature técnico, crear **rama nueva desde `main` actualizado** (no desde rama del gimnasio A/B/C ni desde auditorías antiguas).
2. Mantener **un documento Markdown de planificación por commit documental** cuando la planificación se divida; después commits pequeños de implementación que correspondan a tareas/aceptación.
3. Cada commit debe declarar qué implementa y qué verifica. No marcar etapas «listas» por pruebas interceptadas únicamente.
4. Abrir PR a `main` con cambios, evidencias y pendientes. Actualizar el roadmap al cerrar una etapa; el core canónico conserva ejemplos y smoke.
5. Los diseños particulares futuros tendrán PRs independientes y dependencias explícitas sobre la versión del core, sin duplicar servicios.

## 9. Fuentes y decisiones a consultar

- [Sitio base y auditoría de 17 hallazgos](sitio-base-ejemplo.md)
- [Matriz UX/UI y 36 hallazgos](auditoria-ux-implementacion.md)
- [Implementación local actual](implementacion.md)
- [Continuación integral](continuacion-integral.md)
- [Piloto remoto y dependencias](piloto-remoto.md)
- [Validación de formatos/dispositivos](validacion-formatos-dispositivos.md)
- [Producto](producto.md), [piloto](piloto.md), [interfaz](interfaz-base.md), [modelo](modelo-de-datos.md)
- [ADR Cloudflare](decisiones/0001-backend-cloudflare.md)
- [Plan histórico de demo](planes/2026-10-demo-web-canonico.md) — **no usar como inventario vigente**
- [Versión histórica de este roadmap antes de corregir prioridades](https://github.com/keneth4/climbing-lab/blob/416eb32a1205287c3d96b8a3842eb1d0ca08f625/docs/roadmap.md)

**Resultado de producto buscado:** una URL y un repositorio que siempre demuestren cómo funciona **Climbing Lab para un gimnasio**, mientras las futuras personalizaciones de tres marcas se desarrollan y despliegan por separado, heredando correcciones del core.

## Entrega local integral — 13 de octubre de 2026

D01–D03 y preparación D05 implementados en `codex/demo-integral-canonico`: dataset aislado, bootstrap/reset y lectura pública real D1/R2. [Runbook y evidencias](demo-local.md). D04 sigue pendiente de cuentas autorizadas y captura para publicación completa; L1–L3 siguen pendientes. No reiniciar módulos existentes ni afirmar despliegue/validación física.

### Continuación UX-P0 — 14 de octubre de 2026

UX-P0 implementado y probado localmente en el PR #3: marcadores legibles y edición reversible, sin cambiar API ni geometría de secciones. [Evidencia por nivel](planes/ux/01-editor-espacial-y-tour-3d.md#12-entrega-ux-p0--14-de-octubre-de-2026). Crux está publicada solo en el demo local y la ruta D04 sigue como borrador: revisión humana de agarres y recorridos privados entre cuentas pendientes. D04 y L1–L3 no se consideran completos; UX-P1/P2 se mantienen separados.

### Preparación del cierre D04

Helper de sesiones Firefox y verificador privado opt-in implementados, con destino gym-demo y precondiciones antes de escritura. [Runbook](demo-local.md#verificador-privado-preparado-14-de-octubre-de-2026). Prueba manual favorable del propietario sobre precisión inicial del picking registrada. No hay segunda cuenta; ejecución privada, revisión/publicación de la ruta y validación física siguen pendientes. D04 permanece abierto; no se adelanta UX-P1A ni se despliega.

### Publicación de la ruta D04

Tras confirmación humana del propietario, la ruta Crux quedó publicada exclusivamente en el demo local, revisión 4, con nueve agarres, cámara y PNG anotado. Lectura anónima y smoke público real aprobados. D04 continúa abierto por segunda cuenta y recorrido privado real; L1–L3 y validación física pendientes.

### Cierre funcional D04 local

Dos cuentas reales verificadas en el navegador interno completaron proyecto/actividad persistente, privacidad, permisos, reporte y revisiones históricas. Ruta Crux original activa en revisión 4; copia de prueba retirada e historia conservada. [Evidencia actual](planes/demo-integral/04-recorrido-cuenta-y-staff.md#cierre-funcional-real--14-de-octubre-de-2026). Los estados anteriores son cronológicos: D04 ya no depende de una segunda cuenta. L0 funcional local verificado; L1–L3 y validación física pendientes. Próxima entrega de interfaz: UX-P1A, sin adelantar tour ni despliegue.


### UX-P1A — Editor guiado implementado localmente

Seis pasos, preparación local de rutas publicadas, revisión de diferencias, errores por paso y panel móvil accesible implementados en `codex/route-editor-guided-ux`, para PR independiente a main. [Entrega y evidencia](planes/ux/02-flujo-editor-rutas.md#entrega-y-evidencia-local--14-de-octubre-de-2026): 76 e2e y 6 smoke públicos reales aprobados, además de tipos, dominio/API y build. Crux y la ruta D04 original permanecen intactas; sin migraciones, reset, merge ni despliegue. Las etapas posteriores de UX siguen separadas; teléfonos, lector y rendimiento físico pendientes.

### UX-P1B — Zonas y planos inclinados implementados localmente

PR #4 de UX-P1A integrado en main; UX-P1B desarrollado en `codex/section-editor-oriented-geometry` para PR independiente. [Entrega y evidencia](planes/ux/03-zonas-planos-inclinados.md): editor de cuatro pasos, geometría orientada compatible, edición reversible, conflictos y referencias históricas conservadas incluso al editar rutas. Tipos, formato, build, 32 pruebas frontend, 51 API, 4 controles demo, 88 e2e y 6 smoke públicos aprobados. Sin migraciones SQL, reset ni despliegue; ruta/sección D04 originales intactas. Delimitación humana de una zona nueva en Crux y validación física pendientes. UX-P2A sigue condicionada a pruebas con setters; UX-P2B/tour continúa como feature independiente.
