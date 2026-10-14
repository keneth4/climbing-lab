# D04 — Cuenta y staff controlados

Una cuenta real fue autorizada como admin del demo durante el recorrido manual. Falta una segunda cuenta escaladora. No se crean JWT, contraseñas ni permisos por seed. Recorrido privado completo pendiente; las regresiones existentes con mocks no lo cierran.

Guion cuando el propietario disponga de cuentas controladas: entrar como escalador → verificar `/api/me` sin rol → guardar intento/proyecto/reporte → recargar y exportar sin campos privados → comprobar privacidad con segunda cuenta. Autorizar un UUID staff expresamente en D1 demo mediante procedimiento administrativo aislado y auditado; nunca reutilizar el script A para demo. Publicar solo después de preparar captura/cámara/agarres e imagen reales: las ilustraciones no satisfacen ese requisito. Revisar reporte, retirar y comprobar snapshots históricos/QR. Contrastar permisos A/B con las pruebas existentes.

Corregir defectos de sesión detectados por regresiones: la confirmación de recuperación de contraseña debe sobrevivir al cambio del formulario a la vista de cuenta. Verificar en desktop/móvil, sin afirmar auth real del demo.

## Ejecución D04 — 14 de octubre de 2026

Continuar en la rama del demo y PR #3 sin merge/deploy. Preparar perfiles privados `.playwright/demo-auth`, permisos de directorio 0700 y sesiones 0600, exclusión Git y limpieza explícita. Login manual en Chrome; comprobar cuenta mediante identidad real y `/api/me`; imprimir únicamente UUID/rol, nunca tokens, correo, passwords ni storageState.

Implementar `demo:staff UUID admin|editor|revoke --confirm=gym-demo`, destino fijo validado y cambio/auditoría atómicos; sin roles por seed. No ejecutar hasta que el propietario indique expresamente el UUID. Separar cuenta escaladora y staff.

Crux local: `/Users/keneth4/Downloads/Crux 1.ply`, fuera de Git. Subir mediante la interfaz administrativa existente, comprobar bytes y hash original/descarga, revisar orientación/cámara/sección, publicar captura y una ruta nueva con inicio/final y PNG reales. No importar coordenadas de ilustraciones ni de A/B. La colocación de agarres y la revisión de dos ángulos requieren intervención humana; no marcar verificaciones automáticamente.

Smoke privado opt-in: sesiones reales, gym-demo comprobado antes de acciones, usuarios diferentes, staff confirmado por servidor; comprobar ascenso/proyecto/reporte y persistencia, lectura/corrección ajena denegadas, historial/retiro/exportación sin PII elegida. Datos de prueba etiquetados y retirados lógicamente cuando corresponda; no borrar historia a mano.

Si faltan cuentas o revisión geométrica, conservar herramientas/evidencia y mantener D04 pendiente. L1–L3, teléfonos/lector, staging y recursos remotos siguen fuera de alcance.

## Evidencia real parcial

El propietario indicó expresamente el UUID de su cuenta después de login Google. `demo:staff` asignó admin únicamente en D1 demo y registró el cambio en `audit_events`; Firefox mostró «Permisos confirmados · Admin». El UUID permanece en la auditoría local, sin publicar datos de cuenta en el repositorio.

A petición del propietario, el recorrido continúa en Firefox. Crux se subió desde el selector de archivos de la interfaz administrativa. La interfaz confirmó «Captura completa subida como borrador» y estado `draft · ready`; el visor renderizó el muro. `node scripts/demo-crux-check.mjs` comparó directamente el objeto R2 local con el archivo original: 186.251.019 bytes y SHA-256 coincidente. Esta comprobación es de lectura y no publica la captura.

Pendientes: revisión humana de orientación y cámara, sección, agarres desde dos ángulos y publicación; segunda cuenta, actividad persistente y aislamiento entre usuarios; perfiles de automatización y smoke privado. El perfil Chrome preparado por `demo:auth` se canceló al cambiar a Firefox y no se guardó una sesión. D04 sigue abierto.

