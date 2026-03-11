-- ─────────────────────────────────────────────
-- Migration 003: Multi-tenant family support
-- ─────────────────────────────────────────────

-- 1. Create families table
CREATE TABLE IF NOT EXISTS families (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  code       VARCHAR(30)  UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Add nullable family_id to all scoped tables
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS family_id INTEGER REFERENCES families(id) ON DELETE CASCADE;
ALTER TABLE chores         ADD COLUMN IF NOT EXISTS family_id INTEGER REFERENCES families(id) ON DELETE CASCADE;
ALTER TABLE goals          ADD COLUMN IF NOT EXISTS family_id INTEGER REFERENCES families(id) ON DELETE CASCADE;
ALTER TABLE goal_periods   ADD COLUMN IF NOT EXISTS family_id INTEGER REFERENCES families(id) ON DELETE CASCADE;
ALTER TABLE admin_config   ADD COLUMN IF NOT EXISTS family_id INTEGER REFERENCES families(id) ON DELETE CASCADE;

-- 3. Create default family for existing data
INSERT INTO families (name, code) VALUES ('משפחה', 'default')
  ON CONFLICT (code) DO NOTHING;

-- 4. Point all existing rows at the default family
UPDATE family_members SET family_id = (SELECT id FROM families WHERE code = 'default') WHERE family_id IS NULL;
UPDATE chores         SET family_id = (SELECT id FROM families WHERE code = 'default') WHERE family_id IS NULL;
UPDATE goals          SET family_id = (SELECT id FROM families WHERE code = 'default') WHERE family_id IS NULL;
UPDATE goal_periods   SET family_id = (SELECT id FROM families WHERE code = 'default') WHERE family_id IS NULL;
UPDATE admin_config   SET family_id = (SELECT id FROM families WHERE code = 'default') WHERE family_id IS NULL;

-- 5. Enforce NOT NULL now that all rows are filled
ALTER TABLE family_members ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE chores         ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE goals          ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE goal_periods   ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE admin_config   ALTER COLUMN family_id SET NOT NULL;

-- 6. Replace UNIQUE constraints with family-scoped ones

-- goals: (type) → (family_id, type)
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_type_key;
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_family_type_unique;
ALTER TABLE goals ADD CONSTRAINT goals_family_type_unique UNIQUE (family_id, type);

-- goal_periods: (goal_type, period_key) → (family_id, goal_type, period_key)
ALTER TABLE goal_periods DROP CONSTRAINT IF EXISTS goal_periods_goal_type_period_key_key;
ALTER TABLE goal_periods DROP CONSTRAINT IF EXISTS goal_periods_family_type_period_unique;
ALTER TABLE goal_periods ADD CONSTRAINT goal_periods_family_type_period_unique UNIQUE (family_id, goal_type, period_key);

-- admin_config: PK was (key) → UNIQUE (family_id, key)
ALTER TABLE admin_config DROP CONSTRAINT IF EXISTS admin_config_pkey;
ALTER TABLE admin_config DROP CONSTRAINT IF EXISTS admin_config_family_key_unique;
ALTER TABLE admin_config ADD CONSTRAINT admin_config_family_key_unique UNIQUE (family_id, key);
