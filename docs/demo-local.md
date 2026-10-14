# Demo integral local — Climbing Lab

## Preparar y abrir

Requisitos: Node 22.12+ o 24+, npm y Chrome instalado para smoke. Desde la raíz de un checkout de esta rama:

```sh
npm ci
npm run demo:setup
npm run demo:run
```

Abrir **http://127.0.0.1:5174/**. Worker dedicado en 8789. Los puertos deben estar libres; el script no cierra procesos ajenos. Ctrl+C cierra los servicios propios. `demo:run` comprueba primero el catálogo y R2; si faltan datos, ejecutar setup. En otra terminal, `npm run demo:check` verifica HTTP mientras el demo está iniciado.

Persistencia exclusivamente en `.wrangler/demo`, configuración `wrangler.demo.json`: Worker gym-demo, D1 UUID local terminado en 003 y bucket `climbing-lab-demo-local-assets`. No se usa `.wrangler/state` de A/B. Ningún script acepta destino remoto ni ejecuta deploy.

## Dataset y límites

Dataset v1: seis activas, una retirada y un borrador oculto; tres sectores ilustrativos, escalas V/Font, reglas y beta. IDs `demo-route-01`–`08`. El seed no crea permisos, actividad, proyectos ni cuentas. Repetir setup conserva rutas, revisiones y ediciones posteriores; no es una herramienta para restaurar estados editados.

`illustrationId` es referencia opcional de snapshot. Solo los siete IDs públicos registrados se resuelven a `/api/demo-assets/ID`. El endpoint requiere gym-demo y una referencia en revisión pública; sirve SVG original de R2 local con CSP y sin URLs arbitrarias. El frontend importa únicamente IDs, no todo el manifiesto de seed. Tarjetas, ficha y PNG señalan que son ilustraciones, no fotos del muro. Licencia/procedencia: dibujos vectoriales creados para este repositorio por código en `scripts/demo-data.mjs`, sin material externo ni personas.

No existen capturas/cámaras/agarres 3D fabricados. Las fichas públicas son ejemplos incompletos compatibles con la lectura de rutas heredadas; los requisitos normales de publicación permanecen vigentes. El borrador incompleto no se puede publicar hasta proporcionar una captura e imagen válidas. QR y enlaces localhost solo funcionan en el mismo equipo: no son enlaces públicos por internet.

## Reset y verificación

Detener el demo antes de reset/smoke:

```sh
npm run demo:reset -- --confirm=gym-demo
npm run demo:setup
npm run demo:smoke
```

Reset elimina todo el almacenamiento **solo del demo**, incluidas eventuales actividades de prueba. Requiere confirmación exacta, puertos libres y comprobación de ruta real sin symlinks; no elimina A/B. No es un procedimiento de backup o restauración de producción.

`demo:smoke` repite setup y levanta servicios temporales. Playwright consulta API/D1/R2 reales sin interceptar HTTP. Comprueba catálogo, filtros, ilustración, beta, QR, recarga, retirada, borrador protegido, teclado, cuatro anchos y PNG. Emula desconexión de red real del navegador y verifica conservación de datos/reintento. Artefactos en `/tmp/climbing-demo-*`. No se confunde esta suite con los e2e existentes de API simulada.

## Guion de exhibición

1. Inicio y aviso de gimnasio ficticio → Rutas.
2. Filtrar por nombre, sector o escala; seleccionar Travesía tranquila.
3. Imagen ilustrativa, reglas y beta opcional; explicar la falta de captura 3D verificada.
4. Compartir → QR/enlace local → recargar la misma identidad. Preparar PNG: contiene advertencia de ilustración y no datos personales por defecto.
5. Abrir `/?ruta=demo-route-07`: retirada, historial y enlace conservados.
6. Consultar borrador sin sesión: 401 y estado de no disponibilidad.
7. Recorrido privado de escalador/staff: **parcial**. Admin real confirmado en Firefox y Crux cargado como borrador íntegro; faltan publicación y segunda cuenta. Procedimiento en [D04](planes/demo-integral/04-recorrido-cuenta-y-staff.md). No insertar roles con el seed ni usar tokens falsos.

## Operación privada local D04

Tras login manual, Mi cuenta muestra el UUID. El propietario debe indicar expresamente qué UUID autoriza antes de asignar permisos:

```sh
npm run demo:staff -- UUID admin --confirm=gym-demo
npm run demo:staff -- UUID editor --confirm=gym-demo
npm run demo:staff -- UUID revoke --confirm=gym-demo
```

Destino fijo demo y cambio/auditoría atómicos; no modifica Supabase ni A/B. Recargar la interfaz para confirmar el rol real. Crux se importa por Staff → Capturas, desde el archivo local fuera de Git. `node scripts/demo-crux-check.mjs` comprueba tamaño y SHA-256 contra ese original, sin publicar ni escribir objetos.

`npm run demo:auth -- staff` y `npm run demo:auth -- escalador` preparan sesiones con login manual en Chrome para automatización posterior. No reutilizan ni extraen el perfil nativo de Firefox. Solo guardan el estado Supabase del origen demo, sin cookies de Google, en `.playwright/demo-auth` ignorado por Git (directorio 0700, archivo 0600). No enviar tokens por chat ni incluir estos archivos en evidencias. Para eliminar exclusivamente estos perfiles: `npm run demo:auth -- clear --confirm=gym-demo`; esto no revoca sesiones remotas ni roles D1. El recorrido manual actual continúa en Firefox; las sesiones automatizadas siguen pendientes.

No ejecutar reset durante D04: eliminaría la captura, permisos y datos de prueba locales.

Para comprobar el catálogo público mientras el demo está abierto, sin reiniciarlo: `DEMO_REUSE_SERVER=1 npx playwright test --config playwright.demo.config.ts`. La reutilización es explícita y las pruebas comprueban gym-demo; el comando normal conserva el rechazo de un puerto ocupado.

## Resultado verificado y siguientes puertas

- 19 pruebas frontend/dominio, 47 Worker/API y 44 e2e existentes aprobadas; seis smoke integrado reales desktop/mobile. Tipos, formato y build aprobados. El aviso de tamaño de PlayCanvas permanece; no equivale a medición móvil.
- Setup inicial/repetido y setup desde copia limpia con `npm ci` offline y ejecución Node 25.6.1: aprobados. La instalación temporal con Node 23 emitió advertencias de engine; se usó Node compatible para el bootstrap. El runner ahora rechaza Node 23.
- Seed preserva revisión inicial, edición posterior, actividad y rutas ajenas; no agrega staff. Reset sin confirmación rechazado; reset confirmado elimina demo y conserva hashes de 41 archivos de persistencia A/B. No hubo cambios de servicios remotos.
- Se corrigió una confirmación de recuperación de contraseña que desaparecía al cambiar la vista de cuenta; se verifica repetidamente en desktop/móvil. No prueba credenciales reales del demo.
- Browser plugin no disponible: Playwright con Chrome; capturas revisadas del catálogo y ficha reales. Teclado/responsive verificados, sin certificación WCAG ni lector físico.

D01–D03 y preparación/QA D05 completos para lectura pública L0. **D04 privado y L1–L3 pendientes**: cuentas autorizadas, captura real publicable, staging/DNS/R2, callbacks, protección antiabuso, backups y restore D1 + objetos R2, teléfonos/lector y tareas presenciales. Véase [piloto remoto](piloto-remoto.md) y [validación física](validacion-formatos-dispositivos.md). No ampliar pagos, tienda, video ni tres marcas para cerrar esta entrega.
