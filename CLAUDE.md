# ScifiRNR — Claude Context

This file is read automatically by Claude Code at the start of every session.
Update it as the project evolves so any machine picks up where we left off.

## What we're building

**Realms and Rulers** (working title) — a GM-run async 4X/TTRPG hybrid web app.
Players lead realms competing for political dominance via economics, military, and diplomacy.
One turn = one real week. Player negotiation happens on Discord; a web portal handles all
game state, calculations, and visualization.

Full game design: see `DESIGN.md`.
Design reasoning / decision history: see `REASONING_LOG.md`.

## Tech stack (decided)

| Layer | Choice | Reason |
|---|---|---|
| Database | PostgreSQL via Supabase | Built-in auth + RLS for fog-of-war enforcement at data layer |
| Backend | Node.js + Express | Same JS as frontend; later hosts the discord.js bot in the same process |
| Frontend | React | Role-based views: GM dashboard, Player portal, Observer view |
| Hosting | Render (free tier) or Railway (~$5/mo) | Decided later; Supabase handles DB either way |

VS Code is the chosen editor (not Visual Studio — this is a JS stack, not C#).

## MVP scope

**In:** Auth with roles (GM / Player / Observer), minimal galaxy map, player realm sheet
(6 resources + influence + workers), fog of war enforced at the Supabase RLS layer,
GM dashboard (full visibility + direct edit + neutral faction assignment).

**Explicitly out of MVP:** Combat resolution logic, trade table mechanics, Discord bot,
full influence subversion formula, ship/fleet mechanics, council/voting system.

## Current progress

- [x] `DESIGN.md` — full game design document
- [x] `REASONING_LOG.md` — design decision history
- [x] `supabase/migrations/` — complete database schema (7 migrations + 1 dev seed)
- [ ] Supabase project setup (create project, run migrations)
- [ ] Node/Express backend scaffold
- [ ] React frontend scaffold
- [ ] Auth flow (sign up / sign in / role assignment)
- [ ] Player realm sheet UI
- [ ] GM dashboard UI
- [ ] Fog of war wiring (RLS policies + frontend)

## Key design decisions already locked in

Do not re-litigate these unless the user raises them:

- **Influence** is not a stockpile — it's a derived value recalculated each turn from
  control boxes owned. Stored as a view (`realm_influence`), not a column.
- **Workers** derived from control boxes: `floor(boxes_owned_per_stack / 3)`.
  A "stack" only yields a worker if one realm owns ALL 3 boxes in it.
- **Militia** derived from control boxes at the moment combat resolves: `floor(boxes / 3)`
  per stakeholder. Not recruited, not stored — calculated live.
- **Energy** is a spent-per-turn budget (not a stockpile) — unspent energy is lost each
  turn unless the player has built storage infrastructure.
- **Settlement tiers** (1–5): Colony / Town / City / Metropolis / Capital.
  control_boxes = n(n+1)/2, production_slots = tier-1, food_upkeep = (tier-1)*2.
- **Garrison discount:** flat −1 food upkeep per unit stationed in a controlled settlement.
- **Trade goods** are produced in named categories (set by GM per campaign), tracked per
  type in `realm_trade_goods`. Each settlement consumes max 1 unit/type/turn; surplus
  is structurally guaranteed to force trade.
- **Schema is dynamic by design:** tunable values (tier stats, unit upkeep, slot types)
  live in config lookup tables. Changing a game value = UPDATE row, not schema migration.

## Database schema overview

```
supabase/migrations/
  001_config.sql           — settlement_tier_config, unit_type_config, slot_type_config, trade_good_types
  002_game_and_profiles.sql — profiles (extends auth.users), games, game_participants
  003_map.sql              — systems (hex), celestial_bodies, regions, slots + fog-of-war RLS
  004_settlements.sql      — settlements, control_boxes (one row per box)
  005_realms.sql           — realms, realm_resources, realm_trade_goods, realm_influence view, realm_worker_capacity view
  006_workers_and_units.sql — worker_assignments, units
  007_fog_of_war.sql       — scouted_regions + RLS policies
  008_seed_dev.sql         — tiny dev galaxy (2 systems, 3 bodies, 3 regions, 3 settlements)
```

RLS is enabled on all game-state tables. The helper function `is_gm_in_game(game_id)` is
defined in `003_map.sql` and used across all policy definitions.
