-- =============================================================
-- 002_auth_and_games.sql  —  Auth, profiles, games
-- =============================================================

-- Emails in this table are auto-granted GM role on signup and
-- added to all existing games as GM automatically.
CREATE TABLE gm_whitelist (
  email TEXT PRIMARY KEY
);

INSERT INTO gm_whitelist (email) VALUES ('macarthur1123@gmail.com');

-- Extends Supabase's auth.users with display name and global role.
-- Per-game roles live in game_participants; global_role is for app-level routing only.
CREATE TABLE profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT        NOT NULL UNIQUE,
  global_role TEXT        NOT NULL DEFAULT 'player' CHECK (global_role IN ('gm', 'player')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A deployable game instance. Supports running multiple campaigns.
CREATE TABLE games (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  current_turn  SMALLINT    NOT NULL DEFAULT 1,
  current_phase TEXT        NOT NULL DEFAULT 'placement'
                            CHECK (current_phase IN ('placement', 'action', 'economic_resolution')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ties a profile to a game with a per-game role.
-- A user can be GM in one game and a player in another.
CREATE TABLE game_participants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id    UUID NOT NULL REFERENCES games(id)    ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('gm', 'player', 'observer')),
  UNIQUE (game_id, profile_id)
);

-- Row-level security
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE games             ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_participants ENABLE ROW LEVEL SECURITY;

-- Profiles: public usernames; each user writes only their own.
CREATE POLICY "read all profiles"  ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "insert own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- Games: readable by any authenticated user.
CREATE POLICY "authenticated read games"
  ON games FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Game participants: a user can only see their own participation rows.
-- Full player lists are fetched via the server admin client which bypasses RLS.
CREATE POLICY "read own participation"
  ON game_participants FOR SELECT
  USING (profile_id = auth.uid());

-- Auto-create a profile when a user's email is confirmed.
-- Checks the GM whitelist, sets global_role accordingly, and auto-adds GM accounts
-- to all existing games.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_global_role TEXT := 'player';
  v_game        RECORD;
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.gm_whitelist WHERE email = NEW.email) THEN
      v_global_role := 'gm';
    END IF;

    INSERT INTO public.profiles (id, username, global_role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::TEXT, 8)),
      v_global_role
    )
    ON CONFLICT (id) DO NOTHING;

    IF v_global_role = 'gm' THEN
      FOR v_game IN SELECT id FROM public.games LOOP
        INSERT INTO public.game_participants (game_id, profile_id, role)
        VALUES (v_game.id, NEW.id, 'gm')
        ON CONFLICT (game_id, profile_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_confirmed
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
