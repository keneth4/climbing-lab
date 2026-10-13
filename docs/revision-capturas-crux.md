# Revisión del flujo de captura con Spray Wall

Fecha: 12 de octubre de 2026. Archivo probado: Crux 1.ply, 186 251 019 bytes, 751 006 gaussianos. El archivo y las capturas de pantalla no se incorporan al repositorio.

## Entorno y alcance

Chrome automatizado, aplicación local en 127.0.0.1:5173, escritorio 1440 × 1000 y viewport móvil 390 × 844. Sesión administrativa y metadatos simulados exclusivamente en el navegador de prueba; archivo real servido por streaming local. No se publicaron capturas ni se cambiaron datos del gimnasio. El Browser plugin no está disponible; se usó Playwright para la prueba aislada y el navegador integrado para inspeccionar el estado actual.

## Flujo observado

1. Acceso a Capturas: la pantalla abre y permite seleccionar un borrador. Los formularios para crear secciones y referencias aparecen incluso antes de elegir una captura.
2. Carga del archivo real: el renderer lo abre sin errores de aplicación observados. El estado informa 178 MB; corresponde a MiB redondeados, aunque la etiqueta dice MB. El archivo tiene 186 MB decimales.
3. Encuadre inicial: falla como vista útil de la pared. La cámara usa el AABB de la captura completa y muestra una envolvente circular de fondo. Los centros XYZ llegan aproximadamente a ±50; la mayor parte de la escena útil está mucho más concentrada. No basta con verificar que el renderer esté listo para considerar revisable la captura.
4. Navegación: órbita y restauración de Vista general responden, pero restaurar devuelve al mismo encuadre lejano. No hay controles visibles de zoom o desplazamiento; Shift + arrastre no proporciona un flujo equivalente en teléfono.
5. Secciones y referencias: solo hay coordenadas numéricas. No existe selección de puntos, edición visual de volúmenes ni previsualización de los límites del formulario. El usuario debe deducir coordenadas y escala desde una imagen sin ayuda espacial.

No se observó desbordamiento horizontal en los dos tamaños. La revisión visual no certifica accesibilidad; falta comprobar navegación por teclado del visor, gestos táctiles reales y anuncios de progreso durante cargas largas. El tiempo observado con archivo servido localmente no representa descarga por internet ni rendimiento de teléfonos.

## Siguiente trabajo recomendado

1. Cámara inicial persistente por captura: guardar la vista actual como entrada del gimnasio, separada de las cámaras de rutas; restaurarla al abrir y tras recargar. Permitir preparar y revisar esa vista antes de publicar.
2. Encuadre asistido: ofrecer una vista del contenido principal que reduzca la influencia de gaussianos lejanos, conservando una opción para ver todos los límites. No eliminar ni fragmentar el splat original.
3. Editor de secciones junto al visor: comenzar con un volumen visible, ajustar centro y dimensiones, arrastrar/manipular sus límites y previsualizar antes de guardar. Mantener XYZ como ajuste avanzado. Mostrar ejes y escala del sistema común del gimnasio.
4. Selección de referencias sobre la captura: mostrar punto elegido, coordenadas originales y transformadas, permitir corregir y confirmar. Las posiciones de un centro gaussiano son aproximaciones y no equivalen automáticamente al centro físico de un fiducial.
5. Navegación accesible: modos explícitos de orbitar/desplazar, zoom visible, enfocar sección, teclado y gestos táctiles. Evitar que cada ajuste de sección restablezca la cámara.

Estas herramientas preparan capturas completas del clon digital. No cambian el principio de sustituir siempre el splat completo y conservar secciones en el sistema de coordenadas del gimnasio.
