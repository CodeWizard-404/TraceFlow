import React from "react";
import { useNavigate } from "react-router-dom";
import { FaLock } from "react-icons/fa";
import "./AccessDenied.css";

const AccessDenied: React.FC = () => {
    const navigate = useNavigate();
    return (
        <div className="access-denied-container">
            <div className="header-bar">
                <h1>
                    <FaLock className="lock-icon" /> Access Denied
                </h1>
            </div>
            <div className="content-panel">
                <div className="warning-text">
                    <p>Restricted Page</p>
                    <span>You don’t have the necessary permissions to proceed.</span>
                </div>
                <button className="return-button" onClick={() => navigate(-1)}>
                    <span>Return</span>
                </button>
            </div>
        </div>
    );
};

export default AccessDenied;