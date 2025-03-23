import axios, { AxiosInstance } from "axios";

const api: AxiosInstance = axios.create({
    baseURL: process.env.REACT_APP_BASE_URL,
    timeout: Number(process.env.REACT_APP_DEFAULT_TIMEOUT),
    withCredentials: true,
});

// Set up the interceptor without relying on a getToken function
export const setupAxiosInterceptors = () => {
    api.interceptors.request.use(
        (config) => {
            const token = localStorage.getItem("token");
            if (token) {
                config.headers["Authorization"] = `Bearer ${token}`;
            } else {
                console.warn("Interceptor - No token available");
            }
            return config;
        },
        (error) => Promise.reject(error)
    );

    // Handle 401 responses globally
    api.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                console.error("Unauthorized request - token may be invalid or expired");
                // Optionally trigger logout or redirect to login
            }
            return Promise.reject(error);
        }
    );
};

export default api;