# Ola 1 · Claridad y continuidad para visitante y escalador

**Estado:** primera entrega y correcciones O1-H01–H05 implementadas localmente; **segunda aceptación humana, QA actual en Crux y renovación autorizada del PNG D04 pendientes antes de fusionar PR #8**. Ver evidencia de la corrección al final.
**Base:** `main@96c11e7`, PR #7 integrado el 15 de octubre de 2026.
**Rama:** `codex/ux-publico-y-progreso`.
**Fuente:** auditoría `docs/auditoria-flujo-integral-ux-2026-10` @ `d0cefd5`, A01–A03, B01–B05, C01–C03, D01–D05 y F06 (texto público solamente). A05 se atiende con ese mismo ajuste de texto.

## Objetivo y criterio de salida

Un visitante encuentra rutas y recorrido desde cualquier página pública, entiende su zona y puede volver a la parada de origen. Un escalador registra un intento/ascenso con pocas acciones y encuentra actividad, proyectos y respuestas a reportes sin duplicidad ni pérdida de datos.

Esta entrega mejora el demo local canónico. No depende de declarar L1/L2/L3 aprobados: esas puertas remotas/físicas continúan pendientes. Conservar Crux, D04 revisión 4, Main Gym revisión 19 y las persistencias A/B/demo. No modificar cámaras, agarres, zonas ni publicaciones reales como parte de la implementación o QA automatizada.

## 1. Navegación y contenido público — A01–A03, F06

- Navegación persistente: Inicio, Rutas, Recorrido, El gimnasio y Mi escalada; Staff conserva sus permisos y navegación propios. Cuenta y privacidad seguirá disponible desde Mi escalada. Mantener `?vista=Recorrido`, `?vista=Bitácora`, `?vista=Proyectos`, `?vista=Cuenta`, filtros y `?ruta=` compatibles.
- Inicio tendrá un primario «Explorar rutas». El recorrido será un bloque secundario con imagen publicada cuando exista y acceso sin WebGL. «El gimnasio» ofrecerá información práctica disponible y FAQ; no inventar dirección, horarios, precios ni contactos.
- Añadir GymSiteConfig v2 aditivo, con normalización de v1 y validación en repositorio. Campos opcionales: ubicación textual/enlace de mapa, horarios como texto confirmado, servicios, contactos/redes, hero e información básica de título/descripción para páginas públicas. Assets editoriales locales registrados; enlaces de mapa/redes HTTPS, teléfono/correo con sus esquemas específicos. Rechazar esquemas ejecutables y campos inválidos.
- Omitir secciones sin información. Mantener el aviso de gimnasio ficticio y los dos temas. Configuración editorial separada de identidad, roles, bindings y `/api/config` operativo. Sin CMS, SSR, sitemap, datos estructurados de negocio ni estrategia SEO nueva (A04/Ola 4).
- Rotular el catálogo comercial «Productos disponibles» y «Consulta en recepción». No añadir checkout ni cambiar ventas, stock o cobros existentes.

## 2. Catálogo y continuidad del recorrido — B01–B04, C01–C03

- Tarjetas/ficha priorizan nombre, grado, sector/zona, imagen y estado. «Retirada» seguirá prominente; mover revisión técnica a «Información de ruta», preservando historia y atribución de exportaciones.
- Resolver el nombre de zona desde referencias públicas existentes. Mostrar «N rutas de [zona]» y chip eliminable. Ante referencia inexistente o error de lectura, mostrar «Zona no disponible», conservar el ID para diagnóstico secundario y permitir quitar/reintentar; no adivinar nombres.
- Conservar procedencia tour/parada/revisión publicada al entrar a una ruta o zona. Añadir parámetros opcionales `tourOrigen`, `paradaOrigen`, `revisionOrigen`; sólo IDs/revisión validados, nunca un returnUrl externo. Resolver nombres mediante API pública y ofrecer «Volver a [parada]».
- El retorno usará enlaces `?vista=Recorrido&tour=ID&parada=ID&revision=N`. La revisión opcional se leerá mediante el endpoint histórico ya existente; mantener enlaces sin revisión. Respetar retiro y disponibilidad actuales del 3D. Si el origen es inválido/inaccesible, explicar la pérdida de contexto y ofrecer recorrido vigente sin sustituirlo silenciosamente.
- Conservar filtros/scroll al volver al catálogo y estado de navegación mediante Atrás/Adelante. El login conserva destino y procedencia; parámetros de origen no constituyen autorización ni exponen borradores.
- Paradas como tarjetas con imagen/título en escritorio; selector compacto con contador en móvil. Poster, texto, Anterior/Siguiente y enlaces siguen funcionando durante carga, cancelación, fallo o ausencia de WebGL. Cámara directa, sin autoplay ni vuelos; «Volver a esta parada» conserva su comportamiento.
- Mantener una sola instancia activa del visor y la reutilización de escena al cambiar de parada. No prometer conservar GPU/descarga al abandonar completamente la pantalla; al regresar, contenido y cámara de la revisión conservada estarán disponibles y el 3D seguirá bajo demanda.
- Mantener filtrado actual en cliente. Medir localmente cantidad, bytes y tiempo a listado útil con fixtures de 100 y 1.000 rutas, separando descarga/filtrado/render, sin enviar notas, identidad ni nuevas trazas. Registrar resultados sin umbrales de rendimiento inventados; búsqueda/paginación backend se decide después de medir.
- Atajos iniciales sólo con criterios existentes: «Recientes» reutiliza el orden actual y «Esta zona» el contexto validado. No incorporar «Para empezar», «En mi nivel» ni etiquetas de movimientos/estilo sin definición aprobada y datos. B03/B04 se registrarán como parciales si esas extensiones siguen pendientes.

