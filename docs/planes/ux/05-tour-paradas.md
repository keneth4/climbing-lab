# UX-P2B · Recorrido virtual por paradas

Base: main con PR #5 integrado; rama `codex/gym-guided-tour`.

## Entrega acordada

Recorrido público bajo demanda, con imágenes/texto sin WebGL, paradas Anterior/Siguiente, enlaces profundos y vuelta desde exploración libre. Cambio de cámara directo, sin autoplay; una captura y un runtime. Enlaces opcionales a rutas públicas y catálogo con `zona=ID`.

Staff prepara borradores; solo administración publica/retira. Editor de 3–20 paradas con cámaras, FOV, imágenes coherentes, títulos y revisión humana; reordenación/eliminación reversible, guardado incompleto, revisiones esperadas e idempotencia. Publicar crea revisión inmutable sin exponer borradores. Retiro conserva respaldo e historia y desactiva 3D. Cambio de captura/versión/transform exige revisión nueva.

Modelo/validadores compartidos, pose orbital y adaptador explícito al runtime sin modificar cámaras de rutas. Migración aditiva D1 y PNG en R2 existente; lectura pública solo de revisiones publicadas. Títulos hasta 80, descripciones 1000, JSON 64 KiB y PNG 5 MiB. Identidad del gimnasio desde bindings. Aplicar únicamente al demo local con comando dedicado y destino comprobado; no setup/reset/seed ni migraciones remotas.

## Verificación y límites

Tipos, formato, dominio/API, build, e2e y smoke con reutilización explícita. Cubrir permisos, privacidad, historial, conflictos/reintentos, cambio de captura, enlaces, fallos, un canvas/una descarga por captura, FOV, 320/390/768/1440 px, temas, teclado y zoom 200 %. QA navegador interno; escrituras automatizadas con fixtures. Tres cámaras/paradas reales de Crux requieren selección/revisión humanas antes de publicar; dejar ese criterio pendiente si falta.

Conservar Crux y D04. Sin biblioteca de agarres, caminar/colisiones, cine, nuevos formatos/LOD, gastos cloud ni despliegues. Teléfonos, lector y rendimiento físico pendientes. Commits separados modelo/API, editor, público, QA/documentación; PR independiente sin fusionar.

## Entrega local — 14 de octubre de 2026

PR #5 integrado en `main` (`a621517`), sin cambios nuevos en el remoto durante la implementación. Plan inicial registrado en `8416164`, seguido por commits separados de modelo/API, editor y experiencia pública. Rama `codex/gym-guided-tour`; esta entrega se revisa en un PR nuevo, sin fusionarlo ni desplegar.

### Implementación

- `shared/tours.ts` valida contenido, pose orbital, FOV y contexto de captura. El adaptador excluye FOV del contrato de cámaras de rutas; el runtime lo aplica/restaura por separado, sin interpolación. Cambiar de parada conserva el canvas y el asset de la captura. Orbitar, desplazar, zoom o vista general permiten explorar; «Volver a esta parada» recupera su pose/FOV.
- Inicio y El gimnasio ofrecen «Recorrer el gimnasio». Antes de iniciar el 3D se consultan título, descripción, imagen, lista e indicador. Enlaces `?vista=Recorrido&tour=ID&parada=ID`, Atrás/Adelante, zona y ruta opcionales. `zona=ID` se combina con los filtros existentes y puede quitarse. Los identificadores inválidos, retiro, captura incompatible, ausencia de recorrido y fallos tienen estados explícitos; texto y navegación no dependen de WebGL.
- Staff → Recorridos prepara borradores: título/descripción, captura vigente, paradas, textos, inicio, orden, eliminación/undo/redo, vínculos y punto opcional con Aplicar/Cancelar. Guardar cámara e imagen captura ambos en la misma operación visual. El callback conserva la parada y contexto originales durante la conversión PNG. Reintentar conserva el blob y la clave; otra cuenta/captura no puede recibir esa preparación.
- El borrador no modifica lo público. La previsualización de imágenes privadas usa lectura autorizada y URLs de objeto temporales revocadas; nunca tokens en URLs. Solo administración publica/retira. Publicar exige 3–20 paradas completas, revisión de cada parada y confirmación humana final. Ante conflicto se conserva el trabajo, se consulta la nueva base y se exige revisarla antes de reintentar.
- La preparación de la misma cuenta sobrevive a una comprobación temporal de sesión: queda oculta mientras faltan permisos confirmados. Cambiar de cuenta destruye ese editor. Una recarga completa o salir del editor puede perder cambios no guardados; guardar el borrador es la persistencia disponible.
- D1 conserva borradores, revisiones públicas inmutables, recorrido vigente y referencias de imágenes. R2 almacena PNG con contexto normalizado de cámara/FOV/captura/versión/transformación. El servidor valida referencias dentro de sus bindings, permisos, revisión esperada, contenido y límites; usa idempotencia y auditoría. Un cambio de contexto exige revisar cámaras e imágenes antes de publicar; las revisiones públicas anteriores conservan texto/imágenes y desactivan el 3D incompatible.

