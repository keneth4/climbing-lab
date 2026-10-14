# Plan de implementación: próximo demo web canónico de Climbing Lab

**Fecha:** 13 de octubre de 2026  
**Repositorio:** https://github.com/keneth4/climbing-lab  
**Punto de partida auditado:** `main` @ `6fce9a7b2f70eab81df0799fbfc234d72bb27ec1`.  
**Relación:** [roadmap actualizado](../roadmap.md), [piloto funcional](../piloto.md), [interfaz base](../interfaz-base.md), [API local](../api-local.md), [arquitectura Cloudflare](../decisiones/0001-backend-cloudflare.md).  
**Tipo:** plan para Codex, **sin código implementado en este documento**.

## 0. Decisión de producto: qué se construye exactamente

La siguiente entrega es **una aplicación web de ejemplo de UN gimnasio** que pueda abrirse desde un enlace, verse suficientemente cuidada en móvil/escritorio y mostrar el valor funcional de Climbing Lab. El nombre, horarios, tarifas y fotografías son de demostración o se confirmarán con un gimnasio antes de publicarse como reales.

**No se diseñarán todavía tres sitios.** Se conservará desde ahora la estructura de datos, despliegue, autenticación y contratos que admite otros gimnasios. Cuando la aplicación canónica esté funcional y probada, cada sitio tendrá **solo su propia capa de presentación, contenido y assets**, manteniendo compartidas las correcciones y mejoras del core.

**Esquema de producto:**

~~~text
                         climbing-lab (core canónico)
                                    |
                      UI base + API + visor + dominio
                                    |
                     sitio DEMO de gimnasio ejemplo
                                    |
                 frontend público + cuenta + staff
                                    |
                Worker demo -> D1 demo -> R2 demo
                                    |
               identidades/roles por lugar verificadas
   ----------------------------------------------------------------
      Futuro: diseño A        Futuro: diseño B       Futuro: diseño C
      config/theme A          config/theme B         config/theme C
           |                       |                      |
      Worker/D1/R2 A          Worker/D1/R2 B         Worker/D1/R2 C
   ----------------------------------------------------------------
        misma lógica canónica, personalizaciones desacopladas
~~~

**Importante sobre «más gimnasios en la DB»:** el ADR vigente decide **D1 aisladas por gimnasio**. El código reconoce gimnasios/lugares conceptualmente, los seeds y pruebas cubren al menos A y B, y luego se añade C. El sitio demo no permite al navegador elegir otra D1 mediante `gymId`, cabeceras o IDs arbitrarios. No se propone una sola D1 compartida ni un selector de gimnasios en la UI del demo; esa alternativa requeriría revisar el ADR.

## 1. Lo que existe y lo que falta (verificado)

### Existe en `main`

- **Svelte 5 / TypeScript / Vite**, estilos genéricos simples, una pantalla con pestañas Catálogo/Bitácora/Staff.
- **Catálogo local** con filtros nombre/grado, beta, QR, enlace directo y ruta retirada.
- **Visor PlayCanvas** con import dinámico; carga PLY/SOG **local** y permite guardar cámara para ese archivo.
- **Bitácora, reportes y exportaciones PNG** de demostración guardados en `localStorage`.
- **Cloudflare Worker + D1 local**, endpoints de lectura pública de rutas, identidad, bitácora, reportes y resolución staff.
- Pruebas en `tests/pilot.spec.ts`, `worker/api.test.ts` y `worker/auth.test.ts`, incluyendo dos bases locales y verificación de autorización del backend.

### Aún no existe como sistema web integrado

- Navegación con página Inicio y ficha autónoma con apariencia coherente para visitantes.
- Cliente HTTP del frontend conectado a Worker ni contratos DTO front/back estables.
- Login real; `AUTH_ISSUER` usa `auth.invalid` y las operaciones privadas fallan cerradas.
- Captura persistida/publicada en R2 y marcadores asociados a coordenadas/capturas 3D.
- API staff para crear, editar, revisar, publicar y retirar rutas con revisión histórica.
- Guardado remoto y privacidad de bitácora, exportación 3D+marcadores, proyectos.
- Hosting de demo, dominio, backups, mediciones con archivo real o test integral de accesibilidad.

**No confundir código presente con una capacidad de demo lista para mostrarse.** La documentación en `docs/implementacion.md` tiene límites explícitos.

## 2. Definición de «demo»: tres hitos y una base canónica

