import type {
  FamilyMember,
  Chore,
  ChoreLog,
  Goal,
  CurrentPeriods,
  Achievement,
  LogChoreResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'שגיאה לא צפויה');
  }
  return res.json() as Promise<T>;
}

// ── Family ───────────────────────────────────────────────────────────────────
export const getFamily = () => apiFetch<FamilyMember[]>('/family');

export const createMember = (data: { name: string; avatar_emoji: string }) =>
  apiFetch<FamilyMember>('/family', { method: 'POST', body: JSON.stringify(data) });

export const updateMember = (id: number, data: { name: string; avatar_emoji: string }) =>
  apiFetch<FamilyMember>(`/family/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteMember = (id: number) =>
  apiFetch<{ success: boolean }>(`/family/${id}`, { method: 'DELETE' });

// ── Chores ───────────────────────────────────────────────────────────────────
export const getChores = (active?: boolean) =>
  apiFetch<Chore[]>(`/chores${active !== undefined ? `?active=${active}` : ''}`);

export const createChore = (data: { name: string; difficulty: string; points: number }) =>
  apiFetch<Chore>('/chores', { method: 'POST', body: JSON.stringify(data) });

export const updateChore = (id: number, data: Partial<Chore>) =>
  apiFetch<Chore>(`/chores/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteChore = (id: number) =>
  apiFetch<{ success: boolean }>(`/chores/${id}`, { method: 'DELETE' });

// ── Logs ─────────────────────────────────────────────────────────────────────
export const getLogs = (filters?: {
  member_id?: number;
  week?: number;
  month?: number;
  year?: number;
}) => {
  const params = filters
    ? '?' + new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )
      ).toString()
    : '';
  return apiFetch<ChoreLog[]>(`/logs${params}`);
};

export const logChore = (data: { family_member_id: number; chore_id: number }) =>
  apiFetch<LogChoreResponse>('/logs', { method: 'POST', body: JSON.stringify(data) });

// ── Goals ────────────────────────────────────────────────────────────────────
export const getGoals = () => apiFetch<Goal[]>('/goals');

export const getCurrentPeriods = () => apiFetch<CurrentPeriods>('/goals/current');

export const updateGoal = (type: 'weekly' | 'monthly', target_points: number) =>
  apiFetch<Goal>(`/goals/${type}`, { method: 'PUT', body: JSON.stringify({ target_points }) });

export const setReward = (type: string, period_key: string, reward_chosen: string) =>
  apiFetch(`/goals/periods/${type}/reward`, {
    method: 'PUT',
    body: JSON.stringify({ period_key, reward_chosen }),
  });

// ── Achievements ─────────────────────────────────────────────────────────────
export const getAchievements = (member_id?: number) =>
  apiFetch<Achievement[]>(`/achievements${member_id ? `?member_id=${member_id}` : ''}`);

// ── Admin ────────────────────────────────────────────────────────────────────
export const verifyPin = (pin: string) =>
  apiFetch<{ success: boolean }>('/admin/verify', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });

export const changePin = (old_pin: string, new_pin: string) =>
  apiFetch<{ success: boolean }>('/admin/pin', {
    method: 'PUT',
    body: JSON.stringify({ old_pin, new_pin }),
  });

export const resetPeriod = (type: string, period_key: string) =>
  apiFetch<{ success: boolean }>('/admin/reset', {
    method: 'POST',
    body: JSON.stringify({ type, period_key }),
  });
