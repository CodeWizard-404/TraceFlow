/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';


export default defineConfig({
    plugins: [
        react()
    ],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/test/setup.ts',
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        css: true,
        env: {
            VITE_PERMISSIONS_ACCESS_SUPERVISOR_TIMESHEETS: 'access_supervisor_timesheets',
            VITE_PERMISSIONS_CREATE_TIMESHEETS: 'create_timesheets',
            VITE_PERMISSIONS_SCAN_VISITS: 'scan_visits',
            VITE_PERMISSIONS_ACCESS_VISIT_DETAILS: 'access_visit_details',
            VITE_PERMISSIONS_LOG_VISITS: 'log_visits',
            VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS: 'access_receipt_books',
            VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_HISTORY: 'access_receipt_book_history',
            VITE_PERMISSIONS_TRANSFER_RECEIPT_BOOKS: 'transfer_receipt_books',
            VITE_ROLES_ADMIN: 'admin',
            VITE_ROLES_SUPER_ADMIN: 'super_admin',
        },
    },
});