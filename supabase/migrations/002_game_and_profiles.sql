-- =============================================================
-- 002_game_and_profiles.sql  —  Auth extension + game instances
-- =============================================================

-- Extends Supabase's auth.users with display name and global role.
-- game_participants handles per-game role assignments.
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A single deployable instance of the game. Supports running multiple campaigns.
CREATE TABLE games (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  current_turn   SMALLINT    NOT NULL DEFAULT 1,
  current_phase  TEXT        NOT NULL DEFAULT 'placement'
                             CHECK (current_phase IN ('placement', 'action', 'resolution')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ties a profile to a game with a role for that game.
-- A user could be GM in one game and a player in another.
CREATE TABLE game_participants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id    UUID NOT NULL REFERENCES games(id)    ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('gm', 'player', 'observer')),
  UNIQUE (game_id, profile_id)
);

-- Row-level security
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE games            ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_participants ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles (usernames are public), write only their own.
CREATE POLICY "read all profiles"   ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "insert own profile"  ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile"  ON profiles FOR UPDATE USING (id = auth.uid());

-- Games: all authenticated users can read game names/status.
CREATE POLICY "authenticated read games"
  ON games FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Game participants: visible to all participants of that game.
CREATE POLICY "participants read participants"
  ON game_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM game_participants gp2
      WHERE gp2.game_id = game_participants.game_id
        AND gp2.profile_id = auth.uid()
    )
  );