## 3. Registro breve y Mi escalada — B05, D01–D05

- En ficha: resultado Intento/Ascenso, intentos (predeterminado 1) y Guardar visibles. «Añadir detalles» despliega notas y fecha/hora opcional. Ocultar detalles no borra lo escrito; elegir Ascenso no guarda automáticamente.
- Reutilizar `occurredAt` y las validaciones de fecha del registro existente. Si la fecha no se edita, conservar la fecha automática del servidor; si se edita, interpretar hora local del dispositivo y enviar UTC, indicándolo en el campo. Una vez enviado, fijar el payload para reintentos idempotentes.
- Ampliar únicamente el borrador local con fecha opcional/estado de detalles. Preservar aislamiento por cuenta/ruta/revisión, retorno de login, revisión concurrente, doble envío, Ver registro y Deshacer. Error de red, 401 o 429 conserva los campos y la misma clave de reintento cuando el payload no cambie.
- Mi escalada tendrá Actividad, Proyectos, Mis reportes y Cuenta y privacidad. La entrada mostrará Actividad; los enlaces antiguos conservarán sus destinos equivalentes. Eliminar el panel completo de proyectos duplicado en Bitácora; proyectos tendrá lista visible y estado vacío con «Explorar rutas».
- Actividad mostrará lista cronológica y resumen del intervalo aplicado. Predeterminado «Últimos 7 días» como ventana móvil de 168 horas; «Todo el historial» y filtros personalizados explícitos. Enviar límites UTC con los contratos actuales, mostrar el alcance y la zona de presentación sin llamarlo semana calendario ni visitas. Filtros avanzados y CSV pasan a controles secundarios; mantener ambos formatos y exportación de todo el intervalo.
- Las consultas conservan resultados previos mientras actualizan. Confirmar reemplazo sólo tras respuesta válida para consulta e identidad vigentes; un fallo conserva los datos con el intervalo que realmente representan y permite reintentar la consulta solicitada. Agrupación diaria fallida no elimina la lista válida. Cancelar/ignorar respuestas obsoletas.
- Al cerrar/cambiar cuenta, limpiar inmediatamente listas, resúmenes, reportes, proyectos, exportaciones y consultas en vuelo. Nunca mostrar datos del propietario anterior, ni siquiera durante carga. Preparación/filtros privados se conservan sólo en memoria de la cuenta activa; no almacenar notas en URL/historial.
- Cuenta y privacidad mantiene perfil, controles actuales de datos/privacidad y cierre de sesión. UUID/instrucciones de autorización sólo bajo herramientas de diagnóstico plegadas para admin confirmado en desarrollo con modo Vite `demo` y origen loopback. No añadir roles ni modificar autenticación.
- Mis reportes será una vista visible con conteos pendientes/resueltos, categoría, descripción, respuesta y enlace a la ruta/revisión. Usar `/reports` propio y manejo de error/reintento; preservar aviso de acudir al staff por agarre suelto. Resolver un reporte no cambia la ruta.
- Guardar proyecto no crea actividad; completar proyecto sigue siendo explícito. Mantener selección exacta de privacidad y snapshots históricos en tarjetas/CSV.

## Interfaces y compatibilidad

