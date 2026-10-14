import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const accessTokenKey = 'school-admin.access-token';
const refreshTokenKey = 'school-admin.refresh-token';
let accessToken: string | null = sessionStorage.getItem(accessTokenKey);
const storedTenant = sessionStorage.getItem('school-admin.tenant-id');
let selectedTenantId: number | null = storedTenant && /^\d+$/.test(storedTenant) ? Number(storedTenant) : null;
let onSessionExpired: (() => void) | null = null;
interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

let refreshInProgress: Promise<SessionTokens> | null = null;
let sessionExpirationHandled = false;

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) sessionStorage.setItem(accessTokenKey, token);
  else sessionStorage.removeItem(accessTokenKey);
  if (token) sessionExpirationHandled = false;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

export function saveRefreshToken(token: string | null): void {
  if (token) sessionStorage.setItem(refreshTokenKey, token);
  else sessionStorage.removeItem(refreshTokenKey);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(refreshTokenKey);
}

export function refreshSessionTokens(): Promise<SessionTokens> {
  if (refreshInProgress) return refreshInProgress;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.reject(new Error('Aucun refresh token disponible.'));

  refreshInProgress = axios.post(`${baseURL}/auth/refresh`, { refreshToken }, { timeout: 20_000 })
    .then((response) => {
      const tokens = unwrap<SessionTokens>(response);
      if (!tokens.accessToken || !tokens.refreshToken) {
        throw new Error('La réponse de renouvellement ne contient pas la nouvelle paire de jetons.');
      }
      setAccessToken(tokens.accessToken);
      saveRefreshToken(tokens.refreshToken);
      return tokens;
    })
    .finally(() => { refreshInProgress = null; });

  return refreshInProgress;
}

export function setSelectedTenant(id: number | null): void {
  selectedTenantId = id;
}

export function registerSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
  if (handler) sessionExpirationHandled = false;
}

function notifySessionExpired(): void {
  if (sessionExpirationHandled) return;
  sessionExpirationHandled = true;
  onSessionExpired?.();
}

export function getApiError(error: unknown): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as { error?: { message?: string }; message?: string } | undefined;
    if (!error.response && error.request) {
      return 'Impossible de joindre l’API. Vérifiez que le backend fonctionne sur le port configuré et actualisez la page.';
    }
    return body?.error?.message ?? body?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (selectedTenantId !== null) config.headers['X-Tenant-ID'] = String(selectedTenantId);
  return config;
});

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const request = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const isAuthEntry = ['/auth/login', '/auth/refresh', '/auth/register'].some((path) => request?.url?.includes(path));
  if (error.response?.status !== 401 || !request || request._retried || isAuthEntry) {
    return Promise.reject(error);
  }

  request._retried = true;
  if (accessToken && request.headers.Authorization !== `Bearer ${accessToken}`) {
    request.headers.Authorization = `Bearer ${accessToken}`;
    return api(request);
  }

  try {
    const renewedTokens = await refreshSessionTokens();
    request.headers.Authorization = `Bearer ${renewedTokens.accessToken}`;
    return api(request);
  } catch {
    setAccessToken(null);
    saveRefreshToken(null);
    notifySessionExpired();
    return Promise.reject(error);
  }
});

export function unwrap<T>(response: { data: T }): T {
  const body: unknown = response.data;
  if (typeof body !== 'object' || body === null || !('success' in body) || body.success !== true || !('data' in body)) {
    throw new Error('The API response did not contain a successful data envelope.');
  }
  return body.data as T;
}
