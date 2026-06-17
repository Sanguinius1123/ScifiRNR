import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/map/:gameId/systems — all systems (hex positions + bodies) for the galaxy map
router.get('/:gameId/systems', requireAuth, async (req, res) => {
  const { data, error } = await req.supabase
    .from('systems')
    .select('id, name, hex_q, hex_r, celestial_bodies(id, name, body_type, orbit_order)')
    .eq('game_id', req.params.gameId);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/map/:gameId/regions/:bodyId — regions for a body; RLS enforces fog of war
router.get('/:gameId/regions/:bodyId', requireAuth, async (req, res) => {
  const { data, error } = await req.supabase
    .from('regions')
    .select('id, name, grid_x, grid_y, slots(id, slot_index, slot_type_config(name))')
    .eq('body_id', req.params.bodyId);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
