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

// GET /api/games/:id — single game with participant list (RLS: participants only)
router.get('/:id', requireAuth, async (req, res) => {
  const { data, error } = await req.supabase
    .from('games')
    .select('*, game_participants(role, profiles(id, username))')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Game not found or access denied' });
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

export default router;
