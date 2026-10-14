# Validación de formatos y dispositivos del piloto

La entrega mantiene PlayCanvas 2.23.2 instalado y la carga completa PLY/SOG existente. No habilita SPZv4 ni Streamed SOG. Este protocolo prepara una comparación repetible; no registra resultados físicos ni presupuestos que aún no se hayan medido.

## Preparación

Usar una captura de referencia autorizada y conservar su hash, bytes, número de gaussianos y transformación. Convertir copias con versiones y comandos documentados del conversor. Verificar soporte real en la versión de motor/cargador de cada variante; marcar “no compatible” si falla, sin reinterpretarla como una medida de rendimiento.

Fijar una ruta, revisión, cámara, orientación, tamaño de viewport, marcadores y calidad. Usar los mismos agarres en todas las variantes. La conversión no debe cambiar silenciosamente el sistema de coordenadas. Generar una tarjeta de referencia desde ese encuadre.

Realizar tres repeticiones por dispositivo/red/formato, con caché fría y después caliente. Separar tiempo a ficha, imagen, descarga, preparación y escena útil. La aplicación ofrece medias agregadas; la comparación debe conservar medidas individuales y calcular mediana/p95 por condición. Los callbacks RAF no se etiquetan como FPS de GPU.

## Registro por condición

| Campo          | Qué registrar                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Equipo         | Modelo, RAM cuando esté disponible, sistema y modo de ahorro.                                                           |
| Navegador      | Nombre/versión, orientación y viewport.                                                                                 |
| Software       | Motor, conversor y comando exacto, versión del proyecto.                                                                |
| Asset          | Hash, formato/versión, bytes, gaussianos y transformación.                                                              |
| Red y caché    | Condición de red, latencia/caudal medidos, fría/caliente.                                                               |
| Disponibilidad | Tiempo a ficha, respaldo, fin de descarga, fin de preparación y escena útil.                                            |
| Interacción    | Fluidez observada y tiempos de cuadro de la herramienta de perfilado; anotar origen de la medida.                       |
| Recursos       | Memoria disponible por herramientas del dispositivo y estabilidad durante 20 minutos. No inventar medidas no expuestas. |
| Reconocimiento | Identificación de todos los inicios/finales y agarres intermedios por staff desde dos ángulos.                          |
| Exportación    | Misma ruta/revisión, texto completo, campos privados ausentes y agarres legibles.                                       |
| Fallos         | Descarga cancelada, recuperación, cambio de orientación, pérdida de sesión y error de asset.                            |

## Comparación y decisión

Comparar PLY de referencia, SOG simple y SPZv4 solo si la integración concreta lo admite. Evaluar imagen y reconocimiento en la misma cámara, además de bytes y tiempos. No usar únicamente número de gaussianos, compresión o una prueba de escritorio para elegir.

Probar LOD/Streamed SOG como experimento separado después de la línea base. Medir bytes hasta vista útil y cambios entre rutas cercanas/lejanas; comprobar saltos y pérdida de detalle alrededor de cada presa. Confirmar que la exportación espera el detalle requerido. Mantener SOG simple si ya satisface el presupuesto acordado.

El gimnasio debe acordar los máximos aceptables después de medir su dispositivo objetivo. Documentar versión elegida, evidencia, limitaciones y criterio de rechazo. Una variante que vuelve ambiguo cualquier agarre publicado se rechaza aunque descargue más rápido.

## Puerta física pendiente

Validar lectura con luz real, controles con una mano, pinza/pan sin atrapar el desplazamiento de página, QR impreso sin cuenta y accesibilidad manual. Anotar participantes mediante códigos anónimos y tiempos/errores de tarea, sin notas privadas ni datos personales. La autorización del piloto requiere registrar los resultados de esta ronda; las pruebas automatizadas actuales no la sustituyen.
