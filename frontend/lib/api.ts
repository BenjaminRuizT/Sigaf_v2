/**
 * SIGAF centralized API client.
 * Uses axios with automatic JWT refresh via interceptors.
 * Tokens are stored in localStorage (access) and httpOnly cookies (refresh).
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

function getStoredToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sigaf_token");
}
function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sigaf_refresh_token");
}
function setTokens(access: string, refresh?: string) {
  localStorage.setItem("sigaf_token", access);
  if (refresh) localStorage.setItem("sigaf_refresh_token", refresh);
}
function clearTokens() {
  localStorage.removeItem("sigaf_token");
  localStorage.removeItem("sigaf_refresh_token");
}

const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30_000,
});

// ── Request interceptor — attach access token ──────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// ── Response interceptor — auto-refresh on 401 ────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }
    const refresh = getRefreshToken();
    if (!refresh) {
      clearTokens();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(err);
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers["Authorization"] = `Bearer ${token}`;
        return api(original);
      });
    }
    original._retry = true;
    isRefreshing = true;
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refresh_token: refresh });
      setTokens(data.token);
      processQueue(null, data.token);
      original.headers["Authorization"] = `Bearer ${data.token}`;
      return api(original);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      clearTokens();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export { api, setTokens, clearTokens, getStoredToken, getRefreshToken };
export default api;
