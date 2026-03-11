import type {
  Family,
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

// Helper: build family-scoped path prefix
const f = (familyCode: string) => `/f/${familyCode}`;

// ── Family registry (no familyCode needed) ───────────────────────────────────
export const checkFamilyCode = (code: string) =>
  apiFetch<Family>(`/families/${code.toLowerCase()}`);

export const createFamily = (data: { name: string; code: string; admin_pin?: string }) =>
  apiFetch<Family>('/families', { method: 'POST', body: JSON.stringify(data) });

// ── Family members ────────────────────────────────────────────────────────────
export const getFamily = (familyCode: string) =>
  apiFetch<FamilyMember[]>(`${f(familyCode)}/family`);

export const createMember = (familyCode: string, data: { name: string; avatar_emoji: string }) =>
  apiFetch<FamilyMember>(`${f(familyCode)}/family`, { method: 'POST', body: JSON.stringify(data) });

export const updateMember = (familyCode: string, id: number, data: { name: string; avatar_emoji: string }) =>
  apiFetch<FamilyMember>(`${f(familyCode)}/family/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteMember = (familyCode: string, id: number) =>
  apiFetch<{ success: boolean }>(`${f(familyCode)}/family/${id}`, { method: 'DELETE' });

// ── Chores ────────────────────────────────────────────────────────────────────
export const getChores = (familyCode: string, active?: boolean) =>
  apiFetch<Chore[]>(`${f(familyCode)}/chores${active !== undefined ? `?active=${active}` : ''}`);

export const createChore = (familyCode: string, data: { name: string; difficulty: string; points: number }) =>
  apiFetch<Chore>(`${f(familyCode)}/chores`, { method: 'POST', body: JSON.stringify(data) });

export const updateChore = (familyCode: string, id: number, data: Partial<Chore>) =>
  apiFetch<Chore>(`${f(familyCode)}/chores/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteChore = (familyCode: string, id: number) =>
  apiFetch<{ success: boolean }>(`${f(familyCode)}/chores/${id}`, { method: 'DELETE' });

// ── Logs ──────────────────────────────────────────────────────────────────────
export const getLogs = (familyCode: string, filters?: {
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
  return apiFetch<ChoreLog[]>(`${f(familyCode)}/logs${params}`);
};

export const logChore = (familyCode: string, data: { family_member_id: number; chore_id: number }) =>
  apiFetch<LogChoreResponse>(`${f(familyCode)}/logs`, { method: 'POST', body: JSON.stringify(data) });

// ── Goals ─────────────────────────────────────────────────────────────────────
export const getGoals = (familyCode: string) =>
  apiFetch<Goal[]>(`${f(familyCode)}/goals`);

export const getCurrentPeriods = (familyCode: string) =>
  apiFetch<CurrentPeriods>(`${f(familyCode)}/goals/current`);

export const updateGoal = (
  familyCode: string,
  type: 'weekly' | 'monthly' | 'personal_weekly' | 'personal_monthly',
  target_points: number
) => apiFetch<Goal>(`${f(familyCode)}/goals/${type}`, { method: 'PUT', body: JSON.stringify({ target_points }) });

export const setReward = (familyCode: string, type: string, period_key: string, reward_chosen: string) =>
  apiFetch(`${f(familyCode)}/goals/periods/${type}/reward`, {
    method: 'PUT',
    body: JSON.stringify({ period_key, reward_chosen }),
  });

// ── Achievements ──────────────────────────────────────────────────────────────
export const getAchievements = (familyCode: string, member_id?: number) =>
  apiFetch<Achievement[]>(`${f(familyCode)}/achievements${member_id ? `?member_id=${member_id}` : ''}`);

// ── Admin ─────────────────────────────────────────────────────────────────────
export const verifyPin = (familyCode: string, pin: string) =>
  apiFetch<{ success: boolean }>(`${f(familyCode)}/admin/verify`, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });

export const changePin = (familyCode: string, old_pin: string, new_pin: string) =>
  apiFetch<{ success: boolean }>(`${f(familyCode)}/admin/pin`, {
    method: 'PUT',
    body: JSON.stringify({ old_pin, new_pin }),
  });

export const changeFamilyCode = (familyCode: string, new_code: string) =>
  apiFetch<Family>(`${f(familyCode)}/admin/code`, {
    method: 'PATCH',
    body: JSON.stringify({ new_code }),
  });

export const resetPeriod = (familyCode: string, type: string, period_key: string) =>
  apiFetch<{ success: boolean }>(`${f(familyCode)}/admin/reset`, {
    method: 'POST',
    body: JSON.stringify({ type, period_key }),
  });
