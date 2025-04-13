import axios, { AxiosInstance } from 'axios';

const api: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL || '/api',
    timeout: 15000,
    withCredentials: true,
});

export const setupAxiosInterceptors = () => {
    api.interceptors.request.use(
        (config) => {
            config.headers['Content-Type'] = 'application/json';
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    api.interceptors.response.use(
        (response) => {
            return response;
        },
        (error) => {
            if (error.response?.status === 401) {
                localStorage.removeItem('user');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('supervisorFilter');
                window.location.href = '/login';
            }
            return Promise.reject(error);
        }
    );
};

export default api;