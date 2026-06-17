-- =============================================================
-- 003_map.sql  —  Galaxy → System → Body → Region → Slot
-- All grids use axial hex coordinates (hex_q, hex_r).
-- "Body" is the conversational shorthand for any celestial body.
-- =============================================================

-- Hex nodes on the main galaxy map.
CREATE TABLE systems (
  id      UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID     NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name    TEXT     NOT NULL,
  hex_q   SMALLINT NOT NULL,
  hex_r   SMALLINT NOT NULL,
  UNIQUE (game_id, hex_q, hex_r)
);

-- Planets, moons, asteroid belts, dyson spheres, space stations, etc.
-- hex_q/hex_r position the body within its system's 7-hex display grid.
-- Bodies sharing the same hex (e.g. a planet and its moon) have the same coordinates.
CREATE TABLE celestial_bodies (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id   UUID     NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  name        TEXT     NOT NULL,
  body_type   TEXT     NOT NULL,  -- 'star', 'planet', 'moon', 'asteroid_belt', 'dyson_sphere', 'space_station'
  orbit_order SMALLINT,           -- display ordering within the system panel
  hex_q       SMALLINT NOT NULL DEFAULT 0,
  hex_r       SMALLINT NOT NULL DEFAULT 0
);

-- Hex grid cells on a body's surface.
-- Single-region bodies use the default (0, 0). Larger bodies get a multi-hex grid.
CREATE TABLE regions (
  id      UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  body_id UUID     NOT NULL REFERENCES celestial_bodies(id) ON DELETE CASCADE,
  name    TEXT,
  hex_q   SMALLINT NOT NULL DEFAULT 0,
  hex_r   SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (body_id, hex_q, hex_r)
);

-- Individual resource tiles and production slots within a region.
-- Workers are assigned to slots during the placement phase.
CREATE TABLE slots (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id    UUID     NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  slot_type_id UUID     NOT NULL REFERENCES slot_type_config(id),
  slot_index   SMALLINT NOT NULL,
  UNIQUE (region_id, slot_index)
);

-- Row-level security
ALTER TABLE systems          ENABLE ROW LEVEL SECURITY;
ALTER TABLE celestial_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots            ENABLE ROW LEVEL SECURITY;

-- Helper: is the calling user a GM in the given game?
-- Used by settlement, realm, and unit policies where SECURITY DEFINER is safe.
CREATE OR REPLACE FUNCTION is_gm_in_game(p_game_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM game_participants
    WHERE game_id   = p_game_id
      AND profile_id = auth.uid()
      AND role       = 'gm'
  );
$$;

-- Systems: visible to all game participants (fog of war is at region level, not system level).
CREATE POLICY "participants read systems"
  ON systems FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM game_participants
      WHERE game_id = systems.game_id AND profile_id = auth.uid()
    )
  );

-- Celestial bodies: same visibility as their system.
CREATE POLICY "participants read celestial bodies"
  ON celestial_bodies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM systems s
      JOIN game_participants gp ON gp.game_id = s.game_id
      WHERE s.id = celestial_bodies.system_id AND gp.profile_id = auth.uid()
    )
  );

-- Regions — GM policy uses a direct inline join (not is_gm_in_game) because
-- SECURITY DEFINER prevents auth.uid() from resolving correctly inside that function
-- when called from within a region-level policy context.
CREATE POLICY "gm reads all regions"
  ON regions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM celestial_bodies cb
      JOIN systems s ON s.id = cb.system_id
      JOIN game_participants gp ON gp.game_id = s.game_id
      WHERE cb.id = regions.body_id
        AND gp.profile_id = auth.uid()
        AND gp.role = 'gm'
    )
  );

-- Player region visibility is defined in 005_units_and_fog.sql after scouted_regions,
-- realms, settlements, and control_boxes all exist.

-- Slots — same inline-join pattern for the same reason.
CREATE POLICY "gm reads all slots"
  ON slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM regions rg
      JOIN celestial_bodies cb ON cb.id = rg.body_id
      JOIN systems s ON s.id = cb.system_id
      JOIN game_participants gp ON gp.game_id = s.game_id
      WHERE rg.id = slots.region_id
        AND gp.profile_id = auth.uid()
        AND gp.role = 'gm'
    )
  );

CREATE POLICY "players read slots in visible regions"
  ON slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM regions rg
      WHERE rg.id = slots.region_id
    )
  );
