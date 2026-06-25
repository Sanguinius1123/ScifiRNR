# Realms and Rulers — Game Design Document

Working title. Name will likely change once theme/setting is finalized. Designed as a setting-agnostic core ruleset (sci-fi version documented here first; fantasy/modern variants reuse the same engine with reskinned units and map elements).

## Status

This document reflects design decisions as of the most recent design conversation. Numeric values (costs, ratios, thresholds) are explicitly called out as **tunable** where the designer has flagged them as likely to change after playtesting. Treat this doc as a living reference, not a frozen spec.

---

## 1. Core Concept

Each player acts as a leader (emperor, president, warlord, etc.) over people and territory, competing for ultimate political power (king/emperor/ruler) or collective power (a council seat) while managing economic development, military conflict, trade, and diplomacy with other players.

A GM runs the game, injects narrative/story elements, manages external threats (barbarians, aliens, monsters depending on setting), and adjudicates anything the system doesn't resolve automatically.

**Core tension:** players compete against each other, but excessive infighting weakens the group against external threats. Victory can come from military dominance, political consolidation (becoming the recognized ruler), or coalition-building (council/president path).

**Play structure:** asynchronous, primarily via Discord for player communication/negotiation, with a web portal handling all game state, calculations, and visualization. One turn = one real-world week, giving players time to scheme, negotiate, and plan between resolution points.

---

## 2. Roles

- **GM** — full visibility into all game state, can edit any value directly (bug fixes, roleplay adjustments, narrative events), manages neutral factions and external threats. Multiple GMs supported as the game scales.
- **Player** — controls a realm/empire. Sees their own full data, plus whatever they've scouted of the wider map (fog of war).
- **Observer** — can view (likely a restricted/spectator view) but not act.
- **Freelancer / Hero** *(future feature, not in MVP)* — a smaller-scale player archetype with influence/mechanical presence but not a full realm. Roleplay-driven.

---

## 3. Map Structure

Hierarchical, four levels deep:

```
Galaxy/Sector
 └─ System (hex on the main map)
     └─ Body (planet, moon, asteroid belt, space station, dyson sphere, etc.)
         └─ Region (hex grid; most bodies = 1 region; large bodies = multiple)
             └─ Slots (resource-producing tiles, or settlement production slots)
```

**Terminology:** The generic shorthand for any celestial body — planet, moon, asteroid belt, space station, dyson sphere — is **"body"**. The schema table is `celestial_bodies`. Bodies within a system are distinct inhabitable/controllable locations; their specific type is shown as a label (e.g. `Helio III · Planet`).

**Hex grids everywhere.** Both the system-level map and the region grid within each body use axial hex coordinates (`hex_q`, `hex_r`). No square grids are used at any level.

Most bodies have a single region. Larger/more significant bodies (major planets, dyson spheres) have multiple regions on a hex grid. Each region contains a limited number of slots: resource tiles (food, materials, strategic materials, energy) or settlement production slots.

### 3.1 Territory & Fog of War

**Territory** is the set of regions a realm controls without necessarily having a settlement in each one. A settlement's control projects outward across the hex regions of its world based on tier:

- **Tier 1–3:** projects at range 1 (all immediately adjacent hex regions) with **power 1**
- **Tier 4–5:** projects at range 1 with **power 2**, and range 2 with **power 1**

When two settlements owned by different players both project onto the same region, the higher projection power wins. Ties go neutral:

| Situation | Outcome |
|---|---|
| Only one player projects | That player controls the region |
| Same player, multiple settlements | That player controls it |
| Both project power 1 (any tier, same range) | Neutral |
| Tier 4–5 at range 1 (power 2) vs. tier 1–3 at range 1 (power 1) | Tier 4–5 player wins |
| Tier 4–5 at range 2 (power 1) vs. tier 1–3 at range 1 (power 1) | Neutral — tied power |

**Requirement to project:** a player must hold **plurality of control boxes** in a settlement for it to project territory. Partial influence does not project.

**Fog of war** has three visibility states:

