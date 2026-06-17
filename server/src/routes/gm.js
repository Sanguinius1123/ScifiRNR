import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { adminDb } from '../db.js';

const router = Router();

// Middleware: verify the caller is a GM in the given game.
async function requireGM(req, res, next) {
  const gameId = req.params.gameId;
  const { data } = await adminDb
    .from('game_participants')
    .select('role')
    .eq('game_id', gameId)
    .eq('profile_id', req.user.id)
    .maybeSingle();
  if (data?.role !== 'gm') return res.status(403).json({ error: 'GM only' });
  next();
}

// ── Unit types ───────────────────────────────────────────────────────────────

// GET /api/gm/:gameId/unit-types
router.get('/:gameId/unit-types', requireAuth, requireGM, async (_req, res) => {
  const { data, error } = await adminDb
    .from('unit_type_config')
    .select('id, name, is_ground_unit, is_buildable')
    .order('is_ground_unit', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// ── Realm units ──────────────────────────────────────────────────────────────

// GET /api/gm/:gameId/realms/:realmId/units
// Returns all units for a realm with human-readable location info.
router.get('/:gameId/realms/:realmId/units', requireAuth, requireGM, async (req, res) => {
  const { realmId } = req.params;

  const { data: units, error } = await adminDb
    .from('units')
    .select('id, quantity, region_id, system_id, sector_hex_q, sector_hex_r, unit_type_config(name, is_ground_unit)')
    .eq('realm_id', realmId);
  if (error) return res.status(500).json({ error: error.message });

  // Resolve location names with flat lookups.
  const regionIds = (units ?? []).filter(u => u.region_id).map(u => u.region_id);
  const systemIds = (units ?? []).filter(u => u.system_id).map(u => u.system_id);

  const [regionsRes, systemsRes] = await Promise.all([
    regionIds.length
      ? adminDb.from('regions').select('id, name, body_id').in('id', regionIds)
      : { data: [] },
    systemIds.length
      ? adminDb.from('systems').select('id, name').in('id', systemIds)
      : { data: [] },
  ]);

  const bodyIds = (regionsRes.data ?? []).map(r => r.body_id);
  const { data: bodies } = bodyIds.length
    ? await adminDb.from('celestial_bodies').select('id, name, system_id').in('id', bodyIds)
    : { data: [] };
  const bodySystems = bodies?.map(b => b.system_id) ?? [];
  const { data: bodySysData } = bodySystems.length
    ? await adminDb.from('systems').select('id, name').in('id', [...new Set(bodySystems)])
    : { data: [] };

  const regionById = Object.fromEntries((regionsRes.data ?? []).map(r => [r.id, r]));
  const bodyById   = Object.fromEntries((bodies ?? []).map(b => [b.id, b]));
  const systemById = Object.fromEntries([
    ...(systemsRes.data ?? []).map(s => [s.id, s]),
    ...(bodySysData ?? []).map(s => [s.id, s]),
  ]);

  const result = (units ?? []).map(u => {
    let location = 'Unknown';
    if (u.region_id) {
      const rg  = regionById[u.region_id];
      const bod = rg ? bodyById[rg.body_id] : null;
      const sys = bod ? systemById[bod.system_id] : null;
      location = [rg?.name, bod?.name, sys?.name].filter(Boolean).join(' · ');
    } else if (u.system_id) {
      const sys = systemById[u.system_id];
      location = `${sys?.name ?? '?'} — sector (${u.sector_hex_q}, ${u.sector_hex_r})`;
    }
    return {
      id:         u.id,
      type:       u.unit_type_config?.name ?? '?',
      isGroundUnit: u.unit_type_config?.is_ground_unit ?? true,
      quantity:   u.quantity,
      region_id:  u.region_id,
      system_id:  u.system_id,
      sector_hex_q: u.sector_hex_q,
      sector_hex_r: u.sector_hex_r,
      location,
    };
  });

  res.json(result);
});

// POST /api/gm/:gameId/units — add units to a location.
// Stacks onto an existing row (same realm + type + location) rather than creating duplicates.
router.post('/:gameId/units', requireAuth, requireGM, async (req, res) => {
  const { realmId, unitTypeId, quantity, regionId, systemId, sectorHexQ, sectorHexR } = req.body;
  if (!realmId || !unitTypeId || !quantity) return res.status(400).json({ error: 'realmId, unitTypeId, quantity required' });
  if (!regionId && systemId == null) return res.status(400).json({ error: 'Must supply regionId or systemId + sector coords' });

  // Look for an existing stack at the same location.
  let query = adminDb.from('units')
    .select('id, quantity')
    .eq('realm_id', realmId)
    .eq('unit_type_id', unitTypeId);

  if (regionId) {
    query = query.eq('region_id', regionId).is('system_id', null);
  } else {
    query = query.eq('system_id', systemId).eq('sector_hex_q', sectorHexQ).eq('sector_hex_r', sectorHexR).is('region_id', null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    const { error } = await adminDb.from('units').update({ quantity: existing.quantity + quantity }).eq('id', existing.id);
    if (error) return res.status(500).json({ error: error.message });
  } else {
    const row = { realm_id: realmId, unit_type_id: unitTypeId, quantity };
    if (regionId) { row.region_id = regionId; }
    else { row.system_id = systemId; row.sector_hex_q = sectorHexQ; row.sector_hex_r = sectorHexR; }
    const { error } = await adminDb.from('units').insert(row);
    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// DELETE /api/gm/:gameId/units/:unitId — remove a unit stack entirely,
// or reduce its quantity if ?quantity=N is supplied.
router.delete('/:gameId/units/:unitId', requireAuth, requireGM, async (req, res) => {
  const { unitId } = req.params;
  const reduceBy = req.query.quantity ? Number(req.query.quantity) : null;

  if (reduceBy !== null) {
    const { data: unit } = await adminDb.from('units').select('quantity').eq('id', unitId).single();
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    const newQty = unit.quantity - reduceBy;
    if (newQty <= 0) {
      await adminDb.from('units').delete().eq('id', unitId);
    } else {
      await adminDb.from('units').update({ quantity: newQty }).eq('id', unitId);
    }
  } else {
    await adminDb.from('units').delete().eq('id', unitId);
  }
  res.json({ success: true });
});

// ── Settlement control ───────────────────────────────────────────────────────

// POST /api/gm/:gameId/settlements/:settlementId/assign-boxes
// Assigns the first `count` control boxes to `realmId`; boxes beyond that become neutral.
router.post('/:gameId/settlements/:settlementId/assign-boxes', requireAuth, requireGM, async (req, res) => {
  const { settlementId } = req.params;
  const { realmId, count } = req.body;
  if (realmId == null || count == null) return res.status(400).json({ error: 'realmId and count required' });

  const { data: boxes, error } = await adminDb
    .from('control_boxes')
    .select('id, box_index')
    .eq('settlement_id', settlementId)
    .order('box_index');
  if (error) return res.status(500).json({ error: error.message });

  // Assign first `count` boxes to realm; remaining to neutral.
  const updates = (boxes ?? []).map(b => ({
    id: b.id,
    owner_realm_id: b.box_index < count ? realmId : null,
  }));

  for (const u of updates) {
    await adminDb.from('control_boxes').update({ owner_realm_id: u.owner_realm_id }).eq('id', u.id);
  }

  res.json({ success: true, assigned: count });
});

// ── Resources ────────────────────────────────────────────────────────────────

// PATCH /api/gm/:gameId/realms/:realmId/resources
// Sets absolute resource amounts. Body: { resources: { food: N, energy: N, ... } }
router.patch('/:gameId/realms/:realmId/resources', requireAuth, requireGM, async (req, res) => {
  const { realmId } = req.params;
  const { resources } = req.body;
  if (!resources || typeof resources !== 'object') return res.status(400).json({ error: 'resources object required' });

  const rows = Object.entries(resources)
    .filter(([, v]) => v != null)
    .map(([resource, amount]) => ({ realm_id: realmId, resource, amount: Math.max(0, Number(amount)) }));

  if (rows.length) {
    const { error } = await adminDb
      .from('realm_resources')
      .upsert(rows, { onConflict: 'realm_id,resource' });
    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// GET /api/gm/:gameId/realms/:realmId/resources — current resource amounts.
router.get('/:gameId/realms/:realmId/resources', requireAuth, requireGM, async (req, res) => {
  const { realmId } = req.params;
  const { data, error } = await adminDb
    .from('realm_resources')
    .select('resource, amount')
    .eq('realm_id', realmId);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// GET /api/gm/:gameId/realms/:realmId/controlled-regions
// Regions where the realm controls at least one control box — for the add-ground-units dropdown.
router.get('/:gameId/realms/:realmId/controlled-regions', requireAuth, requireGM, async (req, res) => {
  const { realmId } = req.params;

  const { data: boxes } = await adminDb
    .from('control_boxes')
    .select('settlement_id')
    .eq('owner_realm_id', realmId);

  const settIds = [...new Set((boxes ?? []).map(b => b.settlement_id))];
  if (!settIds.length) return res.json([]);

  const { data: settlements } = await adminDb
    .from('settlements').select('id, name, region_id').in('id', settIds);
  const regionIds = (settlements ?? []).map(s => s.region_id);

  const { data: regions } = await adminDb
    .from('regions').select('id, name, body_id').in('id', regionIds);
  const bodyIds = (regions ?? []).map(r => r.body_id);

  const { data: bodies } = await adminDb
    .from('celestial_bodies').select('id, name, system_id').in('id', bodyIds);
  const sysIds = [...new Set((bodies ?? []).map(b => b.system_id))];

  const { data: systems } = await adminDb
    .from('systems').select('id, name').in('id', sysIds);

  const bodyById   = Object.fromEntries((bodies  ?? []).map(b => [b.id, b]));
  const systemById = Object.fromEntries((systems ?? []).map(s => [s.id, s]));
  const settByRegion = Object.fromEntries((settlements ?? []).map(s => [s.region_id, s]));

  const result = (regions ?? []).map(rg => {
    const body = bodyById[rg.body_id];
    const sys  = body ? systemById[body.system_id] : null;
    const sett = settByRegion[rg.id];
    return {
      id:   rg.id,
      name: [rg.name, sett?.name, body?.name, sys?.name].filter(Boolean).join(' · '),
    };
  });

  res.json(result);
});

export default router;
