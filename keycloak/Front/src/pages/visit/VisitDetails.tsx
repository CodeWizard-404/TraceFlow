import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { debounce } from "lodash";
import {
  FaCalendar,
  FaClock,
  FaMapMarkerAlt,
  FaUser,
  FaPhone,
  FaListUl,
  FaCheckCircle,
  FaArrowLeft,
  FaCircle,
  FaEdit,
  FaTrash,
  FaCamera,
  FaComment,
  FaTimes,
} from "react-icons/fa";
import "./VisitDetails.css";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";
import VisitStatus from "../../models/Enum/VisitStatus";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";
import User from "../../models/User";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import {
  getAgentById,
  getAgentsByLocation,
  getAgentLocations,
  getAgentByPhone,
} from "../../apis/agentAPI";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { validateTimesheet } from "../../apis/timesheetAPI";
import { getSupervisorsByUser, getUserByPhone } from "../../apis/userAPI";
import { getVisitById, updateVisit, deleteVisit } from "../../apis/visitAPI";
import { useTranslation } from "react-i18next";

// Constants for environment variables and permissions
const BASE_URL = import.meta.env.VITE_BASE_URL;
const PERMISSIONS = {
  ACCESS_VISIT_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS,
  LOG_VISITS: import.meta.env.VITE_PERMISSIONS_LOG_VISITS,
  VALIDATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_VALIDATE_TIMESHEETS,
  EDIT_TIMESHEETS_FOR_SUPERVISOR: import.meta.env.VITE_PERMISSIONS_EDIT_VISIT,
  DELETE_TIMESHEETS_FOR_SUPERVISOR: import.meta.env
    .VITE_PERMISSIONS_DELETE_VISIT,
  READ_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
  READ_AGENTS_BY_LOCATION: import.meta.env
    .VITE_PERMISSIONS_READ_AGENTS_BY_LOCATION,
  READ_AGENTS_BY_PHONE: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_PHONE,
  READ_REASON_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS,
  READ_CHECKLISTS_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS,
  CREATE_TIMESHEETS_FOR_SUPERVISORS: import.meta.env
    .VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR,
} as const;

// Interface for edit tracking
interface EditTracking {
  startTime: number | null;
  durationAccumulator: number; // in minutes
}

// Interface for edit form state with original values
interface EditFormState {
  date: string;
  time: string;
  location: string;
  status: string;
  comment: string;
  agentID: string;
  agentSearch: string;
  agentPhone: string;
  locationSearch: string;
  reasonSearch: string;
  checklistSearch: string;
  checklists: Array<{ id: string; checked: boolean }>;
  reasons: Array<{ id: string }>;
  photosToRemove: string[];
  original: {
    date: string;
    time: string;
    location: string;
    status: string;
    comment: string;
    agentID: string;
    checklists: Array<{ id: string; checked: boolean }>;
    reasons: Array<{ id: string }>;
  };
}

/**
 * VisitDetails component: Displays and manages visit details with editing capabilities
 * and fullscreen image preview.
 */