- **Visible** — full live detail: settlement name/tier, control boxes, units stationed, production slots
- **Scouted** (previously seen, not currently visible) — settlement existence shown on map at last-known position, but no live detail. Info does not update until you regain visibility.
- **Dark** — hex is black, nothing shown, not even that a settlement exists

| Visibility source | What it reveals |
|---|---|
| Plurality control of a settlement | Full visibility of that region + projected territory |
| Military units stationed in a region | Full visibility of that region + all adjacent regions |
| Any control boxes (non-plurality) | Region appears on map (scouted state at minimum) |
| Scout / specialist units | Extended range — adjacent regions (exact range TBD per unit type) |
| Ship in a system sector | Full visibility of ALL surface regions on the body in that sector |
| Previously scouted, no current source | Scouted state — settlement existence only, frozen info |
| Never seen | Dark |

**Active visibility is derived, not stored.** The `scouted_regions` table records which regions a realm has ever seen. Current visibility is computed at query time from control boxes, unit positions, and ship positions. Losing all visibility sources causes a region to drop back to scouted state (not dark — you still know it exists).

**Stealth (future mechanic):** Certain units (scout ships, stealth ships) are not automatically visible to enemies with line of sight. Each turn a detection roll is made — pass means the unit appears on enemy maps, fail means it stays hidden. This is explicitly out of MVP scope but the visibility model is designed to support it.

**Unit orders & movement:** Players issue movement orders by selecting a unit and assigning a destination. Orders are queued and resolve simultaneously for all players at the daily action step. Edge case: if two hostile forces swap zones in the same turn (A moves to B's region while B moves to A's region), they do not simply pass through — a **meeting engagement** triggers at the border between the two zones. Exact resolution TBD when the combat system is built.

---

## 4. Turn Structure

One turn = one real week. Each week has three phases:

1. **Placement phase** (start of week) — players assign all workers to slots: resource tiles (food, materials, energy, strategic) or settlement production slots. Also declare production orders (trade goods, new units, structures).

2. **Action phase** — seven daily action steps, one per day of the week.
   - Each day, military units may **move** (based on their mobility) or enact **one round of battle** in their current location.
   - Multi-day battles are possible — a siege may take several days. Players observe enemy movements and can react before the next daily step.
   - Scouting resolves per-day, giving fog-of-war updates players can act on within the same week.
   - Diplomacy and trade (via Discord) happens throughout the week; deals can be struck any time before economic resolution.

3. **Economic resolution** (end of week) — processes in this order:
   1. Resources collected from worker assignments (based on post-battle control)
   2. Trade/diplomacy deals finalize
   3. Products complete — trade goods, new military units, structures
   4. Upkeep paid (food/energy/materials per unit and settlement)
   5. Settlement growth/decay evaluated
   6. Energy budget resets — unspent energy is lost (unless player has storage infrastructure)
   7. Influence recalculated fresh from current control boxes

**Turn resolution trigger:** automatic on a weekly timer. The GM can pause the timer (e.g., a player is unavailable) or advance it early if all players are ready. GM dashboard provides full control over the timer.

**Combat loss consequences:** losing a region means no production from it that turn, possible worker injury, and the attacker may loot the region — extracting some resources while damaging built-up infrastructure. Developed regions are more valuable but more fragile targets, reinforcing the expansion-vs-development tension.

---

## 5. Resources

Six economic resources, plus Influence as a separate political resource.

| Resource | Role | Notes |
|---|---|---|
| **Food** | Sustains population/workers/cities. The economic governor. | Free to produce (worker on a food tile costs no upkeep). Bounds expansion — overextending cities/workers without enough food production causes problems. |
| **Energy** | The "action fuel" — spent per turn on production, unit upkeep, trade good logistics, and moving military/workers between systems. | Per-turn budget, not a stockpile — unspent energy is **lost** at end of turn unless the player has built storage infrastructure (expensive). Produced via a worker-staffed power plant; output becomes available the *following* turn (one-turn delay). |
| **Materials** | Basic construction/production input. | Worker on a mine tile, costs 1 food upkeep, yields some amount. |
| **Strategic materials** | Rare, high-value version of materials, gates advanced production. | Same mechanic as materials, lower yield/rarer tiles. |
| **Trade goods** | Liquid diplomatic value; produced in defined categories (set list of types, not generic). | Produced via settlement production slots (not region tiles). A production batch always yields more than 1 unit. Each settlement can only **consume 1 unit per type per turn** for its own population — everything beyond that is automatically surplus, intended for trade. This forces specialization and makes trade structurally necessary, not optional. |
| **IGC (Intergalactic Credits)** | Universal currency, generated through trade. | Downstream of actual productive activity — not a passive income stream. |
| **Influence** | Political capital. Not accrued/stockpiled — a fresh snapshot each turn based on current settlement control. Spent on council votes, treaty leverage, subverting rivals' control, bribing NPC/foreign factions. | See Section 7 (Influence & Control) for full mechanic. |

