# Piloto funcional

## Objetivo

Validar el flujo completo: el staff publica una ruta, un escalador la consulta, registra un ascenso, exporta una tarjeta y otra persona abre el enlace a esa ruta.

## Alcance

1. Un gimnasio piloto y un splat completo, con estructura preparada para otros lugares.
2. Configuración de orientación y vista general de la captura.
3. Rutas con nombre, grado y sistema de graduación, sector, color opcional, fecha, descripción y estado.
4. Cámara principal por ruta y marcadores de inicio, intermedios y final.
5. Restricciones de pies y beta opcionales.
6. Publicación y retiro de rutas mediante permisos del staff.
7. Catálogo público con filtros y enlaces directos a rutas.
8. Cuenta del escalador, proyectos pendientes, intentos y ascensos.
9. Reportes revisados por el staff.
10. Exportación de imagen de ruta y tarjeta personal.

## Comprobaciones previas

- Comparar SPZv4 y SOG: tamaño transferido, tiempo hasta la vista útil, decodificación, memoria cuando sea medible y fluidez.
- Probar escritorio y teléfonos representativos del público local; documentar modelos y navegadores.
- Comprobar detalle de agarres, posición de marcadores y comportamiento de oclusión.
- Preparar varias rutas sobre el mismo spray wall y medir tiempo de edición.
- Comprobar que la imagen exportada incluye el modelo y los marcadores.

Los umbrales de aceptación de rendimiento se fijarán después de la medición inicial y antes de evaluar el piloto.

## Criterios de aceptación funcional

- Seleccionar una ruta mueve la cámara a su vista y muestra sus marcadores.
- Un visitante puede consultar el catálogo sin cuenta.
- Un escalador no puede editar rutas ni consultar bitácoras ajenas sin autorización.
- Un reporte entra a revisión sin alterar la ruta publicada.
- Un ascenso conserva su referencia histórica al retirar o revisar una ruta.
- La tarjeta deriva sus datos del registro y permite elegir qué información personal mostrar.
- El enlace compartido abre la ruta correspondiente; una ruta retirada se identifica como histórica.
- Cambiar la captura no reutiliza silenciosamente coordenadas incompatibles.
- Si el visor falla, siguen disponibles la ficha y una imagen de respaldo.

## Fuera del primer piloto

Exportación de video, cobros reales, tienda, control de acceso físico, competencias, creación de rutas por usuarios, segmentación automática y alineación automática de capturas.

Estas capacidades permanecen en el roadmap; no condicionan la primera validación.
