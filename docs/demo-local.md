# Demo integral local — Climbing Lab

## Preparar y abrir

Requisitos: Node 22.12+ o 24+, npm y Chrome instalado para smoke. Desde la raíz de un checkout de esta rama:

```sh
npm ci
npm run demo:setup
npm run demo:run
```

Abrir **http://127.0.0.1:5174/**. Worker dedicado en 8789. Los puertos deben estar libres; el script no cierra procesos ajenos. Ctrl+C cierra los servicios propios. `demo:run` comprueba primero el catálogo y R2; si faltan datos, ejecutar setup. En otra terminal, `npm run demo:check` verifica HTTP mientras el demo está iniciado.

Persistencia exclusivamente en `.wrangler/demo`, configuración `wrangler.demo.json`: Worker gym-demo, D1 UUID local terminado en 003 y bucket `climbing-lab-demo-local-assets`. No se usa `.wrangler/state` de A/B. Ningún script acepta destino remoto ni ejecuta deploy.

## Dataset y límites

Dataset v1: seis activas, una retirada y un borrador oculto; tres sectores ilustrativos, escalas V/Font, reglas y beta. IDs `demo-route-01`–`08`. El seed no crea permisos, actividad, proyectos ni cuentas. Repetir setup conserva rutas, revisiones y ediciones posteriores; no es una herramienta para restaurar estados editados.

`illustrationId` es referencia opcional de snapshot. Solo los siete IDs públicos registrados se resuelven a `/api/demo-assets/ID`. El endpoint requiere gym-demo y una referencia en revisión pública; sirve SVG original de R2 local con CSP y sin URLs arbitrarias. El frontend importa únicamente IDs, no todo el manifiesto de seed. Tarjetas, ficha y PNG señalan que son ilustraciones, no fotos del muro. Licencia/procedencia: dibujos vectoriales creados para este repositorio por código en `scripts/demo-data.mjs`, sin material externo ni personas.

No existen capturas/cámaras/agarres 3D fabricados. Las fichas públicas son ejemplos incompletos compatibles con la lectura de rutas heredadas; los requisitos normales de publicación permanecen vigentes. El borrador incompleto no se puede publicar hasta proporcionar una captura e imagen válidas. QR y enlaces localhost solo funcionan en el mismo equipo: no son enlaces públicos por internet.

## Reset y verificación

Detener el demo antes de reset/smoke:

```sh
npm run demo:reset -- --confirm=gym-demo
npm run demo:setup
npm run demo:smoke
```

Reset elimina todo el almacenamiento **solo del demo**, incluidas eventuales actividades de prueba. Requiere confirmación exacta, puertos libres y comprobación de ruta real sin symlinks; no elimina A/B. No es un procedimiento de backup o restauración de producción.

`demo:smoke` repite setup y levanta servicios temporales. Playwright consulta API/D1/R2 reales sin interceptar HTTP. Comprueba catálogo, filtros, ilustración, beta, QR, recarga, retirada, borrador protegido, teclado, cuatro anchos y PNG. Emula desconexión de red real del navegador y verifica conservación de datos/reintento. Artefactos en `/tmp/climbing-demo-*`. No se confunde esta suite con los e2e existentes de API simulada.

## Guion de exhibición

1. Inicio y aviso de gimnasio ficticio → Rutas.
2. Filtrar por nombre, sector o escala; seleccionar Travesía tranquila.
3. Imagen ilustrativa, reglas y beta opcional; explicar la falta de captura 3D verificada.
4. Compartir → QR/enlace local → recargar la misma identidad. Preparar PNG: contiene advertencia de ilustración y no datos personales por defecto.
5. Abrir `/?ruta=demo-route-07`: retirada, historial y enlace conservados.
6. Consultar borrador sin sesión: 401 y estado de no disponibilidad.
7. Recorrido privado de escalador/staff: **verificado localmente con dos cuentas reales en el navegador interno**. Crux y la ruta D04 están publicadas solo en el demo. Procedimiento en [D04](planes/demo-integral/04-recorrido-cuenta-y-staff.md). No insertar roles con el seed ni usar tokens falsos.

## Operación privada local D04

Tras login manual, Mi cuenta muestra el UUID. El propietario debe indicar expresamente qué UUID autoriza antes de asignar permisos:

```sh
npm run demo:staff -- UUID admin --confirm=gym-demo
npm run demo:staff -- UUID editor --confirm=gym-demo
npm run demo:staff -- UUID revoke --confirm=gym-demo
```

Destino fijo demo y cambio/auditoría atómicos; no modifica Supabase ni A/B. Recargar la interfaz para confirmar el rol real. Crux se importa por Staff → Capturas, desde el archivo local fuera de Git. `node scripts/demo-crux-check.mjs` comprueba tamaño y SHA-256 contra ese original, sin publicar ni escribir objetos.

