-- =============================================================
-- 005_realms.sql  —  Realms, resources, trade goods
-- =============================================================

-- A realm is one player's empire within a game.
CREATE TABLE realms (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id    UUID        NOT NULL REFERENCES games(id)    ON DELETE CASCADE,
  profile_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  color      TEXT,                    -- hex color for map display (#rrggbb)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, profile_id)
);

-- Stockpiled resources (food, energy, materials, strategic_materials, igc).
-- Influence is NOT stored here — it is derived each turn from control_boxes (see views below).
-- One row per resource type per realm; amount can never go below 0.
CREATE TABLE realm_resources (
  id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id UUID    NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  resource TEXT    NOT NULL CHECK (resource IN ('food','energy','materials','strategic_materials','igc')),
  amount   INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  UNIQUE (realm_id, resource)
);

-- Trade goods are tracked per type since each type is produced/consumed independently.
CREATE TABLE realm_trade_goods (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id            UUID    NOT NULL REFERENCES realms(id)          ON DELETE CASCADE,
  trade_good_type_id  UUID    NOT NULL REFERENCES trade_good_types(id) ON DELETE CASCADE,
  amount              INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  UNIQUE (realm_id, trade_good_type_id)
);

-- Derived view: influence per realm = total control boxes currently owned across all settlements.
-- No transaction history needed — recalculated fresh each turn.
CREATE OR REPLACE VIEW realm_influence AS
SELECT
  r.id   AS realm_id,
  r.name AS realm_name,
  r.game_id,
  COUNT(cb.id) AS influence
FROM realms r
LEFT JOIN control_boxes cb ON cb.owner_realm_id = r.id
GROUP BY r.id, r.name, r.game_id;

-- Derived view: worker capacity per realm per settlement stack.
-- A "stack" is a group of 3 boxes in a settlement. floor(boxes_owned / 3) = workers available.
-- Workers are only usable if a single realm owns ALL boxes in that stack.
CREATE OR REPLACE VIEW realm_worker_capacity AS
SELECT
  cb.owner_realm_id AS realm_id,
  cb.settlement_id,
  FLOOR(COUNT(cb.id)::NUMERIC / 3) AS workers_available
FROM control_boxes cb
WHERE cb.owner_realm_id IS NOT NULL
GROUP BY cb.owner_realm_id, cb.settlement_id
HAVING COUNT(cb.id) % 3 = 0                        -- only full stacks of 3 yield a worker
   OR  COUNT(cb.id) >= 3;                           -- (let floor() handle the partial trimming)

-- Row-level security
ALTER TABLE realms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE realm_resources    ENABLE ROW LEVEL SECURITY;
ALTER TABLE realm_trade_goods  ENABLE ROW LEVEL SECURITY;

-- Realms: all participants can see realm names/colors (needed for the map).
CREATE POLICY "participants read realm identities"
  ON realms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM game_participants gp
      WHERE gp.game_id = realms.game_id AND gp.profile_id = auth.uid()
    )
  );

-- Resource details: only own realm or GM.
CREATE POLICY "own or gm reads realm resources"
  ON realm_resources FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = realm_resources.realm_id AND r.profile_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM realms r WHERE r.id = realm_resources.realm_id AND is_gm_in_game(r.game_id)
    )
  );

CREATE POLICY "own or gm reads trade goods"
  ON realm_trade_goods FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = realm_trade_goods.realm_id AND r.profile_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM realms r WHERE r.id = realm_trade_goods.realm_id AND is_gm_in_game(r.game_id)
    )
  );

-- GM write access for dashboard editing.
CREATE POLICY "gm writes realm resources"
  ON realm_resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM realms r WHERE r.id = realm_resources.realm_id AND is_gm_in_game(r.game_id)
    )
  );

CREATE POLICY "gm writes trade goods"
  ON realm_trade_goods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM realms r WHERE r.id = realm_trade_goods.realm_id AND is_gm_in_game(r.game_id)
    )
  );
