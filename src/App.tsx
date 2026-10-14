import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { Loading } from './components/Feedback';
import { AgentsPage } from './pages/AgentsPage';
import { DashboardPage } from './pages/DashboardPage';
import { FinancePage } from './pages/FinancePage';
import { LoginPage } from './pages/LoginPage';
import { SchoolsPage } from './pages/SchoolsPage';
import { StudentsPage } from './pages/StudentsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { TenantsPage } from './pages/TenantsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Vérification de la session…" />;
  return user ? <AppShell /> : <Navigate to="/login" replace />;
}

function RequireRoles({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth();
  return user?.roles.some((role) => roles.includes(role)) ? children : <Navigate to="/dashboard" replace />;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Vérification de la session…" />;
  return user ? <Navigate to="/dashboard" replace /> : <LoginPage />;
}

function RoutedApp() {
  return <Routes>
    <Route path="/login" element={<LoginRoute />} />
    <Route element={<RequireAuth />}>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/finance" element={<RequireRoles roles={['super_admin', 'tenant_admin']}><FinancePage /></RequireRoles>} />
      <Route path="/tenants" element={<RequireRoles roles={['super_admin']}><TenantsPage /></RequireRoles>} />
      <Route path="/schools" element={<SchoolsPage />} />
      <Route path="/agents" element={<AgentsPage />} />
      <Route path="/students" element={<StudentsPage />} />
      <Route path="/subscriptions" element={<RequireRoles roles={['super_admin']}><SubscriptionsPage /></RequireRoles>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><AuthProvider><BrowserRouter><RoutedApp /></BrowserRouter></AuthProvider></QueryClientProvider>;
}
