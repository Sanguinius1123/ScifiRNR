import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { adminDb } from '../db.js';

const RESOURCES = ['food', 'energy', 'materials', 'strategic_materials', 'igc'];

const router = Router();

// POST /api/realms — create a default realm for the calling player in a game
router.post('/', requireAuth, async (req, res) => {
  const { game_id } = req.body;
  if (!game_id) return res.status(400).json({ error: 'game_id is required' });

  const { data: participant } = await adminDb
    .from('game_participants')
    .select('role')
    .eq('game_id', game_id)
    .eq('profile_id', req.user.id)
    .maybeSingle();
  if (!participant) return res.status(403).json({ error: 'Not a participant in this game' });

  // Idempotent — return existing realm if already created
  const { data: existing } = await adminDb
    .from('realms')
    .select('id, name, color, description, capital_settlement_id, realm_resources(resource, amount)')
    .eq('game_id', game_id)
    .eq('profile_id', req.user.id)
    .maybeSingle();
  if (existing) return res.json(existing);

  const { data: profile } = await adminDb
    .from('profiles')
    .select('username')
    .eq('id', req.user.id)
    .single();

  const { data: realm, error } = await adminDb
    .from('realms')
    .insert({ game_id, profile_id: req.user.id, name: `${profile?.username ?? 'New'}'s Realm` })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await adminDb.from('realm_resources').insert(
    RESOURCES.map(r => ({ realm_id: realm.id, resource: r, amount: 0 }))
  );

  res.status(201).json({ ...realm, realm_resources: RESOURCES.map(r => ({ resource: r, amount: 0 })) });
});

// PATCH /api/realms/:id — realm owner or GM can update name/description
router.patch('/:id', requireAuth, async (req, res) => {
  const { name, description } = req.body;

  const { data: realm } = await adminDb
    .from('realms')
    .select('profile_id, game_id')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!realm) return res.status(404).json({ error: 'Realm not found' });

  const isOwner = realm.profile_id === req.user.id;
  if (!isOwner) {
    const { data: participant } = await adminDb
      .from('game_participants')
      .select('role')
      .eq('game_id', realm.game_id)
      .eq('profile_id', req.user.id)
      .maybeSingle();
    if (participant?.role !== 'gm') return res.status(403).json({ error: 'Not authorized' });
  }

  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description;

  const { data, error } = await adminDb
    .from('realms')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/realms/:id — full realm sheet; RLS enforces own-realm-or-GM access
router.get('/:id', requireAuth, async (req, res) => {
  const [realmRes, influenceRes, workersRes] = await Promise.all([
    req.supabase
      .from('realms')
      .select('id, name, color, realm_resources(resource, amount), realm_trade_goods(amount, trade_good_types(id, name))')
      .eq('id', req.params.id)
      .single(),
    req.supabase
      .from('realm_influence')
      .select('influence')
      .eq('realm_id', req.params.id)
      .single(),
    req.supabase
      .from('realm_worker_capacity')
      .select('settlement_id, workers_available')
      .eq('realm_id', req.params.id),
  ]);

  if (realmRes.error) return res.status(404).json({ error: 'Realm not found or access denied' });

  res.json({
    ...realmRes.data,
    influence: influenceRes.data?.influence ?? 0,
    worker_capacity: workersRes.data ?? [],
  });
});

// PATCH /api/realms/:id/resources — GM direct edit of a resource amount
router.patch('/:id/resources', requireAuth, async (req, res) => {
  const { resource, amount } = req.body;
  if (!resource || amount == null) return res.status(400).json({ error: 'resource and amount are required' });

  const { data, error } = await adminDb
    .from('realm_resources')
    .update({ amount })
    .eq('realm_id', req.params.id)
    .eq('resource', resource)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;
