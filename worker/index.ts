import { demoAsset } from './demo';
import { pilotApi, requestKey, writeOnce, presentationKey } from './pilot';
import { operationsApi } from './operations';
import { projectApi } from './projects';
import { journalCsv } from '../shared/journal-csv';
import { entryApi } from './entries';
import { point } from '../shared/alignment';
import { HttpError, json, body, text } from './http';
import { captureApi } from './captures';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function verifyToken(
  token: string,
  issuer: string,
  audience: string,
  keys: JWTVerifyGetKey,
): Promise<string> {
  const { payload } = await jwtVerify(token, keys, {
    issuer,
    audience,
    algorithms: ['RS256', 'ES256'],
    requiredClaims: ['sub', 'exp', 'iat'],
  });
  if (!payload.sub) throw new Error('Missing subject');
  return payload.sub;
}

export function authFailure(error: unknown): HttpError {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
  const invalid = [
    'ERR_JOSE_ALG_NOT_ALLOWED',
    'ERR_JOSE_NOT_SUPPORTED',
    'ERR_JWS_INVALID',
    'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
    'ERR_JWT_CLAIM_VALIDATION_FAILED',
    'ERR_JWT_EXPIRED',
    'ERR_JWT_INVALID',
    'ERR_JWKS_NO_MATCHING_KEY',
  ];
  return invalid.includes(code)
    ? new HttpError(401, 'Sesión inválida o vencida.')
    : new HttpError(
        503,
        'No se pudo verificar la sesión: proveedor de identidad no disponible. Reintenta.',
      );
}
async function identity(request: Request, env: Env): Promise<string> {
  const token = request.headers
    .get('Authorization')
    ?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Inicia sesión.');
  if (token.split('.').length !== 3)
    throw new HttpError(401, 'Sesión inválida o vencida.');
  try {
    const issuer = new URL(env.AUTH_ISSUER);
    if (issuer.protocol !== 'https:' || issuer.hostname === 'auth.invalid')
      throw new Error('Auth not configured');
    let keys = keySets.get(env.AUTH_ISSUER);
    if (!keys) {
      keys = createRemoteJWKSet(
        new URL(`${issuer.href.replace(/\/$/, '')}/.well-known/jwks.json`),
      );
      keySets.set(env.AUTH_ISSUER, keys);
    }
    return await verifyToken(token, env.AUTH_ISSUER, env.AUTH_AUDIENCE, keys);
  } catch (error) {
    throw authFailure(error);
  }
}
async function editor(env: Env, user: string) {
  if (
    !(await env.DB.prepare('SELECT user_id FROM staff WHERE user_id=?')
      .bind(user)
      .first())
  )
    throw new HttpError(403, 'No tienes permisos de staff en este gimnasio.');
}
async function revision(env: Env, id: string, active = false) {
  const r = await env.DB.prepare(
    'SELECT rr.revision, rr.snapshot, r.status FROM route_revisions rr JOIN routes r ON r.id=rr.route_id WHERE r.id=? ORDER BY rr.revision DESC LIMIT 1',
  )
    .bind(id)
    .first<{ revision: number; snapshot: string; status: string }>();
  if (!r || (active && r.status !== 'activa'))
    throw new HttpError(404, 'Ruta no disponible.');
  return r;
}
function routePayload(b: Record<string, unknown>) {
  const allowed = [
    'name',
    'grade',
    'sector',
    'beta',
    'status',
    'holds',
    'holds3D',
    'camera',
    'expectedRevision',
    'sectionId',
    'captureId',
    'gradeScale',
    'rules',
    'imageId',
    'markersVerified',
    'changeReason',
  ];
  if (Object.keys(b).some((k) => !allowed.includes(k)))
    throw new HttpError(400, 'Campo no permitido.');
  const drafting = b.status === 'borrador';
  const field = (value: unknown, max: number) =>
    drafting && (value === '' || value === undefined) ? '' : text(value, max);
  const name = field(b.name, 80),
    grade = field(b.grade, 15),
    sector = field(b.sector, 80);
  if (
    b.gradeScale !== undefined &&
    !['V', 'Font', 'Otra'].includes(String(b.gradeScale))
  )
    throw new HttpError(400, 'Escala inválida.');
  if (
    b.rules !== undefined &&
    (typeof b.rules !== 'string' || b.rules.length > 2000)
  )
    throw new HttpError(400, 'Reglas inválidas.');
  if (b.markersVerified !== undefined && typeof b.markersVerified !== 'boolean')
    throw new HttpError(400, 'Verificación inválida.');
  if (
    typeof b.beta !== 'string' ||
    b.beta.length > 2000 ||
    !['activa', 'retirada', 'borrador'].includes(String(b.status))
  )
    throw new HttpError(400, 'Datos de ruta inválidos.');
  if (
    !Array.isArray(b.holds) ||
    b.holds.length > 40 ||
    b.holds.some(
      (h) =>
        !h ||
        typeof h.id !== 'string' ||
        h.id.length > 100 ||
        !['inicio', 'intermedio', 'final'].includes(h.role) ||
        !Number.isFinite(h.x) ||
        !Number.isFinite(h.y) ||
        h.x < 0 ||
        h.x > 100 ||
        h.y < 0 ||
        h.y > 100 ||
        Object.keys(h).some((k) => !['id', 'x', 'y', 'role'].includes(k)),
    )
  )
    throw new HttpError(400, 'Marcadores inválidos.');
  if (new Set(b.holds.map((h) => h.id)).size !== b.holds.length)
    throw new HttpError(400, 'Marcadores duplicados.');
  const holds3D = b.holds3D === undefined ? [] : b.holds3D;
  if (!Array.isArray(holds3D) || holds3D.length + b.holds.length > 40)
    throw new HttpError(400, 'Usa hasta 40 marcadores por ruta.');
  try {
    for (const h of holds3D) {
      if (
        !h ||
        typeof h.id !== 'string' ||
        !h.id.trim() ||
        h.id.length > 100 ||
        !['inicio', 'intermedio', 'final'].includes(h.role) ||
        Object.keys(h).some((k) => !['id', 'position', 'role'].includes(k))
      )
        throw new Error('Marcador 3D inválido.');
      point(h.position);
    }
    const ids = [...b.holds, ...holds3D].map((h) => h.id);
    if (new Set(ids).size !== ids.length)
      throw new Error('Marcadores duplicados.');
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  const camera = b.camera as Record<string, unknown> | undefined;
  if (
    camera !== undefined &&
    (!camera ||
      typeof camera.captureId !== 'string' ||
      camera.captureId.length > 400 ||
      !['yaw', 'pitch', 'distance'].every(
        (k) =>
          typeof camera[k] === 'number' &&
          Number.isFinite(camera[k]) &&
          Math.abs(Number(camera[k])) < 1e6,
      ) ||
      Number(camera.distance) <= 0 ||
      !Array.isArray(camera.target) ||
      camera.target.length !== 3 ||
      camera.target.some(
        (n) =>
          typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 1e6,
      ) ||
      Object.keys(camera).some(
        (k) => !['captureId', 'yaw', 'pitch', 'distance', 'target'].includes(k),
      ))
  )
    throw new HttpError(400, 'Cámara inválida.');
  return {
    gradeScale: b.gradeScale as string | undefined,
    rules: b.rules as string | undefined,
    imageId: b.imageId ? text(b.imageId, 100) : undefined,
    markersVerified: b.markersVerified === true,
    updatedAt: new Date().toISOString(),
    sectionRevision: undefined as number | undefined,
    name,
    grade,
    sector,
    beta: b.beta,
    status: b.status,
    holds: b.holds,
    holds3D,
    ...(b.sectionId ? { sectionId: text(b.sectionId, 100) } : {}),
    ...(b.captureId ? { captureId: text(b.captureId, 100) } : {}),
    ...(camera ? { camera } : {}),
  };
}
export async function handle(
  request: Request,
  env: Env,
  authenticate = identity,
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const illustration = await demoAsset(request, env);
    if (illustration) return illustration;
    const pilotResponse = await pilotApi(request, env, () =>
      authenticate(request, env),
    );
    if (pilotResponse) return pilotResponse;
    const operationResponse = await operationsApi(request, env, () =>
      authenticate(request, env),
    );
    if (operationResponse) return operationResponse;
    // No client field can select a different D1 binding or impersonate a user.
    if (
      [...url.searchParams.keys()].some(
        (k) =>
          !(
            path === '/api/entries'
              ? [
                  'limit',
                  'offset',
                  'from',
                  'until',
                  'result',
                  'state',
                  'export',
                  'group',
                ]
              : ['limit', 'offset', 'status']
          ).includes(k),
      )
    )
      throw new HttpError(400, 'Parámetro no permitido.');
    if (path === '/api/health' && request.method === 'GET')
      return json({ gymId: env.GYM_ID, ready: true });
    const captureResponse = await captureApi(request, env, () =>
      authenticate(request, env),
    );
    if (captureResponse) return captureResponse;
    const limit = Number(url.searchParams.get('limit') || 50),
      offset = Number(url.searchParams.get('offset') || 0);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 10000
    )
      throw new HttpError(400, 'Paginación inválida.');
    if (path === '/api/routes' && request.method === 'GET') {
      const draft = url.searchParams.get('status') === 'borrador';
      if (draft) await editor(env, await authenticate(request, env));
      const rows = await env.DB.prepare(
        "SELECT r.*,rr.revision,rr.snapshot,CASE WHEN r.publication_state='draft' THEN 'borrador' ELSE r.status END AS status FROM routes r JOIN route_revisions rr ON rr.route_id=r.id AND rr.revision=(SELECT MAX(revision) FROM route_revisions WHERE route_id=r.id) WHERE r.status=? AND r.publication_state=? ORDER BY r.rowid DESC LIMIT ? OFFSET ?",
      )
        .bind(
          url.searchParams.get('status') === 'retirada' ? 'retirada' : 'activa',
          draft ? 'draft' : 'public',
          limit,
          offset,
        )
        .all();
      return json({ gymId: env.GYM_ID, routes: rows.results });
    }
    const routeMatch = path.match(/^\/api\/routes\/([^/]+)$/);
    if (routeMatch && request.method === 'GET') {
      const state = await env.DB.prepare(
        'SELECT publication_state FROM routes WHERE id=?',
      )
        .bind(routeMatch[1])
        .first<{ publication_state: string }>();
      if (state?.publication_state === 'draft')
        await editor(env, await authenticate(request, env));
      const r = await revision(env, routeMatch[1]);
      return json({
        gymId: env.GYM_ID,
        revision: r.revision,
        snapshot: JSON.parse(r.snapshot),
        status: state?.publication_state === 'draft' ? 'borrador' : r.status,
      });
    }
    const user = await authenticate(request, env);
    const projectResponse = await projectApi(request, env, user);
    if (projectResponse) return projectResponse;
    const entryResponse = await entryApi(request, env, user);
    if (entryResponse) return entryResponse;
    if (
      (path === '/api/routes' && request.method === 'POST') ||
      (routeMatch && request.method === 'PUT')
    ) {
      await editor(env, user);
      const b = await body(request, 16384);
      const payload = routePayload(b);
      const gym = await env.DB.prepare(
        'SELECT active_capture_id,generation FROM gym_state WHERE id=1',
      ).first<{ active_capture_id: string | null; generation: number }>();
      if (!gym) throw new HttpError(409, 'Faltan migraciones.');
      const existingSection = routeMatch
        ? await env.DB.prepare('SELECT section_id FROM routes WHERE id=?')
            .bind(routeMatch[1])
            .first<string>('section_id')
        : null;
      payload.sectionId = payload.sectionId || existingSection || undefined;
      const section = payload.sectionId
        ? await env.DB.prepare('SELECT revision FROM sections WHERE id=?')
            .bind(payload.sectionId)
            .first<{ revision: number }>()
        : null;
      if (!section && payload.status !== 'borrador')
        throw new HttpError(400, 'Selecciona una sección del gimnasio.');
      payload.sectionRevision = section?.revision;
      if (
        !routeMatch &&
        !gym.active_capture_id &&
        payload.status !== 'borrador'
      )
        throw new HttpError(409, 'Publica primero una captura del gimnasio.');
      if (payload.holds3D.length && !payload.captureId)
        throw new HttpError(
          400,
          'Los marcadores 3D requieren identificar la captura.',
        );
      if (payload.captureId && payload.captureId !== gym.active_capture_id)
        throw new HttpError(
          409,
          'Importa la ruta a la captura vigente antes de editarla.',
        );
      if (gym.active_capture_id) payload.captureId = gym.active_capture_id;
      if (payload.camera && payload.camera.captureId !== payload.captureId)
        throw new HttpError(
          400,
          'La cámara debe pertenecer a la captura de la ruta.',
        );
      const id = routeMatch ? routeMatch[1] : crypto.randomUUID();
      let next = 1;
      if (routeMatch) {
        const current = await revision(env, id);
        const state = await env.DB.prepare(
          'SELECT publication_state FROM routes WHERE id=?',
        )
          .bind(id)
          .first<{ publication_state: string }>();
        if (
          state?.publication_state === 'public' &&
          payload.status === 'borrador'
        )
          throw new HttpError(
            400,
            'Una ruta publicada conserva su enlace. Prepara sus cambios en el editor y publícalos como nueva revisión.',
          );
        if (
          !Number.isInteger(b.expectedRevision) ||
          b.expectedRevision !== current.revision
        )
          throw new HttpError(409, 'La ruta cambió. Recarga antes de guardar.');
        if (b.holds3D === undefined)
          payload.holds3D = JSON.parse(current.snapshot).holds3D || [];
        if (payload.holds.length + payload.holds3D.length > 40)
          throw new HttpError(400, 'Usa hasta 40 marcadores por ruta.');
        next = current.revision + 1;
      } else if (b.expectedRevision !== undefined)
        throw new HttpError(400, 'No hay revisión anterior.');
      if (payload.imageId) {
        const image = await env.DB.prepare(
          'SELECT capture_id,presentation FROM route_images WHERE id=?',
        )
          .bind(payload.imageId)
          .first<{ capture_id: string; presentation: string }>();
        if (
          !image ||
          image.capture_id !== payload.captureId ||
          image.presentation !==
            presentationKey(payload.camera, payload.holds3D)
        )
          throw new HttpError(
            400,
            'La imagen debe pertenecer a la captura de la ruta.',
          );
      }
      if (payload.status === 'activa') {
        const missing = [];
        if (!payload.gradeScale) missing.push('escala');
        const publishedCapture = await env.DB.prepare(
          "SELECT id FROM captures WHERE id=? AND status='published' AND upload_state='ready'",
        )
          .bind(payload.captureId || '')
          .first();
        if (!publishedCapture) missing.push('captura publicada');
        if (!payload.camera) missing.push('cámara');
        if (!payload.imageId) missing.push('imagen de respaldo');
        if (!payload.markersVerified) missing.push('verificación de agarres');
        if (
          !payload.holds3D.some((h) => h.role === 'inicio') ||
          !payload.holds3D.some((h) => h.role === 'final')
        )
          missing.push('inicio y final');
        if (missing.length)
          throw new HttpError(
            400,
            `Antes de publicar completa: ${missing.join(', ')}.`,
          );
      }
      if (routeMatch) {
        const old = await revision(env, id);
        if (
          (old.status === 'retirada') !== (payload.status === 'retirada') &&
          !b.changeReason
        )
          throw new HttpError(
            400,
            'Indica el motivo del retiro o reactivación.',
          );
      }
      const snapshot = JSON.stringify({ ...payload, id, revision: next });
      const now = new Date().toISOString();
      const statements = routeMatch
        ? [
            env.DB.prepare(
              'INSERT INTO route_revisions(route_id,revision,snapshot,capture_id) VALUES(?,?,?,?)',
            ).bind(id, next, snapshot, payload.captureId || null),
            env.DB.prepare(
              'UPDATE routes SET name=?,grade=?,sector=?,beta=?,status=?,section_id=? WHERE id=?',
            ).bind(
              payload.name,
              payload.grade,
              payload.sector,
              payload.beta,
              payload.status === 'borrador' ? 'activa' : payload.status,
              payload.sectionId || null,
              id,
            ),
          ]
        : [
            env.DB.prepare(
              'INSERT INTO routes(id,name,grade,sector,beta,status,section_id) VALUES(?,?,?,?,?,?,?)',
            ).bind(
              id,
              payload.name,
              payload.grade,
              payload.sector,
              payload.beta,
              payload.status === 'borrador' ? 'activa' : payload.status,
              payload.sectionId || null,
            ),
            env.DB.prepare(
              'INSERT INTO route_revisions(route_id,revision,snapshot,capture_id) VALUES(?,?,?,?)',
            ).bind(id, next, snapshot, payload.captureId || null),
          ];
      statements.push(
        env.DB.prepare('UPDATE routes SET publication_state=? WHERE id=?').bind(
          payload.status === 'borrador' ? 'draft' : 'public',
          id,
        ),
      );
      if (b.changeReason)
        statements.push(
          env.DB.prepare('INSERT INTO route_changes VALUES(?,?,?,?,?)').bind(
            id,
            next,
            text(b.changeReason, 2000),
            user,
            now,
          ),
        );
      const guardId = crypto.randomUUID();
      statements.unshift(
        env.DB.prepare(
          'INSERT INTO mutation_guards(id,verified) VALUES(?,(SELECT CASE WHEN generation=? THEN 1 ELSE 0 END FROM gym_state WHERE id=1))',
        ).bind(guardId, gym.generation),
      );
      statements.push(
        env.DB.prepare('DELETE FROM mutation_guards WHERE id=?').bind(guardId),
      );
      statements.push(
        env.DB.prepare(
          'INSERT INTO audit_events(id,user_id,action,object_id,created_at) VALUES(?,?,?,?,?)',
        ).bind(
          crypto.randomUUID(),
          user,
          routeMatch ? 'route.revise' : 'route.create',
          id,
          now,
        ),
      );
      try {
        await env.DB.batch(statements);
      } catch (error) {
        if (
          String(error).includes('UNIQUE constraint failed: route_revisions') ||
          String(error).includes('CHECK constraint failed: verified')
        )
          throw new HttpError(409, 'La ruta cambió. Recarga antes de guardar.');
        throw error;
      }
      return json(
        { id, revision: next, snapshot: JSON.parse(snapshot) },
        routeMatch ? 200 : 201,
      );
    }
    if (path === '/api/me' && request.method === 'GET') {
      const staff = await env.DB.prepare(
        'SELECT role FROM staff WHERE user_id=?',
      )
        .bind(user)
        .first();
      return json({
        gymId: env.GYM_ID,
        userId: user,
        staff: staff?.role || null,
      });
    }
    if (path === '/api/entries' && request.method === 'GET') {
      const from = url.searchParams.get('from'),
        until = url.searchParams.get('until'),
        result = url.searchParams.get('result');
      for (const value of [from, until])
        if (
          value &&
          (!Number.isFinite(Date.parse(value)) ||
            new Date(value).toISOString() !== value)
        )
          throw new HttpError(400, 'Intervalo de fechas inválido.');
      if (from && until && from >= until)
        throw new HttpError(
          400,
          'La fecha inicial debe preceder al final del intervalo.',
        );
      if (result && !['intento', 'ascenso'].includes(result))
        throw new HttpError(400, 'Resultado inválido.');
      const state = url.searchParams.get('state') || 'active';
      if (!['active', 'deleted'].includes(state))
        throw new HttpError(400, 'Estado de registro inválido.');
      const where = [
        'e.user_id=?',
        state === 'deleted'
          ? 'e.deleted_at IS NOT NULL'
          : 'e.deleted_at IS NULL',
      ];
      const params: (string | number)[] = [user];
      if (from) {
        where.push('e.created_at>=?');
        params.push(from);
      }
      if (until) {
        where.push('e.created_at<?');
        params.push(until);
      }
      if (result) {
        where.push('e.result=?');
        params.push(result);
      }
      const filter = where.join(' AND ');
      if (url.searchParams.has('group')) {
        if (url.searchParams.get('group') !== 'day')
          throw new HttpError(400, 'Agrupación inválida.');
        const config = await env.DB.prepare(
          'SELECT timezone FROM gym_config WHERE id=1',
        ).first<{ timezone: string }>();
        const timezone = config?.timezone || 'America/Mexico_City';
        const rows = await env.DB.prepare(
          `SELECT e.created_at,e.attempts,e.result,e.route_id FROM entries e WHERE ${filter} ORDER BY e.created_at DESC LIMIT 10001`,
        )
          .bind(...params)
          .all<{
            created_at: string;
            attempts: number;
            result: string;
            route_id: string;
          }>();
        if (rows.results.length > 10000)
          throw new HttpError(
            400,
            'Acota el intervalo a 10000 registros para agrupar días.',
          );
        const formatter = new Intl.DateTimeFormat('sv-SE', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const days = new Map<
          string,
          {
            date: string;
            records: number;
            attempts: number;
            ascents: number;
            routes: Set<string>;
          }
        >();
        for (const e of rows.results) {
          const date = formatter.format(new Date(e.created_at));
          let day = days.get(date);
          if (!day) {
            day = {
              date,
              records: 0,
              attempts: 0,
              ascents: 0,
              routes: new Set(),
            };
            days.set(date, day);
          }
          day.records++;
          day.attempts += e.attempts;
          day.ascents += e.result === 'ascenso' ? 1 : 0;
          day.routes.add(e.route_id);
        }
        return json({
          timezone,
          days: [...days.values()]
            .map((d) => ({ ...d, routes: d.routes.size }))
            .sort((a, b) => b.date.localeCompare(a.date)),
        });
      }
      const exporting = url.searchParams.get('export');
      if (exporting && exporting !== 'csv')
        throw new HttpError(400, 'Formato de exportación inválido.');
      if (exporting) {
        if (url.searchParams.has('limit') || url.searchParams.has('offset'))
          throw new HttpError(
            400,
            'La exportación completa no acepta paginación.',
          );
        const all = await env.DB.prepare(
          `SELECT e.*,rr.snapshot AS route_snapshot,json_extract(rr.snapshot,'$.name') AS route_name,json_extract(rr.snapshot,'$.grade') AS grade FROM entries e JOIN route_revisions rr ON rr.route_id=e.route_id AND rr.revision=e.revision WHERE ${filter} ORDER BY e.created_at DESC,e.id LIMIT 2001`,
        )
          .bind(...params)
          .all();
        if (all.results.length > 2000)
          throw new HttpError(
            400,
            'El intervalo supera 2000 registros. Acota las fechas; no se exportaron datos parciales.',
          );
        return json({
          csv: journalCsv(
            all.results.map((e: any) => ({
              date: e.created_at,
              routeName: e.route_name || e.route_id,
              grade: e.grade || '',
              revision: e.revision,
              result: e.result,
              attempts: e.attempts,
              notes: e.notes,
              deletedAt: e.deleted_at,
              entryVersion: e.entry_version,
            })),
          ),
          records: all.results.length,
        });
      }

      const rows = await env.DB.prepare(
        `SELECT e.*,rr.snapshot AS route_snapshot,json_extract(rr.snapshot,'$.name') AS route_name,json_extract(rr.snapshot,'$.grade') AS grade FROM entries e JOIN route_revisions rr ON rr.route_id=e.route_id AND rr.revision=e.revision WHERE ${filter} ORDER BY e.created_at DESC,e.id LIMIT ? OFFSET ?`,
      )
        .bind(...params, limit, offset)
        .all();
      const summary = await env.DB.prepare(
        `SELECT COUNT(*) AS records,COALESCE(SUM(e.attempts),0) AS attempts,COALESCE(SUM(CASE WHEN e.result='ascenso' THEN 1 ELSE 0 END),0) AS ascents,COUNT(DISTINCT e.route_id) AS routes FROM entries e WHERE ${filter}`,
      )
        .bind(...params)
        .first<{
          records: number;
          attempts: number;
          ascents: number;
          routes: number;
        }>();
      return json({
        entries: rows.results,
        summary,
        pagination: {
          limit,
          offset,
          total: summary?.records || 0,
          hasMore: offset + rows.results.length < (summary?.records || 0),
        },
      });
    }
    if (path === '/api/entries' && request.method === 'POST') {
      const b = await body(request);
      if (
        Object.keys(b).some(
          (k) =>
            ![
              'routeId',
              'attempts',
              'result',
              'notes',
              'occurredAt',
              'requestId',
              'expectedRevision',
            ].includes(k),
        )
      )
        throw new HttpError(400, 'Campo no permitido.');
      const key = await requestKey(env, user, 'entry', b);
      if (key?.previous) return json({ id: key.previous }, 201);
      const id = text(b.routeId, 100);
      const pub = await env.DB.prepare(
        'SELECT publication_state FROM routes WHERE id=?',
      )
        .bind(id)
        .first<{ publication_state: string }>();
      if (pub?.publication_state === 'draft')
        throw new HttpError(404, 'Ruta no disponible.');
      const r = await revision(env, id, true);
      if (b.expectedRevision !== undefined && b.expectedRevision !== r.revision)
        throw new HttpError(
          409,
          'La revisión cambió. Revisa la ruta antes de guardar.',
        );
      if (
        !Number.isInteger(b.attempts) ||
        Number(b.attempts) < 1 ||
        Number(b.attempts) > 10000 ||
        !['intento', 'ascenso'].includes(String(b.result))
      )
        throw new HttpError(400, 'Actividad inválida.');
      if (
        b.notes !== undefined &&
        (typeof b.notes !== 'string' || b.notes.length > 2000)
      )
        throw new HttpError(400, 'Notas inválidas.');
      const entryId = crypto.randomUUID(),
        now = new Date().toISOString();
      let occurredAt = now;
      if (b.occurredAt !== undefined) {
        if (
          typeof b.occurredAt !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(b.occurredAt) ||
          !Number.isFinite(Date.parse(b.occurredAt)) ||
          new Date(b.occurredAt).toISOString() !== b.occurredAt ||
          Date.parse(b.occurredAt) > Date.parse(now)
        )
          throw new HttpError(400, 'Fecha de actividad inválida o futura.');
        occurredAt = b.occurredAt;
      }
      const snapshot = JSON.stringify({
        id: entryId,
        routeId: id,
        routeRevision: r.revision,
        attempts: b.attempts,
        result: b.result,
        notes: b.notes || '',
        createdAt: occurredAt,
        deletedAt: null,
        entryVersion: 1,
      });
      const guard = crypto.randomUUID();
      const savedId = await writeOnce(env, user, 'entry', key, entryId, [
        env.DB.prepare(
          "INSERT INTO mutation_guards VALUES(?,COALESCE((SELECT CASE WHEN status='activa' AND publication_state='public' AND (SELECT MAX(revision) FROM route_revisions WHERE route_id=routes.id)=? THEN 1 ELSE 0 END FROM routes WHERE id=?),0))",
        ).bind(guard, r.revision, id),
        env.DB.prepare(
          'INSERT INTO entries(id,user_id,route_id,revision,attempts,result,notes,created_at) VALUES(?,?,?,?,?,?,?,?)',
        ).bind(
          entryId,
          user,
          id,
          r.revision,
          b.attempts,
          b.result,
          b.notes || '',
          occurredAt,
        ),
        env.DB.prepare('INSERT INTO entry_history VALUES(?,?,?,?,?,?)').bind(
          entryId,
          1,
          snapshot,
          'created',
          user,
          now,
        ),
        env.DB.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(
          crypto.randomUUID(),
          user,
          'entry.created',
          entryId,
          now,
        ),
        env.DB.prepare('DELETE FROM mutation_guards WHERE id=?').bind(guard),
      ]);
      return json({ id: savedId }, 201);
    }
    if (path === '/api/reports' && request.method === 'POST') {
      const b = await body(request);
      if (
        Object.keys(b).some(
          (k) =>
            ![
              'routeId',
              'description',
              'category',
              'expectedRevision',
              'requestId',
            ].includes(k),
        )
      )
        throw new HttpError(400, 'Campo no permitido.');
      const id = text(b.routeId, 100);
      const key = await requestKey(env, user, 'report', b);
      if (key?.previous) return json({ id: key.previous }, 201);
      const reportRoute = await env.DB.prepare(
        'SELECT publication_state FROM routes WHERE id=?',
      )
        .bind(id)
        .first<{ publication_state: string }>();
      if (reportRoute?.publication_state === 'draft') await editor(env, user);
      const description = text(b.description, 2000);
      const category = b.category || 'contenido';
      if (!['contenido', 'agarre_suelto', 'otro'].includes(String(category)))
        throw new HttpError(400, 'Categoría inválida.');
      const r = await revision(env, id);
      if (b.expectedRevision !== undefined && b.expectedRevision !== r.revision)
        throw new HttpError(409, 'La revisión cambió. Revisa el reporte.');
      const reportId = crypto.randomUUID();
      const savedId = await writeOnce(env, user, 'report', key, reportId, [
        env.DB.prepare(
          'INSERT INTO reports (id,user_id,route_id,revision,description,created_at,category) VALUES (?,?,?,?,?,?,?)',
        ).bind(
          reportId,
          user,
          id,
          r.revision,
          description,
          new Date().toISOString(),
          category,
        ),
      ]);
      return json({ id: savedId }, 201);
    }
    if (path === '/api/reports' && request.method === 'GET') {
      const rows = await env.DB.prepare(
        'SELECT id,route_id,revision,category,description,status,resolution,created_at,resolved_at FROM reports WHERE user_id=? ORDER BY created_at DESC LIMIT 100',
      )
        .bind(user)
        .all();
      return json({ reports: rows.results });
    }
    if (path === '/api/staff/reports' && request.method === 'GET') {
      await editor(env, user);
      const rows = await env.DB.prepare(
        "SELECT * FROM reports ORDER BY (status='pendiente' AND category='agarre_suelto') DESC,status,created_at DESC,id LIMIT ? OFFSET ?",
      )
        .bind(limit, offset)
        .all();
      return json({ reports: rows.results });
    }
    const assignment = path.match(/^\/api\/staff\/reports\/([^/]+)\/assign$/);
    if (assignment && request.method === 'POST') {
      await editor(env, user);
      const b = await body(request);
      if (Object.keys(b).length)
        throw new HttpError(400, 'Campo no permitido.');
      const r = await env.DB.prepare(
        'SELECT id,assigned_to,status FROM reports WHERE id=?',
      )
        .bind(assignment[1])
        .first<{ id: string; assigned_to: string | null; status: string }>();
      if (!r) throw new HttpError(404, 'Reporte no encontrado.');
      if (r.status !== 'pendiente' || (r.assigned_to && r.assigned_to !== user))
        throw new HttpError(
          409,
          'El reporte ya tiene responsable o está resuelto.',
        );
      if (r.assigned_to === user) return json({ assigned: true });
      const guard = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO mutation_guards VALUES(?,COALESCE((SELECT CASE WHEN assigned_to IS NULL AND status='pendiente' THEN 1 ELSE 0 END FROM reports WHERE id=?),0))",
        ).bind(guard, r.id),
        env.DB.prepare('UPDATE reports SET assigned_to=? WHERE id=?').bind(
          user,
          r.id,
        ),
        env.DB.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(
          crypto.randomUUID(),
          user,
          'report.assign',
          r.id,
          new Date().toISOString(),
        ),
        env.DB.prepare('DELETE FROM mutation_guards WHERE id=?').bind(guard),
      ]);
      return json({ assigned: true });
    }
    const resolve = path.match(/^\/api\/staff\/reports\/([^/]+)\/resolve$/);
    if (resolve && request.method === 'POST') {
      await editor(env, user);
      const r = await env.DB.prepare('SELECT id FROM reports WHERE id=?')
        .bind(resolve[1])
        .first();
      if (!r) throw new HttpError(404, 'Reporte no encontrado.');
      const b = await body(request);
      if (Object.keys(b).some((k) => k !== 'resolution'))
        throw new HttpError(400, 'Campo no permitido.');
      const reason = text(b.resolution, 2000);
      const guard = crypto.randomUUID();
      const now = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO mutation_guards VALUES(?,COALESCE((SELECT CASE WHEN status='pendiente' THEN 1 ELSE 0 END FROM reports WHERE id=?),0))",
        ).bind(guard, resolve[1]),
        env.DB.prepare(
          "UPDATE reports SET status='resuelto',resolved_by=?,assigned_to=?,resolution=?,resolved_at=? WHERE id=?",
        ).bind(user, user, reason, now, resolve[1]),
        env.DB.prepare(
          'INSERT INTO audit_events (id,user_id,action,object_id,created_at) VALUES (?,?,?,?,?)',
        ).bind(crypto.randomUUID(), user, 'report.resolve', resolve[1], now),
        env.DB.prepare('DELETE FROM mutation_guards WHERE id=?').bind(guard),
      ]);
      return json({ status: 'resuelto' });
    }
    throw new HttpError(404, 'Endpoint no encontrado.');
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (String(error).includes('CHECK constraint failed: verified'))
      return json(
        {
          error:
            'La ruta o el registro cambió. Recarga y revisa antes de continuar.',
        },
        409,
      );
    console.error(JSON.stringify({ event: 'api.error', gymId: env.GYM_ID }));
    return json({ error: 'Error interno.' }, 500);
  }
}
export default {
  fetch: (request: Request, env: Env) => handle(request, env),
} satisfies ExportedHandler<Env>;
