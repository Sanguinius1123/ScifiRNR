-- =============================================================
-- 005_units_and_fog.sql  —  Workers, military units, fog of war
-- =============================================================

-- Worker placement for the current turn.
-- Workers are derived from control_boxes (see realm_worker_capacity view).
-- This table tracks WHERE a realm has placed their workers each turn.
CREATE TABLE worker_assignments (
  id       UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id UUID     NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  slot_id  UUID     NOT NULL REFERENCES slots(id)  ON DELETE CASCADE,
  game_id  UUID     NOT NULL REFERENCES games(id)  ON DELETE CASCADE,
  turn     SMALLINT NOT NULL,
  UNIQUE (slot_id, turn)
);

-- Military unit stacks. Militia is NOT stored here — derived at combat resolution
-- from control_boxes: floor(realm_boxes_in_settlement / 3) per realm.
CREATE TABLE units (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id     UUID     NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  unit_type_id UUID     NOT NULL REFERENCES unit_type_config(id),
  region_id    UUID     REFERENCES regions(id) ON DELETE SET NULL,  -- NULL = in transit
  quantity     SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historical scouting records. Tracks which realms have scouted which regions and when.
-- A scouted region reveals production, garrison size, and control breakdown to that realm.
-- Regions a player controls are always visible via control_boxes — this covers scout-only access.
CREATE TABLE scouted_regions (
  id                UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id          UUID     NOT NULL REFERENCES realms(id)  ON DELETE CASCADE,
  region_id         UUID     NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  last_scouted_turn SMALLINT NOT NULL,
  UNIQUE (realm_id, region_id)
);

-- Row-level security
ALTER TABLE worker_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE units              ENABLE ROW LEVEL SECURITY;
ALTER TABLE scouted_regions    ENABLE ROW LEVEL SECURITY;

-- Player region visibility — defined here because it references scouted_regions,
-- realms, settlements, and control_boxes, all of which now exist.
CREATE POLICY "players read scouted or controlled regions"
  ON regions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM celestial_bodies cb
      JOIN systems s ON s.id = cb.system_id
      JOIN realms r ON r.game_id = s.game_id AND r.profile_id = auth.uid()
      WHERE cb.id = regions.body_id
        AND (
          EXISTS (
            SELECT 1 FROM scouted_regions sr
            WHERE sr.region_id = regions.id AND sr.realm_id = r.id
          )
          OR
          EXISTS (
            SELECT 1 FROM settlements st
            JOIN control_boxes cb2 ON cb2.settlement_id = st.id
            WHERE st.region_id = regions.id AND cb2.owner_realm_id = r.id
          )
        )
    )
  );

-- Worker assignments: own realm or GM.
CREATE POLICY "own or gm reads worker assignments"
  ON worker_assignments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = worker_assignments.realm_id AND r.profile_id = auth.uid())
    OR is_gm_in_game(worker_assignments.game_id)
  );

CREATE POLICY "own realm writes worker assignments"
  ON worker_assignments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = worker_assignments.realm_id AND r.profile_id = auth.uid())
  );

CREATE POLICY "own realm updates worker assignments"
  ON worker_assignments FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = worker_assignments.realm_id AND r.profile_id = auth.uid())
  );

CREATE POLICY "gm writes worker assignments"
  ON worker_assignments FOR ALL
  USING (is_gm_in_game(worker_assignments.game_id));

-- Units: own units always visible; enemy units visible in regions the player can see; GM sees all.
CREATE POLICY "own or gm reads units"
  ON units FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = units.realm_id AND r.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM realms r WHERE r.id = units.realm_id AND is_gm_in_game(r.game_id))
    OR (units.region_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM regions rg WHERE rg.id = units.region_id
    ))
  );

CREATE POLICY "gm writes units"
  ON units FOR ALL
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = units.realm_id AND is_gm_in_game(r.game_id))
  );

-- Scouted regions: own realm or GM.
CREATE POLICY "own or gm reads scouted regions"
  ON scouted_regions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = scouted_regions.realm_id AND r.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM realms r WHERE r.id = scouted_regions.realm_id AND is_gm_in_game(r.game_id))
  );

CREATE POLICY "gm writes scouted regions"
  ON scouted_regions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = scouted_regions.realm_id AND is_gm_in_game(r.game_id))
  );
