-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS feed_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_type     text NOT NULL,      -- 'milestone_workout' | 'milestone_streak' | 'milestone_weight_goal'
  milestone_key text NOT NULL,      -- e.g. 'workouts_50', 'streak_7', 'weight_goal_reached'
  message       text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- One milestone per user (prevents duplicate posts for the same achievement)
ALTER TABLE feed_posts
  ADD CONSTRAINT feed_posts_user_milestone_unique UNIQUE (user_id, milestone_key);

-- RLS
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own feed posts" ON feed_posts;
CREATE POLICY "Users can insert own feed posts" ON feed_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Friends can read feed posts" ON feed_posts;
CREATE POLICY "Friends can read feed posts" ON feed_posts
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM friendships
      WHERE friendships.status = 'accepted'
        AND (
          (friendships.user_id  = auth.uid() AND friendships.friend_id = feed_posts.user_id)
          OR
          (friendships.friend_id = auth.uid() AND friendships.user_id  = feed_posts.user_id)
        )
    )
  );
