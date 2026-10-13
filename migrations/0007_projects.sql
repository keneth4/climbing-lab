CREATE TABLE gym_config(id INTEGER PRIMARY KEY CHECK(id=1),name TEXT NOT NULL,currency TEXT NOT NULL DEFAULT 'MXN',timezone TEXT NOT NULL DEFAULT 'America/Mexico_City');
INSERT INTO gym_config(id,name) VALUES(1,'Gimnasio piloto');
CREATE TABLE projects(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,route_id TEXT NOT NULL,route_revision INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('pendiente','completado','archivado')),notes TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(user_id,route_id),FOREIGN KEY(route_id,route_revision) REFERENCES route_revisions(route_id,revision));
CREATE INDEX projects_owner ON projects(user_id,updated_at DESC,id);
CREATE TABLE project_history(project_id TEXT NOT NULL REFERENCES projects(id),version INTEGER NOT NULL,snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),changed_at TEXT NOT NULL,PRIMARY KEY(project_id,version));
