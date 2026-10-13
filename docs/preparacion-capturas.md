# Preparación de capturas: requisitos y seguimiento

## Objetivo

Preparar el splat completo del gimnasio sin depender de coordenadas adivinadas. Mantener el archivo íntegro y el sistema común de coordenadas entre versiones.

## Requisitos y aceptación

- R1: administrador guarda una cámara inicial por captura. Se restaura al volver a abrirla; es independiente de las cámaras de rutas. Se valida en servidor y usa control de versión. Una realineación invalida la cámara preparada para obligar a revisarla.
- R2: enfocar el contenido principal sin eliminar gaussianos. Ofrecer también encuadre completo y navegación visible por órbita/desplazamiento, zoom y teclado.
- R3: preparar una sección con centro y dimensiones ajustables, volumen visible mientras se edita, y guardar solo al confirmar. Mantener límites XYZ avanzados y persistencia en el sistema del gimnasio.
- R4: seleccionar una posición aproximada sobre el splat para centrar la vista, colocar una sección o preparar una referencia. Mostrar posición original y del gimnasio, marcador y posibilidad de corregir antes de guardar. No afirmar detección automática ni precisión métrica.
- R5: revisar con el PLY real de Crux en escritorio y viewport móvil; probar persistencia/autorización de cámara y evitar regresiones de rutas y publicación.

## Tareas

- [x] Diagnóstico con captura real y evidencia de problemas de encuadre.
- [x] C1 — Cámara inicial persistente y permisos del API.
- [x] C2 — Encuadre del contenido principal y navegación visible.
- [x] C3 — Selección aproximada de puntos y confirmación.
- [x] C4 — Editor de volumen de secciones con previsualización.
- [x] C5 — Integrar selección de referencias originales/permanentes.
- [x] C6 — Pruebas, documentación de límites y revisión con Crux.

## Logros

- Auditoría inicial registrada en `ff4e2ba`: el PLY abre, pero el fondo domina el AABB usado por Vista general.

## Fuera de esta etapa

Detección automática de fiduciales, arrastre de gizmos 3D, segmentación de agarres, LOD, reconstrucción o recorte del archivo, pagos y contabilidad. La primera edición visual usará selección de posición y controles de centro/dimensiones; la manipulación por gizmos se reserva para una iteración posterior.

## Uso de la primera iteración

1. Seleccionar un borrador completo en **Capturas**.
2. Enfocar contenido principal; orbitar, desplazar y ajustar zoom. Guardar la cámara inicial.
3. Seleccionar un punto aproximado; comprobar marcador y coordenadas originales/del gimnasio.
4. Preparar sección visual o centrarla en el punto; ajustar centro y dimensiones, nombrar y crear sección.
5. Usar el punto como referencia permanente o como observación de una referencia existente. Corregir coordenadas si hace falta; la referencia solo se guarda al confirmar el formulario.
6. Calcular alineación con tres o más referencias y volver a preparar la cámara tras realinear.

## Pendientes posteriores

- [ ] Gizmos para arrastrar límites del volumen y modificar secciones guardadas con versionado.
- [ ] Detección automática de fiduciales.
- [ ] Validación con teléfonos físicos, gestos y mediciones de memoria/FPS.
- [ ] Revisar aproximaciones de selección en superficies superpuestas y añadir ayudas de profundidad si hace falta.

## Cierre de la iteración — 12 de octubre de 2026

- Cámara inicial persistida en D1, con autorización de administrador, validación de valores y detección de versiones obsoletas. Se aplica al catálogo si no existe cámara específica de ruta.
- Encuadre principal estimado probado con Crux; se conserva acceso al AABB completo y todo el archivo original.
- Navegación visible: orbitar, desplazar, acercar/alejar, enfoque de sección y teclado del canvas.
- Selección aproximada por clic/toque con marcador superpuesto y coordenadas en ambos sistemas; confirmación independiente del guardado de referencia.
- Secciones preparadas con centro/dimensiones y contorno superpuesto; no se restablece la cámara al editar el volumen.
- Metadatos de capturas históricas disponibles para visualizar rutas de versiones anteriores, con borradores restringidos a administradores.
- Migración 0003 aplicada en gimnasios A y B locales; cuenta del propietario conserva admin.
- Verificación: 25 pruebas backend, 6 de dominio/selección espacial y 10 de navegador pasaron. Tipos frontend/backend y build pasaron; persiste la advertencia conocida de tamaño del paquete PlayCanvas.
- Prueba adicional con Crux: restauración de cámara después de recarga, selección de punto, sección confirmada y preparación de referencias; Chrome 1440 × 1000 y viewport 390 × 844, sin errores de aplicación ni desbordamiento observados. API y sesión simulados; no modificó datos del gimnasio.

### Límites del logro

La selección es un centro gaussiano estimado cerca del cursor, no una reconstrucción exacta de superficie ni un detector de fiduciales. El encuadre por percentiles puede omitir zonas relevantes de la vista. El usuario debe revisar cámara, volumen y referencias antes de publicar. No se probaron teléfono físico, consumo de memoria ni velocidad por internet. No se activaron recursos remotos de Cloudflare.

## Segunda iteración

El seguimiento de selección por vértices y cuadrícula está en [secciones y cuadrícula](secciones-y-cuadricula.md). Las cajas siguen disponibles; los nuevos contornos no recortan ni fragmentan el splat.
