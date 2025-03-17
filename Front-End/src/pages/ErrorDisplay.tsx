// src/components/ErrorDisplay.tsx
import React from "react";
import { useError } from "../context/ErrorContext";

const ErrorDisplay: React.FC = () => {
    const { error, setError } = useError();

    if (!error) return null;

    return (
        <div
            style={{
                position: "fixed",
                top: "10px",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "#ffe6e6",
                color: "red",
                padding: "10px 20px",
                borderRadius: "5px",
                boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                zIndex: 1000,
            }}
        >
            <span>{error}</span>
            <button
                onClick={() => setError(null)}
                style={{
                    marginLeft: "10px",
                    background: "none",
                    border: "none",
                    color: "red",
                    cursor: "pointer",
                    fontWeight: "bold",
                }}
            >
                ✕
            </button>
        </div>
    );
};

export default ErrorDisplay;