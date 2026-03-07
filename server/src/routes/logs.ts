import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

/** Returns ISO week number and ISO year for a given date */
function getISOWeekData(date: Date): { weekNum: number; isoYear: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return { weekNum, isoYear: d.getFullYear() };
}

// GET chore logs with optional filters
router.get('/', async (req: Request, res: Response) => {
  const { member_id, week, month, year } = req.query;
  try {
    let query = `
      SELECT
        cl.id,
        cl.family_member_id,
        cl.chore_id,
        cl.points_earned,
        cl.logged_at,
        cl.week_number,
        cl.month_number,
        cl.year,
        fm.name   AS member_name,
        fm.avatar_emoji,
        c.name    AS chore_name,
        c.difficulty
      FROM chore_logs cl
      JOIN family_members fm ON fm.id = cl.family_member_id
      LEFT JOIN chores c ON c.id = cl.chore_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    let idx = 1;

    if (member_id) { query += ` AND cl.family_member_id = $${idx++}`; params.push(Number(member_id)); }
    if (week)      { query += ` AND cl.week_number = $${idx++}`;       params.push(Number(week)); }
    if (month)     { query += ` AND cl.month_number = $${idx++}`;      params.push(Number(month)); }
    if (year)      { query += ` AND cl.year = $${idx++}`;              params.push(Number(year)); }

    query += ' ORDER BY cl.logged_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת ההיסטוריה' });
  }
});

// POST log a chore (optimistic-ready: fast response + achievement checks)
router.post('/', async (req: Request, res: Response) => {
  const { family_member_id, chore_id } = req.body;
  if (!family_member_id || !chore_id) {
    return res.status(400).json({ error: 'בן משפחה ומטלה הם שדות חובה' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load chore
    const choreResult = await client.query('SELECT * FROM chores WHERE id = $1 AND active = TRUE', [chore_id]);
    if (choreResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'מטלה לא נמצאה' });
    }
    const chore = choreResult.rows[0];

    const now = new Date();
    const { weekNum, isoYear } = getISOWeekData(now);
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Insert log
    const logResult = await client.query(
      `INSERT INTO chore_logs (family_member_id, chore_id, points_earned, week_number, month_number, year)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [family_member_id, chore_id, chore.points, weekNum, month, isoYear]
    );
    const newLog = logResult.rows[0];

    // ── Totals ──────────────────────────────────────────────────
    const weekKey   = `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
    const monthKey  = `${year}-${String(month).padStart(2, '0')}`;

    const [weeklyPts, monthlyPts, goalsRes, allMembersRes, weekByMemberRes, monthByMemberRes] =
      await Promise.all([
        client.query(
          `SELECT COALESCE(SUM(points_earned),0) AS total FROM chore_logs
           WHERE week_number = $1 AND year = $2`, [weekNum, isoYear]
        ),
        client.query(
          `SELECT COALESCE(SUM(points_earned),0) AS total FROM chore_logs
           WHERE month_number = $1 AND year = $2`, [month, year]
        ),
        client.query('SELECT type, target_points FROM goals'),
        client.query('SELECT id FROM family_members'),
        client.query(
          `SELECT family_member_id, COALESCE(SUM(points_earned),0) AS pts
           FROM chore_logs WHERE week_number = $1 AND year = $2
           GROUP BY family_member_id`, [weekNum, isoYear]
        ),
        client.query(
          `SELECT family_member_id, COALESCE(SUM(points_earned),0) AS pts
           FROM chore_logs WHERE month_number = $1 AND year = $2
           GROUP BY family_member_id`, [month, year]
        ),
      ]);

    const weeklyTotal   = parseInt(weeklyPts.rows[0].total);
    const monthlyTotal  = parseInt(monthlyPts.rows[0].total);
    const weeklyTarget          = goalsRes.rows.find((g) => g.type === 'weekly')?.target_points          ?? 100;
    const monthlyTarget         = goalsRes.rows.find((g) => g.type === 'monthly')?.target_points         ?? 400;
    const personalWeeklyTarget  = goalsRes.rows.find((g) => g.type === 'personal_weekly')?.target_points  ?? 40;
    const personalMonthlyTarget = goalsRes.rows.find((g) => g.type === 'personal_monthly')?.target_points ?? 150;

    // Build per-member points maps for this period
    const weekPtsMap  = Object.fromEntries(
      weekByMemberRes.rows.map((r) => [Number(r.family_member_id), parseInt(r.pts)])
    );
    const monthPtsMap = Object.fromEntries(
      monthByMemberRes.rows.map((r) => [Number(r.family_member_id), parseInt(r.pts)])
    );
    const allMemberIds: number[] = allMembersRes.rows.map((r) => Number(r.id));

    const newAchievements: string[] = [];

    // ── Weekly goal achievement ──────────────────────────────────
    // Award per-member: group goal MET  AND  member's personal goal MET
    if (weeklyTotal >= weeklyTarget) {
      for (const memberId of allMemberIds) {
        const memberPts = weekPtsMap[memberId] ?? 0;
        if (memberPts >= personalWeeklyTarget) {
          const existing = await client.query(
            `SELECT id FROM achievements
             WHERE family_member_id = $1 AND type = 'weekly_goal' AND period_key = $2`,
            [memberId, weekKey]
          );
          if (existing.rows.length === 0) {
            await client.query(
              `INSERT INTO achievements (family_member_id, type, period_key)
               VALUES ($1, 'weekly_goal', $2)`,
              [memberId, weekKey]
            );
            if (memberId === Number(family_member_id)) newAchievements.push('weekly_goal');
          }
        }
      }
      await client.query(
        `INSERT INTO goal_periods (goal_type, period_key, period_start, total_points, achieved)
         VALUES ('weekly', $1, NOW(), $2, TRUE)
         ON CONFLICT (goal_type, period_key) DO UPDATE SET achieved = TRUE, total_points = $2`,
        [weekKey, weeklyTotal]
      );
    }

    // ── Monthly goal achievement ─────────────────────────────────
    // Award per-member: group goal MET  AND  member's personal goal MET
    if (monthlyTotal >= monthlyTarget) {
      for (const memberId of allMemberIds) {
        const memberPts = monthPtsMap[memberId] ?? 0;
        if (memberPts >= personalMonthlyTarget) {
          const existing = await client.query(
            `SELECT id FROM achievements
             WHERE family_member_id = $1 AND type = 'monthly_goal' AND period_key = $2`,
            [memberId, monthKey]
          );
          if (existing.rows.length === 0) {
            await client.query(
              `INSERT INTO achievements (family_member_id, type, period_key)
               VALUES ($1, 'monthly_goal', $2)`,
              [memberId, monthKey]
            );
            if (memberId === Number(family_member_id)) newAchievements.push('monthly_goal');
          }
        }
      }
      await client.query(
        `INSERT INTO goal_periods (goal_type, period_key, period_start, total_points, achieved)
         VALUES ('monthly', $1, NOW(), $2, TRUE)
         ON CONFLICT (goal_type, period_key) DO UPDATE SET achieved = TRUE, total_points = $2`,
        [monthKey, monthlyTotal]
      );
    }

    // ── "עמל רב" – 5 chores this week by this child ─────────────
    const countRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM chore_logs
       WHERE family_member_id = $1 AND week_number = $2 AND year = $3`,
      [family_member_id, weekNum, isoYear]
    );
    if (parseInt(countRes.rows[0].cnt) >= 5) {
      const existing = await client.query(
        `SELECT id FROM achievements WHERE family_member_id = $1 AND type = 'hard_worker' AND period_key = $2`,
        [family_member_id, weekKey]
      );
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO achievements (family_member_id, type, period_key) VALUES ($1, 'hard_worker', $2)`,
          [family_member_id, weekKey]
        );
        newAchievements.push('hard_worker');
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      log: { ...newLog, chore_name: chore.name, difficulty: chore.difficulty },
      weeklyTotal,
      monthlyTotal,
      weeklyTarget,
      monthlyTarget,
      newAchievements,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'שגיאה בתיעוד המטלה' });
  } finally {
    client.release();
  }
});

export default router;
