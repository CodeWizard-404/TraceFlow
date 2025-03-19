import React from "react";
import { useError } from "../context/ErrorContext";
import "./ErrorDisplay.css";

const ErrorDisplay: React.FC = () => {
    const { error, setError } = useError();

    if (!error) return null;

    return (
        <div className="error-display">
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
        </div>
    );
};

export default ErrorDisplay;