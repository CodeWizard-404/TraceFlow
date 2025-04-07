// ErrorDisplay.tsx
import React from "react";
import { useError } from "../../context/ErrorContext";
import "./ErrorDisplay.css";

const ErrorDisplay: React.FC = () => {
    const { error, setError } = useError();

    if (!error) return null;

    return (
        <div className="error-display">
            <div className="error-glass">
                <span>{error}</span>
                <button className="dismiss-button" onClick={() => setError(null)}>
                    ✕
                </button>
            </div>
        </div>
    );
};

export default ErrorDisplay;

