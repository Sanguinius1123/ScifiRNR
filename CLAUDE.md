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
| Frontend | React + Vite | Role-based views: GM dashboard, Player portal, Observer view |
| Hosting | Render (backend) + Vercel (frontend) | Both free tiers; Supabase handles DB |

VS Code is the chosen editor (not Visual Studio — this is a JS stack, not C#).

## Deployed URLs

- **Frontend:** https://scifi-rnr.vercel.app
- **Backend:** https://scifirnr.onrender.com
- **Database:** Supabase project `wykjghsddaedzqvvlgjn`

Note: Render free tier spins down after 15 min idle — first request after sleep takes ~30s.

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
- [x] Supabase project setup (project created, migrations applied)
- [x] Node/Express backend scaffold + deployed to Render
- [x] React frontend scaffold + deployed to Vercel
- [x] Auth flow (sign up / sign in / role assignment via GM whitelist)
- [x] Player realm sheet UI (resources, influence, workers, territory)
- [x] GM dashboard UI (player list, configure starting positions, realm overview)
- [x] Galaxy map (hex grid, system drill-down, body surface regions)
- [x] Ship positioning (units with system_id + sector coords)
- [x] Player Config Modal (starting position, settlement control, resources, units tabs)
- [x] Double-click navigation on hex map (enter system/body; double-click background to zoom out)
- [x] Left ships panel in body/region view
- [x] Inline renaming (systems, bodies, regions, settlements) with plurality-control auth
- [x] Stable hex grid layout (CSS grid — panels no longer shift the hex)
- [ ] Fog of war frontend wiring (RLS exists at DB layer; frontend not yet filtering)
- [ ] Turn resolution / economic calculation
- [ ] Combat system

## Key design decisions already locked in

Do not re-litigate these unless the user raises them:

- **Influence** is not a stockpile — it's a derived value recalculated each turn from
  control boxes owned. Stored as a view (`realm_influence`), not a column.
- **Workers** derived from control boxes: `floor(boxes_owned_in_that_settlement / 3)`.
  Per-settlement — owning 1 or 2 boxes in a settlement yields no worker (dormant, self-sufficient).
  The `realm_worker_capacity` view implements this correctly.
- **Militia** derived from control boxes at the moment combat resolves: `floor(boxes / 3)`
  per stakeholder. Not recruited, not stored — calculated live.
- **Energy** is a spent-per-turn budget (not a stockpile) — unspent energy is lost each
  turn unless the player has built storage infrastructure.
- **Settlement tiers** (1–5): Colony / Town / City / Metropolis / Megalopolis.
  control_boxes = n(n+1)/2, production_slots = tier-1, food_upkeep = (tier-1)*2.
- **Garrison discount:** flat −1 food upkeep per unit stationed in a controlled settlement.
- **Trade goods** are produced in named categories (set by GM per campaign), tracked per
  type in `realm_trade_goods`. Each settlement consumes max 1 unit/type/turn; surplus
  is structurally guaranteed to force trade.
- **Schema is dynamic by design:** tunable values (tier stats, unit upkeep, slot types)
  live in config lookup tables. Changing a game value = UPDATE row, not schema migration.
- **"Body"** is the conversational shorthand for any celestial body (planet, moon,
  asteroid belt, space station, dyson sphere, etc.). Schema table stays `celestial_bodies`.
- **Hex grids everywhere.** System map AND region grids within worlds both use axial hex
  coordinates (`hex_q`, `hex_r`). Pointy-top hexagons.
- **Territorial projection:** plurality holder of a settlement projects control onto adjacent
  regions. Tier 1–3 = power 1 at range 1. Tier 4–5 = power 2 at range 1, power 1 at range 2.
  Highest power wins contested regions; ties = neutral. Partial influence does not project.
- **Fog of war (binary for now):** Full visibility from plurality control + projected regions,
  and from military units in a region. Partial visibility (region visible on map, detail TBD)
  from any control boxes (non-plurality) in a settlement. Ships give visibility below them.
  Scouting units/structures give adjacent visibility (range TBD). Active visibility is
  **derived at query time**, not stored — `scouted_regions` is historical only.
- **Turn structure:** Placement (start of week) → 7 daily action steps → Economic resolution
  (end of week). Each daily step allows military movement or one round of battle.
  Multi-day battles and sieges are intentional. Scouting resolves per-day.
- **Turn resolution trigger:** automatic weekly timer. GM can pause or advance early via
  dashboard. `games.current_phase` schema will need a `current_day SMALLINT` column (1–7)
  when combat is built — not needed for MVP.
- **Subversion base costs:** 2 influence for an unenforced box, 4 for an enforced box.
  Troop enforcement is **1:1** — one troop protects one control box. Per-turn escalation:
  +1 for the 2nd box taken in a settlement that turn, +2 for the 3rd, etc. (Other cost
  factors — tier scaling, neutral discount, incumbent advantage — are still TBD.)
- **Ship positioning:** Ships (Scout, Frigate, Cruiser) are units with `system_id`,
  `sector_hex_q`, `sector_hex_r` instead of `region_id`. Ground units use `region_id`.
- **Sector label = primary body:** When multiple bodies share a hex (e.g. planet + moon),
  the body with the lowest `orbit_order` is the sector's display name.
- **Inline renaming auth:** GM can rename anything. Players can rename settlements, regions,
  bodies, and systems where their realm holds plurality control. Server enforces via
  `PATCH /api/map/{systems|bodies|regions|settlements}/:id` endpoints.

## Database schema overview

```
supabase/migrations/
  001_config.sql              — settlement_tier_config, unit_type_config, slot_type_config, trade_good_types
  002_auth_and_games.sql      — gm_whitelist, profiles, games, game_participants, handle_new_user trigger
  003_map.sql                 — systems (hex), celestial_bodies, regions, slots, is_gm_in_game() helper, RLS
  004_settlements_and_realms.sql — settlements, control_boxes, realms, realm_resources, realm_trade_goods,
                                   realm_influence view, realm_worker_capacity view, RLS
  005_units_and_fog.sql       — worker_assignments, units (ground + ships), scouted_regions, fog-of-war RLS
  006_seed_dev.sql            — dev galaxy: Sol Prime + Vega Reach, 3 bodies, 5 regions, 3 settlements
  007_ship_positions.sql      — adds system_id/sector_hex_q/sector_hex_r to units; Scout/Frigate/Cruiser types
```

RLS is enabled on all game-state tables. The helper function `is_gm_in_game(game_id)` is
defined in `003_map.sql` and used across most policy definitions. Region/slot RLS uses
direct inline joins (not the helper) to avoid SECURITY DEFINER + auth.uid() conflicts.

## Key frontend components

```
client/src/
  components/
    HexGrid.jsx         — SVG hex renderer (pointy-top, axial coords). Props: hexes, onSelect,
                          onDoubleClick, onBackgroundDoubleClick. Double-click hex to enter;
                          double-click SVG background to zoom out.
    HexMap.jsx          — Full map UI: galaxy → system → body drill-down. Uses CSS grid
                          (TWO_COL_GRID / THREE_COL_GRID) so hex never shifts when panels open.
                          Props: gameId, initialSystemId, isGM, userRealmId.
    RegionPanel.jsx     — Region detail: settlement, control boxes, militia, slots, units.
                          Supports inline renaming for GM and controlling realm.
    InlineEdit.jsx      — Click-to-rename component. canEdit prop gates visibility;
                          onSave(name) returns {error} or null.
    PlayerConfigModal.jsx — 4-tab GM modal: Starting Position, Settlement Control, Resources, Units.
  pages/
    GMDashboard.jsx     — GM view: HexMap (isGM=true), player list, PlayerConfigModal
    PlayerPortal.jsx    — Player view: realm sheet, HexMap (userRealmId=realm.id)
    GameList.jsx        — Game selection / creation
    Login.jsx           — Auth (sign in / register with REGISTRATION_CODE)
```

## Key server routes

```
server/src/routes/
  auth.js      — POST /api/auth/register, POST /api/auth/login
  games.js     — CRUD for games, participants, settlements list
  map.js       — GET  /api/map/:gameId/systems
                 GET  /api/map/systems/:id/summary
                 GET  /api/map/systems/:id/ships
                 GET  /api/map/bodies/:id/regions
                 GET  /api/map/regions/:id
                 PATCH /api/map/systems|bodies|regions|settlements/:id  (rename, auth enforced)
  realms.js    — GET/PATCH realm data
  gm.js        — GM-only: unit management, settlement control assignment, resource editing
```

## PostgREST deep-nesting gotcha

Supabase PostgREST fails with 5+ levels of nested joins. All complex queries use flat
parallel queries instead (fetch parent, fetch children separately, join in JS). See
`map.js` for examples.
