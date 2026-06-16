-- =============================================================
-- 008_seed_dev.sql  —  Minimal dev/test galaxy
-- Run this AFTER all other migrations to populate a playable starting state.
-- Safe to re-run by deleting the seeded game first.
-- =============================================================

-- Example trade good types (add/remove freely)
INSERT INTO trade_good_types (name) VALUES
  ('Fuel Cells'),
  ('Rare Earth Composites'),
  ('Luxury Goods'),
  ('Biotech Compounds')
ON CONFLICT (name) DO NOTHING;

-- A test game
INSERT INTO games (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Dev Campaign')
ON CONFLICT DO NOTHING;

-- Two systems on a tiny hex grid
INSERT INTO systems (id, game_id, name, hex_q, hex_r) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Sol Prime', 0, 0),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Vega Reach', 1, 0)
ON CONFLICT DO NOTHING;

-- A couple of bodies per system
INSERT INTO celestial_bodies (id, system_id, name, body_type, orbit_order) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Helio III', 'planet', 1),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Ash Moon',  'moon',   2),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Vega Prime','planet', 1)
ON CONFLICT DO NOTHING;

-- One region per body (single-region bodies = grid 0,0)
INSERT INTO regions (id, body_id, name, grid_x, grid_y) VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Northern Basin',  0, 0),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Crater Flats',    0, 0),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Equatorial Plain', 0, 0)
ON CONFLICT DO NOTHING;

-- A few slots per region (mix of resource tiles + 1 production slot each)
-- Using subqueries to resolve slot_type_config ids by name
INSERT INTO slots (region_id, slot_type_id, slot_index)
SELECT '30000000-0000-0000-0000-000000000001', id, 0 FROM slot_type_config WHERE name = 'food_tile'
ON CONFLICT DO NOTHING;
INSERT INTO slots (region_id, slot_type_id, slot_index)
SELECT '30000000-0000-0000-0000-000000000001', id, 1 FROM slot_type_config WHERE name = 'material_tile'
ON CONFLICT DO NOTHING;
INSERT INTO slots (region_id, slot_type_id, slot_index)
SELECT '30000000-0000-0000-0000-000000000001', id, 2 FROM slot_type_config WHERE name = 'production_slot'
ON CONFLICT DO NOTHING;

INSERT INTO slots (region_id, slot_type_id, slot_index)
SELECT '30000000-0000-0000-0000-000000000002', id, 0 FROM slot_type_config WHERE name = 'energy_tile'
ON CONFLICT DO NOTHING;
INSERT INTO slots (region_id, slot_type_id, slot_index)
SELECT '30000000-0000-0000-0000-000000000002', id, 1 FROM slot_type_config WHERE name = 'strategic_tile'
ON CONFLICT DO NOTHING;

INSERT INTO slots (region_id, slot_type_id, slot_index)
SELECT '30000000-0000-0000-0000-000000000003', id, 0 FROM slot_type_config WHERE name = 'food_tile'
ON CONFLICT DO NOTHING;
INSERT INTO slots (region_id, slot_type_id, slot_index)
SELECT '30000000-0000-0000-0000-000000000003', id, 1 FROM slot_type_config WHERE name = 'production_slot'
ON CONFLICT DO NOTHING;

-- Settlements (one per region for the seed)
INSERT INTO settlements (id, region_id, name, current_tier) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Port Helio', 2),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Ash Outpost', 1),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'Vega Landing', 1)
ON CONFLICT DO NOTHING;

-- Control boxes for seeded settlements (all neutral to start)
-- Port Helio = tier 2 = 3 boxes
INSERT INTO control_boxes (settlement_id, box_index, owner_realm_id) VALUES
  ('40000000-0000-0000-0000-000000000001', 0, NULL),
  ('40000000-0000-0000-0000-000000000001', 1, NULL),
  ('40000000-0000-0000-0000-000000000001', 2, NULL)
ON CONFLICT DO NOTHING;

-- Ash Outpost = tier 1 = 1 box
INSERT INTO control_boxes (settlement_id, box_index, owner_realm_id) VALUES
  ('40000000-0000-0000-0000-000000000002', 0, NULL)
ON CONFLICT DO NOTHING;

-- Vega Landing = tier 1 = 1 box
INSERT INTO control_boxes (settlement_id, box_index, owner_realm_id) VALUES
  ('40000000-0000-0000-0000-000000000003', 0, NULL)
ON CONFLICT DO NOTHING;
