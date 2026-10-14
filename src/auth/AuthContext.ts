import { createContext, useContext } from 'react';
import type { AdminUser } from '../types';

export interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  notice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
