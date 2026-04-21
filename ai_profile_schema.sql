-- MoveMinder Phase 4: AI Personal Trainer profile fields
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query)
-- Safe to re-run: uses ALTER TABLE ... IF NOT EXISTS pattern

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm        numeric(5,1),
  ADD COLUMN IF NOT EXISTS age              integer,
  ADD COLUMN IF NOT EXISTS sex              text CHECK (sex IN ('male','female','other')),
  ADD COLUMN IF NOT EXISTS activity_level   text CHECK (activity_level IN ('sedentary','light','moderate','active','very_active')),
  ADD COLUMN IF NOT EXISTS dietary_preferences text[] NOT NULL DEFAULT '{}';
