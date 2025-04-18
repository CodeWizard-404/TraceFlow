import axios, { AxiosInstance } from 'axios';
import { refreshToken } from './authAPI';

const api: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL || '/api',
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000,
    withCredentials: true,
});

export const setupAxiosInterceptors = () => {
    api.interceptors.request.use(
        (config) => {
            config.headers['Content-Type'] = 'application/json';
            return config;
        },
        (error) => {
            console.error('Request error:', error);
            return Promise.reject(error);
        }
    );

    api.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;
            if (error.response?.status === 401 && !originalRequest._retry) {
                originalRequest._retry = true;
                try {
                    await refreshToken();
                    return api(originalRequest);
                } catch (refreshError) {
                    console.error('Refresh failed:', refreshError);
                    localStorage.removeItem('user');
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('supervisorFilter');
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            }
            console.error('Response error:', error);
            return Promise.reject(error);
        }
    );
};

export default api;