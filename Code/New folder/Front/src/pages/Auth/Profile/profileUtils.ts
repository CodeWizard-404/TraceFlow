/**
 * profileUtils.ts
 * Utility functions for profile validation and formatting.
 */
export const detectImageMimeType = (base64: string): string | null => {
    try {
        if (base64.length < 100) {
            console.warn("Base64 string too short to be a valid image:", base64.length);
            return null;
        }
        if (base64 === "W29iamVjdCBPYmplY3Rd" || base64.includes("[object Object]")) {
            console.warn("Invalid PFP data: [object Object] detected");
            return null;
        }
        const prefix = base64.substring(0, 20);
        if (prefix.includes("/9j/")) return "image/jpeg";
        if (prefix.includes("iVBORw0KGgo")) return "image/png";
        return "image/jpeg";
    } catch {
        console.warn("Failed to detect MIME type for base64 string");
        return null;
    }
};

export const isValidBase64 = (str: string): boolean => {
    try {
        if (str === "[object Object]" || str === "W29iamVjdCBPYmplY3Rd") {
            console.warn("Invalid base64: [object Object] detected");
            return false;
        }
        const decoded = atob(str);
        if (decoded === "[object Object]") {
            console.warn("Decoded base64 is [object Object]");
            return false;
        }
        return btoa(decoded) === str;
    } catch {
        return false;
    }
};

export const validateName = (value: string, field: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return `${field} is required`;
    if (trimmed.length < 3) return `${field} must be at least 3 characters`;
    if (trimmed.length > 20) return `${field} must be 20 characters or less`;
    if (!/^[a-zA-Z\s'-]+$/.test(trimmed))
        return `${field} can only contain letters, spaces, hyphens, or apostrophes`;
    return "";
};

export const validateEmail = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "Email is required";
    if (trimmed.length > 70) return "Email must be 70 characters or less";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
        return "Invalid email format";
    return "";
};

export const validatePhone = (value: string): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return "Phone is required";
    if (digits.length !== 8) return "Phone must be 8 digits";
    return "";
};

export const validatePassword = (value: string): string => {
    if (value && value.length < 8)
        return "Password must be at least 8 characters";
    if (value.length > 128) return "Password must be 128 characters or less";
    if (
        value &&
        !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$/.test(value)
    ) {
        return "Password must include uppercase, lowercase, digit, and special character, no spaces";
    }
    return "";
};

export const validatePasswordConfirm = (password: string, confirm: string): string => {
    if (password && !confirm) return "Password confirmation is required";
    if (password && confirm && password !== confirm)
        return "Passwords do not match";
    return "";
};

export const formatPhoneDisplay = (rawValue: string): string => {
    const digits = rawValue.replace(/[^\d]/g, "");
    let formatted = "";
    if (digits.length > 0) formatted += digits.slice(0, 2);
    if (digits.length > 2) formatted += " " + digits.slice(2, 5);
    if (digits.length > 5) formatted += " " + digits.slice(5, 8);
    return formatted;
};

export const stripPhoneForDatabase = (raw: string): string => {
    return raw.replace(/[^\d]/g, "");
};