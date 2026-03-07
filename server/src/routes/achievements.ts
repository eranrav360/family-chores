import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET achievements (optionally filter by member_id)
router.get('/', async (req: Request, res: Response) => {
  const { member_id } = req.query;
  try {
    let query = `
      SELECT a.*, fm.name AS member_name, fm.avatar_emoji
      FROM achievements a
      JOIN family_members fm ON fm.id = a.family_member_id
      WHERE 1=1
    `;
    const params: number[] = [];
    if (member_id) {
      query += ` AND a.family_member_id = $1`;
      params.push(Number(member_id));
    }
    query += ' ORDER BY a.earned_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת ההישגים' });
  }
});

export default router;