### Hito D1 — Demo web público y compartible (primera URL presentable)

**Tareas del visitante:** abrir portada; ver identidad e información práctica de un gimnasio ejemplo; explorar rutas; filtrar; abrir ficha directa; leer grado, sector, beta y agarres; ver imagen/preview sin esperar 3D; activar visor remoto si el dispositivo lo soporta; compartir URL/QR.

**Criterio de salida:** sitio accesible desde teléfono externo sin Vite/localhost ni subir manualmente un PLY; ningún login exigido para consultar rutas. La ficha no queda en blanco si WebGL/3D falla.

**Mientras no exista la captura remota real:** se puede hacer preview público con una imagen genuina de demostración y mensaje honesto; **no llamar completo al Hito D1 3D** ni presentar un splat ficticio como validación del real.

### Hito D2 — Demo interactivo seguro

**Tareas del escalador:** iniciar sesión con proveedor real configurado; registrar intento/ascenso de ruta, ver su bitácora después de cerrar/abrir sesión; crear reporte, ver confirmación y exportar tarjeta respetando privacidad.

**Tareas del staff:** iniciar sesión con permiso local, revisar reportes, gestionar ruta y publicar/retirar revisión bajo autorización de servidor. Nunca habilitar `modo staff demo` para visitantes del sitio público.

**Criterio de salida:** las operaciones privadas consumen Worker/D1, no `localStorage` como fuente autoritativa; usuario sin permiso obtiene 401/403; pruebas de aislamiento y persistencia pasan.

### Hito D3 — Base funcional canónica lista para personalización posterior

Completar el [piloto funcional](../piloto.md): presentación de capturas y agarres 3D/revisiones, cámara principal, proyectos, compartir con exportación consistente, gestión staff de capturas, errores y QA. La base demo **sigue publicada como referencia canónica** aun cuando inicie el diseño de A/B/C.

El **diseño particular de cada gimnasio es una fase siguiente**, no una tarea requerida para D1, D2 o D3.

## 3. Alcance UX/UI: diseño genérico, no prototipo feo ni personalización

### Navegación y pantallas propuestas

| Superficie | Pantalla | Prioridad |
| --- | --- | --- |
| Pública | **Inicio**: valor del gimnasio ejemplo, horario/dirección de demostración identificados, CTA Rutas y contacto | D1 |
| Pública | **Rutas**: búsqueda, grado, sector si existe, vacío/error, tarjetas legibles | D1 |
| Pública | **Detalle de ruta**: nombre, grado, estado/revisión, preview, beta desplegable, 3D opcional, QR/link | D1 |
| Pública | **Visítanos / Información**: datos prácticos y contacto sin confundir con datos reales | D1 |
| Escalador | **Mi bitácora**, formulario de intento/ascenso, privacidad al exportar, sesión | D2 |
| Staff | **Panel de rutas**, editor/publicación, reportes, mensajes de estado | D2-D3 |
| Escalador | **Mis proyectos** e historial con revisión retirada | D3 |
| Staff | **Capturas y presentaciones** con versionado/cámara/marcadores | D3 |

### Normas visuales mínimas que sí se hacen ahora

- Diseño neutro y suficientemente pulido: jerarquía tipográfica clara, paleta semántica sobria, espaciados consistentes, tarjetas, bordes, estados hover/focus/disabled/loading/error.
- **Responsive desde móvil**: menú claro, búsqueda/filtros utilizables, tarjeta y detalle legibles en 320/390/768/1440 px; sin columnas comprimidas ni scroll horizontal.
- Estados vacíos y degradados reales; conservar información textual/imagen aun sin 3D.
- Controles accesibles: labels, foco visible, navegación con teclado, controles del 3D alternativos, no depender solo del color de agarres.
- Acciones primarias por contexto: visitante «Ver ruta», escalador «Registrar actividad», staff «Guardar borrador/Publicar».
- **Tokens CSS semánticos mínimos desde hoy**, por ejemplo `--color-surface`, `--color-text`, `--color-primary`, `--spacing-*`, `--radius-*`, sin crear un editor de temas ni la imagen de marca de tres gimnasios.

### Regla de independencia

Separar `ui/core` (componentes + estados), `domain`, `api`, `viewer`, `site-config` (demo hoy) y `branding` (diseños propios después). Son **límites lógicos propuestos**, no obligación de convertir el repo en un monorepo de inmediato.

