# Etapas y decisiones pendientes

## Secuencia propuesta

| Etapa                 | Resultado                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------- |
| 0. Validación técnica | Comparación de formatos y prototipo de cámaras/marcadores con el spray wall                 |
| 1. Piloto funcional   | Catálogo 3D, permisos, bitácora, reportes e imágenes compartibles                           |
| 2. Video              | Recorridos preparados y exportación de clips                                                |
| 3. Gestión de socios  | Planes, vigencias, entradas, credenciales QR, visitas, pagos manuales y dashboard de cobros |
| 4. Pagos en línea     | Compras, renovaciones, promociones y conciliación de eventos del proveedor                  |
| 5. Tienda             | Variantes, inventario y pedidos; recogida en gimnasio como propuesta inicial                |

La personalización visual puede comenzar una vez validado el sitio funcional. Esta secuencia no implica fechas ni presupuestos comprometidos.

## Decisiones técnicas abiertas

- Motor actual: PlayCanvas. Comparar alternativas solo si las mediciones del piloto justifican un cambio.
- Formato de publicación: comparar SPZv4, SOG y, si las mediciones lo justifican, niveles de detalle.
- Evaluar bloques espaciales, carga progresiva y prioridad de detalle por región de ruta; ver [QR y LOD](qr-y-lod.md).
- Stack definido: Svelte/Vite, Supabase Auth y Worker/D1/R2 por gimnasio. Falta despliegue remoto, backups y validación operativa.
- Límites de archivos, tiempos de procesamiento y política de retención de capturas/exportaciones.
- Picking y oclusión de marcadores; posible geometría auxiliar para edición.
- Generación de video en dispositivo o servicio.
- Exportación estática del catálogo frente a publicación mediante servicios; cuentas y cobros necesitarán servicios persistentes.

## Decisiones de producto abiertas

- Gimnasio piloto y dispositivos representativos.
- Escalas de graduación y tipos de ascenso que se registrarán.
- Cómo contar intentos y agruparlos por sesión.
- Política de revisiones y correcciones de rutas.
- Roles definidos: administrador gestiona capturas y secciones; staff edita rutas y resuelve reportes. Falta gestión de invitaciones y revocación desde la interfaz.
- Reglas de atribución y datos visibles en tarjetas.
- Expiración, congelamiento y renovación de membresías.
- Conciliación de transferencias y terminal; conexión o registro manual.
- Proveedor de pagos y esquema de cuentas de cada gimnasio.
- Alcance del dashboard, gastos e inventario.
- Modelo comercial de Creativivid, todavía sin definir.
- Login mediante QR: definir un flujo temporal con prueba de identidad, separado de la tarjeta de visitas.

## Relación con MenuMaker

Se revisaron el README y package.json. El proyecto usa Svelte + Vite, exporta sitios estáticos e incluye PlayCanvas, Spark, Three y SplatTransform. Esto justifica investigar reutilización, pero no confirma todavía qué componentes se pueden trasladar.

Se propone mantener Climbing Lab como producto independiente y evaluar piezas compartidas. No se copiará código del repositorio privado a este repositorio público sin revisar qué se quiere publicar.

## Estado de la base funcional

- [x] Login Google/correo mediante Supabase y permisos locales por gimnasio.
- [x] Catálogo, cámaras de ruta, bitácora, reportes y QR de rutas.
- [x] Capturas completas versionadas, alineación asistida y conservación/importación por sección.
- [x] Cámara inicial del gimnasio y encuadre principal.
- [x] Secciones por caja o contorno, cuadrícula y selección aproximada de puntos.

Estas tareas describen capacidades locales verificadas, no certifican un servicio de producción. La selección de puntos, escala y alineación requieren revisión humana.

## Próximas entregas del piloto

