# Editor de rutas: corrección observada durante D04

El propietario suspendió la selección de agarres por falta de referencia visual y saturación de botones. Se conserva la captura Crux publicada y la ruta de prueba en borrador; esta intervención mejora el editor para retomar D04, sin validar por sí sola sus agarres.

## Referencias revisadas

- [SuperSplat: interfaz](https://developer.playcanvas.com/user-manual/supersplat/editor/interface/): separa herramientas, ajustes de apariencia y vistas; mantiene selección y contexto junto al viewport. Se observó también el editor abierto en Firefox con Crux, sin modificar ese proyecto.
- [SuperSplat: selección](https://developer.playcanvas.com/user-manual/supersplat/editor/editing-splats/): distingue selección, profundidad y ayudas visuales. Nuestra selección continúa siendo aproximada, no una segmentación del agarre.
- [MoonBoard: aplicación](https://moonclimbing.com/using-moonboard-app): exige elegir el armado y comprobar posiciones/orientación. Esta referencia documental refuerza mantener el contexto del muro; no se auditó su app autenticada ni se copiaron posiciones.

## Problemas y cambios

1. Punto elegido: antes mostraba coordenadas y una marca pequeña difícil de localizar. Ahora aparece un marcador provisional «?» con borde destacado y un panel de confirmación que se trae a la vista. Coordenadas precisas plegadas.
2. Agarre confirmado: etiquetas numeradas sobre el muro, con I/F y color por función. Pulsar el marcador abre su ajuste y destaca la fila correspondiente. Objetivos de 44 px, nombres accesibles y acceso mediante teclado. Son superposiciones; no prueban oclusión ni profundidad correcta.
3. Controles: zoom compacto con nombre accesible; encuadres y vistas agrupados en un desplegable. Se conservan cámara, respaldo y controles existentes.
4. Selección desplazada en pantallas de alta densidad: CameraComponent de PlayCanvas usa `device.clientRect` en píxeles CSS. La conversión anterior multiplicaba el cursor por la resolución del framebuffer. Se corrigió el cursor y se convirtió explícitamente CSS → píxeles de imagen al exportar etiquetas.
5. Puntos de fondo: en el editor de rutas se consideran únicamente centros dentro de la sección elegida, después de transformar al marco del gimnasio. Si no hay candidato, se informa y no se inventa un punto. El editor administrativo de secciones conserva la selección necesaria para delimitar regiones nuevas.

## Evidencia y límites

Firefox nativo, demo real 5174, Crux local: modo de selección → punto provisional visible sobre el toque → confirmación local → marcador 1 → pulsación abre ajuste. Se retiró el marcador de verificación sin guardar la ruta ni declarar revisión humana. La ruta sigue en borrador.

Tipos y pruebas de dominio cubren el rechazo de centros fuera de la sección. La comprobación visual en escritorio no sustituye teléfonos, lectores de pantalla, evaluación de rendimiento ni la revisión de dos ángulos. D04 privado entre cuentas continúa pendiente.