### Worker placement (unifying mechanic)

A single worker pool, placed during the Placement phase, can go to:
- A **resource tile** (food, materials, strategic materials, energy) in a region
- A **settlement production slot** (trade goods, military units, ships)

Same pool, same phase, different destinations. This is the single core economic decision point of the game.

---

## 6. Settlements

### Size tiers

Five tiers (1–5): **Colony → Town → City → Metropolis → Megalopolis**.

| Tier | Control boxes (influence slots) | Production slots | Settlement upkeep (food/turn) | Notes |
|---|---|---|---|---|
| 1 (Colony) | 1 | 0 | 0 | Cannot produce trade goods/units. Cheap to take, cheap to lose. Easy to flip control. |
| 2 (Town) | 3 | 1 | 2 | |
| 3 (City) | 6 | 2 | 4 | |
| 4 (Metropolis) | 10 | 3 | 6 | |
| 5 (Megalopolis) | 15 | 4 | 8 | |

### Capital designation

**Capital** is not a tier — it is a player-assigned tag marking their seat of power, stored as `realms.capital_settlement_id`. A player can designate any settlement they control as their Capital, regardless of tier. The Capital receives bonuses (exact values TBD via playtesting) to worker output, resource production, and influence pressure to maintain control. If a player loses plurality control of their Capital, the bonuses are lost until they retake it or designate a new one.

**Control box formula:** triangular numbers — `n(n+1)/2` for tier n. **Production slot formula:** `tier - 1`. **Settlement upkeep formula:** `(tier - 1) × 2` food.

### Workers from settlements

Cities provide workers based on size (exact count tunable, tied to size tier). Workers, like militia (see Section 8), are **derived from settlement control**, not recruited/built — and like militia, are split proportionally by influence share among contenders.

A worker-providing "stack" only produces a usable worker if a single player holds **all** boxes in that stack (e.g. all 3 boxes of a size-3 chunk). If split across multiple owners/neutral, no one gets the worker and no one owes upkeep for it — the slot sits dormant and self-sufficient.

A rival who gains enough influence share to claim a worker (full ownership of a 3-box stack) can deploy that worker:
- For free, anywhere on the **same celestial body**
- For an **energy cost** (transport/"gas"), anywhere else they control (different body or system)

### Upkeep responsibility

Settlement upkeep cost is split among influence stakeholders proportional to their control share. If you fail to pay your share, that portion of your influence in that settlement goes **neutral** (cheap for anyone to contest), rather than some other penalty — tying economic failure directly to political consequence.

**Garrison discount:** any unit stationed in a settlement you control gets a flat **−1 food** upkeep discount (food only):
- Standard units (1 food, 0 energy) — fully covered, free to garrison
- Mechanized (1 food, 1 energy) — food covered, energy still owed
- Artillery (0 food, 1 energy + 1 material) — no food component, no benefit from the discount
- Ships — cannot be stationed in a settlement, discount never applies

### Settlement decay & growth

- **Decay:** if a neutral, unpaid-upkeep control box stays unpaid, the settlement gets a **warning turn**, then downgrades one tier the following turn if still unresolved.
- **Growth:** costs that tier's upkeep value again in food, **plus an equal amount of materials and energy** (tunable — flagged as likely needing adjustment after playtesting, given the constrained food economy).

---

## 7. Influence & Control

