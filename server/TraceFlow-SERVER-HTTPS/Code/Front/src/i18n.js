// src/i18n.js
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";

const languageDirections = {
    en: "ltr",
    fr: "ltr",
    ar: "rtl",
};
i18next
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: "fr",
        supportedLngs: ["en", "fr", "ar"],
        backend: {
            loadPath: "/locales/{{lng}}/translation.json",
        },
        interpolation: {
            escapeValue: false,
        },
    });
/*
// Set initial direction based on detected or fallback language
const initialLang = i18next.language || i18next.options.fallbackLng;
document.documentElement.setAttribute("dir", languageDirections[initialLang] || "ltr");

// Listen for language changes and update direction
i18next.on("languageChanged", (lng) => {
    document.documentElement.setAttribute("dir", languageDirections[lng] || "ltr");
});

*/
export default i18next;