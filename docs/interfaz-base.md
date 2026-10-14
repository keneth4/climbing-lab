# Pantallas y flujos de la interfaz base

La prioridad inicial es claridad funcional. Datos, servicios y lógica del visor deben poder mantenerse al cambiar el diseño de un sitio.

## Sitio público

- Inicio: identidad del gimnasio, información práctica y acceso al catálogo.
- Catálogo: filtros y listado de rutas junto al visor compartido.
- Ruta: cámara principal, marcadores, datos, beta desplegable y enlace directo.
- Acceso a cuenta: aparece al registrar actividad personal.

El visor utiliza una escena compartida, sin descargar un splat distinto por cada ruta. La interfaz debe admitir carga, error y consulta mediante imagen de respaldo.

## Cuenta del escalador

- Bitácora: intentos y ascensos por lugar y fecha.
- Proyectos: rutas pendientes.
- Registrar actividad: fecha, intentos, resultado y notas.
- Reportar error: categoría, descripción y ruta/revisión afectada.
- Exportar: vista previa de imagen de ruta o tarjeta de ascenso.

Categorías iniciales de reporte: marcador incorrecto, grado/descripción, agarre suelto y ruta retirada. Tratamiento operativo de reportes de agarres sueltos pendiente de acordar con el gimnasio.

La exportación permite decidir si se muestran nombre, fecha, intentos y notas. No publica automáticamente en redes sociales. El resultado se descarga para que el usuario lo comparta.

## Panel del staff

- Capturas: subir, orientar, previsualizar y elegir versión publicada.
- Rutas: borrador, publicación y retiro.
- Editor: navegar, guardar cámara, marcar agarres, añadir restricciones y beta.
- Reportes: revisar, resolver o descartar con motivo.
- Permisos: asignar capacidades por lugar.
- QR de rutas: previsualizar y descargar tarjetas imprimibles con enlace estable.

En gestión de socios se añadirán emisión/revocación de tarjetas y lectura de QR para confirmar visitas. El registro y el login mediante QR tienen flujos separados, descritos en [QR y LOD](qr-y-lod.md).

## Video posterior

El staff prepara puntos de cámara y previsualiza el barrido. Se revisan encuadre, oclusión y colisiones con el muro. El escalador selecciona formato y exporta.

Formato vertical y cuadrado son propuestas iniciales. Duración, resolución, audio y generación local o en servicio quedan pendientes de medición.

## Personalización

Separar identidad visual, componentes de presentación y reglas del producto. No se ha decidido todavía si la personalización usará temas, plantillas o composiciones específicas.

El editor, la consulta pública y la exportación deben compartir la definición de cámaras y marcadores para evitar resultados inconsistentes.

## Visor como área principal — 12 de octubre de 2026

El splat ocupa una región fija del viewport. Catálogo, detalle de ruta, edición, capturas/secciones, cuenta y bitácora se presentan dentro del panel plegable de herramientas. El scroll del panel no desplaza el visor. Preparación de agarres y revisión de capturas utilizan la misma región visual, sin sumar visores visibles. Cuando no hay captura de revisión lista se muestra la captura principal disponible.

En escritorio el panel se sitúa a la derecha; en móvil ocupa la parte inferior, dejando visible el muro arriba. **Plegar herramientas** amplía el visor; **Abrir herramientas** recupera el panel y sus borradores sin desmontar el editor. Los menús de navegación abren la herramienta elegida. La altura de encabezado se mide para no superponer navegación y muro al cambiar permisos o tamaño de pantalla.

- [x] Área fija para canvas y panel con scroll independiente.
- [x] Plegar/abrir panel, ampliación de canvas y soporte móvil.
- [x] Adaptar catálogo, preparación 3D y gestión de capturas.
- [x] Mantener contexto visual en cuenta, bitácora y staff.
- [x] Verificación de flujos existentes y capturas de pantalla en escritorio/móvil.

Pruebas: 12 flujos de navegador con auth/API simulados, tipos frontend y build. El splat de pruebas es sintético; falta validación ergonómica con Crux y dispositivos físicos. Se completó la instancia compartida de render descrita abajo. La optimización no altera los snapshots históricos.

## Renderer persistente — 12 de octubre de 2026

- [x] Una instancia de PlayCanvas y un canvas durante la vida del espacio de trabajo.
- [x] Herramientas conectadas al runtime mediante contexto; sus controles se colocan en el panel activo sin desmontar el motor 3D.
- [x] Reutilizar el splat si la captura conserva su identidad; actualizar overlays, callbacks y límites para la herramienta activa.
- [x] Conservar cámara al cambiar de módulo y recordar encuadres por ruta/captura durante la sesión de página.
- [x] Reemplazar modelo y cancelar descarga obsoleta al seleccionar otra captura; limpiar modelo administrado cuando no hay captura disponible.
- [x] Una sola instancia, mismos valores de cámara y ninguna nueva descarga al recorrer catálogo/cuenta/bitácora/catálogo en escritorio y móvil.

`SplatViewer` conecta las opciones de una herramienta. `SplatRuntime` posee motor, asset, navegación y memoria de cámaras; `ViewerWorkspace` administra qué herramienta utiliza los controles. El canvas se mueve junto con esos controles en el DOM conservando su identidad y ocupa siempre la región fija del visor. Sólo se conserva un asset cargado: volver a otra captura diferente exige descargarla nuevamente, aunque la instancia de render sobreviva. Los cambios de transformación o cámara inicial administrativa pueden reencuadrar de forma intencional.

La memoria de cámara no es una escritura en base de datos y se pierde al recargar la página. Guardar cámaras de ruta/gimnasio mantiene los flujos explícitos previos. Los paneles todavía pueden reconstruir formularios al cambiar de módulo; esta entrega conserva renderer y encuadre.

Verificación: 12 flujos de navegador escritorio/móvil con auth/API simulados y splat sintético; tipos y build. Se comprueba identidad DOM del canvas, valores numéricos de cámara después de desplazarla y ausencia de solicitudes nuevas al archivo. Una comparación de PNG idénticos no se utiliza como prueba de cámara porque los overlays/render GPU pueden variar. Falta QA ergonómico con Crux y dispositivos físicos.

## Sitio base de ejemplo — 13 de octubre de 2026

La navegación pública actual es Inicio, Rutas y El gimnasio, con Mi cuenta como acceso a la superficie personal. Cuenta agrupa actividad/proyectos/privacidad; staff autorizado tiene Rutas y reportes, Capturas (admin) y Recepción. El catálogo ya no muestra una ficha seleccionada implícitamente: abrir una tarjeta lleva a `?ruta=ID`. El área fija de visor/panel descrita anteriormente solo se activa al usar una herramienta 3D; la consulta normal utiliza lectura y scroll de documento. Marca, contenido y FAQ se definen en `GymSiteConfig`, sin CMS ni selección de gimnasio. Véase [implementación y comparación](sitio-base-ejemplo.md).
