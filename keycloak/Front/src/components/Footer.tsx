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
      aria-label={t("footer.aria.label")}
    >
      <div className="footer-container">
        <p className="footer-text">
          {t("footer.copyright", { year: currentYear })}
        </p>
        <div className="footer-links">
          <a
            href="/privacy"
            className="footer-link"
            aria-label={t("footer.links.privacy")}
          >
            {t("footer.links.privacy")}
          </a>
          <a
            href="/terms"
            className="footer-link"
            aria-label={t("footer.links.terms")}
          >
            {t("footer.links.terms")}
          </a>
          <a
            href="/contact"
            className="footer-link"
            aria-label={t("footer.links.contact")}
          >
            {t("footer.links.contact")}
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
