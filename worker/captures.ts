import { presentationKey } from './pilot';
import { polygonGeometry, polygonBounds } from '../shared/sections';
import {
  align,
  defaultTransform,
  point,
  type Point,
} from '../shared/alignment';
import { HttpError, body, json, text } from './http';
export const PART_SIZE = 10 * 1024 * 1024;
type Capture = {
  id: string;
  filename: string;
  size: number;
  object_key: string;
  upload_id: string;
  status: string;
  upload_state: string;
  transform: string;
  alignment: string | null;
  version: number;
  initial_camera: string | null;
};
async function admin(env: Env, user: string) {
  const role = await env.DB.prepare('SELECT role FROM staff WHERE user_id=?')
    .bind(user)
    .first('role');
  if (role !== 'admin')
    throw new HttpError(
      403,
      'Solo el administrador puede gestionar capturas y referencias.',
    );
}
async function capture(env: Env, id: string) {
  const c = await env.DB.prepare('SELECT * FROM captures WHERE id=?')
    .bind(id)
    .first<Capture>();
  if (!c) throw new HttpError(404, 'Captura no encontrada.');
  return c;
}
const describe = (c: Capture) => ({
  id: c.id,
  filename: c.filename,
  size: c.size,
  status: c.status,
  upload_state: c.upload_state,
  version: c.version,
  transform: JSON.parse(c.transform),
  initialCamera: c.initial_camera ? JSON.parse(c.initial_camera) : null,
  alignment: c.alignment ? JSON.parse(c.alignment) : null,
  fileUrl: `/api/captures/${c.id}/file/${c.filename.toLowerCase().endsWith('.sog') ? 'scene.sog' : 'scene.ply'}`,
});
const state = (env: Env) =>
  env.DB.prepare('SELECT * FROM gym_state WHERE id=1').first<{
    active_capture_id: string | null;
    generation: number;
  }>();