El propietario guardó la cámara inicial y creó «Spray Wall Completo» mediante preparación visual; ambos guardados se confirmaron en la interfaz real. Sigue pendiente la confirmación explícita de revisión completa antes de publicar. Verificación de implementación: tipos frontend/backend y formato aprobados, 19 pruebas frontend, 50 API (incluidas rechazo de argumentos, auditoría de cambios/revocaciones y rollback si falla auditoría), build aprobado. Estas pruebas API usan bases efímeras y no constituyen evidencia del recorrido privado entre dos cuentas reales.

Después, el propietario confirmó expresamente la revisión completa y autorizó la publicación local. Se publicó Crux desde la interfaz autenticada de Firefox: estado `published · ready · vigente`, generación 1 verificada por `GET /api/captures/current`, con cámara inicial correspondiente a esa captura. No se subió el PLY a Git ni a servicios remotos.

Se guardó «Prueba D04 · Crux local» como borrador con grado provisional V1 y reglas que indican su finalidad de prueba; revisión 2 vinculada a «Spray Wall Completo». Preparación 3D abierta para selección humana de agarres, cámara de ruta y respaldo. La confirmación de la captura no sustituye la revisión de agarres de esta ruta desde dos ángulos. Publicación de ruta y recorridos entre cuentas siguen pendientes. Regresiones adicionales: 44 e2e simulados y 6 smoke públicos con API/D1/R2 reales aprobados, manteniendo el demo abierto.

El propietario detuvo después la selección por problemas de usabilidad. Se priorizó la [corrección del editor de rutas](../../ux/editor-rutas-d04.md): referencia provisional visible, etiquetas numeradas seleccionables, controles agrupados y corrección de coordenadas CSS/framebuffer. La prueba manual de interacción en Firefox se realizó con un marcador temporal, retirado sin guardar la ruta. No se confirmó geometría ni se publicó una ruta durante esta corrección; D04 continúa pendiente.

## UX-P0 implementado; D04 abierto

