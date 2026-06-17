import { adminDb, userDb } from '../db.js';

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const { data: { user }, error } = await adminDb.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  req.user = user;
  req.supabase = userDb(token); // RLS-scoped for this request
  next();
}