Sin endpoints, migraciones ni cambios de snapshots/publicación. Cambios aditivos locales: config editorial v2, contexto validado de navegación, estado de filtros/consultas y borrador de registro. Reutilizar API de rutas, secciones, tours/revisiones, proyectos, actividad y reportes. Extraer componentes pequeños de presentación cuando ayude; no ejecutar el refactor global de App ni el workspace staff (Ola 2).

Preservar el cierre seguro y rate limiting de Ola 0. QR seguirá como vista previa e impresión pública deshabilitada; ni el origen editorial ni una URL de configuración habilitan impresión. No ampliar analítica persistente ni introducir rastreo individual.

## Validación y aceptación

- Sitio: configuración v1/v2, omisión de campos, enlaces inválidos, aviso ficticio, primer CTA y acceso persistente al recorrido; compatibilidad de URLs antiguas.
- Navegación: Inicio → Recorrido → parada → zona → ruta → login → registro → volver a la parada/revisión; Atrás/Adelante, recarga, filtros/scroll, origen inválido, recorrido retirado y revisión histórica.
- Consulta: rutas activas/retiradas/ID inválido, API caída, poster ausente, descarga cancelada, fallo de asset y recuperación; texto y navegación sin WebGL. Cambio de parada conserva canvas y no vuelve a descargar la escena.
- Registro: intento/ascenso, detalles abiertos/cerrados, fecha opcional, reintento tras respuesta perdida, 401/429, doble toque, revisión concurrente, ruta A→B, cambio/logout de cuenta, Ver registro y Deshacer. Cero duplicación o atribución a otra ruta/cuenta.
- Actividad: carga inicial, paginación/filtros lentos, errores de lista y agrupación, respuestas fuera de orden, resumen del intervalo correcto y limpieza inmediata por identidad. Resumen no presenta la página parcial como total.
- Cuenta: proyectos sin ascenso implícito, reportes y resolución propia, enlaces históricos, diagnóstico oculto para usuario normal/producción, privacidad exacta de exportaciones.
- QA en navegador interno: 320/390/768/1440 px, ambos temas, teclado/foco, zoom 200%, mensajes accesibles y objetivos táctiles de 44 px como mínimo. Anotar diferencias entre fixtures automatizados, QA real local y validación humana/física pendiente.
- Ejecutar tipos frontend/backend, formato, dominio/API, build, e2e y smoke público con `DEMO_REUSE_SERVER=1`. Añadir regresiones por los comportamientos anteriores. Sin setup/reset contra el demo persistente; escrituras automatizadas sólo en fixtures desechables. No publicar rutas/tours reales como prueba.

## Entrega propuesta tras aprobación

Un PR de Ola 1 con dos bloques revisables, en este orden:

1. Navegación/configuración editorial; continuidad tour/zona/ruta y presentación pública.
2. Registro breve; Mi escalada, consultas resistentes a fallos y seguimiento de reportes.

Commits separados para modelo/configuración, público/recorrido, actividad/cuenta y QA/documentación. Actualizar matriz de hallazgos y roadmap con resuelto/parcial/pendiente y evidencia. Abrir PR a main al finalizar implementación; sin fusión ni despliegue automático. Si surge necesidad de backend nuevo o una decisión de producto fuera de los criterios definidos, registrarla para revisión antes de ampliar alcance.

**Alcance aprobado por el propietario:** Mi escalada, últimos 7 días y atajos limitados a criterios existentes. Teléfonos reales, lector de pantalla, tareas moderadas y L1–L3 permanecen fuera de aceptación local.


## Evidencia de entrega — 15 de octubre de 2026

