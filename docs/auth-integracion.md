# Integración de Supabase Auth y D1 local

Fecha: 12 de octubre de 2026. Proyecto confirmado por el usuario: Climbing Lab, referencia defblrjdwgnqyzzgozdf.

## Implementado

- Cliente Supabase con clave publishable pública y flujo PKCE.
- Google, correo/contraseña, registro con confirmación, recuperación y cierre de sesión.
- Rutas /auth/callback y /auth/reset-password servidas por la SPA.
- Proxy Vite /api al Worker local del gimnasio A en 8787.
- Catálogo obtenido de D1, actividad privada y reportes enviados con Bearer token.
- Rol staff consultado en /api/me; selector de staff demo eliminado.
- Datos privados vaciados al cambiar/cerrar sesión y guardia de generación para evitar respuestas tardías de otra sesión.
- Eliminado guardado de actividad privada en localStorage de la demo. Los registros demo anteriores no se migran automáticamente a una cuenta real.
- Bitácora usa nombre y grado de la revisión histórica almacenada en D1.

La clave publishable puede estar en el frontend. No hay secretos de Google, SMTP, service_role ni contraseñas en el repositorio.

## Configuración pública comprobada

/auth/v1/settings: Google y correo habilitados; confirmación de email activada.

/auth/v1/.well-known/jwks.json: clave pública ES256 disponible. El Worker usa el emisor del proyecto y audiencia authenticated.

No se han cambiado ajustes externos ni creado usuarios mediante estas comprobaciones. La entrega SMTP y los redirects configurados en el dashboard no están confirmados por esos endpoints públicos.

## Ejecutar

Aplicar las migraciones y seeds según [API local](api-local.md). Mantener activos npm run dev:api y npm run dev. Abrir http://127.0.0.1:5173/ y entrar en Cuenta.

El gimnasio B sigue separado y puede ejecutarse con npm run dev:api:b. La interfaz apunta a A. Al desplegar se deberá servir frontend y API del mismo gimnasio/origen; el proxy de Vite solo existe en desarrollo.

## Prueba manual necesaria

1. Cuenta → Continuar con Google.
2. Elegir una cuenta permitida por la app OAuth de Google en modo de pruebas.
3. Regresar a la aplicación y comprobar que aparece el correo y Cerrar sesión.
4. En el catálogo, registrar actividad y comprobarla en Bitácora.
5. Recargar y comprobar persistencia en D1.
6. Cerrar sesión y comprobar que desaparecen los registros personales.

Para correo: configurar SMTP, probar registro/confirmación y luego recuperación. Los botones existen, pero no se declara validación completa de entrega de correos.

No hay alta automática de staff. Un administrador inicial se asignará a un UUID autenticado concreto en la D1 del gimnasio, con autorización del propietario. Login no equivale a staff.

## Pruebas automatizadas y límites

Pruebas de navegador en escritorio/móvil con respuestas de auth/API simuladas: catálogo anónimo, controles de login, QR, sesión/password, Bearer y limpieza al logout. Regresión del visor con PLY sintético. Pruebas backend de firma y aislamiento contra D1 local independientes.

Todavía no se ha completado login real de Google de extremo a extremo ni escrituras con un token real. El editor de rutas queda pendiente de API versionada; se retiraron controles que solo alteraban la demo local. Las cámaras del visor siguen siendo temporales en la interfaz; no se guardan en D1. La exportación de tarjetas sobre revisiones históricas completas sigue pendiente.

Caché del catálogo, rate limiting, revocación estricta de sesiones, publicación en Cloudflare y R2 siguen pendientes antes de producción.
