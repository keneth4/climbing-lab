import { body, HttpError, json } from './http';

export function presentationKey(camera: unknown, holds: unknown) {
  const view = camera as
    | {
        captureId?: unknown;
        yaw?: unknown;
        pitch?: unknown;
        distance?: unknown;
        target?: unknown;
      }
    | undefined;
  return JSON.stringify({
    camera: view
      ? {
          captureId: view.captureId,
          yaw: view.yaw,
          pitch: view.pitch,
          distance: view.distance,
          target: view.target,
        }
      : null,
    holds: (Array.isArray(holds) ? holds : []).map((h) => ({
      id: h.id,
      role: h.role,
      position: h.position,
    })),
  });
}
function validPresentation(
  data: { camera?: any; holds?: any },
  captureId: string,
) {
  const v = data.camera,
    holds = data.holds;
  const finite = (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e6;
  const point = (p: unknown) =>
    Array.isArray(p) && p.length === 3 && p.every(finite);
  return (
    v &&
    v.captureId === captureId &&
    ['yaw', 'pitch', 'distance'].every((k) => finite(v[k])) &&
    v.distance > 0 &&
    point(v.target) &&
    Object.keys(v).every((k) =>
      ['captureId', 'yaw', 'pitch', 'distance', 'target'].includes(k),
    ) &&
    Array.isArray(holds) &&
    holds.length <= 40 &&
    holds.every(
      (h) =>
        h &&
        typeof h.id === 'string' &&
        h.id.length > 0 &&
        h.id.length <= 100 &&
        ['inicio', 'intermedio', 'final'].includes(h.role) &&
        point(h.position) &&
        Object.keys(h).every((k) => ['id', 'role', 'position'].includes(k)),
    ) &&
    new Set(holds.map((h) => h.id)).size === holds.length
  );
}

export async function requestKey(
  env: Env,
  user: string,
  kind: string,
  b: Record<string, unknown>,
) {
  if (b.requestId === undefined) return undefined;
  if (
    typeof b.requestId !== 'string' ||
    !/^[a-zA-Z0-9_-]{8,100}$/.test(b.requestId)
  )
    throw new HttpError(400, 'Identificador de reintento inválido.');
  const { requestId, ...content } = b;
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(content).sort(([a], [b]) => a.localeCompare(b)),
        ),
      ),
    ),
  );
  const payload = Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
  const previous = await env.DB.prepare(
    'SELECT payload,object_id FROM request_keys WHERE user_id=? AND kind=? AND request_id=?',
  )
    .bind(user, kind, requestId)
    .first<{ payload: string; object_id: string }>();
  if (previous && previous.payload !== payload)
    throw new HttpError(409, 'El reintento contiene datos distintos.');
  return { requestId, payload, previous: previous?.object_id };
}
export async function writeOnce(
  env: Env,
  user: string,
  kind: string,
  key: Awaited<ReturnType<typeof requestKey>>,
  id: string,
  statements: D1PreparedStatement[],
) {
  if (key)
    statements.unshift(
      env.DB.prepare('INSERT INTO request_keys VALUES(?,?,?,?,?)').bind(
        user,
        kind,
        key.requestId,
        key.payload,
        id,
      ),
    );
  try {
    await env.DB.batch(statements);
    return id;
  } catch (error) {
    if (key) {
      const row = await env.DB.prepare(
        'SELECT payload,object_id FROM request_keys WHERE user_id=? AND kind=? AND request_id=?',
      )
        .bind(user, kind, key.requestId)
        .first<{ payload: string; object_id: string }>();
      if (row?.payload === key.payload) return row.object_id;
      if (row)
        throw new HttpError(409, 'El reintento contiene datos distintos.');
    }
    if (String(error).includes('CHECK constraint failed: verified'))
      throw new HttpError(
        409,
        'La ruta o el registro cambió. Revisa antes de continuar.',
      );
    throw error;
  }
}
export async function pilotApi(
  request: Request,
  env: Env,
  identity: () => Promise<string>,
) {
  const path = new URL(request.url).pathname;
  if (path === '/api/ux-events' && request.method === 'POST') {
    const b = await body(request, 256);
    if (
      Object.keys(b).some((k) => !['event', 'durationMs'].includes(k)) ||
      (b.durationMs !== undefined &&
        (!Number.isInteger(b.durationMs) ||
          Number(b.durationMs) < 0 ||
          Number(b.durationMs) > 3600000)) ||
      ![
        'qr_open',
        'detail_ready',
        'scene_ready',
        'activity_start',
        'activity_saved',
        'export_done',
        'scene_error',
        'activity_error',
        'export_error',
      ].includes(String(b.event))
    )
      throw new HttpError(400, 'Evento inválido.');
    const day = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(
      'INSERT INTO ux_events VALUES(?,?,1,?,?) ON CONFLICT(day,event) DO UPDATE SET count=count+1,total_ms=total_ms+excluded.total_ms,timed_count=timed_count+excluded.timed_count',
    )
      .bind(day, b.event, b.durationMs || 0, b.durationMs === undefined ? 0 : 1)
      .run();
    return json({ recorded: true });
  }
  if (path === '/api/ux-events' && request.method === 'GET') {
    await requireStaff(env, await identity());
    const rows = await env.DB.prepare(
      'SELECT day,event,count,CASE WHEN timed_count>0 THEN total_ms*1.0/timed_count ELSE NULL END AS average_ms FROM ux_events ORDER BY day DESC,event LIMIT 300',
    ).all();
    return json({ events: rows.results });
  }
  const image = path.match(/^\/api\/route-images\/([a-zA-Z0-9-]+)$/);
  if (image && request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT object_key FROM route_images WHERE id=?',
    )
      .bind(image[1])
      .first<{ object_key: string }>();
    if (!row) throw new HttpError(404, 'Imagen no disponible.');
    // Draft images are staff-only. An image becomes public with an immutable public presentation.
    const published = await env.DB.prepare(
      "SELECT route_id FROM route_revisions WHERE json_extract(snapshot,'$.status') IN ('activa','retirada') AND json_extract(snapshot,'$.imageId')=? LIMIT 1",
    )
      .bind(image[1])
      .first();
    if (!published) await requireStaff(env, await identity());
    const object = await env.CAPTURES.get(row.object_key);
    if (!object) throw new HttpError(404, 'Imagen no disponible.');
    return new Response(object.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': published ? 'public, max-age=86400' : 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  if (path === '/api/route-images' && request.method === 'POST') {
    const user = await identity();
    await requireStaff(env, user);
    const captureId = request.headers.get('X-Capture-Id') || '';
    const capture = await env.DB.prepare(
      "SELECT id,status FROM captures WHERE id=? AND upload_state='ready'",
    )
      .bind(captureId)
      .first<{ id: string; status: string }>();
    if (capture?.status === 'draft') {
      const role = await env.DB.prepare(
        'SELECT role FROM staff WHERE user_id=?',
      )
        .bind(user)
        .first<string>('role');
      if (role !== 'admin')
        throw new HttpError(
          403,
          'Solo administración prepara capturas nuevas.',
        );
    }
    if (!capture) throw new HttpError(400, 'Selecciona una captura publicada.');
    if (request.headers.get('Content-Type') !== 'image/png')
      throw new HttpError(415, 'Usa una imagen PNG.');
    let presentation: string;
    try {
      const data = JSON.parse(request.headers.get('X-Presentation') || '');
      presentation = presentationKey(data.camera, data.holds);
      if (!validPresentation(data, captureId)) throw new Error();
    } catch {
      throw new HttpError(
        400,
        'La imagen requiere cámara y agarres de la captura.',
      );
    }
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, 'Falta imagen.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4 * 1024 * 1024) {
        await reader.cancel();
        throw new HttpError(413, 'La imagen debe pesar menos de 4 MB.');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (![137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n))
      throw new HttpError(400, 'PNG inválido.');
    if (
      bytes.length < 33 ||
      new TextDecoder().decode(bytes.slice(12, 16)) !== 'IHDR'
    )
      throw new HttpError(400, 'PNG inválido.');
    const view = new DataView(bytes.buffer),
      width = view.getUint32(16),
      height = view.getUint32(20);
    if (!width || !height || width > 4096 || height > 4096)
      throw new HttpError(400, 'La imagen admite hasta 4096 × 4096 píxeles.');
    const id = crypto.randomUUID(),
      objectKey = `route-images/${id}.png`;
    await env.CAPTURES.put(objectKey, bytes, {
      httpMetadata: { contentType: 'image/png' },
    });
    try {
      await env.DB.prepare('INSERT INTO route_images VALUES(?,?,?,?,?,?)')
        .bind(
          id,
          captureId,
          objectKey,
          user,
          new Date().toISOString(),
          presentation,
        )
        .run();
    } catch (error) {
      await env.CAPTURES.delete(objectKey);
      throw error;
    }
    return json({ id }, 201);
  }
}
export async function requireStaff(env: Env, user: string) {
  if (
    !(await env.DB.prepare('SELECT user_id FROM staff WHERE user_id=?')
      .bind(user)
      .first())
  )
    throw new HttpError(403, 'No tienes permisos de staff en este gimnasio.');
}