Una corrección de ruta, autorización, QR, accesibilidad o visor se hace **una vez** en core. Cambiar hero, tipografía, paleta o composición de un gimnasio no exige clonar `App.svelte` ni alterar D1.

## 4. Contratos técnicos que Codex debe cerrar primero

### 4.1 Modelo de datos y URL

- **Dominio/Worker decide el gimnasio**; el backend enlaza su propia D1/R2. El frontend puede mostrar `gymId` de solo lectura para identidad visual; no es selector de permisos.
- **Ruta estable:** ID independiente de revisiones y capturas; enlaces QR siempre al sitio correcto del gimnasio. Preservar/redirect el formato existente `?ruta=<id>` al adoptar pantallas/rutas de navegador.
- **Revisión:** snapshot publicado de nombre, grado, sector, descripción, beta, flags, fecha, estado y presentación. La bitácora y tarjetas históricas apuntan a la revisión correspondiente, no a datos actuales.
- **Captura:** ID/version/content hash, formato, URL de derivado público, transformación/orientación, miniatura, estado de publicación. Guardar relación entre cámara/agarres y versión de captura; nunca reutilizar coordenadas incompatibles sin revisar.
- **Agarres/presentación:** puntos en coordenadas de captura (inicio/intermedio/final), cámara y área de interés opcional; superposiciones iniciales aceptadas sin prometer segmentación automática.
- **Estados:** borrador, publicada/activa y retirada, con política de corrección versus nueva ruta definida en la implementación.
- **Lecturas:** acordar DTO de listado y detalle antes de implementar UI. Hoy `GET /api/routes` retorna columnas de `routes` y `GET /api/routes/:id` retorna `snapshot`/revisión por separado: no es el mismo contrato que `src/domain.ts`. Resolver mapeo/versionado y paginación.
- **Contenido del sitio:** datos de ejemplo identificados como ficticios, sin URLs/horarios inventados de gimnasios reales; estructura lista para contenido real validado.

### 4.2 Auth, permisos y datos personales

- Elegir y configurar proveedor de autenticación gestionada (el ADR cita Supabase Auth como candidato, no como decisión de despliegue).
- Mantener validación JWT/JWKS en servidor, rol staff **desde D1 local** y propiedad de bitácoras; nunca confiar en toggle o headers enviados por cliente.
- Proteger alta inicial de admin; no publicar token demo reutilizable ni acceso staff anónimo.
- UI debe manejar 401, 403, expiración, reintento e inicio de sesión contextual conservando URL/ruta.
- Avisar que los datos son ficticios en staging público; no usar cuentas o fotografías de personas reales sin permiso.
- Definir rate limiting, CORS/origen, headers, auditoría, backups y restauración antes de habilitar escritura pública.

### 4.3 3D y almacenamiento

- Originales privados y derivado publicado explícitamente en R2; prefijos/versiones inmutables.
- Una escena por gimnasio con sectores y muchas rutas; **no un PLY duplicado por ruta**.
- Medición comparativa sobre una captura real disponible: formato, bytes, tiempo hasta imagen útil y 3D interactivo, fluidez, memoria y móviles.
- Empezar con imagen/poster y botón «Explorar en 3D». El viewer se carga bajo demanda, con reset/cámara por ruta y controles táctiles/teclado cuando corresponda.
- Evaluar SPZv4, SOG y streaming/LOD por evidencia; no declarar un formato ganador sin prueba.
- Exportación de tarjeta/vista: composición ligada a la revisión histórica, consentimiento explícito de nombre/fecha/intentos y fallback si la captura no puede renderizarse.

## 5. Secuencia propuesta para Codex — desarrollo en rebanadas verticales

**Flujo obligatorio de trabajo:** abrir rama NUEVA desde el `main` actualizado para iniciar el feature (`feat/demo-web-base` como propuesta). En la rama, escribir/ajustar documentación Markdown por incrementos, **un documento de plan por commit cuando el feature se descomponga**, después implementar y verificar el incremento; PR final hacia `main`. No comenzar desde la rama antigua de auditoría UX ni abrir ramas permanentes por gimnasio. El presente archivo es el **plan principal de implementación**; abajo están los planes de detalle que se escribirán al abordar cada rebanada.

