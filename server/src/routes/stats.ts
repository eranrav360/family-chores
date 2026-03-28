import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// GET /stats?member_id=X&month=M&year=Y
router.get('/', async (req: Request, res: Response) => {
  const { member_id, month, year } = req.query;

  if (!member_id) {
    return res.status(400).json({ error: 'member_id is required' });
  }

  const now = new Date();
  const targetMonth = month ? Number(month) : now.getMonth() + 1;
  const targetYear  = year  ? Number(year)  : now.getFullYear();
  const memberId    = Number(member_id);
  const familyId    = req.family.id;

  try {
    const { rows } = await pool.query(
      `SELECT
         cl.id,
         cl.points_earned,
         cl.week_number,
         cl.year        AS log_year,
         cl.logged_at,
         EXTRACT(DOW FROM cl.logged_at AT TIME ZONE 'Asia/Jerusalem')::int AS day_of_week,
         COALESCE(c.name, cl.chore_id::text) AS chore_name,
         COALESCE(c.difficulty, 'easy')      AS difficulty
       FROM chore_logs cl
       JOIN family_members fm ON fm.id = cl.family_member_id
       LEFT JOIN chores c ON c.id = cl.chore_id
       WHERE fm.family_id    = $1
         AND cl.family_member_id = $2
         AND cl.month_number = $3
         AND cl.year         = $4`,
      [familyId, memberId, targetMonth, targetYear]
    );

    if (rows.length === 0) {
      return res.json({
        totalChores: 0,
        totalPoints: 0,
        mostCommonChore: null,
        busiestDay: null,
        uniqueChores: 0,
        byDifficulty: { easy: 0, medium: 0, hard: 0 },
        bestWeek: null,
      });
    }

    // ── Aggregations ─────────────────────────────────────────────
    const totalChores = rows.length;
    const totalPoints = rows.reduce((s, r) => s + Number(r.points_earned), 0);

    // Most common chore
    const choreCounts: Record<string, number> = {};
    for (const r of rows) {
      choreCounts[r.chore_name] = (choreCounts[r.chore_name] ?? 0) + 1;
    }
    const [topChoreName, topChoreCount] = Object.entries(choreCounts).sort((a, b) => b[1] - a[1])[0];
    const mostCommonChore = { name: topChoreName, count: topChoreCount };

    // Most busy day of week
    const dayCounts: Record<number, number> = {};
    for (const r of rows) {
      const d = Number(r.day_of_week);
      dayCounts[d] = (dayCounts[d] ?? 0) + 1;
    }
    const [topDayNum, topDayCount] = Object.entries(dayCounts)
      .sort((a, b) => Number(b[1]) - Number(a[1]))[0]
      .map(Number) as [number, number];
    const busiestDay = { day: HEBREW_DAYS[topDayNum], count: topDayCount };

    // Unique chores
    const uniqueChores = Object.keys(choreCounts).length;

    // Difficulty breakdown
    const byDifficulty = { easy: 0, medium: 0, hard: 0 };
    for (const r of rows) {
      const d = r.difficulty as keyof typeof byDifficulty;
      if (d in byDifficulty) byDifficulty[d]++;
    }

    // Best week in month (by points)
    const weekPoints: Record<string, number> = {};
    for (const r of rows) {
      const key = `${r.log_year}-W${String(r.week_number).padStart(2, '0')}`;
      weekPoints[key] = (weekPoints[key] ?? 0) + Number(r.points_earned);
    }
    const [bestWeekKey, bestWeekPoints] = Object.entries(weekPoints).sort((a, b) => b[1] - a[1])[0];
    const bestWeek = { week_key: bestWeekKey, points: bestWeekPoints };

    res.json({
      totalChores,
      totalPoints,
      mostCommonChore,
      busiestDay,
      uniqueChores,
      byDifficulty,
      bestWeek,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'שגיאה בטעינת הסטטיסטיקות' });
  }
});

export default router;
