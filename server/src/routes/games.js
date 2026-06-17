import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { adminDb } from '../db.js';

const router = Router();

// GET /api/games — games the caller participates in
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await req.supabase
    .from('game_participants')
    .select('role, games(id, name, current_turn, current_phase, created_at)')
    .eq('profile_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/games/:id — single game with full participant list
// Uses adminDb so the GM sees all participants, not just their own row.
// Auth is still enforced — we verify the caller is a participant before returning.
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await adminDb
    .from('games')
    .select('*, game_participants(role, profiles(id, username))')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Game not found' });

  const isParticipant = data.game_participants.some(p => p.profiles?.id === req.user.id);
  if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

  res.json(data);
});

// POST /api/games — create a new game; creator is automatically added as GM
router.post('/', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { data: game, error: gameErr } = await adminDb
    .from('games')
    .insert({ name })
    .select()
    .single();
  if (gameErr) return res.status(500).json({ error: gameErr.message });

  const { error: partErr } = await adminDb
    .from('game_participants')
    .insert({ game_id: game.id, profile_id: req.user.id, role: 'gm' });
  if (partErr) return res.status(500).json({ error: partErr.message });

  res.status(201).json(game);
});

// DELETE /api/games/:id — GM permanently deletes a game
router.delete('/:id', requireAuth, async (req, res) => {
  const { data: participant } = await adminDb
    .from('game_participants')
    .select('role')
    .eq('game_id', req.params.id)
    .eq('profile_id', req.user.id)
    .maybeSingle();

  if (participant?.role !== 'gm') return res.status(403).json({ error: 'Only the GM can delete a game' });

  const { error } = await adminDb.from('games').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POST /api/games/:id/participants — GM adds a player by username
router.post('/:id/participants', requireAuth, async (req, res) => {
  const { username, role = 'player' } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });

  // Look up the profile by username
  const { data: profile, error: profileErr } = await adminDb
    .from('profiles')
    .select('id, username')
    .eq('username', username)
    .maybeSingle();

  if (profileErr || !profile) {
    return res.status(404).json({ error: `No account found with username "${username}"` });
  }

  const { data, error } = await adminDb
    .from('game_participants')
    .insert({ game_id: req.params.id, profile_id: profile.id, role })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ ...data, profiles: profile });
});

// GET /api/games/:id/settlements — all settlements in a game with body/system context.
// Used by the GM setup modal to populate the starting settlement dropdown.
router.get('/:id/settlements', requireAuth, async (req, res) => {
  // Verify the caller is a GM in this game.
  const { data: part } = await adminDb
    .from('game_participants')
    .select('role')
    .eq('game_id', req.params.id)
    .eq('profile_id', req.user.id)
    .maybeSingle();
  if (part?.role !== 'gm') return res.status(403).json({ error: 'GM only' });

  // Flat queries to avoid deep-nesting failures.
  const { data: systems } = await adminDb.from('systems').select('id, name').eq('game_id', req.params.id);
  const systemIds = (systems ?? []).map(s => s.id);
  if (!systemIds.length) return res.json([]);

  const { data: bodies } = await adminDb
    .from('celestial_bodies').select('id, name, hex_q, hex_r, system_id').in('system_id', systemIds);
  const bodyIds = (bodies ?? []).map(b => b.id);
  if (!bodyIds.length) return res.json([]);

  const { data: regions } = await adminDb
    .from('regions').select('id, body_id').in('body_id', bodyIds);
  const regionIds = (regions ?? []).map(r => r.id);
  if (!regionIds.length) return res.json([]);

  const { data: settlements } = await adminDb
    .from('settlements').select('id, name, current_tier, region_id').in('region_id', regionIds);

  // Build lookup maps.
  const systemById = Object.fromEntries((systems ?? []).map(s => [s.id, s]));
  const bodyById   = Object.fromEntries((bodies  ?? []).map(b => [b.id, b]));
  const regionById = Object.fromEntries((regions ?? []).map(r => [r.id, r]));

  const result = (settlements ?? []).map(sett => {
    const region = regionById[sett.region_id];
    const body   = region ? bodyById[region.body_id] : null;
    const system = body   ? systemById[body.system_id] : null;
    return {
      id:           sett.id,
      name:         sett.name,
      current_tier: sett.current_tier,
      region_id:    sett.region_id,
      body:  body   ? { id: body.id, name: body.name, hex_q: body.hex_q, hex_r: body.hex_r, system_id: body.system_id } : null,
      system: system ? { id: system.id, name: system.name } : null,
    };
  });

  res.json(result);
});

