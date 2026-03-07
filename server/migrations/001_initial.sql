-- Family members table
CREATE TABLE IF NOT EXISTS family_members (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  avatar_emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chores table
CREATE TABLE IF NOT EXISTS chores (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  points INTEGER NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chore logs table
CREATE TABLE IF NOT EXISTS chore_logs (
  id SERIAL PRIMARY KEY,
  family_member_id INTEGER REFERENCES family_members(id) ON DELETE CASCADE,
  chore_id INTEGER REFERENCES chores(id) ON DELETE SET NULL,
  points_earned INTEGER NOT NULL,
  logged_at TIMESTAMP DEFAULT NOW(),
  week_number INTEGER NOT NULL,
  month_number INTEGER NOT NULL,
  year INTEGER NOT NULL
);

-- Goals configuration table
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL UNIQUE CHECK (type IN ('weekly', 'monthly')),
  target_points INTEGER NOT NULL DEFAULT 100,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Goal periods tracking table
CREATE TABLE IF NOT EXISTS goal_periods (
  id SERIAL PRIMARY KEY,
  goal_type VARCHAR(20) NOT NULL CHECK (goal_type IN ('weekly', 'monthly')),
  period_key VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE,
  total_points INTEGER DEFAULT 0,
  achieved BOOLEAN DEFAULT FALSE,
  reward_chosen VARCHAR(500),
  UNIQUE(goal_type, period_key)
);

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  family_member_id INTEGER REFERENCES family_members(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  period_key VARCHAR(20),
  earned_at TIMESTAMP DEFAULT NOW()
);

-- Admin configuration table
CREATE TABLE IF NOT EXISTS admin_config (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ──────────────── Seed default data ────────────────

-- Default chores (easy = 5pts)
INSERT INTO chores (name, difficulty, points) VALUES
  ('הכנסת כלים למדיח', 'easy', 5),
  ('הוצאת הכלב לטיול', 'easy', 5),
  ('ריקון מדיח', 'easy', 5),
  ('קיפול כביסה אישית', 'easy', 5),
  ('ניקוי צרכי הכלב בבית', 'easy', 5),
  ('הורדת הזבל', 'easy', 5),
  -- medium = 15pts
  ('שטיפת כלים', 'medium', 15),
  ('סידור חדר אחד בבית', 'medium', 15),
  ('עריכת שולחן לארוחה', 'medium', 15),
  -- hard = 30pts
  ('קיפול כביסה של כל הבית', 'hard', 30),
  ('סידור של כל הבית', 'hard', 30),
  ('הכנת ארוחה לכל בני הבית', 'hard', 30),
  ('ביצוע קנייה בסופר', 'hard', 30)
ON CONFLICT DO NOTHING;

-- Default goals
INSERT INTO goals (type, target_points) VALUES
  ('weekly', 100),
  ('monthly', 400)
ON CONFLICT (type) DO NOTHING;

-- Default admin PIN
INSERT INTO admin_config (key, value) VALUES
  ('admin_pin', '1234')
ON CONFLICT (key) DO NOTHING;
