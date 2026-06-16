-- =============================================================
-- 006_workers_and_units.sql  —  Worker assignments + military units
-- =============================================================

-- Worker assignments for the current placement phase.
-- Workers are derived from control boxes (see realm_worker_capacity view in 005_realms.sql).
-- This table tracks WHERE a realm has placed their available workers each turn.
CREATE TABLE worker_assignments (
  id       UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id UUID     NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  slot_id  UUID     NOT NULL REFERENCES slots(id)  ON DELETE CASCADE,
  game_id  UUID     NOT NULL REFERENCES games(id)  ON DELETE CASCADE,
  turn     SMALLINT NOT NULL,
  UNIQUE (slot_id, turn)    -- only one worker per slot per turn
);

-- Military unit stacks. quantity allows grouping identical units in the same location.
-- Militia is NOT stored here — it's derived at combat resolution from control_boxes.
CREATE TABLE units (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id     UUID     NOT NULL REFERENCES realms(id)          ON DELETE CASCADE,
  unit_type_id UUID     NOT NULL REFERENCES unit_type_config(id),
  region_id    UUID     REFERENCES regions(id) ON DELETE SET NULL,  -- current location; NULL = in transit
  quantity     SMALLINT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row-level security
ALTER TABLE worker_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE units              ENABLE ROW LEVEL SECURITY;

-- Worker assignments: own realm or GM only.
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

-- Units: visible in scouted/controlled regions; own units always visible; GM sees all.
CREATE POLICY "own or gm reads units"
  ON units FOR SELECT
  USING (
    -- own units
    EXISTS (SELECT 1 FROM realms r WHERE r.id = units.realm_id AND r.profile_id = auth.uid())
    OR
    -- GM
    EXISTS (SELECT 1 FROM realms r WHERE r.id = units.realm_id AND is_gm_in_game(r.game_id))
    OR
    -- enemy units in a region the player can see
    (units.region_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM regions rg  -- region RLS already limits what's visible
      WHERE rg.id = units.region_id
    ))
  );

CREATE POLICY "gm writes units"
  ON units FOR ALL
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = units.realm_id AND is_gm_in_game(r.game_id))
  );
