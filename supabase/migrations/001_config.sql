-- =============================================================
-- 001_config.sql  —  Tunable lookup tables
-- Changing game values = UPDATE rows, not schema changes.
-- =============================================================

-- Settlement tier stats (control_boxes follows n(n+1)/2, production_slots = tier-1, food_upkeep = (tier-1)*2)
CREATE TABLE settlement_tier_config (
  tier              SMALLINT PRIMARY KEY,
  name              TEXT        NOT NULL,
  control_boxes     SMALLINT    NOT NULL,
  production_slots  SMALLINT    NOT NULL,
  food_upkeep       SMALLINT    NOT NULL
);

INSERT INTO settlement_tier_config (tier, name, control_boxes, production_slots, food_upkeep) VALUES
  (1, 'Colony',      1,  0, 0),
  (2, 'Town',        3,  1, 2),
  (3, 'City',        6,  2, 4),
  (4, 'Metropolis', 10,  3, 6),
  (5, 'Capital',    15,  4, 8);

-- Unit upkeep costs. is_buildable = false for militia (derived, never recruited).
CREATE TABLE unit_type_config (
  id               UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT     NOT NULL UNIQUE,
  food_upkeep      SMALLINT NOT NULL DEFAULT 0,
  energy_upkeep    SMALLINT NOT NULL DEFAULT 0,
  material_upkeep  SMALLINT NOT NULL DEFAULT 0,
  is_buildable     BOOLEAN  NOT NULL DEFAULT TRUE,
  is_ground_unit   BOOLEAN  NOT NULL DEFAULT TRUE
);

INSERT INTO unit_type_config (name, food_upkeep, energy_upkeep, material_upkeep, is_buildable, is_ground_unit) VALUES
  ('Militia',    0, 0, 0, FALSE, TRUE),
  ('Standard',   1, 0, 0, TRUE,  TRUE),
  ('Mechanized', 1, 1, 0, TRUE,  TRUE),
  ('Artillery',  0, 1, 1, TRUE,  TRUE);

-- Slot types that can appear within a region.
CREATE TABLE slot_type_config (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT    NOT NULL UNIQUE,
  is_resource_tile   BOOLEAN NOT NULL,
  is_production_slot BOOLEAN NOT NULL
);

INSERT INTO slot_type_config (name, is_resource_tile, is_production_slot) VALUES
  ('food_tile',       TRUE,  FALSE),
  ('material_tile',   TRUE,  FALSE),
  ('strategic_tile',  TRUE,  FALSE),
  ('energy_tile',     TRUE,  FALSE),
  ('production_slot', FALSE, TRUE);

-- Trade good categories. GM adds rows here when setting up a game.
-- Each settlement production slot can produce one type; each realm can consume 1/type/turn.
CREATE TABLE trade_good_types (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);
