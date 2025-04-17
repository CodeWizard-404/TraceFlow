import React, { useState, useEffect, useCallback } from "react";
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
import {
  FaClock,
  FaEye,
  FaEyeSlash,
  FaMapMarkerAlt,
  FaQrcode,
  FaShieldAlt,
} from "react-icons/fa";
import { useTranslation } from "react-i18next";
import "./Login.css";

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<
    "login" | "verify2FA" | "forgot" | "verifyReset" | "reset"
  >("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userID, setUserID] = useState<string | null>(null);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [tempResetToken, setTempResetToken] = useState<string | null>(null);
  const [timer, setTimer] = useState(600);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpMethod, setOtpMethod] = useState<"phone" | "email">("phone");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const { loginUser } = useAuth();
  const { setError, clearError } = useError();

  useEffect(() => {
    if (success || apiError) {
      const timeout = setTimeout(() => {
        setSuccess(null);
        setApiError(null);
        clearError();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [success, apiError, clearError]);

  useEffect(() => {
    if ((step === "verify2FA" || step === "verifyReset") && timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [step, timer]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const interval = setInterval(() => setResendCooldown((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [resendCooldown]);

  const validateIdentifier = (value: string): string => {
    if (!value) return t("login.validation.identifierRequired");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(?:\+\d{11}|\d{8})$/;
    if (!emailRegex.test(value) && !phoneRegex.test(value)) {
      return t("login.validation.identifierFormat");
    }
    return "";
  };

  const validatePassword = (value: string): string => {
    if (!value) return t("login.validation.passwordRequired");
    if (value.length < 8) return t("login.validation.passwordLengthMin");
    if (value.length > 128) return t("login.validation.passwordLengthMax");
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$/.test(value)) {
      return t("login.validation.passwordFormat");
    }
    return "";
  };

  const validatePasswordConfirm = (
    password: string,
    confirm: string
  ): string => {
    if (!confirm) return t("login.validation.confirmPasswordRequired");
    if (password && confirm && password !== confirm)
      return t("login.validation.passwordMismatch");
    return "";
  };

  const validateOtp = (value: string): string => {
    if (!value) return t("login.validation.otpRequired");
    if (!/^\d{6}$/.test(value)) return t("login.validation.otpFormat");
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
      newErrors.confirmPassword = validatePasswordConfirm(
        newPassword,
        confirmPassword
      );
    }
    setErrors(newErrors);
    return Object.values(newErrors).every((err) => !err);
  }, [step, identifier, password, otpCode, newPassword, confirmPassword, t]);

  const handleBlur = () => validateForm();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setApiError(null);
    clearError();
    setSuccess(null);

    try {
      const response = await login(identifier, password, "phone");
      if (!response) {
        throw new Error(t("login.error.networkError"));
      }
      if (response.requires2FA) {
        setStep("verify2FA");
        setUserID(response.userID!);
        setTempToken(response.tempToken!);
        setRefreshToken(response.refreshToken!);
        setTimer(600);
        setSuccess(t("login.verify2FA.phoneMessage"));
      } else if (response.user) {
        await loginUser(identifier, password);
        setSuccess(t("login.success.loginSuccessful"));
      } else {
        throw new Error(t("login.error.loginFailed"));
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : t("login.error.loginFailed");
      console.error("Login error:", errorMessage);
      setApiError(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !userID || !tempToken || !refreshToken) {
      setApiError(t("login.error.invalidSession"));
      setError(t("login.error.invalidSession"));
      return;
    }
    if (loading) return;
    setLoading(true);
    setApiError(null);
    clearError();
    setSuccess(null);

    try {
      const response = await verify2FA(
        userID,
        otpCode,
        trustDevice,
        tempToken,
        refreshToken
      );
      if (!response) {
        throw new Error(t("login.error.networkError"));
      }
      if (response.requires2FA) {
        throw new Error(t("login.error.invalidOtp"));
      }
      if (!response.user) {
        throw new Error(t("login.error.loginFailed"));
      }
      await loginUser(
        identifier,
        password,
        otpCode,
        trustDevice,
        tempToken,
        refreshToken,
        userID
      );
      setSuccess(t("login.success.loginSuccessful"));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : t("login.error.invalidOtp");
      console.error("verify2FA error:", errorMessage);
      setApiError(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setApiError(null);
    clearError();
    setSuccess(null);

    try {
      const response = await initiatePasswordReset(identifier);
      setUserID(response.userID);
      setStep("verifyReset");
      setTimer(600);
      setSuccess(t("login.success.resetOtpSent", { method: otpMethod }));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("login.error.resetOtpFailed");
      console.error("Initiate reset error:", errorMessage);
      setApiError(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !userID) {
      setApiError(t("login.error.invalidSession"));
      setError(t("login.error.invalidSession"));
      return;
    }
    setLoading(true);
    setApiError(null);
    clearError();
    setSuccess(null);

    try {
      const response = await verifyPasswordResetOTP(userID, otpCode);
      setTempResetToken(response.tempToken);
      setStep("reset");
      setOtpCode("");
      setSuccess(t("login.success.otpVerified"));
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("login.error.verifyResetOtpFailed");
      console.error("Verify reset OTP error:", errorMessage);
      setApiError(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !userID || !tempResetToken) {
      setApiError(t("login.error.invalidSession"));
      setError(t("login.error.invalidSession"));
      return;
    }
    setLoading(true);
    setApiError(null);
    clearError();
    setSuccess(null);

    try {
      await resetPassword(userID, newPassword, tempResetToken);
      setSuccess(t("login.success.resetSuccess"));
      setStep("login");
      resetForm();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : t("login.error.resetFailed");
      console.error("Reset password error:", errorMessage);
      setApiError(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async (method: "phone" | "email") => {
    if (resendCooldown > 0 || !userID) return;
    setLoading(true);
    setApiError(null);
    clearError();
    setSuccess(null);

    try {
      if (step === "verify2FA") {
        const response = await resend2FA(userID, method);
        setOtpMethod(method);
        setTimer(600);
        setResendCooldown(60);
        setSuccess(t(`login.verify2FA.${method}Message`));
      } else if (step === "verifyReset") {
        const response = await initiatePasswordReset(identifier);
        setTimer(600);
        setResendCooldown(60);
        setOtpMethod(method);
        setSuccess(t("login.success.resetOtpSent", { method }));
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : t("login.error.resendFailed");
      console.error("Resend OTP error:", errorMessage);
      setApiError(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    method: "phone" | "email"
  ) => {
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
    setUserID(null);
    setTempToken(null);
    setRefreshToken(null);
    setTempResetToken(null);
    setErrors({});
    setApiError(null);
    setTimer(600);
    setResendCooldown(0);
    setShowPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setOtpMethod("phone");
  };

  const handleBackToLogin = () => {
    setStep("login");
    setApiError(null);
    clearError();
    setSuccess(null);
    resetForm();
  };

  const formatTimer = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return t("login.verify2FA.timer", {
      minutes,
      seconds: secs.toString().padStart(2, "0"),
    });
  };

  return (
    <div className="login-wrapper" role="main">
      <div className="background-overlay">
        <FaMapMarkerAlt className="bg-icon map-icon" aria-hidden="true" />
        <FaQrcode className="bg-icon qrcode-icon" aria-hidden="true" />
        <FaClock className="bg-icon clock-icon" aria-hidden="true" />
        <FaShieldAlt className="bg-icon shield-icon" aria-hidden="true" />
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
          role="form"
          aria-labelledby="form-title"
        >
          <div className="form-header">
            <h1 id="form-title" className="form-title">
              {t("login.header.title")}
            </h1>
            <p className="form-subtitle">{t("login.header.subtitle")}</p>
          </div>
          {apiError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="error-message"
            >
              {apiError}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="success-message"
            >
              {success}
            </motion.div>
          )}
          {step === "login" && (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="identifier">
                  {t("login.login.identifier")}
                </label>
                <input
                  type="text"
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onBlur={handleBlur}
                  disabled={loading}
                  placeholder={t("login.login.identifierPlaceholder")}
                  className={errors.identifier ? "input-error" : ""}
                  aria-label={t("login.login.identifier")}
                />
                {errors.identifier && (
                  <span className="error-text">{errors.identifier}</span>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="password">{t("login.login.password")}</label>
                <div className="password-container">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={handleBlur}
                    disabled={loading}
                    placeholder={t("login.login.passwordPlaceholder")}
                    className={errors.password ? "input-error" : ""}
                    aria-label={t("login.login.password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="password-toggle"
                    aria-label={
                      showPassword
                        ? t("login.actions.hidePassword")
                        : t("login.actions.showPassword")
                    }
                  >
                    {showPassword ? (
                      <FaEyeSlash aria-hidden="true" />
                    ) : (
                      <FaEye aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <span className="error-text">{errors.password}</span>
                )}
              </div>
              <motion.button
                type="submit"
                className="action-button-0"
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={t("login.login.submit")}
              >
                {loading ? (
                  <span className="spinner" />
                ) : (
                  t("login.login.submit")
                )}
              </motion.button>
              <button
                type="button"
                className="form-link"
                onClick={() => setStep("forgot")}
                aria-label={t("login.login.forgotPassword")}
              >
                {t("login.login.forgotPassword")}
              </button>
            </form>
          )}
          {step === "verify2FA" && (
            <form onSubmit={handleVerify2FA}>
              <div className="form-group">
                <label htmlFor="otpCode">{t("login.verify2FA.title")}</label>
                <input
                  type="text"
                  id="otpCode"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  onBlur={handleBlur}
                  disabled={loading}
                  placeholder={t("login.verify2FA.otpPlaceholder")}
                  maxLength={6}
                  className={errors.otpCode ? "input-error" : ""}
                  aria-label={t("login.verify2FA.title")}
                />
                {errors.otpCode && (
                  <span className="error-text">{errors.otpCode}</span>
                )}
              </div>
              <div className="form-info">
                {t(`login.verify2FA.${otpMethod}Message`)} {formatTimer(timer)}
              </div>
              <div className="form-checkbox styled-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    disabled={loading}
                  />
                  <span className="checkbox-label">
                    {t("login.verify2FA.trustDevice")}
                  </span>
                </label>
              </div>
              <motion.button
                type="submit"
                className="action-button-0"
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={t("login.verify2FA.submit")}
              >
                {loading ? (
                  <span className="spinner" />
                ) : (
                  t("login.verify2FA.submit")
                )}
              </motion.button>
              <motion.button
                type="button"
                className="action-button-0 secondary"
                onClick={(e) => handleResendClick(e, otpMethod)}
                disabled={loading || resendCooldown > 0}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={t("login.verify2FA.resend")}
              >
                {resendCooldown > 0
                  ? t("login.verify2FA.resendCooldown", {
                      seconds: resendCooldown,
                    })
                  : t("login.verify2FA.resend")}
              </motion.button>
              {otpMethod === "phone" && (
                <button
                  type="button"
                  className="form-link"
                  onClick={(e) => handleResendClick(e, "email")}
                  disabled={loading || resendCooldown > 0}
                  aria-label={t("login.verify2FA.switchToEmail")}
                >
                  {t("login.verify2FA.switchToEmail")}
                </button>
              )}
              <hr />
              {otpMethod === "email" && (
                <button
                  type="button"
                  className="form-link"
                  onClick={(e) => handleResendClick(e, "phone")}
                  disabled={loading || resendCooldown > 0}
                  aria-label={t("login.verify2FA.switchToPhone")}
                >
                  {t("login.verify2FA.switchToPhone")}
                </button>
              )}
              <button
                type="button"
                className="form-link"
                onClick={handleBackToLogin}
                aria-label={t("login.verify2FA.back")}
              >
                {t("login.verify2FA.back")}
              </button>
            </form>
          )}
          {step === "forgot" && (
            <form onSubmit={handleInitiateReset}>
              <div className="form-group">
                <label htmlFor="identifier">
                  {t("login.forgot.identifier")}
                </label>
                <input
                  type="text"
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onBlur={handleBlur}
                  disabled={loading}
                  placeholder={t("login.forgot.identifierPlaceholder")}
                  className={errors.identifier ? "input-error" : ""}
                  aria-label={t("login.forgot.identifier")}
                />
                {errors.identifier && (
                  <span className="error-text">{errors.identifier}</span>
                )}
              </div>
              <motion.button
                type="submit"
                className="action-button-0"
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={t("login.forgot.submit")}
              >
                {loading ? (
                  <span className="spinner" />
                ) : (
                  t("login.forgot.submit")
                )}
              </motion.button>
              <button
                type="button"
                className="form-link"
                onClick={handleBackToLogin}
                aria-label={t("login.forgot.back")}
              >
                {t("login.forgot.back")}
              </button>
            </form>
          )}
          {step === "verifyReset" && (
            <form onSubmit={handleVerifyResetOTP}>
              <div className="form-group">
                <label htmlFor="otpCode">{t("login.verifyReset.title")}</label>
                <input
                  type="text"
                  id="otpCode"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  onBlur={handleBlur}
                  disabled={loading}
                  placeholder={t("login.verifyReset.otpPlaceholder")}
                  maxLength={6}
                  className={errors.otpCode ? "input-error" : ""}
                  aria-label={t("login.verifyReset.title")}
                />
                {errors.otpCode && (
                  <span className="error-text">{errors.otpCode}</span>
                )}
              </div>
              <div className="form-info">{formatTimer(timer)}</div>
              <motion.button
                type="submit"
                className="action-button-0"
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={t("login.verifyReset.submit")}
              >
                {loading ? (
                  <span className="spinner" />
                ) : (
                  t("login.verifyReset.submit")
                )}
              </motion.button>
              <motion.button
                type="button"
                className="action-button-0 secondary"
                onClick={(e) => handleResendClick(e, otpMethod)}
                disabled={loading || resendCooldown > 0}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={t("login.verifyReset.resend")}
              >
                {resendCooldown > 0
                  ? t("login.verifyReset.resendCooldown", {
                      seconds: resendCooldown,
                    })
                  : t("login.verifyReset.resend")}
              </motion.button>
              <button
                type="button"
                className="form-link"
                onClick={handleBackToLogin}
                aria-label={t("login.verifyReset.back")}
              >
                {t("login.verifyReset.back")}
              </button>
            </form>
          )}
          {step === "reset" && (
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label htmlFor="newPassword">
                  {t("login.reset.newPassword")}
                </label>
                <div className="password-container">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onBlur={handleBlur}
                    disabled={loading}
                    placeholder={t("login.reset.newPasswordPlaceholder")}
                    className={errors.newPassword ? "input-error" : ""}
                    aria-label={t("login.reset.newPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    disabled={loading}
                    className="password-toggle"
                    aria-label={
                      showNewPassword
                        ? t("login.actions.hideNewPassword")
                        : t("login.actions.showNewPassword")
                    }
                  >
                    {showNewPassword ? (
                      <FaEyeSlash aria-hidden="true" />
                    ) : (
                      <FaEye aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.newPassword && (
                  <span className="error-text">{errors.newPassword}</span>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">
                  {t("login.reset.confirmPassword")}
                </label>
                <div className="password-container">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={handleBlur}
                    disabled={loading}
                    placeholder={t("login.reset.confirmPasswordPlaceholder")}
                    className={errors.confirmPassword ? "input-error" : ""}
                    aria-label={t("login.reset.confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                    className="password-toggle"
                    aria-label={
                      showConfirmPassword
                        ? t("login.actions.hideConfirmPassword")
                        : t("login.actions.showConfirmPassword")
                    }
                  >
                    {showConfirmPassword ? (
                      <FaEyeSlash aria-hidden="true" />
                    ) : (
                      <FaEye aria-hidden="true" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className="error-text">{errors.confirmPassword}</span>
                )}
              </div>
              <motion.button
                type="submit"
                className="action-button-0"
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={t("login.reset.submit")}
              >
                {loading ? (
                  <span className="spinner" />
                ) : (
                  t("login.reset.submit")
                )}
              </motion.button>
              <button
                type="button"
                className="form-link"
                onClick={handleBackToLogin}
                aria-label={t("login.reset.back")}
              >
                {t("login.reset.back")}
              </button>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default LoginPage;
