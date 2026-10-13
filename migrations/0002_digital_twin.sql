CREATE TABLE captures(id TEXT PRIMARY KEY,filename TEXT NOT NULL,size INTEGER NOT NULL,object_key TEXT NOT NULL UNIQUE,upload_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),upload_state TEXT NOT NULL DEFAULT 'uploading' CHECK(upload_state IN ('uploading','finalizing','ready','failed')),transform TEXT NOT NULL CHECK(json_valid(transform)),alignment TEXT,version INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE capture_parts(capture_id TEXT NOT NULL REFERENCES captures(id),part INTEGER NOT NULL,etag TEXT NOT NULL,size INTEGER NOT NULL,PRIMARY KEY(capture_id,part));
CREATE TABLE sections(id TEXT PRIMARY KEY,name TEXT NOT NULL,bounds TEXT NOT NULL CHECK(json_valid(bounds)));
CREATE TABLE fiducials(id TEXT PRIMARY KEY,label TEXT NOT NULL,position TEXT NOT NULL CHECK(json_valid(position)));
CREATE TABLE gym_state(id INTEGER PRIMARY KEY CHECK(id=1),active_capture_id TEXT REFERENCES captures(id),generation INTEGER NOT NULL DEFAULT 0);
INSERT INTO gym_state(id) VALUES(1);
CREATE TABLE publications(generation INTEGER PRIMARY KEY,capture_id TEXT NOT NULL UNIQUE REFERENCES captures(id),verified INTEGER NOT NULL CHECK(verified=1),details TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
ALTER TABLE routes ADD COLUMN section_id TEXT REFERENCES sections(id);
ALTER TABLE route_revisions ADD COLUMN capture_id TEXT REFERENCES captures(id);

CREATE TABLE mutation_guards(id TEXT PRIMARY KEY,verified INTEGER NOT NULL CHECK(verified=1));
