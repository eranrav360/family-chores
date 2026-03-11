import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

/** Week number with Sunday as week start (Israeli calendar).
 *  Weeks are assigned to the year containing their Saturday. */
function getSundayWeekData(date: Date): { weekNum: number; isoYear: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Move back to the Sunday of this week
  d.setDate(d.getDate() - d.getDay());
  // The week belongs to the year of its Saturday
  const saturday = new Date(d);
  saturday.setDate(d.getDate() + 6);
  const isoYear = saturday.getFullYear();
  // Week 1 starts on the Sunday that contains Jan 1 of that year
  const jan1 = new Date(isoYear, 0, 1);
  const week1Start = new Date(isoYear, 0, 1 - jan1.getDay());
  const weekNum = Math.floor((d.getTime() - week1Start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return { weekNum, isoYear };
}

// GET goals config
router.get('/', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM goals WHERE family_id = $1 ORDER BY type',
      [req.family.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת המטרות' });
  }
});

// GET current week + month period data (dashboard use)
router.get('/current', async (req: Request, res: Response) => {
  const familyId = req.family.id;
  try {
    const now = new Date();
    const { weekNum, isoYear } = getSundayWeekData(now);
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();
    const weekKey  = `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    const [goalsRes, weekPts, monthPts, weekByMember, monthByMember, periodsRes] =
      await Promise.all([
        pool.query('SELECT * FROM goals WHERE family_id = $1', [familyId]),
        pool.query(
          `SELECT COALESCE(SUM(cl.points_earned),0) AS total FROM chore_logs cl
           JOIN family_members fm ON fm.id = cl.family_member_id
           WHERE fm.family_id = $3 AND cl.week_number = $1 AND cl.year = $2`,
          [weekNum, isoYear, familyId]
        ),
        pool.query(
          `SELECT COALESCE(SUM(cl.points_earned),0) AS total FROM chore_logs cl
           JOIN family_members fm ON fm.id = cl.family_member_id
           WHERE fm.family_id = $3 AND cl.month_number = $1 AND cl.year = $2`,
          [month, year, familyId]
        ),
        pool.query(
          `SELECT fm.id, fm.name, fm.avatar_emoji,
                  COALESCE(SUM(cl.points_earned),0) AS weekly_points
           FROM family_members fm
           LEFT JOIN chore_logs cl
             ON cl.family_member_id = fm.id
             AND cl.week_number = $1 AND cl.year = $2
           WHERE fm.family_id = $3
           GROUP BY fm.id, fm.name, fm.avatar_emoji
           ORDER BY fm.id`,
          [weekNum, isoYear, familyId]
        ),
        pool.query(
          `SELECT fm.id, fm.name, fm.avatar_emoji,
                  COALESCE(SUM(cl.points_earned),0) AS monthly_points
           FROM family_members fm
           LEFT JOIN chore_logs cl
             ON cl.family_member_id = fm.id
             AND cl.month_number = $1 AND cl.year = $2
           WHERE fm.family_id = $3
           GROUP BY fm.id, fm.name, fm.avatar_emoji
           ORDER BY fm.id`,
          [month, year, familyId]
        ),
        pool.query(
          `SELECT * FROM goal_periods
           WHERE family_id = $3
             AND ((goal_type = 'weekly'  AND period_key = $1)
               OR (goal_type = 'monthly' AND period_key = $2))`,
          [weekKey, monthKey, familyId]
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
      `UPDATE goals SET target_points = $1, updated_at = NOW() WHERE type = $2 AND family_id = $3 RETURNING *`,
      [target_points, type, req.family.id]
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
      `INSERT INTO goal_periods (goal_type, period_key, period_start, achieved, reward_chosen, family_id)
       VALUES ($1, $2, NOW(), TRUE, $3, $4)
       ON CONFLICT (family_id, goal_type, period_key)
       DO UPDATE SET reward_chosen = $3 RETURNING *`,
      [type, period_key, reward_chosen, req.family.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בבחירת הפרס' });
  }
});

export default router;