### Migración y conservación del demo

`0010_gym_tours.sql` es aditiva. Se aplicó una vez con `npm run demo:migrate`, exclusivamente a `.wrangler/demo` y `gym-demo` en 8789, sin reiniciar servicios. La repetición informó «No migrations to apply». El comando no admite argumentos, exige configuración/identificador/bucket fijos, runtime saludable y directorio real sin symlinks; no ejecuta seed/reset. El bootstrap existente aplica todas las migraciones y por ello incluye 0010 en clones nuevos; no se ejecutó otro setup durante esta entrega.

Los hashes de 69 archivos A/B permanecieron idénticos en la comprobación de repetición. La respuesta completa de la ruta D04 original coincide con el baseline previo; sigue activa en revisión 4, con nueve agarres. La única sección sigue siendo `fb171484-e48b-46db-8031-2b8509f18a91`, revisión 1. Crux permanece fuera de Git y de internet. No se creó ni publicó un recorrido real en el demo.

### Evidencia automatizada

- Tipos frontend/backend, formato y build aprobados. 36 pruebas frontend/dominio, 57 Worker/API y 6 guardas de herramientas demo. El build conserva el aviso de chunks grandes; no acredita rendimiento físico.
- Suite completa: 108 e2e escritorio/móvil. Las 20 comprobaciones nuevas del recorrido cubren enlaces/historial, imágenes antes del 3D, FOV/canvas/descarga únicos, exploración/retorno, zona, estado vacío, errores/recuperación, retirada, WebGL ausente, zoom 200 %, escritura incompleta, roles, privacidad de imágenes, conflictos, reintentos, orden/eliminación/undo y conservación ante sesión inválida.
- API real aislada de pruebas con Miniflare: permisos 401/403, privacidad de borradores e imágenes, límites JSON/PNG, referencias ajenas, publicación incompleta, concurrencia, idempotencia, historial, retirada y cambio de versión. Las escrituras de navegador usan fixtures interceptados; no son escrituras ni revisión humana de Crux.
- 320/390/768/1440 px, ambos temas, teclado y foco. Capturas sintéticas comparativas fuera de Git: `/tmp/ux-p2b-{320,390,768,1440}-{default,warm}.png`.
- Smoke público integrado: 6 aprobadas con `DEMO_REUSE_SERVER=1 npx playwright test --config playwright.demo.config.ts`, sin interceptar `/api`, setup ni reset.

### QA interno y criterios pendientes

En navegador interno se verificaron Inicio → Recorrer el gimnasio, ausencia explícita de recorrido público, acceso autorizado a Staff → Recorridos y preparación local vacía sobre Crux vigente (versión 2), con los pendientes de cámara/imagen/revisión y publicación bloqueada. Se añadió una parada vacía de interfaz sin guardarla; no se seleccionaron cámaras ni puntos reales ni se escribió en el demo. La regresión de pérdida de preparación durante comprobación de sesión tiene cobertura automatizada específica.

**Pendiente humano:** elegir y encuadrar al menos tres paradas reales sobre Crux, generar sus imágenes, revisar desde dos ángulos y confirmar antes de publicar exclusivamente en el demo local. La implementación no acredita este recorrido real. Teléfonos, lector de pantalla y rendimiento físico siguen pendientes, al igual que staging/despliegue. D04, su ruta y la sección originales se preservan.
