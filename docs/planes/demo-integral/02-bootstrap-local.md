# D02 — Bootstrap local aislado

Configuración dedicada `wrangler.demo.json`, gym-demo, D1/R2 locales y `.wrangler/demo`. Vite 5174 y Worker 8789; fallar ante puertos ocupados, sin terminar procesos ajenos. Scripts fijan configuración, persistencia y `--local`; no admiten destino remoto ni A/B.

Setup: prerequisitos → migraciones locales → seed idempotente → ilustraciones R2 → Worker temporal → verificación HTTP → detener proceso propio. Run inicia ambos servicios y limpia solo sus hijos. Check valida salud, catálogo y assets contra el entorno correcto. Reset exige `--confirm=gym-demo`, realpath seguro y puertos libres; elimina únicamente la persistencia demo.

Verificar setup repetido, conservación de revisiones, reset y copia limpia. No introducir credenciales ni roles. Recorrido privado queda pendiente si no se proporcionan cuentas autorizadas.
