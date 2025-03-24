import axios, { AxiosInstance } from "axios";

// Create an Axios instance with base configuration
const api: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL || "http://localhost:5000/api", // Fallback URL if env var is missing
    timeout: 10000, // Request timeout in milliseconds (10 seconds)
    withCredentials: true, // Include credentials in requests
});

// Sets up Axios interceptors for request handling
export const setupAxiosInterceptors = () => {
    api.interceptors.request.use(
        (config) => {
            // Skip adding token if Authorization header is already set
            if (config.headers.Authorization) {
                return config;
            }

            // Add token to headers if available in localStorage
            const token = localStorage.getItem("token");
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            } else {
                console.warn("Interceptor - No token available");
            }
            return config;
        },
        (error) => Promise.reject(error) // Reject request errors
    );
};

export default api;