Influence is **not a stockpiled currency** — it's a recalculated-each-turn measure of political sway, generated from settlement control across the game.

### Control boxes

Every settlement has a fixed number of **control boxes** based on tier (see table in Section 6: 1/3/6/10/15). Each box is claimed by exactly one entity: a player, a neutral/unclaimed state, or potentially a rebel/unrest faction or foreign power.

- Whoever holds the **plurality of boxes** in a settlement is its de facto ruler (unless overridden by military occupation/coup — see below).
- **Influence generated per turn = total control boxes owned across all settlements in the game**, for that player.
- A tier 1 colony (1 box) is binary — whoever holds the box rules it outright, easy to flip.
- A tier 5 capital (15 boxes) is much harder to fully dominate — a player can hold a strong plurality and still face real internal rivals.

### Gaining/flipping control boxes

Boxes can be flipped via:
1. **Influence subversion** — spending influence to bribe/sway a box toward you. Cost factors:
   - Settlement tier (bigger settlement = higher base cost per box) — *exact scaling TBD*
   - Whether the box is neutral (cheap) or held by another player — *exact discount TBD*
   - **Incumbent stabilizing force** — the current plurality holder's boxes are "stickier" — *exact modifier TBD*
   - **Troop enforcement** — see formula below
   - **Per-turn escalation** — see formula below
2. **Military occupation/conquest** — direct seizure via force.
3. **Neutral settlement competition** — newly spawned/revolted colonies can become a free-for-all: blind influence bidding, a race to garrison troops, or outright invasion. GM-driven as a narrative event.

**Subversion cost formula (decided):**

| Box state | Base influence cost |
|---|---|
| Unenforced (no troop protecting this box) | 2 |
| Enforced (a troop is assigned to this box) | 4 |

**Troop enforcement — 1:1 ratio:** each troop stationed in a settlement enforces exactly one of that player's control boxes. A player with 5 troops defending 9 boxes has 5 enforced and 4 unenforced. The attacker chooses which boxes to target, but enforced boxes always cost 4.

**Per-turn escalation:** taking multiple boxes from the same settlement in one turn adds a stacking surcharge — +0 for the 1st box, +1 for the 2nd, +2 for the 3rd, etc. This makes rapid political seizures disproportionately expensive vs. patient one-box-per-turn campaigns.

*Example:* a capital (15 boxes) where Ruler A holds 9 boxes with 5 troops. Attacker takes 2 boxes:
- 2 unenforced boxes: 2 + (2+1) = **5 influence**
- 1 unenforced + 1 enforced: 2 + (4+1) = **7 influence**
- 2 enforced boxes: 4 + (4+1) = **9 influence**

### Upkeep tied to control

See Section 6 — settlement upkeep is owed proportionally by influence stakeholders, and failure to pay flips your share to neutral.

---

## 8. Militia (Derived Defense Force)

Militia is **not built or recruited** — it is automatically derived from settlement control, recalculated at the moment a conflict is resolved.

**Formula:** for every 3 influence boxes a stakeholder holds in a settlement, they get **1 militia** (`floor(boxes / 3)`). Leftover boxes below the next multiple of 3 produce no militia — that portion "sits out."

- Militia follows **control, not formal ownership** — it represents population loyalty to whoever currently holds sway, not loyalty to a flag.
- If a usurper's influence share grows enough to flip plurality, the militia's loyalty flips with it automatically — no invasion needed. This creates a distinct failure state: being subverted out from under yourself.
- **Multi-party combat:** if three+ players each hold meaningful influence in a contested settlement, a conflict can resolve as a genuine multi-faction militia battle, layered under whatever standing military forces are also present.
- Militia loyalty/split is calculated **at the moment a conflict resolves** during the resolution phase (not continuously live), giving players the full action-phase week to see the political situation developing and react (reinforce, negotiate, abandon) before the actual fight is calculated.

---

## 9. Military Units

### Ground forces

