// src/i18n.js
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";

i18next
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: "en",
        supportedLngs: ["en", "fr", "es"],
        backend: {
            loadPath: "/locales/{{lng}}/translation.json", // Vite serves /public/locales
        },
        interpolation: {
            escapeValue: false, // React handles XSS
        },
        detection: {
            order: ["navigator", "localStorage", "htmlTag"], // Browser language detection
        },
    });

export default i18next;