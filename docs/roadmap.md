# Etapas y decisiones pendientes

## Secuencia propuesta

| Etapa | Resultado |
| --- | --- |
| 0. Validación técnica | Comparación de formatos y prototipo de cámaras/marcadores con el spray wall |
| 1. Piloto funcional | Catálogo 3D, permisos, bitácora, reportes e imágenes compartibles |
| 2. Video | Recorridos preparados y exportación de clips |
| 3. Gestión de socios | Planes, vigencias, entradas, pagos manuales y dashboard de cobros |
| 4. Pagos en línea | Compras, renovaciones, promociones y conciliación de eventos del proveedor |
| 5. Tienda | Variantes, inventario y pedidos; recogida en gimnasio como propuesta inicial |

La personalización visual puede comenzar una vez validado el sitio funcional. Esta secuencia no implica fechas ni presupuestos comprometidos.

## Decisiones técnicas abiertas

- Motor del visor: evaluar las implementaciones existentes de MenuMaker antes de seleccionar PlayCanvas, Spark u otra alternativa.
- Formato de publicación: comparar SPZv4, SOG y, si las mediciones lo justifican, niveles de detalle.
- Stack de aplicación, autenticación, almacenamiento y despliegue.
- Límites de archivos, tiempos de procesamiento y política de retención de capturas/exportaciones.
- Picking y oclusión de marcadores; posible geometría auxiliar para edición.
- Generación de video en dispositivo o servicio.
- Exportación estática del catálogo frente a publicación mediante servicios; cuentas y cobros necesitarán servicios persistentes.

## Decisiones de producto abiertas

- Gimnasio piloto y dispositivos representativos.
- Escalas de graduación y tipos de ascenso que se registrarán.
- Cómo contar intentos y agruparlos por sesión.
- Política de revisiones y correcciones de rutas.
- Qué roles pueden publicar y resolver reportes.
- Reglas de atribución y datos visibles en tarjetas.
- Expiración, congelamiento y renovación de membresías.
- Conciliación de transferencias y terminal; conexión o registro manual.
- Proveedor de pagos y esquema de cuentas de cada gimnasio.
- Alcance del dashboard, gastos e inventario.
- Modelo comercial de Creativivid, todavía sin definir.

## Relación con MenuMaker

Se revisaron el README y package.json. El proyecto usa Svelte + Vite, exporta sitios estáticos e incluye PlayCanvas, Spark, Three y SplatTransform. Esto justifica investigar reutilización, pero no confirma todavía qué componentes se pueden trasladar.

Se propone mantener Climbing Lab como producto independiente y evaluar piezas compartidas. No se copiará código del repositorio privado a este repositorio público sin revisar qué se quiere publicar.

## Próximo trabajo

1. Incorporar la captura de prueba mediante un flujo de assets separado de estos documentos.
2. Revisar la implementación del visor y exportación de MenuMaker.
3. Registrar una decisión técnica con evidencia de rendimiento y edición.
4. Implementar una ruta completa sobre la interfaz base antes de ampliar el catálogo.
