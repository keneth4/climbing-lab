ALTER TABLE sections ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
CREATE TABLE section_revisions(section_id TEXT NOT NULL REFERENCES sections(id),revision INTEGER NOT NULL,snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),created_by TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(section_id,revision));
INSERT INTO section_revisions SELECT id,1,json_object('id',id,'name',name,'bounds',json(bounds),'geometry',CASE WHEN geometry IS NULL THEN NULL ELSE json(geometry) END,'kind',kind,'revision',1),'migration',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM sections;
