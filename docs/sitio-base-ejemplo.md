# Sitio base para un gimnasio de ejemplo

13 de octubre de 2026. Entrega local; sin despliegue ni migraciones nuevas.

## Comparación con la auditoría de oportunidades

Se leyó la [auditoría UX/UI multigimnasio](https://github.com/keneth4/climbing-lab/blob/docs/auditoria-ux-ui-multigimnasio/docs/ux/01-auditoria-oportunidades.md), archivo GitHub SHA `05ffa9d7021be28442a4db466e7c8e30868a01c3`. Revisa `6fce9a7b2f70`, por lo que sus afirmaciones sobre API desconectada, autenticación ausente y visor exclusivamente local no corresponden al estado actual. La comparación usa el código local y complementa la [matriz original de 36 hallazgos](auditoria-ux-implementacion.md); los dos documentos tienen numeraciones diferentes.

| Hallazgo nuevo | Estado local | Evidencia y límite |
| --- | --- | --- |
| UX-01 Sitio público del gimnasio | Resuelto para el ejemplo | Inicio, Rutas, El gimnasio, FAQ y acceso a cuenta. Contenido explícitamente ficticio; sin inventar datos para visitas/contacto. |
| UX-02 Público, cuenta y staff | Resuelto para el ejemplo | Navegaciones separadas. Permisos de backend existentes; sin selector de rol demo. Operaciones comerciales conservadas fuera del menú público principal. |
| UX-03 Personalización sistemática | Parcial / expansión multigimnasio | Configuración versionada, tokens, dos temas y atribución común. No se han construido ni probado tres marcas. |
| UX-04 App y API | Resuelto localmente | Cliente autenticado, D1/R2, estados de operación e historial ya conectados. El sitio editorial no cambia bindings ni autorización. |
| UX-05 Ruta 3D y degradación | Parcial / validación física | Capturas publicadas, imagen por revisión, visor opcional y fallbacks existentes. Queda verificar primer render útil y rendimiento de escenas reales en teléfonos. |
| UX-06 Público a cuenta | Resuelto localmente | Retorno al detalle y borrador tras login; guardado privado con feedback e idempotencia. |
| UX-07 Mobile-first | Resuelto en QA local / validación física | Ficha separada, tarjetas, filtros plegables y jerarquía propia. QA 320/390/768/1024/1440; falta prueba presencial. |
| UX-08 Búsqueda y filtros | Resuelto localmente | Nombre/sector sin acentos, escala/rango, conteos, chips, limpieza, URLs y vacíos con recuperación. No hay ficha implícita fuera de resultados. |
| UX-09 Jerarquía y estados | Resuelto localmente | Identidad, estado/revisión e imagen antes del visor; compartir/reportar progresivos; enlace histórico estable. |
| UX-10 Interacción equivalente del visor | Parcial / validación física | Botones, teclado, orbitar/desplazar y pinza implementados. Gestos/lector y precisión de agarres pendientes en equipos reales. |
| UX-11 Accesibilidad | Parcial / validación física | Semántica, foco, títulos, salto al contenido, mensajes asociados y 44 px. QA teclado y reflow/zoom; no se declara conformidad WCAG completa ni revisión con lector. |
| UX-12 Feedback y prevención | Resuelto localmente | Estados por formulario, conservación de borrador, reintentos e idempotencia; publicación/retiro auditados. |
| UX-13 Flujo editorial staff | Parcial / validación física | Bandeja de rutas, borradores, cámara/agarres, preview/publicación y reportes. Falta validar reconocimiento de agarres y protocolo operativo con staff. |
| UX-14 Compartibles de marca | Resuelto para el ejemplo / expansión multigimnasio | Encabezado, acceso, pie, tarjetas 3D/estáticas y QR imprimibles usan la identidad común. Privacidad y snapshot conservados. No se validan exportaciones de tres marcas. |
| UX-15 Calidad perceptual | Parcial / validación física | Regresiones, capturas de ambos temas y tamaños, interacción, foco, errores y reflow. No hay certificación de accesibilidad ni datos de teléfonos reales. |
| UX-16 Contenido y SEO | Parcial / pendiente | Contenido editorial versionado, títulos por vista y descripción base. CMS, indexación por dominio, sitemap, OG y datos oficiales de negocio pendientes. |
| UX-17 Personalización avanzada | Expansión multigimnasio | Un contrato editorial y dos temas; variantes de portada/tercer sitio y CMS se posponen. |

“Resuelto localmente” describe comportamiento implementado y probado, no aprobación del piloto presencial.

## Contrato y navegación

`src/site.ts` contiene `GymSiteConfig` versión 1, validado por TypeScript: nombre, subtítulo, tema inicial, atribución, portada, aviso ilustrativo y FAQ. Es contenido fijo revisable en el repositorio, sin HTML/JS inyectado ni endpoint de edición. No incluye credenciales ni un selector de tenant. `/api/config` conserva moneda/zona horaria para las operaciones existentes; la identidad editorial no concede permisos.

- `/` abre Inicio; `?vista=Inicio` también funciona.
- `?vista=Catálogo` y `?vista=Rutas` abren Rutas; enlaces de filtros como `?orden=recientes` siguen abriendo catálogo.
- `?ruta=ID` conserva el destino de los QR y abre detalle, incluso si la ruta está retirada.
- Cuenta mantiene `?vista=Cuenta`, `?vista=Bitácora` y `?vista=Proyectos`; staff mantiene `?vista=Staff`, `?vista=Capturas` y `?vista=Recepción`, con autorización existente.
- Filtros se reflejan en URL y sobreviven recarga; Atrás/Adelante conserva selección y posición. Navegar a Inicio limpia los filtros de esa URL, conservándolos en la sesión del catálogo.

`SiteHeader`, `SitePublic`, `SiteFooter` y `RouteCatalog` extraen presentación de `App.svelte`. Estado de auth, ownership, borradores y mutaciones continúa en los servicios existentes. `RouteThumbnail` maneja fallo de imagen sin bloquear selección. El runtime 3D sigue compartido y bajo demanda.

## Validación y límites

Pruebas de sitio: Inicio → Rutas → buscar/chips → vacío/limpieza → ficha → FAQ → cuenta, ambos temas y cinco anchos; enlaces heredados, filtros, Atrás/Adelante, ruta retirada, inválida y recuperación de catálogo. Teclado, foco, escala CSS 2× y reflow. Capturas en `/tmp/climbing-site-*`, fuera del repositorio. Datos e identidad de QA son simulados; no se escriben registros reales.

Se conservan las regresiones existentes de actividad, privacidad, doble envío, publicación y capturas. Los pasos de entrada de las pruebas ahora abren explícitamente catálogo o detalle y pasan por la navegación agrupada, sin eliminar sus verificaciones de dominio.

Pendientes: primer render realmente útil, precisión/oclusión de marcadores, teléfonos y capturas reales, lector de pantalla, tareas moderadas y datos oficiales de un gimnasio. El [protocolo físico y de formatos](validacion-formatos-dispositivos.md) sigue siendo requisito para abrir el piloto.

### Resultados de esta entrega

- Tipos frontend/backend, formato y build: aprobados. Se conserva el aviso de tamaño del chunk de PlayCanvas; no se afirma rendimiento móvil a partir del build.
- Dominio/frontend: 19 pruebas aprobadas. Worker/API: 45 aprobadas en runtime local aislado.
- Navegador: 40 pruebas de la suite completa aprobadas, más las cuatro verificaciones nuevas de retorno de login y recuperación de contraseña aprobadas en desktop/móvil. La recuperación sigue disponible para una sesión autenticada de restablecimiento.
- Revisión adicional contra la API local existente: Inicio → Rutas, tres rutas consultables, títulos correctos, sin overlay, sin overflow ni errores de consola. Se añadió favicon para evitar una solicitud 404 incidental del navegador.
- Browser plugin no disponible; se utilizó Playwright con Chrome instalado. Capturas revisadas de portada desktop, portada móvil cálida y catálogo local.
