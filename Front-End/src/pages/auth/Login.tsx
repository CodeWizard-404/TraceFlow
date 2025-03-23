import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useError } from "../../context/ErrorContext";
import { AxiosError } from "axios";
import "./Login.css";

// LoginPage component for user authentication
const LoginPage: React.FC = () => {
    // State for form inputs and loading status
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const { loginUser } = useAuth(); // Access login function from AuthContext
    const { setError } = useError(); // Access error setter from ErrorContext

    // Handles form submission for login
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); // Indicate loading state
        setError(null); // Clear any previous errors

        try {
            await loginUser(identifier, password); // Attempt login; redirect handled in AuthProvider
        } catch (err: unknown) {
            // Handle login errors
            const axiosError = err as AxiosError<{ error: string }>;
            const errorMessage = 
                axiosError.response?.data?.error || "Invalid credentials. Please try again.";
            setError(errorMessage);
            console.error("Login error:", err);
        } finally {
            setLoading(false); // Reset loading state
        }
    };

    return (
        <div className="login-container">
            <header className="login-header">
                <h1>Login</h1>
            </header>
            <section className="login-card">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="identifier">Email or Phone</label>
                        <input
                            type="text"
                            id="identifier"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            required
                            disabled={loading}
                            className="form-control"
                            placeholder="Enter email or phone"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            className="form-control"
                            placeholder="Enter password"
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="submit-btn" 
                        disabled={loading}
                    >
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>
            </section>
        </div>
    );
};

export default LoginPage;