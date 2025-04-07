import React from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaExclamationCircle } from "react-icons/fa";
import { motion } from "framer-motion";
import "./PageNotFound.css";

const PageNotFound: React.FC = () => {
    const navigate = useNavigate();

    const handleBack = () => {
        navigate(-1); // Go back to the previous page
    };

    return (
        <div className="not-found-wrapper">
            <div className="background-overlay">
                <FaExclamationCircle className="bg-icon warning-icon" />
                <FaArrowLeft className="bg-icon arrow-icon" />
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
                className="not-found-form"
            >
                <div className="form-header">
                    <h1 className="form-title">
                        <span className="glitch" data-text="404">
                            404
                        </span>
                    </h1>
                    <p className="form-subtitle">Page Not Found</p>
                </div>
                <div className="content-section">
                    <div className="error-message">
                        <FaExclamationCircle className="error-icon" />
                        <p>Oops!</p>
                        <span>This page doesn’t exist or has been moved.</span>
                    </div>
                    <motion.button
                        className="action-button"
                        onClick={handleBack}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <FaArrowLeft /> Return to Previous Page
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};

export default PageNotFound;