| Orden | Documento de detalle propuesto | Desarrollo específico | Resultado demostrable |
| --- | --- | --- | --- |
| **01** | `docs/planes/demo/01-contratos-y-arquitectura.md` | DTO público, config de gimnasio ejemplo, routing, cliente API, migraciones/semillas necesarias | D1 local consulta D1 y muestra rutas desde API, no `localStorage` |
| **02** | `docs/planes/demo/02-interfaz-publica.md` | Portada, navegación, catálogo, ficha, estados, responsividad y tokens neutrales | Sitio genérico presentable en móvil y escritorio |
| **03** | `docs/planes/demo/03-assets-y-visor-publico.md` | R2 y versionado, preview, publicación de captura, visor remoto, cámara/agarres iniciales, fallback, medidas | QR/URL abre ficha y escena desde otro dispositivo |
| **04** | `docs/planes/demo/04-auth-bitacora-reportes.md` | Auth gestionada, sesiones, GET/POST entries y reports, feedback, privacidad y pruebas | Flujo escalador real y seguro con persistencia |
| **05** | `docs/planes/demo/05-staff-editor-publicacion.md` | Endpoints/migraciones de ruta/revisión, captura, preview, publicar, retirar y reportes con roles/auditoría | Staff actualiza una ruta para todos los visitantes |
| **06** | `docs/planes/demo/06-exportaciones-proyectos.md` | Proyectos, historial, tarjetas/PNG consistentes con revisión, QR imprimible, avisos de privacidad | Completa el flujo previsto en `docs/piloto.md` |
| **07** | `docs/planes/demo/07-deploy-qa-handoff.md` | Deploy demo, secretos, backups, CI, e2e, accesibilidad, carga real, guion de presentación y runbook | Demo canónico compartible y mantenible |

**Dependencias/prioridad:**

- 01 → 02 → 03 habilitan **D1** (con preview honesto mientras se integra captura real).
- 01 → 04 y 05, con identidad real, habilitan **D2**. El editor 05 puede avanzar sobre su contrato API mientras se prepara auth, pero **no exponerse** sin permisos comprobables.
- 03 + 04 + 05 + 06 + 07 completan **D3/D4**.
- Tras D3/D4 se planificarán y ejecutarán **capas de diseño A/B/C**, no antes.

### Detalle de entregables y criterios por incremento

#### 01. Contratos y fuente de datos

- Extraer la lógica del `App.svelte` monolítico: servicios públicos y estados de UI separados.
- Definir tipos/validación para catálogo, ruta, revisión y contenido. Alinear API/cliente con tipos importables o contrato compartido, sin acoplar frontend a SQL.
- Conectar HTTP con el Worker local sin usar datos simulados como si fueran producción.
- Preservar seeds A/B, pruebas de límites y rechazo de selección arbitraria de tenant.
- **DoD:** después de recargar, lista y detalle proceden de D1; vacíos, red caída y ruta inexistente muestran estado recuperable; pruebas API pasan.

#### 02. Sitio web base usable

- Shell público + inicio neutro de un gimnasio ejemplo; rutas navegables y deep links.
- Filtros y cards con estados y accesibilidad; al seleccionar ruta, conservar contexto/breadcrumb/back.
- Vista detalle coherente, beta y visor opcionales, CTAs de compartir/registrar.
- No incluir gestor de temas de tres gimnasios; solo tokens y props de configuración.
- **DoD:** tareas de visitante completables en móvil/desktop, sin cuenta y sin depender de abrir un formulario admin.

#### 03. Assets publicados y experiencia 3D progresiva

- Registro de capturas versionadas, publicación controlada y derivado válido de visor + miniatura; no almacenar PLY dentro de Git.
- Ruta apunta a presentación de captura correcta; overlay de agarres/cámara; fallback útil si dispositivo incompatible o descarga fallida.
- Revisar y medir con el spray wall real antes de fijar formato o presupuesto.
- **DoD:** abrir la URL en otro dispositivo carga una captura publicada, enfoca la ruta y no pierde información textual en fallo; archivo antiguo incompatible no recibe marcadores incorrectos.

#### 04. Cuenta de escalador

- Auth externa configurada de forma segura; login/logout, sesión y renovación; UI privada sin toggle staff.
- Registro de intentos/ascensos por API, bitácora personal, reports por API y estado de guardado/error.
- Mantener revisión histórica, controles de privacidad para compartir, no mostrar bitácora de otros usuarios.
- **DoD:** sesión de usuario A persiste sus actividades, B no puede leerlas; una sesión expirada no genera duplicados ni guarda localmente como falso éxito.

#### 05. Operación staff real

