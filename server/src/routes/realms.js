import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { adminDb } from '../db.js';

const router = Router();

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
