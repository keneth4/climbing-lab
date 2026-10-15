# UX-P1B · Zonas y planos inclinados

Base: main con PR #4 integrado; rama `codex/section-editor-oriented-geometry`.

## Entrega acordada

Flujo Tipo → Superficie → Contorno y espesor → Revisar y guardar. Zona de escalada o área visitable; caja rápida, contorno XY/XZ/YZ y plano inclinado definido por tres puntos no alineados. Vértices visibles, edición Aplicar/Cancelar, deshacer/rehacer y alternativas sin arrastre. Espesor simétrico en unidades del clon, vista perpendicular y restauración de cámara, un solo visor.

Unión compatible de geometría clásica y `oriented-polygon`, con base ortonormal, origen, vértices UV y espesor. Validación compartida cliente/servidor y bounds derivados del volumen. Endpoints y almacenamiento JSON actuales, sin migración SQL. Revisiones esperadas, auditoría, conflictos sin pérdida de preparación y rutas históricas sin retargeting. Mostrar dependencias y ofrecer crear ruta en zona guardada.

## Verificación y límites

Pruebas de plano, UV/mundo, bounds, validación e historia; caja/contorno/inclinado, edición reversible, captura, errores, concurrencia y permisos. Tipos, formato, dominio/API, build, e2e y smoke con `DEMO_REUSE_SERVER=1`, sin setup/reset. QA navegador interno, 320/390/768/1440 px, ambos temas, zoom 200 %, teclado y fallback. Fixture para escrituras automatizadas; Crux requiere revisión humana y la sección/ruta D04 original no se modifica.

Commits separados para geometría/validación, editor, integración histórica y QA. PR independiente sin fusión automática. Sin tour, biblioteca de agarres, segmentación, paredes curvas ni despliegues. Teléfonos reales, lector y rendimiento físico pendientes.

## Implementación local

PR #4 integrado en main antes de crear la rama. `SectionEditor` separa la preparación de zonas del gestor de capturas y conserva el visor único. Los accesos de caja/contorno/inclinado abren la herramienta y todos los pasos siguen disponibles. Los tres puntos definen una base ortonormal; los vértices se proyectan sobre ella y el espesor es simétrico. La lista y los botones U/V permiten editar sin arrastrar, mediante copia temporal y Aplicar/Cancelar; deshacer/rehacer conserva las geometrías.

El discriminador `oriented-polygon` amplía el contrato JSON existente: origen, u/v/normal, verticesUV y thickness. Se conservan polígonos XY/XZ/YZ y cajas, sin conversiones masivas ni migraciones SQL. El servidor comparte validación y cálculo del volumen con el cliente; rechaza asignaciones de rutas a áreas visitables. Las revisiones de sección y los snapshots de rutas anteriores se mantienen independientes.

El inspector tiene tres alturas en móvil, foco al cambiar de paso y controles táctiles. Las etiquetas se recortan cuando quedan bajo el panel; al delimitar, el picking usa toda la captura y no el volumen provisional. Los cambios de captura cancelan la preparación. Un conflicto 409 conserva los datos, permite consultar base/historial y exige confirmar su revisión antes de reintentar. Crear ruta en una zona guardada preselecciona la sección cuando no hay una preparación previa; una preparación existente se conserva.

### QA real y límites

QA de lectura en navegador interno sobre Crux local: carga de escena, instrucciones de tres puntos, panel y cancelación sin guardar. No se seleccionaron puntos reales ni se creó/modificó una zona en el demo. La comparación API confirmó la ruta D04 original íntegramente igual y su sección original en revisión 1, con bounds/geometría iguales al snapshot histórico; el demo conserva una sola sección. No se ejecutó setup/reset ni se modificaron A/B.

Las escrituras y delimitaciones automatizadas corresponden a fixtures sintéticos, con autenticación simulada únicamente en las pruebas. No son evidencia de delimitación humana sobre Crux. La aprobación de una nueva zona real requiere revisión humana desde dos ángulos; teléfonos reales, lector de pantalla y rendimiento físico siguen pendientes. El build conserva avisos por chunks grandes, sin afirmar una mejora de rendimiento.

La revisión histórica también se conserva al editar o retirar posteriormente una ruta: API y editor reutilizan la sección de su snapshot, aunque la revisión actual de esa zona tenga otra geometría o sea ahora un área visitable. Una sección histórica ausente produce conflicto en lugar de reasignación silenciosa. Las rutas nuevas usan la zona vigente. No se añadió un mecanismo de adopción automática de geometría nueva.

Durante las regresiones se corrigió una superposición real en móvil: el único canvas ahora se monta fuera del portal de controles, sin recrear PlayCanvas. Las pruebas conservan identidad del canvas, proyección/exportación y foco accesible bajo resize, zoom y cambios de paso. La comprobación de etiquetas espera el dibujo posterior al zoom en lugar de leer un estado intermedio.

### Resultados automatizados — 14 de octubre de 2026

- Tipos frontend/backend y formato aprobados; 32 pruebas frontend, 51 de API y 4 controles de herramientas demo aprobados. Build aprobado con avisos de tamaño de chunks.
- Suite completa: 88 e2e aprobadas en escritorio/móvil. Cubre caja/contorno/plano definido por tres puntos, Aplicar/Cancelar, no-op, undo/redo, conflicto, red, doble envío, área visitable, cambio de captura, continuidad histórica de rutas, creación desde zona y conservación del borrador al volver.
- 320/390/768/1440 px, ambos temas, teclado, zoom 200 %, fallback sin WebGL e identidad del canvas; regresiones CSS/PNG con DPR 1/2/3 conservadas. Además, 16 comprobaciones repetidas de proyección, foco y persistencia aprobaron la corrección del portal.
- Smoke público integrado: 6 aprobadas con `DEMO_REUSE_SERVER=1 npx playwright test --config playwright.demo.config.ts`, sin interceptar API, setup ni reset.
- Capturas comparativas sintéticas fuera de Git: `/tmp/p1b-{desktop,mobile}-{320,390,768,1440}-{first,second}.png`. QA final en navegador interno: Crux cargada, herramienta abierta con 0 de 3 puntos y cancelación confirmada sin guardar; sin error de framework ni errores de consola observados.

Las rondas intermedias encontraron y corrigieron el picking limitado al volumen provisional, un botón que tapaba puntos en móvil y la superposición del canvas sobre el inspector. Se actualizaron los selectores de pruebas para el canvas compartido y se mantuvieron las aserciones de foco, proyección y tamaño táctil. No se consideran aprobadas las puertas físicas pendientes por estos resultados.
