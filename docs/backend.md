# Backend: comparación y propuesta

Consulta de precios: 12 de octubre de 2026. Estado: recomendación provisional, pendiente de decisión. No se han creado recursos ni activado facturación.

## Restricciones

Mantener gastos al mínimo; buscar un piloto gratuito. El usuario estima hasta 3000 usuarios por gimnasio. Falta conocer número de gimnasios, usuarios activos, frecuencia de uso y tráfico público sin login.

## Propuesta

Supabase para autenticación y datos relacionales, con una base compartida entre gimnasios y aislamiento por lugar mediante políticas de acceso. Evaluar por separado almacenamiento y distribución de splats. Los sectores siguen siendo parte de una captura lógica completa, aunque su entrega se divida en bloques.

Esto es una inferencia de arquitectura: rutas/revisiones, permisos, bitácoras, visitas, membresías y pedidos tienen relaciones y restricciones que encajan con Postgres. Firestore también puede implementarlas, pero requiere diseñar documentos, duplicación y agregaciones adecuadamente.

## Cuotas relevantes

| Concepto | Supabase Free | Firebase Spark / Firestore Standard |
| --- | --- | --- |
| Autenticación | 50 mil usuarios activos mensuales | Con Identity Platform: 50 mil usuarios activos mensuales; métodos con excepciones |
| Base de datos | 500 MB por proyecto | 1 GiB |
| Operaciones | API sin cuota por solicitud; recursos limitados | 50 mil lecturas y 20 mil escrituras diarias gratuitas |
| Transferencia de datos | 5 GB de egress y 5 GB de cached egress, contabilizados por separado | Firestore: 10 GiB mensuales |
| Archivos | 1 GB; máximo 50 MB por archivo en Free | Cloud Storage requiere Blaze y cuenta de facturación |

Fuentes: [Supabase Pricing](https://supabase.com/pricing), [Firebase Pricing](https://firebase.google.com/pricing), [Firebase Storage y Blaze](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

Supabase Free permite dos proyectos activos, puede pausar proyectos tras una semana de inactividad y no incluye backups automáticos. Pro comienza en USD 25/mes; no es una estimación del costo total de la solución.

Los límites del proyecto compartido abarcan todos los gimnasios. Los usuarios registrados no equivalen a usuarios activos mensuales, concurrencia, lecturas o volumen histórico de bitácoras. Las cuotas de Firebase son independientes por producto; los bytes de un splat no corresponden a transferencia de Firestore.

## Archivos y tráfico

Ejemplo hipotético: un modelo publicado de 20 MB descargado 3000 veces transfiere unos 60 GB antes de considerar caché, carga parcial o nuevas versiones. No es una medición del modelo actual ni supone que cada visita descargue el archivo completo.

El PLY de prueba pesa 186 MB y excede el máximo por archivo de Supabase Free. No se propone entregar ese original al público. Se conservará fuera de la base de datos y se evaluará compresión y carga progresiva; el proveedor de entrega de assets todavía no está elegido.

Priorizar detalle por ruta solo reduce transferencia si se descargan bloques necesarios, no si se descarga primero un archivo completo. Se medirán bytes por sesión y reutilización de caché.

## Autenticación y costos adicionales

Para Supabase, el correo SMTP predeterminado no sirve para registros públicos: solo admite direcciones del equipo y actualmente limita a dos mensajes por hora. Se necesita SMTP propio para flujos de correo de producción, o estudiar acceso social y su configuración. No se propone desactivar verificaciones para evitar este costo. [Documentación SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

No comenzar con login por SMS. La credencial QR de visita seguirá separada de la sesión de usuario.

Firebase Cloud Functions y Storage requieren evaluar Blaze: tener cuotas sin costo no equivale a operar sin cuenta de facturación. Los costos de exportar videos, email, dominio, backups y pagos también quedan fuera del conteo de usuarios.

## Control del costo inicial

- Mantener catálogo público cacheable para evitar consultar datos repetidamente por visitante.
- Consultas paginadas de bitácora y reportes; evitar suscripciones realtime si no aportan al flujo.
- Generar tarjetas en el dispositivo y no conservar cada exportación en el servidor.
- Separar blobs del modelo, metadatos y datos privados.
- Medir crecimiento de datos incluyendo índices e historial; definir backups y restauración antes de operar membresías reales.
- Usar un proyecto compartido inicialmente, con aislamiento verificado, en vez de un proyecto por gimnasio.

## Siguiente decisión

Confirmar número de gimnasios piloto y método de login preferido. Luego fijar arquitectura de auth/datos, diseñar políticas por lugar y propietario, probarlas localmente y resolver entrega de assets antes de conectar el sitio público.
