# Continuación integral — 13 de octubre de 2026

## Alcance aceptado

Un gimnasio piloto; visor persistente con paneles plegables. Actividad agrupada por día del gimnasio, separada de visitas. Planes por periodo y entradas. Staff para rutas/recepción; admin para configuración, planes, cobros, inventario y ventas. Operación manual en MXN y America/Mexico_City, configurable. Imagen primero, video después. Sin checkout, renovación automática, facturación fiscal ni gastos en esta entrega.

## Estado de entregas

| Entrega                            | Estado                         | Evidencia / límite                                                                                                                                 |
| ---------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Conexión y permisos             | Cerrada local                  | API detenida y recuperación mediante Reintentar probadas; no modifica roles. `npm run dev:local` inicia Vite y Wrangler, con cierre conjunto.      |
| 2. Proyectos y actividad diaria    | Cerrada local                  | Privacidad, conflictos de versión, historial y agrupación de más de 50 registros probados.                                                         |
| 3. Tarjetas PNG 3D                 | Cerrada local                  | Captura, agarres y atribución; privacidad explícita; no sustituye capturas históricas ausentes. Exportación real de Crux verificada.               |
| 4. Video de barrido                | Cerrada local                  | Seis segundos, hasta 1280×720, formato detectado; cancelación, bloqueo de herramientas y restauración de cámara probados en Chrome.                |
| 5. Validación real y remoto        | Parcial, dependencias externas | Crux de escritorio y backup/restauración local probados. Faltan segundo splat, teléfonos físicos, identidad/dominio y R2 habilitado. No publicado. |
| 6. Socios / QR / visitas           | Cerrada local                  | Emisión, revocación/reemisión, identificación, confirmación, consumo y corrección auditada; concurrencia y aislamiento probados.                   |
| 7. Planes / cobros / dashboard     | Cerrada local                  | Vigencias y bonos, cobros pendientes/confirmados/anulados, historial, métodos, CSV y activación condicionada al cobro.                             |
| 8. Productos / ventas / inventario | Cerrada local                  | Catálogo público, variantes, ajustes versionados y ventas manuales; stock y reversión atómicos, precios históricos y ausencia de doble conteo.     |

«Cerrada local» describe funcionalidad del piloto, no aprobación para operación remota ni QA de dispositivos físicos. Los tests del navegador usan auth/API simulados; el backend se verifica con D1 real de Miniflare aislado. No se crean socios/cobros/ventas reales durante QA.

## Uso y reglas

**Conexión:** verificando, API no disponible, sesión inválida y permisos confirmados son estados distintos. Sin autorización verificada se bloquean acciones protegidas. El Worker distingue JWT inválido (401) de timeout/fallo del proveedor de claves (503), sin permitir bypass de autenticación. Reintentar actualiza sesión, catálogo y captura. No se reenvían escrituras automáticamente. Detén procesos de desarrollo anteriores antes de `npm run dev:local`; los puertos 5173/8787 son explícitos y Vite usa strictPort.

**Bitácora:** Mis proyectos permite crear, corregir, completar o archivar explícitamente una ruta. Un ascenso no completa el proyecto. Un proyecto por cuenta/ruta, hasta 1000, con revisión histórica de ruta e historial de cambios. Actividad por día del gimnasio usa la zona configurada y todos los registros del intervalo/estado aplicado, hasta 10000; intervalos mayores se rechazan sin totales parciales. Los filtros existentes siguen el calendario del dispositivo; la agrupación etiqueta los días del gimnasio. Retirados se consultan separadamente y no cuentan como actividad vigente.

**Compartir:** en el visor de ruta abre Compartir visual 3D. PNG de 1280×720 con nombre, grado y atribución. En bitácora, Preparar tarjeta histórica 3D recupera la revisión del registro y su captura. Nombre, resultado e intentos sólo se incluyen al activar la opción personal. Una captura/revisión ausente se informa sin reemplazarla por la vigente. Se debe esperar a carga completa; ninguna descarga publica en redes.

**Video:** barrido angular de 0,45 radianes alrededor del encuadre actual, seis segundos, 30 cuadros/s solicitados. El formato se detecta entre WebM y MP4; no se promete MP4 universal. Se reutiliza el canvas de composición para evitar asignar uno por cuadro. Cancelar o Escape libera tracks y restaura cámara sin descargar video; el foco pasa al botón de cancelación y vuelve al control original al finalizar. Si cambia la captura por un evento externo de sesión, se cancela la grabación. Navegación/herramientas están bloqueadas durante grabación. La cadencia real depende del dispositivo.