const VisitDetails: React.FC = () => {
  const { t } = useTranslation();
  const { idVisit } = useParams<{ idVisit: string }>();
  const navigate = useNavigate();
  const { user, effectivePermissions, permissionsLoaded } = useAuth();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");
  const [supervisorPhone, setSupervisorPhone] = useState<string>("");
  const [supervisorSearch, setSupervisorSearch] = useState<string>("");

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [editTracking, setEditTracking] = useState<EditTracking>({
    startTime: null,
    durationAccumulator: 0,
  });

  const [editForm, setEditForm] = useState<EditFormState>({
    date: "",
    time: "",
    location: "",
    status: "",
    comment: "",
    agentID: "",
    agentSearch: "",
    agentPhone: "",
    locationSearch: "",
    reasonSearch: "",
    checklistSearch: "",
    checklists: [],
    reasons: [],
    photosToRemove: [],
    original: {
      date: "",
      time: "",
      location: "",
      status: "",
      comment: "",
      agentID: "",
      checklists: [],
      reasons: [],
    },
  });

  const userPermissions = useMemo(
    () => ({
      canAccessVisitDetails: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_VISIT_DETAILS
      ),
      canLogVisits: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.LOG_VISITS
      ),
      canValidateTimesheets: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.VALIDATE_TIMESHEETS
      ),
      canEditTimesheets: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.EDIT_TIMESHEETS_FOR_SUPERVISOR
      ),
      canDeleteTimesheets: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.DELETE_TIMESHEETS_FOR_SUPERVISOR
      ),
      canReadSupervisors: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_SUPERVISORS
      ),
      canReadAgentsByLocation: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_AGENTS_BY_LOCATION
      ),
      canReadAgentsByPhone: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_AGENTS_BY_PHONE
      ),
      canReadReasons: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_REASON_ITEMS
      ),
      canReadChecklists: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_CHECKLISTS_ITEMS
      ),
      canCreateTimesheetsForSupervisors: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.CREATE_TIMESHEETS_FOR_SUPERVISORS
      ),
    }),
    [effectivePermissions]
  );

  const getCurrentDateTime = () => {
    const now = new Date();
    return {
      date: now.toISOString().split("T")[0],
      time: `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
    };
  };

  const isWeekend = (date: string) => new Date(date).getDay() % 6 === 0;

  const isValidTime = (date: string, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    if (hours < 8 || hours > 17 || (hours === 17 && minutes > 0)) return false;
    const { date: currentDate, time: currentTime } = getCurrentDateTime();
    if (date === currentDate) {
      const [currentH, currentM] = currentTime.split(":").map(Number);
      return !(hours < currentH || (hours === currentH && minutes < currentM));
    }
    return true;
  };

  const fetchVisitData = useCallback(async () => {
    if (!idVisit || !userPermissions.canAccessVisitDetails) {
      navigate("/access-denied");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const visitData = await getVisitById(idVisit);
      setVisit(visitData);

      const agentData = visitData.agentID
        ? await getAgentById(visitData.agentID)
        : null;
      setAgent(agentData);

      setEditForm({
        date: visitData.date,
        time: visitData.time.slice(0, 5),
        location: visitData.location || "",
        status: visitData.status,
        comment: visitData.comment || "",
        agentID: visitData.agentID,
        agentSearch: agentData ? `${agentData.name} ${agentData.lastname}` : "",
        agentPhone: "",
        locationSearch: "",
        reasonSearch: "",
        checklistSearch: "",
        checklists:
          visitData.Checklists?.map((c) => ({
            id: c.checklistID,
            checked: c.VisitChecklist?.checked || false,
          })) || [],
        reasons: visitData.Reasons?.map((r) => ({ id: r.reasonID })) || [],
        photosToRemove: [],
        original: {
          date: visitData.date,
          time: visitData.time.slice(0, 5),
          location: visitData.location || "",
          status: visitData.status,
          comment: visitData.comment || "",
          agentID: visitData.agentID,
          checklists:
            visitData.Checklists?.map((c) => ({
              id: c.checklistID,
              checked: c.VisitChecklist?.checked || false,
            })) || [],
          reasons: visitData.Reasons?.map((r) => ({ id: r.reasonID })) || [],
        },
      });
      setSelectedSupervisor("");

      const [locationsData, reasonsData, checklistsData, supervisorsData] =
        await Promise.all([
          userPermissions.canReadAgentsByLocation
            ? getAgentLocations()
            : Promise.resolve([]),
          userPermissions.canReadReasons
            ? getAllReasons()
            : Promise.resolve([]),
          userPermissions.canReadChecklists
            ? getAllChecklists()
            : Promise.resolve([]),
          userPermissions.canReadSupervisors && user
            ? getSupervisorsByUser(user.userID)
            : Promise.resolve([]),
        ]);

      setLocations(locationsData as string[]);
      setReasons(reasonsData as Reason[]);
      setChecklists(checklistsData as Checklist[]);
      setSupervisors(supervisorsData as User[]);
    } catch (err) {
      setError(t("visitDetails.error.fetchFailed"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [idVisit, userPermissions, permissionsLoaded, navigate, user, t]);

  useEffect(() => {
    if (permissionsLoaded) fetchVisitData();
  }, [fetchVisitData, permissionsLoaded]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      setError(t("visitDetails.error.cameraAccess"));
      console.error("Camera access error:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current) {
      videoRef.current.play().catch((err: unknown) => {
        setError(t("visitDetails.error.cameraPlayFailed"));
        console.error("Video play failed:", err);
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
            setNewPhotos((prev) => [...prev, file]);
            setFlashEffect(true);
            setTimeout(() => setFlashEffect(false), 300);
          } else {
            console.error("Failed to create blob from canvas.");
          }
        }, "image/jpeg");
      }
    }
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Debounced API calls
  const fetchAgentByPhone = useCallback(
    debounce(async (phone: string) => {
      if (phone.length < 7 || !userPermissions.canReadAgentsByPhone) return;
      try {
        const agentData = await getAgentByPhone(phone);
        setEditForm((prev) => ({
          ...prev,
          agentID: agentData.agentID,
          agentSearch: `${agentData.name || ""} ${agentData.lastname || ""}`,
          location: agentData.location || "",
        }));
        setAgents([agentData]);
      } catch {
        setError(t("visitDetails.error.agentNotFound"));
        setEditForm((prev) => ({ ...prev, agentID: "", agentSearch: "" }));
        setAgents([]);
      }
    }, 500),
    [userPermissions.canReadAgentsByPhone, t]
  );

  const fetchSupervisorByPhone = useCallback(
    debounce(async (phone: string) => {
      if (phone.length < 7 || !userPermissions.canReadSupervisors) return;
      try {
        const supervisor = await getUserByPhone(phone);
        setSelectedSupervisor(supervisor.userID);
        setSupervisors((prev) =>
          prev.some((s) => s.userID === supervisor.userID)
            ? prev
            : [...prev, supervisor]
        );
        setSupervisorSearch(
          `${supervisor.firstname || ""} ${supervisor.lastname || ""}`
        );
      } catch {
        setError(t("visitDetails.error.supervisorNotFound"));
        setSelectedSupervisor("");
        setSupervisorSearch("");
      }
    }, 500),
    [userPermissions.canReadSupervisors, t]
  );

  useEffect(() => {
    if (editForm.agentPhone) fetchAgentByPhone(editForm.agentPhone);
    if (supervisorPhone) fetchSupervisorByPhone(supervisorPhone);
    return () => {
      fetchAgentByPhone.cancel();
      fetchSupervisorByPhone.cancel();
    };
  }, [
    editForm.agentPhone,
    supervisorPhone,
    fetchAgentByPhone,
    fetchSupervisorByPhone,
  ]);

  useEffect(() => {
    if (
      editForm.location &&
      !editForm.agentPhone &&
      userPermissions.canReadAgentsByLocation
    ) {
      const fetchAgents = async () => {
        try {
          const agentsData = await getAgentsByLocation(editForm.location);
          setAgents(agentsData);
          if (!editForm.agentPhone) {
            setEditForm((prev) => ({ ...prev, agentID: "", agentSearch: "" }));
          }
        } catch {
          setError(
            t("visitDetails.error.agentsLoadFailed", {
              location: editForm.location,
            })
          );
        }
      };
      fetchAgents();
    }
  }, [
    editForm.location,
    editForm.agentPhone,
    userPermissions.canReadAgentsByLocation,
    t,
  ]);

  const handleLogVisit = () => {
    if (visit && userPermissions.canLogVisits) {
      navigate("/qr-scan", { state: { visit } });
    }
  };

  const handleValidate = async () => {
    if (!visit || !visit.timesheetID || !userPermissions.canValidateTimesheets)
      return;
    try {
      await validateTimesheet(visit.timesheetID, {
        visitIDs: [visit.visitID],
        status: "validated",
      });
      setVisit((prev) =>
        prev ? { ...prev, status: VisitStatus.VALIDATED } : null
      );
    } catch {
      setError(t("visitDetails.error.validateFailed"));
    }
  };

  const handleReject = async () => {
    if (!visit || !visit.timesheetID || !userPermissions.canValidateTimesheets)
      return;
    try {
      await validateTimesheet(visit.timesheetID, {
        visitIDs: [visit.visitID],
        status: "rejected",
      });
      setVisit((prev) =>
        prev ? { ...prev, status: VisitStatus.REJECTED } : null
      );
    } catch {
      setError(t("visitDetails.error.rejectFailed"));
    }
  };

  const handleEditToggle = () => {
    if (!isEditing && visit?.status === VisitStatus.VISITED) {
      setEditTracking({
        startTime: Date.now(),
        durationAccumulator: visit.duration || 0,
      });
    }
    setIsEditing((prev) => {
      if (prev) {
        setEditForm((prevForm) => ({
          ...prevForm,
          date: prevForm.original.date,
          time: prevForm.original.time,
          location: prevForm.original.location,
          status: prevForm.original.status,
          comment: prevForm.original.comment,
          agentID: prevForm.original.agentID,
          checklists: [...prevForm.original.checklists],
          reasons: [...prevForm.original.reasons],
          photosToRemove: [],
        }));
        setEditTracking({ startTime: null, durationAccumulator: 0 });
      }
      return !prev;
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !visit ||
      !userPermissions.canEditTimesheets ||
      !editForm.date ||
      !editForm.time
    )
      return;

    let newStatus = editForm.status;
    let updatedDuration: number | undefined = visit.duration || undefined;

    if (visit.status === VisitStatus.VISITED && userPermissions.canLogVisits) {
      newStatus = VisitStatus.VISITED;
      if (editTracking.startTime) {
        const editDurationMinutes = Math.round(
          (Date.now() - editTracking.startTime) / 60000
        );
        updatedDuration =
          editTracking.durationAccumulator + editDurationMinutes;
      }
    } else if (
      userPermissions.canCreateTimesheetsForSupervisors &&
      selectedSupervisor
    ) {
      newStatus = VisitStatus.VALIDATED;
    } else if (
      [VisitStatus.VALIDATED, VisitStatus.REJECTED].includes(
        visit.status as VisitStatus
      )
    ) {
      newStatus = VisitStatus.PENDING;
    }

    try {
      const updatedVisit = await updateVisit(visit.visitID, {
        date: editForm.date,
        time: `${editForm.time}:00`,
        location: editForm.location,
        status: newStatus,
        comment: editForm.comment,
        agentID: editForm.agentID,
        checklists: editForm.checklists,
        reasons: editForm.reasons,
        photos: newPhotos,
        photosToRemove: editForm.photosToRemove,
        supervisorID:
          selectedSupervisor &&
          userPermissions.canCreateTimesheetsForSupervisors
            ? selectedSupervisor
            : undefined,
        duration: updatedDuration,
      });

      setVisit(updatedVisit);
      setNewPhotos([]);
      stopCamera();

      setEditTracking({ startTime: null, durationAccumulator: 0 });

      setIsEditing(false);
    } catch (err) {
      setError(t("visitDetails.error.updateFailed"));
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (
      !visit ||
      !userPermissions.canDeleteTimesheets ||
      !window.confirm(t("visitDetails.confirmDelete"))
    )
      return;
    try {
      await deleteVisit(visit.visitID);
      navigate("/timesheet");
    } catch {
      setError(t("visitDetails.error.deleteFailed"));
    }
  };

  const handleRemovePhoto = (photoUrl: string) => {
    setEditForm((prev) => ({
      ...prev,
      photosToRemove: [...prev.photosToRemove, photoUrl],
    }));
  };

  const handleChecklistChange = (id: string, checked: boolean) => {
    if (visit?.status !== "visited") return;
    setEditForm((prev) => ({
      ...prev,
      checklists: prev.checklists.map((c) =>
        c.id === id ? { ...c, checked } : c
      ),
    }));
  };

  const handleReasonSelect = (reason: Reason) => {
    if (!editForm.reasons.some((r) => r.id === reason.reasonID)) {
      setEditForm((prev) => ({
        ...prev,
        reasons: [...prev.reasons, { id: reason.reasonID }],
        reasonSearch: "",
      }));
    }
  };

  const handleChecklistSelect = (checklist: Checklist) => {
    if (!editForm.checklists.some((c) => c.id === checklist.checklistID)) {
      setEditForm((prev) => ({
        ...prev,
        checklists: [
          ...prev.checklists,
          { id: checklist.checklistID, checked: false },
        ],
        checklistSearch: "",
      }));
    }
  };

  const handleRemoveReason = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      reasons: prev.reasons.filter((_, i) => i !== index),
    }));
  };

  const handleRemoveChecklist = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      checklists: prev.checklists.filter((_, i) => i !== index),
    }));
  };

  const handleImageClick = (photo: string) =>
    setSelectedImage(`${BASE_URL}${photo}`);
  const handleCloseFullscreen = () => setSelectedImage(null);

  const canEditField = (field: string) => {
    if (!visit) return false;
    switch (visit.status) {
      case "visited":
        return ["comment", "checklists", "photos"].includes(field);
      case "pending":
      case "validated":
      case "rejected":
        return [
          "dateTime",
          "location",
          "agentID",
          "checklists",
          "reasons",
          "supervisor",
        ].includes(field);
      default:
        return false;
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>{t("visitDetails.loading")}</p>
      </div>
    );
  }
  if (error || !visit) {
    return (
      <div className="visit-details-container">
        <div className="visit-details-error-card">
          <h2>{t("visitDetails.error.title")}</h2>
          <p>{error || t("visitDetails.error.notFound")}</p>
          <button
            className="visit-details-back-btn"
            onClick={() => navigate("/timesheet")}
            aria-label={t("visitDetails.aria.backButton")}
          >
            <FaArrowLeft /> {t("visitDetails.actions.back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="visit-details-container">
      <header className="visit-details-header">
        <h1>
          <FaListUl /> {t("visitDetails.title")} -{" "}
          {t(`visitDetails.status.${visit.status.toLowerCase()}`)}
          <span
            className={`status-dot status-${visit.status.toLowerCase()}`}
          ></span>
          {visit.duration !== null && (
            <div className="duration-clock">
              <svg className="clock-circle" viewBox="0 0 36 36">
                <circle className="clock-base" cx="18" cy="18" r="16" />
                <circle
                  className="clock-progress"
                  cx="18"
                  cy="18"
                  r="16"
                  strokeDasharray={`${Math.min(
                    (visit.duration! / 60) * 100,
                    100
                  )} 100`}
                />
              </svg>
              <span className="duration-text">
                {visit.duration}
                {t("visitDetails.durationUnit")}
              </span>
            </div>
          )}
        </h1>
      </header>

      <section className="visit-details-section">
        {!isEditing ? (
          <>
            <div className="visit-details-actions-top">
              {userPermissions.canEditTimesheets && (
                <button
                  className="visit-details-edit-btn"
                  onClick={handleEditToggle}
                  aria-label={t("visitDetails.aria.editButton")}
                >
                  <FaEdit /> {t("visitDetails.actions.edit")}
                </button>
              )}
              {userPermissions.canDeleteTimesheets && (
                <button
                  className="visit-details-delete-btn"
                  onClick={handleDelete}
                  aria-label={t("visitDetails.aria.deleteButton")}
                >
                  <FaTrash /> {t("visitDetails.actions.delete")}
                </button>
              )}
            </div>
            <div className="visit-details-grid">
              <div className="visit-details-card">
                <h2>
                  <FaCalendar /> {t("visitDetails.whenWhere.title")}
                </h2>
                <div className="card-content">
                  <p>
                    <FaCalendar />{" "}
                    {new Date(visit.date).toLocaleDateString("en-GB")}
                  </p>
                  <p>
                    <FaClock /> {visit.time.split(":").slice(0, 2).join(":")}
                  </p>
                  <p>
                    <FaMapMarkerAlt />{" "}
                    {visit.location || t("visitDetails.whenWhere.na")}
                  </p>
                </div>
              </div>

              <div className="visit-details-card">
                <h2>
                  <FaUser /> {t("visitDetails.agent.title")}
                </h2>
                <div className="card-content">
                  {agent ? (
                    <>
                      <p>
                        <FaUser /> {agent.name} {agent.lastname}
                      </p>
                      <p>
                        <FaPhone /> {agent.phone || t("visitDetails.agent.na")}
                      </p>
                    </>
                  ) : (
                    <p className="no-data">{t("visitDetails.agent.noData")}</p>
                  )}
                </div>
              </div>

              <div className="visit-details-card">
                <h2>
                  <FaListUl /> {t("visitDetails.reasons.title")}
                </h2>
                <div className="card-content">
                  {visit.Reasons?.length ? (
                    <ul>
                      {visit.Reasons.map((reason, index) => (
                        <li key={index}>{reason.item || reason.reasonID}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-data">
                      {t("visitDetails.reasons.noData")}
                    </p>
                  )}
                </div>
              </div>

              <div className="visit-details-card">
                <h2>
                  <FaCheckCircle /> {t("visitDetails.checklist.title")}
                </h2>
                <div className="card-content">
                  {visit.Checklists?.length ? (
                    <ul className="checklist">
                      {visit.Checklists.map((checklist, index) => (
                        <li key={index}>
                          {checklist.VisitChecklist?.checked ? (
                            <FaCheckCircle className="check-icon checked" />
                          ) : (
                            <FaCircle className="check-icon" />
                          )}
                          {checklist.item || checklist.checklistID}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-data">
                      {t("visitDetails.checklist.noData")}
                    </p>
                  )}
                </div>
              </div>

              {visit.photos?.length ? (
                <div className="visit-details-card photos-section">
                  <h2>
                    <FaCamera /> {t("visitDetails.photos.title")}{" "}
                    {t("visitDetails.photos.count", {
                      count: visit.photos.length,
                    })}
                  </h2>
                  <div className="card-content photo-gallery">
                    {visit.photos.map((photo, index) => (
                      <div key={index} className="photo-container">
                        <img
                          src={`${BASE_URL}${photo}`}
                          alt={t("visitDetails.photos.alt", {
                            index: index + 1,
                          })}
                          className="photo-preview"
                          onClick={() => handleImageClick(photo)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {visit.comment && (
                <div className="visit-details-card">
                  <h2>
                    <FaComment /> {t("visitDetails.comment.title")}
                  </h2>
                  <div className="card-content">
                    <p>{visit.comment}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="visit-details-actions">
              <button
                className="visit-details-back-btn"
                onClick={() => navigate("/timesheet")}
                aria-label={t("visitDetails.aria.backButton")}
              >
                <FaArrowLeft /> {t("visitDetails.actions.back")}
              </button>
              {userPermissions.canLogVisits && (
                <button
                  className="visit-details-log-btn"
                  onClick={handleLogVisit}
                  disabled={[
                    VisitStatus.PENDING,
                    VisitStatus.VISITED,
                    VisitStatus.REJECTED,
                  ].includes(visit.status as VisitStatus)}
                  aria-label={t("visitDetails.aria.logVisitButton")}
                >
                  {t("visitDetails.actions.logVisit")}
                </button>
              )}
              {userPermissions.canValidateTimesheets && (
                <div className="visit-details-log-btn2">
                  <button
                    className="validate-visit-btn"
                    onClick={handleValidate}
                    disabled={[
                      VisitStatus.VALIDATED,
                      VisitStatus.VISITED,
                    ].includes(visit.status as VisitStatus)}
                    aria-label={t("visitDetails.aria.validateButton")}
                  >
                    {t("visitDetails.actions.validate")}
                  </button>
                  <button
                    className="reject-visit-btn"
                    onClick={handleReject}
                    disabled={[
                      VisitStatus.REJECTED,
                      VisitStatus.VISITED,
                      VisitStatus.VALIDATED,
                    ].includes(visit.status as VisitStatus)}
                    aria-label={t("visitDetails.aria.rejectButton")}
                  >
                    {t("visitDetails.actions.reject")}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleEditSubmit} className="visit-edit-form">
            {canEditField("supervisor") &&
              userPermissions.canReadSupervisors && (
                <div className="form-group">
                  <label htmlFor="supervisor">
                    {t("visitDetails.form.supervisor.label")}
                  </label>
                  <input
                    type="text"
                    placeholder={t(
                      "visitDetails.form.supervisor.searchPlaceholder"
                    )}
                    value={supervisorSearch}
                    onChange={(e) => setSupervisorSearch(e.target.value)}
                    className="search-input"
                    aria-label={t(
                      "visitDetails.form.supervisor.searchPlaceholder"
                    )}
                  />
                  <input
                    type="tel"
                    placeholder={t(
                      "visitDetails.form.supervisor.phonePlaceholder"
                    )}
                    value={supervisorPhone}
                    onChange={(e) => setSupervisorPhone(e.target.value)}
                    className="search-input"
                    aria-label={t(
                      "visitDetails.form.supervisor.phonePlaceholder"
                    )}
                  />
                  <select
                    id="supervisor"
                    value={selectedSupervisor}
                    onChange={(e) => setSelectedSupervisor(e.target.value)}
                    required
                    aria-label={t("visitDetails.form.supervisor.ariaLabel")}
                  >
                    <option value="">
                      {t("visitDetails.form.supervisor.selectPlaceholder")}
                    </option>
                    {supervisors
                      .filter((s) =>
                        `${s.firstname || ""} ${s.lastname || ""} ${
                          s.phone || ""
                        }`
                          .toLowerCase()
                          .includes(supervisorSearch.toLowerCase())
                      )
                      .map((s) => (
                        <option key={s.userID} value={s.userID}>
                          {s.firstname} {s.lastname} ({s.phone})
                        </option>
                      ))}
                  </select>
                </div>
              )}

            {canEditField("dateTime") && (
              <div className="form-group datetime-group">
                <label>{t("visitDetails.form.date.label")}</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) =>
                    !isWeekend(e.target.value) &&
                    setEditForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                  min={getCurrentDateTime().date}
                  className="search-input"
                  required
                  aria-label={t("visitDetails.form.date.ariaLabel")}
                />
                <label>{t("visitDetails.form.time.label")}</label>
                <input
                  type="time"
                  value={editForm.time}
                  onChange={(e) =>
                    isValidTime(editForm.date, e.target.value) &&
                    setEditForm((prev) => ({ ...prev, time: e.target.value }))
                  }
                  min={
                    editForm.date === getCurrentDateTime().date
                      ? getCurrentDateTime().time
                      : "08:00"
                  }
                  max="17:00"
                  step="60"
                  className="search-input"
                  required
                  aria-label={t("visitDetails.form.time.ariaLabel")}
                />
              </div>
            )}

            {canEditField("agentID") && (
              <>
                <div className="form-group">
                  <label htmlFor="agentPhone">
                    {t("visitDetails.form.agentPhone.label")}
                  </label>
                  <input
                    type="tel"
                    id="agentPhone"
                    placeholder={
                      userPermissions.canReadAgentsByPhone
                        ? t("visitDetails.form.agentPhone.placeholder")
                        : t("visitDetails.form.permissionDenied")
                    }
                    value={editForm.agentPhone}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        agentPhone: e.target.value,
                      }))
                    }
                    className="search-input"
                    disabled={!userPermissions.canReadAgentsByPhone}
                    aria-label={t("visitDetails.form.agentPhone.ariaLabel")}
                  />
                </div>
                {canEditField("location") && (
                  <div className="form-group">
                    <label htmlFor="location">
                      {t("visitDetails.form.location.label")}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        userPermissions.canReadAgentsByLocation
                          ? t("visitDetails.form.location.searchPlaceholder")
                          : t("visitDetails.form.permissionDenied")
                      }
                      value={editForm.locationSearch}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          locationSearch: e.target.value,
                        }))
                      }
                      className="search-input"
                      disabled={
                        !userPermissions.canReadAgentsByLocation ||
                        editForm.agentPhone.length > 0
                      }
                      aria-label={t(
                        "visitDetails.form.location.searchPlaceholder"
                      )}
                    />
                    <select
                      id="location"
                      value={editForm.location}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          location: e.target.value,
                        }))
                      }
                      required
                      disabled={
                        !userPermissions.canReadAgentsByLocation ||
                        editForm.agentPhone.length > 0
                      }
                      aria-label={t("visitDetails.form.location.ariaLabel")}
                    >
                      <option value="">
                        {t("visitDetails.form.location.selectPlaceholder")}
                      </option>
                      {locations
                        .filter((loc) =>
                          loc
                            .toLowerCase()
                            .includes(editForm.locationSearch.toLowerCase())
                        )
                        .map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="agent">
                    {t("visitDetails.form.agent.label")}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      userPermissions.canReadAgentsByLocation
                        ? t("visitDetails.form.agent.searchPlaceholder")
                        : t("visitDetails.form.permissionDenied")
                    }
                    value={editForm.agentSearch}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        agentSearch: e.target.value,
                      }))
                    }
                    className="search-input"
                    disabled={
                      !userPermissions.canReadAgentsByLocation ||
                      editForm.agentPhone.length > 0 ||
                      !editForm.location
                    }
                    aria-label={t("visitDetails.form.agent.searchPlaceholder")}
                  />
                  <select
                    id="agent"
                    value={editForm.agentID}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        agentID: e.target.value,
                      }))
                    }
                    required
                    disabled={
                      !userPermissions.canReadAgentsByLocation ||
                      editForm.agentPhone.length > 0 ||
                      !editForm.location
                    }
                    aria-label={t("visitDetails.form.agent.ariaLabel")}
                  >
                    <option value="">
                      {t("visitDetails.form.agent.selectPlaceholder")}
                    </option>
                    {agents
                      .filter((a) =>
                        `${a.name || ""} ${a.lastname || ""} ${a.phone || ""}`
                          .toLowerCase()
                          .includes(editForm.agentSearch.toLowerCase())
                      )
                      .map((a) => (
                        <option key={a.agentID} value={a.agentID}>
                          {a.name} {a.lastname} ({a.phone})
                        </option>
                      ))}
                  </select>
                </div>
              </>
            )}

            {canEditField("reasons") && (
              <div className="form-group">
                <label>{t("visitDetails.form.reasons.label")}</label>
                <input
                  type="text"
                  placeholder={
                    userPermissions.canReadReasons
                      ? t("visitDetails.form.reasons.searchPlaceholder")
                      : t("visitDetails.form.permissionDenied")
                  }
                  value={editForm.reasonSearch}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      reasonSearch: e.target.value,
                    }))
                  }
                  className="search-input"
                  disabled={!userPermissions.canReadReasons}
                  aria-label={t("visitDetails.form.reasons.searchPlaceholder")}
                />
                <select
                  value=""
                  onChange={(e) => {
                    const reason = reasons.find(
                      (r) => r.reasonID === e.target.value
                    );
                    if (reason) handleReasonSelect(reason);
                  }}
                  disabled={!userPermissions.canReadReasons}
                  aria-label={t("visitDetails.form.reasons.ariaLabel")}
                >
                  <option value="">
                    {t("visitDetails.form.reasons.selectPlaceholder")}
                  </option>
                  {reasons
                    .filter((r) =>
                      r.item
                        .toLowerCase()
                        .includes(editForm.reasonSearch.toLowerCase())
                    )
                    .map((r) => (
                      <option key={r.reasonID} value={r.reasonID}>
                        {r.item}
                      </option>
                    ))}
                </select>
                <div className="selected-items">
                  {editForm.reasons.map((r, index) => (
                    <span
                      key={index}
                      className="selected-item"
                      onClick={() => handleRemoveReason(index)}
                      aria-label={t("visitDetails.aria.removeReason", {
                        item:
                          reasons.find((re) => re.reasonID === r.id)?.item ||
                          r.id,
                      })}
                    >
                      {reasons.find((re) => re.reasonID === r.id)?.item || r.id}{" "}
                      ×
                    </span>
                  ))}
                </div>
              </div>
            )}

            {canEditField("checklists") && (
              <div className="form-group">
                <label>{t("visitDetails.form.checklists.label")}</label>
                <input
                  type="text"
                  placeholder={
                    userPermissions.canReadChecklists
                      ? t("visitDetails.form.checklists.searchPlaceholder")
                      : t("visitDetails.form.permissionDenied")
                  }
                  value={editForm.checklistSearch}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      checklistSearch: e.target.value,
                    }))
                  }
                  className="search-input"
                  disabled={!userPermissions.canReadChecklists}
                  aria-label={t(
                    "visitDetails.form.checklists.searchPlaceholder"
                  )}
                />
                <select
                  value=""
                  onChange={(e) => {
                    const checklist = checklists.find(
                      (c) => c.checklistID === e.target.value
                    );
                    if (checklist) handleChecklistSelect(checklist);
                  }}
                  disabled={!userPermissions.canReadChecklists}
                  aria-label={t("visitDetails.form.checklists.ariaLabel")}
                >
                  <option value="">
                    {t("visitDetails.form.checklists.selectPlaceholder")}
                  </option>
                  {checklists
                    .filter((c) =>
                      c.item
                        .toLowerCase()
                        .includes(editForm.checklistSearch.toLowerCase())
                    )
                    .map((c) => (
                      <option key={c.checklistID} value={c.checklistID}>
                        {c.item}
                      </option>
                    ))}
                </select>
                <div className="selected-items">
                  {editForm.checklists.map((c, index) => (
                    <div key={index} className="checklist-item">
                      <input
                        type="checkbox"
                        checked={c.checked}
                        onChange={(e) =>
                          handleChecklistChange(c.id, e.target.checked)
                        }
                        disabled={visit.status !== "visited"}
                        aria-label={t("visitDetails.aria.checklistItem", {
                          item:
                            checklists.find((cl) => cl.checklistID === c.id)
                              ?.item || c.id,
                        })}
                      />
                      <span>
                        {checklists.find((cl) => cl.checklistID === c.id)
                          ?.item || c.id}
                      </span>
                      <span
                        className="remove-item"
                        onClick={() => handleRemoveChecklist(index)}
                        aria-label={t("visitDetails.aria.removeChecklist", {
                          item:
                            checklists.find((cl) => cl.checklistID === c.id)
                              ?.item || c.id,
                        })}
                      >
                        ×
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canEditField("photos") &&
            (visit.photos?.length || newPhotos.length) ? (
              <div className="form-group photos-section">
                <h2>
                  <FaCamera /> {t("visitDetails.form.photos.title")}{" "}
                  {t("visitDetails.form.photos.count", {
                    count:
                      (visit.photos?.filter(
                        (p) => !editForm.photosToRemove.includes(p)
                      ).length || 0) + newPhotos.length,
                  })}
                </h2>
                {visit.status === VisitStatus.VISITED && (
                  <div className="camera-controls">
                    <button
                      type="button"
                      className="camera-btn"
                      onClick={startCamera}
                      disabled={isCameraActive}
                      aria-label={t("visitDetails.aria.startCamera")}
                    >
                      <FaCamera /> {t("visitDetails.form.photos.startCamera")}
                    </button>
                    <div
                      className={`camera-container ${
                        isCameraActive ? "active" : ""
                      }`}
                    >
                      <div className="camera-frame">
                        <video
                          ref={videoRef}
                          className="camera-preview"
                          muted
                          playsInline
                        />
                        <div
                          className={`flash-overlay ${
                            flashEffect ? "active" : ""
                          }`}
                        ></div>
                        <div className="photo-counter">
                          <FaCamera /> {newPhotos.length}
                        </div>
                        {newPhotos.length > 0 && (
                          <div className="thumbnail-preview">
                            <img
                              src={URL.createObjectURL(
                                newPhotos[newPhotos.length - 1]
                              )}
                              alt={t(
                                "visitDetails.form.photos.lastCapturedAlt"
                              )}
                            />
                          </div>
                        )}
                      </div>
                      {isCameraActive && (
                        <>
                          <button
                            type="button"
                            className="stop-camera-btn"
                            onClick={stopCamera}
                            aria-label={t("visitDetails.aria.stopCamera")}
                          >
                            <FaTimes /> {t("visitDetails.actions.stopCamera")}
                          </button>
                          <button
                            type="button"
                            className="capture-btn"
                            onClick={capturePhoto}
                            aria-label={t("visitDetails.aria.capturePhoto")}
                          >
                            <FaCamera />{" "}
                            {t("visitDetails.actions.capturePhoto")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {(visit.photos?.length || newPhotos.length) && (
                  <div className="photo-previews">
                    {visit
                      .photos!.filter(
                        (p) => !editForm.photosToRemove.includes(p)
                      )
                      .map((photo, index) => (
                        <div
                          key={`existing-${index}`}
                          className="photo-container"
                        >
                          <img
                            src={`${BASE_URL}${photo}`}
                            alt={t("visitDetails.form.photos.existingAlt", {
                              index: index + 1,
                            })}
                            className="photo-preview"
                            onClick={() => handleImageClick(photo)}
                          />
                          <button
                            type="button"
                            className="remove-photo-btn"
                            onClick={() => handleRemovePhoto(photo)}
                            aria-label={t("visitDetails.aria.removePhoto", {
                              index: index + 1,
                            })}
                          >
                            <FaTimes /> {t("visitDetails.actions.removePhoto")}
                          </button>
                        </div>
                      ))}
                    {newPhotos.map((photo, index) => (
                      <div key={`new-${index}`} className="photo-container">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={t("visitDetails.form.photos.newAlt", {
                            index: index + 1,
                          })}
                          className="photo-preview"
                          onClick={() =>
                            setSelectedImage(URL.createObjectURL(photo))
                          }
                        />
                        <button
                          type="button"
                          className="remove-photo-btn"
                          onClick={() => removeNewPhoto(index)}
                          aria-label={t("visitDetails.aria.removePhoto", {
                            index: index + 1,
                          })}
                        ></button>
                        <FaTimes /> {t("visitDetails.actions.removePhoto")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {canEditField("comment") && (
              <div className="form-group">
                <label>{t("visitDetails.form.comment.label")}</label>
                <textarea
                  value={editForm.comment}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      comment: e.target.value,
                    }))
                  }
                  placeholder={t("visitDetails.form.comment.placeholder")}
                  aria-label={t("visitDetails.form.comment.ariaLabel")}
                />
              </div>
            )}

            <div className="form-actions">
              <Button
                type="submit"
                className="visit-details-submit-btn"
                aria-label={t("visitDetails.form.actions.save")}
              >
                {t("visitDetails.form.actions.save")}
              </Button>
              <Button
                type="button"
                className="visit-details-cancel-btn"
                onClick={handleEditToggle}
                aria-label={t("visitDetails.form.actions.cancel")}
              >
                {t("visitDetails.form.actions.cancel")}
              </Button>
            </div>
          </form>
        )}

        {selectedImage && (
          <div
            className="fullscreen-image-overlay"
            onClick={handleCloseFullscreen}
          >
            <img
              src={selectedImage}
              alt={t("visitDetails.fullscreenAlt")}
              className="fullscreen-image"
            />
            <button
              className="fullscreen-close-btn"
              onClick={handleCloseFullscreen}
              aria-label={t("visitDetails.aria.closeFullscreen")}
            >
              <FaTimes /> {t("visitDetails.actions.closeFullscreen")}
            </button>
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </section>
    </div>
  );
};

export default VisitDetails;