| Unit | Food upkeep | Energy upkeep | Material upkeep | Role |
|---|---|---|---|---|
| **Militia** | — (derived, see Sec. 8) | — | — | Automatic, population-based defense. Not built. |
| **Standard** | 1 | 0 | 0 | Cheapest, best for holding ground. Garrison-friendly (upkeep fully covered when stationed in owned settlement). |
| **Mechanized** | 1 | 1 | 0 | Stronger, mobile. Mobility matters only on multi-region celestial bodies. Garrison discount covers food only. |
| **Artillery** | 0 | 1 | 1 | Weaker on defense, higher attack, can strike other regions without moving in (ranged support), can also fire on ships in-system. Low manpower (no food cost), no garrison benefit. |

All ground units have **per-turn upkeep**, paid in the resolution phase like settlement upkeep. Units in foreign/uncontrolled territory always pay full cost (no garrison discount applies outside friendly settlements).

### Space forces (ships)

Not yet detailed — flagged for a future design pass. Ships cannot be "stationed" inside a settlement for upkeep-discount purposes (they're system/orbital assets, not ground garrison).

---

## 10. Trade & Diplomacy

A shared trade table (visible to relevant parties) where players propose and negotiate deals. The system facilitates but does **not enforce** non-material terms — the GM records agreements but relies on players to honor (or break) them.

Trade table entries can include:
- Material goods (resources, trade good surplus)
- Territory
- IGC
- Non-material terms: proclamations, promises, contracts, alliances, non-aggression pacts, military support agreements

This is intentionally flexible — the table is a negotiation/record surface, not a rules-enforced contract system.

---

## 11. Open Questions / Not Yet Designed

- Exact ship/fleet mechanics and space combat resolution
- Combat resolution math in general (how attack/defense values translate to outcomes)
- The council/voting system mechanics (how influence translates to votes, what laws/treaties can be voted on)
- City building/infrastructure beyond the base production slots (blacksmiths, specialty trade good buildings mentioned as a concept — workers as "artisans" consuming food + another resource to produce specialty items)
- Exact worker count granted per settlement tier
- Exact troop-to-control-box protection ratio
- Settlement growth cost balancing
- Freelancer/Hero player type (mechanics deferred)
- Whether NPC/foreign powers can hold third-party control box claims in a player's settlement (raised, not resolved)

---

## 12. Technical Architecture (MVP)

**Goal of MVP:** prove the full stack works end to end — auth with roles, multi-user state, fog-of-war-correct data access, GM override tools — before deep game-logic (combat, trade resolution) is built out.

- **Database:** PostgreSQL via Supabase. Relational structure fits the data naturally (systems → bodies → regions → slots → workers; players → resources/territories). Supabase also provides built-in auth and row-level security, which can enforce fog of war at the data layer rather than just hiding it in the UI.
- **Backend/API:** Node.js + Express. Thin API layer between frontend and database. Designed to later host the Discord bot (`discord.js`) in the same service, sharing the same database — so end-of-turn resolution can trigger automatic Discord announcements.
- **Frontend:** React. Role-based views: GM dashboard, Player portal, Observer view.
- **Hosting:** Railway or Render (simple Node deployment, free tier available, persistent DB support).

### MVP scope

**In scope:**
- Auth with roles (GM, Player, Observer; schema allows for future Freelancer)
- A minimal galaxy: a few systems, a couple celestial bodies each, small region grids
- Player realm sheet: all 6 resources + influence, workers, basic territory list
- Fog of war enforced at the data layer: players see only their own region details + control status of scouted regions
- GM dashboard: full visibility into all player data, direct edit capability (bug fixes / roleplay adjustments), neutral faction assignment

**Explicitly out of scope for MVP:**
- Combat resolution logic
- Trade table mechanics
- Discord bot (schema supports it, but not built yet)
- Full influence/control box subversion math (data field stubbed, full mechanic not implemented)

---

## 13. Multi-Setting Vision

The core ruleset (territory, workers, resources, conflict, diplomacy, influence/control) is designed to be setting-agnostic. The same engine could support:
- **Sci-fi** (documented above — systems, planets, IGC, ships)
- **Fantasy** (kingdoms, provinces, gold, armies/knights instead of fleets)
- **Modern/geopolitical** (nations, regions, currency, conventional military)

Each variant reskins units, map terminology, and flavor while reusing the same core mechanical loop.
