-- =============================================================
-- 004_settlements.sql  —  Settlements + control boxes
-- =============================================================

-- One settlement per region (for MVP; a region could theoretically hold more later).
CREATE TABLE settlements (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id    UUID     NOT NULL UNIQUE REFERENCES regions(id) ON DELETE CASCADE,
  name         TEXT,
  current_tier SMALLINT NOT NULL DEFAULT 1 REFERENCES settlement_tier_config(tier),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per individual control box.
-- box_index is 0-based; max valid index = settlement_tier_config.control_boxes - 1.
-- owner_realm_id NULL means the box is neutral/unclaimed.
CREATE TABLE control_boxes (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id  UUID     NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  box_index      SMALLINT NOT NULL,
  owner_realm_id UUID     REFERENCES realms(id) ON DELETE SET NULL,
  UNIQUE (settlement_id, box_index)
);

-- Row-level security
ALTER TABLE settlements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_boxes ENABLE ROW LEVEL SECURITY;

-- Settlements: visible wherever the region is visible (RLS on regions already gates this).
CREATE POLICY "gm reads all settlements"
  ON settlements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM regions rg
      JOIN celestial_bodies cb ON cb.id = rg.body_id
      JOIN systems s ON s.id = cb.system_id
      WHERE rg.id = settlements.region_id AND is_gm_in_game(s.game_id)
    )
  );

CREATE POLICY "players read settlements in visible regions"
  ON settlements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM regions rg
      WHERE rg.id = settlements.region_id
      -- relies on region-level RLS already filtering what regions are visible
    )
  );

-- Control boxes: same visibility as their settlement.
-- Ownership info (who holds each box) is visible only in visible settlements.
CREATE POLICY "gm reads all control boxes"
  ON control_boxes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM settlements st
      JOIN regions rg ON rg.id = st.region_id
      JOIN celestial_bodies cb ON cb.id = rg.body_id
      JOIN systems s ON s.id = cb.system_id
      WHERE st.id = control_boxes.settlement_id AND is_gm_in_game(s.game_id)
    )
  );

CREATE POLICY "players read control boxes in visible settlements"
  ON control_boxes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM settlements st
      WHERE st.id = control_boxes.settlement_id
    )
  );

-- GM can write control boxes directly (dashboard editing).
CREATE POLICY "gm writes control boxes"
  ON control_boxes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM settlements st
      JOIN regions rg ON rg.id = st.region_id
      JOIN celestial_bodies cb ON cb.id = rg.body_id
      JOIN systems s ON s.id = cb.system_id
      WHERE st.id = control_boxes.settlement_id AND is_gm_in_game(s.game_id)
    )
  );
