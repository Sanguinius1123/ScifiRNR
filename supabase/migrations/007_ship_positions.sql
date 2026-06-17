-- =============================================================
-- 007_ship_positions.sql  —  Ship positioning + ship unit types
-- Ships are not surface units — they occupy a sector hex within
-- a system rather than a region on a body's surface.
-- Ground units: region_id set, system_id/sector_* null.
-- Ships:        system_id + sector_hex_q/r set, region_id null.
-- =============================================================

-- Add ship location columns to units.
ALTER TABLE units
  ADD COLUMN system_id     UUID     REFERENCES systems(id) ON DELETE SET NULL,
  ADD COLUMN sector_hex_q  SMALLINT,
  ADD COLUMN sector_hex_r  SMALLINT;

-- Ship unit types (is_ground_unit = FALSE distinguishes them from troops).
INSERT INTO unit_type_config (name, food_upkeep, energy_upkeep, material_upkeep, is_buildable, is_ground_unit) VALUES
  ('Scout',   0, 1, 0, TRUE, FALSE),
  ('Frigate', 0, 1, 1, TRUE, FALSE),
  ('Cruiser', 0, 2, 1, TRUE, FALSE);
