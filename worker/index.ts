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

async function identity(request: Request, env: Env): Promise<string> {
  const token = request.headers
    .get('Authorization')
    ?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new HttpError(401, 'Inicia sesión.');
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
  } catch {
    throw new HttpError(401, 'Sesión inválida o vencida.');
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
  ];
  if (Object.keys(b).some((k) => !allowed.includes(k)))
    throw new HttpError(400, 'Campo no permitido.');
  const name = text(b.name, 80),
    grade = text(b.grade, 15),
    sector = text(b.sector, 80);
  if (
    typeof b.beta !== 'string' ||
    b.beta.length > 2000 ||
    !['activa', 'retirada'].includes(String(b.status))
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
    // No client field can select a different D1 binding or impersonate a user.
    if (
      [...url.searchParams.keys()].some(
        (k) =>
          !(
            path === '/api/entries'
              ? ['limit', 'offset', 'from', 'until', 'result', 'state']
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
      const rows = await env.DB.prepare(
        'SELECT * FROM routes WHERE status=? ORDER BY id LIMIT ? OFFSET ?',
      )
        .bind(
          url.searchParams.get('status') === 'retirada' ? 'retirada' : 'activa',
          limit,
          offset,
        )
        .all();
      return json({ gymId: env.GYM_ID, routes: rows.results });
    }
    const routeMatch = path.match(/^\/api\/routes\/([^/]+)$/);
    if (routeMatch && request.method === 'GET') {
      const r = await revision(env, routeMatch[1]);
      return json({
        gymId: env.GYM_ID,
        revision: r.revision,
        snapshot: JSON.parse(r.snapshot),
        status: r.status,
      });
    }
    const user = await authenticate(request, env);
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
      if (!section)
        throw new HttpError(400, 'Selecciona una sección del gimnasio.');
      payload.sectionRevision = section.revision;
      if (!routeMatch && !gym.active_capture_id)
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
              payload.status,
              payload.sectionId,
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
              payload.status,
              payload.sectionId,
            ),
            env.DB.prepare(
              'INSERT INTO route_revisions(route_id,revision,snapshot,capture_id) VALUES(?,?,?,?)',
            ).bind(id, next, snapshot, payload.captureId || null),
          ];
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
            !['routeId', 'attempts', 'result', 'notes', 'occurredAt'].includes(
              k,
            ),
        )
      )
        throw new HttpError(400, 'Campo no permitido.');
      const id = text(b.routeId, 100);
      const r = await revision(env, id, true);
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
      await env.DB.batch([
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
      ]);
      return json({ id: entryId }, 201);
    }
    if (path === '/api/reports' && request.method === 'POST') {
      const b = await body(request);
      if (Object.keys(b).some((k) => !['routeId', 'description'].includes(k)))
        throw new HttpError(400, 'Campo no permitido.');
      const id = text(b.routeId, 100);
      const description = text(b.description, 2000);
      const r = await revision(env, id);
      const reportId = crypto.randomUUID();
      await env.DB.prepare(
        'INSERT INTO reports (id,user_id,route_id,revision,description,created_at) VALUES (?,?,?,?,?,?)',
      )
        .bind(
          reportId,
          user,
          id,
          r.revision,
          description,
          new Date().toISOString(),
        )
        .run();
      return json({ id: reportId }, 201);
    }
    if (path === '/api/staff/reports' && request.method === 'GET') {
      await editor(env, user);
      const rows = await env.DB.prepare(
        'SELECT * FROM reports ORDER BY created_at DESC,id LIMIT ? OFFSET ?',
      )
        .bind(limit, offset)
        .all();
      return json({ reports: rows.results });
    }
    const resolve = path.match(/^\/api\/staff\/reports\/([^/]+)\/resolve$/);
    if (resolve && request.method === 'POST') {
      await editor(env, user);
      const r = await env.DB.prepare('SELECT id FROM reports WHERE id=?')
        .bind(resolve[1])
        .first();
      if (!r) throw new HttpError(404, 'Reporte no encontrado.');
      const now = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE reports SET status='resuelto',resolved_by=? WHERE id=?",
        ).bind(user, resolve[1]),
        env.DB.prepare(
          'INSERT INTO audit_events (id,user_id,action,object_id,created_at) VALUES (?,?,?,?,?)',
        ).bind(crypto.randomUUID(), user, 'report.resolve', resolve[1], now),
      ]);
      return json({ status: 'resuelto' });
    }
    throw new HttpError(404, 'Endpoint no encontrado.');
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    console.error(JSON.stringify({ event: 'api.error', gymId: env.GYM_ID }));
    return json({ error: 'Error interno.' }, 500);
  }
}
export default {
  fetch: (request: Request, env: Env) => handle(request, env),
} satisfies ExportedHandler<Env>;
