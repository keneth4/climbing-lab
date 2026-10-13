ALTER TABLE entries ADD COLUMN entry_version INTEGER NOT NULL DEFAULT 1 CHECK(entry_version>0);
ALTER TABLE entries ADD COLUMN deleted_at TEXT;
CREATE TABLE entry_history(entry_id TEXT NOT NULL REFERENCES entries(id),version INTEGER NOT NULL,snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),action TEXT NOT NULL CHECK(action IN ('baseline','created','updated','deleted')),actor TEXT NOT NULL,changed_at TEXT NOT NULL,PRIMARY KEY(entry_id,version));
INSERT INTO entry_history SELECT id,1,json_object('id',id,'routeId',route_id,'routeRevision',revision,'attempts',attempts,'result',result,'notes',notes,'createdAt',created_at,'deletedAt',NULL,'entryVersion',1),'baseline',user_id,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM entries;
