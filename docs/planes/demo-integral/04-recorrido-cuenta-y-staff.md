# D04 — Cuenta y staff controlados

No se han proporcionado cuentas autorizadas para el entorno demo. No se crean JWT, contraseñas ni permisos por seed. Recorrido privado real pendiente; las regresiones existentes con mocks no lo cierran.

Guion cuando el propietario disponga de cuentas controladas: entrar como escalador → verificar `/api/me` sin rol → guardar intento/proyecto/reporte → recargar y exportar sin campos privados → comprobar privacidad con segunda cuenta. Autorizar un UUID staff expresamente en D1 demo mediante procedimiento administrativo aislado y auditado; nunca reutilizar el script A para demo. Publicar solo después de preparar captura/cámara/agarres e imagen reales: las ilustraciones no satisfacen ese requisito. Revisar reporte, retirar y comprobar snapshots históricos/QR. Contrastar permisos A/B con las pruebas existentes.

Corregir defectos de sesión detectados por regresiones: la confirmación de recuperación de contraseña debe sobrevivir al cambio del formulario a la vista de cuenta. Verificar en desktop/móvil, sin afirmar auth real del demo.
