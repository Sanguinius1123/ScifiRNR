import { Router } from 'express';
import { adminDb } from '../db.js';

const router = Router();

// POST /api/auth/register
// Validates registration code before creating an account.
// Everyone needs the code. The gm_whitelist only affects role assignment (done by DB trigger on email confirmation).
router.post('/register', async (req, res) => {
  const { email, password, username, registrationCode } = req.body;
  if (!email || !password || !username) {
    return res.status(400).json({ error: 'email, password and username are required' });
  }

  if (!registrationCode) {
    return res.status(403).json({ error: 'A registration code is required to sign up.' });
  }
  if (registrationCode !== process.env.REGISTRATION_CODE) {
    return res.status(403).json({ error: 'Invalid registration code.' });
  }

  // Create the user via the admin SDK so we control the flow.
  // email_confirm: false sends a confirmation email (keeps email ownership verified).
  const { data, error } = await adminDb.auth.admin.createUser({
    email,
    password,
    user_metadata: { username },
    email_confirm: false,
  });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Account created — check your email to confirm before signing in.' });
});

export default router;