| Orden | Entrega                             | Criterio para cerrarla                                                                                                                                 |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Corrección de regiones guardadas    | Editar cajas y contornos conservando identidad, historial y referencias de rutas; impedir sobrescrituras concurrentes; cancelar sin escribir datos     |
| 2     | Edición espacial más directa        | Seleccionar/mover un vértice, orientar el plano para paredes inclinadas y ajustar profundidad; conservar controles numéricos y comprobar móvil/teclado |
| 3     | Validación entre capturas completas | Probar con dos capturas reales alineadas; revisar escala, error de referencias y correspondencia de secciones/cámaras; conservar versiones anteriores  |
| 4     | Ruta real de principio a fin        | Elegir sección, cámara, puntos 3D de agarres y beta; consultar desde QR; registrar intento/ascenso y retirar ruta preservando historial                |
| 5     | Rendimiento y recuperación          | Medir carga, memoria y fluidez en dispositivos piloto; comparar PLY/SOG/SPZv4; reanudar/limpiar subidas interrumpidas; elegir LOD solo con evidencia   |
| 6     | Exportaciones compartibles          | Imagen y tarjeta con encuadre, datos y atribución; después barrido de cámara/video con límites de dispositivo conocidos                                |
| 7     | Piloto remoto con un gimnasio       | Configurar dominio y R2 remoto, backups/restauración, permisos y observabilidad; verificar flujos sin mocks antes de invitar socios                    |

## Siguiente entrega concreta: corrección de regiones

- [x] E1 — Definir revisión de sección y snapshot histórico; conservar su identidad al corregirla.
- [x] E2 — Migrar regiones existentes sin perder rutas ni capturas.
- [x] E3 — API administrativa con validación de geometría, versión esperada y auditoría atómica.
- [x] E4 — Cargar una región guardada en el editor, modificar nombre/tipo/volumen/vértices, previsualizar y guardar o cancelar.
- [x] E5 — Consultar historial y establecer cómo revisar correcciones sobre rutas existentes; no sobrescribir snapshots de ascensos.
- [x] E6 — Probar conflictos concurrentes, permisos, aislamiento, cancelación y persistencia en navegador.

La corrección geométrica no equivale a un cambio de armado: no retira rutas por sí sola. Cuando cambie el armado, se mantiene el flujo de publicación de captura completa por secciones. Las rutas guardadas conservan la revisión de sección anterior; al guardar explícitamente una edición de ruta, el staff adopta la revisión vigente. El historial anterior a la migración no puede reconstruirse: la geometría existente se registra como revisión inicial.

## Después del piloto visual

Gestión de socios y QR de visitas → planes, vigencias y cobros manuales → pagos en línea y conciliación → catálogo de ventas e inventario. Los gastos y el alcance de contabilidad se definirán como un módulo propio. Estas etapas siguen contempladas y no se adelantan mientras se valida el clon digital.

## Cierre de corrección de regiones — 12 de octubre de 2026

La edición administrativa mantiene ID, registra snapshots y auditoría, detecta revisión obsoleta y permite cancelar sin escribir. Historial y preparación de restauración disponibles en Capturas. Las restauraciones requieren confirmación y crean una revisión nueva. Los vértices admiten corrección numérica además de selección aproximada.

Verificación: 27 pruebas backend, 9 de dominio/geometría y 10 de navegador; tipos y build. Las pruebas de navegador usan auth/API simulados; las pruebas del Worker ejercitan D1 local y transacciones. Migración 0005 aplicada en bases A/B locales. Sigue pendiente la siguiente entrega: gizmos y plano de orientación libre.

## Continuación fuera del editor de secciones

La mejora de UX/UI, gizmos y orientación libre de secciones se mantiene pendiente por indicación del usuario. Se implementó el [flujo de agarres 3D de rutas](rutas-3d.md): preparación, cámara, beta y visualización con revisiones. El siguiente trabajo funcional es mejorar la relación entre beta/agarres y exportaciones, junto con la validación de continuidad usando dos capturas reales.

## Corrección de arranque del piloto

- [x] Rutas antiguas/de prueba sin sección ni captura no bloquean la primera publicación ni se vinculan automáticamente. Mantienen su snapshot y pueden prepararse tras publicar.
- [x] La interfaz identifica estas rutas como pendientes de asignación.
- [x] Pruebas de publicación inicial y reemplazo con ruta de prueba, conservación de cámara local/snapshot y navegador escritorio/móvil.

Se conserva el control para rutas ya vinculadas a una captura que perdieron su sección. Importar una ruta sin sección exige asignarla primero.

## Área personal del escalador

Se completó la [primera entrega de bitácora personal](bitacora-personal.md): resumen de intervalo completo, filtros locales de fecha/resultado, páginas, CSV de página y tarjetas históricas. Los siguientes candidatos fuera del editor de secciones son proyectos/sesiones de escalada y exportaciones 3D compartibles. Visitas QR, membresías y módulos comerciales siguen en etapas posteriores.