El recorrido real usa el navegador interno. `npm run demo:auth -- staff` y `npm run demo:auth -- escalador` indican la URL de la herramienta local `demo-auth.html`; no abren navegadores externos por defecto. Iniciar sesión normalmente en Climbing Lab y abrir la herramienta en el mismo origen. Usar `localhost:5174` para escalador y `127.0.0.1:5174` para staff permite conservar dos sesiones aisladas en el navegador interno, ambas contra gym-demo.

La herramienta comprueba identidad/rol por `/api/me` y descarga exclusivamente la sesión Supabase (sin cookies Google). Importarla con:

```sh
npm run demo:auth -- import escalador /RUTA/ABSOLUTA/d04-escalador-session.json --confirm=gym-demo
npm run demo:auth -- import staff /RUTA/ABSOLUTA/d04-staff-session.json --confirm=gym-demo
```

El importador protege el archivo descargado con 0600, valida los dos orígenes loopback fijos y vuelve a comprobar `/api/me` antes de guardar en `.playwright/demo-auth` (directorio 0700, archivos 0600, ignorados por Git). No enviar tokens ni contraseñas por chat. La herramienta solo se sirve por Vite local y no se incluye en el build de producción. No extrae perfiles nativos. Opciones externas `firefox`/`chrome` siguen disponibles únicamente si se solicitan explícitamente y hay necesidad; el recorrido D04 actual no las usa.

Para eliminar los perfiles locales tras terminar: `npm run demo:auth -- clear --confirm=gym-demo`; eliminar también las dos descargas privadas generadas. No elimina cuentas, roles ni historia D1, ni revoca sesiones remotas.

No ejecutar reset durante D04: eliminaría la captura, permisos y datos de prueba locales.

Para comprobar el catálogo público mientras el demo está abierto, sin reiniciarlo: `DEMO_REUSE_SERVER=1 npx playwright test --config playwright.demo.config.ts`. La reutilización es explícita y las pruebas comprueban gym-demo; el comando normal conserva el rechazo de un puerto ocupado.

## Resultado verificado y siguientes puertas

- 19 pruebas frontend/dominio, 47 Worker/API y 44 e2e existentes aprobadas; seis smoke integrado reales desktop/mobile. Tipos, formato y build aprobados. El aviso de tamaño de PlayCanvas permanece; no equivale a medición móvil.
- Setup inicial/repetido y setup desde copia limpia con `npm ci` offline y ejecución Node 25.6.1: aprobados. La instalación temporal con Node 23 emitió advertencias de engine; se usó Node compatible para el bootstrap. El runner ahora rechaza Node 23.
- Seed preserva revisión inicial, edición posterior, actividad y rutas ajenas; no agrega staff. Reset sin confirmación rechazado; reset confirmado elimina demo y conserva hashes de 41 archivos de persistencia A/B. No hubo cambios de servicios remotos.
- Se corrigió una confirmación de recuperación de contraseña que desaparecía al cambiar la vista de cuenta; se verifica repetidamente en desktop/móvil. No prueba credenciales reales del demo.
- Browser plugin no disponible: Playwright con Chrome; capturas revisadas del catálogo y ficha reales. Teclado/responsive verificados, sin certificación WCAG ni lector físico.

D01–D03 y preparación/QA D05 completos para lectura pública L0. **D04 funcional cerrado localmente; L1–L3 pendientes**: staging/DNS/R2, callbacks, protección antiabuso, backups y restore D1 + objetos R2, teléfonos/lector y tareas presenciales. Véase [piloto remoto](piloto-remoto.md) y [validación física](validacion-formatos-dispositivos.md). No ampliar pagos, tienda, video ni tres marcas para cerrar esta entrega.

## Verificador privado preparado (14 de octubre de 2026)

Tras preparar las dos sesiones, publicar y revisar humanamente la ruta D04:

```sh
npm run demo:private -- UUID_RUTA_D04_PUBLICADA --confirm=gym-demo
```

Ejecutar solo después de exportar/importar ambas sesiones reales y publicar la ruta revisada. El verificador comprueba destino, permisos privados de archivos, identidades distintas y roles confirmados mediante `/api/me` antes de escribir. No extrae el perfil nativo de Firefox ni crea cuentas, tokens o permisos.

