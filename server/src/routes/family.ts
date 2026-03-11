import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET all family members
router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM family_members WHERE family_id = $1 ORDER BY id',
      [req.family.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת בני המשפחה' });
  }
});

// POST create family member
router.post('/', async (req: Request, res: Response) => {
  const { name, avatar_emoji } = req.body;
  if (!name || !avatar_emoji) {
    return res.status(400).json({ error: 'שם ואמוג׳י הם שדות חובה' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO family_members (name, avatar_emoji, family_id) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), avatar_emoji, req.family.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה ביצירת בן משפחה' });
  }
});

// PUT update family member
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, avatar_emoji } = req.body;
  if (!name || !avatar_emoji) {
    return res.status(400).json({ error: 'שם ואמוג׳י הם שדות חובה' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE family_members SET name = $1, avatar_emoji = $2 WHERE id = $3 AND family_id = $4 RETURNING *',
      [name.trim(), avatar_emoji, id, req.family.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'בן משפחה לא נמצא' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון בן משפחה' });
  }
});

// DELETE family member
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM family_members WHERE id = $1 AND family_id = $2', [id, req.family.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה במחיקת בן משפחה' });
  }
});

export default router;
