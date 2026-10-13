# QR y detalle por zona

Actualización de producto: 12 de octubre de 2026. Este documento registra alcance y propuestas; no implica implementación.

## QR de rutas

El staff puede generar y descargar una tarjeta imprimible con nombre, grado y QR de una ruta. Escanearlo abre el catálogo del sitio con esa ruta seleccionada, su cámara 3D y acceso a beta cuando exista.

El enlace debe utilizar una identidad estable de ruta, independiente del archivo del splat y de cambios de nombre. Una ruta retirada muestra su condición histórica; no se reasigna su QR a otro armado. La ficha y una imagen de respaldo deben poder consultarse antes de cargar el visor pesado. La beta sigue siendo opcional y desplegable.

## Tarjetas de usuario

Se distinguen tres flujos:

- Registro: QR que abre el formulario del gimnasio. Si es una invitación personalizada, su código tiene vigencia y uso limitado.
- Visita: credencial que el staff autenticado escanea para identificar al socio y registrar su entrada. El QR no concede acceso a la cuenta del escalador.
- Login: si se ofrece acceso mediante QR, usar un desafío temporal de un solo uso y confirmación desde una sesión ya autenticada, o un mecanismo equivalente que demuestre identidad. Una tarjeta permanente no debe contener credenciales de sesión reutilizables.

Propuesta inicial: QR permanente revocable para identificación de visitas, enlace de registro e inicio de sesión convencional. El login mediante QR queda pendiente de definir antes de implementarlo.

El código de visita es opaco y no incluye correo, teléfono ni datos financieros. La resolución requiere permisos del staff en ese gimnasio. Se permite revocar/reemitir tarjetas y se registra quién confirmó cada visita. Una credencial copiada no prueba identidad por sí sola.

Una visita es independiente de un ascenso, pago o membresía. Escanear no debe descontar automáticamente una entrada: la regla depende del plan y requiere confirmación del staff. Debe evitarse duplicar visitas ante relecturas del mismo QR y existir una corrección auditada.

## Detalle por zona de ruta

Se mantiene un splat completo como escena lógica del gimnasio. Su distribución puede dividirse en bloques espaciales con varios niveles de detalle; no se requiere un archivo completo por ruta.

Flujo propuesto:

1. Cargar contexto general con menor detalle.
2. Al seleccionar una ruta, priorizar los bloques que cubren sus agarres y el muro circundante.
3. Conservar margen espacial para cambios de ángulo y la trayectoria de cámara.
4. Ajustar detalle según cámara, región de interés y presupuesto del dispositivo.
5. Reutilizar bloques compartidos al cambiar de ruta y limitar caché/memoria.

La región de interés pertenece a la presentación de una ruta y a una captura concreta. Puede sugerirse a partir de marcadores y ajustarse por el staff. No debe limitarse a puntos de agarres: también incluye superficie y contexto necesarios para leer la línea.

Reducir detalle después de descargar un archivo monolítico puede ahorrar trabajo de renderizado, pero no evita esa descarga inicial. Para reducir bytes transferidos se necesita preparación espacial y carga progresiva. SPZv4 comprimido por sí solo no garantiza ese comportamiento.

[Streamed SOG](https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/streamed-sog/) documenta bloques espaciales y varios niveles de detalle seleccionados por el visor. Es candidato para la prueba. La prioridad específica por ruta es una política adicional cuya integración con el motor debe verificarse; no se presupone una función lista para usar.

## Validación

- Comparar archivo comprimido completo con carga progresiva en la captura de prueba.
- Medir bytes hasta vista útil, tiempo, fluidez, memoria cuando sea medible y cambio entre rutas próximas/distantes.
- Comprobar detalle de agarres, límites entre bloques y transiciones al mover la cámara.
- Verificar que la región cubre el barrido completo y que exportaciones esperan el detalle requerido.
- Probar QR en impresiones y teléfonos reales, ruta retirada y ausencia de sesión.
- Verificar que el QR de socio no permite login ni consultar información sin autorización.
- Comprobar relectura, revocación y corrección de visitas.

## Ubicación en el roadmap

QR de rutas: piloto funcional. Credenciales de usuario y visitas: gestión de socios. Login mediante QR: diseño pendiente. LOD y carga progresiva: prueba técnica temprana; adoptar según evidencia, sin prometer mejoras antes de medirlas.
