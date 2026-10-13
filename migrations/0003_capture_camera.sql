ALTER TABLE captures ADD COLUMN initial_camera TEXT CHECK(initial_camera IS NULL OR json_valid(initial_camera));
