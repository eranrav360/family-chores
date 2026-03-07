import { useApp } from '../context/AppContext';
import { verifyPin } from '../api';
import { useState } from 'react';

export function useAdminAuth() {
  const { isAdminAuthenticated, setAdminAuthenticated } = useApp();
  const [verifying, setVerifying] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const authenticate = async (pin: string): Promise<boolean> => {
    setVerifying(true);
    setPinError(null);
    try {
      await verifyPin(pin);
      setAdminAuthenticated(true);
      return true;
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'קוד שגוי');
      return false;
    } finally {
      setVerifying(false);
    }
  };

  const logout = () => setAdminAuthenticated(false);

  return { isAdminAuthenticated, authenticate, logout, verifying, pinError, setPinError };
}
