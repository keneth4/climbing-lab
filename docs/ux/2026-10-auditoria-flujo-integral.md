# Auditoría integral de experiencia y propuesta de evolución UX/UI — Climbing Lab

**Revisión:** 14 de octubre de 2026.  
**Referencia de código:** [`main@5a334b395dfb`](https://github.com/keneth4/climbing-lab/commit/5a334b395dfbf8627448ae0f120962e21f5be603) (PR #6 «UX-P2B: recorrido virtual por paradas y publicación versionada» integrado).  
**Naturaleza:** investigación estática de código, flujos y documentación, más referencias públicas sobre patrones de UX; **sin capturas de una nueva ejecución de navegador, sin sesiones reales ni tests reejecutados en esta auditoría**.  
**Decisión de producto:** un gimnasio ficticio de ejemplo **canónico** ahora; lógica compartida y diseños de tres gimnasios **después**, con datos/Workers/D1/R2 separados conforme a ADR-0001.  
**Estado del documento:** propuesta para priorizar, **NO aceptación de cambios de producto**, ni informe de cumplimiento WCAG.

> **Fuente de verdad:** los apartados cronológicos al final de [roadmap](../roadmap.md) describen la implementación reciente. La cabecera del roadmap todavía se refiere a un commit anterior y conserva tareas ahora completadas: no reiniciar D01–D04, UX-P0, UX-P1A, UX-P1B o UX-P2B. En esta revisión D04 está cerrado **localmente** y la creación/exploración del tour *Main Gym* fue aceptada sobre Crux local; L1–L3 y validación física siguen abiertas.

## 1. Síntesis ejecutiva

**El proyecto ha cruzado la etapa de probar herramientas aisladas.** Ya existen navegación pública, catálogo, detalle con visor y QR, cuentas, bitácora, proyectos, reportes, edición de ruta en seis pasos, secciones con plano inclinado, captura/revisiones, recorrido virtual publicado localmente, recepción, socios, planes, cobros manuales e inventario. El riesgo principal se desplaza hacia **encontrar las acciones, comprender sus consecuencias, conservar trabajo y operar con fiabilidad en un gimnasio real**.

Tres decisiones de orden de trabajo:

1. **Validar tareas reales antes de sumar complejidad:** en especial setter móvil, recepción, tour, escaneo QR, imágenes reales y rendimiento de Crux.
2. **Mejorar continuidad transversal antes que estética de tres marcas:** hacer que visitante, escalador, staff y admin encuentren una experiencia consistente, con nombres/estados/avisos comprensibles.
3. **Desplegar un solo ejemplo controlado y estable antes de habilitar dinero/socios reales:** restauración conjunta D1/R2, sesiones, origen, permiso, antifraude/antiabuso y observabilidad.

### Lo que NO recomendamos reimplementar

- Autenticación Supabase ni permisos locales ya integrados.
- Editor guiado de seis pasos, ancla-líder-etiqueta de agarres, geometría orientada o paradas del tour ya integradas.
- Nueva instancia 3D por herramienta o parada.
- Tres frontends, tres forks, CMS libre, rediseños independientes antes de L3.
- Checkout/competiciones/comunidad global antes de cerrar tareas presenciales del gimnasio.

## 2. Recorridos del producto y lectura de su salud

| Recorrido actual | Entrada y secuencia | Salud *según código* | Próxima prueba que falta |
| --- | --- | --- | --- |
| V1: persona nueva | Inicio → El gimnasio/FAQ → Recorrido o Rutas | Funcional en sitio ficticio; datos de visita no modelados todavía en configuración editorial | ¿Entiende qué ofrece, cómo visitar y qué son rutas/3D? |
| V2: descubrir problema | Rutas → buscar/filtrar → ficha → imagen/beta → 3D opcional | Buena base y fallback; búsqueda/listado se cargan completos, falta orientación espacial editorial | Hallar una ruta concreta sin explicación |
| V3: QR en pared | URL `?ruta=...` → ficha → inicio/final → registrar | Enlace estable; riesgo de distancia entre el agarre físico y su representación 3D | QR impreso, iluminación y móvil ajeno |
| V4: tour virtual | Inicio → Recorrer gimnasio → paradas/posters → 3D → zona/ruta | Publicación local de 3 paradas comprobada; falta descubrimiento y validación física | Usuarios sin experiencia en 3D |
| C1: cuenta | Ficha → iniciar sesión → volver → registrar → bitácora | Retorno a ruta y persistencia local comprobados; formulario siempre largo | ¿Puede registrar con una mano en gimnasio? |
| C2: progreso | Bitácora → resumen/filtros → proyectos/CSV/tarjeta | Completo funcionalmente; dos lugares de proyectos y controles técnicos elevan fricción | Consultar «qué me falta» y progreso semanal |
| C3: reporte | Ficha → Reportar → staff toma/resuelve → Mi reportes | API/permisos existen; descubribilidad de respuesta y cierre del circuito mejorables | Escalador encuentra resolución y sabe qué hacer |
| S1: preparación captura | Staff → Capturas → cámara/sección → publicar | Asistentes/volúmenes avanzados; selección aproximada | Setter real con muro inclinado y revisión de profundidad |
| S2: creación ruta | Staff → seis pasos → imagen → publicación | Guiado con undo y revisión; preparación de ruta publicada sigue local en memoria | Crear/corregir ruta 3–8 agarres sin XYZ ni pérdida |
| S3: recorrido staff | Staff → Recorridos → cámaras/imágenes → verificar → publicar | Editor y validaciones robustos; alto esfuerzo de edición de paradas | Setter crea una visita guiada sin asistencia |
| O1: recepción | Recepción → identificar QR → membresía/consumo → confirmar | Seguridad de token y reglas de visita existentes; carga de múltiples secciones | Atender fila, error de QR, persona sin plan |
| O2: comercial | Planes → venta/membresía → cobro → confirmación/anulación | Modelo y auditoría presentes; confirmaciones y estados de operación requieren UX de alto riesgo | Operar sin errores con dinero de prueba |

**Salud** describe revisión estática/registro previo, no una prueba visual recién ejecutada. No hay captura aceptada en este análisis.

## 3. Hallazgos priorizados (con evidencia y acción)

**Prioridad:** P0 = bloquearía piloto público o uso operacional sin mitigación; P1 = mejora de alta frecuencia/impacto para demo canónico; P2 = refinamiento o feature posterior. **Confianza:** alta = comportamiento observable en código; media = riesgo plausible que requiere prueba; baja = hipótesis de producto.

### A. Navegación pública, mensaje y sitio del gimnasio

**A01 — P1 · Alta: la navegación principal no ofrece el tour como destino persistente.**  
Evidencia: `src/SiteHeader.svelte` muestra Inicio, Rutas, El gimnasio, Mi cuenta, Staff; `src/SitePublic.svelte` sí tiene CTA «Recorrer el gimnasio».  
Propuesta: decidir si el tour es un destino de navegación de primera clase o un módulo del Inicio/El gimnasio; para el demo, un acceso **estable** en el menú o una sección visible en portada con poster. Mantener regreso a Rutas y al Inicio.  
Aceptación: visitante encuentra «Recorrido» desde ficha o página interior sin necesitar volver a Inicio; Atrás/Adelante conservan parada.

**A02 — P1 · Alta: tres CTAs compiten en el hero, sin contexto de tarea.**  
Evidencia: `SitePublic.svelte` ofrece Recorrer, Explorar y Conocer en secuencia.  
Propuesta: un primario según propósito del producto (recomendar «Explorar rutas» para escaladores); tour como visual/secundario y «Visítanos» como acción editorial inequívoca. Evitar que 3D se interprete como requisito para consultar.  
Aceptación: pruebas de primer clic encuentran ruta o datos prácticos en una sola decisión.

**A03 — P1 · Alta: configuración editorial insuficiente para sitio real.**  
Evidencia: `src/site.ts` `GymSiteConfig v1` solo cubre marca/subtítulo/tema/headline/FAQ. `SitePublic.svelte` declara explícitamente que horarios, ubicación, servicios, precios y contacto faltan, correctamente para el ficticio.  
Propuesta: `GymSiteConfig v2` opcional/aditivo para ubicación/horarios/servicios/contacto/redes/hero/SEO, con validación y omisión honesta de datos ausentes. Separar editoriales por cliente del `/api/config` de moneda/huso; no usar un CMS arbitrario ahora.  
Aceptación: la portada del demo sigue marcada ficticia, y un sitio futuro puede incluir información confirmada sin modificar lógica de rutas.

**A04 — P2 · Media: contenido de producto y SEO todavía son del prototipo.**  
Evidencia: títulos dinámicos `src/site.ts`, pero no existe estrategia específica documentada para sitemap/meta social/datos estructurados por dominio ni render indexable del contenido público.  
Propuesta: plan de indexación de páginas públicas, títulos/OG/fotos autorizadas, canonical/robots y pruebas de vista compartida; evitar indexar bitácoras, reportes, staff y datos ficticios como negocio real.  
Aceptación: enlaces de ruta/tour muestran preview correcto; contenido privado no aparece en buscadores.

**A05 — P1 · Media: «Productos» se anuncia sin intención comercial clara.**  
Evidencia: `src/SiteFooter.svelte` tiene acceso a Productos; `src/StorePanel.svelte` muestra listado sin compra pública.  
Propuesta: rotular «Productos disponibles» y avisar «Consulta en recepción» mientras no haya compra; nunca simular checkout.  
Aceptación: usuario entiende si puede comprar online o solo consultar.

### B. Catálogo, ficha, QR y uso en la pared

**B01 — P1 · Alta: la ficha/catalogo exponen información interna antes de relevancia física.**  
Evidencia: `RouteCatalog.svelte` muestra «Activa · Revisión N» como metadato importante en cada tarjeta; `App.svelte` repite estado/revisión junto al título.  
Propuesta: priorizar **nombre, grado, sector/zona, imagen y condición**, dejando revisión en «Información de ruta» para visitante; mostrar «Retirada» de forma prominente y mantener identificación histórica.  
Aceptación: distinguir un problema y dónde está en el muro con tarjeta a primera vista.

**B02 — P1 · Alta: zona procedente del tour se muestra como filtro sin nombre.**  
Evidencia: `RouteCatalog.svelte` muestra «Zona seleccionada · quitar filtro» sin resolver `sectionId` a un nombre legible; el tour puede enviar `onZone(section.id)`.  
Propuesta: resolver el nombre de sección/sector y título de la parada de origen; chip «Spray Wall · quitar» y «Volver al recorrido» conservando parada.  
Aceptación: usuario comprende el filtro y puede regresar exactamente al tour.

**B03 — P1 · Media: búsqueda y listado están resueltos totalmente en cliente.**  
Evidencia: `App.svelte` `refreshRoutes()` pagina hasta 10.000 por estado, concatena, filtra/ordena localmente; no paginación/virtualización de tarjetas en UI.  
Propuesta: conservar enfoque mientras haya pocas rutas, instrumentar tamaño/tiempo y prever contratos de búsqueda/paginación/orden en backend si crece catálogo; no implementarlo sin medición. Agregar «N rutas de esta zona» y orden «últimas renovadas» donde haya datos.  
Aceptación: tiempo a listado útil estable con dataset representativo; filtros/historial permanecen al volver.

**B04 — P1 · Media: faltan formas de descubrir rutas por intención.**  
Evidencia: filtros por nombre, grado, sector, zona y escala; la ficha tiene reglas/beta y el modelo no presenta etiquetas de estilo en listado.  
Propuesta: primero chips editoriales «Para empezar», «Recientes», «En mi nivel», «En proyectos», «Esta zona» **solo cuando existan criterios/datos verificados**. Tags de movimientos/estilo se modelan luego con staff y pruebas, no como texto adivinado.  
Aceptación: usuario nuevo encuentra una ruta apropiada sin saber el ID.

**B05 — P1 · Alta: la acción principal de registrar lleva a un formulario considerable.**  
Evidencia: `App.svelte` botón Registrar actividad desplaza a formulario con intentos, resultado, notas, sesión y revisión; `draft` contiene idempotencia.  
Propuesta: flujo de registro rápido (Intento / Ascenso, cantidad por defecto y Guardar); «Añadir detalles» revela notas/fecha para quien las necesite. Mantener borrador, aprobación explícita ante cambio de revisión y operaciones idempotentes.  
Aceptación: registrar intento o ascenso habitual con pocas interacciones desde la ficha, sin pérdida en login/error.

**B06 — P0 para QR público · Alta: QR localhost sirve para demo local, no pared.**  
Evidencia: `App.svelte` avisa explícitamente URL local; `docs/demo-local.md` y `docs/piloto-remoto.md` no acreditan staging.  
Propuesta: separar «Previsualizar QR» de «Imprimir QR público»: el segundo exige origen canónico remoto/HTTPS comprobado, tamaño/contraste/error de carga revisados; un QR local nunca se rotula como listo para impresión.  
Aceptación: teléfono ajeno abre la ficha correcta, sin sesión, en dominio del gimnasio.

**B07 — P1 · Media: la consulta está vinculada a nombres técnicos del visor.**  
Evidencia: `SplatRuntime.svelte` muestra carga de captura, calidad, órbita, FOV y controles especializados.  
Propuesta: modo visitante minimalista («Ver agarres», «Girar», «Volver al encuadre», «Usar imagen») y modo staff completo; guía de gestos breve que desaparece tras el primer uso, accesible nuevamente.  
Aceptación: visitante usa ficha sin interpretar términos 3D; controles avanzados se descubren solo si se requieren.

### C. Recorrido virtual: entrar, explorar y regresar

**C01 — P1 · Alta: el tour tiene lectura y navegación, pero no una estructura visual de elección consolidada.**  
Evidencia: `TourPage.svelte` ofrece poster, Anterior/Siguiente, lista de botones, 3D opcional y vínculos a zona/ruta.  
Propuesta: lista de paradas como **tarjetas con imagen/título** o rail en desktop, y selector compacto + contador en móvil, con un CTA de tour único. Mantener el poster legible incluso con el renderer visible.  
Aceptación: «¿Dónde estoy?» y «¿Cuál sigue?» se contestan desde la UI sin ensayo/error.

**C02 — P1 · Media: ir de tour a catálogo pierde procedencia.**  
Evidencia: `App.svelte` `onRoute()` navega a Catálogo; `onZone()` aplica filtro, pero la navegación pública no muestra un camino específico «Volver a parada X».  
Propuesta: contexto de navegación de ida/vuelta, breadcrumb «Recorrido / Spray Wall / Ruta», conservar parada, scroll/filtros y permitir volver por botón, no solo Atrás.  
Aceptación: persona visita una ruta desde una parada y regresa a la misma cámara/texto sin buscar otra vez.

**C03 — P1 · Media: el visor es opcional, pero falta comprobar movilidad y transiciones con escenas reales.**  
Evidencia: `TourPage.svelte` solicita 3D solo tras botón; cambia pose/FOV; `SplatRuntime` conserva canvas y no carga un splat por parada.  
Propuesta: estados de preparación/entrada/salida consistentes, transición corta o instantánea, `prefers-reduced-motion`, feedback de «Vista 2 de 3». **No** implementar vuelo que atraviese muros ni autoplay antes de probar reconocimiento.  
Aceptación: botón Siguiente siempre funciona, aun con 3D lento/no compatible; cambiar de parada no reinicia la descarga.

**C04 — P2 · Media: el tour puede convertirse en descubrimiento comercial sin convertirse en catálogo duplicado.**  
Propuesta: enlaces explícitos zona→rutas, servicios/área de entrenamiento y CTA de visita en lugares oportunos; evitar hotspots ubicados sobre presas o enlaces sin descripción.  
Aceptación: final de tour ofrece siguiente acción coherente, no callejón sin salida.

### D. Cuentas, progreso, proyectos y reportes

**D01 — P1 · Alta: jerarquía de «Mi cuenta», «Bitácora» y «Proyectos» es inconsistente.**  
Evidencia: `SiteHeader` agrupa tres subvistas; `App.svelte` muestra `ProjectsPanel` tanto en vista «Proyectos» como al comienzo de Bitácora; `ProjectsPanel.svelte` comienza con `<details>` cerrado.  
Propuesta: superficie **«Mi escalada»** con resumen, Actividad y Proyectos diferenciados; no repetir el mismo panel expandible en dos pantallas. Estado vacío con CTA «Explorar rutas»/«Registrar», no un bloque cerrado de controles.  
Aceptación: usuario explica dónde consultar un proyecto y un ascenso en una sola pregunta de navegación.

**D02 — P1 · Alta: paginación de bitácora borra resultados antes de confirmar reemplazo.**  
Evidencia: `JournalControls.svelte` `load()` pone `entries=[]`, `days=[]`, `summary=undefined` y llama `onEntries([])` al empezar.  
Propuesta: mantener datos previos con indicador «Actualizando…», vaciar solo al confirmar consulta exitosa y manejar error/recuperación sin parpadeo; si cambia usuario, **sí** limpiar inmediatamente por privacidad.  
Aceptación: red lenta no hace desaparecer súbitamente historial; identidad ajena nunca persiste.

**D03 — P1 · Media: demasiados controles técnicos de registro/CSV antes de la utilidad diaria.**  
Evidencia: `JournalControls` presenta filtros, estado, resumen, agrupación, paginación y exportaciones dos formatos; `App.svelte` añade privacidad e historial.  
Propuesta: resumen semanal/mes actual + lista cronológica por defecto; filtros avanzados y exportación en menú secundario; indicadores legibles de progreso/proyectos con definiciones inequívocas (registro ≠ visita).  
Aceptación: escalador ve qué hizo recientemente y qué le falta sin abrir secciones de exportación.

**D04 — P1 · Alta: cuenta de uso final expone herramientas administrativas de demo.**  
Evidencia: `App.svelte` en «Mi cuenta» muestra UUID y texto «autorizar tu cuenta en el demo local».  
Propuesta: solo mostrar esa sección en **ambiente de desarrollo demo explícito** a admin/operador; cuenta normal debe mostrar perfil, privacidad, manejo de datos, cierre de sesión y ayuda, sin UUID visible como bloque principal.  
Aceptación: los futuros gimnasios no exponen instrucciones de autorización local al escalador.

**D05 — P1 · Media: reportes propios quedan escondidos y no enseñan seguimiento.**  
Evidencia: `src/MyReports.svelte` empieza con `<details>` cerrado y lista status/resolution sin navegación a la ruta.  
Propuesta: una vista/bloque «Mis reportes» con cantidad pendientes/resueltos, enlaces a ruta, respuesta y estado de seguimiento; aviso de incidente «agarre suelto» exige acudir físicamente al staff.  
Aceptación: usuario localiza estado y resolución del último reporte sin recordar dónde estaba el acordeón.

### E. Staff, rutas, secciones y medios

**E01 — P1 · Alta: la entrada al staff no está centrada en cola de trabajo.**  
Evidencia: `App.svelte` sección Staff muestra primero `PilotMetrics`, un editor nuevo de seis pasos, luego listas de rutas y finalmente reportes.  
Propuesta: **Dashboard de tareas**: «Reportes urgentes», «Borradores pendientes», «Rutas activas/retiradas», «Captura vigente», «Tour vigente», CTA «Crear ruta». El editor se abre solo cuando se pide.  
Aceptación: setter resuelve reporte o encuentra borrador sin recorrer editor vacío.

**E02 — P1 · Alta: los cambios de ruta publicada existen solo como preparación local hasta guardar/publicar.**  
Evidencia: `RouteEditor.svelte` muestra botón «Conservar preparación local» y aviso «recargar puede perderla». `TourManager` tiene persistencia de borrador más explícita, pero cambios no guardados también pueden perderse.  
Propuesta: guardado de borrador de nueva revisión **privado y versionado en servidor**, con `expectedRevision`, owner y caducidad/limpieza; preservar lo público mientras no haya publicación. Como mínimo, confirmación visible antes de cerrar, cadencia de guardado y recuperación tras recarga sin confundir `saved locally` con `published`.  
Aceptación: 15 minutos de edición no se pierden por recarga o sesión vencida; no se crean publicaciones accidentales.

**E03 — P1 · Media: acciones de equipo no comparten estados operativos claros.**  
Evidencia: reportes tienen «tomar/resolver»; editor/tour tienen validaciones, pero `App.svelte` los aloja en una misma superficie y numerosas etiquetas de estado.  
Propuesta: vocabulario consistente de **Borrador → En revisión → Publicado → Retirado**, indicando autor, última modificación, responsable y próximo paso; «En revisión» inicialmente puede ser una **vista de UI**, no migración de estado hasta justificarla.  
Aceptación: staff entiende qué es público, qué está en preparación y quién debe intervenir.

**E04 — P1 · Media: el editor de zonas es técnicamente potente pero puede exigir capacitación.**  
Evidencia: `SectionEditor.svelte` usa flujo por pasos, plano inclinado, vértices UV/XYZ, profundidad, vista perpendicular y revisión; `RouteEditor` usa otros seis pasos.  
Propuesta: acciones explícitas «Zona rápida rectangular», «Contorno de pared», «Superficie inclinada» y previews con nombres claros; esconder UV/XYZ, espesor y reajuste avanzado. Unificar patrones de Inspector/Aplicar/Cancelar/Deshacer con rutas y tours.  
Aceptación: setter nuevo delimita una zona inclinada sin conocer ejes cartesianos; explicación breve solo donde aparece la decisión.

**E05 — P2 · Media: biblioteca de presas reutilizables sigue una hipótesis, no una necesidad validada.**  
Evidencia: plan UX-P2A diferido y picker de centros gaussianos por ruta.  
Propuesta: probar primero si setters repiten la misma presa entre problemas; si sí, identidad `CaptureHold` + referencias `RouteHold` por captura con snapshots históricos. Si no, evitar normalizar de más.  
Aceptación: disminuyen selecciones repetidas sin desplazar agarres de rutas históricas.

**E06 — P1 · Media: visualización 3D no puede asumir precisión física automática.**  
Evidencia: `SplatRuntime.svelte`, `spatial.ts`, `RouteMarkerOverlay.svelte` implementan ancla/líder/etiqueta, profundidad aproximada y verificación; documentación admite necesidad de revisar oclusión.  
Propuesta: validar picking en Crux con sujetos, presas adyacentes, distintas perspectivas y móviles; ofrecer estado «Pendiente de verificar» y mecanismo de corrección, en vez de aumentar complejidad algorítmica sin medidas.  
Aceptación: cero falsos inicios/finales en rutas aprobadas por staff en la muestra piloto.

### F. Recepción, socios, inventario y cobros manuales

**F01 — P0 para uso con dinero/visitas reales · Alta: panel comercial muy denso y bloqueado globalmente.**  
Evidencia: `OperationsPanel.svelte` > 850 líneas y múltiples `<details>`: socios, QR, visitas, correcciones, config, planes, dashboard, inventario; una sola bandera `busy`, `error` y `notice` para numerosas operaciones, `load()` recarga casi todo.  
Propuesta: dividir navegación operativa por rol/tarea («Recepción hoy», «Socios», «Planes», «Caja/Cobros», «Inventario», «Configuración») con estado por recurso y acciones rápidas. No duplicar endpoint/DB.  
Aceptación: staff identifica y registra una visita sin recorrer inventario o abrir múltiples acordeones; falla en dashboard no bloquea escáner QR.

**F02 — P0 para dinero real · Alta: confirmar cobro no tiene una pantalla final de revisión.**  
Evidencia: `OperationsPanel.svelte` `onclick={() => run(() => paymentAction(p, 'confirm'))}` ejecuta API directamente; el botón se llama «Confirmar cobro».  
Propuesta: paso de revisión con socio/venta, importe, moneda, método, referencia y consecuencias (activar membresía / descontar stock). **Confirmación de recepción efectiva del pago**, no insinuar cobro electrónico. Anulación contextual con motivo por movimiento.  
Aceptación: no se confirma un monto equivocado sin ver su origen; API versionada sigue protegiendo dobles cambios.

**F03 — P1 · Alta: el campo de motivo se comparte entre tareas distintas.**  
Evidencia: `OperationsPanel.svelte` usa una sola variable `reason` en cancelación/corrección de visitas, cobros y ventas.  
Propuesta: formulario de operación **contextual por fila**, estado propio de motivo y confirmación. Limpiar al cerrar/terminar, sin arrastrar el motivo de un movimiento a otro.  
Aceptación: motivo de una visita no se reutiliza para cancelar un cobro.

**F04 — P1 · Alta: recepción necesita un flujo único escanear→confirmar→siguiente.**  
Evidencia: `OperationsPanel` separa `Identificar socio`, `Escanear QR`, `Membresía a usar`, `Confirmo consumir`, `Confirmar visita`; usa BarcodeDetector si está disponible y texto como fallback.  
Propuesta: pantalla «Registrar visita» como tarea central, estado visible de credencial válida/revocada, tipo de plan y saldo, confirmación con siguiente socio y reintento al fallo; cámara activa y fallback lector externo, nunca QR como login.  
Aceptación: registrar visitante con credencial válida y manejar QR inválido/ya usado sin confusión ni doble consumo.

**F05 — P1 · Media: dashboard financiero usa fechas UTC y puede confundir turnos.**  
Evidencia: `OperationsPanel` pide «Desde/Hasta (día UTC)», mientras visitas son «día del gimnasio» y `/api/config` almacena `timezone`.  
Propuesta: fechas mostradas en zona configurada con alcance/UTC explícitos; estados «Pendiente/Confirmado/Anulado», desglose por fuente y filtros guardados, y etiquetas de corte de caja (si se define política operativa).  
Aceptación: el responsable puede conciliar el día sin mezclar día local y UTC.

**F06 — P2 · Media: catálogo de tienda y venta staff no comparten una historia pública de producto.**  
Propuesta: si solo hay ventas presenciales, público ve disponibilidad orientativa y «Consultar en recepción»; staff tiene lista con stock/precio y venta preparada. Checkout remoto se plantea en un feature posterior con cancelaciones/conciliación.  
Aceptación: nadie interpreta «Productos» como transacción finalizable online antes de que exista.

### G. Calidad, arquitectura de presentación y publicación

**G01 — P0 para L1/L2 · Alta: la experiencia se declara local; no existe piloto público certificado.**  
Evidencia: `README.md`, `docs/demo-local.md`, `docs/piloto-remoto.md`.  
Propuesta: staging único del ejemplo con Cloudflare Worker/Assets + D1/R2, HTTPS, origen y Supabase callbacks verificados, throttling y backups/restore de **ambos** D1 y objetos R2 (incluidas imágenes de tours). Sin habilitar cobros ni publicar Crux si no hay permisos.  
Aceptación: visitante ajeno abre URL y QR; escritor autorizado puede recorrer flujos con privacidad, logs sin PII y rollback probado en entorno aislado.

**G02 — P0 para L3 · Alta: no hay prueba física representativa de UX/3D/QR/accesibilidad.**  
Evidencia: QA de Chrome simulada y pruebas Crux local escritorio registradas; [validación pendiente](../validacion-formatos-dispositivos.md).  
Propuesta: Android medio/bajo + iPhone, wifi/gama media red real, 320/390/768/1440, lectura bajo iluminación de gimnasio, teclado/lector, zoom/reflow 200%, touch drag alternativo, QR físico, 20 minutos de uso y memoria/batería.  
Aceptación: informe de fallos, fotografías/capturas aprobadas y umbrales ajustados con datos.

**G03 — P1 · Alta: `App.svelte` es un punto de acoplamiento de 1.600 líneas.**  
Evidencia: `src/App.svelte` gestiona sesión, API, catálogo, URL, bitácora, reportes, QR, editor/visor, panel staff y tour.  
Propuesta: **refactor incremental** por controladores/hooks/servicios de dominio (`routing`, `session`, `routes`, `journal`, `viewer-workspace`), manteniendo URLs y Svelte actuales. Sin monorepo prematuro.  
Aceptación: una corrección de catálogo no obliga a tocar lógica de cobros o tours, tests de integración mantienen contratos.

**G04 — P1 · Media: diseño canónico y futuros diseños particulares carecen de contrato de composición formal.**  
Evidencia: `GymSiteConfig v1`, `src/styles.css`, marca estática importada en `SitePublic`, `SiteHeader`, `SiteFooter`; dos temas demo, sin slots de portadas ni variantes de sitio.  
Propuesta: distinguir `shared core`, `site configuration`, `theme tokens`, `page compositions`, `assets`. Contrato v2 opcional de layout con límites y pruebas, solo cuando se aplique primer gimnasio real. **El demo se mantiene canónico**, sin forks por diseño.  
Aceptación: cambio de logo/portada/orden editorial no toca DB, permisos, visor ni flujos comunes.

**G05 — P1 · Alta: documentación inicial del roadmap está cronológicamente obsoleta.**  
Evidencia: cabecera de `docs/roadmap.md` apunta a `main@416eb32` y sección histórica lista como pendientes capacidades que la cola del propio documento marca completas.  
Propuesta: «Estado actual» generado/actualizado al cierre de PR y anexo histórico separado, con estado `implementado local / probado remoto / validado humano`, owners y fecha, para que Codex no rehaga features.  
Aceptación: el primer bloque de roadmap coincide con HEAD y orienta al siguiente feature verdadero.

**G06 — P1 · Media: métricas agregadas no sustituyen observación por tarea.**  
Evidencia: `PilotMetrics`/`measure()` contabilizan eventos técnicos, no completitud ni comprensión; documentación reconoce métricas sin identificadores de usuario.  
Propuesta: pruebas moderadas de tareas y métricas agregadas respetuosas de privacidad (entrada a ruta, imagen útil, acción registró, fallo, retorno tour, abandono de editor). Sin trazas PII ni rastreo individual invasivo.  
Aceptación: se puede decidir mejorar CTA/picking/visitas con resultados observados.

## 4. Propuesta por importancia y dependencias

### Ola 0 — Cerrar puertas para demo pública sin ampliar funcionalidades

**Rama futura sugerida:** `feat/staging-canonico-y-qa` desde `main`.  
Cobertura: G01, G02, B06, verificación de D1+R2, auth, entorno de ejemplo, origen de QR, fallback y protocolo físico. Es independiente de rediseñar la UI.

**Criterio de salida:** L1 público anónimo (con contenido/escena autorizados), L2 privado controlado según permisos y respaldo; QA física abierta/cerrada explícitamente. No autoriza operación con dinero sin F01–F05.

### Ola 1 — Claridad y continuidad para visitante/escalador

**Rama futura sugerida:** `feat/ux-publico-y-progreso` desde `main`.  
Cobertura: A01–A03, B01–B05, C01–C03, D01–D05, F06 (solo texto de catálogo). Dividir en dos PRs si la revisión móvil/cuenta lo amerita: sitio público + progreso personal.

**Criterio de salida:** desde entrada/QR/tour un visitante halla ruta y entiende la localización; escalador registra con acción breve, vuelve del tour y consulta progreso/reportes sin duplicidad.

### Ola 2 — Trabajo diario staff y editor (sin reinventar 3D)

**Rama futura sugerida:** `feat/ux-staff-workspace` desde `main`.  
Cobertura: E01–E04, E06, G03. E05 es investigación opcional, con decisión independiente.

**Criterio de salida:** setter entra a pendientes, retoma un borrador, corrige y publica sin pérdida; el visor único y snapshots antiguos siguen intactos.

### Ola 3 — Recepción y operaciones seguras

**Rama futura sugerida:** `feat/ux-recepcion-y-caja` desde `main`.  
Cobertura: F01–F05. Priorizar revisión/confirmación de dinero **antes** de clientes/ventas reales. Las funcionalidades comerciales ya existen: diseñar recorridos y mitigaciones, no un nuevo backend de caja.

**Criterio de salida:** registro de visita y cobro manual con doble comprobación contextual, respuestas verificadas, motivo por operación y recuperación segura; no confundir visita, ascenso y cobro.

### Ola 4 — Plataforma canónica y extensibilidad visual

**Rama futura sugerida:** `feat/site-composition-contract` desde `main`, **solo después de L3 o al existir un primer cliente real**.  
Cobertura: G04, A03/A04 y regresiones, sin crear tres marcas. G05 (documentación) puede hacerse antes como PR pequeño.

**Criterio de salida:** ejemplo permanece canónico y pasa sus tests mientras el primer diseño particular cambia composición e identidad sin duplicar negocio.

**Regla de trabajo:** rama nueva desde `main` por feature, **un plan Markdown por commit documental** si hay varias rebanadas, luego commits de implementación y PR hacia `main`. El documento presente es una auditoría, no sustituye los planes ejecutables ni autoriza desplegar.

## 5. Priorización práctica de impacto

| Puesto | Mejora de mayor impacto | Motivo |
| --- | --- | --- |
| 1 | Staging/QR/QA física de un solo gimnasio | Sin ello la experiencia no puede mostrarse ni usarse fuera de localhost con confianza |
| 2 | Recepción: flujo escanear→identificar→confirmar | Es una tarea de alta frecuencia que no debería depender de un panel gigante |
| 3 | Confirmación contextual de cobro/venta | Evita errores operativos con dinero y stock |
| 4 | Recuperación de borradores publicados/tours | Evita pérdida de trabajo del setter |
| 5 | Espacio de trabajo staff por pendientes | Reduce desplazamiento y búsqueda de tareas |
| 6 | Registro rápido de actividad y progreso claro | Mejora el uso cotidiano y retorno |
| 7 | Navegación consistente Tour ↔ Zona ↔ Ruta | Convierte el clon digital en una experiencia integrada |
| 8 | Mostrar zona real en chips/cartas y ocultar revisión técnica | Mejora descubrimiento en el gimnasio |
| 9 | Configuración editorial v2 + contenido confirmado | Prepara sitios reales sin tres forks |
| 10 | QA accesibilidad/rendimiento e instrumentación por tareas | Permite priorizar con evidencia |

## 6. Estrategia de validación con personas y métricas de aceptación

**No afirmar «UX excelente» hasta probar recorridos representativos.** Propuesta inicial de investigación, a ajustar al piloto:

| Perfil/escenario | Prueba | Medida propuesta (hipótesis, no dato observado) |
| --- | --- | --- |
| Visitante nuevo (4–6) | Encontrar gimnasio/horario (cuando haya datos), recorrido, ruta y su zona | ≥80% sin ayuda; registrar confusiones |
| Escalador (5–8) | QR → grado/inicio/final → intento/ascenso → bitácora → proyecto | ≥80% sin ayuda y cero pérdida/duplicación de registros |
| Setter (2–3) | Preparar zona inclinada, ruta de 5 agarres, corregir, revisar, guardar borrador y publicar | Cero publicaciones accidentales, cero coordenadas históricas cambiadas, observación cualitativa de tiempo |
| Staff recepción (2–3) | Leer QR real, confirmar visita, resolver inválido/uso duplicado y cobrar manualmente ficticio | Cero consumos/cobros dobles o equivocados |
| Admin (1–2) | Publicar/retirar un tour y ruta, reparar error de imagen, restaurar datos de prueba | Conservación de revisiones, permisos y enlaces |
| Tecnologías asistivas | Teclado, lector, zoom 200%, motion reducido, alternativa drag | Bloqueos críticos cero, hallazgos documentados |
| Dispositivos/escena | Android bajo/medio, iPhone, desktop; Crux y segunda captura cuando exista | Medir tiempo a ficha/poster/3D usable, fallos, memoria y gestos; umbrales **después** de medir |

**Evaluación técnica por cada PR:** `npm run check`, `npm run check:api`, `npm run format:check`, `npm test`, `npm run test:api`, `npm run build`, `npm run test:e2e` y smoke integrado en **entorno desechable** cuando corresponda. No ejecutar `demo:reset` o `demo:smoke` sobre el Crux persistente sin revisar comportamiento del script; proteger A/B y demo. No presentar pruebas con APIs interceptadas como QA remota privada.

### Indicadores de negocio que vale la pena medir **más adelante**

- **Uso público:** apertura de ruta/QR, transición a foto/3D, tiempo de ficha usable y abandono.
- **Uso escalador:** finalización de registro, errores de idempotencia, retorno a proyectos (solo agregados).
- **Uso setter:** tiempo de borrador a publicación, número de correcciones e incidencias de picking.
- **Recepción:** fallos de identificación y reintentos, errores prevenidos de cobro/visita.
- **Tour:** inicio → parada N → acceso a rutas/El gimnasio; no solo cantidad de aperturas.
- **Confiabilidad:** porcentaje de assets recuperables, errores autenticación, backup restaurable, 3D fallido y rendimiento real.

Definir consentimiento, retención, anonimización y límites antes de nuevos eventos analíticos; no introducir rastreo de personas como requisito del demo.

## 7. Referencias externas consultadas

Estas referencias inspiran patrones; **no demuestran que Climbing Lab tenga los mismos resultados ni sustituyen pruebas con usuarios**.

1. **Nielsen Norman Group — [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/):** limitar opciones frecuentes en pantalla principal y mover complejidad a controles explícitos. Aplica a staff, registro y filtros.
2. **Nielsen Norman Group — [Wizards](https://www.nngroup.com/articles/wizards/):** dividir tareas complejas en pasos coherentes. Ya adoptado en editores; siguiente mejora es un flujo sin pérdida y con estados.
3. **KAYA — [Gym management and routesetting](https://kayaclimb.com/forgyms):** vincula rutas, información del gimnasio, setting y feedback; útil para el paso de herramientas aisladas a operación diaria.
4. **TopLogger — [Route management](https://toplogger.nu/):** muestra integración entre edición de rutas, rotaciones, feedback y dispositivos compartidos; valorar un modo kiosco más adelante, no introducir competencias ahora.
5. **Stōkt — [Digital spray walls](https://www.getstokt.com/):** seleccionar presas sobre un muro reconocible y gestionar rutas sin coordenadas como interfaz principal; biblioteca de agarres es hipótesis por probar.
6. **Matterport — [Guided Tour Best Practices](https://support.matterport.com/s/article/Guided-Tour-Best-Practices?language=en_US):** seleccionar paradas útiles, navegación clara y tour breve; mejora del recorrido actual, no cine automático.
7. **W3C — [WCAG 2.2 (cambios)](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/):** alternativas al arrastre, objetivos de puntero y foco; evaluar manualmente. WCAG 2.2 AA exige ≥24 CSS px o excepciones para tamaño de objetivo, no confundir el tamaño pintado con el área accionable.
8. **Material Design — [Bottom sheets](https://m1.material.io/components/bottom-sheets.html) y [Responsive UI](https://m1.material.io/layout/responsive-ui.html):** paneles móviles que mantengan contexto, con presentación distinta en desktop.

## 8. Evidencia concreta del repositorio revisada

- [`src/App.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/App.svelte): navegación, catálogo y filtros, sesión, ficha, registro, staff, reportes, QR y tour.
- [`src/SiteHeader.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/SiteHeader.svelte), [`src/SitePublic.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/SitePublic.svelte), [`src/site.ts`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/site.ts): navegación y configuración editorial.
- [`src/RouteCatalog.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/RouteCatalog.svelte), [`src/RoutePresentation.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/RoutePresentation.svelte): catálogo y ficha.
- [`src/TourPage.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/TourPage.svelte), [`src/TourManager.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/TourManager.svelte): tour público/editor.
- [`src/JournalControls.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/JournalControls.svelte), [`src/ProjectsPanel.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/ProjectsPanel.svelte), [`src/MyReports.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/MyReports.svelte): progreso personal.
- [`src/RouteEditor.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/RouteEditor.svelte), [`src/SectionEditor.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/SectionEditor.svelte), [`src/RouteMarkerOverlay.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/RouteMarkerOverlay.svelte): edición espacial ya implementada.
- [`src/OperationsPanel.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/OperationsPanel.svelte), [`src/StorePanel.svelte`](https://github.com/keneth4/climbing-lab/blob/5a334b395dfbf8627448ae0f120962e21f5be603/src/StorePanel.svelte): operación comercial.
- [`docs/roadmap.md`](../roadmap.md), [`docs/demo-local.md`](../demo-local.md), [`docs/piloto-remoto.md`](../piloto-remoto.md), [`docs/planes/ux/05-tour-paradas.md`](planes/ux/05-tour-paradas.md): estado, restricciones y evidencia de QA.

## 9. Nota de interpretación

Esta revisión identifica **evidencia de diseño implementado y riesgos de experiencia**, pero no demuestra cuánto frustran esas fricciones a una persona real. No se generaron capturas ni se operó un navegador en esta auditoría por falta de acceso a la instancia local del propietario en el entorno de análisis. Cualquier hipótesis de severidad ligada a ergonomía se confirmará con pruebas en el gimnasio. **No modificar ni desplegar el producto antes de aprobar los planes verticales.**
