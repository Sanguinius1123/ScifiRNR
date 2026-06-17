import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { adminDb } from '../db.js';

const router = Router();

// GET /api/map/:gameId/systems — lightweight: just systems + bodies for the 7-hex view.
router.get('/:gameId/systems', requireAuth, async (req, res) => {
  const { data, error } = await adminDb
    .from('systems')
    .select('id, name, hex_q, hex_r, celestial_bodies(id, name, body_type, orbit_order, hex_q, hex_r)')
    .eq('game_id', req.params.gameId);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// GET /api/map/systems/:systemId/summary — lazy-loaded detail for the galaxy side panel.
// Runs independent flat queries to avoid deep-nesting failures in PostgREST.
router.get('/systems/:systemId/summary', requireAuth, async (req, res) => {
  const { systemId } = req.params;

  // Get bodies in this system.
  const { data: bodies, error: bErr } = await adminDb
    .from('celestial_bodies')
    .select('id, name, body_type')
    .eq('system_id', systemId);
  if (bErr) return res.status(500).json({ error: bErr.message });

  const bodyIds = (bodies ?? []).map(b => b.id);
  if (bodyIds.length === 0) return res.json({ settlements: [], realms: [] });

  // Get regions for all bodies.
  const { data: regions } = await adminDb
    .from('regions')
    .select('id, body_id')
    .in('body_id', bodyIds);

  const regionIds = (regions ?? []).map(r => r.id);
  const bodyById  = Object.fromEntries((bodies ?? []).map(b => [b.id, b]));
  const regionById = Object.fromEntries((regions ?? []).map(r => [r.id, r]));

  if (regionIds.length === 0) return res.json({ settlements: [], realms: [] });

  // Get settlements + control boxes + realm info.
  const { data: settlements } = await adminDb
    .from('settlements')
    .select('id, name, current_tier, region_id, control_boxes(owner_realm_id, realms(id, name, color))')
    .in('region_id', regionIds);

  // Derive plurality holder per settlement and collect realm presence.
  const realmMap = {};
  const summarySettlements = (settlements ?? []).map(sett => {
    const boxes = sett.control_boxes ?? [];
    const counts = {};
    for (const b of boxes) {
      if (!b.owner_realm_id) continue;
      counts[b.owner_realm_id] ??= { count: 0, realm: b.realms };
      counts[b.owner_realm_id].count++;
    }
    let max = 0, holder = null;
    for (const { count, realm } of Object.values(counts)) {
      if (count > max)        { max = count; holder = realm; }
      else if (count === max) { holder = null; }
    }
    if (holder) {
      realmMap[holder.id] ??= { ...holder, settCount: 0 };
      realmMap[holder.id].settCount++;
    }
    const region = regionById[sett.region_id];
    const body   = region ? bodyById[region.body_id] : null;
    return { name: sett.name, tier: sett.current_tier, bodyName: body?.name ?? '?', holder };
  });

  res.json({ settlements: summarySettlements, realms: Object.values(realmMap) });
});

// GET /api/map/systems/:systemId/ships — ship units grouped by sector hex key "q,r".
// Used by the system view to show ships present in each sector panel.
router.get('/systems/:systemId/ships', requireAuth, async (req, res) => {
  const { data, error } = await adminDb
    .from('units')
    .select('sector_hex_q, sector_hex_r, quantity, unit_type_config(name), realms(id, name, color)')
    .eq('system_id', req.params.systemId)
    .not('sector_hex_q', 'is', null);
  if (error) return res.status(500).json({ error: error.message });

  const bySector = {};
  for (const u of data ?? []) {
    const key = `${u.sector_hex_q},${u.sector_hex_r}`;
    (bySector[key] ??= []).push({
      type:     u.unit_type_config?.name ?? '?',
      quantity: u.quantity,
      realm:    u.realms,
    });
  }
  res.json(bySector);
});

// GET /api/map/bodies/:bodyId/regions
// Regions with settlement + control box data (for fill/border colors in region grid).
router.get('/bodies/:bodyId/regions', requireAuth, async (req, res) => {
  const { data, error } = await adminDb
    .from('regions')
    .select(`
      id, name, hex_q, hex_r,
      settlements(
        id, name, current_tier,
        control_boxes(owner_realm_id, realms(id, name, color))
      )
    `)
    .eq('body_id', req.params.bodyId);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// GET /api/map/regions/:regionId
// Full region detail — uses explicit separate queries to avoid nested join failures.
router.get('/regions/:regionId', requireAuth, async (req, res) => {
  const { regionId } = req.params;

  const [regionRes, slotsRes, settlementsRes] = await Promise.all([
    adminDb.from('regions').select('id, name, hex_q, hex_r').eq('id', regionId).single(),
    adminDb.from('slots').select('id, slot_index, slot_type_config(name)').eq('region_id', regionId).order('slot_index'),
    adminDb.from('settlements').select('id, name, current_tier').eq('region_id', regionId),
  ]);

  if (regionRes.error) return res.status(404).json({ error: 'Region not found' });

  const region = regionRes.data;
  const slots = slotsRes.data ?? [];
  const settlements = settlementsRes.data ?? [];

  // Worker assignments — keyed by slot id.
  const slotIds = slots.map(s => s.id);
  const { data: workers } = slotIds.length
    ? await adminDb.from('worker_assignments').select('slot_id, realm_id, realms(name, color)').in('slot_id', slotIds)
    : { data: [] };
  const workerBySlot = Object.fromEntries((workers ?? []).map(w => [w.slot_id, w]));

  // Attach control boxes + realm info to each settlement.
  const settlementsWithBoxes = await Promise.all(settlements.map(async sett => {
    const { data: boxes } = await adminDb
      .from('control_boxes')
      .select('id, box_index, owner_realm_id, realms(id, name, color)')
      .eq('settlement_id', sett.id)
      .order('box_index');
    return { ...sett, control_boxes: boxes ?? [] };
  }));

  // Ground units stationed in this region.
  const { data: units } = await adminDb
    .from('units')
    .select('quantity, unit_type_config(name, is_ground_unit), realms(id, name, color)')
    .eq('region_id', regionId);

  res.json({
    ...region,
    slots: slots.map(s => ({ ...s, worker: workerBySlot[s.id] ?? null })),
    settlements: settlementsWithBoxes,
    units: (units ?? []).map(u => ({
      type:     u.unit_type_config?.name ?? '?',
      quantity: u.quantity,
      realm:    u.realms,
    })),
  });
});

// ── Rename helpers ───────────────────────────────────────────────────────────

function pluralityWinner(counts) {
  let max = 0, winner = null;
  for (const [id, count] of Object.entries(counts)) {
    if (count > max)        { max = count; winner = id; }
    else if (count === max) { winner = null; }
  }
  return winner;
}

async function isGMInGame(userId, gameId) {
  const { data } = await adminDb.from('game_participants').select('role')
    .eq('game_id', gameId).eq('profile_id', userId).maybeSingle();
  return data?.role === 'gm';
}

async function realmForUser(userId, gameId) {
  const { data } = await adminDb.from('realms').select('id')
    .eq('game_id', gameId).eq('profile_id', userId).maybeSingle();
  return data?.id ?? null;
}

async function settlementController(settlementId) {
  const { data: boxes } = await adminDb.from('control_boxes')
    .select('owner_realm_id').eq('settlement_id', settlementId).not('owner_realm_id', 'is', null);
  const counts = {};
  for (const b of boxes ?? []) counts[b.owner_realm_id] = (counts[b.owner_realm_id] ?? 0) + 1;
  return pluralityWinner(counts);
}

async function bodyController(bodyId) {
  const { data: regions } = await adminDb.from('regions').select('id').eq('body_id', bodyId);
  const regionIds = (regions ?? []).map(r => r.id);
  if (!regionIds.length) return null;
  const { data: settlements } = await adminDb.from('settlements').select('id').in('region_id', regionIds);
  const settIds = (settlements ?? []).map(s => s.id);
  if (!settIds.length) return null;
  const controllers = await Promise.all(settIds.map(settlementController));
  const counts = {};
  for (const c of controllers) if (c) counts[c] = (counts[c] ?? 0) + 1;
  return pluralityWinner(counts);
}

async function systemController(systemId) {
  const { data: bodies } = await adminDb.from('celestial_bodies').select('id').eq('system_id', systemId);
  const bodyIds = (bodies ?? []).map(b => b.id);
  if (!bodyIds.length) return null;
  const controllers = await Promise.all(bodyIds.map(bodyController));
  const counts = {};
  for (const c of controllers) if (c) counts[c] = (counts[c] ?? 0) + 1;
  return pluralityWinner(counts);
}

// ── Rename endpoints ─────────────────────────────────────────────────────────

// PATCH /api/map/systems/:id   { name }
router.patch('/systems/:id', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const { data: sys } = await adminDb.from('systems').select('id, game_id').eq('id', req.params.id).single();
  if (!sys) return res.status(404).json({ error: 'Not found' });
  const gm = await isGMInGame(req.user.id, sys.game_id);
  if (!gm) {
    const rid = await realmForUser(req.user.id, sys.game_id);
    const ctrl = await systemController(req.params.id);
    if (!rid || rid !== ctrl) return res.status(403).json({ error: 'You do not control this system' });
  }
  const { error } = await adminDb.from('systems').update({ name: name.trim() }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// PATCH /api/map/bodies/:id   { name }
router.patch('/bodies/:id', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const { data: body } = await adminDb.from('celestial_bodies').select('id, system_id').eq('id', req.params.id).single();
  if (!body) return res.status(404).json({ error: 'Not found' });
  const { data: sys } = await adminDb.from('systems').select('game_id').eq('id', body.system_id).single();
  const gm = await isGMInGame(req.user.id, sys.game_id);
  if (!gm) {
    const rid = await realmForUser(req.user.id, sys.game_id);
    const ctrl = await bodyController(req.params.id);
    if (!rid || rid !== ctrl) return res.status(403).json({ error: 'You do not control this sector' });
  }
  const { error } = await adminDb.from('celestial_bodies').update({ name: name.trim() }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// PATCH /api/map/regions/:id   { name }
router.patch('/regions/:id', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const { data: region } = await adminDb.from('regions').select('id, body_id').eq('id', req.params.id).single();
  if (!region) return res.status(404).json({ error: 'Not found' });
  const { data: body } = await adminDb.from('celestial_bodies').select('system_id').eq('id', region.body_id).single();
  const { data: sys } = await adminDb.from('systems').select('game_id').eq('id', body.system_id).single();
  const gm = await isGMInGame(req.user.id, sys.game_id);
  if (!gm) {
    const rid = await realmForUser(req.user.id, sys.game_id);
    const { data: sett } = await adminDb.from('settlements').select('id').eq('region_id', req.params.id).maybeSingle();
    if (!sett) return res.status(403).json({ error: 'No settlement in region — control undetermined' });
    const ctrl = await settlementController(sett.id);
    if (!rid || rid !== ctrl) return res.status(403).json({ error: 'You do not control this region' });
  }
  const { error } = await adminDb.from('regions').update({ name: name.trim() }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// PATCH /api/map/settlements/:id   { name }
router.patch('/settlements/:id', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const { data: sett } = await adminDb.from('settlements').select('id, region_id').eq('id', req.params.id).single();
  if (!sett) return res.status(404).json({ error: 'Not found' });
  const { data: region } = await adminDb.from('regions').select('body_id').eq('id', sett.region_id).single();
  const { data: body } = await adminDb.from('celestial_bodies').select('system_id').eq('id', region.body_id).single();
  const { data: sys } = await adminDb.from('systems').select('game_id').eq('id', body.system_id).single();
  const gm = await isGMInGame(req.user.id, sys.game_id);
  if (!gm) {
    const rid = await realmForUser(req.user.id, sys.game_id);
    const ctrl = await settlementController(req.params.id);
    if (!rid || rid !== ctrl) return res.status(403).json({ error: 'You do not control this settlement' });
  }
  const { error } = await adminDb.from('settlements').update({ name: name.trim() }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
