import { useState, useCallback } from 'react';
import { AppUser } from '../types';

interface AuthState {
  authToken: string | null;
  currentUser: AppUser | null;
}

interface UseAuthReturn extends AuthState {
  setAuthToken: (t: string | null) => void;
  setCurrentUser: (u: AppUser | null) => void;
  handleLogin: (token: string, user: AppUser) => void;
  handleLogout: () => void;
}

export function useAuth(): UseAuthReturn {
  const [authToken, setAuthToken] = useState<string | null>(
    () => localStorage.getItem('consultio_token')
  );
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const handleLogin = useCallback((token: string, user: AppUser) => {
    localStorage.setItem('consultio_token', token);
    setAuthToken(token);
    setCurrentUser(user);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('consultio_token');
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('consultio_platform_token');
  }, []);

  return { authToken, currentUser, setAuthToken, setCurrentUser, handleLogin, handleLogout };
}
