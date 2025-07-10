/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { FaArrowLeft, FaCheck } from "react-icons/fa";
import Visit from "../../models/Visit";
import "./QRScan.css";
import { verifyQrCode, validateOTP } from "../../apis/visitAPI";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";

const PERMISSIONS = {
  SCAN_VISITS: import.meta.env.VITE_PERMISSIONS_SCAN_VISITS,
};

const OTP_EXPIRY_SECONDS = 600; // 10 minutes
const ERROR_DISPLAY_DURATION = 5000;

const QRScan: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { effectivePermissions, permissionsLoaded } = useAuth();
  const visit = (location.state as { visit?: Visit })?.visit;

  const [backendError, setBackendError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(t("qrScan.status.scanning"));
  const [loading, setLoading] = useState<boolean>(true);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [qrVerified, setQrVerified] = useState<boolean>(false);
  const [otp, setOtp] = useState<string>("");
  const [otpTimer, setOtpTimer] = useState<number>(OTP_EXPIRY_SECONDS);
  const [validating, setValidating] = useState<boolean>(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCode = useRef<Html5Qrcode | null>(null);
  const stopLockRef = useRef<boolean>(false);
  const scanLockRef = useRef<boolean>(false);

  const userPermissions = useMemo(
    () => ({
      canScanVisits: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.SCAN_VISITS
      ),
    }),
    [effectivePermissions]
  );

  // Clear error after duration
  useEffect(() => {
    if (!backendError) return;
    const timer = setTimeout(() => setBackendError(null), ERROR_DISPLAY_DURATION);
    return () => clearTimeout(timer);
  }, [backendError]);

  // OTP timer
  useEffect(() => {
    if (!qrVerified) {
      setOtpTimer(OTP_EXPIRY_SECONDS);
      return;
    }
    const interval = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          setBackendError(t("qrScan.error.otpExpired"));
          setQrVerified(false); // Reset to QR scanning
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [qrVerified, t]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const stopScanner = async () => {
    if (stopLockRef.current || !qrCode.current) return;
    stopLockRef.current = true;
    try {
      await qrCode.current.stop();
      qrCode.current.clear();
      qrCode.current = null;
    } catch (err) {
      console.error("Stop Scanner Error:", err);
    } finally {
      stopLockRef.current = false;
    }
  };

  useEffect(() => {
    setIsMounted(true);

    if (!visit || !visit.visitID) {
      console.error("No visit data provided.");
      setLoading(false);
      setStatus("");
      return;
    }

    if (!permissionsLoaded) {
      return;
    }

    if (!userPermissions.canScanVisits) {
      console.error("User lacks 'scan_visits' permission.");
      navigate("/access-denied");
      setLoading(false);
      setStatus("");
      return;
    }

    // Check if it's a recruitment visit (agentID is null)
    if (!visit.agentID) {
      // Skip QR scan and OTP for recruitment visits
      setLoading(false);
      setStatus(t("qrScan.status.recruitmentVisit"));
      setTimeout(() => {
        navigate(`/visit/${visit.visitID}/validate-checklist`, {
          state: { fromValidQRScan: true, visit },
        });
      }, 1000); // Short delay for UI feedback
      return;
    }

    // Regular visit: Initialize QR scanner
    if (!isMounted || !qrRef.current) {
      console.error("Failed to initialize QR scanner.");
      setLoading(false);
      setStatus("");
      return;
    }

    if (qrVerified) {
      // Stop scanner when showing OTP input
      stopScanner();
      return;
    }

    const html5QrCode = new Html5Qrcode("qr-reader");
    qrCode.current = html5QrCode;

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    const qrCodeSuccessCallback = async (decodedText: string) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      try {
        setStatus(t("qrScan.status.detected"));
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setStatus(t("qrScan.status.checking"));
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const response = await verifyQrCode({
          qrData: decodedText,
          visitId: visit.visitID,
        });
        if (response.valid) {
          setStatus(t("qrScan.status.validating"));
          await new Promise((resolve) => setTimeout(resolve, 100));
          setIsSuccess(true);
          await new Promise((resolve) => setTimeout(resolve, 100));
          setQrVerified(true); // Switch to OTP input
          await stopScanner();
        } else {
          setBackendError(response.message || t("qrScan.error.mismatch"));
          setIsShaking(true);
          await new Promise((resolve) => setTimeout(resolve, 100));
          setIsShaking(false);
          setStatus(t("qrScan.status.scanning"));
        }
      } catch (err: any) {
        setBackendError(err.message || t("qrScan.error.mismatch"));
        setIsShaking(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
        setIsShaking(false);
        setStatus(t("qrScan.status.scanning"));
        console.error("QR verification error:", err);
      } finally {
        scanLockRef.current = false;
      }
    };

    const qrCodeErrorCallback = (error: string) => {
      console.warn(`QR scan error: ${error}`);
      if (error.includes("NotAllowedError")) {
        console.error("Camera access denied.");
        setBackendError(t("qrScan.error.cameraAccessDenied"));
      } else if (error.includes("NotFoundError")) {
        console.error("No camera found.");
        setBackendError(t("qrScan.error.noCamera"));
      }
    };

    html5QrCode
      .start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      )
      .then(() => {
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to start camera:", err.message);
        setLoading(false);
        setStatus("");
        setBackendError(t("qrScan.error.cameraFailed"));
      });

    return () => {
      stopScanner();
      setIsMounted(false);
    };
  }, [
    visit,
    navigate,
    permissionsLoaded,
    userPermissions.canScanVisits,
    isMounted,
    qrVerified,
    t,
  ]);

  const handleBack = () => {
    if (qrVerified) {
      setQrVerified(false); // Return to QR scanning
      setOtp("");
      setOtpTimer(OTP_EXPIRY_SECONDS);
      setBackendError(null);
    } else {
      navigate(-1);
    }
  };

  const handleValidateOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      setBackendError(t("qrScan.error.noOTP"));
      return;
    }
    setValidating(true);
    try {
      const response = await validateOTP({
        visitId: visit!.visitID,
        otpCode: otp,
      });
      if (response.valid) {
        setIsSuccess(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
        navigate(`/visit/${visit!.visitID}/validate-checklist`, {
          state: { fromValidQRScan: true, visit },
        });
      } else {
        setBackendError(response.message || t("qrScan.error.invalidOTP"));
      }
    } catch (err: any) {
      setBackendError(err.message || t("qrScan.error.invalidOTP"));
      console.error("OTP validation error:", err);
    } finally {
      setValidating(false);
    }
  };

  if (!visit || !visit.visitID) {
    return (
      <div className="qr-scan-container">
        <div className="qr-scan-error-card" role="alert">
          <h2>{t("qrScan.error.title")}</h2>
          <p aria-label={t("qrScan.aria.errorMessage")}>
            {t("qrScan.error.noVisit")}
          </p>
          <button
            className="qr-back-btn"
            onClick={() => navigate(-1)}
            aria-label={t("qrScan.aria.backButton")}
          >
            <FaArrowLeft aria-hidden="true" /> {t("qrScan.actions.back")}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>{t("qrScan.loading")}</p>
      </div>
    );
  }

  if (!userPermissions.canScanVisits) {
    return (
      <div className="qr-scan-container">
        <div className="qr-scan-error-card" role="alert">
          <h2>{t("qrScan.error.title")}</h2>
          <p aria-label={t("qrScan.aria.errorMessage")}>
            {t("qrScan.error.accessDenied")}
          </p>
          <button
            className="qr-back-btn"
            onClick={() => navigate(-1)}
            aria-label={t("qrScan.aria.backButton")}
          >
            <FaArrowLeft aria-hidden="true" /> {t("qrScan.actions.back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="qr-scan-container" role="main">
      <header className="qr-header">
        <h1>{t("qrScan.title")}</h1>
        <p>
          {visit.agentID
            ? t("qrScan.description")
            : t("qrScan.recruitmentDescription")}
        </p>
      </header>

      <section
        className={`qr-scan-card ${isShaking ? "shake" : ""} ${isSuccess ? "success" : ""}`}
        aria-live="polite"
      >
        {qrVerified ? (
          <form onSubmit={handleValidateOTP}>
            <div className="form-group">
              <div className="otp-timer">
                {t("qrScan.otpTimer")}:{" "}
                <span className={otpTimer <= 30 ? "timer-warning" : ""}>
                  {formatTime(otpTimer)}
                </span>
              </div>
              <label htmlFor="otpInput">{t("qrScan.form.otp")}</label>
              <input
                id="otpInput"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder={t("qrScan.form.placeholders.enterOTP")}
                required
                aria-label={t("qrScan.form.placeholders.enterOTP")}
                disabled={validating}
              />
            </div>
            {backendError && (
              <div
                className="qr-error"
                role="alert"
                aria-label={t("qrScan.aria.errorMessage")}
              >
                <p>{backendError}</p>
              </div>
            )}
            <div className="qr-actions">
              <button
                type="button"
                className="qr-back-btn"
                onClick={handleBack}
                aria-label={t("qrScan.aria.backButton")}
                disabled={validating}
              >
                <FaArrowLeft aria-hidden="true" /> {t("qrScan.actions.back")}
              </button>
              <button
                type="submit"
                className="qr-back-btn"
                disabled={validating}
                aria-label={t("qrScan.actions.aria.validateOTP")}
              >
                {validating ? (
                  <span className="spinner"></span>
                ) : (
                  <FaCheck aria-hidden="true" />
                )}{" "}
                {t("qrScan.actions.validateOTP")}
              </button>
            </div>
          </form>
        ) : (
          <>
            {loading ? (
              <div className="qr-loading">
                <p>{t("qrScan.status.startingCamera")}</p>
              </div>
            ) : (
              <>
                {visit.agentID ? (
                  <div id="qr-reader" className="qr-reader" ref={qrRef}></div>
                ) : (
                  <div className="qr-placeholder">
                    <p>{t("qrScan.status.recruitmentVisit")}</p>
                  </div>
                )}
                <div className="qr-status">
                  <p>{status}</p>
                </div>
                {backendError && (
                  <div
                    className="qr-error"
                    role="alert"
                    aria-label={t("qrScan.aria.errorMessage")}
                  >
                    <p>{backendError}</p>
                  </div>
                )}
                <div className="qr-actions">
                  <button
                    className="qr-back-btn"
                    onClick={handleBack}
                    aria-label={t("qrScan.aria.backButton")}
                  >
                    <FaArrowLeft aria-hidden="true" /> {t("qrScan.actions.back")}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default QRScan;