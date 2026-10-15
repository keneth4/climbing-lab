# Ola 0 · Respaldo conjunto y ensayo local

## Estado vigente — 15 de octubre de 2026

Herramientas locales implementadas. El ensayo no acredita recuperación cloud. No se ha desplegado, creado recursos ni aplicado migraciones remotas. Crux y la persistencia demo/A/B quedan fuera de estos comandos.

## Ensayo reproducible

Requisitos: dependencias del lockfile instaladas y Node 22.12+ (o 24+). `node:sqlite` puede emitir un aviso experimental; sólo se usa en herramientas locales.

```sh
npm run pilot:rehearse
npm run test:readiness
```

El primer comando crea una fuente sintética con todas las migraciones actuales, revisiones de rutas/recorrido, actividad sintética referida a una revisión histórica, imágenes y más de 100 objetos R2. También prueba un objeto binario de 6 MiB y una clave con `../`: el almacenamiento local utiliza SHA-256 de la clave, nunca la clave como ruta de archivo.

Cada ejecución usa directorios nuevos bajo `private-backups/`, excluido de Git: `fixture-ID`, `set-ID` y `rehearsals/restore-ID`. No arranca ni cierra servidores del demo. El comando muestra la ruta de backup, el destino restaurado y `verifiedRemotely: false`.

Para repetir una restauración de un set completo en un destino **nuevo**:

```sh
npm run pilot:restore-local -- private-backups/set-ID private-backups/rehearsals/restore-OTRO-ID recovery-fixture restore-local
```

Sustituir los IDs por los de una ejecución. La confirmación literal es `restore-local`. No se aceptan `.wrangler/demo`, `.wrangler/state`, enlaces simbólicos ni destinos existentes, incluso vacíos. No existe modo remoto en este comando. No reutilizar un destino interrumpido: conservarlo para diagnóstico y elegir otro ID. No contiene un comando de borrado automático.

## Qué se verifica

- SQL completo exportado por páginas, incluyendo tablas, índices e historial; se excluyen tablas internas de SQLite/Cloudflare.
- Inventario R2 paginado de todos los objetos completos, incluidos huérfanos e imágenes históricas. HTTP/custom metadata, tamaño y SHA-256; copia por streams y restauración multipart con buffers acotados de 5 MiB.
- Manifiesto v1 escrito **al final**. Sin manifiesto completo, el set es incompleto. `scope: local-only` impide confundirlo con un backup remoto verificado.
- Validación previa de hashes, gimnasio, versión, rutas seguras y SQL. Preparación SQL compartida con la herramienta anterior; recuperación en una transacción D1 y destino vacío.
- `integrity_check` sobre reconstrucción SQLite local del SQL, claves foráneas D1, esquema completo y referencias `object_key`/ilustraciones históricas → R2; verificación de hashes de objetos después de restaurar.
- El motor exige confirmación de ausencia de escrituras concurrentes y rechaza capturas en carga/finalización. Es un ensayo con fuente detenida; no ofrece snapshot atómico de servicios activos.
- Directorios privados 0700, archivos exportados 0600. El contenido no está cifrado: custodiarlo como datos privados y no adjuntarlo al PR.

Los tests cubren corrupción, ausencia de objetos, incompatibilidad, gimnasio incorrecto, destinos protegidos, interrupción de copia/restauración, aborto multipart y ausencia de marcador de éxito tras fallo. Una restauración incompleta nunca obtiene `verified.json`.

## Preparación de piloto

`pilot:check` sólo lee `wrangler.pilot.json` y valida declaraciones: destino exclusivo, cuenta/D1/R2, origen HTTPS, SPA/API, autenticación y binding WRITE_LIMITER. Su resultado distingue `configured`, `locallyVerified` y `remotelyVerified`; no consulta recursos ni Supabase. La plantilla intencionalmente conserva placeholders y debe fallar hasta completarlos con recursos reales autorizados.

`pilot:backup` sigue siendo la herramienta remota anterior de **SQL solamente**: su metadata indica `sql-only-incomplete`. No genera un set conjunto compatible con la restauración local y no basta para abrir L2. No se ejecutó durante esta entrega. `pilot:migrate` y `pilot:deploy` siguen siendo comandos remotos explícitos; no los ejecutan los tests ni el ensayo.

### Protección de escrituras

WRITE_LIMITER se declara por ambiente con 120 solicitudes por 60 segundos. La clave combina gimnasio del binding e identidad autenticada verificada; no procede de parámetros del navegador. La identidad se memoiza por solicitud, sin estado mutable global. Todas las escrituras pasan por el guard antes de los módulos API; GET/HEAD/OPTIONS no consumen cuota. Si falta el binding, falla con 503; cuota agotada devuelve 429 y Retry-After: 60. Los permisos y claves idempotentes originales se conservan.

`/api/ux-events` conserva su contrato anónimo y usa una cuota agregada por gimnasio con clave separada; no registra identidad, IP, notas ni tokens. Ajustar el límite en configuración después de medir tráfico real; no usarlo como contabilidad exacta. Los contadores son aproximados y por ubicación: [documentación de Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/). Cada piloto deberá reservar un namespace propio, sin compartir contadores accidentalmente con otro Worker.

### Puertas antes de habilitar L1/L2

- [ ] Propietario identifica gimnasio, cuenta, D1, R2, Worker y origen HTTPS canónico exclusivos; comprobar que existen y corresponden a los bindings.
- [ ] Contenido autorizado para internet; Crux sigue exclusivamente local.
- [ ] Configurar callbacks/orígenes exactos en Supabase y comprobar login/logout/retorno con dos cuentas autorizadas, sin registrar sesiones ni credenciales en Git.
- [ ] Autorizar por separado despliegue/migraciones; verificar TLS, SPA, API, fallback, permisos y consultas anónimas desde red externa.
- [ ] Implementar y ensayar adaptador remoto conjunto D1/R2, incluyendo metadatos y copia detenida/coherente; restaurar en recursos remotos nuevos y comprobar historia, referencias y permisos.
- [ ] Verificar el destino exacto del QR desde teléfonos fuera del equipo y documentar evidencia. Sólo después desarrollar la habilitación de impresión pública. En esta entrega permanece deshabilitada, incluso con PUBLIC_ORIGIN configurado; las tarjetas QR llevan «VISTA PREVIA».

## Protocolo físico pendiente — L3

Registrar fecha, dispositivo/OS/navegador, tamaño de captura y condiciones de red/luz. Usar Android y iPhone reales, escaladores y staff autorizados. Escanear QR impreso desde red externa; completar ficha, actividad y recorrido. Revisar reconocimiento de agarres desde dos ángulos, gestos, precisión de selección, lectura y operación sin WebGL. Probar VoiceOver/TalkBack, foco y objetivos táctiles. Mantener sesión de 20 minutos y registrar fallos, recargas, memoria disponible y variación de batería sin atribuir rendimiento a una medición única. Repetir con segunda captura y continuidad de revisiones. Cada criterio debe tener resultado/evidencia; cualquier fallo mantiene la puerta abierta.
