# UX-P1B · Zonas y planos inclinados

Base: main con PR #4 integrado; rama `codex/section-editor-oriented-geometry`.

## Entrega acordada

Flujo Tipo → Superficie → Contorno y espesor → Revisar y guardar. Zona de escalada o área visitable; caja rápida, contorno XY/XZ/YZ y plano inclinado definido por tres puntos no alineados. Vértices visibles, edición Aplicar/Cancelar, deshacer/rehacer y alternativas sin arrastre. Espesor simétrico en unidades del clon, vista perpendicular y restauración de cámara, un solo visor.

Unión compatible de geometría clásica y `oriented-polygon`, con base ortonormal, origen, vértices UV y espesor. Validación compartida cliente/servidor y bounds derivados del volumen. Endpoints y almacenamiento JSON actuales, sin migración SQL. Revisiones esperadas, auditoría, conflictos sin pérdida de preparación y rutas históricas sin retargeting. Mostrar dependencias y ofrecer crear ruta en zona guardada.

## Verificación y límites

Pruebas de plano, UV/mundo, bounds, validación e historia; caja/contorno/inclinado, edición reversible, captura, errores, concurrencia y permisos. Tipos, formato, dominio/API, build, e2e y smoke con `DEMO_REUSE_SERVER=1`, sin setup/reset. QA navegador interno, 320/390/768/1440 px, ambos temas, zoom 200 %, teclado y fallback. Fixture para escrituras automatizadas; Crux requiere revisión humana y la sección/ruta D04 original no se modifica.

Commits separados para geometría/validación, editor, integración histórica y QA. PR independiente sin fusión automática. Sin tour, biblioteca de agarres, segmentación, paredes curvas ni despliegues. Teléfonos reales, lector y rendimiento físico pendientes.
