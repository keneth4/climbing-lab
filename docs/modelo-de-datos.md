# Modelo de datos propuesto

Es un modelo conceptual para discutir; no define todavía una base de datos ni contratos de API.

## Entidades principales

| Entidad | Responsabilidad |
| --- | --- |
| Lugar | Gimnasio o zona exterior; identidad y configuración del sitio |
| Sector | Agrupación de rutas dentro de un lugar |
| Captura | Versión del splat, formato, archivos y transformación de coordenadas |
| Agarre | Marcador espacial asociado a una captura, reutilizable entre problemas |
| Ruta | Identidad estable de una línea y su estado actual |
| Revisión de ruta | Datos y presentación publicados en un momento determinado |
| Presentación 3D | Captura utilizada, cámara principal, puntos de cámara y anotaciones |
| Agarre de ruta | Relación con un agarre y su función: inicio, intermedio o final |
| Usuario | Identidad del escalador o integrante del staff |
| Permiso en lugar | Capacidades del usuario dentro de un gimnasio |
| Registro de bitácora | Fecha, ruta/revisión, intentos, resultado y notas personales |
| Proyecto personal | Ruta que el escalador desea trabajar |
| Reporte | Error informado, autor, revisión afectada, estado y resolución |
| Exportación | Imagen/video, presentación usada y opciones de divulgación |
| Enlace de ruta | Destino estable para QR y enlaces compartidos |
| Credencial de visita | Código opaco, revocable y limitado al lugar |
| Visita | Usuario, lugar, fecha, staff que confirma y correcciones |

## Reglas de integridad

- El lugar publica una captura principal vigente; conserva capturas anteriores.
- La ruta existe independientemente de la captura.
- Cámaras y agarres espaciales pertenecen a una captura concreta. No se migran automáticamente al reemplazarla.
- Cambios materiales de armado crean una nueva revisión o una nueva ruta según una política que falta definir.
- La bitácora referencia la revisión escalada. Las correcciones editoriales no borran el historial.
- En spray wall, distintas rutas pueden compartir agarres. El orden de selección no equivale automáticamente a una beta.
- El sistema de graduación se guarda junto al grado; no se presupone equivalencia entre escalas.
- Fecha, intentos y resultado de la tarjeta provienen de la bitácora; grado y nombre, de la revisión de ruta.
- Los reportes no actualizan el catálogo directamente.
- La autorización se aplica en los servicios, no solo ocultando botones.
- La presentación puede definir una región de interés espacial, con margen para el recorrido de cámara y vinculada a su captura.
- Una credencial de visita no es una credencial de login; visitas y registros de bitácora son independientes.

## Capacidades propuestas

| Actor | Capacidades |
| --- | --- |
| Visitante | Consultar catálogo público y vistas |
| Escalador | Gestionar su bitácora, reportar errores y exportar visuales |
| Editor de rutas | Crear y editar rutas, preparar vistas y gestionar reportes |
| Responsable de captura | Subir y configurar capturas |
| Administrador del lugar | Asignar permisos y gestionar publicación/configuración |

Una persona puede reunir varias capacidades. La política de quién publica y quién accede a finanzas se definirá antes de implementar esos módulos.

## Extensión comercial posterior

Plan, membresía, pago, promoción, producto, variante, inventario y pedido serán entidades separadas.

Una membresía expresa vigencia o entradas disponibles. Un pago registra el movimiento monetario. Un pago manual puede activar una membresía sin existir una suscripción del proveedor.

Se distinguirán compra de periodo fijo y renovación automática. Los pagos deben registrar método, estado, importe, moneda, referencia y responsable de conciliación. El efectivo, transferencia y terminal forman parte del flujo operativo.
