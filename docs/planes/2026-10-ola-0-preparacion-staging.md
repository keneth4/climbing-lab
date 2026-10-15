# Ola 0 · Preparación de staging y recuperación verificable

Estado inicial: planificación aprobada, implementación pendiente. Base: main, PR #6 integrado.
Fuente: auditoría `docs/auditoria-flujo-integral-ux-2026-10` @ d0cefd54a8e7f8933505c30e5f47c5c176ab3eb5 (G01, G02, B06, G05).

## Entrega

Preparar configuración del piloto, limitación de escrituras, QR de previsualización y ensayo conjunto D1/R2. No desplegar ni crear recursos cloud. Conservar `.wrangler/demo`, A/B, Crux, D04 y recorrido existentes.

1. Configuración: validar bindings, gimnasio, origen HTTPS, SPA/API y limiter; separar configuración de evidencia local y remota.
2. Recuperación: SQL completo, inventario R2 paginado, streams, metadatos, SHA-256 y manifiesto versionado. Restaurar únicamente en destino local vacío dedicado y confirmado. Reutilizar preparación SQL. Validar integridad, FK y referencias D1/R2. Fixtures sintéticos, nunca reset del demo.
3. Protección: 120 escrituras/minuto por identidad autenticada y gimnasio mediante binding configurable, 429 con Retry-After. Conservar permisos e idempotencia. Verificar multipart.
4. QR: separar vista previa y futura impresión pública. Impresión deshabilitada hasta verificación remota documentada; una URL configurada no la habilita.
5. QA: tipos, formato, dominio/API, build, e2e y smoke con DEMO_REUSE_SERVER=1. QA interno móvil/escritorio, temas y teclado. Evidencias separadas de validación física y remota.

## Interfaces y límites

Sin endpoints ni migraciones nuevos. Tipos de bindings generados. Herramientas de recuperación exclusivamente locales en esta entrega; no atribuirles validación de recuperación cloud. Backups privados excluidos de Git. No modificar experiencias de progreso, recepción, pagos ni editores.

## Aceptación

Ensayo con esquema actual, historia, imágenes, paginación, objeto grande, corrupción, ausencia, interrupción y destinos protegidos. Aislamiento de límites por usuario/gimnasio, recuperación 429, cargas y reintentos. QR local explícito, impresión bloqueada. PR independiente sin merge automático.

## Puertas pendientes

L1/L2: recursos reales, callbacks Supabase, HTTPS, QR público, respaldo/restauración remotos. L3: Android/iPhone, QR impreso, lector de pantalla, iluminación, sesión prolongada y segunda captura. Ninguna prueba local cierra estas puertas.
