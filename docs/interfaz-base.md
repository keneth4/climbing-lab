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

Pruebas: 12 flujos de navegador con auth/API simulados, tipos frontend y build. El splat de pruebas es sintético; falta validación ergonómica con Crux y dispositivos físicos. Se mantiene pendiente compartir una única instancia de render entre cambios de herramienta para evitar recargas: plegar el panel sí conserva la instancia actual. La optimización no altera la región visible ni los snapshots históricos.
