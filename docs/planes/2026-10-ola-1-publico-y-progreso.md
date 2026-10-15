# Ola 1 · Claridad y continuidad para visitante y escalador

**Estado:** propuesta para revisión; implementación no iniciada.  
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

**Revisión pendiente:** aprobar este alcance y los valores por defecto (Mi escalada, últimos 7 días, atajos limitados a criterios existentes) antes de comenzar código. Teléfonos reales, lector de pantalla, tareas moderadas y L1–L3 permanecen fuera de aceptación local.
