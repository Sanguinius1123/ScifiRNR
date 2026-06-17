import { createClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS. For GM writes and server-side operations.
// Never expose SUPABASE_SECRET_KEY to the browser.
export const adminDb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// Per-request Supabase client scoped to the caller's JWT so RLS applies normally.
export function userDb(accessToken) {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}
