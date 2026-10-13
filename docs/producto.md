# Visión y decisiones

Fecha de referencia: 12 de octubre de 2026.

## Propósito

Ofrecer sitios útiles para los gimnasios de escalada locales y mostrar las capacidades de Creativivid más allá de los menús de restaurantes. La experiencia conecta descubrimiento de rutas, progreso personal y difusión del gimnasio. Se contempla también escalada exterior.

## Acuerdos de producto

- La experiencia visual gira alrededor de un splat completo del gimnasio. Los sectores organizan rutas dentro de esa escena; no requieren capturas separadas.
- Solo el staff modifica el catálogo de rutas. Los escaladores pueden enviar reportes de errores.
- Las rutas pueden tener cámara inicial, agarres señalados y texto de beta.
- Los escaladores pueden llevar registro de intentos y ascensos.
- Se podrán exportar imágenes y videos de rutas, incluyendo tarjetas personales conectadas a la bitácora.
- El video puede mostrar varios ángulos mediante un barrido de cámara. Su trayectoria debe poder prepararse por ruta.
- Primero se desarrolla una interfaz funcional común; después se personaliza el diseño de los sitios.
- Se contempla ofrecer planes, mensualidades, promociones, pagos, dashboard financiero y tienda.
- El modelo de cobro del estudio está pendiente. El objetivo inicial es promover sus capacidades.
- El staff podrá generar QR de rutas y tarjetas de usuario para registro/login o visitas, con flujos distintos por propósito.
- Se evaluará priorizar detalle en la zona de la ruta seleccionada conservando el contexto del splat completo.

## Contexto de captura

La prueba disponible representa un spray wall: aproximadamente 751 mil gaussianos y un PLY original de 186 MB. El usuario estima que los gimnasios locales no superarán dos millones de gaussianos. Son datos de partida, no garantías de rendimiento.

Se compararán SPZv4 y SOG con el original. La descarga, decodificación, memoria y fluidez deben medirse en dispositivos reales antes de elegir el formato de publicación. No se ha inspeccionado todavía el archivo de prueba.

## Propuestas de diseño pendientes de validar

- Catálogo público sin login; cuenta requerida para la bitácora y operaciones personales.
- Cuenta del escalador compartida entre lugares, con permisos del staff y membresías aislados por gimnasio.
- Bitácora privada por defecto y ascensos declarados por el usuario.
- Beta opcional, inicialmente oculta.
- Publicaciones históricas conservadas cuando se retira una ruta.
- Marca del gimnasio y atribución discreta a Creativivid en exportaciones, según acuerdo del piloto.

## Límites

Resaltar agarres se resolverá inicialmente con superposiciones y marcadores. No se presupone segmentación automática ni que cada agarre sea un objeto seleccionable del splat.

Un recorrido de cámara presenta la ruta. Animar la secuencia de movimientos de una beta es un alcance adicional.

El primer dashboard describirá cobros, devoluciones, comisiones y pendientes. Calcular utilidad requerirá gastos y costos de productos.
