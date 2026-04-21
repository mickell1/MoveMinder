-- MoveMinder Phase 5: Personal Bests tracking
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS public.personal_bests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id    uuid NOT NULL,  -- references exercises.id (catalog)
  exercise_name  text NOT NULL,  -- denormalized for fast display
  muscle_group   text,
  weight_kg      numeric(6,2),
  reps           integer,
  estimated_1rm  numeric(6,2),  -- Epley: weight * (1 + reps/30)
  achieved_at    timestamptz NOT NULL DEFAULT now(),
  session_id     uuid REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  UNIQUE (user_id, exercise_id)
);

ALTER TABLE public.personal_bests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own personal bests"
  ON public.personal_bests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
