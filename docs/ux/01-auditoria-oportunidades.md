# Auditoría UX/UI y estrategia de producto multigimnasio — Climbing Lab

**Fecha:** 13 de octubre de 2026  
**Repositorio:** https://github.com/keneth4/climbing-lab  
**Referencia revisada:** rama `main`, commit [`6fce9a7b2f70`](https://github.com/keneth4/climbing-lab/commit/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1)  
**Tipo de trabajo:** evaluación de código, documentación, estructura de información y flujos declarados.  
**Estado:** recomendaciones para discusión y planificación; no representa una implementación.

> **Alcance y limitación:** esta es una auditoría **estática** del repositorio, no una evaluación visual ejecutada del producto en un navegador con sesiones reales. No se consiguieron capturas propias, interacción presencial, datos de analítica ni pruebas con usuarios. Las observaciones se fundamentan en código y documentos; los problemas de usabilidad en personas reales son hipótesis a validar. No se asigna una calificación numérica de usabilidad sin evidencia suficiente.

## 1. Resumen ejecutivo

### Decisión recomendada

Construir **una plataforma web con código compartido, tres sitios públicos individualizables y operaciones/datos aislados por gimnasio**. No desarrollar tres forks ni limitar la personalización a sustituir un logo y un color.

Dividir el problema en cuatro capas:

1. **Producto común:** catálogo de rutas, ficha, exploración 3D, bitácora, reportes, QR, cuentas, panel del staff, futuras membresías y tienda.
2. **Sistema de diseño común:** componentes accesibles, estados de interfaz, tipografía, espaciados, jerarquía, patrones de navegación y pruebas.
3. **Identidad/configuración por gimnasio:** marca, contenido, URLs, temas, fotografías, textos, secciones y variantes visuales controladas.
4. **Despliegue/datos por gimnasio:** sitio en dominio propio, Worker, D1 y R2 específicos; autenticación compartida con permisos y actividad locales.

El proyecto ya documenta este rumbo. La oportunidad principal es pasar de una **demo técnica orientada a rutas** a una **experiencia pública orientada a descubrir el gimnasio y escalar**, sin sacrificar un panel de operación consistente.

### Qué conservar

- Svelte 5 + TypeScript; motor PlayCanvas cargado dinámicamente.
- La ruta/identidad estable, los snapshots históricos de bitácora y los enlaces/QR existentes.
- Separación por gimnasio mediante Worker y D1 independientes descrita en el ADR y practicada en dos entornos locales.
- Catálogo público sin obligar a iniciar sesión y beta opcional.
- Capacidad de consulta sin escena 3D como intención de producto.
- Pruebas Playwright de recorridos funcionales en desktop y móvil; pruebas de autorización de API.

### Qué NO conviene hacer ahora

- Diseñar tres frontends por separado antes de definir una base UX compartida.
- Lanzar un editor visual ilimitado o un CMS complejo como requisito del piloto.
- Volver obligatorio el visor 3D para obtener información esencial de una ruta.
- Añadir pagos, tienda, video o funcionalidades sociales antes de cerrar el flujo principal.
- Entender una casilla «modo staff demo» como control real de permisos.

## 2. Objetivo de experiencia y públicos

**Promesa central:** una persona encuentra información del gimnasio, descubre rutas, comprende cada problema sin fricción, registra su progreso cuando lo desea y comparte su experiencia. El staff puede actualizar el catálogo sin arriesgar la integridad del historial. Cada gimnasio mantiene su personalidad visual.

| Persona / intención | Tarea principal | Éxito observable |
| --- | --- | --- |
| Visitante nuevo | Conocer el lugar, horarios, ubicación, servicios, precios y cómo iniciar | Encuentra información práctica y un siguiente paso claro, sin cuenta |
| Escalador casual | Buscar una ruta por grado/sector, ver agarres, abrir beta si quiere | Encuentra y comprende una ruta incluso si el visor no carga |
| Escalador recurrente | Registrar intento/ascenso y consultar progreso | Registra actividad con confirmación, historial íntegro y privacidad explícita |
| Setter/editor | Crear, revisar, publicar y retirar rutas | Completa edición con vista previa, historial y errores prevenidos |
| Recepción/administración | Atender reportes y, después, socios/visitas | Ve pendientes y estados comprensibles, con permisos apropiados |
| Operador de plataforma | Publicar un sitio distinto para un gimnasio | Cambia marca/contenido/despliegue sin replicar lógica ni romper otro gimnasio |

**Principio de producto:** el sitio público debe funcionar como **sitio del gimnasio**; la app de escalada es su diferenciador, no su única página.

## 3. Inventario de lo que realmente existe

| Área | Estado verificado en el repositorio | Implicación para UX |
| --- | --- | --- |
| Frontend | Una vista principal en `src/App.svelte`, con Catálogo, Bitácora y Staff demo | Buena prueba de concepto, pero sin arquitectura de pantallas definitiva |
| Apariencia | `src/styles.css` global y CSS local del visor; estilos y textos propios de demo | No existe sistema de diseño ni configuración de marca por gimnasio |
| Visor | `src/SplatViewer.svelte` permite cargar PLY/SOG local, orbitar, guardar cámara local y exportar la vista | El visitante aún no puede abrir una escena 3D publicada y persistente |
| Catálogo | Filtro de texto por nombre, grado, opción de retiradas, ficha con beta/QR | Falta descubrimiento avanzado, jerarquía de información y flujo móvil |
| Bitácora | Persistencia en `localStorage`, registro y exportación PNG del esquema | No ofrece aún cuenta/sincronización real; experiencia solo local |
| Staff | Crear/editar elementos básicos y resolver reportes en modo demo | Aún no hay editor/publicación versionada real conectado a backend |
| API | Worker con endpoints públicos y privados; dos ambientes D1 locales; pruebas de aislamiento | Base técnica prometedora, **frontend todavía desconectado** |
| Sitios por gimnasio | Arquitectura conceptual con un Worker/D1/R2 por gimnasio | No hay tres sitios configurables/publicados ni panel de contenido |
| Calidad | Vitest, Playwright desktop 1440 y móvil 390, pruebas del Worker | No equivale a auditoría visual, accesibilidad ni rendimiento real 3D |

**Fuente principal:** [README](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/README.md), [implementación](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/docs/implementacion.md), [API local](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/docs/api-local.md).

## 4. Hallazgos y oportunidades, ordenados por prioridad

**P0 = fundamento antes de formalizar el diseño base o publicar el piloto; P1 = imprescindible para una experiencia de calidad del piloto; P2 = iteración posterior.** Prioridad de producto, no afirmación de error en producción.

### P0 — Fundamentos

#### UX-01. Falta la experiencia pública de un gimnasio, no solo su catálogo
- **Evidencia:** `App.svelte` entra directamente a «Catálogo» y el encabezado es «Climbing Lab / Gimnasio de demostración»; `docs/interfaz-base.md` planea una pantalla de Inicio todavía ausente.
- **Impacto:** una persona nueva no encuentra propuesta de valor, ubicación, horarios, contacto, clase de prueba ni información práctica.
- **Acción:** añadir arquitectura de sitio público: Inicio, Rutas, Información/Visítanos, Preguntas frecuentes y contacto/CTA contextual. Mostrar horarios, ubicación y precios **solo cuando el gimnasio confirme esos datos**.
- **Aceptación:** usuario sin cuenta localiza cómo visitar o contactar al gimnasio y abre rutas desde la portada.

#### UX-02. Público, escalador y staff comparten una pantalla y lenguaje de demo
- **Evidencia:** navegación `Catálogo / Bitácora / Staff`, casilla `Modo staff de demostración`, panel y formularios en `App.svelte`.
- **Impacto:** mezcla de tareas, densidad excesiva y riesgo de arrastrar convenciones de desarrollo a producción.
- **Acción:** shells independientes: público, cuenta del escalador y administración. Mantener componentes de dominio reutilizables, pero navegación, permisos y prioridades visuales diferentes. El acceso al staff debe depender del backend.
- **Aceptación:** en modo público nunca aparecen cargas de archivos, edición ni selector demo; el staff encuentra una navegación de tareas propia.

#### UX-03. No hay personalización sistemática por gimnasio
- **Evidencia:** colores hexadecimales y layouts definidos en `src/styles.css` y `src/SplatViewer.svelte`; textos, fondo y marca están incrustados en `App.svelte` y `exportImage()`.
- **Impacto:** tres marcas exigirían modificar componentes y exportaciones, elevando costo y divergencia.
- **Acción:** tokens semánticos, componentes, variantes de layout permitidas y un `GymSiteConfig` versionado. Identidad visual coherente también en QR, share cards, imágenes y metadatos.
- **Aceptación:** crear un tercer tema sin modificar lógica de catálogo, permisos ni visor; pruebas visuales de los tres temas.

#### UX-04. La app y la API todavía son productos paralelos
- **Evidencia:** `App.svelte` lee y escribe `localStorage`; `worker/index.ts` y `docs/api-local.md` muestran API D1 local ya implementada, pero sin conexión.
- **Impacto:** no hay sesiones reales, persistencia entre dispositivos ni contenido confiable actualizado por staff.
- **Acción:** cliente de API tipado, sesión/autorización, estados de carga/error, caché de lectura y mutaciones con feedback. Preservar aislamiento Worker/D1 por despliegue.
- **Aceptación:** recorrer lectura pública → login para acción personal → registro → historial → reporte staff en un gimnasio, sin acceder a datos de otro.

#### UX-05. La ruta 3D pública no está preparada para internet ni tiene degradación completa
- **Evidencia:** `SplatViewer.svelte` solicita un archivo local; `docs/implementacion.md` señala que no se publica ni persiste el asset y el esquema de agarres 2D no se corresponde con el splat.
- **Impacto:** QR/enlaces compartidos no pueden entregar hoy la experiencia 3D prometida.
- **Acción:** publicación/versionado de capturas y presentaciones, imagen/poster estático por ruta y un visor bajo demanda con estados `preview/loading/ready/error/unsupported`. El texto de ruta debe ser útil antes y después de la carga.
- **Aceptación:** enlace público abre inmediatamente ficha + imagen; el usuario decide cargar 3D; falla de WebGL/red no bloquea nombre, grado, sector ni beta.

#### UX-06. El camino entre uso público y cuenta privada debe diseñarse explícitamente
- **Evidencia:** formularios de registro de actividad y reportes se encuentran en la ficha y guardan datos locales; la API privada requiere identidad legítima.
- **Impacto:** al conectar auth podría aparecer un bloqueo inesperado o perderse el contexto de la ruta al iniciar sesión.
- **Acción:** catalogar sin sesión; CTA «Guardar intento» y «Reportar» explican cuándo se requiere cuenta; preservar ruta y acción después de login; distinguir guardado pendiente, exitoso y fallido.
- **Aceptación:** una persona sin sesión inicia el registro desde una ruta y regresa a esa misma ruta al autenticarse, sin pérdida silenciosa.

### P1 — Calidad de experiencia

#### UX-07. Mobile-first necesita jerarquía propia, no solo columnas apiladas
- **Evidencia:** `styles.css` usa un grid 280 px + contenido en desktop y pasa a una columna bajo 750 px; múltiples secciones siguen una sola secuencia vertical y la lista móvil tiene dos columnas.
- **Riesgo a validar:** encontrar la ficha y el visor podría requerir demasiado desplazamiento en 390 px.
- **Acción:** catálogo como lista o tarjetas compactas; filtros en drawer/sheet con chips activos, ficha como vista propia, acciones prioritarias visibles, controles táctiles y consideración de safe areas.
- **Aceptación:** a 320/390/768/1024/1440 px se puede buscar, seleccionar, volver y registrar actividad sin desplazamiento horizontal ni perder el contexto.

#### UX-08. Búsqueda y filtros no están orientados a la tarea
- **Evidencia:** filtro de nombre, grado exacto y retiradas en `App.svelte`; `selectedId` no se actualiza cuando los filtros excluyen la selección.
- **Impacto:** falta sector, intervalo de dificultad, conteos, limpieza rápida y señales de qué filtros están activos; puede verse una ruta que no aparece en el listado filtrado.
- **Acción:** búsqueda por nombre/sector, filtros de grado y sector, resultados contados, limpiar filtros, empty state con recuperación y política explícita de selección filtrada.
- **Aceptación:** nunca se confunde la ruta seleccionada con los resultados; vacíos y reinicio de filtros son claros.

#### UX-09. La ficha carece de una jerarquía editorial y estados explícitos de ruta
- **Evidencia:** `App.svelte` presenta título, grado, metadatos, visor, esquema, leyenda, beta, exportación, QR y formularios sucesivos.
- **Impacto:** demasiadas acciones compiten con comprender el problema de escalada.
- **Acción:** cabecera con nombre, grado, sector, estado y revisión; foto/preview primero; 3D como acción secundaria visible; agarres y beta progresivos; acciones «Guardar intento», «Compartir» y «Reportar» agrupadas por intención.
- **Aceptación:** usuario distingue ruta activa, retirada y versión histórica sin investigar detalles; compartir mantiene la identidad estable.

#### UX-10. El visor 3D no tiene alternativa de interacción equivalente
- **Evidencia:** `SplatViewer.svelte` tiene canvas enfocable, pero los manejadores implementados son pointer/wheel; instrucciones «Shift + arrastre» no sirven como orientación para todos los teléfonos y no hay controles por teclado.
- **Impacto:** uso limitado por accesibilidad motriz, teclado, dispositivos táctiles y condiciones de bajo rendimiento.
- **Acción:** botones visibles de acercar/alejar, reset y vistas guardadas; controles de teclado documentados; gestos móviles probados; aviso y opción «Ver imagen»; evitar que wheel/gestos bloqueen innecesariamente el scroll.
- **Aceptación:** se puede entender la ruta sin manipular canvas; funciones esenciales utilizables con teclado y teléfono; test manual con lector de pantalla.

#### UX-11. Hay base de accesibilidad, pero faltan patrones completos
- **Evidencia:** existen `label`, `aria-label`, `role=status` y `:focus-visible` en botones/enlaces; estilos globales tienen textos de 12–14 px; selección de tarjetas basada en clase visual, no en un estado ARIA explícito.
- **Acción:** navegación semántica, título y foco al cambiar de vista, `aria-current` o `aria-pressed` cuando corresponda, `fieldset/legend` en formularios, errores asociados al campo, estados vivientes no invasivos, contrastes revisados y objetivos táctiles cómodos.
- **Aceptación:** checklist WCAG 2.2 AA como objetivo, pruebas automatizadas + revisión manual, teclado, zoom 200 % y reflow.

#### UX-12. El feedback y la prevención de errores son incompletos
- **Evidencia:** un `message` global sirve para cualquier acción; edición staff de nombre/beta es inmediata en memoria; retiro/reactivación cambia estado sin confirmación; bitácora local puede desaparecer al borrar almacenamiento.
- **Impacto:** incertidumbre sobre guardado, errores y cambios con consecuencias.
- **Acción:** estados por operación (guardando/guardado/error/reintentar), validación inline, confirmaciones solo para acciones destructivas, guardado de borrador, publicación separada de edición y alerta honesta del modo local.
- **Aceptación:** ante error de red se conservan datos del formulario y se puede reintentar; retiro requiere confirmación y deja rastro de revisión.

#### UX-13. La experiencia staff necesita un flujo editorial profesional
- **Evidencia:** solo existe creación sencilla y edición básica; la API actual todavía no publica rutas ni revisiones por endpoints staff; `docs/interfaz-base.md` define capacidades más completas.
- **Acción:** bandeja de rutas, editor de metadatos, cámara/marcadores, vista previa, validación, publicar/retirar, historial y reportes categorizados. Distinguir incidentes de seguridad (por ejemplo, agarre suelto) con un proceso operativo acordado con el gimnasio.
- **Aceptación:** publicar una ruta nueva requiere completar campos obligatorios, previsualizar y confirmar; un reporte no modifica la ruta sin revisión.

#### UX-14. Exportaciones y compartibles no están preparados para múltiples marcas
- **Evidencia:** `exportImage()` escribe «Climbing Lab · Gimnasio demo» y «Por Creativivid» con colores fijos; exporta esquema 2D, separado de la captura 3D.
- **Acción:** plantillas de exportación con tokens, logo, atribución acordada, versión y visibilidad explícita de datos personales; imagen con fallback consistente y nombre de archivo legible.
- **Aceptación:** exportación de cada sitio utiliza su marca sin filtrar datos de otro, conserva el estado histórico y permite excluir información personal.

#### UX-15. Pruebas de calidad centradas en funcionamiento, no percepción
- **Evidencia:** `tests/pilot.spec.ts` verifica ascenso, reporte, QR, PLY sintético de 100 gaussianos, ausencia de errores y overflow; no contiene auditorías de accesibilidad, tests de diseño por tema ni medición real del splat.
- **Acción:** cobertura e2e por tarea y pantalla, axe o alternativa para detección automática, teclado, capturas de regresión visual, offline/error de red, y mediciones reales en teléfonos representativos.
- **Aceptación:** cada commit de UI pasa pruebas desktop/mobile; antes del piloto existe registro de resultados de carga 3D y fallbacks, no una promesa genérica de «rápido».

### P2 — Después de validar el núcleo

#### UX-16. Contenido, SEO local y descubrimiento orgánico
- **Situación:** sin páginas públicas completas ni configuración de sitio, no hay estrategia visible para títulos/descripciones, datos estructurados del negocio, URLs canónicas, sitemap, OG/social ni accesibilidad editorial.
- **Acción:** editor acotado de contenido del gimnasio; SEO, metadata y contenido indexable por dominio; URLs amigables de ruta cuando convenga. Evitar indexar páginas personales.

#### UX-17. Personalización avanzada sin fragmentar el producto
- **Situación:** `docs/interfaz-base.md` deja abierta la decisión temas vs plantillas vs composiciones.
- **Acción:** iniciar con tokens + 2 o 3 variantes controladas para portada y listado; posponer drag-and-drop y CSS arbitrario hasta que los tres sitios reales demuestren necesidad.

## 5. Arquitectura de experiencia recomendada

### 5.1 Mapa de navegación base

| Superficie | Vistas propuestas | Consideraciones |
| --- | --- | --- |
| Sitio público | Inicio, Rutas, Detalle de ruta, El gimnasio/Visítanos, Precios/Planes si procede, Contacto/FAQ | Marca y contenido específicos por gimnasio |
| Cuenta del escalador | Mi actividad, Proyectos (cuando exista), Perfil/Privacidad | Cuenta compartida opcional; datos personales y permisos por gimnasio |
| Staff | Resumen, Rutas, Editor, Capturas, Reportes, Configuración, Permisos | UI operativa compartida y autorizada por roles |
| Gestión comercial futura | Socios, Visitas, Planes, Cobros, Tienda | No condicionar el piloto; introducir después de probar rutas/bitácora |

Separar **rutas de navegador** de **pestañas de estado local**: un enlace profundo debe abrir la ruta deseada, restaurarse al recargar, permitir atrás/adelante y manejar rutas retiradas. Conservar identificadores estables para QR y generar URL con el dominio del gimnasio.

### 5.2 Experiencia pública propuesta

**Inicio (mobile-first):** marca y menú; mensaje claro y fotografía auténtica; CTA «Explorar rutas» y CTA de visita/contacto; información práctica; sectores o rutas destacadas; beneficios del gimnasio; pie de página.

**Catálogo:** cabecera compacta, búsqueda y filtros; resultados y tarjetas con nombre, grado, sector, estado e imagen; acceso a detalle; ordenamiento/segmentación solo cuando los datos lo justifiquen.

**Ficha de ruta:** nombre, grado, sector, estado, imagen/preview; acción «Explorar en 3D»; marcadores y beta opcionales; guardar intento, compartir/QR y reportar. La lectura de la ficha nunca depende del éxito del 3D.

**Cuenta:** navegación centrada en «mi progreso», entradas por fecha/lugar, proyectos y privacidad. Autenticación aparece únicamente al ejecutar una acción personal protegida.

**Staff:** escritorio de operación separado del marketing, con lista → editar → previsualizar → publicar; etiquetas de estado, permisos, auditoría y confirmación.

### 5.3 Componentes reutilizables sugeridos

- Fundamentos: `Button`, `IconButton`, `Link`, `Input`, `Select`, `Textarea`, `Dialog`, `Drawer`, `Toast`, `EmptyState`, `ErrorState`, `Skeleton`, `Badge`.
- Producto: `GymHeader`, `GymFooter`, `RouteCard`, `RouteFilters`, `RouteDetail`, `RouteStatus`, `HoldLegend`, `SplatExperience`, `ActivityForm`, `ShareRoute`, `QrCard`.
- Staff: `AdminShell`, `RouteEditor`, `PublicationPreview`, `ReportQueue`, `CaptureManager`.
- Consistencia: componentes **sin lógica de tenant incrustada**; contenido y branding por props/configuración; servicios bajo interfaces propias.

### 5.4 Sistema de diseño y personalización

**Tres niveles que deben mantenerse separados:**

1. **Primitivas/semántica común:** espaciados, escalas tipográficas, radios, foco, estados, jerarquía, componentes y layout responsive.
2. **Tokens por gimnasio:** marca y logo, fondo/superficie/texto, primary/secondary, acentos, tipografía de marca, bordes, imagen de cabecera, tono editorial.
3. **Composición acotada:** portada «fotográfica», «comunidad» o «rutas primero»; densidad de tarjetas; bloques de contenido ordenables dentro de contratos seguros.

Los **colores funcionales** de peligros/éxito/estado y los **roles de agarres** deben conservar significado accesible entre gimnasios: no depender solo del color. El panel administrativo puede usar diseño operativo compartido con identificación visible del gimnasio.

Ejemplo conceptual (no contrato implementado):

~~~ts
type GymSiteConfig = {
  gymId: string;                 // Determinado en el despliegue
  domain: string;                // Dominio autorizado
  brand: {
    name: string;
    logoUrl: string;
    themeId: string;
    fontFamily?: string;
  };
  content: {
    headline: string;
    description: string;
    heroImageUrl?: string;
    contactUrl?: string;
    location?: string;
    openingHours?: string;
  };
  layout: {
    homeVariant: 'visual' | 'community' | 'routes-first';
    sections: string[];
  };
  features: {
    routes3d: boolean;
    journal: boolean;
    membership: boolean;
    store: boolean;
  };
};
~~~

**Seguridad importante:** `gymId` de configuración pública identifica el sitio, pero **no autoriza** cambiar de D1 ni de permisos. La API usa el Worker y binding propios del despliegue. Las flags visuales no reemplazan autorización de servidor. Evitar que una edición de contenido permita ejecutar HTML/CSS/JS arbitrarios.

### 5.5 Despliegue recomendado para 3 gimnasios

~~~text
           Mismo repositorio y componentes compartidos
                            |
             build/config por gimnasio y dominio
                /           |           \
         Sitio A          Sitio B        Sitio C
        Worker A         Worker B       Worker C
         D1 A             D1 B           D1 C
         R2 A             R2 B           R2 C
                \           |           /
             Proveedor de identidad compartido
               (permisos evaluados por gimnasio)
~~~

Alineado con [ADR-0001](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/docs/decisiones/0001-backend-cloudflare.md). No asumir todavía que existan recursos productivos para los tres sitios. Preferir un **único repositorio, un pipeline parametrizado, tres despliegues aislados y versionado de esquemas común**.

**Estrategia de contenido:** primera versión por archivos de configuración validados en el repositorio; después un formulario CMS acotado solo si los gimnasios necesitan cambios frecuentes. No es necesario crear un editor de páginas completo para lanzar.

## 6. Principios de calidad y criterios medibles

| Tema | Criterio de aceptación propuesto |
| --- | --- |
| Usabilidad | Probar tareas con personas representativas: visitar/consultar ruta, registrar ascenso, publicar ruta |
| Accesibilidad | Objetivo WCAG 2.2 AA; contraste normal al menos 4.5:1; zoom/reflow; navegación y foco; no depender del canvas |
| Mobile | Revisar ancho 320, 390 y 768 px; zonas táctiles cómodas y contenido sin overflow |
| Velocidad | Definir presupuestos **después** de medir captura real y red móvil; obtener ficha útil sin 3D |
| 3D | Medir descarga, tiempo hasta preview, tiempo hasta 3D utilizable, memoria cuando sea posible, FPS y tasa de errores |
| Privacidad | Bitácora privada por defecto; controles explícitos para texto/nombre/datos de share cards |
| Seguridad | Acciones staff autorizadas por servidor; aislamiento de consultas y datos entre A, B y C |
| Compartir | Cada QR apunta al dominio correcto, identidad estable e historial correcto de la ruta |
| Personalización | Tres identidades visuales con mismo set de pruebas funcionales y misma semántica de UI |
| Resiliencia | Estados para sin red, error API, asset fallido, ruta retirada, sin resultados y sin sesión |

**No fijar una meta arbitraria de MB o FPS sin dispositivos/capturas reales.** El archivo mencionado de 751 mil gaussianos y 186 MB es punto de partida documental, no prueba de rendimiento.

## 7. Orden de implementación propuesto para Codex

**Regla de trabajo:** para cada iniciativa de feature, abrir **rama nueva desde `main`**; preparar **documentos Markdown de planificación, uno por commit**; implementar después de aprobar los planes; cerrar con PR hacia `main`. Evitar crear tres ramas permanentes por gimnasio. Esta auditoría abre la conversación, no sustituye los diseños detallados.

| Paso | Documento Markdown sugerido (un commit documental por paso) | Entregable/decisión |
| --- | --- | --- |
| 01 | `docs/ux/01-auditoria-oportunidades.md` | Este diagnóstico, prioridades y límites |
| 02 | `docs/ux/02-personas-flujos-arquitectura-informacion.md` | Flujos visitante/escalador/staff, rutas del sitio, wireflows y estados |
| 03 | `docs/ux/03-design-system-y-temas.md` | Tokens, contrato del tema, componentes, variantes y reglas de accesibilidad |
| 04 | `docs/ux/04-sitio-publico-catalogo-mobile.md` | Especificación responsive, pantalla Inicio/Catálogo/Ficha y prueba de tareas |
| 05 | `docs/ux/05-visor-3d-progresivo-y-fallback.md` | Estados, experiencia táctil/teclado y contratos de assets/versiones |
| 06 | `docs/ux/06-cuenta-bitacora-staff-api.md` | Sesiones, errores, staff y conexión segura de frontend a Worker |
| 07 | `docs/ux/07-deploy-y-checklist-tres-gimnasios.md` | Contratos de configuración, dominio, QA por tenant y publicación |

**Secuencia de ejecución recomendada, tras acordar planes:**

1. **Fase A — Arquitectura UX + sistema de diseño:** shells y componentes, tokens semánticos, config de marca; sin introducir features comerciales.
2. **Fase B — Sitio público y catálogo responsive:** portada, ficha, filtros, rutas directas, estados, semántica y accesibilidad.
3. **Fase C — Visor útil en condiciones reales:** asset remoto versionado, fallback 2D/imagen, controles y métricas.
4. **Fase D — Cuenta y operaciones:** conectar API/autenticación, persistencia real, bitácora y flujo staff con revisiones.
5. **Fase E — Tres marcas y despliegues:** adaptar identidad editorial/visual por gimnasio, probar aislamiento, rendimiento y QA.
6. **Fase F — Capacidades futuras:** video, socios, pagos, tienda, condicionadas a valor validado.

La conexión API/autorización puede desarrollarse en paralelo a las primeras pantallas, pero **no publicar funcionalidades personales reales hasta que se cierre**.

## 8. Matriz de pruebas de producto para el piloto

### Recorridos indispensables

1. **Visitante anónimo:** portada → catálogo → filtro → detalle → información útil antes de 3D → beta → enlace/QR.
2. **Escalador:** detalle → iniciar sesión si hace falta → registrar actividad → confirmación → bitácora → exportar con privacidad elegida.
3. **Staff:** autenticación y permiso local → crear borrador → guardar vista/agarres → previsualizar → publicar → retirar → ver versión histórica.
4. **Reportes:** usuario reporta → staff revisa → decide y registra estado → ruta publicada no cambia automáticamente.
5. **Resiliencia:** WebGL no disponible, carga lenta, enlace inválido, ruta retirada, API 401/403/500, sin resultados.
6. **Multigimnasio:** repetir recorridos con tres marcas; un usuario con permiso staff en A no gana acceso staff a B/C, y cada URL resuelve sus propias rutas.

### Dispositivos y métodos

- Chrome/Safari/Firefox en combinaciones reales según público local, incluyendo teléfonos de gama media y un dispositivo de gama baja si está disponible.
- Teclado sin ratón y lectores de pantalla para comprobar patrones esenciales.
- Capturas comparativas desktop/mobile y regresión visual de cada tema.
- Medir escenas reales PLY/SOG/streaming donde corresponda; la prueba actual con 100 gaussianos verifica integración, no UX/performance del caso real.
- Entrevistas/pruebas moderadas de tareas antes de proclamar «UX excelente».

## 9. Decisiones pendientes del propietario de producto

| Pregunta | Recomendación inicial | A validar con gimnasios |
| --- | --- | --- |
| ¿Los tres gimnasios comparten funciones exactamente? | Núcleo común + flags cuidadosamente controladas | Diferencias obligatorias de operación |
| ¿Marca distinta implica layout distinto? | Sí en portada y composición editorial; no en lógica | Identidad visual, ejemplos y tono de cada uno |
| ¿Cada gimnasio editará el contenido? | Configuración versionada primero; CMS limitado después | Frecuencia de cambios y responsables |
| ¿Cuenta del escalador entre gimnasios? | Identidad central con bitácora y permisos locales | Consentimiento, privacidad y utilidad de vista global |
| ¿Qué información del gimnasio será pública? | Ubicación, horarios, contacto, servicios, precios confirmados | Datos oficiales, material fotográfico, textos |
| ¿Cuál será el piloto? | Uno primero, pero probar aislamiento desde el inicio | Captura real, dispositivos, responsable staff |
| ¿Quién opera QR de visita y agarres sueltos? | Flujos separados y protocolos explícitos | Seguridad y reglas del gimnasio |
| ¿Qué personalización venden a cada gimnasio? | Paquete base de tema + contenido + variantes | Alcance comercial y costo de soporte |

## 10. Recomendación final

No rediseñar `App.svelte` directamente como si fuera el producto terminado. **Primero convertir la navegación, los estados, los componentes y el contrato de personalización en una especificación compartida**. Después transformar el catálogo y el visor en módulos y conectar la API. Así el primer gimnasio validará la experiencia base y los otros dos recibirán sitios propios sin bifurcar la plataforma.

**Primera validación de valor:** un visitante reconoce el gimnasio y encuentra una ruta sin cuenta; un escalador registra progreso con confianza; un setter publica una revisión sin romper enlaces; y cada marca se percibe distinta usando la misma lógica y las mismas pruebas.

## 11. Evidencia examinada

- [Pantalla principal y flujos de demostración — src/App.svelte](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/src/App.svelte)
- [Estilos globales — src/styles.css](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/src/styles.css)
- [Visor local — src/SplatViewer.svelte](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/src/SplatViewer.svelte)
- [Tipos/dominio y persistencia — src/domain.ts](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/src/domain.ts)
- [API y autorización — worker/index.ts](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/worker/index.ts)
- [Configuración de dos entornos — wrangler.jsonc](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/wrangler.jsonc)
- [Pruebas del piloto — tests/pilot.spec.ts](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/tests/pilot.spec.ts)
- [Propuesta de interfaz — docs/interfaz-base.md](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/docs/interfaz-base.md)
- [Producto y límites — docs/producto.md](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/docs/producto.md)
- [Piloto y criterios — docs/piloto.md](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/docs/piloto.md)
- [Estado real del frontend — docs/implementacion.md](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/docs/implementacion.md)
- [API local — docs/api-local.md](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/docs/api-local.md)
- [Aislamiento técnico — ADR-0001](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/docs/decisiones/0001-backend-cloudflare.md)
- [QR y carga progresiva — docs/qr-y-lod.md](https://github.com/keneth4/climbing-lab/blob/6fce9a7b2f70eab81df0799fbfc234d72bb27ec1/docs/qr-y-lod.md)

**Pendiente de una auditoría visual posterior:** ejecutar el producto en navegador y capturar sus flujos con datos realistas y escenas reales; contrastar los hallazgos de código con evidencia visual y pruebas con usuarios.
