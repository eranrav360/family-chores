import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getFamily } from '../api';
import type { FamilyMember } from '../types';

interface AppContextType {
  familyCode: string | null;
  setFamilyCode: (code: string | null) => void;
  family: FamilyMember[];
  loading: boolean;
  error: string | null;
  isAdminAuthenticated: boolean;
  setAdminAuthenticated: (val: boolean) => void;
  refreshFamily: () => Promise<void>;
  activeMemberId: number | null;
  setActiveMemberId: (id: number | null) => void;
}

const AppContext = createContext<AppContextType>({
  familyCode: null,
  setFamilyCode: () => {},
  family: [],
  loading: false,
  error: null,
  isAdminAuthenticated: false,
  setAdminAuthenticated: () => {},
  refreshFamily: async () => {},
  activeMemberId: null,
  setActiveMemberId: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdminAuthenticated, setAdminAuthenticated] = useState(false);
  const [activeMemberId, setActiveMemberId] = useState<number | null>(null);

  const refreshFamily = useCallback(async () => {
    if (!familyCode) return;
    setLoading(true);
    setError(null);
    try {
      // Fire a lightweight wake-up ping so the Render server starts warming up
      // immediately (fire-and-forget — errors are intentionally ignored).
      const apiBase = (import.meta as { env: Record<string, string> }).env.VITE_API_URL || '/api';
      const healthUrl = apiBase.replace(/\/api\/?$/, '/health');
      fetch(healthUrl).catch(() => {});
      const members = await getFamily(familyCode);
      setFamily(members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת נתוני המשפחה');
    } finally {
      setLoading(false);
    }
  }, [familyCode]);

  useEffect(() => {
    if (familyCode) {
      refreshFamily();
    }
  }, [familyCode, refreshFamily]);

  return (
    <AppContext.Provider
      value={{
        familyCode,
        setFamilyCode,
        family,
        loading,
        error,
        isAdminAuthenticated,
        setAdminAuthenticated,
        refreshFamily,
        activeMemberId,
        setActiveMemberId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
