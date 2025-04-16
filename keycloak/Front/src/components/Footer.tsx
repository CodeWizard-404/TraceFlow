import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import "./CMP.css";

function Footer() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`footer ${theme === "dark" ? "dark" : ""}`}
      aria-label={t("footer_label", { defaultValue: "Footer" })}
    >
      <div className="footer-container">
        <p className="footer-text">
          {t("footer_copyright", { year: currentYear })}
        </p>
        <div className="footer-links">
          <a
            href="/privacy"
            className="footer-link"
            aria-label={t("footer_privacy")}
          >
            {t("footer_privacy")}
          </a>
          <a
            href="/terms"
            className="footer-link"
            aria-label={t("footer_terms")}
          >
            {t("footer_terms")}
          </a>
          <a
            href="/contact"
            className="footer-link"
            aria-label={t("footer_contact")}
          >
            {t("footer_contact")}
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
