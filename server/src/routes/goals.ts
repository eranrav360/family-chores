import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

function getISOWeekData(date: Date): { weekNum: number; isoYear: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { weekNum, isoYear: d.getFullYear() };
}

// GET goals config
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM goals ORDER BY type');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת המטרות' });
  }
});

// GET current week + month period data (dashboard use)
router.get('/current', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const { weekNum, isoYear } = getISOWeekData(now);
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();
    const weekKey  = `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const [goalsRes, weekPts, monthPts, weekByMember, monthByMember, periodsRes] =
      await Promise.all([
        pool.query('SELECT * FROM goals'),
        pool.query(
          `SELECT COALESCE(SUM(points_earned),0) AS total FROM chore_logs
           WHERE week_number = $1 AND year = $2`, [weekNum, isoYear]
        ),
        pool.query(
          `SELECT COALESCE(SUM(points_earned),0) AS total FROM chore_logs
           WHERE month_number = $1 AND year = $2`, [month, year]
        ),
        pool.query(
          `SELECT fm.id, fm.name, fm.avatar_emoji,
                  COALESCE(SUM(cl.points_earned),0) AS weekly_points
           FROM family_members fm
           LEFT JOIN chore_logs cl
             ON cl.family_member_id = fm.id
             AND cl.week_number = $1 AND cl.year = $2
           GROUP BY fm.id, fm.name, fm.avatar_emoji
           ORDER BY fm.id`, [weekNum, isoYear]
        ),
        pool.query(
          `SELECT fm.id, fm.name, fm.avatar_emoji,
                  COALESCE(SUM(cl.points_earned),0) AS monthly_points
           FROM family_members fm
           LEFT JOIN chore_logs cl
             ON cl.family_member_id = fm.id
             AND cl.month_number = $1 AND cl.year = $2
           GROUP BY fm.id, fm.name, fm.avatar_emoji
           ORDER BY fm.id`, [month, year]
        ),
        pool.query(
          `SELECT * FROM goal_periods
           WHERE (goal_type = 'weekly'  AND period_key = $1)
              OR (goal_type = 'monthly' AND period_key = $2)`,
          [weekKey, monthKey]
        ),
      ]);

    const goals               = goalsRes.rows;
    const weeklyGoal          = goals.find((g) => g.type === 'weekly');
    const monthlyGoal         = goals.find((g) => g.type === 'monthly');
    const personalWeeklyGoal  = goals.find((g) => g.type === 'personal_weekly');
    const personalMonthlyGoal = goals.find((g) => g.type === 'personal_monthly');
    const personalWeeklyTarget  = personalWeeklyGoal?.target_points  ?? 40;
    const personalMonthlyTarget = personalMonthlyGoal?.target_points ?? 150;

    const weeklyPeriod  = periodsRes.rows.find((p) => p.goal_type === 'weekly');
    const monthlyPeriod = periodsRes.rows.find((p) => p.goal_type === 'monthly');

    // Annotate each member with whether they've met their personal goal
    const weekMembersAnnotated = weekByMember.rows.map((m) => ({
      ...m,
      personal_achieved: parseInt(m.weekly_points) >= personalWeeklyTarget,
    }));
    const monthMembersAnnotated = monthByMember.rows.map((m) => ({
      ...m,
      personal_achieved: parseInt(m.monthly_points) >= personalMonthlyTarget,
    }));

    res.json({
      weekly: {
        target:          weeklyGoal?.target_points ?? 100,
        current:         parseInt(weekPts.rows[0].total),
        achieved:        weeklyPeriod?.achieved ?? false,
        reward_chosen:   weeklyPeriod?.reward_chosen ?? null,
        period_key:      weekKey,
        week_num:        weekNum,
        year:            isoYear,
        personal_target: personalWeeklyTarget,
        members:         weekMembersAnnotated,
      },
      monthly: {
        target:          monthlyGoal?.target_points ?? 400,
        current:         parseInt(monthPts.rows[0].total),
        achieved:        monthlyPeriod?.achieved ?? false,
        reward_chosen:   monthlyPeriod?.reward_chosen ?? null,
        period_key:      monthKey,
        month,
        year,
        personal_target: personalMonthlyTarget,
        members:         monthMembersAnnotated,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת נתוני התקופה' });
  }
});

// PUT update goal target
router.put('/:type', async (req: Request, res: Response) => {
  const { type } = req.params;
  const { target_points } = req.body;
  if (!['weekly', 'monthly', 'personal_weekly', 'personal_monthly'].includes(type)) {
    return res.status(400).json({ error: 'סוג מטרה לא חוקי' });
  }
  if (!target_points || Number(target_points) < 1) {
    return res.status(400).json({ error: 'יעד נקודות חייב להיות מספר חיובי' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE goals SET target_points = $1, updated_at = NOW() WHERE type = $2 RETURNING *`,
      [target_points, type]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בעדכון המטרה' });
  }
});

// PUT choose reward for a period
router.put('/periods/:type/reward', async (req: Request, res: Response) => {
  const { type } = req.params;
  const { period_key, reward_chosen } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO goal_periods (goal_type, period_key, period_start, achieved, reward_chosen)
       VALUES ($1, $2, NOW(), TRUE, $3)
       ON CONFLICT (goal_type, period_key)
       DO UPDATE SET reward_chosen = $3 RETURNING *`,
      [type, period_key, reward_chosen]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בבחירת הפרס' });
  }
});

export default router;
