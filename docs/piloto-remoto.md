# Preparación y dependencias del piloto remoto

Fecha: 13 de octubre de 2026. La preparación está lista; el piloto no está publicado ni aprobado para operación real.

## Información necesaria del propietario

1. Indicar nombre del gimnasio piloto y subdominio deseado de Creativivid; confirmar MXN y America/Mexico_City o sus valores reales.
2. Entrar a Cloudflare → cuenta de Creativivid → R2 Object Storage → habilitar R2. La API respondió «Please enable R2 through the Cloudflare Dashboard». Revisar las condiciones/costos que muestre Cloudflare antes de aceptar; el agente no activó facturación.
3. Proporcionar un segundo splat completo del mismo gimnasio, con referencias fiduciales reconocibles y anotación de secciones cuyo armado cambió. No entregar fragmentos para ensamblar.
4. Probar desde al menos un teléfono Android y un iPhone reales, anotando modelo, navegador, conexión y problemas de interacción. El viewport móvil de QA no sustituye esta validación.

El MCP de Cloudflare está conectado; la lectura de cuentas funcionó. D1 remoto devolvió lista vacía. No se crearon recursos remotos con un nombre de gimnasio inventado.

## Configuración y publicación

1. Tras conocer identidad del piloto y habilitar R2, crear una D1 y un bucket privado exclusivo de ese gimnasio. No reutilizar IDs locales ni recursos de otro negocio.
2. Copiar `wrangler.pilot.example.json` a `wrangler.pilot.json`. Sustituir account_id, nombre de Worker, GYM_ID, database_name/database_id y bucket_name por recursos verificados. La copia está ignorada por Git.
3. Ejecutar `npm run pilot:check`. Rechaza placeholders, IDs locales y configuración sin rutas SPA/API. Este comando valida formato, no existencia cloud.
4. Ejecutar `npm run build`, `npm run pilot:dry-run` y `npm run pilot:migrate`. Las migraciones son las del repo; no ejecutar seeds locales en remoto.
5. Asignar admin al UUID autenticado autorizado del propietario mediante SQL preparado/manual auditado en esa D1. Verificar `/api/me` desde una sesión real. No incluir contraseñas, claves privadas ni service-role keys en el frontend.
6. Ejecutar `npm run pilot:deploy`. Verificar el Worker de staging antes de conectar el dominio final. El archivo de ejemplo usa workers.dev; para dominio propio añadir una ruta/custom domain sólo después de verificarlo en la cuenta.
7. En Supabase Auth agregar los callbacks exactos del staging/dominio y el Site URL elegido; revisar inicio de sesión Google y correo/contraseña desde ese origen. Los callbacks OAuth del proveedor deben seguir apuntando a Supabase, no al Worker de forma arbitraria.
8. Configurar nombre/moneda/zona del gimnasio desde Recepción → Configuración. Cargar el splat completo mediante admin, preparar rutas y verificar QR, bitácora, permisos y exportaciones sin mocks.
9. Verificar backup/restauración y pruebas físicas antes de invitar socios o registrar dinero real. Mantener pendientes los criterios que no tengan evidencia.

La configuración sigue [Workers Static Assets con SPA y /api/* atendido primero](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/). Evita responder HTML a solicitudes API inexistentes. Logs y traces están habilitados; el Worker registra errores estructurados sin imprimir cuerpos, tokens ni datos financieros.

## Backup y restauración

1. Ejecutar `npm run pilot:backup` para exportar SQL y metadata de identidad del gimnasio a `private-backups/` (ignorado por Git). Copiarlo a almacenamiento privado fuera de la máquina; no subir dumps a Git ni publicarlos.
2. Conservar originales y una copia privada de los objetos R2 referenciados por capturas. El SQL solo no incluye gaussianos; el script de backup lo indica explícitamente. El backup de R2 remoto sigue pendiente hasta habilitar recursos.
3. Preparar una copia importable: `npm run pilot:prepare-restore -- private-backups/archivo.sql private-backups/archivo-restauracion.sql`. Coloca todas las tablas antes de datos, conserva cadenas con comillas/punto y coma, y usa defer_foreign_keys. No sobrescribe el backup original y rechaza esquemas con triggers no soportados.
4. Crear una D1 **nueva y aislada** para la prueba. Copiar la configuración a un archivo separado, apuntarlo a esa nueva D1 y verificar su UUID frente al manifiesto del backup; no importar sobre producción.
5. Importar con `npx wrangler d1 execute DB --remote --config archivo-de-restauracion.json --file private-backups/archivo-restauracion.sql`. No aplicar primero migraciones sobre ese destino: el dump ya incluye esquema y registros de migración.
6. Ejecutar `PRAGMA foreign_key_check`, comparar conteos por tabla, comprobar admin y snapshots históricos, y recuperar los objetos R2 bajo sus claves originales en un bucket de prueba.
7. Verificar un Worker de restauración aislado antes de cualquier cambio de bindings de producción. No reemplazar producción si la restauración no pasa.

El flujo local ya se ensayó en `/tmp`, sin alterar la D1 del gimnasio: 32 tablas, un admin conservado y cero errores de referencias. La importación inicial falló porque el export intercalaba datos antes de tablas referenciadas; el preparador resolvió el orden. [Cloudflare documenta defer_foreign_keys para cambios con referencias](https://developers.cloudflare.com/d1/reference/migrations/). La prueba remota y el backup/restauración R2 siguen pendientes.

## Validación real y rendimiento

Crux original se probó en Chrome de escritorio, 1440×1000: 186251019 bytes y 751006 gaussianos. Ready/export en 1988 ms por streaming local; 120 muestras RAF con mediana 16,7 ms, p95 50 ms y promedio 39,5/s. Archivo real, API simulada, cero errores de aplicación. PNG real inspeccionado; navegación conserva cámara.

Referencia provisional de escritorio para la próxima comparación: promedio RAF al menos 30/s, mediana hasta 20 ms y p95 hasta 50 ms bajo el mismo escenario. No equivalen a FPS GPU ni sirven como umbrales de red móvil. Repetir la medición con capturas comparables, red/dispositivos reales y formatos comprimidos antes de aprobar presupuestos de producción. No hay todavía umbral móvil ni garantía para 2M gaussianos.

Con el segundo splat comprobar escala y posición de referencias, secciones conservadas/actualizadas, importación de rutas, cámara inicial, marcadores y consulta histórica. Mantener ambas capturas completas; no mezclar fragmentos ni reutilizar coordenadas incompatibles silenciosamente.
