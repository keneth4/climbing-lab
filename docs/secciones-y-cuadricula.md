# Secciones por vértices y cuadrícula

## Requisitos

- Mantener splats completos y regiones persistentes en coordenadas alineadas del gimnasio.
- Delimitar un contorno mediante 3–32 puntos aproximados seleccionados sobre el splat, ordenados alrededor del borde.
- Proyectar el contorno a un plano XY, XZ o YZ con posición y espesor configurables; no confundir una proyección con una superficie reconstruida.
- Mostrar cuadrícula y ofrecer ajuste opcional de nuevos vértices; permitir eliminar/deshacer puntos antes de guardar.
- Distinguir sección de pared y área accesible marcada por el administrador, sin inferir transitabilidad.
- Validar el contorno en cliente y servidor: puntos finitos, plano coherente, área positiva, sin bordes cruzados ni repetidos.
- Conservar compatibilidad con las secciones existentes por caja y autorización administrativa.

## Tareas

- [x] P1 — Modelo de polígono extruido y clasificación de región.
- [x] P2 — Migración local conservando secciones existentes.
- [x] P3 — Selección continua de vértices, eliminación y deshacer.
- [x] P4 — Cuadrícula por plano y ajuste opcional de vértices nuevos.
- [x] P5 — Contorno visible y validación de persistencia/permisos.
- [x] P6 — Verificación visual con Crux y cierre de evidencia.

## Uso

1. Selecciona la captura y el tipo de región.
2. Elige el plano: XY suele servir para una pared; XZ para suelo si Y es vertical. Ajusta la posición del plano y el espesor. Puedes seleccionar un punto y usar **Posicionar plano en este punto**.
3. Ajusta el paso de cuadrícula y activa ajuste a cuadrícula si lo necesitas. La cuadrícula muestra 20 intervalos por eje alrededor del centro de trabajo; no modifica el archivo.
4. Pulsa **Delimitar con vértices** y **Seleccionar punto**. Marca puntos en orden alrededor de la región. La selección permanece activa para añadir puntos; pulsa Cancelar selección o Escape para navegar.
5. Revisa contorno y lista de coordenadas. Elimina o deshaz puntos erróneos. Cambiar de plano borra los vértices para evitar una proyección accidental.
6. Nombra la región y confirma **Crear sección**. Hasta entonces no se escribe en la base.

## Límites

Los vértices son posiciones aproximadas de centros gaussianos proyectadas al plano elegido; no son vértices de una malla. La región guardada es un polígono con espesor, además de su caja envolvente para enfoque y compatibilidad. Las paredes muy curvas o con cambios de orientación necesitan varios contornos. No se detectan obstáculos, agarres ni superficies caminables. No se implementa navegación automática ni control de acceso físico.

El paso está en unidades del clon y solo equivale a metros tras calibrar escala. Las áreas accesibles son anotaciones manuales; no certifican seguridad. Las regiones guardadas siguen siendo estables; su modificación con historial queda para otra iteración.

## Logros verificados — 12 de octubre de 2026

- 26 pruebas backend, 9 de dominio/geometría y 10 de navegador pasaron. Tipos frontend/backend y build pasaron; sigue la advertencia conocida de tamaño de PlayCanvas.
- Prueba con PLY real de Crux en sesión aislada: selección continua de cuatro puntos, ajuste a cuadrícula, guardado de contorno y recuperación para visualizarlo. Sin errores de aplicación ni desbordamiento observados en escritorio 1440 × 1000 y viewport 390 × 844. API y sesión simulados; no se publicaron ni modificaron capturas del gimnasio.
- Migración 0004 aplicada en las dos bases locales. Se preservan las secciones existentes y el archivo completo.

## Próximas tareas

- [ ] Editar regiones guardadas con historial y control de versión.
- [ ] Gizmos para desplazar vértices y orientación libre del plano en paredes inclinadas.
- [ ] Revisar tamaño y densidad de cuadrícula con usuarios del piloto.
- [ ] Validar gestos y rendimiento en teléfonos físicos.
