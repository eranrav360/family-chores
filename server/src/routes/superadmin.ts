import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

function authCheck(req: Request, res: Response): boolean {
  const key = req.headers['x-super-admin-key'];
  if (!process.env.SUPER_ADMIN_KEY || key !== process.env.SUPER_ADMIN_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// GET /api/superadmin/families — list all families with member count
router.get('/families', async (req: Request, res: Response) => {
  if (!authCheck(req, res)) return;
  try {
    const { rows } = await pool.query(`
      SELECT
        f.id,
        f.name,
        f.code,
        f.created_at,
        COUNT(fm.id)::int AS member_count
      FROM families f
      LEFT JOIN family_members fm ON fm.family_id = f.id
      GROUP BY f.id
      ORDER BY f.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/superadmin/families/:id — delete a family and all its data
router.delete('/families/:id', async (req: Request, res: Response) => {
  if (!authCheck(req, res)) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const familyId = parseInt(req.params.id);

    // Delete chore_logs and achievements via family_members
    await client.query(`
      DELETE FROM chore_logs
      WHERE family_member_id IN (SELECT id FROM family_members WHERE family_id = $1)
    `, [familyId]);
    await client.query(`
      DELETE FROM achievements
      WHERE family_member_id IN (SELECT id FROM family_members WHERE family_id = $1)
    `, [familyId]);

    // Delete scoped tables
    await client.query('DELETE FROM family_members WHERE family_id = $1', [familyId]);
    await client.query('DELETE FROM chores WHERE family_id = $1', [familyId]);
    await client.query('DELETE FROM goals WHERE family_id = $1', [familyId]);
    await client.query('DELETE FROM goal_periods WHERE family_id = $1', [familyId]);
    await client.query('DELETE FROM admin_config WHERE family_id = $1', [familyId]);
    await client.query('DELETE FROM families WHERE id = $1', [familyId]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