// POST /api/games/:id/setup-realm — GM initializes a player's starting position.
// Assigns all control boxes in a settlement, places ground units + ships, sets resources.
router.post('/:id/setup-realm', requireAuth, async (req, res) => {
  const { realmId, settlementId, groundUnits = 2, scouts = 0, frigates = 2, cruisers = 0, resources = {} } = req.body;
  if (!realmId || !settlementId) return res.status(400).json({ error: 'realmId and settlementId are required' });

  // Verify GM.
  const { data: part } = await adminDb
    .from('game_participants')
    .select('role')
    .eq('game_id', req.params.id)
    .eq('profile_id', req.user.id)
    .maybeSingle();
  if (part?.role !== 'gm') return res.status(403).json({ error: 'GM only' });

  // Resolve settlement → region → body → system for unit placement.
  const { data: sett } = await adminDb.from('settlements').select('id, region_id').eq('id', settlementId).single();
  if (!sett) return res.status(404).json({ error: 'Settlement not found' });

  const { data: region } = await adminDb.from('regions').select('id, body_id').eq('id', sett.region_id).single();
  const { data: body }   = await adminDb.from('celestial_bodies').select('id, system_id, hex_q, hex_r').eq('id', region.body_id).single();

  // Resolve unit type IDs.
  const { data: unitTypes } = await adminDb.from('unit_type_config').select('id, name');
  const typeId = name => unitTypes.find(t => t.name === name)?.id;

  // 1. Assign all control boxes in the settlement to the realm.
  const { error: boxErr } = await adminDb
    .from('control_boxes')
    .update({ owner_realm_id: realmId })
    .eq('settlement_id', settlementId);
  if (boxErr) return res.status(500).json({ error: boxErr.message });

  // 2. Place ground units in the region.
  const groundInserts = [];
  if (groundUnits > 0 && typeId('Standard')) {
    groundInserts.push({ realm_id: realmId, unit_type_id: typeId('Standard'), region_id: sett.region_id, quantity: groundUnits });
  }
  if (groundInserts.length) {
    const { error } = await adminDb.from('units').insert(groundInserts);
    if (error) return res.status(500).json({ error: error.message });
  }

  // 3. Place ships in the system sector that contains this body.
  const shipInserts = [];
  const shipBase = { realm_id: realmId, system_id: body.system_id, sector_hex_q: body.hex_q, sector_hex_r: body.hex_r };
  if (scouts   > 0 && typeId('Scout'))   shipInserts.push({ ...shipBase, unit_type_id: typeId('Scout'),   quantity: scouts });
  if (frigates > 0 && typeId('Frigate')) shipInserts.push({ ...shipBase, unit_type_id: typeId('Frigate'), quantity: frigates });
  if (cruisers > 0 && typeId('Cruiser')) shipInserts.push({ ...shipBase, unit_type_id: typeId('Cruiser'), quantity: cruisers });
  if (shipInserts.length) {
    const { error } = await adminDb.from('units').insert(shipInserts);
    if (error) return res.status(500).json({ error: error.message });
  }

  // 4. Upsert starting resources.
  const resourceRows = Object.entries(resources)
    .filter(([, amount]) => Number(amount) > 0)
    .map(([resource, amount]) => ({ realm_id: realmId, resource, amount: Number(amount) }));
  if (resourceRows.length) {
    const { error } = await adminDb
      .from('realm_resources')
      .upsert(resourceRows, { onConflict: 'realm_id,resource' });
    if (error) return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

export default router;
