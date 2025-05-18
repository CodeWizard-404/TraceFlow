import React, { useEffect, useRef } from "react";
import { useError } from "../../context/ErrorContext";
import { FaExclamationTriangle } from "react-icons/fa";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import "./ErrorDisplay.css";

const ErrorDisplay: React.FC = () => {
  const { error, clearError } = useError();
  const { t } = useTranslation();
  const errorRef = useRef<HTMLDivElement>(null);

  // Dismiss on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        errorRef.current &&
        !errorRef.current.contains(event.target as Node)
      ) {
        clearError();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [clearError]);

  if (!error) return null;

  return (
    <motion.div
      className="error-display"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      role="alert"
      aria-live="assertive"
    >
      <div className="error-glass" ref={errorRef}>
        <FaExclamationTriangle className="error-icon" aria-hidden="true" />
        <div className="error-content">
          <h3>{t("errorDisplay.title")}</h3>
          <span>{error}</span>
        </div>
        <button
          className="dismiss-button"
          onClick={clearError}
          aria-label={t("errorDisplay.dismiss")}
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
};

export default ErrorDisplay;