**Recepción:** socio manual, emisión o reemisión de QR (revoca anteriores), identificación mediante cámara compatible, lector externo o pegado de código, selección de membresía y confirmación. La cámara usa BarcodeDetector cuando existe; no se promete disponibilidad en todos los navegadores. El QR contiene un token opaco aleatorio, nunca un JWT/correo/datos financieros; D1 conserva sólo SHA-256. No concede login y no prueba identidad por sí solo. El staff debe comprobar al socio.

Se registra una visita por socio/día del gimnasio; relecturas devuelven la existente y no consumen entradas adicionales. Una visita puede registrarse sin membresía y sin consumo, de forma explícita. Bonos requieren confirmar consumo, vigencia y saldo. Anular requiere motivo y restituye una entrada como máximo una vez; conserva el registro y bloquea recrearlo ese mismo día. Este límite diario es una regla del piloto, no representa sesiones de escalada múltiples.

**Planes y cobros:** precios en centavos enteros; UI en unidades de moneda. Periodo de N días incluye inicio y N−1 días adicionales; bonos requieren fecha final explícita. Crear membresía genera un cobro pendiente para cualquier método. Sólo Confirmar cobro la activa. Transferencias pendientes no otorgan acceso. Editar precio/nombre o desactivar plan afecta futuras membresías; cambiar tipo/cantidad requiere crear otro plan. Anular requiere motivo, revoca membresía y conserva visitas históricas.

**Inventario:** crear producto/variante, agregar variantes a un producto existente, ajustar stock/precio con versión y motivo, activar/desactivar variante. Venta pendiente conserva nombre y precio de las líneas sin reservar stock. Confirmar cobro descuenta todas las líneas atómicamente; falta de stock rechaza toda la operación. Anular venta confirmada devuelve stock una sola vez. El dashboard agrega los cobros confirmados por fuente/método; no vuelve a sumar las ventas. Fechas financieras son días UTC, etiquetadas como tales. CSV hasta 2000 movimientos; intervalos mayores se rechazan.

## Persistencia e interfaces

Migración 0007: configuración de gimnasio, proyectos privados e historial. Migración 0008: socios, credenciales, planes, membresías, visitas, productos, variantes, ventas/líneas, cobros e historial operativo. Aplicadas en gimnasios A/B locales sin seeds de socios o dinero; preservan roles, rutas, bitácora y capturas.

- Público: GET `/api/config`, `/api/products`.
- Cuenta: GET/POST `/api/projects`, PUT `/api/projects/:id`, GET historial de proyecto, GET `/api/entries?group=day`, GET `/api/entries/:id/presentation` sólo propietario. `/api/members/me` permite registro identificado por JWT para integración futura.
- Staff: socios, emitir/revocar credenciales, resolver QR, visitas y anulación/historial de visita.
- Admin: configuración, planes, membresías, preparar/confirmar/anular cobros, dashboard/CSV, variantes, inventario y ventas. `/api/payments/:id/history` consulta versiones privadas del movimiento.

Las actualizaciones usan versión esperada y guards dentro de batches D1 para impedir sobrescrituras concurrentes. Cada movimiento audita responsable, fecha real y snapshot. El usuario y gimnasio se derivan de sesión y binding, nunca de un tenant elegido en el cuerpo. SQL preparado y respuestas sin caché. Las bases de prueba no comparten datos con la sesión real.

## Verificación

38 pruebas backend, 13 de dominio/CSV/restauración y 24 de navegador, más tipos y build. Incluyen límites de día, más de una página, cuenta/gimnasio ajenos, conflictos de proyecto/cobro/stock, visita duplicada, QR revocado, membresía pendiente/vencida, anulación repetida y ausencia de captura histórica. Chrome escritorio 1440×1000 y viewport móvil 390×844. Persiste la advertencia de tamaño del bundle PlayCanvas.

Crux real: 186251019 bytes, 751006 gaussianos; carga local hasta habilitar exportación 1988 ms; 120 callbacks RAF, mediana 16,7 ms, p95 50 ms, media 39,5/s. API de QA simulada, archivo real servido por streaming local; cero errores de aplicación y cámara conservada. PNG inspeccionado visualmente. Estos números no miden red remota ni equivalen a FPS de GPU/dispositivo físico.

Backup D1 local restaurado en almacenamiento temporal nuevo: 32 tablas, admin conservado y foreign_key_check vacío. El dump original intercalaba datos antes de tablas referenciadas; el preparador de restauración coloca todas las tablas primero sin alterar texto SQL entre comillas. El backup original permanece intacto. No se probó restauración remota ni backup R2 todavía.

## Pendientes externos

Consultar [preparación del piloto remoto](piloto-remoto.md). No marcar validación/publicación cerradas hasta contar con segundo splat, teléfonos reales, dominio y recursos habilitados. Sin cambios de facturación ni despliegue cloud en esta entrega.
