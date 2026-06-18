# Design Reasoning Log — Realms and Rulers

This is a condensed record of *how* the decisions in DESIGN.md were reached — the alternatives considered, the reasoning behind specific numbers, and things explicitly left open. Read DESIGN.md first for the authoritative current rules; use this log for context on *why*.

---

## Origin & core concept

The designer wanted a non-traditional TTRPG: each player leads a realm (people + territory), with economic decisions, conflict/war, and trade/diplomacy between players — closer to a 4X strategy game run by a GM than a typical tabletop RPG. Setting is flexible (sci-fi, fantasy, modern); sci-fi was used as the first fully fleshed-out version.

The designer had gone back and forth between making the game too complex vs too simple. The resolution: let the *rules* be reasonably complex, but use a digital UI + spreadsheet-style backend to absorb that complexity so players experience clean decisions, not raw math (compared to how Wingspan's bird feeder dial handles scoring math invisibly).

**Play model settled on:** Discord for player communication/negotiation (keeps the social, human layer intact), a web app for all state tracking and calculation. GM-run, not self-governing — the GM adjudicates edge cases and injects story/external threats, so the UI's job is to support the GM, not replace judgment.

## Map structure

Settled hierarchy: **system (hex) → celestial body → region grid → slots**. Most bodies have one region; large/significant bodies (major planets, dyson spheres) get multiple regions. This came directly from the designer's existing notes rather than being derived from scratch.

Fog of war was identified early as a layered problem, not a single toggle — there's a difference between seeing a territory exists, seeing what's being produced there, seeing garrison size, and seeing military movement. Production being hidden by default (revealed only via scouting) was the designer's explicit call, since it's a major diplomatic lever (hiding intentions).

## Turn structure

Weekly async turns were chosen specifically because the game runs over Discord — players need time during the week to scheme/negotiate, then a single resolution moment where everything (especially military movement) happens simultaneously. Patrol/auto-defense orders were added specifically to solve the "what if no one's online when attacked" problem inherent to async weekly play.

Resolution order (scout → trade locks → military moves → combat → production → upkeep) was worked out because of an edge case the designer flagged directly: you should *not* collect production from a region you just lost in combat that round. That ordering constraint is what locked in the final sequence.

## Resources

The six-resource list (food, energy, materials, strategic materials, trade goods, IGC) was given by the designer essentially as a starting point, then each one's actual mechanic was clarified individually across the conversation:

- **Food** was explained as existing specifically to prevent the "economic runaway" problem common in strategy games — it's a deliberate brake on expansion, not just flavor.
- **Energy** went through a real design pivot: initially ambiguous, then clarified as a *spent-per-turn budget* (like gas/fuel), not a stockpile — unspent energy is lost each turn unless the player invests in storage infrastructure. This created a clean two-throttle economy (food gates population, energy gates *activity*) and made energy storage a genuine strategic investment choice, trading off against other expansion spending.
- **Trade goods** got their defining mechanic late in the conversation: each settlement can only consume 1 unit of a given trade good type per turn, regardless of how many are produced, and production batches always yield more than 1. This was the designer's idea specifically to force trade to be *necessary* rather than optional — surplus isn't a bonus, it's structurally guaranteed, and the only choice is whether you find a buyer.
- **Influence** was added as an afterthought late in the conversation (the designer said "I also wanted to touch on another resource I had thought about, but forgot to mention"), but turned out to be one of the most load-bearing systems once developed. It's explicitly *not* a stockpiled currency — it's a recalculated-each-turn snapshot of political sway, which is a meaningfully different data model than the other five resources (no transaction history needed, just a derived value).

## Settlements & control boxes

The designer's own city notes (pasted mid-conversation) raised an open question about size granularity — should settlements have 4, 6, 8, or 10 size tiers? The reasoning that settled on **5 tiers**: each tier should represent a legible, narratively meaningful step (outpost → town → city → metropolis → capital), and more tiers risks size becoming "a number nobody thinks about" rather than a clear identity. The designer agreed and noted tiers could be subdivided later if granularity issues show up in playtesting.

The **control box** mechanic (1/3/6/10/15 boxes per tier) was the designer's own proposal, and it was noted in conversation that this sequence is the triangular number formula `n(n+1)/2` — not chosen for that mathematical reason, but a nice side effect: each tier doesn't just add a flat amount of control, it adds a disproportionately bigger chunk, mirroring how a bigger settlement is genuinely harder to fully dominate, not just "bigger."

A key thematic point that emerged from discussion: a capital being the hardest settlement to fully control (most boxes, hardest to dominate) means a player's seat of power is *also* their biggest internal political vulnerability — lots of boxes for rivals to chip away at. This wasn't pre-planned, it fell out of the math once box counts were assigned.

### Subversion cost curve

The designer specified several inputs to the cost-of-flipping-a-box formula in sequence: settlement tier, neutral-vs-held discount, escalating cost per additional box already held (a soft cap on total domination), an "incumbent stabilizing force" defending the current ruler, and a military presence modifier. The exact formula combining these was left as a structure, not a finalized equation — explicitly meant to be tuned via playtesting rather than calculated theoretically.

A specific design question was raised and resolved: should military presence be a *binary gate* (no troops = can't attempt subversion at all) or a *continuous modifier* (always possible, just cheaper/faster with troops)? This was identified as a major lever for political-vs-military game balance but was **not resolved** — flagged as an open decision in DESIGN.md.

### Military as a protective floor

This was a genuine refinement during conversation. Initially military presence was just "a modifier" on subversion cost. The designer then specified a more precise version: troops create a hard floor of boxes that *cannot* be flipped by influence alone, scaled to troop count (e.g., 5 armies in a 15-box capital locks 5 boxes regardless of influence spent), while remaining boxes stay contestable. This two-layer defense (hard floor + soft incumbent advantage) was the designer's own synthesis once asked to clarify how the scalar relationship should work. The exact troop-to-box ratio was explicitly left untuned.

## Militia

The most significant emergent idea in the whole design process: militia isn't built or recruited, it's **derived from influence control**, recalculated at the moment of combat. The designer asked the open question themselves mid-conversation — "would militia fight for the usurper if they have 3 influence against the holder's 12?" — and answered it in the same message with the proportional split rule (`floor(boxes / 3)` per stakeholder).

The framing that crystallized this as more than a math rule: militia represents population loyalty to whoever currently holds real sway, not loyalty to a flag or formal owner. This creates a failure state distinct from conquest — being politically subverted out of your own garrison without a single shot fired. This was explicitly called out in conversation as "genuinely scary" and a deliberate emergent threat, not just a side effect.

The timing question (does militia loyalty update live, or lock at combat resolution) was resolved in favor of **locking at the moment combat resolves**, specifically so players have the full week to notice a developing political threat and react (reinforce, negotiate, abandon) rather than getting blindsided by an invisible mid-week flip.

## Worker placement & theft

Workers were unified with the militia model once the parallel was drawn explicitly: like militia, workers are derived from settlement size/control, not recruited, and like militia, they're split proportionally by influence share — meaning a rival with enough influence in your settlement can literally skim usable workers from your labor pool, not just chip at your political control.

A clarifying question about partial influence stakes (what happens with a 3-box stack split 1/1/1 across three parties, or 1 player + 1 neutral) was resolved as: nobody gets the worker, nobody pays upkeep, the slot is simply dormant — self-sufficient but useless to everyone. This was important because it meant fragmented influence has a real, asymmetric cost (lost productivity for everyone, not a transferable benefit to whoever holds the most).

The worker relocation cost (free on the same celestial body, energy-cost elsewhere) was the designer's direct extension of the "energy = transport/gas" framing established earlier for ships and trade goods — applying the same fuel logic consistently across the system rather than introducing a new resource sink.

## Settlement upkeep & decay

The upkeep formula `(tier - 1) × 2` was proposed by the designer with an explicit worked example (capital = 8 food), and the AI verified the formula was internally consistent with that example before moving on.

The link between unpaid upkeep and influence (rather than some other penalty like instant loss of the settlement) was the designer's own choice, reasoning that it should tie economic failure back into the political layer they'd already built, rather than introducing a separate punishment mechanic. This was noted as an elegant piece of systemic consistency once stated.

The **warning-turn-then-decay** mechanic for unresolved unpaid upkeep was added when the designer asked directly whether decay should be instant or telegraphed — and concluded a warning turn is better, since it avoids a single bad week silently wrecking a capital and gives the GM a dramatic story beat to work with.

Settlement growth cost (tier's upkeep value again, in food + matching materials + energy) was proposed by the designer with an explicit caveat that it's a placeholder likely needing adjustment given how constrained the food economy already is. This is preserved as an open/tunable item in DESIGN.md rather than treated as settled.

## Military unit upkeep

The garrison discount mechanic went through one real correction. The AI's first restatement assumed a "free upkeep up to N units" model; the designer corrected this to the actual intended rule — a **flat −1 food discount per unit**, applying to any unit type stationed in a controlled settlement, with the unit's own food/energy/material composition determining how much benefit it actually gets. This produced a clean emergent identity: standard units (pure food cost) get full benefit and are the natural cheap garrison choice, mechanized get partial benefit, artillery and ships get none — without needing unit-specific special-case rules.

## Trade & diplomacy table

The designer was explicit from early in the conversation that the trade table should be a **negotiation/record surface, not a rules-enforced contract system** — players decide what goes into a deal (goods, territory, proclamations, promises, contracts), and the system displays/tracks it without trying to mechanically enforce non-material terms. This was treated as a deliberate design choice (preserving human diplomacy and trust/betrayal dynamics) rather than a limitation to fix later.

## Why an MVP, and what's in/out of it

The designer wanted to validate the riskiest *technical* unknowns (auth, role-based access, fog-of-war-correct data exposure, GM override capability) before investing further in refining game rules that are still evolving (combat math, trade resolution, the council/voting system). The explicit reasoning: rules can keep changing without invalidating the underlying plumbing, but if the plumbing itself doesn't work (can players actually log in and see only what they should see?), nothing else matters.

This is why combat resolution, the trade table's actual mechanics, and the full influence-subversion formula were deliberately scoped *out* of the MVP even though they're designed on paper — they're game-logic-heavy and likely to keep changing, whereas auth/roles/fog-of-war/GM-tools are comparatively stable, foundational, and equally necessary regardless of which rules version ends up shipping.

## Turn structure — daily action steps (session 2)

The original design had a single "action phase" as a vague week-long filler. The designer refined this to **seven discrete daily action steps**, one per real day of the week. The core motivation: military movement and combat resolution happen *per day*, not all at once at the end of the week. This means battles can span multiple days (sieges take longer), players can observe enemy movement and react within the same week, and scouting information is actually actionable rather than arriving at the same time as the combat result it was meant to inform.

The economic resolution remains end-of-week. The placement phase remains start-of-week. So the structure is: **Placement → 7× Daily Action → Economic Resolution**.

Note: the `games.current_phase` schema column currently uses a CHECK constraint of `('placement', 'action', 'resolution')`. Once combat is being built, this will need a `current_day SMALLINT` column (1–7) alongside `current_phase` to track which daily step the game is on.

## Turn resolution trigger (session 2)

Decided: automatic timer (weekly). GM can pause or advance early via dashboard. This preserves the "GM runs the game" philosophy while removing the need for a GM to be online at a fixed time every week. The auto-advance handles the default case; GM control handles exceptions (missing players, story beats, early readiness).

## Subversion cost formula (session 2)

The previously vague "military presence modifier" and "incumbent stabilizing force" were given concrete numbers. The designer walked through a capital scenario (15 boxes: one player holds 9 with 5 troops, two others hold 3 each) to derive:

- **Base cost**: 2 for an unenforced box, 4 for an enforced box.
- **Troop enforcement ratio**: 1:1. One troop protects one box. This resolves the previously open question about the troop-to-box ratio — it is exactly 1:1, not a batch or threshold mechanic.
- **Per-turn escalation**: +0 for the 1st box taken in a settlement that turn, +1 for the 2nd, +2 for the 3rd, etc. This makes rapid consecutive seizures costly relative to patient single-box campaigns, without making slow play mandatory.

Several earlier cost factors (settlement tier scaling, neutral vs. held discount, incumbent advantage) remain as intended modifiers layered on top of the 2/4 base — their exact values are still TBD via playtesting.

## Workers — settlement-specific confirmed (session 2)

Confirmed that workers are **settlement-specific**: `floor(boxes_owned_in_that_settlement / 3)` per realm per settlement. Owning 1 or 2 boxes in a settlement produces no worker — the partial stake is dormant and self-sufficient, but useless. The existing `realm_worker_capacity` view already implements this correctly (GROUP BY realm_id, settlement_id). No schema changes needed.

## Map terminology, hex grids, territory, and fog of war (session 3)

**"Body" as the generic shorthand** for any celestial body was chosen because the game supports planets, moons, asteroid belts, space stations, and dyson spheres — "planet" doesn't fit, "celestial body" is too long for conversation. "Body" is already implied by the schema table name `celestial_bodies`, is neutral enough to cover everything, and feels natural in play ("the bodies in Sol Prime"). The specific body type (Planet, Moon, etc.) appears as a tag in the UI.

**Hex grids everywhere** was the designer's explicit call: hex grids are the right choice for anything above building-level tactical combat. Consistency across the system-level map and the region grid within each world avoids having two different coordinate systems to reason about. Region coordinates renamed from `grid_x/grid_y` to `hex_q/hex_r` in the schema to match the system-level naming.

**Territorial projection model** emerged from the question of what it means to "control" a region that doesn't have a settlement in it. The designer defined it via projection power — tier 1–3 settlements project power 1 at range 1; tier 4–5 project power 2 at range 1 and power 1 at range 2. When multiple settlements from different players project onto the same region, the higher power wins; tied power = neutral. This model handles all the stated cases cleanly without special-casing:
- Two tier 1–3 settlements disputing a shared region → both power 1 → neutral ✓
- Tier 4–5 vs tier 1–3 on adjacent region → power 2 vs power 1 → tier 4–5 wins ✓
- Tier 4–5 at range 2 vs tier 1–3 at range 1 → power 1 vs power 1 → neutral ✓

**Plurality required to project.** Partial influence (non-plurality control boxes) does not project territory. The reasoning: the plurality holder controls the settlement's government, military, and administrative apparatus — that is what projects power outward. A minority stakeholder has influence *inside* the city but not outward command authority.

**Fog of war model:** binary for now (full visibility or dark), with the architecture leaving room for granular information levels later. The key sources of visibility — plurality control, military presence, partial influence, scouting units, ships — were enumerated and locked in. The important technical distinction drawn: *active visibility is derived at query time* from current game state, not stored. The `scouted_regions` table is a historical record, not a live visibility map. A region goes dark the moment you lose all visibility sources in it, regardless of past scouting.

**Partial influence = partial visibility** was added as a deliberate rule: even a minority stake in a settlement (any control boxes) grants the player some line of sight into that settlement's region. The thematic logic: if you have agents and influence embedded in a city, you have eyes there — you know the city exists and something of what's happening, even if you don't run it. The exact detail level visible (just the region on the map, vs. garrison count, vs. production) is left TBD for the scouting/information design pass.

## Tooling decisions (brief)

Stack chosen (React + Node/Express + PostgreSQL via Supabase) was selected specifically because it lets the same language (JavaScript) span the web frontend, backend, and a future Discord bot (`discord.js`), and because Supabase's row-level security can enforce fog of war at the database layer rather than relying on the UI to hide things correctly.

VS Code (not classic Visual Studio) was chosen for this specific project despite the designer's existing comfort with Visual Studio for C# work, on the reasoning that VS Code is the standard tool for the JS/React/Node stack this project actually uses, and that a desktop-app version of the game later (if wanted) would most likely be an Electron/Tauri wrapper around the same React code — not a reason to switch to a native C# build, since the multi-user/remote-login/Discord-integrated architecture the designer actually wants doesn't fit a single-machine native app model anyway.

---

## Session 4 corrections and clarifications

### Settlement tier 5 name: Megalopolis, not Capital

An early edit incorrectly renamed tier 5 to "Capital" on the reasoning that it matched a name in `settlement_tier_config`. This was wrong — the schema and DESIGN.md both had "Megalopolis" all along; the edit introduced a discrepancy. Reverted.

The clarification that prompted this: **"Capital" is a separate concept entirely** — a player-assigned political designation stored as `realms.capital_settlement_id`, marking their seat of power. A Capital can be any settlement the player controls at any tier; it is not a tier name. The naming conflict (tier-5 Megalopolis vs. political Capital) is now resolved by keeping them as distinct terms and ensuring no component uses "Capital" as a tier label.

### Registration gate — everyone needs the code

The original implementation bypassed the registration code requirement for GM-whitelisted emails, on the reasoning that the GM wouldn't need it. The designer corrected this: the registration code should be universal. The `gm_whitelist` table's sole purpose is role assignment — when a new user confirms their email, the `handle_new_user()` DB trigger checks the whitelist and sets `global_role = 'gm'` if matched. These are two independent concerns:
- **Who can register**: anyone with the code.
- **What role they get**: determined by the trigger at email confirmation, not at registration.

This separation also means future GMs can be added simply by adding their email to `gm_whitelist` before they register — no special registration path needed.

### Confirmation email not sending — admin.createUser() bypass

The registration route was using `adminDb.auth.admin.createUser()`, which is a direct admin insert into `auth.users` that bypasses Supabase's auth email pipeline. No confirmation email was sent automatically; it had to be manually triggered from the Supabase dashboard.

Switched to `anonDb.auth.signUp()` (publishable-key client, no user JWT) which goes through the standard Supabase auth flow and sends the confirmation email automatically. All validation (registration code check, required fields) still happens server-side before calling `signUp()`. The user metadata (`username`) is passed identically via `options.data`.

### Simple MapView prototype removed

`MapView.jsx` was an early standalone map page that queried Supabase directly and had a simple galaxy → system → body drill-down. It was superseded by `HexMap.jsx`, which is the full interactive implementation embedded in both `GMDashboard` and `PlayerPortal`. Nothing linked to the `/game/:gameId/map` route it was mounted on. Removed to reduce dead code.
