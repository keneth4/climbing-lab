ALTER TABLE sections ADD COLUMN geometry TEXT CHECK(geometry IS NULL OR json_valid(geometry));
ALTER TABLE sections ADD COLUMN kind TEXT NOT NULL DEFAULT 'wall' CHECK(kind IN ('wall','accessible-area'));