export async function captureApi(
  request: Request,
  env: Env,
  identity: () => Promise<string>,
): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  if (!/^\/api\/(captures|sections|fiducials)(\/|$)/.test(path)) return;
  if (path === '/api/captures/current' && request.method === 'GET') {
    const s = await state(env);
    return json({
      generation: s?.generation || 0,
      capture: s?.active_capture_id
        ? describe(await capture(env, s.active_capture_id))
        : null,
    });
  }
  if (path === '/api/sections' && request.method === 'GET') {
    const r = await env.DB.prepare('SELECT * FROM sections ORDER BY name').all<{
      id: string;
      name: string;
      bounds: string;
      geometry: string | null;
      kind: string;
    }>();
    return json({
      sections: r.results.map((v) => ({
        ...v,
        bounds: JSON.parse(v.bounds),
        geometry: v.geometry ? JSON.parse(v.geometry) : null,
      })),
    });
  }
  const sectionRevisionMatch = path.match(
    /^\/api\/sections\/([^/]+)\/revisions\/(\d+)$/,
  );
  if (sectionRevisionMatch && request.method === 'GET') {
    const row = await env.DB.prepare(
      'SELECT snapshot FROM section_revisions WHERE section_id=? AND revision=?',
    )
      .bind(sectionRevisionMatch[1], Number(sectionRevisionMatch[2]))
      .first<{ snapshot: string }>();
    if (!row) throw new HttpError(404, 'Revisión de sección no encontrada.');
    return json({ section: JSON.parse(row.snapshot) });
  }
  const metadataMatch = path.match(/^\/api\/captures\/([^/]+)\/metadata$/);
  if (metadataMatch && request.method === 'GET') {
    const c = await capture(env, metadataMatch[1]);
    if (c.status !== 'published') await admin(env, await identity());
    return json({ capture: describe(c) });
  }
  const fileMatch = path.match(
    /^\/api\/captures\/([^/]+)\/file\/(scene\.(?:ply|sog))$/,
  );
  if (fileMatch && request.method === 'GET') {
    const c = await capture(env, fileMatch[1]);
    if (c.upload_state !== 'ready')
      throw new HttpError(404, 'Captura incompleta.');
    if (c.status !== 'published') await admin(env, await identity());
    const object = await env.CAPTURES.get(c.object_key);
    if (!object) throw new HttpError(404, 'Archivo no encontrado.');
    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(object.size),
        ETag: object.httpEtag,
        'Cache-Control':
          c.status === 'published'
            ? 'public, max-age=31536000, immutable'
            : 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  const user = await identity();
  await admin(env, user);
  const rollback = path.match(/^\/api\/captures\/([^/]+)\/rollback$/);
  if (rollback && request.method === 'POST') {
    const target = await capture(env, rollback[1]),
      current = await state(env),
      b = await body(request);
    const reason = text(b.reason, 2000);
    if (
      target.status !== 'published' ||
      target.upload_state !== 'ready' ||
      !current ||
      b.expectedGeneration !== current.generation ||
      target.id === current.active_capture_id
    )
      throw new HttpError(
        409,
        'Revisa la captura y generación antes de restaurar.',
      );
    const rows = await env.DB.prepare(
      "SELECT r.id,r.name,r.grade,r.sector,r.beta,r.publication_state,rr.revision,rr.snapshot FROM routes r JOIN route_revisions rr ON rr.route_id=r.id WHERE r.publication_state='public' AND rr.revision=(SELECT MAX(revision) FROM route_revisions WHERE route_id=r.id)",
    ).all<{
      id: string;
      name: string;
      grade: string;
      sector: string;
      beta: string;
      revision: number;
      snapshot: string;
    }>();
    if (rows.results.length > 100)
      throw new HttpError(400, 'Hasta 100 rutas por restauración.');
    const guard = crypto.randomUUID(),
      now = new Date().toISOString();
    const statements = [
      env.DB.prepare(
        'INSERT INTO mutation_guards VALUES(?,(SELECT CASE WHEN generation=? THEN 1 ELSE 0 END FROM gym_state WHERE id=1))',
      ).bind(guard, current.generation),
    ];
    for (const row of rows.results) {
      const prior = await env.DB.prepare(
        'SELECT snapshot FROM route_revisions WHERE route_id=? AND capture_id=? ORDER BY revision DESC LIMIT 1',
      )
        .bind(row.id, target.id)
        .first<{ snapshot: string }>();
      const snapshot = prior
        ? JSON.parse(prior.snapshot)
        : JSON.parse(row.snapshot);
      snapshot.id = row.id;
      snapshot.name = snapshot.name || row.name;
      snapshot.grade = snapshot.grade || row.grade;
      snapshot.sector = snapshot.sector || row.sector;
      snapshot.holds = snapshot.holds || [];
      snapshot.revision = row.revision + 1;
      snapshot.status =
        prior && snapshot.status !== 'retirada' ? 'activa' : 'retirada';
      statements.push(
        env.DB.prepare('INSERT INTO route_revisions VALUES(?,?,?,?)').bind(
          row.id,
          snapshot.revision,
          JSON.stringify(snapshot),
          snapshot.captureId || null,
        ),
        env.DB.prepare(
          'UPDATE routes SET name=?,grade=?,sector=?,beta=?,status=?,section_id=? WHERE id=?',
        ).bind(
          snapshot.name,
          snapshot.grade,
          snapshot.sector,
          snapshot.beta || '',
          snapshot.status,
          snapshot.sectionId || null,
          row.id,
        ),
        env.DB.prepare('INSERT INTO route_changes VALUES(?,?,?,?,?)').bind(
          row.id,
          snapshot.revision,
          reason,
          user,
          now,
        ),
      );
    }
    statements.push(
      env.DB.prepare(
        'UPDATE gym_state SET active_capture_id=?,generation=generation+1 WHERE id=1',
      ).bind(target.id),
      env.DB.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(
        crypto.randomUUID(),
        user,
        'capture.rollback',
        target.id,
        now,
      ),
      env.DB.prepare('DELETE FROM mutation_guards WHERE id=?').bind(guard),
    );
    try {
      await env.DB.batch(statements);
    } catch {
      throw new HttpError(
        409,
        'Cambió el catálogo. Revisa antes de restaurar.',
      );
    }
    return json({ state: await state(env) });
  }
  if (path === '/api/captures' && request.method === 'GET') {
    const r = await env.DB.prepare(
      'SELECT * FROM captures ORDER BY created_at DESC LIMIT 100',
    ).all<Capture>();
    return json({ captures: r.results.map(describe), state: await state(env) });
  }
  if (path === '/api/fiducials' && request.method === 'GET') {
    const r = await env.DB.prepare(
      'SELECT * FROM fiducials ORDER BY label',
    ).all<{ id: string; label: string; position: string }>();
    return json({
      fiducials: r.results.map((v) => ({
        ...v,
        position: JSON.parse(v.position),
      })),
    });
  }
  if (path === '/api/fiducials' && request.method === 'POST') {
    const b = await body(request);
    let position;
    try {
      position = point(b.position);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO fiducials VALUES(?,?,?)')
      .bind(id, text(b.label, 80), JSON.stringify(position))
      .run();
    return json({ id }, 201);
  }
  const sectionEditMatch = path.match(/^\/api\/sections\/([^/]+)$/);
  const sectionHistoryMatch = path.match(
    /^\/api\/sections\/([^/]+)\/revisions$/,
  );
  if (sectionHistoryMatch && request.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT revision,snapshot,created_at FROM section_revisions WHERE section_id=? ORDER BY revision DESC LIMIT 100',
    )
      .bind(sectionHistoryMatch[1])
      .all<{ revision: number; snapshot: string; created_at: string }>();
    return json({
      revisions: rows.results.map((r) => ({
        revision: r.revision,
        section: JSON.parse(r.snapshot),
        createdAt: r.created_at,
      })),
    });
  }
  if (
    (path === '/api/sections' && request.method === 'POST') ||
    (sectionEditMatch && request.method === 'PUT')
  ) {
    const b = await body(request);
    let min: Point, max: Point;
    let geometry = null;
    const kind = b.kind ?? 'wall';
    if (!['wall', 'accessible-area'].includes(String(kind)))
      throw new HttpError(400, 'Tipo de sección inválido.');
    try {
      if (b.geometry) {
        geometry = polygonGeometry(b.geometry);
        ({ min, max } = polygonBounds(geometry));
      } else {
        min = point(b.min);
        max = point(b.max);
      }
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    if (min.some((n, i) => n >= max[i]))
      throw new HttpError(
        400,
        'Los límites mínimo y máximo deben formar un volumen.',
      );
    const id = sectionEditMatch?.[1] || crypto.randomUUID();
    const name = text(b.name, 80),
      bounds = JSON.stringify({ min, max }),
      shape = geometry ? JSON.stringify(geometry) : null;
    const current = sectionEditMatch
      ? await env.DB.prepare('SELECT revision FROM sections WHERE id=?')
          .bind(id)
          .first<{ revision: number }>()
      : null;
    if (sectionEditMatch && !current)
      throw new HttpError(404, 'Sección no encontrada.');
    if (current && b.expectedRevision !== current.revision)
      throw new HttpError(
        409,
        'La sección cambió. Recarga y revisa antes de guardar.',
      );
    const revision = (current?.revision || 0) + 1,
      now = new Date().toISOString(),
      guard = crypto.randomUUID();
    const snapshot = JSON.stringify({
      id,
      name,
      bounds: { min, max },
      geometry,
      kind,
      revision,
    });
    const statements = current
      ? [
          env.DB.prepare(
            'INSERT INTO mutation_guards(id,verified) VALUES(?,COALESCE((SELECT CASE WHEN revision=? THEN 1 ELSE 0 END FROM sections WHERE id=?),0))',
          ).bind(guard, current.revision, id),
          env.DB.prepare(
            'UPDATE sections SET name=?,bounds=?,geometry=?,kind=?,revision=? WHERE id=? AND revision=?',
          ).bind(name, bounds, shape, kind, revision, id, current.revision),
        ]
      : [
          env.DB.prepare(
            'INSERT INTO sections(id,name,bounds,geometry,kind,revision) VALUES(?,?,?,?,?,?)',
          ).bind(id, name, bounds, shape, kind, revision),
        ];
    statements.push(
      env.DB.prepare('INSERT INTO section_revisions VALUES(?,?,?,?,?)').bind(
        id,
        revision,
        snapshot,
        user,
        now,
      ),
      env.DB.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(
        crypto.randomUUID(),
        user,
        current ? 'section.update' : 'section.create',
        id,
        now,
      ),
    );
    if (current)
      statements.push(
        env.DB.prepare('DELETE FROM mutation_guards WHERE id=?').bind(guard),
      );
    try {
      await env.DB.batch(statements);
    } catch {
      throw new HttpError(
        409,
        'La sección cambió. Recarga y revisa antes de guardar.',
      );
    }
    return json(
      { id, revision, section: JSON.parse(snapshot) },
      current ? 200 : 201,
    );
  }
  if (path === '/api/captures' && request.method === 'POST') {
    const b = await body(request);
    const filename = text(b.filename, 160);
    if (
      !/\.(ply|sog)$/i.test(filename) ||
      !Number.isInteger(b.size) ||
      Number(b.size) <= 0 ||
      Number(b.size) > 1024 * 1024 * 1024
    )
      throw new HttpError(400, 'Usa un PLY/SOG completo de hasta 1 GB.');
    const id = crypto.randomUUID(),
      key = `captures/${id}/scene.${filename.toLowerCase().endsWith('.sog') ? 'sog' : 'ply'}`;
    const upload = await env.CAPTURES.createMultipartUpload(key, {
      httpMetadata: { contentType: 'application/octet-stream' },
    });
    try {
      await env.DB.prepare(
        'INSERT INTO captures(id,filename,size,object_key,upload_id,transform,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)',
      )
        .bind(
          id,
          filename,
          Number(b.size),
          key,
          upload.uploadId,
          JSON.stringify(defaultTransform),
          user,
          new Date().toISOString(),
        )
        .run();
    } catch (e) {
      await upload.abort();
      throw e;
    }
    return json({ id, partSize: PART_SIZE }, 201);
  }
  const partMatch = path.match(/^\/api\/captures\/([^/]+)\/parts\/(\d+)$/);
  if (partMatch && request.method === 'PUT') {
    const c = await capture(env, partMatch[1]);
    const n = Number(partMatch[2]);
    if (c.status !== 'draft' || c.upload_state !== 'uploading')
      throw new HttpError(409, 'La captura no admite más partes.');
    if (n < 1 || n > Math.ceil(c.size / PART_SIZE))
      throw new HttpError(400, 'Parte inválida.');
    const length = Math.min(PART_SIZE, c.size - (n - 1) * PART_SIZE);
    if (
      Number(request.headers.get('Content-Length')) !== length ||
      !request.body
    )
      throw new HttpError(400, 'Tamaño de parte incorrecto.');
    const upload = env.CAPTURES.resumeMultipartUpload(
      c.object_key,
      c.upload_id,
    );
    const result = await upload.uploadPart(n, request.body);
    await env.DB.prepare(
      'INSERT INTO capture_parts(capture_id,part,etag,size) VALUES(?,?,?,?) ON CONFLICT(capture_id,part) DO UPDATE SET etag=excluded.etag,size=excluded.size',
    )
      .bind(c.id, n, result.etag, length)
      .run();
    return json({ part: n });
  }
  const complete = path.match(/^\/api\/captures\/([^/]+)\/complete$/);
  if (complete && request.method === 'POST') {
    const c = await capture(env, complete[1]);
    const parts = await env.DB.prepare(
      'SELECT part,etag,size FROM capture_parts WHERE capture_id=? ORDER BY part',
    )
      .bind(c.id)
      .all<{ part: number; etag: string; size: number }>();
    if (
      parts.results.length !== Math.ceil(c.size / PART_SIZE) ||
      parts.results.reduce((s, p) => s + p.size, 0) !== c.size
    )
      throw new HttpError(409, 'Faltan partes de la captura.');
    const lock = await env.DB.prepare(
      "UPDATE captures SET upload_state='finalizing' WHERE id=? AND status='draft' AND upload_state='uploading'",
    )
      .bind(c.id)
      .run();
    if (!lock.meta.changes)
      throw new HttpError(409, 'La captura ya fue completada.');
    try {
      const object = await env.CAPTURES.resumeMultipartUpload(
        c.object_key,
        c.upload_id,
      ).complete(
        parts.results.map((p) => ({ partNumber: p.part, etag: p.etag })),
      );
      if (object.size !== c.size) throw new Error('Size mismatch');
      const prefix = await env.CAPTURES.get(c.object_key, {
        range: { offset: 0, length: 4 },
      });
      const bytes = prefix
        ? new Uint8Array(await prefix.arrayBuffer())
        : new Uint8Array();
      const valid = c.filename.toLowerCase().endsWith('.ply')
        ? new TextDecoder().decode(bytes).startsWith('ply')
        : bytes[0] === 80 && bytes[1] === 75;
      if (!valid) throw new Error('Invalid file signature');
      await env.DB.prepare(
        "UPDATE captures SET upload_state='ready' WHERE id=?",
      )
        .bind(c.id)
        .run();
      return json({ capture: describe(await capture(env, c.id)) });
    } catch {
      await env.DB.prepare(
        "UPDATE captures SET upload_state='failed' WHERE id=?",
      )
        .bind(c.id)
        .run();
      throw new HttpError(
        400,
        'El archivo no parece un splat válido. La captura no se publicó.',
      );
    }
  }
  const cameraMatch = path.match(/^\/api\/captures\/([^/]+)\/camera$/);
  if (cameraMatch && request.method === 'POST') {
    const c = await capture(env, cameraMatch[1]);
    const b = await body(request);
    if (
      c.status !== 'draft' ||
      c.upload_state !== 'ready' ||
      b.expectedVersion !== c.version
    )
      throw new HttpError(409, 'Captura modificada o no editable.');
    const v = b.camera as Record<string, unknown> | undefined;
    try {
      if (
        !v ||
        v.captureId !== c.id ||
        !['yaw', 'pitch', 'distance'].every(
          (k) => typeof v[k] === 'number' && Number.isFinite(v[k]),
        ) ||
        Math.abs(Number(v.yaw)) > 1e6 ||
        Math.abs(Number(v.pitch)) > 1.4 ||
        Number(v.distance) < 0.05 ||
        Number(v.distance) > 10000
      )
        throw new Error('Cámara inválida.');
      point(v.target);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    const view = {
      captureId: c.id,
      yaw: v!.yaw,
      pitch: v!.pitch,
      distance: v!.distance,
      target: v!.target,
    };
    const updated = await env.DB.prepare(
      "UPDATE captures SET initial_camera=?,version=version+1 WHERE id=? AND status='draft' AND version=?",
    )
      .bind(JSON.stringify(view), c.id, c.version)
      .run();
    if (!updated.meta.changes) throw new HttpError(409, 'Captura modificada.');
    return json({ capture: describe(await capture(env, c.id)) });
  }
  const alignment = path.match(/^\/api\/captures\/([^/]+)\/align$/);
  if (alignment && request.method === 'POST') {
    const c = await capture(env, alignment[1]);
    const b = await body(request);
    if (
      c.status !== 'draft' ||
      c.upload_state !== 'ready' ||
      b.expectedVersion !== c.version
    )
      throw new HttpError(409, 'Captura modificada o no editable.');
    if (
      !Array.isArray(b.references) ||
      b.references.length < 3 ||
      b.references.length > 20
    )
      throw new HttpError(400, 'Usa entre 3 y 20 referencias.');
    const refs = await env.DB.prepare('SELECT id,position FROM fiducials').all<{
      id: string;
      position: string;
    }>();
    const map = new Map(
      refs.results.map((r) => [r.id, JSON.parse(r.position) as Point]),
    );
    const ids = new Set<string>();
    const source: Point[] = [],
      target: Point[] = [];
    try {
      for (const r of b.references) {
        if (!r || typeof r.id !== 'string' || ids.has(r.id) || !map.has(r.id))
          throw new Error('Referencia desconocida o duplicada.');
        ids.add(r.id);
        source.push(point(r.observed));
        target.push(map.get(r.id)!);
      }
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    let result;
    try {
      result = align(source, target);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    const updated = await env.DB.prepare(
      "UPDATE captures SET transform=?,alignment=?,initial_camera=NULL,version=version+1 WHERE id=? AND status='draft' AND version=?",
    )
      .bind(
        JSON.stringify(result.transform),
        JSON.stringify({
          references: b.references,
          rms: result.rms,
          residuals: result.residuals,
        }),
        c.id,
        c.version,
      )
      .run();
    if (!updated.meta.changes) throw new HttpError(409, 'Captura modificada.');
    return json({ capture: describe(await capture(env, c.id)) });
  }
  const publish = path.match(/^\/api\/captures\/([^/]+)\/publish$/);
  if (publish && request.method === 'POST') {
    const c = await capture(env, publish[1]),
      s = await state(env);
    const b = await body(request, 16384);
    if (
      !s ||
      b.expectedGeneration !== s.generation ||
      b.expectedVersion !== c.version ||
      c.status !== 'draft' ||
      c.upload_state !== 'ready' ||
      b.reviewedAlignment !== true
    )
      throw new HttpError(
        409,
        'Revisa captura, alineación y versión antes de publicar.',
      );
    if (s.active_capture_id && !c.alignment)
      throw new HttpError(
        400,
        'La captura nueva requiere alineación por referencias.',
      );
    if (
      !Array.isArray(b.changedSectionIds) ||
      !Array.isArray(b.importRouteIds) ||
      !Array.isArray(b.reviewedRouteIds)
    )
      throw new HttpError(
        400,
        'Falta selección de secciones y revisión de rutas.',
      );
    const sections = await env.DB.prepare('SELECT id FROM sections').all<{
      id: string;
    }>();
    const sectionIds = new Set(sections.results.map((r) => r.id));
    if (b.changedSectionIds.some((id) => !sectionIds.has(id)))
      throw new HttpError(400, 'Sección desconocida.');
    const changed = new Set(b.changedSectionIds),
      imports = new Set(b.importRouteIds),
      reviewed = new Set(b.reviewedRouteIds);
    const routes = await env.DB.prepare(
      "SELECT r.id,r.section_id,r.status,rr.revision,rr.snapshot FROM routes r JOIN route_revisions rr ON rr.route_id=r.id WHERE ((r.status='activa' AND r.publication_state='public') OR r.id IN (SELECT value FROM json_each(?))) AND rr.revision=(SELECT MAX(revision) FROM route_revisions WHERE route_id=r.id)",
    )
      .bind(JSON.stringify(b.importRouteIds))
      .all<{
        id: string;
        section_id: string | null;
        status: string;
        revision: number;
        snapshot: string;
      }>();
    if (routes.results.length > 100)
      throw new HttpError(
        400,
        'Esta versión admite hasta 100 rutas por publicación.',
      );
    if (
      routes.results.some(
        (r) => !r.section_id && JSON.parse(r.snapshot).captureId,
      )
    )
      throw new HttpError(
        400,
        'Hay una ruta vinculada a una captura sin sección. Corrige su sección antes de publicar.',
      );
    const routeIds = new Set(routes.results.map((r) => r.id));
    if ([...imports, ...reviewed].some((id) => !routeIds.has(id)))
      throw new HttpError(400, 'Ruta desconocida.');
    if (routes.results.some((r) => !r.section_id && imports.has(r.id)))
      throw new HttpError(
        400,
        'Asigna una sección a la ruta antes de importarla.',
      );
    const carried = routes.results.filter(
      (r) =>
        !!r.section_id &&
        ((r.status === 'activa' && !changed.has(r.section_id)) ||
          imports.has(r.id)),
    );
    if (carried.some((r) => !reviewed.has(r.id)))
      throw new HttpError(
        400,
        'Revisa explícitamente cada ruta que se conservará.',
      );
    const presentations =
      b.routePresentations &&
      typeof b.routePresentations === 'object' &&
      !Array.isArray(b.routePresentations)
        ? (b.routePresentations as Record<
            string,
            { imageId: string; camera: unknown }
          >)
        : {};
    for (const r of carried) {
      const old = JSON.parse(r.snapshot);
      if (!old.gradeScale) continue; // Legacy presentations stay readable and visibly incomplete.
      const candidate = presentations[r.id];
      const view = candidate?.camera as { captureId?: string } | undefined;
      const image = candidate?.imageId
        ? await env.DB.prepare(
            'SELECT capture_id,presentation FROM route_images WHERE id=?',
          )
            .bind(candidate.imageId)
            .first<{ capture_id: string; presentation: string }>()
        : null;
      if (
        !image ||
        image.capture_id !== c.id ||
        view?.captureId !== c.id ||
        image.presentation !== presentationKey(view, old.holds3D)
      )
        throw new HttpError(
          400,
          `Prepara cámara e imagen nuevas para ${old.name || r.id}.`,
        );
    }
    const now = new Date().toISOString();
    const statements = [
      env.DB.prepare(
        "INSERT INTO publications(generation,capture_id,verified,details,created_by,created_at) VALUES(?,?,(SELECT CASE WHEN c.status='draft' AND c.version=? AND c.upload_state='ready' AND s.generation=? AND (SELECT COUNT(*) FROM routes WHERE status='activa' AND publication_state='public')=? THEN 1 ELSE 0 END FROM captures c,gym_state s WHERE c.id=? AND s.id=1),?,?,?)",
      ).bind(
        s.generation + 1,
        c.id,
        c.version,
        s.generation,
        routes.results.filter((r) => r.status === 'activa').length,
        c.id,
        JSON.stringify({
          changedSectionIds: b.changedSectionIds,
          importRouteIds: b.importRouteIds,
          reviewedRouteIds: b.reviewedRouteIds,
        }),
        user,
        now,
      ),
    ];
    const updates = routes.results
      .filter((r) => r.section_id)
      .map((r) => {
        const keep = carried.some((k) => k.id === r.id),
          old = JSON.parse(r.snapshot);
        return {
          id: r.id,
          revision: r.revision + 1,
          captureId: keep ? c.id : old.captureId || null,
          snapshot: {
            ...old,
            sectionRevision: old.sectionRevision || 1,
            revision: r.revision + 1,
            status: keep ? 'activa' : 'retirada',
            ...(keep
              ? {
                  captureId: c.id,
                  imageId: presentations[r.id]?.imageId,
                  markersVerified: old.gradeScale ? true : false,
                  ...(presentations[r.id]
                    ? { camera: presentations[r.id].camera }
                    : old.camera
                      ? { camera: { ...old.camera, captureId: c.id } }
                      : {}),
                }
              : {}),
          },
        };
      });
    if (updates.length) {
      const data = JSON.stringify(updates);
      statements.push(
        env.DB.prepare(
          "INSERT INTO route_revisions(route_id,revision,snapshot,capture_id) SELECT json_extract(value,'$.id'),json_extract(value,'$.revision'),json_extract(value,'$.snapshot'),json_extract(value,'$.captureId') FROM json_each(?)",
        ).bind(data),
        env.DB.prepare(
          "UPDATE routes SET status=(SELECT json_extract(value,'$.snapshot.status') FROM json_each(?) WHERE json_extract(value,'$.id')=routes.id) WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?))",
        ).bind(data, data),
      );
    }
    statements.push(
      env.DB.prepare("UPDATE captures SET status='published' WHERE id=?").bind(
        c.id,
      ),
      env.DB.prepare(
        'UPDATE gym_state SET active_capture_id=?,generation=generation+1 WHERE id=1',
      ).bind(c.id),
      env.DB.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(
        crypto.randomUUID(),
        user,
        'capture.publish',
        c.id,
        now,
      ),
    );
    try {
      await env.DB.batch(statements);
    } catch {
      throw new HttpError(
        409,
        'Cambió el catálogo o la captura. Recarga y revisa antes de publicar.',
      );
    }
    return json({
      capture: describe(await capture(env, c.id)),
      state: await state(env),
    });
  }
  throw new HttpError(404, 'Endpoint de captura no encontrado.');
}
