import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

const CODE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$|^[a-z0-9]{2,30}$/;

// POST verify PIN
router.post('/verify', async (req: Request, res: Response) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'קוד PIN חסר' });
  try {
    const { rows } = await pool.query(
      `SELECT value FROM admin_config WHERE key = 'admin_pin' AND family_id = $1`,
      [req.family.id]
    );
    if (rows.length === 0 || rows[0].value !== String(pin)) {
      return res.status(401).json({ error: 'קוד שגוי, נסה שוב' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה באימות הקוד' });
  }
});

// PUT change PIN
router.put('/pin', async (req: Request, res: Response) => {
  const { old_pin, new_pin } = req.body;
  if (!old_pin || !new_pin) {
    return res.status(400).json({ error: 'יש להזין קוד ישן וקוד חדש' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT value FROM admin_config WHERE key = 'admin_pin' AND family_id = $1`,
      [req.family.id]
    );
    if (rows.length === 0 || rows[0].value !== String(old_pin)) {
      return res.status(401).json({ error: 'קוד נוכחי שגוי' });
    }
    await pool.query(
      `UPDATE admin_config SET value = $1, updated_at = NOW() WHERE key = 'admin_pin' AND family_id = $2`,
      [String(new_pin), req.family.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בשינוי הקוד' });
  }
});

// PATCH change family code
router.patch('/code', async (req: Request, res: Response) => {
  const { new_code } = req.body;
  if (!new_code) return res.status(400).json({ error: 'קוד חסר' });
  const normalCode = String(new_code).toLowerCase().trim();
  if (!CODE_RE.test(normalCode)) {
    return res.status(400).json({
      error: 'הקוד חייב להכיל 2-30 תווים: אותיות באנגלית, מספרים או מקף',
    });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE families SET code = $1 WHERE id = $2 RETURNING id, name, code',
      [normalCode, req.family.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'משפחה לא נמצאה' });
    res.json(rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'קוד זה כבר תפוס, נסה קוד אחר' });
    }
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון הקוד' });
  }
});

// POST reset period data (deletes logs for the given period) — scoped to this family
router.post('/reset', async (req: Request, res: Response) => {
  const { type, period_key } = req.body;
  if (!type || !period_key) {
    return res.status(400).json({ error: 'סוג תקופה ומפתח הם שדות חובה' });
  }
  const familyId = req.family.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (type === 'weekly') {
      // period_key = "YYYY-WWW"
      const [yearStr, weekPart] = period_key.split('-W');
      await client.query(
        `DELETE FROM chore_logs WHERE id IN (
           SELECT cl.id FROM chore_logs cl
           JOIN family_members fm ON fm.id = cl.family_member_id
           WHERE fm.family_id = $3 AND cl.week_number = $1 AND cl.year = $2
         )`,
        [parseInt(weekPart), parseInt(yearStr), familyId]
      );
    } else if (type === 'monthly') {
      // period_key = "YYYY-MM"
      const [yearStr, monthStr] = period_key.split('-');
      await client.query(
        `DELETE FROM chore_logs WHERE id IN (
           SELECT cl.id FROM chore_logs cl
           JOIN family_members fm ON fm.id = cl.family_member_id
           WHERE fm.family_id = $3 AND cl.month_number = $1 AND cl.year = $2
         )`,
        [parseInt(monthStr), parseInt(yearStr), familyId]
      );
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'סוג תקופה לא חוקי' });
    }

    // Remove the period tracking for this family
    await client.query(
      `DELETE FROM goal_periods WHERE goal_type = $1 AND period_key = $2 AND family_id = $3`,
      [type, period_key, familyId]
    );
    // Remove achievements for this period scoped to family members
    await client.query(
      `DELETE FROM achievements
       WHERE period_key = $1
         AND family_member_id IN (SELECT id FROM family_members WHERE family_id = $2)`,
      [period_key, familyId]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'שגיאה באיפוס התקופה' });
  } finally {
    client.release();
  }
});

export default router;
