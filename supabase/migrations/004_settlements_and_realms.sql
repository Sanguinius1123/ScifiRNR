-- =============================================================
-- 004_settlements_and_realms.sql  —  Settlements, realms, derived views
-- =============================================================

-- One settlement per region (MVP constraint; schema allows relaxing later).
CREATE TABLE settlements (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id    UUID        NOT NULL UNIQUE REFERENCES regions(id) ON DELETE CASCADE,
  name         TEXT,
  current_tier SMALLINT    NOT NULL DEFAULT 1 REFERENCES settlement_tier_config(tier),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per individual control box.
-- box_index is 0-based; max valid index = settlement_tier_config.control_boxes - 1.
-- owner_realm_id NULL = neutral/unclaimed. FK to realms added below after that table exists.
CREATE TABLE control_boxes (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id  UUID     NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  box_index      SMALLINT NOT NULL,
  owner_realm_id UUID,
  UNIQUE (settlement_id, box_index)
);

-- A realm is one player's empire within a game.
CREATE TABLE realms (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id               UUID        NOT NULL REFERENCES games(id)    ON DELETE CASCADE,
  profile_id            UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  color                 TEXT,                 -- hex color for map display (#rrggbb)
  description           TEXT,                 -- player-written lore
  capital_settlement_id UUID        REFERENCES settlements(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, profile_id)
);

-- Add FK from control_boxes to realms now that realms exists.
ALTER TABLE control_boxes
  ADD CONSTRAINT control_boxes_owner_realm_id_fkey
  FOREIGN KEY (owner_realm_id) REFERENCES realms(id) ON DELETE SET NULL;

-- Stockpiled resources. Influence is NOT here — it is derived from control_boxes (see view).
CREATE TABLE realm_resources (
  id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id UUID    NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  resource TEXT    NOT NULL CHECK (resource IN ('food','energy','materials','strategic_materials','igc')),
  amount   INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  UNIQUE (realm_id, resource)
);

-- Trade goods tracked per category (produced and consumed independently per type).
CREATE TABLE realm_trade_goods (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id           UUID    NOT NULL REFERENCES realms(id)           ON DELETE CASCADE,
  trade_good_type_id UUID    NOT NULL REFERENCES trade_good_types(id) ON DELETE CASCADE,
  amount             INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  UNIQUE (realm_id, trade_good_type_id)
);

-- Derived: influence per realm = total control boxes owned.
-- Recalculated fresh each turn — not stored.
CREATE OR REPLACE VIEW realm_influence AS
SELECT
  r.id      AS realm_id,
  r.name    AS realm_name,
  r.game_id,
  COUNT(cb.id) AS influence
FROM realms r
LEFT JOIN control_boxes cb ON cb.owner_realm_id = r.id
GROUP BY r.id, r.name, r.game_id;

-- Derived: worker capacity per realm per settlement.
-- floor(boxes_owned / 3) workers available per realm per settlement.
CREATE OR REPLACE VIEW realm_worker_capacity AS
SELECT
  cb.owner_realm_id AS realm_id,
  cb.settlement_id,
  FLOOR(COUNT(cb.id)::NUMERIC / 3) AS workers_available
FROM control_boxes cb
WHERE cb.owner_realm_id IS NOT NULL
GROUP BY cb.owner_realm_id, cb.settlement_id
HAVING COUNT(cb.id) >= 3;

-- Row-level security
ALTER TABLE settlements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_boxes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE realms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE realm_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE realm_trade_goods ENABLE ROW LEVEL SECURITY;

-- Settlements: GM sees all; players see what their region RLS allows.
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
    EXISTS (SELECT 1 FROM regions rg WHERE rg.id = settlements.region_id)
  );

-- Control boxes: same visibility as their settlement.
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
    EXISTS (SELECT 1 FROM settlements st WHERE st.id = control_boxes.settlement_id)
  );

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

-- Realms: all participants can see realm names/colors (needed for the map).
CREATE POLICY "participants read realm identities"
  ON realms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM game_participants gp
      WHERE gp.game_id = realms.game_id AND gp.profile_id = auth.uid()
    )
  );

-- Resources and trade goods: own realm or GM only.
CREATE POLICY "own or gm reads realm resources"
  ON realm_resources FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = realm_resources.realm_id AND r.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM realms r WHERE r.id = realm_resources.realm_id AND is_gm_in_game(r.game_id))
  );

CREATE POLICY "gm writes realm resources"
  ON realm_resources FOR ALL
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = realm_resources.realm_id AND is_gm_in_game(r.game_id))
  );

CREATE POLICY "own or gm reads trade goods"
  ON realm_trade_goods FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = realm_trade_goods.realm_id AND r.profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM realms r WHERE r.id = realm_trade_goods.realm_id AND is_gm_in_game(r.game_id))
  );

CREATE POLICY "gm writes trade goods"
  ON realm_trade_goods FOR ALL
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = realm_trade_goods.realm_id AND is_gm_in_game(r.game_id))
  );
