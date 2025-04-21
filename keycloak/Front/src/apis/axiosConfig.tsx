import axios, { AxiosInstance } from 'axios';
import { refreshToken } from './authAPI';

// Create Axios instance with base configuration
const api: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL || '/api',
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000,
    withCredentials: true,
});

// Set up Axios interceptors for request and response handling
export const setupAxiosInterceptors = () => {
    // Request interceptor to set headers
    api.interceptors.request.use(
        (config) => {
            config.headers['Content-Type'] = 'application/json';
            const accessToken = localStorage.getItem('accessToken');
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
            // Handle 401 errors by refreshing the token
            if (error.response?.status === 401 && !originalRequest._retry) {
                originalRequest._retry = true;
                try {
                    const { accessToken, expiresIn } = await refreshToken();
                    localStorage.setItem('accessToken', accessToken);
                    const sameSite = import.meta.env.VITE_ENV === 'development' ? 'Lax' : 'Strict';
                    document.cookie = `accessToken=${accessToken}; path=/; SameSite=${sameSite}; max-age=${expiresIn / 1000}`;
                    originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
                    window.dispatchEvent(new Event('tokenRefreshed'));
                    return api(originalRequest);
                } catch (refreshError) {
                    console.error('Refresh token failed:', refreshError);
                    // Clear local storage and redirect to login
                    localStorage.removeItem('user');
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('supervisorFilter');
                    document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            }
            // Log specific errors for notification APIs
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