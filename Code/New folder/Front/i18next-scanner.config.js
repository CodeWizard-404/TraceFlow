// i18next-scanner.config.js
export default {
    input: ['src/**/*.{ts,tsx}'], // Scan TypeScript/React files
    output: './src/locales/',
    options: {
        lngs: ['en', 'fr', 'ar'],
        defaultLng: 'en',
        resource: {
            loadPath: 'src/locales/{{lng}}.json',
            savePath: 'src/locales/{{lng}}.json',
        },
    },
};