- Tipos frontend/backend y formato aprobados; 39 pruebas de dominio/frontend y 59 API aprobadas. Build aprobado con el aviso de chunks grandes existente; sin afirmación de rendimiento físico.
- Suite completa estable: **124 e2e aprobados**, con fixtures de auth/API para escrituras. Incluye inicialmente 10 casos nuevos (5 escenarios por escritorio/móvil): origen histórico con recarga/retorno, 429 con payload idéntico, página retenida/errores diarios/reportes/logout, y catálogos sintéticos de 100/1.000 rutas.
- Regresión posterior al ajuste final de foco/títulos: **32 aprobadas**. Ronda final Ola 1: **12 aprobadas**, incluyendo dos verificaciones nuevas de respuesta tardía después del logout (escritorio/móvil). Ningún dato privado reaparece tras cerrar sesión.
- Smoke público real: **6 aprobados** con `DEMO_REUSE_SERVER=1`, sin setup/reset ni interceptar `/api`. Preserva las pruebas existentes de red/recuperación, QR y exportación ilustrativa.
- Las primeras rondas detectaron selectores antiguos y el efecto de cambios durante ejecución; se corrigieron las pruebas para usar detalles/filtros explícitos y todo el historial cuando una actividad retroactiva queda fuera del intervalo. La suite completa final se ejecutó sin cambios de código simultáneos; no se rebajaron verificaciones del visor ni de privacidad.
- QA navegador interno: Inicio/Recorrido/Mi escalada/Reportes y ficha D04; 320/390/768/1440, ambos temas sin overflow, paradas y registro con teclado, imagen/texto sin iniciar 3D. La matriz automatizada incluye zoom 200%, fallback WebGL, DPR 1/2/3, canvas persistente, errores y permisos. Tras recarga limpia en el navegador interno, la consola no mostró errores ni advertencias nuevos y Registrar actividad enfocó Intentos.
- Main Gym real mantiene sus tres paradas y revisión 19; no tiene enlaces zona/ruta configurados, por lo que la continuidad de ida/vuelta se prueba con fixtures y endpoint histórico existente. No se añadieron enlaces ni se editaron paradas reales para forzar esa prueba.
- Capturas sólo locales: `/tmp/climbing-ola1-tour-ANCHO-TEMA.png` y `/tmp/climbing-ola1-registro-mobile.png`. No subir esas imágenes de Crux a Git ni a un destino público.

### Mediciones sintéticas reproducibles

`npx playwright test tests/ola1.spec.ts --grep "catalog measurement"` usa el frontend real y API interceptada con fixtures, no red de producción. Resultados locales JSON en `/tmp/climbing-ola1-catalog-PROYECTO-CANTIDAD.json`. `catalog:download` incluye lectura/paginación/normalización, `catalog:filter` la última ejecución de filtro y `catalog:render` la actualización DOM hasta tick; no incluye necesariamente pintura final o carga de imágenes. Los bytes son JSON servido por la fixture, incluyen revalidaciones y no representan transferencia comprimida. No son percentiles ni umbrales de aceptación.

| Fixture / viewport emulado | JSON servido (bytes) | Lectura (ms) | Filtro final (ms) | Actualización DOM (ms) |
| --- | ---: | ---: | ---: | ---: |
| 100 / desktop | 153894 | 27.8 | 0.3 | 18.7 |
| 100 / mobile | 153894 | 54.6 | 0.2 | 16.8 |
| 1000 / desktop | 1550118 | 199.3 | 1.1 | 64.5 |
| 1000 / mobile | 1550118 | 167.5 | 1.1 | 53.2 |

Conservar filtrado cliente en esta entrega. B03/B04 permanecen parciales; una eventual paginación backend deberá preservar filtros/URLs/orden y decidirse con datos representativos de uso y dispositivos. Sin eventos analíticos nuevos, notas, identidad ni contenido personal en estas mediciones.

### Puertas abiertas

L1/L2: recursos, origen público, callbacks y recuperación remota conjunta. L3: teléfonos, lector de pantalla, QR impreso y rendimiento físico. La revisión humana previa de D04/Main Gym se conserva, pero no acredita las tareas moderadas nuevas de Ola 1. No se ejecutaron migraciones, despliegues ni publicaciones reales en esta entrega.

## Extensión de Ola 1 — Revisión manual del propietario (15 de octubre de 2026)

**Estado:** la revisión humana de la primera implementación del PR #8 se realizó y reveló **cinco mejoras bloqueantes pendientes**. No fusionar todavía. Esta sección es el nuevo contrato de implementación para Codex en esta misma rama; conserva las pruebas previas pero exige una nueva revisión humana del resultado. No reescribir retroactivamente el historial de la entrega anterior.

### Hallazgos confirmados y decisiones de diseño

