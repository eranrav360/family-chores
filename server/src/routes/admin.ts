import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// POST verify PIN
router.post('/verify', async (req: Request, res: Response) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'קוד PIN חסר' });
  try {
    const { rows } = await pool.query(
      `SELECT value FROM admin_config WHERE key = 'admin_pin'`
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
      `SELECT value FROM admin_config WHERE key = 'admin_pin'`
    );
    if (rows.length === 0 || rows[0].value !== String(old_pin)) {
      return res.status(401).json({ error: 'קוד נוכחי שגוי' });
    }
    await pool.query(
      `UPDATE admin_config SET value = $1, updated_at = NOW() WHERE key = 'admin_pin'`,
      [String(new_pin)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בשינוי הקוד' });
  }
});

// POST reset period data (deletes logs for the given period)
router.post('/reset', async (req: Request, res: Response) => {
  const { type, period_key } = req.body;
  if (!type || !period_key) {
    return res.status(400).json({ error: 'סוג תקופה ומפתח הם שדות חובה' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (type === 'weekly') {
      // period_key = "YYYY-WWW"
      const [yearStr, weekPart] = period_key.split('-W');
      await client.query(
        `DELETE FROM chore_logs WHERE week_number = $1 AND year = $2`,
        [parseInt(weekPart), parseInt(yearStr)]
      );
    } else if (type === 'monthly') {
      // period_key = "YYYY-MM"
      const [yearStr, monthStr] = period_key.split('-');
      await client.query(
        `DELETE FROM chore_logs WHERE month_number = $1 AND year = $2`,
        [parseInt(monthStr), parseInt(yearStr)]
      );
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'סוג תקופה לא חוקי' });
    }

    // Remove the period tracking + achievements for this period
    await client.query(
      `DELETE FROM goal_periods WHERE goal_type = $1 AND period_key = $2`,
      [type, period_key]
    );
    await client.query(
      `DELETE FROM achievements WHERE period_key = $1`,
      [period_key]
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
