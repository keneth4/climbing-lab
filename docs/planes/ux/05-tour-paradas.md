# UX-P2B · Recorrido virtual por paradas

Base: main con PR #5 integrado; rama `codex/gym-guided-tour`.

## Entrega acordada

Recorrido público bajo demanda, con imágenes/texto sin WebGL, paradas Anterior/Siguiente, enlaces profundos y vuelta desde exploración libre. Cambio de cámara directo, sin autoplay; una captura y un runtime. Enlaces opcionales a rutas públicas y catálogo con `zona=ID`.

Staff prepara borradores; solo administración publica/retira. Editor de 3–20 paradas con cámaras, FOV, imágenes coherentes, títulos y revisión humana; reordenación/eliminación reversible, guardado incompleto, revisiones esperadas e idempotencia. Publicar crea revisión inmutable sin exponer borradores. Retiro conserva respaldo e historia y desactiva 3D. Cambio de captura/versión/transform exige revisión nueva.

Modelo/validadores compartidos, pose orbital y adaptador explícito al runtime sin modificar cámaras de rutas. Migración aditiva D1 y PNG en R2 existente; lectura pública solo de revisiones publicadas. Títulos hasta 80, descripciones 1000, JSON 64 KiB y PNG 5 MiB. Identidad del gimnasio desde bindings. Aplicar únicamente al demo local con comando dedicado y destino comprobado; no setup/reset/seed ni migraciones remotas.

## Verificación y límites

Tipos, formato, dominio/API, build, e2e y smoke con reutilización explícita. Cubrir permisos, privacidad, historial, conflictos/reintentos, cambio de captura, enlaces, fallos, un canvas/una descarga por captura, FOV, 320/390/768/1440 px, temas, teclado y zoom 200 %. QA navegador interno; escrituras automatizadas con fixtures. Tres cámaras/paradas reales de Crux requieren selección/revisión humanas antes de publicar; dejar ese criterio pendiente si falta.

Conservar Crux y D04. Sin biblioteca de agarres, caminar/colisiones, cine, nuevos formatos/LOD, gastos cloud ni despliegues. Teléfonos, lector y rendimiento físico pendientes. Commits separados modelo/API, editor, público, QA/documentación; PR independiente sin fusionar.
