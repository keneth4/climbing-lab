import { body, json, HttpError } from './http';
type EntryRow = {
  id: string;
  user_id: string;
  route_id: string;
  revision: number;
  attempts: number;
  result: string;
  notes: string;
  created_at: string;
  entry_version: number;
  deleted_at: string | null;
};
export const entrySnapshot = (e: EntryRow) => ({
  id: e.id,
  routeId: e.route_id,
  routeRevision: e.revision,
  attempts: e.attempts,
  result: e.result,
  notes: e.notes,
  createdAt: e.created_at,
  deletedAt: e.deleted_at,
  entryVersion: e.entry_version,
});
export async function entryApi(
  request: Request,
  env: Env,
  user: string,
): Promise<Response | undefined> {
  const path = new URL(request.url).pathname,
    match = path.match(/^\/api\/entries\/([^/]+)(\/history)?$/);
  if (!match) return;
  const row = await env.DB.prepare(
    'SELECT * FROM entries WHERE id=? AND user_id=?',
  )
    .bind(match[1], user)
    .first<EntryRow>();
  if (!row) throw new HttpError(404, 'Registro no encontrado.');
  if (match[2] && request.method === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT version,snapshot,action,changed_at FROM entry_history WHERE entry_id=? ORDER BY version DESC LIMIT 100',
    )
      .bind(row.id)
      .all<{
        version: number;
        snapshot: string;
        action: string;
        changed_at: string;
      }>();
    return json({
      history: rows.results.map((r) => ({
        version: r.version,
        action: r.action,
        changedAt: r.changed_at,
        snapshot: JSON.parse(r.snapshot),
      })),
    });
  }
  if (match[2] || !['PUT', 'DELETE'].includes(request.method))
    throw new HttpError(404, 'Operación de registro no encontrada.');
  const b = await body(request),
    deleting = request.method === 'DELETE';
  const allowed = deleting
    ? ['expectedVersion']
    : ['expectedVersion', 'attempts', 'result', 'notes'];
  if (Object.keys(b).some((k) => !allowed.includes(k)))
    throw new HttpError(400, 'Campo no permitido.');
  if (row.deleted_at || b.expectedVersion !== row.entry_version)
    throw new HttpError(
      409,
      'El registro cambió o fue retirado. Recarga antes de guardar.',
    );
  if (
    !deleting &&
    (!Number.isInteger(b.attempts) ||
      Number(b.attempts) < 1 ||
      Number(b.attempts) > 10000 ||
      !['intento', 'ascenso'].includes(String(b.result)) ||
      typeof b.notes !== 'string' ||
      b.notes.length > 2000)
  )
    throw new HttpError(400, 'Actividad inválida.');
  const now = new Date().toISOString(),
    guard = crypto.randomUUID();
  const next = {
    ...row,
    entry_version: row.entry_version + 1,
    deleted_at: deleting ? now : null,
    attempts: deleting ? row.attempts : Number(b.attempts),
    result: deleting ? row.result : String(b.result),
    notes: deleting ? row.notes : String(b.notes),
  };
  const snapshot = entrySnapshot(next),
    action = deleting ? 'deleted' : 'updated';
  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO mutation_guards(id,verified) VALUES(?,COALESCE((SELECT CASE WHEN entry_version=? AND deleted_at IS NULL THEN 1 ELSE 0 END FROM entries WHERE id=? AND user_id=?),0))',
      ).bind(guard, row.entry_version, row.id, user),
      env.DB.prepare(
        'UPDATE entries SET attempts=?,result=?,notes=?,entry_version=?,deleted_at=? WHERE id=? AND user_id=? AND entry_version=?',
      ).bind(
        next.attempts,
        next.result,
        next.notes,
        next.entry_version,
        next.deleted_at,
        row.id,
        user,
        row.entry_version,
      ),
      env.DB.prepare('INSERT INTO entry_history VALUES(?,?,?,?,?,?)').bind(
        row.id,
        next.entry_version,
        JSON.stringify(snapshot),
        action,
        user,
        now,
      ),
      env.DB.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?)').bind(
        crypto.randomUUID(),
        user,
        'entry.' + action,
        row.id,
        now,
      ),
      env.DB.prepare('DELETE FROM mutation_guards WHERE id=?').bind(guard),
    ]);
  } catch {
    throw new HttpError(409, 'El registro cambió. Recarga antes de guardar.');
  }
  return json({ entry: snapshot });
}
