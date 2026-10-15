/** Validate declarations only; never contacts Cloudflare or certifies a deployment. */
export function checkPilot(config) {
  const fail = (message) => {
    throw new Error(message);
  };
  if (/replace-|placeholder/i.test(JSON.stringify(config)))
    fail('Completa los placeholders del piloto.');
  if (
    !/^[a-zA-Z0-9_-]{1,80}$/.test(config.vars?.GYM_ID ?? '') ||
    ['gym-a', 'gym-b', 'gym-demo'].includes(config.vars.GYM_ID)
  )
    fail('Destino local protegido: usa un gimnasio exclusivo del piloto.');
  if (config.d1_databases?.length !== 1 || config.r2_buckets?.length !== 1)
    fail('Declara exactamente una D1 y un R2 del gimnasio.');
  const db = config.d1_databases?.find((d) => d.binding === 'DB');
  const bucket = config.r2_buckets?.find((b) => b.binding === 'CAPTURES');
  if (
    !/^[a-f0-9]{32}$/i.test(config.account_id ?? '') ||
    !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(
      db?.database_id ?? '',
    ) ||
    db.database_id.startsWith('00000000-') ||
    !db.database_name ||
    db.migrations_dir !== 'migrations' ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket?.bucket_name ?? '')
  )
    fail('Cuenta, UUID D1 o bucket R2 inválidos.');
  if (
    [db.database_name, bucket.bucket_name, config.name].some((v) =>
      /(?:^|-)(?:local|demo|gym-a|gym-b)(?:-|$)/i.test(v ?? ''),
    )
  )
    fail('Recursos locales protegidos.');
  if (
    !config.name ||
    config.main !== 'worker/index.ts' ||
    config.assets?.directory !== './dist' ||
    config.assets?.not_found_handling !== 'single-page-application' ||
    !config.assets?.run_worker_first?.includes('/api/*')
  )
    fail('Configura el Worker, dist y enrutamiento SPA/API.');
  let origin;
  try {
    origin = new URL(config.vars.PUBLIC_ORIGIN);
  } catch {
    fail('PUBLIC_ORIGIN debe ser un origen HTTPS canónico.');
  }
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.port ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    !origin.hostname.includes('.') ||
    /localhost|\.local$|\.test$|\.invalid$/.test(origin.hostname) ||
    /^[\d.]+$/.test(origin.hostname) ||
    origin.hostname.includes(':')
  )
    fail(
      'PUBLIC_ORIGIN debe ser un origen HTTPS público, sin ruta ni credenciales.',
    );
  const limiter = config.ratelimits?.find((r) => r.name === 'WRITE_LIMITER');
  if (
    !limiter ||
    !/^[1-9]\d*$/.test(limiter.namespace_id) ||
    !Number.isInteger(limiter.simple?.limit) ||
    limiter.simple.limit < 1 ||
    limiter.simple.period !== 60
  )
    fail('Configura WRITE_LIMITER con límite positivo por 60 segundos.');
  if (
    !config.vars.AUTH_ISSUER?.startsWith('https://') ||
    config.vars.AUTH_AUDIENCE !== 'authenticated'
  )
    fail('Configura emisor y audiencia de autenticación.');
  return {
    configured: true,
    locallyVerified: false,
    remotelyVerified: false,
    publicOrigin: origin.origin,
    pending: [
      'Recursos D1/R2 reales',
      'Callbacks y login',
      'HTTPS y acceso público',
      'Respaldo/restauración remotos',
      'QR público',
    ],
  };
}