Crea una copia «D04 smoke …» de la presentación ya revisada, sin inventar coordenadas ni modificar la ruta original. Proyecto sin actividad implícita, intento y corrección a ascenso, recarga, acceso ajeno denegado, concurrencia, toma/resolución de reporte sin cambio de ruta, edición y retiro preservando presentación histórica. El comando API conserva el registro de prueba vigente y un recibo privado para revisar tarjeta histórica y las 16 combinaciones de privacidad desde la bitácora en el navegador interno. Después de comprobar vista previa/descarga, ejecutar `npm run demo:private -- cleanup UUID_RUTA_D04_PUBLICADA --confirm=gym-demo`: retira lógicamente la actividad y archiva el proyecto, conservando ruta retirada, reporte resuelto e historia. La limpieza admite repetición parcial y no usa un navegador externo.

Si falla después de escribir, conserva los datos para diagnóstico e indica el ID de la ruta de prueba; no borra historia ni intenta reparar permisos. No guardar screenshots/traces de cuentas ni sesiones en evidencias. La eliminación explícita de los perfiles locales sigue siendo `npm run demo:auth -- clear --confirm=gym-demo`, después del recorrido; no revoca sesiones remotas.

Verificación del código sin credenciales: `npm run test:demo-tools` y `node --check scripts/demo-private.mjs`. Estas comprobaciones no equivalen a ejecutar el recorrido privado.

Evidencia de esta preparación: 27 frontend, 50 API, 3 guardas de herramientas, 56 e2e y 6 smoke públicos aprobados; tipos, formato y build aprobados. Firefox administrado abrió el Inicio y comprobó gym-demo sin sesión. El timeout total de la matriz de capturas DPR 3 se amplió a 60 s tras un agotamiento de 30 s; repetición espacial y suite completa aprobadas. Este registro corresponde a la preparación histórica; la ejecución posterior está documentada en el cierre D04.

Ruta D04 publicada tras revisión/autorización humana: `http://127.0.0.1:5174/?ruta=315f81b8-ee45-4ebe-b56a-c934a8509480`, revisión 4 con nueve agarres y respaldo real. Este enlace es local, no accesible desde internet. El recorrido posterior entre dos cuentas reales quedó aprobado; los archivos privados fueron eliminados al terminar.

## Cierre D04 real

