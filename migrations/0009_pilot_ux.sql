-- Additive: existing routes and immutable presentations remain readable.
ALTER TABLE routes ADD COLUMN publication_state TEXT NOT NULL DEFAULT 'public' CHECK(publication_state IN ('draft','public'));
ALTER TABLE reports ADD COLUMN category TEXT NOT NULL DEFAULT 'contenido' CHECK(category IN ('contenido','agarre_suelto','otro'));
ALTER TABLE reports ADD COLUMN assigned_to TEXT;
ALTER TABLE reports ADD COLUMN resolution TEXT;
ALTER TABLE reports ADD COLUMN resolved_at TEXT;
CREATE TABLE request_keys(user_id TEXT NOT NULL,kind TEXT NOT NULL,request_id TEXT NOT NULL,payload TEXT NOT NULL,object_id TEXT NOT NULL,PRIMARY KEY(user_id,kind,request_id));
CREATE TABLE route_images(id TEXT PRIMARY KEY,capture_id TEXT NOT NULL REFERENCES captures(id),object_key TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL,created_at TEXT NOT NULL,presentation TEXT NOT NULL);
CREATE TABLE route_changes(route_id TEXT NOT NULL,revision INTEGER NOT NULL,reason TEXT NOT NULL,changed_by TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(route_id,revision));
CREATE TABLE ux_events(day TEXT NOT NULL,event TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,total_ms INTEGER NOT NULL DEFAULT 0,timed_count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,event));
