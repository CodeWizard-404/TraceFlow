import React, { useEffect, useState, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import Visit from "../../models/Visit";
import "./QRScan.css";
import { verifyQrCode } from "../../apis/visitAPI";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";

const PERMISSIONS = {
  SCAN_VISITS: import.meta.env.VITE_PERMISSIONS_SCAN_VISITS,
};

// Main Component
const QRScan: React.FC = () => {
  // Hooks
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { effectivePermissions, permissionsLoaded } = useAuth();
  const visit = (location.state as { visit?: Visit })?.visit; // Visit data passed via location state

  // State
  const [backendError, setBackendError] = useState<string | null>(null); // Error message from backend verification
  const [status, setStatus] = useState<string>(t("qrScan.status.scanning")); // Current status of the QR scan process
  const [loading, setLoading] = useState<boolean>(true); // Loading state for camera initialization
  const [isMounted, setIsMounted] = useState<boolean>(false); // Tracks component mounting status
  const [isShaking, setIsShaking] = useState<boolean>(false); // Triggers shake animation on error
  const [isSuccess, setIsSuccess] = useState<boolean>(false); // Indicates successful QR validation
  const qrRef = useRef<HTMLDivElement>(null); // Reference to the QR reader DOM element
  const qrCode = useRef<Html5Qrcode | null>(null); // Reference to the Html5Qrcode instance

  // Permission Checks (Centralized)
  const userPermissions = useMemo(
    () => ({
      canScanVisits: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.SCAN_VISITS
      ),
    }),
    [effectivePermissions]
  );

  // QR Scanner Setup and Logic
  useEffect(() => {
    setIsMounted(true);

    // Validate preconditions
    if (!visit || !visit.visitID) {
      console.error(
        "No visit data provided. Please go back and select a visit."
      );
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

    if (!isMounted || !qrRef.current) {
      console.error("Failed to initialize QR scanner. Element not found.");
      setLoading(false);
      setStatus("");
      return;
    }

    // Initialize QR scanner
    const html5QrCode = new Html5Qrcode("qr-reader");
    qrCode.current = html5QrCode;

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    const qrCodeSuccessCallback = async (decodedText: string) => {
      // Handle successful QR code scan and verification
      setStatus(t("qrScan.status.detected"));
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStatus(t("qrScan.status.checking"));
      await new Promise((resolve) => setTimeout(resolve, 1500));

      try {
        const response = await verifyQrCode({
          qrData: decodedText,
          visitId: visit.visitID,
        });
        if (response.valid) {
          setStatus(t("qrScan.status.validating"));
          await new Promise((resolve) => setTimeout(resolve, 100));
          setIsSuccess(true);
          await new Promise((resolve) => setTimeout(resolve, 100));
          navigate(`/visit/${visit.visitID}/validate-checklist`, {
            state: { fromValidQRScan: true, visit },
          });
        } else {
          setBackendError(t("qrScan.error.mismatch"));
          setIsShaking(true);
          await new Promise((resolve) => setTimeout(resolve, 100));
          setIsShaking(false);
          setStatus(t("qrScan.status.scanning"));
        }
      } catch (err) {
        setBackendError(t("qrScan.error.mismatch"));
        setIsShaking(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
        setIsShaking(false);
        setStatus(t("qrScan.status.scanning"));
        console.error("QR verification error:", err);
      }
    };

    const qrCodeErrorCallback = (error: string) => {
      // Handle QR scan errors
      console.warn(`QR scan error: ${error}`);
      if (error.includes("NotAllowedError")) {
        console.error(
          "Camera access denied. Please allow camera access and try again."
        );
      } else if (error.includes("NotFoundError")) {
        console.error("No camera found on this device.");
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
      });

    // Cleanup on unmount
    return () => {
      if (qrCode.current) {
        qrCode.current
          .stop()
          .then(() => qrCode.current?.clear())
          .catch((err) => console.error("Cleanup error:", err));
      }
      setIsMounted(false);
    };
  }, [
    visit,
    navigate,
    permissionsLoaded,
    userPermissions.canScanVisits,
    isMounted,
    t,
  ]);

  // Handlers
  const handleBack = () => {
    // Navigate back to the previous page
    navigate(-1);
  };

  // Early Returns for Error States
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
            onClick={handleBack}
            aria-label={t("qrScan.aria.backButton")}
          >
            {t("qrScan.actions.back")}
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
            onClick={handleBack}
            aria-label={t("qrScan.aria.backButton")}
          >
            {t("qrScan.actions.back")}
          </button>
        </div>
      </div>
    );
  }

  // Render
  return (
    <div className="qr-scan-container">
      {/* Header Section */}
      <header className="qr-header">
        <h1>{t("qrScan.title")}</h1>
        <p>{t("qrScan.description")}</p>
      </header>

      {/* QR Scanner Section */}
      <section
        className={`qr-scan-card ${isShaking ? "shake" : ""} ${isSuccess ? "success" : ""
          }`}
        aria-live="polite"
        aria-label={t("qrScan.aria.qrReader", { status })}
      >
        {loading ? (
          <div className="qr-loading">
            <p>{t("qrScan.status.startingCamera")}</p>
          </div>
        ) : (
          <>
            <div id="qr-reader" className="qr-reader" ref={qrRef}></div>
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
          </>
        )}
      </section>

      {/* Action Buttons */}
      <div className="qr-actions">
        <button
          className="qr-back-btn"
          onClick={handleBack}
          aria-label={t("qrScan.aria.backButton")}
        >
          {t("qrScan.actions.back")}
        </button>
      </div>
    </div>
  );
};

export default QRScan;
