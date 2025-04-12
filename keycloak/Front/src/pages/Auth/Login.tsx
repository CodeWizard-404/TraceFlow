// components/Login/LoginPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { useAuth } from "../../context/AuthContext";
import { useError } from "../../context/ErrorContext";
import {
    login,
    verify2FA,
    resend2FA,
    initiatePasswordReset,
    verifyPasswordResetOTP,
    resetPassword,
} from "../../apis/authAPI";
import { motion, AnimatePresence } from "framer-motion";
import { FaClock, FaEye, FaEyeSlash, FaMapMarkerAlt, FaQrcode, FaShieldAlt } from "react-icons/fa";
import { RiTimeLine } from "react-icons/ri";
import { AiOutlineQrcode } from "react-icons/ai";
import "./Login.css";

const LoginPage: React.FC = () => {
    const [step, setStep] = useState<"login" | "verify2FA" | "forgot" | "verifyReset" | "reset">("login");
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [trustDevice, setTrustDevice] = useState(false);
    const [loading, setLoading] = useState(false);
    const [userID, setUserID] = useState<string | null>(null);
    const [deviceIdentifier, setDeviceIdentifier] = useState<string | null>(null);
    const [timer, setTimer] = useState(600);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [otpMethod, setOtpMethod] = useState<"phone" | "email">("phone");
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [tempToken, setTempToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const { loginUser } = useAuth();
    const { error, setError } = useError();

    // Load device fingerprint
    useEffect(() => {
        const getFingerprint = async () => {
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            setDeviceIdentifier(result.visitorId);
        };
        getFingerprint();
    }, []);

    // Clear success or API error message after 3 seconds
    useEffect(() => {
        if (success || error) {
            const timeout = setTimeout(() => {
                setSuccess(null);
                setError(null);
            }, 3000);
            return () => clearTimeout(timeout);
        }
    }, [success, error, setError]);

    // Timer for OTP expiration
    useEffect(() => {
        if ((step === "verify2FA" || step === "verifyReset") && timer > 0) {
            const interval = setInterval(() => setTimer((t) => t - 1), 1000);
            return () => clearInterval(interval);
        }
    }, [step, timer]);

    // Resend cooldown timer
    useEffect(() => {
        if (resendCooldown > 0) {
            const interval = setInterval(() => setResendCooldown((t) => t - 1), 1000);
            return () => clearInterval(interval);
        }
    }, [resendCooldown]);

    // Validation functions
    const validateIdentifier = (value: string): string => {
        if (!value) return "Please enter your email or phone number.";
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const phoneRegex = /^(?:\+\d{12}|\d{8})$/;
        if (!emailRegex.test(value) && !phoneRegex.test(value)) {
            return "Invalid email or phone format. Phone must be 8 digits or + followed by 12 digits.";
        }
        return "";
    };

    const validatePassword = (value: string): string => {
        if (!value) return "Please enter a password.";
        if (value.length < 8) return "Password must be at least 8 characters long.";
        if (value.length > 128) return "Password cannot exceed 128 characters.";
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$/.test(value)) {
            return "Password must include an uppercase letter, lowercase letter, number, and special character (no spaces).";
        }
        return "";
    };

    const validatePasswordConfirm = (password: string, confirm: string): string => {
        if (!confirm) return "Please confirm your password.";
        if (password && confirm && password !== confirm) return "Passwords do not match.";
        return "";
    };

    const validateOtp = (value: string): string => {
        if (!value) return "Please enter the 6-digit OTP.";
        if (!/^\d{6}$/.test(value)) return "OTP must be exactly 6 digits.";
        return "";
    };

    const validateForm = useCallback(() => {
        const newErrors: { [key: string]: string } = {};
        if (step === "login") {
            newErrors.identifier = validateIdentifier(identifier);
            newErrors.password = validatePassword(password);
        } else if (step === "verify2FA") {
            newErrors.otpCode = validateOtp(otpCode);
        } else if (step === "forgot") {
            newErrors.identifier = validateIdentifier(identifier);
        } else if (step === "verifyReset") {
            newErrors.otpCode = validateOtp(otpCode);
        } else if (step === "reset") {
            newErrors.newPassword = validatePassword(newPassword);
            newErrors.confirmPassword = validatePasswordConfirm(newPassword, confirmPassword);
        }
        setErrors(newErrors);
        return Object.values(newErrors).every((err) => !err);
    }, [step, identifier, password, otpCode, newPassword, confirmPassword]);

    const handleBlur = () => validateForm();

    // Handle login submission
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deviceIdentifier || !validateForm()) return;
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await login(identifier, password, deviceIdentifier, "phone");
            if ("requires2FA" in response) {
                setStep("verify2FA");
                setUserID(response.userID!);
                setTempToken(response.tempToken!);
                setRefreshToken(response.refreshToken!);
                setOtpMethod("phone");
                setTimer(600);
                setSuccess("OTP sent to your phone.");
            } else {
                await loginUser(identifier, password, deviceIdentifier);
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Login failed. Please try again.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Handle 2FA verification
    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deviceIdentifier || !validateForm() || !userID) {
            setError("Invalid session. Please try logging in again.");
            return;
        }
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await verify2FA(
                userID,
                otpCode,
                deviceIdentifier,
                trustDevice,
                tempToken!,
                refreshToken!
            );
            localStorage.setItem("token", response.token);
            localStorage.setItem("user", JSON.stringify(response.user));
            await loginUser(identifier, password, deviceIdentifier);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "2FA verification failed.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Handle password reset initiation
    const handleInitiateReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await initiatePasswordReset(identifier);
            setUserID(response.userID);
            setStep("verifyReset");
            setTimer(600);
            setSuccess("OTP sent to your email or phone.");
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Failed to initiate password reset.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Handle reset OTP verification
    const handleVerifyResetOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm() || !userID) {
            setError("Invalid session. Please try again.");
            return;
        }
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await verifyPasswordResetOTP(userID, otpCode);
            setStep("reset");
            setOtpCode("");
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Invalid OTP. Please try again.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Handle password reset submission
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm() || !userID) {
            setError("Invalid session. Please try again.");
            return;
        }
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await resetPassword(userID, newPassword);
            setSuccess("Password reset successfully! Please log in with your new password.");
            setStep("login");
            resetForm();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Password reset failed.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Handle OTP resend or switch method
    const handleResendOTP = async (method: "phone" | "email") => {
        if (resendCooldown > 0 || !userID) {
            return;
        }
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (step === "verify2FA") {
                const response = await resend2FA(userID, method);
                setOtpMethod(method);
                setTimer(600);
                setResendCooldown(60);
                setSuccess(
                    response.message?.includes("email")
                        ? "OTP sent to your email."
                        : "OTP sent to your phone."
                );
            } else if (step === "verifyReset") {
                await initiatePasswordReset(identifier);
                setTimer(600);
                setResendCooldown(60);
                setOtpMethod(method);
                setSuccess("OTP resent to your email or phone.");
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Failed to resend OTP.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleResendClick = (e: React.MouseEvent<HTMLButtonElement>, method: "phone" | "email") => {
        e.preventDefault();
        handleResendOTP(method);
    };

    const resetForm = () => {
        setIdentifier("");
        setPassword("");
        setOtpCode("");
        setNewPassword("");
        setConfirmPassword("");
        setTrustDevice(false);
        setTempToken(null);
        setRefreshToken(null);
        setErrors({});
        setTimer(600);
        setResendCooldown(0);
        setShowPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setOtpMethod("phone");
    };

    const handleBackToLogin = () => {
        setStep("login");
        setError(null);
        setSuccess(null);
        resetForm();
    };

    return (
        <div className="login-wrapper">
            <div className="background-overlay">
                <FaMapMarkerAlt className="bg-icon map-icon" />
                <RiTimeLine className="bg-icon time-icon" />
                <AiOutlineQrcode className="bg-icon qr-icon" />
                <FaQrcode className="bg-icon qrcode-icon" />
                <FaClock className="bg-icon clock-icon" />
                <FaShieldAlt className="bg-icon shield-icon" />
                <span className="particle"></span>
                <span className="particle"></span>
                <span className="particle"></span>
                <span className="particle"></span>
                <span className="particle"></span>
                <span className="qr-grid"></span>
                <span className="qr-grid"></span>
                <span className="qr-grid"></span>
                <span className="data-line"></span>
                <span className="data-line"></span>
                <span className="neural-pulse"></span>
            </div>
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="login-form"
                >
                    <div className="form-header">
                        <h1 className="form-title">TraceFlow</h1>
                        <p className="form-subtitle">Securely Track. Optimize. Succeed.</p>
                    </div>
                    {error && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="error-message">
                            {error}
                        </motion.div>
                    )}
                    {success && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="success-message">
                            {success}
                        </motion.div>
                    )}

                    {step === "login" && (
                        <form onSubmit={handleLogin}>
                            <div className="form-group">
                                <label htmlFor="identifier">Email or Phone</label>
                                <input
                                    type="text"
                                    id="identifier"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    onBlur={handleBlur}
                                    disabled={loading || !deviceIdentifier}
                                    placeholder="Enter your email or phone"
                                    className={errors.identifier ? "input-error" : ""}
                                />
                                {errors.identifier && <span className="error-text">{errors.identifier}</span>}
                            </div>
                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <div className="password-container">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        id="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onBlur={handleBlur}
                                        disabled={loading || !deviceIdentifier}
                                        placeholder="Enter your password"
                                        className={errors.password ? "input-error" : ""}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={loading}
                                        className="password-toggle"
                                    >
                                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                                {errors.password && <span className="error-text">{errors.password}</span>}
                            </div>
                            <motion.button
                                type="submit"
                                className="action-button-0"
                                disabled={loading || !deviceIdentifier}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {loading ? <span className="spinner" /> : "Sign In"}
                            </motion.button>
                            <button type="button" className="form-link" onClick={() => setStep("forgot")}>
                                Forgot Password?
                            </button>
                        </form>
                    )}

                    {step === "verify2FA" && (
                        <form onSubmit={handleVerify2FA}>
                            <div className="form-group">
                                <label htmlFor="otpCode">Enter OTP</label>
                                <input
                                    type="text"
                                    id="otpCode"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value)}
                                    onBlur={handleBlur}
                                    disabled={loading}
                                    placeholder="6-digit code"
                                    maxLength={6}
                                    className={errors.otpCode ? "input-error" : ""}
                                />
                                {errors.otpCode && <span className="error-text">{errors.otpCode}</span>}
                            </div>
                            <div className="form-info">
                                {otpMethod === "phone"
                                    ? "We sent a code to your phone number."
                                    : "We sent a code to your email."}{" "}
                                Time remaining: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}
                            </div>
                            <div className="form-checkbox styled-checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={trustDevice}
                                        onChange={(e) => setTrustDevice(e.target.checked)}
                                        disabled={loading}
                                    />
                                    <span className="checkbox-label">Trust this device</span>
                                </label>
                            </div>
                            <motion.button
                                type="submit"
                                className="action-button-0"
                                disabled={loading}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {loading ? <span className="spinner" /> : "Verify OTP"}
                            </motion.button>
                            <motion.button
                                type="button"
                                className="action-button-0 secondary"
                                onClick={(e) => handleResendClick(e, otpMethod)}
                                disabled={loading || resendCooldown > 0}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                            </motion.button>
                            {otpMethod === "phone" && (
                                <button
                                    type="button"
                                    className="form-link"
                                    onClick={(e) => handleResendClick(e, "email")}
                                    disabled={loading || resendCooldown > 0}
                                >
                                    Can’t access your phone? Send to email instead.
                                </button>
                            )}
                            <hr />
                            {otpMethod === "email" && (
                                <button
                                    type="button"
                                    className="form-link"
                                    onClick={(e) => handleResendClick(e, "phone")}
                                    disabled={loading || resendCooldown > 0}
                                >
                                    Send to phone instead.
                                </button>
                            )}
                            <button type="button" className="form-link" onClick={handleBackToLogin}>
                                Back to Sign In
                            </button>
                        </form>
                    )}

                    {step === "forgot" && (
                        <form onSubmit={handleInitiateReset}>
                            <div className="form-group">
                                <label htmlFor="identifier">Email or Phone</label>
                                <input
                                    type="text"
                                    id="identifier"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    onBlur={handleBlur}
                                    disabled={loading}
                                    placeholder="Enter your email or phone"
                                    className={errors.identifier ? "input-error" : ""}
                                />
                                {errors.identifier && <span className="error-text">{errors.identifier}</span>}
                            </div>
                            <motion.button
                                type="submit"
                                className="action-button-0"
                                disabled={loading}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {loading ? <span className="spinner" /> : "Send Reset OTP"}
                            </motion.button>
                            <button type="button" className="form-link" onClick={handleBackToLogin}>
                                Back to Sign In
                            </button>
                        </form>
                    )}

                    {step === "verifyReset" && (
                        <form onSubmit={handleVerifyResetOTP}>
                            <div className="form-group">
                                <label htmlFor="otpCode">Enter Reset OTP</label>
                                <input
                                    type="text"
                                    id="otpCode"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value)}
                                    onBlur={handleBlur}
                                    disabled={loading}
                                    placeholder="6-digit code"
                                    maxLength={6}
                                    className={errors.otpCode ? "input-error" : ""}
                                />
                                {errors.otpCode && <span className="error-text">{errors.otpCode}</span>}
                            </div>
                            <div className="form-info">
                                Time remaining: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}
                            </div>
                            <motion.button
                                type="submit"
                                className="action-button-0"
                                disabled={loading}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {loading ? <span className="spinner" /> : "Verify OTP"}
                            </motion.button>
                            <motion.button
                                type="button"
                                className="action-button-0 secondary"
                                onClick={(e) => handleResendClick(e, otpMethod)}
                                disabled={loading || resendCooldown > 0}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                            </motion.button>
                            <button type="button" className="form-link" onClick={handleBackToLogin}>
                                Back to Sign In
                            </button>
                        </form>
                    )}

                    {step === "reset" && (
                        <form onSubmit={handleResetPassword}>
                            <div className="form-group">
                                <label htmlFor="newPassword">New Password</label>
                                <div className="password-container">
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        id="newPassword"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        onBlur={handleBlur}
                                        disabled={loading}
                                        placeholder="Enter new password"
                                        className={errors.newPassword ? "input-error" : ""}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        disabled={loading}
                                        className="password-toggle"
                                    >
                                        {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                                {errors.newPassword && <span className="error-text">{errors.newPassword}</span>}
                            </div>
                            <div className="form-group">
                                <label htmlFor="confirmPassword">Confirm Password</label>
                                <div className="password-container">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        id="confirmPassword"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        onBlur={handleBlur}
                                        disabled={loading}
                                        placeholder="Confirm new password"
                                        className={errors.confirmPassword ? "input-error" : ""}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        disabled={loading}
                                        className="password-toggle"
                                    >
                                        {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                                    </button>
                                </div>
                                {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
                            </div>
                            <motion.button
                                type="submit"
                                className="action-button-0"
                                disabled={loading}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {loading ? <span className="spinner" /> : "Reset Password"}
                            </motion.button>
                            <button type="button" className="form-link" onClick={handleBackToLogin}>
                                Back to Sign In
                            </button>
                        </form>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default LoginPage;