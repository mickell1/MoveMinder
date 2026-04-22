-- MoveMinder Phase 6: Food & Calorie Tracking
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS public.food_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date  date NOT NULL DEFAULT CURRENT_DATE,
  meal_type    text CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  name         text NOT NULL,
  calories     integer,
  protein_g    numeric(6,1),
  carbs_g      numeric(6,1),
  fat_g        numeric(6,1),
  serving_size text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own food logs"
  ON public.food_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Optional calorie target override (otherwise TDEE is computed from profile)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calorie_target integer;
