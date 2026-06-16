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

## Tooling decisions (brief)

Stack chosen (React + Node/Express + PostgreSQL via Supabase) was selected specifically because it lets the same language (JavaScript) span the web frontend, backend, and a future Discord bot (`discord.js`), and because Supabase's row-level security can enforce fog of war at the database layer rather than relying on the UI to hide things correctly.

VS Code (not classic Visual Studio) was chosen for this specific project despite the designer's existing comfort with Visual Studio for C# work, on the reasoning that VS Code is the standard tool for the JS/React/Node stack this project actually uses, and that a desktop-app version of the game later (if wanted) would most likely be an Electron/Tauri wrapper around the same React code — not a reason to switch to a native C# build, since the multi-user/remote-login/Discord-integrated architecture the designer actually wants doesn't fit a single-machine native app model anyway.
