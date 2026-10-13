# 0001 — Backend sobre Cloudflare con separación por gimnasio

Fecha: 12 de octubre de 2026. Estado: infraestructura aprobada por el usuario; autenticación y mediciones pendientes. No se han provisionado recursos ni activado facturación.

## Contexto y recursos observados

Creativivid utiliza Workers y Pages. La consulta de solo lectura al MCP encontró Workers `landing` y `test`, el proyecto Pages `am-pm` y su dominio `ampm.creativivid.com`. No se encontraron bases D1. La API indicó que R2 debe habilitarse desde el dashboard. Esto no confirma el plan de facturación de Workers ni las cuotas restantes de la cuenta.

El usuario prefiere bases separadas para disminuir el riesgo de acceso entre negocios y estima hasta 3000 usuarios por gimnasio. Se prioriza costo mínimo.

## Propuesta de arquitectura

- Workers con Static Assets para nuevos sitios y API; mantener los sitios existentes.
- Un Worker por gimnasio, enlazado únicamente a su base D1. Todos se generan desde el mismo código y esquema versionado.
- Una D1 por gimnasio: catálogo, revisiones, permisos locales, bitácora de ese lugar, reportes y, posteriormente, visitas y operaciones comerciales.
- Un bucket R2 por gimnasio para capturas y archivos publicados. Originals privados; derivados públicos solo tras publicación explícita. Prefijos por versión de captura y archivos inmutables.
- Identidad compartida gestionada: Supabase Auth como candidato principal. No usar su Postgres para datos de los negocios en esta propuesta.

Autenticación gestionada evita desarrollar contraseñas y recuperación propias. Firebase Auth queda como alternativa si sus flujos o integración resultan más adecuados. El método de login no está aprobado todavía: se propone Google para el piloto; correo/contraseña necesita entrega de correo de producción. No activar SMS.

## Aislamiento y permisos

Cada Worker comprueba el token emitido por el proveedor (firma, emisor, audiencia y vigencia) y obtiene el usuario desde esa identidad verificada. Nunca confía en un user_id o rol recibido del navegador. El gimnasio es una configuración del despliegue, no una selección arbitraria de base por el cliente.

La API usa el binding de su D1, sin credenciales de administración de todas las bases. El staff y su capacidad se consultan en la base local; una cuenta compartida no implica permisos compartidos. Cada consulta de actividad personal verifica propietario. Operaciones financieras tendrán capacidades separadas de edición de rutas.

Los backups y migraciones se ejecutan por gimnasio y quedan registrados. El personal no recibe credenciales de Cloudflare. Las acciones sensibles se auditan. Una prueba con dos gimnasios debe demostrar que tokens y objetos de uno no permiten leer o modificar datos del otro.

La separación reduce el alcance de errores de routing y permisos, pero un administrador de la cuenta Cloudflare sigue teniendo acceso a todos los recursos. No representa aislamiento entre cuentas cloud.

La vista global de la bitácora es un alcance adicional: inicialmente cada sitio muestra actividad local. Más adelante podrá agregarse mediante servicios autorizados; no se concederá a los gimnasios acceso a bitácoras de otros lugares. No hay transacciones atómicas entre distintas bases D1.

## Cuotas verificadas

| Servicio | Cuota sin costo relevante |
| --- | --- |
| Workers Free | 100 mil solicitudes diarias; 10 ms CPU por invocación |
| D1 Free | 5 millones de filas leídas/día; 100 mil escritas/día; 5 GB totales |
| D1 Free, límites | 10 bases por cuenta; 500 MB por base; Time Travel de 7 días |
| R2 Standard | 10 GB-mes; 1 millón de operaciones A y 10 millones B al mes; egress sin cargo |

Son límites compartidos por la cuenta, no nuevas cuotas por cada gimnasio. Separar bases no multiplica las operaciones gratuitas. Desarrollo y pruebas también ocupan bases. D1 cobra/contabiliza filas escaneadas, no solo resultados; índices y paginación son necesarios.

Workers Paid parte de USD 5/mes más excedentes; D1 Paid admite bases de hasta 10 GB y recuperación de 30 días. R2 Standard fuera de cuota cobra almacenamiento y operaciones. No presupuestar cero solo porque su transferencia sea gratuita. R2 requiere habilitación y suscripción de facturación; no se ha habilitado.

## Presupuesto de ejemplo, no compromiso

Un piloto con hasta tres gimnasios podría usar tres bases de producción y bases de prueba dentro del límite de diez. Si las bases, solicitudes, CPU y operaciones quedan dentro de las cuotas, el costo incremental de esos servicios podría ser cero. No se garantiza a partir del conteo de usuarios.

Un modelo hipotético de 20 MB con 3000 descargas representa 60 GB de transferencia. R2 no cobra egress; sí cuentan las lecturas y cualquier Worker que intervenga. Si una sesión requiere 100 bloques y hay 3000 sesiones, son hasta 300 mil lecturas de bloques antes de considerar caché y manifiestos. Diseñar tamaño de bloques junto con LOD.

Autenticación, correo, exportación de video, dominios, impuestos y otros recursos existentes se consideran aparte. En Free, superar cuotas puede detener operaciones en vez de generar un cobro automático. En servicios facturados, alertas no equivalen a un límite duro de gasto.

## Orden de implementación

1. Añadir configuración y API local con una D1 por entorno/gimnasio, migraciones comunes y pruebas de aislamiento con dos lugares ficticios.
2. Elegir método de login y configurar un proveedor gestionado; probar tokens, sesiones y autorización antes de sustituir el selector demo.
3. Preparar almacenamiento R2 local y publicación versionada; medir captura real y LOD.
4. Crear recursos del piloto, configurar secretos y validar backups/restauración antes de publicar cuentas reales.
5. Medir cuotas consumidas por gimnasio y totales; reconsiderar Free antes de operar membresías y pagos.

## Fuentes

- [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2 Get started](https://developers.cloudflare.com/r2/get-started/)
- [Supabase JWT](https://supabase.com/docs/guides/auth/jwts)
- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
