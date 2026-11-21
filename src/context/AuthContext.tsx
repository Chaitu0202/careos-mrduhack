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
  location?: string;
  bedsCount?: number;
  departmentsCount?: number;
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
  refreshMe: () => Promise<AuthUser | null>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AuthUser>;
  /** Instantly switches the active session to another demo workspace/persona. */
  switchWorkspace: (targetId: string) => Promise<AuthUser>;
  signup: (payload: SignupPayload) => Promise<AuthUser>;
  claimAdmin: (payload: ClaimAdminPayload) => Promise<AuthUser>;
  changeDefaultPassword: (currentPassword: string, newPassword: string) => Promise<AuthUser>;
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
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (!res.ok) {
          throw new Error(`Request failed (${res.status}).`);
        }
        throw new Error('Unexpected non-JSON response from server. Please refresh and try again.');
      }
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

  const refreshMe = useCallback(async (): Promise<AuthUser | null> => {
    if (!token) return null;
    try {
      const data = await apiFetch<{ user: AuthUser }>('/api/auth/me');
      setUser(data.user);
      return data.user;
    } catch {
      return null;
    }
  }, [apiFetch, token]);

  const parseJsonAuthResponse = async (res: Response, fallbackMsg: string) => {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        `Authentication service returned an unexpected response (${res.status}). Check server/API routing.`
      );
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || fallbackMsg);
    }
    return data;
  };

  const login = useCallback(async (email: string, password: string, rememberMe = false): Promise<AuthUser> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe }),
    });
    const result = (await parseJsonAuthResponse(res, 'Sign in failed.')) as {
      token: string;
      user: AuthUser;
    };
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const switchWorkspace = useCallback(
    async (targetId: string): Promise<AuthUser> => {
      if (!token) {
        throw new Error('Please sign in before switching dashboards.');
      }
      const res = await fetch('/api/auth/switch-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetId }),
      });
      const result = (await parseJsonAuthResponse(res, 'Workspace switch failed.')) as {
        token: string;
        user: AuthUser;
      };
      setToken(result.token);
      setUser(result.user);
      return result.user;
    },
    [token]
  );

  const signup = useCallback(async (payload: SignupPayload): Promise<AuthUser> => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = (await parseJsonAuthResponse(res, 'Registration failed.')) as {
      token: string;
      user: AuthUser;
    };
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
      const result = (await parseJsonAuthResponse(res, 'Administrator setup failed.')) as {
        token: string;
        user: AuthUser;
      };
      setToken(result.token);
      setUser(result.user);
      await refreshAdminStatus();
      return result.user;
    },
    [refreshAdminStatus]
  );

  const changeDefaultPassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<AuthUser> => {
      const res = await apiFetch<{ ok: boolean; user: AuthUser }>('/api/auth/change-default-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setUser(res.user);
      return res.user;
    },
    [apiFetch]
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
        refreshMe,
        login,
        switchWorkspace,
        signup,
        claimAdmin,
        changeDefaultPassword,
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
