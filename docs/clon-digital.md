# Clon digital del gimnasio

Cada versión contiene un splat completo. Se sustituye el archivo completo al publicar una captura nueva. Las secciones son regiones persistentes del gimnasio para gestionar el armado y revisar las rutas; no son fragmentos que se ensamblan.

## Roles y almacenamiento

Solo administradores pueden subir, alinear y publicar capturas, definir secciones y registrar referencias permanentes. El staff crea y edita rutas sobre la captura vigente. Los visitantes consultan capturas publicadas; los borradores requieren administrador. La autorización se comprueba en el Worker, además de la interfaz.

D1 guarda versiones, secciones, referencias, rutas y auditoría. R2 guarda los archivos completos por gimnasio. Actualmente ambos se ejecutan localmente: esta implementación no activa R2 remoto ni despliega recursos de producción.

## Primera captura

1. Abre **Capturas** con la cuenta administradora y sube un archivo PLY o SOG completo. Se carga por partes de 10 MiB y queda como borrador.
2. Comprueba que el visor pueda abrirlo. La orientación inicial mantiene la corrección vertical existente.
3. Define secciones mediante cajas con límites XYZ en el sistema de coordenadas del gimnasio. Seleccionarlas muestra su volumen en el visor.
4. Si hay rutas de prueba anteriores, asígnales una sección en **Staff** antes de publicar. Sus cámaras locales antiguas no se trasladan automáticamente: guarda nuevas vistas tras publicar.
5. Revisa las rutas que conservarás y confirma la revisión visual de la captura. Publica. El catálogo carga automáticamente esta captura y el staff puede guardar cámaras para sus rutas.

## Referencias y futuras capturas

Registra al menos tres referencias no colineales sobre estructura fija. Mantén identificadores y posiciones del gimnasio entre capturas; no las ubiques en agarres que se retiran. Las posiciones medidas en metros permiten dar una escala métrica al clon.

Para cada nuevo splat completo, introduce las posiciones XYZ de esas mismas referencias en las coordenadas originales de la captura. La alineación calcula rotación, traslación y escala uniforme, informa el error RMS y dibuja las referencias para revisar la coincidencia. La primera captura también puede alinearse con estas referencias. Las sustituciones posteriores exigen alineación.

Marca qué secciones cambiaron de armado. Las rutas activas de secciones sin cambios se conservan tras revisión explícita. Las de secciones modificadas se retiran salvo importación explícita. También puedes importar rutas retiradas de versiones anteriores, después de comprobar que corresponden al armado actual. Las cámaras conservadas pasan a la nueva captura usando el sistema común de coordenadas.

La publicación es atómica y detecta cambios concurrentes. Las capturas publicadas no se realinean. Cada ruta conservada o importada obtiene una revisión nueva; intentos y ascensos anteriores siguen vinculados a su revisión original.

## Límites actuales

- Las posiciones de referencias y límites de sección se introducen numéricamente. La selección de puntos sobre el splat y la detección automática de fiduciales están pendientes.
- No hay LOD por ruta ni soporte SPZv4 en esta etapa. El visor descarga y decodifica el archivo completo; cambiar de ruta reutiliza la captura ya cargada en ese visor.
- El límite de archivo es 1 GiB. La subida valida tamaño y cabecera; la vista previa exige que el renderer pueda abrir el archivo antes de habilitar publicación. No sustituye una validación exhaustiva del contenido.
- Falta reanudación y limpieza automática de subidas interrumpidas.
- Cada publicación admite hasta 100 rutas afectadas. El catálogo administrativo muestra hasta 50 activas y 50 retiradas; la lista de capturas muestra las 100 más recientes. La paginación completa queda pendiente antes de ampliar el piloto.
- Las pruebas automáticas utilizan splats sintéticos pequeños. Falta medir carga y memoria con el PLY real de 186 MB y dispositivos del piloto.

## Verificación

Las pruebas cubren restricciones de administrador, aislamiento entre gimnasios, subida binaria en el runtime del Worker, borradores privados, alineación, publicación, conservación por sección, importación desde una captura antigua y permanencia del historial. Las pruebas de navegador cubren el flujo de captura en escritorio y móvil.