El [plan UX-P0](../ux/01-editor-espacial-y-tour-3d.md#12-entrega-ux-p0--14-de-octubre-de-2026) registra pruebas y límites por separado. Firefox con Crux permitió revisar una selección temporal con ancla pequeña y etiqueta desplazada, y descartarla sin guardar la ruta. Se conservaron captura publicada local, sección y borrador revisión 2. No se ejecutó reset ni se publicaron assets remotos.

Pendientes concretos: selección humana de agarres y cámara de ruta, respaldo anotado y revisión desde dos ángulos; publicación de ruta; cuenta escaladora distinta, actividad persistente, privacidad e historial mediante API real. Las pruebas del editor con sesiones simuladas no cierran esos criterios.

## Plan de continuación aprobado — 14 de octubre de 2026

El propietario probó manualmente UX-P0 y reportó que el punto se percibe sobre la superficie del splat desde el primer intento. Es evidencia favorable de su escena; no sustituye la revisión de todos los agarres desde dos ángulos. No dispone todavía de una segunda cuenta.

Reutilizar Firefox, captura/sección y borrador sin sobrescribir ediciones posteriores. Completar con selección humana 3–8 agarres, cámara, inicio/final, grado y reglas; comprobar Aplicar/Cancelar y undo/redo, preparar PNG y publicar solo tras confirmación humana de la ruta. Preparar smoke privado opt-in con dos perfiles reales, roles comprobados por /api/me, destino gym-demo y datos identificados como pruebas; nunca ejecutarlo sin ambos perfiles. Verificar proyecto sin ascenso, persistencia de actividad, exportación privada, rechazo de acceso ajeno, reporte, revisión y retiro con historia intacta.

Añadir Firefox al helper de login manual, sesiones privadas excluidas de Git y limpieza explícita. Ejecutar regresiones y smoke público reutilizando el demo; sin setup/reset, migraciones, despliegue ni merge. D04 permanecerá abierto por la segunda cuenta y cualquier criterio humano pendiente.

## Preparación del verificador — 14 de octubre de 2026

Implementados `demo:auth -- staff|escalador [firefox|chrome]` (Firefox por defecto) y `demo:private -- UUID_RUTA --confirm=gym-demo`. El Firefox oficial administrado por Playwright se instaló y abrió el Inicio del demo gym-demo sin sesión; esto verifica arranque, no login Google ni recorrido privado. El Firefox nativo del propietario mantiene su perfil y preparación de ruta.

El verificador exige archivos privados sin symlinks, dos identidades distintas confirmadas por el Worker, staff admin/editor y escalador sin rol. Antes de escribir exige ruta activa, presentación verificada y cámara/captura coherentes; no inventa coordenadas. Crea una copia identificada como prueba para comprobar proyecto, intento/ascenso, recarga, aislamiento, concurrencia, responsable/resolución de reporte sin cambiar la ruta, edición/retiro y snapshot histórico. Comprueba QR/ficha retirada sin WebGL, las 16 combinaciones del renderer de privacidad y la igualdad de PNG descargado/vista previa en bitácora. Retira actividad y archiva proyecto lógicamente, conservando historia.

**Ejecución privada pendiente:** no se ejecutó el verificador, no hay dos sesiones autorizadas y no se publicará la ruta sin revisión humana. Solo pasaron tres pruebas de guardas con datos unitarios, sintaxis y formato; no contienen JWT ni constituyen evidencia entre cuentas reales. Ante fallo posterior a una escritura el script conserva la ruta de prueba y muestra su ID, sin borrar historia.

Se restauraron Vite 5174/Worker 8789 detenidos con `demo:run`, sin setup/reset. Firefox confirmó borrador revisión 2, sin agarres guardados ni respaldo/cámara de ruta; se abrió preparación 3D sin modificar la revisión. La selección de 3–8 agarres, revisión desde dos ángulos, PNG y autorización de publicación se solicitaron al propietario y siguen pendientes hasta su respuesta.

Verificación final de esta preparación: tipos frontend/backend sin errores, formato y build aprobados; 27 frontend, 50 API, 3 guardas del verificador y 56 e2e aprobados. La primera suite tuvo un timeout total de 30 s en la matriz de screenshots DPR 3; se asignó 60 s a esa matriz, pasaron los 12 tests espaciales y luego la suite completa de 56. El aviso de bundle PlayCanvas permanece. Seis smoke públicos reales aprobados con reutilización explícita del demo; sus conteos provienen ahora del catálogo real para admitir la futura ruta D04, sin interceptar API ni reiniciar datos. No se ejecutó el verificador privado ni se declararon aprobadas las selecciones/publicación pendientes.

## Ruta publicada localmente tras revisión humana

El propietario confirmó haber guardado el borrador después de revisar los requisitos y autorizó su publicación local. Firefox mostró revisión 3 con cámara y nueve agarres seleccionados por el propietario (cuatro inicio, tres intermedios y dos final); se conservaron los nueve aunque el guion proponía 3–8. Faltaban PNG y registro de la revisión: se recuperó «Ver ruta», generó el respaldo mediante «Usar vista anotada como respaldo» y marcó la revisión basándose en la confirmación expresa del propietario, sin afirmar revisión geométrica autónoma del agente.

La previsualización indicó «Lista para publicar» y se publicó desde la interfaz autenticada. «Prueba D04 · Crux local», ID `315f81b8-ee45-4ebe-b56a-c934a8509480`, quedó activa en revisión 4. GET anónimo confirmó gym-demo, nueve agarres, `markersVerified=true`, cámara de Crux y respaldo R2 local. Captura/cámara: `a449889e-b042-419a-b090-9630b330a088`; imagen: `addf7202-8b5c-4b35-8f74-5553cf802046`. No se alteraron posiciones/roles, ni se publicó Crux en internet.

Los seis smoke públicos reales pasaron de nuevo con el catálogo ampliado, sin setup/reset. Pendiente D04: segunda cuenta, sesiones privadas y ejecución del recorrido de proyecto/actividad, privacidad entre usuarios y revisiones históricas. Teléfonos, lector y rendimiento físico siguen pendientes.

Firefox administrado con contexto anónimo y WebGL deshabilitado: ficha y respaldo cargaron, QR/enlace conservaron el ID, recarga aprobada y PNG descargado idéntico byte a byte a la vista previa. Al solicitar 3D apareció «El visor 3D no está disponible en este navegador» manteniendo la ficha y Registrar actividad disponibles. La primera aserción temporal buscaba otro texto; se corrigió al mensaje existente y la prueba pasó, sin cambio de producto. No se inició sesión ni se ejecutó el verificador privado.
