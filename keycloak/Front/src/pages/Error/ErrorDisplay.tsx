import React, { useEffect, useRef } from "react";
import { useError } from "../../context/ErrorContext";
import { FaExclamationTriangle } from "react-icons/fa";
import { motion } from "framer-motion";
import "./ErrorDisplay.css";

const ErrorDisplay: React.FC = () => {
    const { error, setError } = useError();
    const errorRef = useRef<HTMLDivElement>(null);

    // Auto-dismiss after 3 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [error, setError]);

    // Dismiss on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (errorRef.current && !errorRef.current.contains(event.target as Node)) {
                setError(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [setError]);

    if (!error) return null;

    return (
        <motion.div
            className="error-display"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
        >
            <div className="error-glass" ref={errorRef}>
                <FaExclamationTriangle className="error-icon" />
                <div className="error-content">
                    <h3>Error</h3>
                    <span>{error}</span>
                </div>
                <button className="dismiss-button" onClick={() => setError(null)}>
                    ✕
                </button>
            </div>
        </motion.div>
    );
};

export default ErrorDisplay;