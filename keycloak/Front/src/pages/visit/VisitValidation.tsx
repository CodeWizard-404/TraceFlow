import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FaUser, FaPhone, FaListUl, FaCheckCircle, FaArrowLeft, FaCheck, FaCamera, FaTimes } from "react-icons/fa";
import "./VisitValidation.css";
import { getAgentById } from "../../apis/agentAPI";
import { getVisitById, logVisitDetails } from "../../apis/visitAPI";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";
import { useAuth } from "../../context/AuthContext";

const PERMISSIONS = {
    LOG_VISITS: import.meta.env.VITE_PERMISSIONS_LOG_VISITS,
};

const VisitValidation: React.FC = () => {
    const { idVisit } = useParams<{ idVisit: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { effectivePermissions, permissionsLoaded } = useAuth();

    const [visit, setVisit] = useState<Visit | null>(null);
    const [agent, setAgent] = useState<Agent | null>(null);
    const [checklist, setChecklist] = useState<Array<{ id: string; item: string; checked: boolean }>>([]);
    const [entryTime, setEntryTime] = useState<number | null>(null);
    const [photos, setPhotos] = useState<File[]>([]);
    const [comment, setComment] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const [flashEffect, setFlashEffect] = useState<boolean>(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const userPermissions = useMemo(() => ({
        canLogVisits: effectivePermissions?.some(p => p.name === PERMISSIONS.LOG_VISITS),
    }), [effectivePermissions]);

    useEffect(() => {
        if (permissionsLoaded && !location.state?.fromValidQRScan) {
            setError("Access denied. Please scan a valid QR code first.");
            navigate(`/visit/${idVisit}`, { replace: true });
        }
    }, [location.state, permissionsLoaded, navigate, idVisit]);

    useEffect(() => {

        const fetchVisitData = async () => {
            if (!idVisit) {
                setError("Missing visit ID or authentication token.");
                setLoading(false);
                return;
            }
            if (!permissionsLoaded) return;

            try {
                setLoading(true);
                const visitData = await getVisitById(idVisit);
                setVisit(visitData);
                if (visitData.agentID) {
                    const agentData = await getAgentById(visitData.agentID);
                    setAgent(agentData);
                }
                const initialChecklist = visitData.Checklists?.map((cl) => ({
                    id: cl.checklistID,
                    item: cl.item,
                    checked: cl.VisitChecklist?.checked || false,
                })) || [];
                setChecklist(initialChecklist);
                setEntryTime(Date.now());
            } catch (err) {
                setError("Failed to load visit or agent data.");
                console.error("Fetch visit data error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchVisitData();
    }, [idVisit, userPermissions.canLogVisits, permissionsLoaded]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraActive(true);
            } else {
                console.error("Video ref is null");
                setError("Video element not found.");
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                const errorMessage = err.name === "NotReadableError"
                    ? "Camera is in use by another app or unavailable. Please close other apps or check your device."
                    : "Failed to access camera. Please ensure permissions are granted.";
                setError(errorMessage);
                console.error("Camera access error:", err.name, err.message);
            } else {
                setError("An unknown error occurred.");
                console.error("Unknown error:", err);
            }
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => {
                track.stop();
            });
            videoRef.current.srcObject = null;
            setIsCameraActive(false);
        }
    };

    useEffect(() => {
        if (isCameraActive && videoRef.current && videoRef.current.srcObject) {
            videoRef.current.play()
                .catch(err => {
                    console.error("Video play failed:", err);
                    setError("Failed to play camera stream.");
                });
        }
    }, [isCameraActive]);

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
                        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
                        setPhotos((prev) => [...prev, file]);
                        setFlashEffect(true);
                        setTimeout(() => setFlashEffect(false), 300);
                    }
                }, "image/jpeg");
            }
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
            prev.map((item) => (item.id === checklistId ? { ...item, checked: !item.checked } : item))
        );
    };

    const handleValidate = async () => {
        if (!visit || !idVisit || !entryTime || !userPermissions.canLogVisits || photos.length === 0) {
            setError(photos.length === 0 ? "At least one photo is required." : "Access denied or missing data.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const currentTime = Date.now();
            const durationMs = currentTime - entryTime;
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
            };

            await logVisitDetails(idVisit, updatedVisitData);
            stopCamera();
            navigate("/timesheet");
        } catch (err) {
            setError("Failed to validate visit.");
            console.error("Validate visit error:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const completedItems = useMemo(() => checklist.filter((item) => item.checked).length, [checklist]);
    const totalItems = checklist.length;
    const lastPhotoUrl = photos.length > 0 ? URL.createObjectURL(photos[photos.length - 1]) : null;

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>Loading Visit Details...</p>
            </div>
        );
    }
    if (error || !visit || !userPermissions.canLogVisits) return (
        <div className="visit-validation-container">
            <div className="error">{error || "Visit not found or access denied."}</div>
            <button className="back-btn" onClick={() => { navigate(0); }}>
                <FaArrowLeft /> Back
            </button>
        </div>
    );

    return (
        <div className={`visit-validation-container ${isCameraActive ? 'camera-active' : ''}`}>
            {!isCameraActive && (
                <header className="visit-header-0">
                    <h1>
                        Validate Visit
                        <span className={`status-dot status-${visit.status}`}></span>
                    </h1>
                    <p>Complete the checklist, add photos, and validate the visit.</p>
                </header>
            )}

            <section className="visit-card">
                <div className="details-section">
                    <h2><FaUser /> Visit Details</h2>
                    <div className="detail-item">
                        <span><FaUser /> Agent</span>
                        <p>{agent ? `${agent.name} ${agent.lastname}` : "N/A"}</p>
                    </div>
                    <div className="detail-item">
                        <span><FaPhone /> Phone</span>
                        <p>{agent?.phone || "N/A"}</p>
                    </div>
                </div>

                <div className="reasons-section">
                    <h2><FaListUl /> Reasons</h2>
                    {visit.Reasons && visit.Reasons.length > 0 ? (
                        <ul>
                            {visit.Reasons.map((reason, index) => (
                                <li key={index}>{reason.item}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="no-data">No reasons specified.</p>
                    )}
                </div>

                <div className="checklist-section">
                    <h2><FaCheckCircle /> Checklist ({completedItems}/{totalItems})</h2>
                    {checklist.length > 0 ? (
                        <>
                            <ul className="checklist">
                                {checklist.map((item) => (
                                    <li key={item.id} className={item.checked ? "checked" : ""}>
                                        <label className="custom-checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={item.checked}
                                                onChange={() => handleChecklistChange(item.id)}
                                                className="custom-checkbox-input"
                                            />
                                            <span className="custom-checkbox">
                                                <FaCheck className="check-icon" />
                                            </span>
                                            <span className="checklist-text">{item.item}</span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(completedItems / totalItems) * 100}%` }}
                                ></div>
                            </div>
                        </>
                    ) : (
                        <p className="no-data">No checklist items available.</p>
                    )}
                </div>

                <div className="photos-section">
                    <h2><FaCamera /> Photos ({photos.length})</h2>
                    <div className="camera-controls">
                        <button className="camera-btn" onClick={startCamera} disabled={isCameraActive}>
                            <FaCamera /> Start Camera
                        </button>
                        <div className={`camera-container ${isCameraActive ? 'active' : ''}`}>
                            <div className="camera-frame">
                                <video
                                    ref={videoRef}
                                    className="camera-preview"
                                    muted
                                    playsInline
                                />
                                <div className={`flash-overlay ${flashEffect ? 'active' : ''}`}></div>
                                <div className="photo-counter">
                                    <FaCamera /> {photos.length}
                                </div>
                                {lastPhotoUrl && (
                                    <div className="thumbnail-preview">
                                        <img src={lastPhotoUrl} alt="Last captured" />
                                    </div>
                                )}
                            </div>
                            {isCameraActive && (
                                <>
                                    <button className="stop-camera-btn" onClick={stopCamera}>
                                        <FaTimes />
                                    </button>
                                    <button className="capture-btn" onClick={capturePhoto}>
                                        <FaCamera />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    {photos.length > 0 && (
                        <div className="photo-previews">
                            {photos.map((photo, index) => (
                                <div key={index} className="photo-container">
                                    <img
                                        src={URL.createObjectURL(photo)}
                                        alt={`Captured photo ${index + 1}`}
                                        className="photo-preview"
                                        onClick={() => openPhotoPreview(photo)}
                                    />
                                    <button
                                        className="remove-photo-btn"
                                        onClick={() => removePhoto(index)}
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="photo-note">At least one photo is required.</p>
                </div>

                <div className="comment-section">
                    <h2>Comment (Optional)</h2>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Add a comment about the visit..."
                        className="comment-input"
                    />
                </div>

                <div className="visit-actions">
                    <button
                        className={`validate-btn ${isSubmitting ? "submitting" : ""}`}
                        onClick={handleValidate}
                        disabled={isSubmitting || photos.length === 0}
                    >
                        <FaCheck /> {isSubmitting ? "Validating..." : "Validate Visit"}
                    </button>
                    <button className="back-btn" onClick={() => { stopCamera(); navigate("/timesheet"); }}>
                        <FaArrowLeft /> Back
                    </button>
                </div>
            </section>

            <canvas ref={canvasRef} style={{ display: "none" }} />
            {selectedPhoto && (
                <div className="photo-fullscreen-preview" onClick={closePhotoPreview}>
                    <img src={selectedPhoto} alt="Full-screen preview" className="fullscreen-image" />
                    <button className="close-preview-btn" onClick={closePhotoPreview}>
                        <FaTimes />
                    </button>
                </div>
            )}
        </div>
    );
};

export default VisitValidation;