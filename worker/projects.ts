import { body, json, HttpError, text } from './http';
export async function projectApi(
  request: Request,
  env: Env,
  user: string,
): Promise<Response | undefined> {
  const path = new URL(request.url).pathname;
  const match = path.match(/^\/api\/projects(?:\/([^/]+))?$/);
  if (!match) return;
  if (request.method === 'GET') {
    if (match[1]) {
      const history = await env.DB.prepare(
        'SELECT h.* FROM project_history h JOIN projects p ON p.id=h.project_id WHERE p.id=? AND p.user_id=? ORDER BY h.version DESC LIMIT 100',
      )
        .bind(match[1], user)
        .all();
      return json({ history: history.results });
    }
    const projects = await env.DB.prepare(
      "SELECT p.*,json_extract(rr.snapshot,'$.name') AS name,json_extract(rr.snapshot,'$.grade') AS grade,r.status AS route_status FROM projects p JOIN route_revisions rr ON rr.route_id=p.route_id AND rr.revision=p.route_revision JOIN routes r ON r.id=p.route_id WHERE p.user_id=? ORDER BY p.updated_at DESC,p.id LIMIT 1000",
    )
      .bind(user)
      .all();
    return json({ projects: projects.results });
  }
  const b = await body(request);
  const isNew = request.method === 'POST' && !match[1];
  if (!isNew && !(request.method === 'PUT' && match[1]))
    throw new HttpError(404, 'Operación de proyecto no encontrada.');
  const allowed = isNew
    ? ['routeId', 'notes']
    : ['status', 'notes', 'expectedVersion'];
  if (Object.keys(b).some((k) => !allowed.includes(k)))
    throw new HttpError(400, 'Campo no permitido.');
  if (b.notes !== undefined && typeof b.notes !== 'string')
    throw new HttpError(400, 'Notas inválidas.');
  const notes = typeof b.notes === 'string' ? b.notes : '';
  if (notes.length > 2000) throw new HttpError(400, 'Notas demasiado largas.');
  let previous: any;
  if (!isNew) {
    previous = await env.DB.prepare(
      'SELECT * FROM projects WHERE id=? AND user_id=?',
    )
      .bind(match[1], user)
      .first();
    if (!previous) throw new HttpError(404, 'Proyecto no encontrado.');
    if (previous.version !== b.expectedVersion)
      throw new HttpError(409, 'El proyecto cambió. Recarga.');
  }
  const routeId = isNew ? text(b.routeId, 100) : previous.route_id;
  if (isNew) {
    const route = await env.DB.prepare(
      'SELECT publication_state FROM routes WHERE id=?',
    )
      .bind(routeId)
      .first<{ publication_state: string }>();
    if (!route || route.publication_state === 'draft')
      throw new HttpError(404, 'Ruta no encontrada.');
  }
  const revision = isNew
    ? await env.DB.prepare(
        'SELECT MAX(revision) AS n FROM route_revisions WHERE route_id=?',
      )
        .bind(routeId)
        .first<{ n: number }>()
    : { n: previous.route_revision };
  if (!revision?.n) throw new HttpError(404, 'Ruta no encontrada.');
  const state = isNew ? 'pendiente' : String(b.status);
  if (!['pendiente', 'completado', 'archivado'].includes(state))
    throw new HttpError(400, 'Estado inválido.');
  const id = isNew ? crypto.randomUUID() : previous.id,
    now = new Date().toISOString(),
    version = isNew ? 1 : previous.version + 1;
  const snapshot = {
    id,
    routeId,
    routeRevision: revision.n,
    status: state,
    notes,
    version,
  };
  const guard = crypto.randomUUID();
  const statements = [];
  if (isNew)
    statements.push(
      env.DB.prepare(
        'INSERT INTO mutation_guards(id,verified) VALUES(?,(SELECT CASE WHEN COUNT(*)<1000 THEN 1 ELSE 0 END FROM projects WHERE user_id=?))',
      ).bind(guard, user),
    );
  if (!isNew)
    statements.push(
      env.DB.prepare(
        'INSERT INTO mutation_guards(id,verified) VALUES(?,COALESCE((SELECT CASE WHEN version=? THEN 1 ELSE 0 END FROM projects WHERE id=? AND user_id=?),0))',
      ).bind(guard, b.expectedVersion, id, user),
    );
  statements.push(
    isNew
      ? env.DB.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?,?,?,?)').bind(
          id,
          user,
          routeId,
          revision.n,
          state,
          notes,
          version,
          now,
          now,
        )
      : env.DB.prepare(
          'UPDATE projects SET status=?,notes=?,version=?,updated_at=? WHERE id=? AND user_id=? AND version=?',
        ).bind(state, notes, version, now, id, user, b.expectedVersion),
  );
  statements.push(
    env.DB.prepare('INSERT INTO project_history VALUES(?,?,?,?)').bind(
      id,
      version,
      JSON.stringify(snapshot),
      now,
    ),
    env.DB.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(
      crypto.randomUUID(),
      user,
      isNew ? 'project.created' : 'project.updated',
      id,
      now,
    ),
  );
  statements.push(
    env.DB.prepare('DELETE FROM mutation_guards WHERE id=?').bind(guard),
  );
  try {
    await env.DB.batch(statements);
  } catch {
    throw new HttpError(409, 'El proyecto ya existe o cambió. Recarga.');
  }
  return json({ project: snapshot }, isNew ? 201 : 200);
}