- Endpoint autenticado/autorizado de borradores, edición de ruta, revisión, validación, publicación/retirada; y administración controlada de capturas necesarias para demo.
- UI de edición con vista previa y confirmaciones para acciones sensibles; separación de rol y auditoría.
- Reportes: bandeja, estados y resolución con motivo según política.
- **DoD:** usuario sin rol staff no puede modificar rutas llamando HTTP directamente; publicación altera el catálogo público; URL/bitácora histórica siguen correctas.

#### 06. Compartibles y cierre de funcionalidades piloto

- QR estables por gimnasio, exportaciones con imagen/cámara/marcadores cuando estén disponibles, fallback honesto si no.
- Proyectos personales, vista de historial por revisión y opciones de divulgación personal.
- **DoD:** tarjeta histórica no muestra por error un armado nuevo; ruta retirada queda consultable como histórica; QR público funciona sin login.

#### 07. Publicación, pruebas y demostración

- Preparar proyecto/recursos cloud verificados, dominio de demo, settings y secretos; no reutilizar IDs placeholder de D1.
- Backups y recuperación probados, políticas de origen, rate limiting, límites de assets y monitoreo básico.
- Suite e2e de visitante, escalador y staff en 390/1440; pruebas de aislamiento y accesibilidad automatizada + revisión manual.
- Registrar resultados de rendimiento en dispositivos reales con escenas reales; no basarse únicamente en PLY sintético de 100 gaussianos.
- **DoD:** URL compartible y estable; guion de presentación reproducible; no accesos admin sin permisos; registro de errores y fallback de visor probado.

## 6. Propuesta técnica de estructura, sin refactor prematuro

~~~text
src/
  app/             # routing/shells, estados de navegación
  pages/           # inicio, catálogo, detalle, bitácora, staff
  components/      # primitives y cards genéricas
  features/
    routes/
    journal/
    reports/
    sharing/
  services/        # API/client, sesión y errores
  viewer/          # PlayCanvas y overlay/presentaciones
  theme/           # tokens/base theme neutro, sin marcas de clientes
  config/          # configuración validada gimnasio demo
worker/
  ...              # API, servicios, permisos y rutas D1
migrations/
  ...              # migraciones incrementales versionadas
docs/planes/demo/
  ...              # planes separados por rebanada
~~~

No es obligatorio crear exactamente estos directorios en el primer commit. **Hacer extracciones progresivas motivadas por los flujos implementados**, no reorganizar todo antes de tener una primera vista.

## 7. Pruebas mínimas para decidir «ya se puede enseñar»

| Escenario | Resultado exigido |
| --- | --- |
| Sin cuenta | Inicio y catálogo correctos, detalle y beta disponibles |
| Filtro vacío | Se explica ausencia de resultados y cómo limpiarlos |
| Enlace/QR | Abre la ruta correcta, en dominio del demo, sin depender de localhost |
| 3D lento/incompatible | Preview y datos permanecen disponibles; estado claro |
| Ruta retirada | Etiqueta histórica, no permite registrar ascenso nuevo como activo |
| Cuenta | Persistencia entre recargas/dispositivos, no lectura de bitácoras ajenas |
| Staff | No visible/autorizado para visitantes; publicar crea revisión y audita |
| Aislamiento | A y B en pruebas D1 no intercambian permisos ni entradas |
| Responsive | Revisiones 320/390/768/1440 px, sin overflow y con CTA legibles |
| Accesibilidad | Objetivo WCAG 2.2 AA; foco, teclado, labels/errores y alternativa al 3D |
| Share card | Usa datos históricos y consentimiento; no revela PII por defecto |
| Producción | No hay tokens demo, IDs D1 placeholder, assets privados públicos ni secretos en Git |

**No afirmar cumplimiento WCAG 2.2 AA con solo tests automatizados.** Se requiere inspección manual de pantallas/estados y lector de pantalla.

## 8. Guion de demo recomendado

1. Abrir la URL pública del gimnasio ejemplo en móvil; mostrar inicio neutro y cómo encontrar información útil.
2. Buscar una ruta por nombre/grado/sector; entrar a ficha, leer grado, beta, preview y abrir el visor 3D publicado.
3. Compartir enlace/QR desde otro dispositivo; mostrar la misma ruta sin cuenta.
4. Iniciar sesión con usuario de demostración controlado, registrar un ascenso y verificarlo en la bitácora.
5. Exportar tarjeta con y sin nombre para demostrar privacidad.
6. Iniciar sesión como staff autorizado (cuenta diferente), crear/editar/revisar y publicar otra ruta; comprobar cambio público.
7. Abrir una ruta histórica y comprobar que su registro no cambió; mostrar fallback del 3D.
8. Explicar que se trata de **la base canónica** y que las identidades visuales de tres gimnasios se producirán **después**, sin reimplementar estas funciones.

