import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AuthUser } from '../types/careos';

interface AdminStatus {
  adminClaimed: boolean;
  configuredByEnv: boolean;
}

interface SignupPayload {
  fullName: string;
  workEmail: string;
  password: string;
  hospitalName: string;
  hospitalType: string;
  contactNumber: string;
  agreedToTerms: boolean;
}

interface ClaimAdminPayload {
  fullName: string;
  email: string;
  password: string;
  hospitalName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  adminStatus: AdminStatus;
  refreshAdminStatus: () => Promise<void>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AuthUser>;
  signup: (payload: SignupPayload) => Promise<AuthUser>;
  claimAdmin: (payload: ClaimAdminPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  apiFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Token held strictly in React state memory (never localStorage or sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [adminStatus, setAdminStatus] = useState<AdminStatus>({
    adminClaimed: true,
    configuredByEnv: false,
  });

  const refreshAdminStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/admin-status');
      if (res.ok) {
        const data = (await res.json()) as AdminStatus;
        setAdminStatus(data);
      }
    } catch {
      // ignore transient network check failures
    }
  }, []);

  useEffect(() => {
    refreshAdminStatus();
  }, [refreshAdminStatus]);

  const apiFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers);
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(path, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 && token) {
          setToken(null);
          setUser(null);
        }
        throw new Error((data as { error?: string }).error || 'Request failed');
      }
      return data as T;
    },
    [token]
  );

  const login = useCallback(async (email: string, password: string, rememberMe = false): Promise<AuthUser> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || 'Sign in failed.');
    }
    const result = data as { token: string; user: AuthUser };
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const signup = useCallback(async (payload: SignupPayload): Promise<AuthUser> => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || 'Registration failed.');
    }
    const result = data as { token: string; user: AuthUser };
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const claimAdmin = useCallback(
    async (payload: ClaimAdminPayload): Promise<AuthUser> => {
      const res = await fetch('/api/auth/claim-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Administrator setup failed.');
      }
      const result = data as { token: string; user: AuthUser };
      setToken(result.token);
      setUser(result.user);
      await refreshAdminStatus();
      return result.user;
    },
    [refreshAdminStatus]
  );

  const logout = useCallback(async () => {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setToken(null);
    setUser(null);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        adminStatus,
        refreshAdminStatus,
        login,
        signup,
        claimAdmin,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
