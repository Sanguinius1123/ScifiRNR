-- =============================================================
-- 003_map.sql  —  Galaxy → System → Body → Region → Slot
-- =============================================================

-- Hex nodes on the main galaxy map. Axial coordinates (q, r).
CREATE TABLE systems (
  id      UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID     NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name    TEXT     NOT NULL,
  hex_q   SMALLINT NOT NULL,
  hex_r   SMALLINT NOT NULL,
  UNIQUE (game_id, hex_q, hex_r)
);

-- Planets, moons, asteroid belts, dyson spheres, etc. within a system.
CREATE TABLE celestial_bodies (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id   UUID     NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  name        TEXT     NOT NULL,
  body_type   TEXT     NOT NULL,  -- 'planet', 'moon', 'asteroid_belt', 'dyson_sphere', ...
  orbit_order SMALLINT             -- display ordering within the system panel
);

-- Grid cells on a celestial body. Most bodies = 1 region (grid_x=0, grid_y=0).
-- Larger bodies (major planets, dyson spheres) get a proper grid.
CREATE TABLE regions (
  id      UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  body_id UUID     NOT NULL REFERENCES celestial_bodies(id) ON DELETE CASCADE,
  name    TEXT,
  grid_x  SMALLINT NOT NULL DEFAULT 0,
  grid_y  SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (body_id, grid_x, grid_y)
);

-- Individual tiles within a region. Workers are assigned here during placement.
CREATE TABLE slots (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id    UUID     NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  slot_type_id UUID     NOT NULL REFERENCES slot_type_config(id),
  slot_index   SMALLINT NOT NULL,  -- ordering within the region
  UNIQUE (region_id, slot_index)
);

-- Row-level security (fog of war is enforced at the region level and cascades to slots)
ALTER TABLE systems          ENABLE ROW LEVEL SECURITY;
ALTER TABLE celestial_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots            ENABLE ROW LEVEL SECURITY;

-- Helper: is the calling user a GM in the game that owns this system?
-- Used across multiple policies; defined once here.
CREATE OR REPLACE FUNCTION is_gm_in_game(p_game_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM game_participants
    WHERE game_id = p_game_id
      AND profile_id = auth.uid()
      AND role = 'gm'
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

-- Celestial bodies: same visibility as systems.
CREATE POLICY "participants read celestial bodies"
  ON celestial_bodies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM systems s
      JOIN game_participants gp ON gp.game_id = s.game_id
      WHERE s.id = celestial_bodies.system_id AND gp.profile_id = auth.uid()
    )
  );

-- Regions: GMs see all; players see regions they control or have scouted.
-- scouted_regions table is created in 006_fog_of_war.sql; these policies reference it.
CREATE POLICY "gm reads all regions"
  ON regions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM celestial_bodies cb
      JOIN systems s ON s.id = cb.system_id
      WHERE cb.id = regions.body_id AND is_gm_in_game(s.game_id)
    )
  );

CREATE POLICY "players read scouted or controlled regions"
  ON regions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM celestial_bodies cb
      JOIN systems s ON s.id = cb.system_id
      JOIN game_participants gp ON gp.game_id = s.game_id AND gp.profile_id = auth.uid()
      JOIN realms r ON r.game_id = s.game_id AND r.profile_id = auth.uid()
      WHERE cb.id = regions.body_id
        AND (
          -- player has scouted this region
          EXISTS (
            SELECT 1 FROM scouted_regions sr
            WHERE sr.region_id = regions.id AND sr.realm_id = r.id
          )
          OR
          -- player controls at least one box in a settlement here
          EXISTS (
            SELECT 1 FROM settlements st
            JOIN control_boxes cb2 ON cb2.settlement_id = st.id
            WHERE st.region_id = regions.id AND cb2.owner_realm_id = r.id
          )
        )
    )
  );

-- Slots: inherit region visibility (same pattern).
CREATE POLICY "gm reads all slots"
  ON slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM regions rg
      JOIN celestial_bodies cb ON cb.id = rg.body_id
      JOIN systems s ON s.id = cb.system_id
      WHERE rg.id = slots.region_id AND is_gm_in_game(s.game_id)
    )
  );

CREATE POLICY "players read slots in visible regions"
  ON slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM regions rg  -- if the region row is visible to them, so are its slots
      WHERE rg.id = slots.region_id
    )
  );
