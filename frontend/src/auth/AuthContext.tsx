import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onUnauthenticated, request } from '../api/client';
import type { User } from '../lib/types';

type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onUnauthenticated(() => setUser(null));
    let active = true;
    request<{ user: User }>('GET', '/auth/me')
      .then((res) => active && setUser(res.user))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await request<{ user: User }>('POST', '/auth/login', { email, password });
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await request<{ user: User }>('POST', '/auth/register', { email, password });
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await request<void>('POST', '/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
