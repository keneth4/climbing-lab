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
