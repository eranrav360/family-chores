import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getFamily } from '../api';
import type { FamilyMember } from '../types';

interface AppContextType {
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
  family: [],
  loading: true,
  error: null,
  isAdminAuthenticated: false,
  setAdminAuthenticated: () => {},
  refreshFamily: async () => {},
  activeMemberId: null,
  setActiveMemberId: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdminAuthenticated, setAdminAuthenticated] = useState(false);
  const [activeMemberId, setActiveMemberId] = useState<number | null>(null);

  const refreshFamily = useCallback(async () => {
    try {
      setError(null);
      const members = await getFamily();
      setFamily(members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת נתוני המשפחה');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFamily();
  }, [refreshFamily]);

  return (
    <AppContext.Provider
      value={{ family, loading, error, isAdminAuthenticated, setAdminAuthenticated, refreshFamily, activeMemberId, setActiveMemberId }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
