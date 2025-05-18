import React, { useEffect, useRef } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import './ErrorDisplay.css';

interface ErrorItem {
  id: string;
  message: string;
  timestamp: string;
}

interface ErrorDisplayProps {
  errors: ErrorItem[];
  clearError: (id: string) => void;
  clearAllErrors: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ errors, clearError, clearAllErrors }) => {
  const { t } = useTranslation();
  const errorContainerRef = useRef<HTMLDivElement>(null);

  // Dismiss on click outside for the entire error stack
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        errorContainerRef.current &&
        !errorContainerRef.current.contains(event.target as Node)
      ) {
        if (errors.length > 0) {
          clearError(errors[errors.length - 1].id);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [errors, clearError]);

  if (errors.length === 0) return null;

  return (
    <div className="error-container" ref={errorContainerRef}>
      {errors.length > 1 && (
        <motion.button
          className="clear-all-button"
          onClick={clearAllErrors}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3 }}
          aria-label={t('errorDisplay.clearAll')}
        >
          {t('errorDisplay.clearAll')}
        </motion.button>
      )}
      <AnimatePresence>
        {errors.map((error: ErrorItem, index) => (
          <motion.div
            key={error.id}
            className="error-display"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: index * 15 }} // Tighter offset for deck effect
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ zIndex: 1000 - index }} // Decreasing z-index for stacking
            role="alert"
            aria-live="assertive"
          >
            <div className="error-glass">
              <FaExclamationTriangle className="error-icon" aria-hidden="true" />
              <div className="error-content">
                <h3>{t('errorDisplay.title')} (ID: {error.id.slice(0, 8)})</h3>
                <span>{error.message}</span>
                <small>{new Date(error.timestamp).toLocaleString()}</small>
              </div>
              <button
                className="dismiss-button"
                onClick={() => clearError(error.id)}
                aria-label={t('errorDisplay.dismiss')}
              >
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ErrorDisplay;