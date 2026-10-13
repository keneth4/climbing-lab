# API local y separación de gimnasios

Estado: primera API implementada; sin despliegue remoto. La interfaz Svelte todavía usa su almacenamiento de demostración, no esta API.

## Preparación

```sh
npm ci
npm run types:api
npm run db:migrate
npm run db:migrate:b
npm run db:seed
npm run db:seed:b
```

Cada comando de datos lleva `--local`. Los identificadores D1 de wrangler.jsonc son placeholders exclusivamente de desarrollo, no recursos cloud existentes. No desplegar ese archivo sin sustituirlos por recursos verificados.

En terminales separadas:

```sh
npm run dev:api
npm run dev:api:b
```

Gimnasio A: http://127.0.0.1:8787/api/routes

Gimnasio B: http://127.0.0.1:8788/api/routes

Las bases locales persistentes se guardan en .wrangler, excluido de Git. Seeds idempotentes agregan solo rutas ficticias y revisiones, no cuentas ni permisos de staff.

## Contrato inicial

| Método | Endpoint | Acceso y función |
| --- | --- | --- |
| GET | /api/health | Identidad del gimnasio configurado |
| GET | /api/routes | Rutas activas del gimnasio |
| GET | /api/routes/:id | Última revisión y estado; incluye históricas |
| GET | /api/me | Identidad autenticada y rol staff local |
| GET | /api/entries | Solo actividad del usuario autenticado |
| POST | /api/entries | Crear intento/ascenso en ruta activa |
| POST | /api/reports | Reportar error sin editar la ruta |
| GET | /api/staff/reports | Bandeja del staff local |
| POST | /api/staff/reports/:id/resolve | Resolver y registrar auditoría |

Listas: `limit` entre 1 y 100 (default 50), `offset` entre 0 y 10000. El gimnasio y el usuario no son parámetros de selección. Las respuestas de esta primera API no se cachean; la caché pública se añadirá con una política de publicación/invalidation.

Actividad: JSON con routeId, attempts (entero positivo hasta 10000), result (intento/ascenso) y notes opcionales (hasta 2000 caracteres). Reporte: routeId y description (hasta 2000). Las escrituras admiten solo application/json, limitan el cuerpo leído a 8 KiB y rechazan campos adicionales. La API obtiene revisión, usuario y fecha; no los acepta del cliente.

Errores: 400 validación, 401 sesión, 403 permisos locales, 404 objeto no encontrado, 413 cuerpo excesivo, 415 tipo de contenido; errores internos sin detalles de datos o tokens.

## Autenticación

La configuración actual usa auth.invalid: las operaciones privadas fallan de forma cerrada. No existe token demo ni header para suplantar usuarios en el Worker desplegable.

La API verifica tokens RS256/ES256 usando JWKS del emisor HTTPS configurado, audiencia, firma y claims sub/exp/iat. Las claves se cachean mediante jose; los roles vienen de D1, no de headers o claims elegidos por el cliente. La identidad compartida no convierte al staff de un gimnasio en staff de otro.

Las pruebas de autorización inyectan identidad solo al llamar directamente al handler desde el test. Esa función no se expone en HTTP. Las pruebas criptográficas usan claves generadas temporalmente; no se guardan secretos.

Para activar sesiones reales falta elegir/configurar el proveedor, su emisor y audiencia, login, redirects, CORS o proxy del frontend y alta inicial de administradores por un procedimiento controlado. Los tokens no se registran en logs.

## Migraciones y verificaciones

0001_initial.sql define rutas, revisiones, staff local, actividad, reportes e historial de auditoría, con restricciones, claves foráneas e índices de propietario/fecha. La API todavía no permite crear o editar rutas ni capturas: esa parte del editor y las revisiones llegará en el siguiente incremento.

```sh
npm run check:api
npm run test:api
npm run check
npm test
npm run build
```

Las 12 pruebas cubren bases D1 distintas mediante Miniflare, permisos staff entre lugares, propiedad de actividad, referencias a rutas ajenas, parámetros de tenant, validación, límites de cuerpo, resolución auditada y tokens válidos/expirados/manipulados/con emisor o audiencia incorrectos. La autorización se prueba en el handler contra D1 real del runtime local; además se hizo smoke HTTP de los Workers de ambos gimnasios. No es validación de un proveedor de identidad remoto ni de producción.

Wrangler generó worker-configuration.d.ts desde la configuración y la fecha de compatibilidad. Las comprobaciones de tipos del backend y frontend son independientes.

## Pendientes

- Conectar auth real y frontend; sustituir el modo staff demo.
- Añadir escritura versionada de rutas, administración de permisos y política de revocación de sesiones.
- Configurar rate limiting antes de acceso público y completar políticas de CORS/headers del despliegue.
- Añadir R2, capturas y marcadores 3D.
- Backups, restauración, monitoreo y pruebas remotas previos a operar membresías/pagos.

Fuentes: [D1 local](https://developers.cloudflare.com/d1/best-practices/local-development/), [Wrangler config](https://developers.cloudflare.com/workers/wrangler/configuration/).
