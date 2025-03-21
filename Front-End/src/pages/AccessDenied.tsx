// src/pages/AccessDenied.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "./AccessDenied.css";

const AccessDenied: React.FC = () => {
    const navigate = useNavigate();
    return (
        <div className="access-denied-container">
            <h1>Access Denied</h1>
            <p>You don't have permission to view this page.</p>
            <button onClick={() => navigate(-1)}>Go Back</button>
        </div>
    );
};

export default AccessDenied;