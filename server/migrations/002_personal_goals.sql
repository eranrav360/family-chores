-- Add personal goal types to the goals table

-- 1. Drop the existing type constraint
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_type_check;

-- 2. Re-add it with the two new personal types
ALTER TABLE goals ADD CONSTRAINT goals_type_check
  CHECK (type IN ('weekly', 'monthly', 'personal_weekly', 'personal_monthly'));

-- 3. Seed default personal goal targets
INSERT INTO goals (type, target_points) VALUES
  ('personal_weekly',  40),
  ('personal_monthly', 150)
ON CONFLICT (type) DO NOTHING;