| ID | Observación | Evidencia en rama | Implementación requerida |
| --- | --- | --- | --- |
| O1-H01 | Inicio y final se confunden con agarres numerados | `SplatRuntime.svelte` genera I1 y F9 a partir del índice del arreglo | Inicio **I**, Final **F**, sin numeración; marcadores más distintivos y accesibles, intermedios discretos |
| O1-H02 | Grado y sector se pierden junto al nombre | `App.svelte` dibuja nombre y grado dentro del mismo h2 y sector debajo | Título solo para el nombre; **Grado: V1** y **Sector: Spray Wall** en piezas separadas y prominentes |
| O1-H03 | «Información de ruta» contiene solo número de revisión y UUID | `App.svelte` incluye «Revisión 4 · Identificador ...» | Mostrar **grado, sector, inicio, final y reglas si existen**; metadatos internos fuera de la ficha, incluso para staff habitual |
| O1-H04 | «Agarres y reglas sin beta» es poco útil; beta/reglas vacías agregan ruido | `RoutePresentation.svelte` lista todos los agarres por ordinal y rellena reglas vacías; `App.svelte` muestra beta vacía | Eliminar lista numérica pública, poner leyenda compacta; beta y reglas **completamente ausentes** cuando están vacías |
| O1-H05 | «Editar ruta» despliega editor dentro de ficha de lectura | `App.svelte` monta `RouteEditor` dentro de details | Botón «Editar ruta» solo staff → **pantalla de edición separada** con los seis pasos y mismo visor |

**Ejemplo:** «Prueba D04 · Crux local» es un **nombre** de prueba; V1 es su **grado**. Nunca extraer nivel del texto del nombre ni modificar datos guardados para disimular un problema de jerarquía.

### Investigación: qué aprender de otras interfaces

