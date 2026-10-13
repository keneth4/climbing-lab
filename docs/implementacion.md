# Primera base funcional

Fecha: 12 de octubre de 2026. Esta entrega inicia el piloto; no lo completa.

Actualización: ya existe una [API local con D1 y pruebas de aislamiento](api-local.md). La interfaz descrita aquí sigue usando localStorage y todavía no se conecta a esa API.

## Ejecutar

Requiere Node.js 22.12 o posterior compatible con Vite 7 y npm.

```sh
npm ci
npm run dev
```

Abrir la dirección que muestra Vite (por defecto http://127.0.0.1:5173).

```sh
npm run check
npm test
npm run build
npm run test:e2e
```

Las pruebas de navegador usan Google Chrome instalado y viewports de escritorio y móvil. Si se cambia a Chromium de Playwright, hay que ajustar el canal en playwright.config.ts e instalar el navegador correspondiente.

## Implementado

- Svelte 5, TypeScript y Vite; CSS sencillo separado de la lógica.
- Catálogo de demostración con búsqueda, grado y rutas retiradas.
- Enlaces directos y QR descargables por ruta.
- Beta desplegable y esquema 2D de agarres de demostración.
- Bitácora local con intentos, ascensos y notas.
- Exportación PNG de esquema de ruta y tarjeta personal de ascenso con opciones de divulgación.
- Reportes locales y resolución en modo staff de demostración.
- Creación de rutas y edición básica de nombre/beta/estado.
- Visor PlayCanvas de archivos PLY/SOG locales, órbita, desplazamiento y zoom.
- Guardado local de cámara por ruta y descarga PNG de la vista del visor.
- Validación de datos persistidos y snapshots de identidad/agarres en nuevos registros de bitácora.

## Límites actuales

No hay backend, autenticación, aislamiento entre usuarios/gimnasios ni permisos efectivos. El selector de staff demuestra interfaces; no es autorización. Todo se guarda en localStorage del navegador y puede perderse al limpiar sus datos.

El archivo local no se publica ni se guarda entre sesiones. La referencia de cámara usa nombre, tamaño y fecha del archivo como identificador provisional, no un hash de contenido. Volver al catálogo después de otra pestaña requiere cargar nuevamente el archivo. Las posiciones del esquema 2D no representan posiciones dentro del splat.

Las tarjetas se exportan con el esquema de demostración; la descarga de vista 3D es separada. Combinar captura 3D, marcadores y tarjeta histórica requiere el modelo de revisiones y assets persistentes.

SPZv4, LOD/carga progresiva, región de interés, marcadores 3D, edición de revisiones completas, videos, proyectos personales, visitas QR y módulos comerciales no están implementados.

El QR apunta a la URL del entorno actual. Un localhost no sirve como destino público para otros dispositivos.

## Validación de esta entrega

Pruebas de dominio: intentos válidos, preservación histórica, snapshots de agarres y rechazo de almacenamiento malformado.

Pruebas de Chrome en escritorio y móvil: enlace de ruta, ascenso y persistencia, tarjeta descargable, reporte y resolución, QR descargable, ruta inexistente, carga PLY sintética, guardado de cámara y captura del visor. Se verifica ausencia de errores de ejecución y desbordamiento horizontal en los flujos probados.

La prueba PLY usa 100 gaussianos sintéticos para comprobar integración. No mide el rendimiento de los 751 mil gaussianos del spray wall. SOG es una capacidad del cargador, todavía sin prueba con una captura real en esta entrega. El bundle del motor 3D sigue siendo grande; se evaluará carga bajo demanda y reducción de módulos junto con las mediciones reales.

## Próximo incremento

1. Probar el archivo real del spray wall y medir los formatos de entrega.
2. Introducir captura/versiones y marcadores en coordenadas 3D.
3. Completar el editor y la exportación de la ruta sobre la captura.
4. Elegir servicios para cuentas, permisos, almacenamiento y publicación antes de invitar usuarios reales.
