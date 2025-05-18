import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  FaUser,
  FaPhone,
  FaListUl,
  FaCheckCircle,
  FaArrowLeft,
  FaCheck,
  FaCamera,
  FaTimes,
} from "react-icons/fa";
import "./VisitValidation.css";
import { getAgentById } from "../../apis/agentAPI";
import { getVisitById, logVisitDetails } from "../../apis/visitAPI";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

const PERMISSIONS = {
  LOG_VISITS: import.meta.env.VITE_PERMISSIONS_LOG_VISITS,
};

const VisitValidation: React.FC = () => {
  const { t } = useTranslation();
  const { idVisit } = useParams<{ idVisit: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { effectivePermissions, permissionsLoaded } = useAuth();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [checklist, setChecklist] = useState<
    Array<{ id: string; item: string; checked: boolean }>
  >([]);
  const [qrScanDate, setQrScanDate] = useState<string | null>(null);
  const [qrScanTime, setQrScanTime] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [comment, setComment] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);
  const [isNonRecruitment, setIsNonRecruitment] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const otpID = (location.state as { otpID?: string })?.otpID;

  const userPermissions = useMemo(
    () => ({
      canLogVisits: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.LOG_VISITS
      ),
    }),
    [effectivePermissions]
  );

  // Helper function to manage visit start time in localStorage
  const getVisitStartTime = (visitId: string): number => {
    const key = `visit_start_time_${visitId}`;
    const storedTime = localStorage.getItem(key);
    if (storedTime) {
      return parseInt(storedTime, 10);
    }
    const newStartTime = Date.now();
    localStorage.setItem(key, newStartTime.toString());
    return newStartTime;
  };

  // Helper function to clear visit start time from localStorage
  const clearVisitStartTime = (visitId: string) => {
    const key = `visit_start_time_${visitId}`;
    localStorage.removeItem(key);
  };

  useEffect(() => {
    if (permissionsLoaded && !location.state?.fromValidQRScan) {
      setError(t("visitValidation.error.accessDenied"));
      navigate(`/visit/${idVisit}`, { replace: true });
    }
  }, [location.state, permissionsLoaded, navigate, idVisit, t]);

  useEffect(() => {
    const now = new Date();
    setQrScanDate(format(now, "yyyy-MM-dd"));
    setQrScanTime(format(now, "HH:mm"));
  }, []);

  useEffect(() => {
    const fetchVisitData = async () => {
      if (!idVisit) {
        setError(t("visitValidation.error.missingData"));
        setLoading(false);
        return;
      }
      if (!permissionsLoaded) return;

      try {
        setLoading(true);
        const visitData = await getVisitById(idVisit);
        setVisit(visitData);
        if (visitData.agentID) {
          setIsNonRecruitment(true);
          const agentData = await getAgentById(visitData.agentID);
          setAgent(agentData);
        } else {
          setAgent(null); // Explicitly set null for recruitment visits
        }
        const initialChecklist =
          visitData.Checklists?.map((cl) => ({
            id: cl.checklistID,
            item: cl.item,
            checked: cl.VisitChecklist?.checked || false,
          })) || [];
        setChecklist(initialChecklist);
        // Initialize start time in localStorage when visit data is loaded
        getVisitStartTime(idVisit);
      } catch (err) {
        setError(t("visitValidation.error.fetchFailed"));
        console.error("Fetch visit data error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVisitData();
  }, [idVisit, userPermissions.canLogVisits, permissionsLoaded, t]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      } else {
        console.error("Video ref is null");
        setError(t("visitValidation.error.videoNotFound"));
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        const errorMessage =
          err.name === "NotReadableError"
            ? t("visitValidation.error.cameraInUse")
            : t("visitValidation.error.cameraAccess");
        setError(errorMessage);
        console.error("Camera access error:", err.name, err.message);
      } else {
        setError(t("visitValidation.error.unknown"));
        console.error("Unknown error:", err);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && videoRef.current.srcObject) {
      videoRef.current.play().catch((err) => {
        console.error("Video play failed:", err);
        setError(t("visitValidation.error.cameraPlayFailed"));
      });
    }
  }, [isCameraActive, t]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `photo-${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            console.log("Captured photo:", file);
            setPhotos((prev) => [...prev, file]);
            setFlashEffect(true);
            setTimeout(() => setFlashEffect(false), 300);
          } else {
            console.error("Blob is null");
          }
        }, "image/jpeg");
      }
    } else {
      console.error("Video or canvas ref is null");
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const openPhotoPreview = (photo: File) => {
    setSelectedPhoto(URL.createObjectURL(photo));
  };

  const closePhotoPreview = () => {
    setSelectedPhoto(null);
  };

  const handleChecklistChange = (checklistId: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === checklistId ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const handleValidate = async () => {
    if (
      !visit ||
      !idVisit ||
      !userPermissions.canLogVisits ||
      photos.length === 0 ||
      (isNonRecruitment && !otpCode)
    ) {
      setError(
        photos.length === 0
          ? t("visitValidation.error.noPhotos")
          : isNonRecruitment && !otpCode
            ? t("visitValidation.error.noOtp")
            : t("visitValidation.error.accessDenied")
      );
      return;
    }

    console.log("Photos before sending:", photos);
    console.log("Photos length:", photos.length);
    console.log("QR Scan Date:", qrScanDate);
    console.log("QR Scan Time:", qrScanTime);
    console.log("OTP Code:", otpCode);

    setIsSubmitting(true);
    setError(null);

    try {
      // Retrieve start time from localStorage
      const startTime = getVisitStartTime(idVisit);
      const currentTime = Date.now();
      const durationMs = currentTime - startTime;
      const durationMinutes = Math.floor(durationMs / (1000 * 60));

      const checklistUpdates = checklist.map((item) => ({
        checklistID: item.id,
        checked: item.checked,
      }));

      const updatedVisitData = {
        duration: durationMinutes,
        checklistUpdates,
        photos,
        comment,
        date: qrScanDate ?? undefined,
        time: qrScanTime ?? undefined,
        status: "visited", // Set status to visited
        otpCode: isNonRecruitment ? otpCode : undefined,
      };

      await logVisitDetails(idVisit, updatedVisitData);
      // Clear start time from localStorage after successful submission
      clearVisitStartTime(idVisit);
      stopCamera();
      navigate("/timesheet");
    } catch (err) {
      setError(t("visitValidation.error.validationFailed"));
      console.error("Validate visit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    stopCamera();
    navigate("/timesheet");
  };

  const completedItems = useMemo(
    () => checklist.filter((item) => item.checked).length,
    [checklist]
  );
  const totalItems = checklist.length;
  const lastPhotoUrl =
    photos.length > 0 ? URL.createObjectURL(photos[photos.length - 1]) : null;

  const checklistCount =
    t("visitValidation.checklist.count", {
      completed: completedItems,
      total: totalItems,
    }) || `${completedItems} of ${totalItems} completed`;
  const photosCount =
    t("visitValidation.photos.count", { count: photos.length }) ||
    `(${photos.length} photos)`;

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>{t("visitValidation.loading")}</p>
      </div>
    );
  }
  if (error || !visit || !userPermissions.canLogVisits) {
    return (
      <div className="visit-validation-container">
        <div className="error" role="alert">
          {error || t("visitValidation.error.accessDenied")}
        </div>
        <button
          className="back-btn"
          onClick={handleCancel}
          aria-label={t("visitValidation.aria.backButton")}
        >
          <FaArrowLeft /> {t("visitValidation.actions.back")}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`visit-validation-container ${isCameraActive ? "camera-active" : ""}`}
    >
      {!isCameraActive && (
        <header className="visit-header-0">
          <h1>
            {t("visitValidation.title")}
            <span className={`status-dot status-${visit.status}`}></span>
          </h1>
          <p>{t("visitValidation.description")}</p>
        </header>
      )}

      <section className="visit-card">
        <div className="details-section">
          <h2>
            <FaUser /> {t("visitValidation.visitDetails.title")}
          </h2>
          <div className="detail-item">
            <span>
              <FaUser /> {t("visitValidation.visitDetails.agent")}
            </span>
            <p>
              {agent
                ? `${agent.name} ${agent.lastname}`
                : t("visitValidation.visitDetails.recruitmentVisit")}
            </p>
          </div>
          <div className="detail-item">
            <span>
              <FaPhone /> {t("visitValidation.visitDetails.phone")}
            </span>
            <p>
              {agent?.phone || t("visitValidation.visitDetails.recruitmentVisit")}
            </p>
          </div>
        </div>

        {isNonRecruitment && otpID && (
          <div className="otp-section">
            <h2>{t("visitValidation.otp.title")}</h2>
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder={t("visitValidation.otp.placeholder")}
              className="otp-input"
              aria-label={t("visitValidation.otp.label")}
              maxLength={6}
              pattern="\d{6}"
            />
          </div>
        )}

        <div className="reasons-section">
          <h2>
            <FaListUl /> {t("visitValidation.reasons.title")}
          </h2>
          {visit.Reasons && visit.Reasons.length > 0 ? (
            <ul>
              {visit.Reasons.map((reason, index) => (
                <li key={index}>{reason.item}</li>
              ))}
            </ul>
          ) : (
            <p className="no-data">{t("visitValidation.reasons.noData")}</p>
          )}
        </div>

        <div className="checklist-section">
          <h2>
            <FaCheckCircle /> {t("visitValidation.checklist.title")}{" "}
            {checklistCount}
          </h2>
          {checklist.length > 0 ? (
            <>
              <ul className="checklist">
                {checklist.map((item) => {
                  const checklistItemLabel =
                    t("visitValidation.checklist.itemLabel", {
                      item: item.item,
                    }) || item.item;
                  return (
                    <li key={item.id} className={item.checked ? "checked" : ""}>
                      <label className="custom-checkbox-label">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => handleChecklistChange(item.id)}
                          className="custom-checkbox-input"
                          aria-label={
                            t("visitValidation.aria.checklistItem", {
                              item: item.item,
                            }) || `Toggle ${item.item}`
                          }
                        />
                        <span className="custom-checkbox">
                          <FaCheck className="check-icon" />
                        </span>
                        <span className="checklist-text">
                          {checklistItemLabel}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(completedItems / totalItems) * 100}%` }}
                ></div>
              </div>
            </>
          ) : (
            <p className="no-data">{t("visitValidation.checklist.noData")}</p>
          )}
        </div>

        <div className="photos-section">
          <h2>
            <FaCamera /> {t("visitValidation.photos.title")} {photosCount}
          </h2>
          <div className="camera-controls">
            <button
              className="camera-btn"
              onClick={startCamera}
              disabled={isCameraActive}
              aria-label={t("visitValidation.aria.startCamera")}
            >
              <FaCamera /> {t("visitValidation.photos.startCamera")}
            </button>
            <div
              className={`camera-container ${isCameraActive ? "active" : ""}`}
            >
              <div className="camera-frame">
                <video
                  ref={videoRef}
                  className="camera-preview"
                  muted
                  playsInline
                />
                <div
                  className={`flash-overlay ${flashEffect ? "active" : ""}`}
                ></div>
                <div className="photo-counter">
                  <FaCamera /> {photos.length}
                </div>
                {lastPhotoUrl && (
                  <div className="thumbnail-preview">
                    <img
                      src={lastPhotoUrl}
                      alt={t("visitValidation.photos.lastCapturedAlt")}
                    />
                  </div>
                )}
              </div>
              {isCameraActive && (
                <>
                  <button
                    className="stop-camera-btn"
                    onClick={stopCamera}
                    aria-label={t("visitValidation.aria.stopCamera")}
                  >
                    <FaTimes />
                  </button>
                  <button
                    className="capture-btn"
                    onClick={capturePhoto}
                    aria-label={t("visitValidation.aria.capturePhoto")}
                  >
                    <FaCamera />
                  </button>
                </>
              )}
            </div>
          </div>
          {photos.length > 0 && (
            <div className="photo-previews">
              {photos.map((photo, index) => {
                const previewPhotoAria =
                  t("visitValidation.aria.previewPhoto", {
                    index: index + 1,
                  }) || `Preview photo ${index + 1}`;
                const removePhotoAria =
                  t("visitValidation.aria.removePhoto", { index: index + 1 }) ||
                  `Remove photo ${index + 1}`;
                const capturedAlt =
                  t("visitValidation.photos.capturedAlt", {
                    index: index + 1,
                  }) || `Captured photo ${index + 1}`;
                return (
                  <div key={index} className="photo-container">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt={capturedAlt}
                      className="photo-preview"
                      onClick={() => openPhotoPreview(photo)}
                      aria-label={previewPhotoAria}
                    />
                    <button
                      className="remove-photo-btn"
                      onClick={() => removePhoto(index)}
                      aria-label={removePhotoAria}
                    >
                      <FaTimes />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="photo-note">{t("visitValidation.photos.note")}</p>
        </div>

        <div className="comment-section">
          <h2>{t("visitValidation.comment.title")}</h2>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("visitValidation.comment.placeholder")}
            className="comment-input"
            aria-label={t("visitValidation.comment.label")}
          />
        </div>

        <div className="visit-actions">
          <button
            className={`validate-btn ${isSubmitting ? "submitting" : ""}`}
            onClick={handleValidate}
            disabled={isSubmitting || photos.length === 0 || (isNonRecruitment && !otpCode)}
            aria-label={t("visitValidation.aria.validateButton")}
          >
            <FaCheck />{" "}
            {isSubmitting
              ? t("visitValidation.actions.validating")
              : t("visitValidation.actions.validate")}
          </button>
          <button
            className="back-btn"
            onClick={handleCancel}
            aria-label={t("visitValidation.aria.backButton")}
          >
            <FaArrowLeft /> {t("visitValidation.actions.back")}
          </button>
        </div>
      </section>

      <canvas ref={canvasRef} style={{ display: "none" }} />
      {selectedPhoto && (
        <div className="photo-fullscreen-preview" onClick={closePhotoPreview}>
          <img
            src={selectedPhoto}
            alt={t("visitValidation.photos.fullscreenAlt")}
            className="fullscreen-image"
          />
          <button
            className="close-preview-btn"
            onClick={closePhotoPreview}
            aria-label="Close photo preview"
          >
            <FaTimes />
          </button>
        </div>
      )}
    </div>
  );
};

export default VisitValidation;