-- =============================================================
-- 007_fog_of_war.sql  —  Scouting records + RLS for map tables
-- =============================================================

-- Tracks which realms have scouted which regions, and as of which turn.
-- A scouted region reveals production, garrison size, and control breakdown to that player.
-- Regions a player controls are always visible (via control_boxes) — this table covers
-- regions they've scouted but don't own.
CREATE TABLE scouted_regions (
  id                UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id          UUID     NOT NULL REFERENCES realms(id)  ON DELETE CASCADE,
  region_id         UUID     NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  last_scouted_turn SMALLINT NOT NULL,
  UNIQUE (realm_id, region_id)
);

ALTER TABLE scouted_regions ENABLE ROW LEVEL SECURITY;

-- Players can read and write their own scouting records; GM can read/write all.
CREATE POLICY "own or gm reads scouted regions"
  ON scouted_regions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = scouted_regions.realm_id AND r.profile_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM realms r WHERE r.id = scouted_regions.realm_id AND is_gm_in_game(r.game_id))
  );

CREATE POLICY "gm writes scouted regions"
  ON scouted_regions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM realms r WHERE r.id = scouted_regions.realm_id AND is_gm_in_game(r.game_id))
  );
