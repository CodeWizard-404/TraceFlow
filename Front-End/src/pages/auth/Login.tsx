import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useError } from "../../context/ErrorContext";
import { AxiosError } from "axios";
import "./Login.css";

const LoginPage: React.FC = () => {
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { loginUser } = useAuth();
    const { setError } = useError();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await loginUser(identifier, password); // No redirectTo parameter
        } catch (err: unknown) {
            const axiosError = err as AxiosError<{ error: string }>;
            const errorMessage =
                axiosError.response?.data?.error || "Invalid credentials. Please try again.";
            setError(errorMessage);
            console.error("Login error:", err);
        } finally {
            setLoading(false);
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
                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>
            </section>
        </div>
    );
};

export default LoginPage;