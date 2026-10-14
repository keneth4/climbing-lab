# Climbing Lab

Herramienta de Creativivid para publicar sitios de gimnasios y zonas de escalada con catálogos de rutas sobre Gaussian Splatting, bitácoras personales y visuales compartibles.

Estado: primera base funcional local. El piloto completo está en desarrollo; el acceso usa Supabase Auth y los datos y capturas del gimnasio usan servicios locales de Cloudflare. El gimnasio todavía no está desplegado en producción.

Para ejecutar: `npm ci`, `npm run db:migrate` y `npm run dev:local`. Consulta [implementación y límites](docs/implementacion.md).

## Demo integral reproducible

`npm ci` → `npm run demo:setup` → `npm run demo:run`. Abrir http://127.0.0.1:5174/. Dataset y R2 locales aislados de A/B, ilustraciones propias y sin captura 3D verificada. Smoke real: `npm run demo:smoke`, con el demo detenido. [Guía, reset seguro y límites](docs/demo-local.md).

## Documentación

- [Visión y decisiones](docs/producto.md)
- [Alcance y validación del piloto](docs/piloto.md)
- [Modelo de datos propuesto](docs/modelo-de-datos.md)
- [Pantallas y flujos](docs/interfaz-base.md)
- [Etapas y preguntas pendientes](docs/roadmap.md)
- [QR y detalle por zona](docs/qr-y-lod.md)
- [Comparación de backend y costos](docs/backend.md)
- [Arquitectura en Cloudflare](docs/decisiones/0001-backend-cloudflare.md)
- [API local y pruebas de aislamiento](docs/api-local.md)
- [Login Supabase y conexión a D1](docs/auth-integracion.md)
- [Bitácora personal: filtros, resumen y exportación](docs/bitacora-personal.md)
- [Agarres 3D y flujo de ruta](docs/rutas-3d.md)
- [Editor de rutas y revisiones](docs/editor-rutas.md)
- [Secciones por vértices y cuadrícula](docs/secciones-y-cuadricula.md)
- [Preparación de capturas: requisitos, tareas y logros](docs/preparacion-capturas.md)
- [Clon digital: capturas completas, secciones y alineación](docs/clon-digital.md)
- [Implementación de la auditoría UX/UI y matriz de 36 hallazgos](docs/auditoria-ux-implementacion.md)
- [Sitio base de ejemplo y comparación de los 17 hallazgos](docs/sitio-base-ejemplo.md)
- [Validación de formatos y dispositivos antes del piloto](docs/validacion-formatos-dispositivos.md)

Primero se construirá una interfaz base enfocada en funcionalidad. El diseño particular de cada sitio se trabajará después, siguiendo el enfoque de MenuMaker y el sitio de AMPM.

## Referencias

- [MenuMaker](https://github.com/keneth4/menu_maker): referencia de edición y publicación de sitios personalizados; reutilización de código pendiente de evaluación.
- [AMPM](https://ampm.creativivid.com/): referencia de personalización visual.
- [Dioramix](https://dioramix.eu/): referencia conceptual de vistas guardadas y narrativa 3D.
- [Formatos de PlayCanvas](https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/).

Las capturas reales, datos personales y credenciales no forman parte de esta documentación.
