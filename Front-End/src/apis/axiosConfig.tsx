import axios, { AxiosInstance } from "axios";
import { BASE_URL, DEFAULT_TIMEOUT } from "../config";

const api: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: DEFAULT_TIMEOUT,
    withCredentials: true, // Keep this if your backend uses cookies (optional)
});

// Function to set up the interceptor with the token
export const setupAxiosInterceptors = (getToken: () => string | null) => {
    api.interceptors.request.use(
        (config) => {
            const token = getToken();
            if (token) {
                config.headers["Authorization"] = `Bearer ${token}`;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    // Optional: Handle 401 responses globally (e.g., redirect to login)
    api.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response?.status === 401) {
                // Optionally trigger logout or redirect to login
                console.error("Unauthorized request - token may be invalid or expired");
            }
            return Promise.reject(error);
        }
    );
};

export default api;