-- Additive tour drafts and immutable public revisions. Existing history is untouched.
CREATE TABLE tours(id TEXT PRIMARY KEY,draft_revision INTEGER NOT NULL,draft TEXT NOT NULL CHECK(json_valid(draft)),published_revision INTEGER,status TEXT NOT NULL CHECK(status IN ('draft','published','retired')));
CREATE TABLE tour_revisions(tour_id TEXT NOT NULL REFERENCES tours(id),revision INTEGER NOT NULL,snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),created_by TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(tour_id,revision));
CREATE TABLE tour_state(id INTEGER PRIMARY KEY CHECK(id=1),tour_id TEXT REFERENCES tours(id));
INSERT INTO tour_state VALUES(1,NULL);
CREATE TABLE tour_images(id TEXT PRIMARY KEY,tour_id TEXT NOT NULL REFERENCES tours(id),presentation TEXT NOT NULL,object_key TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE tour_revision_images(tour_id TEXT NOT NULL,revision INTEGER NOT NULL,image_id TEXT NOT NULL REFERENCES tour_images(id),PRIMARY KEY(tour_id,revision,image_id),FOREIGN KEY(tour_id,revision) REFERENCES tour_revisions(tour_id,revision));
