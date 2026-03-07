import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET all chores (optionally filter by active)
router.get('/', async (req: Request, res: Response) => {
  const { active } = req.query;
  try {
    let query = 'SELECT * FROM chores';
    if (active === 'true') {
      query += ' WHERE active = TRUE';
    }
    query += ' ORDER BY CASE difficulty WHEN \'easy\' THEN 1 WHEN \'medium\' THEN 2 WHEN \'hard\' THEN 3 END, name';
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת המטלות' });
  }
});

// POST create new chore
router.post('/', async (req: Request, res: Response) => {
  const { name, difficulty, points } = req.body;
  if (!name || !difficulty || points == null) {
    return res.status(400).json({ error: 'שם, רמת קושי ונקודות הם שדות חובה' });
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    return res.status(400).json({ error: 'רמת קושי לא חוקית' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO chores (name, difficulty, points) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), difficulty, points]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה ביצירת מטלה' });
  }
});

// PUT update chore
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, difficulty, points, active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE chores
       SET name = COALESCE($1, name),
           difficulty = COALESCE($2, difficulty),
           points = COALESCE($3, points),
           active = COALESCE($4, active)
       WHERE id = $5 RETURNING *`,
      [name?.trim() ?? null, difficulty ?? null, points ?? null, active ?? null, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'מטלה לא נמצאה' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון מטלה' });
  }
});

// DELETE (soft delete) chore
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE chores SET active = FALSE WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בהסרת מטלה' });
  }
});

export default router;
