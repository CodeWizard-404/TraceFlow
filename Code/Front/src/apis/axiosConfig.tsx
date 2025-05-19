import axios, { AxiosInstance } from 'axios';
import { refreshToken } from './authAPI';
import { debounce } from 'lodash';
import { useNavigate } from 'react-router-dom';

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BASE_URL || '/api',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000,
  withCredentials: true,
  headers: {
    'Cache-Control': 'no-store',
  },
});

let globalNavigate: ReturnType<typeof useNavigate> | null = null;

export const setGlobalNavigate = (navigate: ReturnType<typeof useNavigate>) => {
  globalNavigate = navigate;
};

const debouncedNavigate = debounce((to: string, options: { replace?: boolean; state?: Record<string, unknown> }) => {
  if (globalNavigate) {
    globalNavigate(to, options);
  } else {
    window.location.href = to;
  }
}, 100);

const debouncedDispatchError = debounce((error: unknown, url: string) => {
  window.dispatchEvent(
    new CustomEvent('apiError', {
      detail: { error, url },
    })
  );
}, 100);

export const setupAxiosInterceptors = () => {
  api.interceptors.request.use(
    (config) => {
      if (!(config.data instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json';
      }
      config.headers['If-Modified-Since'] = '0';
      const noTimeoutEndpoints = ['/timesheets/suggest', '/ai', '/receipt-books/upload-csv', '/agents/upload'];
      if (config.url && noTimeoutEndpoints.some((endpoint) => config.url!.includes(endpoint))) {
        config.timeout = 0;
      }
      return config;
    },
    (error) => {
      console.error('Request error:', error);
      debouncedDispatchError(error, error.config?.url);
      return Promise.reject(error);
    }
  );

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        !['/auth/login', '/auth/verify-2fa', '/auth/refresh'].includes(originalRequest.url)
      ) {
        originalRequest._retry = true;
        try {
          const { accessToken, expiresIn } = await refreshToken();
          const sameSite = import.meta.env.VITE_ENV === 'development' ? 'Lax' : 'Strict';
          document.cookie = `accessToken=${accessToken}; path=/; SameSite=${sameSite}; max-age=${expiresIn / 1000}; HttpOnly`;
          window.dispatchEvent(new Event('tokenRefreshed'));
          return api(originalRequest);
        } catch (refreshError) {
          console.error('Refresh token failed:', refreshError);
          document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          document.cookie = 'userData=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          debouncedNavigate('/login', {
            replace: true,
            state: {
              error: (refreshError as any)?.message?.includes('Session not found')
                ? 'Session expired. Please log in again.'
                : 'Authentication failed. Please log in again.',
            },
          });
          debouncedDispatchError(refreshError, originalRequest.url);
          return Promise.reject(refreshError);
        }
      }
      console.error('Response error:', {
        url: error.config.url,
        status: error.response?.status,
        message: error.message,
      });
      debouncedDispatchError(error, error.config.url);
      return Promise.reject(error);
    }
  );
};

export default api;