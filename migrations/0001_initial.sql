CREATE TABLE routes (id TEXT PRIMARY KEY, name TEXT NOT NULL, grade TEXT NOT NULL, sector TEXT NOT NULL, beta TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'activa' CHECK(status IN ('activa','retirada')));
CREATE TABLE route_revisions (route_id TEXT NOT NULL REFERENCES routes(id), revision INTEGER NOT NULL CHECK(revision > 0), snapshot TEXT NOT NULL CHECK(json_valid(snapshot)), PRIMARY KEY(route_id,revision));
CREATE TABLE staff (user_id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('editor','admin')));
CREATE TABLE entries (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, route_id TEXT NOT NULL, revision INTEGER NOT NULL, attempts INTEGER NOT NULL CHECK(attempts > 0 AND attempts = CAST(attempts AS INTEGER)), result TEXT NOT NULL CHECK(result IN ('intento','ascenso')), notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, FOREIGN KEY(route_id,revision) REFERENCES route_revisions(route_id,revision));
CREATE INDEX entries_owner_date ON entries(user_id,created_at DESC,id);
CREATE TABLE reports (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, route_id TEXT NOT NULL, revision INTEGER NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pendiente' CHECK(status IN ('pendiente','resuelto')), created_at TEXT NOT NULL, resolved_by TEXT, FOREIGN KEY(route_id,revision) REFERENCES route_revisions(route_id,revision));
CREATE INDEX reports_status_date ON reports(status,created_at DESC,id);
CREATE TABLE audit_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, action TEXT NOT NULL, object_id TEXT NOT NULL, created_at TEXT NOT NULL);
