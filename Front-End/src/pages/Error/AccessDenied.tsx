import React from "react";
import { useNavigate } from "react-router-dom";
import { FaLock, FaExclamationTriangle } from "react-icons/fa";
import { motion } from "framer-motion";
import "./AccessDenied.css";

const AccessDenied: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="access-denied-wrapper">
            <div className="background-overlay">
                <FaLock className="bg-icon lock-icon" />
                <FaExclamationTriangle className="bg-icon warning-icon" />
                <span className="particle"></span>
                <span className="particle"></span>
                <span className="particle"></span>
                <span className="data-line"></span>
                <span className="neural-pulse"></span>
            </div>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="access-denied-form"
            >
                <div className="form-header">
                    <h1 className="form-title">
                        <FaLock /> Access Denied
                    </h1>
                    <p className="form-subtitle">You don’t have permission to view this page.</p>
                </div>
                <div className="content-section">
                    <div className="warning-message">
                        <FaExclamationTriangle className="warning-icon" />
                        <p>Restricted Area</p>
                        <span>Please contact an administrator if you believe this is an error.</span>
                    </div>
                    <motion.button
                        className="action-button"
                        onClick={() => navigate(-1)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Return to Previous Page
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};

export default AccessDenied;