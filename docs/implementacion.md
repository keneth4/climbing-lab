# Implementación local del piloto

Actualizado el 13 de octubre de 2026. El piloto tiene frontend conectado a API, autenticación y almacenamiento local; aún requiere validación física y preparación de producción.

## Ejecutar

Requiere Node.js 22.12 o posterior y npm. Usa las versiones del lockfile.

```sh
npm ci
npm run db:migrate
npm run db:migrate:b
npm run dev:local
```

El frontend abre en http://127.0.0.1:5173 y la API local A en 127.0.0.1:8787. `dev:api:b` ejecuta B en 8788 cuando se requiera comprobar el otro gimnasio. El login usa Supabase Auth; los datos del gimnasio usan D1/R2 locales. No se otorga staff automáticamente al registrarse.

## Estado vigente

- Svelte 5, TypeScript, Vite y PlayCanvas 2.23.2 como base del experimento.
- Catálogo público, enlaces QR estables, detalle inmediato, búsqueda/filtros y rutas retiradas.
- API de Worker conectada al frontend, permisos derivados de JWT y asignaciones locales de staff/admin.
- Bitácora propia con fecha de actividad, filtros, CSV, corrección/retiro e historial; proyectos separados de ascensos.
- Capturas completas administradas en R2 local, secciones y revisiones; cámaras/marcadores 3D vinculados a captura y revisión.
- Borradores privados de rutas, mínimos de publicación, respaldo PNG anotado, previsualización y restauración auditada de capturas.
- 3D bajo demanda, controles táctiles/teclado y continuidad de escena; consulta esencial disponible sin canvas.
- Tarjetas con presentación histórica, vista previa exacta y privacidad independiente por campo.
- Reportes operativos con categoría, responsable y respuesta al autor; métricas agregadas sin notas ni identidad.

La [matriz de la auditoría UX/UI](auditoria-ux-implementacion.md) define el comportamiento y la evidencia vigente. Los módulos comerciales y el barrido de video experimental ya existentes no se amplían en esta entrega.

## Verificar

```sh
npm run check
npm run check:api
npm run format:check
npm test
npm run test:api
npm run build
npm run test:e2e
```

Worker/D1/R2 se prueban en bases aisladas. Las pruebas de navegador usan Google Chrome instalado y Auth/API simulados en escritorio y viewport móvil. Las capturas sintéticas comprueban integración, no precisión ni desempeño del muro real.

## Límites y siguiente puerta

No hay despliegue remoto de esta entrega. La migración 0009 se aplicó únicamente en bases locales A/B; deben prepararse migraciones y objetos R2 de producción dentro del proceso de despliegue autorizado.

El archivo de escena sigue descargándose completo. SPZv4 y Streamed SOG/LOD no están habilitados. El bundle de PlayCanvas conserva la advertencia de tamaño; su carga está diferida hasta activar 3D. La elección de formato y los presupuestos de rendimiento requieren [mediciones en dispositivos](validacion-formatos-dispositivos.md).

El picking de centros gaussianos y las superposiciones son aproximados. La revisión de staff desde dos ángulos no sustituye validación física de profundidad/oclusión. No se segmentan agarres automáticamente. La emulación tampoco certifica ergonomía táctil ni accesibilidad.

Las rutas heredadas permanecen consultables y pueden mostrar respaldo/reglas pendientes; una publicación nueva debe cumplir los mínimos. Los borradores se conservan durante navegación de la sesión, no constituyen almacenamiento offline indefinido. La importación de demo no mezcla revisiones incompatibles ni crea datos automáticamente.

Un QR de localhost no es un destino distribuible. Validar dominio público, impresiones, teléfonos y acceso sin sesión antes de abrir el piloto. Conservar tanto D1 como los objetos históricos R2 en backups y restauraciones.

## Sitio público de ejemplo

La entrega de portada y navegación está documentada en [Sitio base de ejemplo](sitio-base-ejemplo.md). `/` abre Inicio y los enlaces heredados de catálogo/QR conservan su comportamiento. La configuración editorial versionada está en `src/site.ts`; no requiere cambios de D1/R2 ni despliegue.

## Demo integral aislado

Entorno gym-demo en 5174/8789 y `.wrangler/demo`, con setup idempotente, ilustraciones R2 y smoke sin mocks. [Comandos, evidencia y límites](demo-local.md). No se alteran A/B ni las validaciones de publicación; flujos privados reales pendientes.
