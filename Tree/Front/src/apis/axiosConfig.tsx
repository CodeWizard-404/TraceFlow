import axios, { AxiosInstance } from 'axios';
import { refreshToken } from './authAPI';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';

// Create Axios instance with base configuration
const api: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL || '/api',
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000,
    withCredentials: true,
});

// Utility to get accessToken from cookies
const getAccessTokenFromCookie = (): string | null => {
    const cookies = document.cookie.split(';').map(cookie => cookie.trim());
    const tokenCookie = cookies.find(cookie => cookie.startsWith('accessToken='));
    return tokenCookie ? tokenCookie.split('=')[1] : null;
};

// Store navigate function globally
let globalNavigate: ReturnType<typeof useNavigate> | null = null;

export const setGlobalNavigate = (navigate: ReturnType<typeof useNavigate>) => {
    globalNavigate = navigate;
};

// Debounced navigation for interceptor
const debouncedNavigate = debounce((to: string, options: { replace?: boolean }) => {
    if (globalNavigate) {
        globalNavigate(to, options);
    } else {
        window.location.href = to;
    }
}, 100);

// Set up Axios interceptors for request and response handling
export const setupAxiosInterceptors = () => {
    // Request interceptor to set headers
    api.interceptors.request.use(
        (config) => {
            config.headers['Content-Type'] = 'application/json';
            const accessToken = getAccessTokenFromCookie();
            if (accessToken) {
                config.headers['Authorization'] = `Bearer ${accessToken}`;
            }
            return config;
        },
        (error) => {
            console.error('Request error:', error);
            return Promise.reject(error);
        }
    );

    // Response interceptor to handle errors and token refresh
    api.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;
            if (error.response?.status === 401 && !originalRequest._retry) {
                originalRequest._retry = true;
                try {
                    const { accessToken, expiresIn } = await refreshToken();
                    const sameSite = import.meta.env.VITE_ENV === 'development' ? 'Lax' : 'Strict';
                    document.cookie = `accessToken=${accessToken}; path=/; SameSite=${sameSite}; max-age=${expiresIn / 1000}`;
                    originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
                    window.dispatchEvent(new Event('tokenRefreshed'));
                    return api(originalRequest);
                } catch (refreshError) {
                    console.error('Refresh token failed:', refreshError);
                    document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                    document.cookie = 'userData=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                    debouncedNavigate('/login', { replace: true });
                    return Promise.reject(refreshError);
                }
            }
            if (error.config.url.includes('/notifications')) {
                console.error('Notification API error:', error.response?.data?.error || error.message);
            } else {
                console.error('Response error:', error);
            }
            return Promise.reject(error);
        }
    );
};

export default api;