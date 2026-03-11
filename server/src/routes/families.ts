import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

const CODE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$|^[a-z0-9]{2,30}$/;

// GET /api/families/:code  — check if a family exists
router.get('/:code', async (req: Request, res: Response) => {
  const code = req.params.code.toLowerCase();
  try {
    const { rows } = await pool.query(
      'SELECT id, name, code FROM families WHERE code = $1',
      [code]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'משפחה לא נמצאה' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// POST /api/families  — create a new family with seeded data
router.post('/', async (req: Request, res: Response) => {
  const { name, code, admin_pin } = req.body;

  if (!name || !code) {
    return res.status(400).json({ error: 'שם וקוד משפחה הם שדות חובה' });
  }

  const normalCode = String(code).toLowerCase().trim();

  if (!CODE_RE.test(normalCode)) {
    return res.status(400).json({
      error: 'הקוד חייב להכיל 2-30 תווים: אותיות באנגלית, מספרים או מקף',
    });
  }

  const pin = String(admin_pin || '1234').trim();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure code is unique
    const existing = await client.query('SELECT id FROM families WHERE code = $1', [normalCode]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'קוד זה כבר תפוס, נסה קוד אחר' });
    }

    // Create the family
    const { rows } = await client.query(
      'INSERT INTO families (name, code) VALUES ($1, $2) RETURNING id, name, code',
      [name.trim(), normalCode]
    );
    const family = rows[0];
    const familyId = family.id;

    // Seed admin PIN
    await client.query(
      `INSERT INTO admin_config (key, value, family_id) VALUES ('admin_pin', $1, $2)`,
      [pin, familyId]
    );

    // Seed default goals
    await client.query(
      `INSERT INTO goals (type, target_points, family_id) VALUES
        ('weekly',          100, $1),
        ('monthly',         400, $1),
        ('personal_weekly',  40, $1),
        ('personal_monthly',150, $1)`,
      [familyId]
    );

    // Seed default chores
    await client.query(
      `INSERT INTO chores (name, difficulty, points, family_id) VALUES
        ('הכנסת כלים למדיח',       'easy',   5,  $1),
        ('הוצאת הכלב לטיול',       'easy',   5,  $1),
        ('ריקון מדיח',              'easy',   5,  $1),
        ('קיפול כביסה אישית',       'easy',   5,  $1),
        ('ניקוי צרכי הכלב בבית',   'easy',   5,  $1),
        ('הורדת הזבל',              'easy',   5,  $1),
        ('שטיפת כלים',              'medium', 15, $1),
        ('סידור חדר אחד בבית',      'medium', 15, $1),
        ('עריכת שולחן לארוחה',      'medium', 15, $1),
        ('קיפול כביסה של כל הבית', 'hard',   30, $1),
        ('סידור של כל הבית',        'hard',   30, $1),
        ('הכנת ארוחה לכל בני הבית','hard',   30, $1),
        ('ביצוע קנייה בסופר',       'hard',   30, $1)`,
      [familyId]
    );

    await client.query('COMMIT');
    res.status(201).json(family);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'שגיאה ביצירת המשפחה' });
  } finally {
    client.release();
  }
});

export default router;