- [MoonBoard — reglas oficiales](https://moonclimbing.com/using-your-moonboard) y [guía del sistema LED](https://static1.squarespace.com/static/5b680ff22714e5a2859144bf/t/5e4422a70c7e7311c6a60ecc/1581523625176/how%2Bto%2Buse%2Bthe%2Bmoonboard.pdf): inicio(s), agarres permitidos y final(es) son funciones distintas. Verde/azul/rojo ofrece reconocimiento rápido, pero se necesita un segundo canal visual.
- [Stōkt — Features](https://www.getstokt.com/features): los **circuitos** numerados son una modalidad específica. Un problema habitual no debe asumir un orden obligatorio de movimientos.
- [Clift — Special Holds](https://www.cliftclimbing.com/post/setting-routes-with-special-holds-using-clift): inicio, normal y final son roles asignados a cada presa; etiquetas externas pueden distinguirlos sin cubrir la geometría.
- [W3C WCAG 2.2 — Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html): forma, etiqueta y descripción deben acompañar al color.

Estas referencias sustentan las recomendaciones, no sustituyen la validación manual en Crux.

### O1-H01. Marcadores: contrato visual, semántico y de exportación

1. **Ruta convencional por defecto:** `inicio → I`, `final → F`, `intermedio → punto azul discreto`. No mostrar números de inicio/final. **Intermedios sin número público por defecto**: no existe una secuencia obligatoria de beta. Si se necesita índice para editar, mostrarlo en inspector/lista de staff o un modo «Mostrar índices» solo allí; un futuro «Circuito numerado» requeriría feature separado.
2. **Distinguir de inmediato:** verde + letra **I** + forma/contorno para inicio; terracota/rojo + **F** + forma/contorno diferente para final; azul discreto para intermedios. Incluir leyenda visible **«I Inicio · F Final · • Intermedio»** cerca de la imagen y del visor 3D, sin depender solo del color, y nombres accesibles completos.
3. **Múltiples presas:** conservar todos los `holds3D` y sus roles. I/I y F/F son correctos cuando hay dos inicios/finales; no inferir «mano izquierda/derecha», orden de escalada ni regla de pies del índice del arreglo. No renumerar ni modificar ID/posición/datos históricos.
4. **No tapar la presa:** mantener ancla proyectada pequeña, líder y pastilla desplazada de UX-P0, hitbox invisible de ~48 CSS px para edición; **nunca** volver al círculo opaco centrado sobre el agarre. Dar prioridad a I/F en algoritmo de colisiones. Mantener selección, ocultar etiquetas, «Solo inicio y final», manejo de densidad, dispositivos táctiles y teclado.
5. **Unificar marcador visible y exportado:** cambiar la función de rótulos de `src/SplatRuntime.svelte`, helper semántico y diseño en `src/marker-layout.ts`, `src/RouteMarkerOverlay.svelte` y `drawMarkerLayout()` para PNG nuevo. Las marcas de **paradas de tour** siguen numeradas por parada, independientes de roles de ruta: no alterar `tourMode`.
6. **Imágenes históricas:** `RoutePresentation` lee una imagen PNG **ya anotada**. Los símbolos I1/F9 de un PNG antiguo no desaparecen al cambiar el DOM o el visor. **No sobreescribir R2 ni revisiones históricas.** Regenerar imagen de la ruta D04 para nueva revisión **solo tras revisión y autorización explícita del propietario**. Documentar la diferencia temporal de imagen vieja y overlay actualizado; no declarar corregida la foto existente sin regenerarla.
7. Probar DPR 1/2/3, CSS→PNG, desplazamiento de canvas, 320/390/768/1440 px, alto contraste y varios agarres adyacentes. Nunca multiplicar `screenToWorld` por el tamaño de framebuffer.

### O1-H02/H03/H04. Ficha: información necesaria y nada de relleno

**Orden de lectura esperado:**

- «Volver a Rutas» / retorno contextual a la parada del tour.
- Título **solo nombre**. Debajo, chips o ficha breve de alto contraste **GRADO V1** y **SECTOR Spray Wall** (zona opcional con nombre conocido). Si la ruta está retirada, mostrar el estado excepcional claramente; no repetir «Activa» innecesariamente.
- Imagen anotada/preview, o fallback honesto; leyenda visible I/F y referencia a intermedios cuando haya marcadores verificados.
- **Información de ruta** breve, sin esconder datos útiles: etiqueta grado, sector, indicación textual de agarres de inicio y final (y sus cantidades si están verificadas), más «Reglas» **solo** si `route.rules?.trim()` tiene contenido. Evitar repetir varias veces el mismo dato en grandes párrafos; accesibilidad semántica mediante `dl`/etiquetas según presentación.
- «Ver beta» plegada **solo** si `route.beta?.trim()` tiene contenido (no autogenerar movimientos ni texto de relleno). Si no hay reglas/beta, **no renderizar** sus encabezados ni placeholders.
- Registrar actividad, Guardar proyecto, Compartir y Reportar permanecen funcionales y sin regresión; la información del problema debe estar disponible antes de iniciar sesión o descargar 3D.
- Quitar la lista pública «Agarre 1, Agarre 2...»: comunica un orden potencialmente falso. Staff accede al inventario técnico de agarres **en el editor**, sin duplicarlo en ficha de lectura.
- **Nunca mostrar UUID ni revisión técnica sin contexto** en «Información de ruta», tarjetas, exportaciones públicas o la vista ordinaria de staff. Una vista explícita «Detalles técnicos/Historial» solo en administración puede ofrecer versión e ID copiable cuando tenga uso real. Mantener IDs y revisiones en API/URL/logs para enlaces estables e historia.

**Ejemplo de jerarquía:**

    ← Volver a Rutas
    Prueba D04 · Crux local
    [ GRADO  V1 ] [ SECTOR  Spray Wall ]
    [ Imagen del muro con I / F y puntos intermedios ]
    I Inicio  ·  F Final   [· Intermedios]
    Información de ruta: Inicio (I) / Final (F)
    Reglas: ...       [solo cuando existen]
    Ver beta          [solo cuando existe]
    [ Explorar 3D ] [ Registrar actividad ]
    Staff: [ Editar ruta → pantalla independiente ]

Esta jerarquía puede ajustarse al ancho sin cambiar la semántica o esconder el grado.

### O1-H05. Pantalla independiente de edición (staff)

- Sustituir `<details><summary>Editar ruta</summary><RouteEditor .../></details>` de la ficha por un **botón real** «Editar ruta». Mostrarlo únicamente con staff/rol vigente confirmado, y autorizar lecturas/escrituras **en el Worker**; ocultar el botón no es control de acceso.
- Reutilizar **el mismo `RouteEditor` y sus seis pasos** dentro de un `EditorWorkspace` o shell de pantalla propio: nombre de ruta, estado, retorno a ficha, visor persistente, barra Guardar borrador/Actualizar/Publicar y avisos de cambios locales.
- Para deep link privado evitar `?ruta=ID` porque `viewFromUrl()` lo interpreta siempre como Catálogo. Opción de URL: `/?vista=EditarRuta&editar=ID` y, si se integra creación, `/?vista=CrearRuta&seccion=ID`. Preservar `/?ruta=ID` para lectores/QR y `?vista=Recorrido` para tours. Validar IDs y parámetros, no implementar URLs de retorno abiertas.
- Acceso desde **Staff → lista → Editar** y desde la ficha para staff; vuelta, Atrás/Adelante, recarga, expiración de sesión y enlace privado abierto sin permisos deben mostrar estados correctos. Nunca presentar datos de edición a escalador con 401/403 ni seleccionar silenciosamente otra ruta.
- Reutilizar `editorPreparation`, `onDraft`, `onPreparing`, `onReload`, `onSaved`, `viewerWorkspace`, permisos, cámara, snapshot y revisiones; **no crear un segundo renderer** ni alterar geometría o contratos del backend.
- Si existen cambios no guardados, preguntar **«Seguir editando» o «Salir sin guardar»**. Distinguir «Preparación local (se perderá al recargar)» de «Borrador guardado» y «Publicado»; **la persistencia de borrador de nuevas revisiones en servidor pertenece a Ola 2**. No prometer recuperación después de reload completa.
- Tras guardar/publicar, volver a la ficha de **la misma ruta** con datos actualizados; cancelar vuelve sin crear una revisión ni borrar preparación indebidamente. Preservar retorno desde tour al consultar ruta y luego editor.
- La UI de edición debe seguir funcionando en inspector lateral de PC y bottom sheet móvil. Mostrar solo tareas del editor, sin registrar actividad/reportes/compras/FAQ en esa pantalla.

### Commits posteriores a este commit documental

| Commit | Cambio de código | Evidencia requerida |
| --- | --- | --- |
| O1-1 | Semántica y apariencia de marcadores I/F + leyenda + export PNG; modo tour sin cambios | Unit de roles, multiples I/F, DPR, densidad, CSS→PNG, teclado, lectura, tour |
| O1-2 | Ficha: chips grado/sector; información útil; omisión de beta/reglas vacías; eliminar UUID y lista confusa | E2E rutas con/sin reglas y beta, antiguas/retiradas, dos temas, 320/390/768/1440 |
| O1-3 | Pantalla de edición y rutas privadas protegidas; 6 pasos existentes y regreso | E2E staff/no staff, reload/popstate, permisos, draft/cancelar/guardar, visor único |
| O1-4 | QA integral, documentación, evidencia y **segunda aceptación humana** antes de merge | Suite completa Ola 1, 6 smoke públicos sin reset, Crux manual sin editar/publicar salvo autorización |

### Criterios de aceptación bloqueantes para PR #8

- [ ] En D04 local con nueve agarres, **I/F son evidentes** y no aparecen I1/F9; puntos intermedios no sugieren secuencia.
- [ ] Una ruta con dos agarres de inicio/final los muestra y describe correctamente; sin depender exclusivamente de verde/rojo.
- [ ] Encabezado separa **nombre**, **Grado V1**, **Sector Spray Wall**; se reconocen a primera vista en desktop/móvil y con 200% zoom.
- [ ] Información de ruta contiene **grado, sector, inicio/final** y **reglas solo si las escribió el staff**; no UUID ni revisión técnica irrelevante.
- [ ] Sin beta/reglas no hay controles ni texto de relleno; con beta se mantiene opción «Ver beta» sin spoilers.
- [ ] La lista numérica de agarres se elimina de la ficha pública, conservando roles y accesibilidad en editor.
- [ ] Staff abre editor en pantalla separada, sin herramientas de escalador mezcladas; cuenta ajena no puede entrar por URL directa.
- [ ] Guardar/cancelar/volver no cambia permisos, revisión ni datos ajenos; historial y QR públicos continúan intactos.
- [ ] Vista 3D y nuevas exportaciones PNG comparten semántica; PNG antiguos conservados, Crux real no republicado automáticamente.
- [ ] El tour conserva números de **paradas** y accesos zona→ruta; registro rápido, privacidad/logout y seis smoke reales no retroceden.
- [ ] **Propietario revisa de nuevo** la ficha y su editor en el mismo Crux y confirma claridad del inicio/final, grado/sector y navegación antes del merge.

**Comprobaciones:** `npm run check`, `npm run check:api`, `npm run format:check`, `npm test`, `npm run test:api`, `npm run build`, `npm run test:e2e`. Smoke público sin interceptar API solo con `DEMO_REUSE_SERVER=1` en demo persistente; **nunca** ejecutar `demo:setup`, `demo:reset` o `demo:smoke` que reinicialicen Crux. Especificar en el PR qué se verificó con fixtures y qué quedó pendiente de teléfonos físicos/lector.

### Una elección de producto a confirmar sin bloquear el inicio

**Numeración de agarres intermedios:** recomiendo **ocultarla en rutas normales del público**, y conservarla como ayuda opcional en el editor de staff. Alternativa: hacerla visible al visitante mediante «Mostrar números»; eso podría interpretarse como beta secuencial. Se puede implementar el valor recomendado y reconsiderar después de la segunda revisión del propietario. Inicio y Final sí son siempre I/F sin números.

**Fuera del alcance de esta extensión:** detección automática de agarres, nuevas funciones de circuito, diseño de tres gimnasios, migraciones, nuevas rutas reales, edición de tour, staging y habilitación de pagos.

### Decisiones confirmadas para la implementación

- «Descartar cambios y salir» elimina únicamente la preparación temporal de la cuenta y ruta abiertas y vuelve a la versión guardada. Confirmación: «Se descartarán los cambios locales de esta ruta», con «Seguir editando» y «Descartar cambios y salir». No crea una revisión.
- Mantener alcance de Ola 1: los borradores independientes de rutas publicadas en servidor siguen en Ola 2. La preparación actual permanece en memoria y no garantiza recuperación tras recargar ni entre dispositivos.
- Intermedios públicos sin numeración. PNG históricos intactos; regenerar D04 exige revisión y autorización para una nueva revisión. Segunda aceptación humana pendiente antes de fusionar PR #8.


### Resultado de implementación y QA de la corrección — 15 de octubre de 2026

**Código:** marcadores I/F/punto con forma y nombre accesibles, paths compartidos SVG/PNG y geometría CSS 1:1; numeración de paradas intacta. Ficha con nombre separado de grado/sector/zona, cantidades verificadas, omisión de reglas/beta vacías y metadatos técnicos. Editor independiente `?vista=EditarRuta&editar=ID`, permisos vigentes, seis pasos y runtime único; guardado vuelve a la misma ficha. Salida confirmada descarta la preparación de esa cuenta/ruta y sus bases obsoletas hasta la revisión abierta, conservando preparaciones ajenas. Atrás/Adelante, recarga, sesión vencida y retorno desde tour cubiertos.

**Defectos observados y corregidos durante QA:** la navegación fija tapaba «Seleccionar punto» en móvil; las dos barras podían consumir el panel compacto; las etiquetas podían quedar bajo el inspector; una base antigua podía reaparecer después de descartar ante concurrencia. Se reservaron insets de desplazamiento, navegación no fija cuando no queda altura útil, acciones sobre la altura real de guardado, zona ocluida en colocación de etiquetas y eliminación de bases obsoletas de la misma preparación. No se mueve el renderer. Los tests de densidad usan el control Compacto cuando falta espacio, manteniendo anclas y selección desde lista; no se forzaron clicks a través de overlays.

| Evidencia actual | Resultado |
| --- | --- |
| `npm run check`, `npm run check:api` | Aprobados; frontend sin errores ni advertencias |
| `npm run format:check`, `npm run build` | Aprobados; persiste aviso conocido de chunks grandes |
| `npm test`, `npm run test:api` | 40 frontend/dominio y 59 API aprobadas |
| `npx playwright test --workers=2` sobre fixtures aislados en 5173 | **136 aprobadas en una pasada final**, después de corregir los fallos encontrados; log `/tmp/ola1-corrections-release.log` |
| Matriz visual de fixtures | 320/390/768/1440, ambos temas, teclado, zoom 200 %, DPR 1/2/3, fallback sin WebGL, un canvas y controles alcanzables |
| Inspección visual de capturas de fixtures | Ficha con chips claros e I/F diferenciados; evidencia fuera de Git en `/tmp/ola1-corrections-detail-*` y `/tmp/p0-layout-*` |
| Demo persistente | Iniciado con `npm run demo:run`, sin setup/reset; 5174 HTTP 200 y `/api/health` vía Vite/Worker confirma gym-demo saludable. Comprobaciones reales de lectura D1/R2, ilustraciones y borrador protegido aprobadas al arrancar |
| Integridad local conservada | API pública: D04 revisión 4, nueve agarres; Main Gym revisión 19; sin publicación ni reemplazo de imagen |
| Navegador interno y smoke real de navegador de esta corrección | **Pendientes**: la herramienta rechazó el acceso al demo por política de URL. No se accedió por otro navegador como atajo. El smoke se dejó compatible con la ficha nueva; los seis smoke de la entrega anterior siguen como evidencia histórica |
| Segunda aceptación / PNG histórico / dispositivos físicos | **Pendientes**. I1/F9 siguen en el PNG D04 antiguo; no se sobreescribió R2. Renovarlo requiere revisión y autorización para nueva revisión. Teléfonos, lector y rendimiento físico no acreditados |

PR #8 permanece abierto: sin merge ni despliegue. Runbook en `docs/demo-local.md`. Las capturas Crux y las sesiones privadas no se adjuntan al PR ni a Git. Los borradores independientes en servidor quedan para Ola 2; no se promete recuperación entre dispositivos con la preparación temporal actual.
