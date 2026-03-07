export interface FamilyMember {
  id: number;
  name: string;
  avatar_emoji: string;
  created_at: string;
}

export interface Chore {
  id: number;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  active: boolean;
  created_at: string;
}

export interface ChoreLog {
  id: number;
  family_member_id: number;
  chore_id: number;
  points_earned: number;
  logged_at: string;
  week_number: number;
  month_number: number;
  year: number;
  member_name: string;
  avatar_emoji: string;
  chore_name: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Goal {
  id: number;
  type: 'weekly' | 'monthly' | 'personal_weekly' | 'personal_monthly';
  target_points: number;
  updated_at: string;
}

export interface MemberPeriodPoints {
  id: number;
  name: string;
  avatar_emoji: string;
  weekly_points?: string;
  monthly_points?: string;
  personal_achieved?: boolean;
}

export interface PeriodData {
  target: number;
  current: number;
  achieved: boolean;
  reward_chosen: string | null;
  period_key: string;
  members: MemberPeriodPoints[];
  personal_target: number;
}

export interface CurrentPeriods {
  weekly: PeriodData & { week_num: number; year: number };
  monthly: PeriodData & { month: number; year: number };
}

export interface Achievement {
  id: number;
  family_member_id: number;
  type: string;
  period_key: string;
  earned_at: string;
  member_name: string;
  avatar_emoji: string;
}

export interface LogChoreResponse {
  log: ChoreLog;
  weeklyTotal: number;
  monthlyTotal: number;
  weeklyTarget: number;
  monthlyTarget: number;
  newAchievements: string[];
}

export type AchievementType = 'weekly_goal' | 'monthly_goal' | 'hard_worker';

export const ACHIEVEMENT_META: Record<AchievementType, { label: string; emoji: string; desc: string }> = {
  weekly_goal:   { label: 'שבוע מושלם',    emoji: '🌟', desc: 'עמדת ביעד האישי וביעד האחים!' },
  monthly_goal:  { label: 'חודש מושלם',    emoji: '🏆', desc: 'עמדת ביעד האישי וביעד האחים!' },
  hard_worker:   { label: 'עמל רב',         emoji: '💪', desc: '5 מטלות בשבוע אחד!' },
};

export const DIFFICULTY_META = {
  easy:   { label: 'קל',    color: '#10B981', bg: '#D1FAE5' },
  medium: { label: 'בינוני', color: '#F59E0B', bg: '#FEF3C7' },
  hard:   { label: 'קשה',   color: '#EF4444', bg: '#FEE2E2' },
} as const;
