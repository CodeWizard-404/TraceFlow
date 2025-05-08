import Role from "../models/Role";

export const ROLES = {
    ADMIN: import.meta.env.VITE_ROLES_ADMIN,
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
    MANAGER: import.meta.env.VITE_ROLES_MANAGER,
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
    PURCHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
    REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
    STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
};

export const protectedRoutes: { [key: string]: string[] } = {
    "/admin": [ROLES.ADMIN, ROLES.SUPER_ADMIN],
    "/timesheet": [import.meta.env.VITE_PERMISSIONS_ACCESS_SUPERVISOR_TIMESHEETS],
    "/timesheet-form": [import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS, import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR],
    "/qr-scan": [import.meta.env.VITE_PERMISSIONS_SCAN_VISITS],
    "/visit/:idVisit": [import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS],
    "/visit/:idVisit/validate-checklist": [import.meta.env.VITE_PERMISSIONS_LOG_VISITS],
    "/receipt-books": [import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS],
    "/receipt-book/:bookID/history": [import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_HISTORY],
    "/transfer-receipt-books": [import.meta.env.VITE_PERMISSIONS_TRANSFER_RECEIPT_BOOKS],
};

export const determineTargetRoute = (roles: Role[]): string => {
    if (!roles || roles.length === 0) return "/login";
    if (roles.some((r) => [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(r.name))) return "/admin";
    if (roles.some((r) => [ROLES.MANAGER, ROLES.SUPERVISOR].includes(r.name))) return "/timesheet";
    if (roles.some((r) => [ROLES.PURCHASE_TEAM, ROLES.REGIONAL_MANAGER, ROLES.STOCK_MANAGER].includes(r.name))) return "/receipt-books";
    return "/login";
};

// Utility to check if Google OAuth is configured
export const isGoogleOAuthConfigured = (): boolean => {
    return !!import.meta.env.VITE_GOOGLE_CLIENT_ID && !!import.meta.env.VITE_REDIRECT_URI;
};