[Resultados y límites](planes/demo-integral/04-recorrido-cuenta-y-staff.md#cierre-funcional-real--14-de-octubre-de-2026): API privada real, recarga, privacidad de tarjeta, revisión histórica, reporte y retiro aprobados. Se verificaron 16 vistas previas y dos descargas PNG. La actividad de prueba fue retirada lógicamente y el proyecto archivado; se preservó historia. Sesiones exportadas y descargas JSON eliminadas explícitamente. Resultado final: 27 frontend, 50 API, 4 guardas, 56 e2e y 6 smoke públicos; tipos, formato y build aprobados. No equivale a validación física ni staging.


## Editor guiado UX-P1A

Abrir una ruta como staff y «Editar ruta». Recorrer Datos → Encuadre → Agarres → Verificación → Imagen/respaldo → Publicar; se puede volver sin perder cámara o preparación. Aplicar o Cancelar el candidato/ajuste antes de cambiar de paso. Seleccionar desde la lista enfoca e inspecciona el agarre; F enfoca y Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z deshacen/rehacen fuera de campos de escritura. Escape cancela. En móvil, usar Compacto/Medio/Ampliado y el selector de paso.

Para nuevas rutas/borradores, guardar incompleto usa la API actual. Para una ruta publicada, «Conservar preparación local» solo conserva en memoria, no escribe en servidor y puede perderse al recargar. Una nueva revisión exige recargar la base y confirmar la revisión de diferencias antes del envío. Un error conserva los campos y señala el paso a corregir.

Revisar desde dos ángulos y confirmar humanamente antes de generar/cargar el respaldo. Los cambios geométricos confirmados invalidan verificación e imagen; cancelar o aplicar idéntico las conserva. Si se desea recuperar el encuadre guardado antes del PNG, utilizar «Ver ruta» en opciones del visor. Publicar/actualizar y retirar/reactivar son acciones finales separadas con los permisos y motivos actuales.

[QA y límites de UX-P1A](planes/ux/02-flujo-editor-rutas.md#entrega-y-evidencia-local--14-de-octubre-de-2026). Para repetir el smoke sobre el runtime persistente usar `DEMO_REUSE_SERVER=1 npx playwright test --config playwright.demo.config.ts`; no ejecutar setup/reset para esta comprobación. La ruta D04 original debe conservarse; cualquier nueva selección o publicación real requiere revisión humana.

## Zonas y planos inclinados UX-P1B

En Staff → Capturas, seleccionar la captura y elegir Preparar sección visual (caja), Delimitar con vértices o Plano inclinado. Los pasos Tipo, Superficie, Contorno y espesor y Revisar y guardar están disponibles mediante «Paso de zona».

Una zona de escalada admite rutas; un área visitable no. Para el plano inclinado, elegir tres puntos distintos y no alineados sobre el muro; reiniciar permite descartarlos. Añadir vértices proyecta cada selección al plano. Cerrar el contorno comprueba cruces y área. Seleccionar desde la lista enfoca el vértice y permite ajustar U/V con botones; Aplicar confirma y Cancelar conserva la posición anterior. Deshacer/rehacer no escribe en servidor. El espesor usa unidades del clon, no metros. Vista perpendicular y Restaurar cámara ayudan a revisar el volumen.

Antes de guardar, revisar nombre/tipo, rutas dependientes y volumen desde dos ángulos. Un cambio de captura cancela la preparación; la preparación no guardada es local y no garantiza recuperación tras recargar. Un error conserva los datos. Ante conflicto, consultar nueva base, comparar geometría/historial y confirmar la revisión antes de enviar otra vez. Las rutas existentes conservan su revisión histórica de sección.

Tras guardar una zona de escalada, «Crear ruta en esta zona» abre UX-P1A. Si ya había preparación local de una ruta, se conserva antes de iniciar otra. No usar la sección original D04 para escrituras de QA. [Plan y evidencia UX-P1B](planes/ux/03-zonas-planos-inclinados.md).

Al editar una ruta existente, UX-P1A usa su revisión histórica de zona y avisa si la zona vigente es posterior. Guardar o retirar la ruta no adopta automáticamente esa nueva geometría. Si falta el snapshot de sección, se conserva la preparación y la API exige revisar el conflicto; no reasigna la ruta silenciosamente.

## Recorrido virtual UX-P2B

Para actualizar el demo existente, con su Worker saludable en 8789, ejecutar desde la raíz:

```sh
npm run demo:migrate
```

Destino fijo `.wrangler/demo`, D1/R2 `gym-demo`; rechaza argumentos, overrides y symlinks. Es una migración aditiva, repetible, sin seed/reset ni destinos remotos. No necesita detener Vite/Worker. Un clon nuevo obtiene estas tablas con el bootstrap habitual, que aplica todas las migraciones. [Referencia oficial de comandos D1](https://developers.cloudflare.com/d1/wrangler-commands/).

Público: Inicio/El gimnasio → Recorrer el gimnasio, o `http://127.0.0.1:5174/?vista=Recorrido`. Estos enlaces solo funcionan localmente. Cada parada conserva texto/imagen sin WebGL; «Iniciar recorrido en 3D» descarga la captura bajo demanda. Anterior/Siguiente y la lista cambian cámara directamente. Explorar mueve libremente; Volver a esta parada recupera cámara/FOV. La URL con tour/parada permite recargar o compartir dentro del equipo; una retirada conserva respaldo y desactiva entrada al 3D.

Staff → Recorridos → Crear recorrido abre directamente el Splat vigente sin escribir todavía en servidor. Pulsa «Añadir primera parada desde el Splat», encuadra y usa «Guardar cámara e imagen de parada»: el editor guarda automáticamente el contexto del borrador privado antes de subir el PNG. No hace falta descubrir un guardado previo. Si ese guardado falla, conserva la preparación y permite reintentar sin crear otro borrador.

«Completar y revisar esta parada» lleva el foco a su formulario. Completa el título, revisa desde dos ángulos, confirma la casilla y pulsa «Guardar parada revisada». La lista distingue encuadre pendiente, revisión pendiente, sin guardar y guardada/revisada. «Añadir siguiente parada desde el Splat» continúa sin recrear el visor. Repite hasta tener 3–20 paradas; elige la inicial, previsualiza y confirma la revisión final. Solo administración publica o retira. Los vínculos a zonas/rutas son opcionales y están plegados. Guardar cámara/imagen no publica y la revisión humana nunca se marca automáticamente.

La preparación no guardada es local en memoria. Una comprobación temporal de sesión la oculta hasta verificar la misma cuenta; cambiar de cuenta la limpia. Recargar o salir puede perder cambios no guardados. Guardar un borrador no cambia el recorrido público. Ante conflicto, consultar la base nueva, comparar y confirmar su revisión; ante error de imagen, Reintentar conserva la misma captura PNG y clave. Un cambio de versión/transformación exige preparar cámaras/imágenes nuevas; los vínculos de zona conservan su revisión histórica. Retirar requiere guardar o descartar primero la preparación pendiente y conserva las revisiones públicas.

[Entrega, pruebas y puerta humana pendiente](planes/ux/05-tour-paradas.md#entrega-local--14-de-octubre-de-2026). Todavía no hay un recorrido real de Crux publicado: las tres cámaras requieren selección/revisión humanas. Repetir QA público con `DEMO_REUSE_SERVER=1 npx playwright test --config playwright.demo.config.ts`; no usar `demo:smoke` en este runtime persistente porque incluye setup.
