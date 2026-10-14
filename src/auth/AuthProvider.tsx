import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api, getApiError, getRefreshToken, hasAccessToken, refreshSessionTokens, registerSessionExpiredHandler, saveRefreshToken, setAccessToken, setSelectedTenant, unwrap } from '../lib/api';
import { AuthContext } from './AuthContext';
import type { AdminUser } from '../types';

function validateAdmin(user: AdminUser): void {
  if (!user.roles.some((role) => role === 'super_admin' || role === 'tenant_admin')) {
    throw new Error('Ce portail est réservé aux comptes super_admin et tenant_admin.');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    saveRefreshToken(null);
    setSelectedTenant(null);
    sessionStorage.removeItem('school-admin.tenant-id');
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  const loadProfile = useCallback(async () => {
    const profile = unwrap(await api.post<{ user: AdminUser }>('/auth/profile', {}));
    validateAdmin(profile.user);
    setUser(profile.user);
  }, []);

  const handleSessionExpired = useCallback(() => {
    clearSession();
    setNotice('Votre session a expiré. Reconnectez-vous pour continuer.');
  }, [clearSession]);

  useEffect(() => {
    registerSessionExpiredHandler(handleSessionExpired);
    const restore = async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        if (!hasAccessToken()) {
          setLoading(false);
          return;
        }
      }
      try {
        if (!hasAccessToken()) await refreshSessionTokens();
        await loadProfile();
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          clearSession();
          setNotice('Votre session a expiré. Reconnectez-vous pour continuer.');
        } else {
          setAccessToken(null);
          setNotice(getApiError(error));
        }
      } finally {
        setLoading(false);
      }
    };
    void restore();
    return () => registerSessionExpiredHandler(null);
  }, [clearSession, handleSessionExpired, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setNotice(null);
    const result = unwrap(await api.post<{ accessToken?: string; token?: string; refreshToken: string }>('/auth/login', { email, password }));
    const token = result.accessToken ?? result.token;
    if (!token || !result.refreshToken) throw new Error('La réponse de connexion ne contient pas les jetons attendus.');
    setAccessToken(token);
    saveRefreshToken(result.refreshToken);
    try {
      await loadProfile();
    } catch (error) {
      clearSession();
      throw error;
    }
  }, [clearSession, loadProfile]);

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (error) {
      setNotice(getApiError(error));
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(() => ({ user, loading, notice, signIn, signOut }), [user, loading, notice, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
