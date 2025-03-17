import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { exchangeCodeForToken } from "../Front-End/src/apis/authAPI";
import { useAuth } from "../Front-End/src/context/AuthContext";

const CallbackPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const code = searchParams.get("code");

        if (code) {
            const redirectUri = `${window.location.origin}/auth/callback`;
            exchangeCodeForToken(code, redirectUri)
                .then((response) => {
                    login(response.token); // Store token and user info
                    const roles = response.user?.roles?.map((r) => r.name) || [];
                    if (roles.includes("Admin")) navigate("/admin");
                    else if (roles.includes("Manager")) navigate("/manager-dashboard");
                    else if (roles.includes("Supervisor")) navigate("/timesheet");
                    else navigate("/dashboard");
                })
                .catch((err) => {
                    console.error("Token exchange failed:", err);
                    navigate("/login");
                });
        } else {
            navigate("/login");
        }
    }, [location, navigate, login]);

    return <div>Processing login...</div>;
};

export default CallbackPage;