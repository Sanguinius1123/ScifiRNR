---
name: project-design-session2
description: Design decisions locked in session 2 — turn structure, subversion costs, worker confirmation, turn resolution
metadata:
  type: project
---

Session 2 (2026-06-16) locked the following design decisions (all recorded in DESIGN.md, REASONING_LOG.md, CLAUDE.md):

**Turn structure revised:** Placement (start of week) → 7 daily action steps → Economic resolution (end of week). Each day allows military movement or one round of battle. Multi-day battles/sieges intended. Prior design had a single vague "action phase."

**Why:** Scouting and reaction need to be actionable within the week, not just arrive at the same time as the combat result they were meant to inform.

**How to apply:** When building combat or movement UI, think in terms of daily steps not weekly batches. Schema will eventually need `current_day SMALLINT` on the `games` table — not MVP.

**Turn resolution:** Automatic weekly timer. GM can pause or advance early via dashboard.

**Subversion costs:** 2 (unenforced) / 4 (enforced). Troop enforcement is 1:1 (one troop = one protected box). Per-turn escalation: +1 for 2nd box, +2 for 3rd, etc. in same settlement same turn. Other modifiers (tier scaling, neutral discount, incumbent advantage) still TBD.

**Workers confirmed:** Settlement-specific, floor(boxes_owned/3) per realm per settlement. Existing `realm_worker_capacity` view is correct. No schema changes needed.
