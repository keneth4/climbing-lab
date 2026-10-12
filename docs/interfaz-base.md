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

## Video posterior

El staff prepara puntos de cámara y previsualiza el barrido. Se revisan encuadre, oclusión y colisiones con el muro. El escalador selecciona formato y exporta.

Formato vertical y cuadrado son propuestas iniciales. Duración, resolución, audio y generación local o en servicio quedan pendientes de medición.

## Personalización

Separar identidad visual, componentes de presentación y reglas del producto. No se ha decidido todavía si la personalización usará temas, plantillas o composiciones específicas.

El editor, la consulta pública y la exportación deben compartir la definición de cámaras y marcadores para evitar resultados inconsistentes.
