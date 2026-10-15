import { body, HttpError, json } from './http';
import { requestKey, writeOnce } from './pilot';
import {
  tourContent,
  tourCamera,
  tourId,
  tourProblems,
  tourPresentation,
  captureStamp,
  type TourContent,
} from '../shared/tours';
type Row = {
  id: string;
  draft_revision: number;
  draft: string;
  published_revision: number | null;
  status: 'draft' | 'published' | 'retired';
};
const checked = <T>(fn: () => T): T => {
  try {
    return fn();
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
};
async function role(env: Env, user: string, admin = false) {
  const value = await env.DB.prepare('SELECT role FROM staff WHERE user_id=?')
    .bind(user)
    .first<string>('role');
  if (!value || (admin && value !== 'admin'))
    throw new HttpError(
      403,
      admin
        ? 'Solo administración puede publicar o retirar recorridos.'
        : 'Solo staff puede preparar recorridos.',
    );
}
async function row(env: Env, id: string) {
  const result = await env.DB.prepare('SELECT * FROM tours WHERE id=?')
    .bind(id)
    .first<Row>();
  if (!result) throw new HttpError(404, 'Recorrido no encontrado.');
  return result;
}
async function capture(env: Env, c: TourContent) {
  const result = await env.DB.prepare(
    "SELECT c.* FROM captures c JOIN gym_state g ON g.active_capture_id=c.id WHERE g.id=1 AND c.id=? AND c.status='published' AND c.upload_state='ready'",
  )
    .bind(c.captureId)
    .first<{
      id: string;
      version: number;
      transform: string;
      filename: string;
      size: number;
      alignment: string | null;
      initial_camera: string | null;
    }>();
  if (!result) return null;
  return captureStamp(c) ===
    captureStamp({
      captureId: result.id,
      captureVersion: result.version,
      captureTransform: JSON.parse(result.transform),
    })
    ? result
    : null;
}
async function links(env: Env, c: TourContent, images = false, tour?: string) {
  for (const stop of c.stops) {
    if (stop.section) {
      const section = await env.DB.prepare(
        'SELECT snapshot FROM section_revisions WHERE section_id=? AND revision=?',
      )
        .bind(stop.section.id, stop.section.revision)
        .first();
      if (!section)
        throw new HttpError(
          400,
          'La zona o su revisión no pertenece a este gimnasio.',
        );
    }
    if (stop.linkedRouteId) {
      const route = await env.DB.prepare(
        "SELECT id FROM routes WHERE id=? AND publication_state='public'",
      )
        .bind(stop.linkedRouteId)
        .first();
      if (!route)
        throw new HttpError(
          400,
          'La ruta enlazada no es pública en este gimnasio.',
        );
    }
    if (stop.imageId) {
      const image = await env.DB.prepare(
        'SELECT presentation FROM tour_images WHERE id=? AND tour_id=?',
      )
        .bind(stop.imageId, tour)
        .first<string>('presentation');
      if (!stop.camera || image !== tourPresentation(c, stop.camera))
        throw new HttpError(
          400,
          'La imagen no corresponde a la cámara y captura de la parada.',
        );
    } else if (images) throw new HttpError(400, 'Falta imagen de la parada.');
  }
}
function guard(env: Env, id: string, revision: number) {
  const key = crypto.randomUUID();
  return [
    env.DB.prepare(
      'INSERT INTO mutation_guards VALUES(?,COALESCE((SELECT CASE WHEN draft_revision=? THEN 1 ELSE 0 END FROM tours WHERE id=?),0))',
    ).bind(key, revision, id),
    env.DB.prepare('DELETE FROM mutation_guards WHERE id=?').bind(key),
  ];
}
function captureGuard(env: Env, c: TourContent, transform: string) {
  const key = crypto.randomUUID();
  return [
    env.DB.prepare(
      "INSERT INTO mutation_guards VALUES(?,EXISTS(SELECT 1 FROM captures c JOIN gym_state g ON g.active_capture_id=c.id WHERE g.id=1 AND c.id=? AND c.version=? AND c.transform=? AND c.status='published' AND c.upload_state='ready'))",
    ).bind(key, c.captureId, c.captureVersion, transform),
    env.DB.prepare('DELETE FROM mutation_guards WHERE id=?').bind(key),
  ];
}
function audit(env: Env, user: string, action: string, id: string) {
  return env.DB.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(
    crypto.randomUUID(),
    user,
    action,
    id,
    new Date().toISOString(),
  );
}
async function publicView(env: Env, r: Row, revision = r.published_revision) {
  if (!revision) throw new HttpError(404, 'Recorrido no publicado.');
  const stored = await env.DB.prepare(
    'SELECT snapshot FROM tour_revisions WHERE tour_id=? AND revision=?',
  )
    .bind(r.id, revision)
    .first<string>('snapshot');
  if (!stored) throw new HttpError(404, 'Revisión no encontrada.');
  const content: TourContent = JSON.parse(stored);
  const source = r.status === 'retired' ? null : await capture(env, content);
  return {
    id: r.id,
    revision,
    status: r.status === 'retired' ? 'retired' : 'published',
    content,
    sceneAvailable: !!source,
    ...(source
      ? {
          capture: {
            id: source.id,
            version: source.version,
            filename: source.filename,
            size: source.size,
            status: 'published',
            upload_state: 'ready',
            transform: JSON.parse(source.transform),
            alignment: source.alignment ? JSON.parse(source.alignment) : null,
            initialCamera: source.initial_camera
              ? JSON.parse(source.initial_camera)
              : null,
            fileUrl: `/api/captures/${source.id}/file/scene.ply`,
          },
        }
      : {}),
  };
}
export async function tourApi(
  request: Request,
  env: Env,
  identity: () => Promise<string>,
): Promise<Response | undefined> {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method;
  if (!/^\/api\/(?:tours|tour-images|staff\/tours)(?:\/|$)/.test(path)) return;
  if (url.search)
    throw new HttpError(400, 'Parámetro de recorrido no permitido.');
  const imageMatch = path.match(/^\/api\/tour-images\/([a-zA-Z0-9_-]+)$/);
  if (imageMatch && method === 'GET') {
    const image = await env.DB.prepare('SELECT * FROM tour_images WHERE id=?')
      .bind(imageMatch[1])
      .first<{ object_key: string }>();
    if (!image) throw new HttpError(404, 'Imagen no encontrada.');
    const published = await env.DB.prepare(
      'SELECT image_id FROM tour_revision_images WHERE image_id=? LIMIT 1',
    )
      .bind(imageMatch[1])
      .first();
    if (!published) await role(env, await identity());
    const object = await env.CAPTURES.get(image.object_key);
    if (!object) throw new HttpError(404, 'Imagen no disponible.');
    return new Response(object.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  const revisionMatch = path.match(
    /^\/api\/tours\/([a-zA-Z0-9_-]+)\/revisions\/(\d+)$/,
  );
  if (revisionMatch && method === 'GET')
    return json({
      tour: await publicView(
        env,
        await row(env, revisionMatch[1]),
        Number(revisionMatch[2]),
      ),
    });
  const publicMatch = path.match(/^\/api\/tours\/([a-zA-Z0-9_-]+)$/);
  if (method === 'GET' && (path === '/api/tours' || publicMatch)) {
    const id =
      publicMatch?.[1] ||
      (await env.DB.prepare(
        'SELECT tour_id FROM tour_state WHERE id=1',
      ).first<string>('tour_id'));
    if (!id) return json({ tour: null });
    return json({ tour: await publicView(env, await row(env, id)) });
  }
  if (path.startsWith('/api/tours'))
    throw new HttpError(
      method === 'GET' ? 404 : 405,
      'Recorrido u operación no disponible.',
    );
  if (method === 'GET' && path.startsWith('/api/tour-images'))
    throw new HttpError(404, 'Imagen no encontrada.');
  const user = await identity();
  const staffMatch = path.match(
    /^\/api\/staff\/tours\/([a-zA-Z0-9_-]+)(?:\/(publish|retire))?$/,
  );
  await role(env, user, !!staffMatch?.[2]);
  if (path === '/api/staff/tours' && method === 'GET') {
    const list = await env.DB.prepare(
      'SELECT id,draft_revision,published_revision,status FROM tours ORDER BY rowid DESC LIMIT 100',
    ).all();
    return json({ tours: list.results });
  }
  if (staffMatch && !staffMatch[2] && method === 'GET') {
    const r = await row(env, staffMatch[1]);
    return json({
      id: r.id,
      revision: r.draft_revision,
      publishedRevision: r.published_revision,
      status: r.status,
      content: JSON.parse(r.draft),
    });
  }
  if (path === '/api/tour-images' && method === 'POST') {
    if (request.headers.get('Content-Type') !== 'image/png')
      throw new HttpError(415, 'Usa PNG.');
    const id = checked(() => tourId(request.headers.get('X-Tour-Id'))),
      r = await row(env, id);
    const presentation = checked(() => {
      const p = JSON.parse(request.headers.get('X-Tour-Presentation') || '');
      const { camera: rawCamera, ...context } = p;
      const c = tourContent({ ...context, stops: [] });
      const camera = tourCamera(rawCamera);
      return { c, camera };
    });
    // Header carries context plus camera; never accepts an asset URL or another binding.
    if (captureStamp(JSON.parse(r.draft)) !== captureStamp(presentation.c))
      throw new HttpError(409, 'Guarda primero el contexto del borrador.');
    const source = await capture(env, presentation.c);
    if (!source)
      throw new HttpError(409, 'La captura cambió; revisa el recorrido.');
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, 'Falta PNG.');
    let length = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 5 * 1024 * 1024) {
        await reader.cancel();
        throw new HttpError(413, 'PNG máximo 5 MiB.');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (
      bytes.length < 33 ||
      ![137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n) ||
      new TextDecoder().decode(bytes.slice(12, 16)) !== 'IHDR'
    )
      throw new HttpError(400, 'PNG inválido.');
    const view = new DataView(bytes.buffer);
    if (
      !view.getUint32(16) ||
      !view.getUint32(20) ||
      view.getUint32(16) > 4096 ||
      view.getUint32(20) > 4096
    )
      throw new HttpError(400, 'PNG máximo 4096 × 4096.');
    // Check the complete PNG chunk envelope, not only its prefix.
    let cursor = 8,
      chunksSeen = 0,
      dataSeen = false,
      ended = false;
    while (cursor + 12 <= bytes.length && ++chunksSeen <= 4096) {
      const size = view.getUint32(cursor),
        type = new TextDecoder().decode(bytes.slice(cursor + 4, cursor + 8));
      if (
        cursor + size + 12 > bytes.length ||
        (cursor === 8 && (type !== 'IHDR' || size !== 13))
      )
        break;
      if (type === 'IDAT' && size > 0) dataSeen = true;
      cursor += size + 12;
      if (type === 'IEND') {
        ended = size === 0 && cursor === bytes.length;
        break;
      }
    }
    if (!dataSeen || !ended)
      throw new HttpError(400, 'Estructura PNG incompleta.');
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      (n) => n.toString(16).padStart(2, '0'),
    ).join('');
    const key = await requestKey(env, user, 'tour.image', {
      requestId: request.headers.get('X-Request-Id'),
      id,
      presentation: tourPresentation(presentation.c, presentation.camera),
      hash,
    });
    if (key?.previous) return json(JSON.parse(key.previous));
    const imageId = crypto.randomUUID(),
      objectKey = `tour-images/${imageId}.png`,
      response = { id: imageId };
    await env.CAPTURES.put(objectKey, bytes, {
      httpMetadata: { contentType: 'image/png' },
    });
    try {
      const result = await writeOnce(
        env,
        user,
        'tour.image',
        key,
        JSON.stringify(response),
        [
          ...captureGuard(env, presentation.c, source.transform),
          audit(env, user, 'tour.image', imageId),
          env.DB.prepare('INSERT INTO tour_images VALUES(?,?,?,?,?,?)').bind(
            imageId,
            id,
            tourPresentation(presentation.c, presentation.camera),
            objectKey,
            user,
            new Date().toISOString(),
          ),
        ],
      );
      if (result !== JSON.stringify(response))
        await env.CAPTURES.delete(objectKey);
      return json(JSON.parse(result), 201);
    } catch (e) {
      await env.CAPTURES.delete(objectKey);
      throw e;
    }
  }
  if (method !== 'POST' && method !== 'PUT')
    throw new HttpError(405, 'Método no permitido.');
  if (
    (staffMatch && !staffMatch[2] && method !== 'PUT') ||
    ((!staffMatch || staffMatch[2]) && method !== 'POST')
  )
    throw new HttpError(405, 'Método no permitido.');
  const b = await body(request, 65536);
  if (
    Object.keys(b).some(
      (k) =>
        !['requestId', 'expectedRevision', 'content', 'reviewed'].includes(k),
    )
  )
    throw new HttpError(400, 'Campo no permitido.');
  if (b.requestId === undefined)
    throw new HttpError(400, 'Falta identificador de reintento.');
  const action = staffMatch?.[2] || 'save',
    id = staffMatch?.[1] || crypto.randomUUID();
  if (!staffMatch && path !== '/api/staff/tours')
    throw new HttpError(404, 'Operación no encontrada.');
  const kind = `tour.${action}.${staffMatch?.[1] || 'new'}`,
    key = await requestKey(env, user, kind, b);
  if (key?.previous) return json(JSON.parse(key.previous));
  const current = staffMatch ? await row(env, id) : null;
  if (current && b.expectedRevision !== current.draft_revision)
    throw new HttpError(
      409,
      'El recorrido cambió. Consulta y revisa la nueva base.',
    );
  if (!current && b.expectedRevision !== undefined && b.expectedRevision !== 0)
    throw new HttpError(409, 'El recorrido todavía no existe.');
  const revision = (current?.draft_revision || 0) + 1;
  const statements: D1PreparedStatement[] = current
    ? guard(env, id, current.draft_revision)
    : [];
  if (action === 'retire') {
    if (!current?.published_revision)
      throw new HttpError(400, 'El recorrido no está publicado.');
    statements.push(
      env.DB.prepare(
        "UPDATE tours SET status='retired',draft_revision=? WHERE id=?",
      ).bind(revision, id),
      env.DB.prepare(
        'UPDATE tour_state SET tour_id=NULL WHERE id=1 AND tour_id=?',
      ).bind(id),
    );
  } else {
    const content = checked(() => tourContent(b.content));
    const source = await capture(env, content);
    if (!source)
      throw new HttpError(
        409,
        'La captura o su versión cambió; revisa las paradas.',
      );
    await links(env, content, action === 'publish', id);
    if (action === 'publish') {
      if (!current) throw new HttpError(400, 'Guarda primero el borrador.');
      if (b.reviewed !== true || tourProblems(content).length)
        throw new HttpError(
          400,
          'Completa y revisa todas las paradas antes de publicar.',
        );
    }
    statements.push(...captureGuard(env, content, source.transform));
    if (current)
      statements.push(
        env.DB.prepare(
          'UPDATE tours SET draft_revision=?,draft=? WHERE id=?',
        ).bind(revision, JSON.stringify(content), id),
      );
    else
      statements.push(
        env.DB.prepare("INSERT INTO tours VALUES(?,?,?,NULL,'draft')").bind(
          id,
          revision,
          JSON.stringify(content),
        ),
      );
    if (action === 'publish') {
      statements.push(
        env.DB.prepare('INSERT INTO tour_revisions VALUES(?,?,?,?,?)').bind(
          id,
          revision,
          JSON.stringify(content),
          user,
          new Date().toISOString(),
        ),
        env.DB.prepare(
          "UPDATE tours SET published_revision=?,status='published' WHERE id=?",
        ).bind(revision, id),
        env.DB.prepare('UPDATE tour_state SET tour_id=? WHERE id=1').bind(id),
      );
      for (const imageId of new Set(content.stops.map((s) => s.imageId!)))
        statements.push(
          env.DB.prepare('INSERT INTO tour_revision_images VALUES(?,?,?)').bind(
            id,
            revision,
            imageId,
          ),
        );
    }
  }
  statements.push(audit(env, user, `tour.${action}`, id));
  const result = await writeOnce(
    env,
    user,
    kind,
    key,
    JSON.stringify({ id, revision }),
    statements,
  );
  return json(JSON.parse(result), current ? 200 : 201);
}