Antes de D2 es válido presentar **solo los pasos 1–3** como demo público en evolución. No fingir que 4–7 funcionan antes de tener auth y persistencia.

## 9. Bloqueadores, riesgos y mitigación

| Riesgo | Mitigación verificable |
| --- | --- |
| No se cuenta con una captura licenciada/publicable adecuada | Usar preview autorizado y registrar bloqueo del hito 3D; no inventar material |
| Captura real demasiado pesada en móvil | Medir, comparar formatos y estudiar streamed SOG/LOD; fallback visible |
| API demo con auth no configurada | Exponer solamente lecturas públicas; la API privada permanece cerrada |
| Confundir diferentes gimnasios en una misma DB | Mantener un D1/Worker por gimnasio según ADR, tests y fixture B; no aceptar `tenantId` del cliente |
| Editor altera revisiones históricas | Snapshots inmutables, IDs estables, pruebas de regresión de bitácora y QR |
| Personalización futura duplica lógica | Tema/config por gimnasio y extensiones; contrato del core y pruebas transversales |
| Acumulación de scope comercial retrasa demo | Video, pagos, tienda y membresías no bloquean D1-D3; planificar por separado |
| Falta de feedback sobre demo | Guion de tareas, pequeñas sesiones reales, registro de hallazgos antes de personalizar |

## 10. Qué NO incluye este próximo feature

- Tres webs diferentes con logos/paletas o composiciones finales.
- CMS drag-and-drop, marketplace de temas o forks por cliente.
- Dashboard financiero, tienda, pagos en línea o control de acceso físico.
- Exportación de video, picking automático/segmentación de agarres y alineación automática de capturas.
- Una vista global de bitácora entre gimnasios sin diseño de privacidad y servicios autorizados.
- Métricas de negocio ficticias o promesas de rendimiento no medidas.

Estos objetivos continúan en el roadmap y pueden entrar en el **core canónico** por futuros features, sin comprometer su independencia frente al diseño de cada gimnasio.

## 11. Comandos de verificación que Codex deberá ejecutar durante implementación

~~~sh
npm ci
npm run check
npm run check:api
npm test
npm run test:api
npm run build
npm run test:e2e
~~~

Cuando existan pipelines de deployment, añadir smoke remoto por dominio, comprobación de rutas profundas, assets, permisos y aislamiento. **El estado actual de esta investigación se deriva de lectura de repositorio**; estos comandos figuran como verificaciones futuras, **no como pruebas ejecutadas aquí**.

## 12. Checklist para abrir PR del feature

- [ ] Plan(es) de la rama actualizados y objetivos de cada commit comprobables.
- [ ] Fuente de datos de frontend claramente definida, sin modo demo que finja persistencia remota.
- [ ] Sitio del gimnasio ejemplo y shell staff separados, estética genérica correcta.
- [ ] 3D remoto con fallback o bloqueo documentado; mediciones reales anexas antes de declararlo listo.
- [ ] Permisos servidor, JWT real, migraciones/backups y cross-gym tests cuando haya escrituras.
- [ ] Historial, enlaces y QR estables; exportaciones sin filtración por marca o usuario.
- [ ] Pruebas unitarias/integración/e2e, móvil, accesibilidad y evidencia de demo.
- [ ] Documentación y guion de demo actualizados, sin incluir secretos.
- [ ] PR revisado hacia `main`; el ejemplo canónico debe seguir funcionando tras el merge.

## 13. Primer paquete listo para iniciar

**Primera ejecución recomendada de Codex:** `01-contratos-y-arquitectura.md` junto con su implementación en una rama de feature nueva. Es la dependencia de mayor valor porque resuelve la distancia entre el frontend `localStorage` y el Worker D1 ya creado, y fija el modelo público que usarán Inicio, Catálogo y Ficha. La estética base vendrá inmediatamente después; **no empezar con tres identidades visuales**.

**Salida mínima de esta primera ejecución:** catálogo y ficha de la web consumiendo la API local del gimnasio demo, tipos/errores consistentes, aislamiento A/B intacto, pruebas y navegación básica correcta.
