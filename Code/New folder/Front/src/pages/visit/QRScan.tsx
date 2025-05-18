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
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCode = useRef<Html5Qrcode | null>(null);

  const userPermissions = useMemo(
    () => ({
      canScanVisits: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.SCAN_VISITS
      ),
    }),
    [effectivePermissions]
  );

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
      // Skip QR scan for recruitment visits
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

    const html5QrCode = new Html5Qrcode("qr-reader");
    qrCode.current = html5QrCode;

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    const qrCodeSuccessCallback = async (decodedText: string) => {
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
      console.warn(`QR scan error: ${error}`);
      if (error.includes("NotAllowedError")) {
        console.error("Camera access denied.");
      } else if (error.includes("NotFoundError")) {
        console.error("No camera found.");
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

  const handleBack = () => {
    navigate(-1);
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

  return (
    <div className="qr-scan-container">
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
        aria-label={t("qrScan.aria.qrReader", { status })}
      >
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
          </>
        )}
      </section>

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