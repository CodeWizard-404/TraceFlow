import React from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaExclamationCircle } from "react-icons/fa";
import { motion } from "framer-motion";
import "./PageNotFound.css";
import { useTranslation } from "react-i18next";

const PageNotFound: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBack = () => {
    navigate(-1); // Go back to the previous page
  };

  return (
    <div className="not-found-wrapper" role="alert">
      <div className="background-overlay">
        <FaExclamationCircle
          className="bg-icon warning-icon"
          aria-hidden="true"
        />
        <FaArrowLeft className="bg-icon arrow-icon" aria-hidden="true" />
        <span className="particle" aria-hidden="true"></span>
        <span className="particle" aria-hidden="true"></span>
        <span className="particle" aria-hidden="true"></span>
        <span className="data-line" aria-hidden="true"></span>
        <span className="neural-pulse" aria-hidden="true"></span>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="not-found-form"
        role="main"
      >
        <div className="form-header">
          <h1 className="form-title" aria-label={t("pageNotFound.title")}>
            <span className="glitch" data-text="404">
              404
            </span>
          </h1>
          <p className="form-subtitle">{t("pageNotFound.subtitle")}</p>
        </div>
        <div className="content-section">
          <div className="error-message-1">
            <FaExclamationCircle className="error-icon" aria-hidden="true" />
            <p>{t("pageNotFound.error.message")}</p>
            <span>{t("pageNotFound.error.description")}</span>
          </div>
          <motion.button
            className="action-button"
            onClick={handleBack}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={t("pageNotFound.actions.back")}
          >
            <FaArrowLeft aria-hidden="true" /> {t("pageNotFound.actions.back")}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default PageNotFound;
