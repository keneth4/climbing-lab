# Ola 0 · Preparación de staging y recuperación verificable

Estado: implementado y verificado localmente el 15 de octubre de 2026. Base: main, PR #6 integrado. L1/L2/L3 continúan pendientes.
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


## Evidencia de entrega — 15 de octubre de 2026

| Verificación | Resultado |
| --- | --- |
| `npm run check`, `npm run check:api` | Sin errores; Svelte sin warnings estáticos |
| `npm run types:api` | Bindings generados desde Wrangler instalado |
| `npm run format:check`; Prettier adicional sobre worker/scripts/config | Aprobado |
| `npm test` | 36 pruebas aprobadas |
| `npm run test:api` | 59 pruebas aprobadas; incluye cuota/aislamiento, cierre sin binding, permisos e idempotencia originales y multipart real |
| `npm run test:readiness` | 8 pruebas aprobadas; esquema actual, snapshots, metadatos, 108 objetos, corrupción, ausencia, interrupción y destinos protegidos |
| `npm run test:demo-tools` | 6 guardas aprobadas |
| `npm run build` | Aprobado; permanece aviso de chunks grandes, sin afirmar rendimiento |
| `npm run test:e2e` | 114 pruebas aprobadas, escritorio/móvil; regresiones de revisiones, privacidad, errores y fallback |
| E2E focal posterior de pilot/journal | 10 pruebas aprobadas tras ajustar tarjeta QR |
| `DEMO_REUSE_SERVER=1 npx playwright test --config playwright.demo.config.ts` | 6 smoke reales aprobados; sin interceptar API, setup ni reset |
| `npm run pilot:rehearse` | 108 objetos restaurados, verificación local true, remota false; sólo fixtures |

QA en navegador interno: ficha D04, compartir → vista previa QR, apertura por Enter, foco visible, impresión deshabilitada y explicación; 390×844 y 1440×1000, ambos temas existentes. Tarjeta QR marcada «VISTA PREVIA», descarga disponible e impresión pública bloqueada. Tamaño y tema restaurados; navegador devuelto a Recorridos. Capturas de evidencia sólo locales en `/tmp/climbing-ola0-qr-mobile.png`, `/tmp/climbing-ola0-qr-mobile-warm.png` y `/tmp/climbing-ola0-qr-desktop.png`; no incluyen assets Crux en Git.

Consola interna: advertencias existentes `binding_property_non_reactive` del formulario de actividad/reporte; no se modificó ese módulo ni se observaron errores de QR. Esta observación no equivale a una consola global sin advertencias. `node:sqlite` emite aviso experimental en las herramientas locales.

Lectura anónima de comprobación: `gym-demo` responde 200; D04 original activa en revisión 4; Main Gym publicado en revisión 19. No se escribieron rutas, agarres, cámaras ni recorridos reales durante QA. Persistencias A/B y demo fuera del ensayo de recuperación.

La plantilla de piloto conserva placeholders: no hay recursos remotos certificados, adapter remoto conjunto ni aprobación para impresión pública. El [runbook](../recuperacion-local.md) enumera las puertas cloud y físicas. No se ejecutaron comandos remotos, migraciones ni despliegues.
