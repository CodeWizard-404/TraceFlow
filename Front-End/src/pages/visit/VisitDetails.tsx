import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { debounce } from "lodash";
import {
  FaCalendar, FaClock, FaMapMarkerAlt, FaUser,
  FaPhone, FaListUl, FaCheckCircle, FaArrowLeft,
  FaCircle, FaEdit, FaTrash, FaCamera, FaComment,
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
  getAgentById, getAgentsByLocation, getAgentLocations, getAgentByPhone,
} from "../../apis/agentAPI";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { validateTimesheet } from "../../apis/timesheetAPI";
import { getSupervisorsByUser, getUserByPhone } from "../../apis/userAPI";
import { getVisitById, updateVisit, deleteVisit } from "../../apis/visitAPI";

// Constants for environment variables and permissions
const BASE_URL = import.meta.env.VITE_BASE_URL;
const PERMISSIONS = {
  ACCESS_VISIT_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS,
  LOG_VISITS: import.meta.env.VITE_PERMISSIONS_LOG_VISITS,
  VALIDATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_VALIDATE_TIMESHEETS,
  EDIT_TIMESHEETS_FOR_SUPERVISOR: import.meta.env.VITE_PERMISSIONS_EDIT_TIMESHEETS_FOR_SUPERVISOR,
  DELETE_TIMESHEETS_FOR_SUPERVISOR: import.meta.env.VITE_PERMISSIONS_DELETE_TIMESHEETS_FOR_SUPERVISOR,
  READ_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
  READ_AGENTS_BY_LOCATION: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_LOCATION,
  READ_AGENTS_BY_PHONE: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_PHONE,
  READ_REASON_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS,
  READ_CHECKLISTS_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS,
  CREATE_TIMESHEETS_FOR_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR,
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
  const { idVisit } = useParams<{ idVisit: string }>();
  const navigate = useNavigate();
  const { token, user, effectivePermissions, permissionsLoaded } = useAuth();

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
      reasons: []
    }
  });

  const userPermissions = useMemo(() => ({
    canAccessVisitDetails: effectivePermissions?.some(p => p.name === PERMISSIONS.ACCESS_VISIT_DETAILS),
    canLogVisits: effectivePermissions?.some(p => p.name === PERMISSIONS.LOG_VISITS),
    canValidateTimesheets: effectivePermissions?.some(p => p.name === PERMISSIONS.VALIDATE_TIMESHEETS),
    canEditTimesheets: effectivePermissions?.some(p => p.name === PERMISSIONS.EDIT_TIMESHEETS_FOR_SUPERVISOR),
    canDeleteTimesheets: effectivePermissions?.some(p => p.name === PERMISSIONS.DELETE_TIMESHEETS_FOR_SUPERVISOR),
    canReadSupervisors: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_SUPERVISORS),
    canReadAgentsByLocation: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_AGENTS_BY_LOCATION),
    canReadAgentsByPhone: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_AGENTS_BY_PHONE),
    canReadReasons: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_REASON_ITEMS),
    canReadChecklists: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_CHECKLISTS_ITEMS),
    canCreateTimesheetsForSupervisors: effectivePermissions?.some(p => p.name === PERMISSIONS.CREATE_TIMESHEETS_FOR_SUPERVISORS),
  }), [effectivePermissions]);

  const getCurrentDateTime = () => {
    const now = new Date();
    return {
      date: now.toISOString().split('T')[0],
      time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
    };
  };

  const isWeekend = (date: string) => new Date(date).getDay() % 6 === 0;

  const isValidTime = (date: string, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    if (hours < 8 || hours > 17 || (hours === 17 && minutes > 0)) return false;
    const { date: currentDate, time: currentTime } = getCurrentDateTime();
    if (date === currentDate) {
      const [currentH, currentM] = currentTime.split(':').map(Number);
      return !(hours < currentH || (hours === currentH && minutes < currentM));
    }
    return true;
  };

  const fetchVisitData = useCallback(async () => {
    if (!idVisit || !token || !userPermissions.canAccessVisitDetails) {
      navigate("/access-denied");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const visitData = await getVisitById(idVisit, token);
      setVisit(visitData);

      const agentData = visitData.agentID ? await getAgentById(visitData.agentID, token) : null;
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
        checklists: visitData.Checklists?.map(c => ({
          id: c.checklistID,
          checked: c.VisitChecklist?.checked || false,
        })) || [],
        reasons: visitData.Reasons?.map(r => ({ id: r.reasonID })) || [],
        photosToRemove: [],
        original: {
          date: visitData.date,
          time: visitData.time.slice(0, 5),
          location: visitData.location || "",
          status: visitData.status,
          comment: visitData.comment || "",
          agentID: visitData.agentID,
          checklists: visitData.Checklists?.map(c => ({
            id: c.checklistID,
            checked: c.VisitChecklist?.checked || false,
          })) || [],
          reasons: visitData.Reasons?.map(r => ({ id: r.reasonID })) || [],
        }
      });
      setSelectedSupervisor("");

      const [locationsData, reasonsData, checklistsData, supervisorsData] = await Promise.all([
        userPermissions.canReadAgentsByLocation ? getAgentLocations(token) : Promise.resolve([]),
        userPermissions.canReadReasons ? getAllReasons(token) : Promise.resolve([]),
        userPermissions.canReadChecklists ? getAllChecklists(token) : Promise.resolve([]),
        userPermissions.canReadSupervisors && user ? getSupervisorsByUser(user.userID, token) : Promise.resolve([]),
      ]);

      setLocations(locationsData as string[]);
      setReasons(reasonsData as Reason[]);
      setChecklists(checklistsData as Checklist[]);
      setSupervisors(supervisorsData as User[]);
    } catch (err) {
      setError("Failed to load visit details.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [idVisit, token, userPermissions, permissionsLoaded, navigate, user]);

  useEffect(() => {
    if (permissionsLoaded) fetchVisitData();
  }, [fetchVisitData, permissionsLoaded]);

  // Debounced API calls
  const fetchAgentByPhone = useCallback(
    debounce(async (phone: string) => {
      if (phone.length < 7 || !userPermissions.canReadAgentsByPhone || !token) return;
      try {
        const agentData = await getAgentByPhone(phone, token);
        setEditForm(prev => ({
          ...prev,
          agentID: agentData.agentID,
          agentSearch: `${agentData.name || ""} ${agentData.lastname || ""}`,
          location: agentData.location || "",
        }));
        setAgents([agentData]);
      } catch {
        setError("Agent not found with this phone number");
        setEditForm(prev => ({ ...prev, agentID: "", agentSearch: "" }));
        setAgents([]);
      }
    }, 500),
    [token, userPermissions.canReadAgentsByPhone]
  );

  const fetchSupervisorByPhone = useCallback(
    debounce(async (phone: string) => {
      if (phone.length < 7 || !userPermissions.canReadSupervisors || !token) return;
      try {
        const supervisor = await getUserByPhone(phone, token);
        setSelectedSupervisor(supervisor.userID);
        setSupervisors(prev => prev.some(s => s.userID === supervisor.userID) ? prev : [...prev, supervisor]);
        setSupervisorSearch(`${supervisor.firstname || ""} ${supervisor.lastname || ""}`);
      } catch {
        setError("Supervisor not found with this phone number");
        setSelectedSupervisor("");
        setSupervisorSearch("");
      }
    }, 500),
    [token, userPermissions.canReadSupervisors]
  );

  useEffect(() => {
    if (editForm.agentPhone) fetchAgentByPhone(editForm.agentPhone);
    if (supervisorPhone) fetchSupervisorByPhone(supervisorPhone);
    return () => {
      fetchAgentByPhone.cancel();
      fetchSupervisorByPhone.cancel();
    };
  }, [editForm.agentPhone, supervisorPhone, fetchAgentByPhone, fetchSupervisorByPhone]);

  useEffect(() => {
    if (editForm.location && !editForm.agentPhone && userPermissions.canReadAgentsByLocation && token) {
      const fetchAgents = async () => {
        try {
          const agentsData = await getAgentsByLocation(editForm.location, token);
          setAgents(agentsData);
          if (!editForm.agentPhone) {
            setEditForm(prev => ({ ...prev, agentID: "", agentSearch: "" }));
          }
        } catch {
          setError(`Failed to load agents for ${editForm.location}`);
        }
      };
      fetchAgents();
    }
  }, [editForm.location, editForm.agentPhone, userPermissions.canReadAgentsByLocation, token]);

  const handleLogVisit = () => {
    if (visit && userPermissions.canLogVisits) {
      navigate("/qr-scan", { state: { visit } });
    }
  };

  const handleValidate = async () => {
    if (!visit || !visit.timesheetID || !userPermissions.canValidateTimesheets || !token) return;
    try {
      await validateTimesheet(visit.timesheetID, { visitIDs: [visit.visitID], status: "validated" }, token);
      setVisit(prev => prev ? { ...prev, status: VisitStatus.VALIDATED } : null);
    } catch {
      setError("Failed to validate visit.");
    }
  };

  const handleReject = async () => {
    if (!visit || !visit.timesheetID || !userPermissions.canValidateTimesheets || !token) return;
    try {
      await validateTimesheet(visit.timesheetID, { visitIDs: [visit.visitID], status: "rejected" }, token);
      setVisit(prev => prev ? { ...prev, status: VisitStatus.REJECTED } : null);
    } catch {
      setError("Failed to reject visit.");
    }
  };

  const handleEditToggle = () => {
    if (!isEditing && visit?.status === VisitStatus.VISITED) {
      setEditTracking({
        startTime: Date.now(),
        durationAccumulator: visit.duration || 0
      });
    }
    setIsEditing(prev => {
      if (prev) {
        setEditForm(prevForm => ({
          ...prevForm,
          date: prevForm.original.date,
          time: prevForm.original.time,
          location: prevForm.original.location,
          status: prevForm.original.status,
          comment: prevForm.original.comment,
          agentID: prevForm.original.agentID,
          checklists: [...prevForm.original.checklists],
          reasons: [...prevForm.original.reasons],
          photosToRemove: []
        }));
        setEditTracking({ startTime: null, durationAccumulator: 0 });
      }
      return !prev;
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit || !userPermissions.canEditTimesheets || !token || !editForm.date || !editForm.time) return;

    let newStatus = editForm.status;
    let updatedDuration = visit.duration || 0;

    if (visit.status === VisitStatus.VISITED) {
      newStatus = VisitStatus.VISITED;
      if (editTracking.startTime) {
        const editDurationMinutes = Math.round((Date.now() - editTracking.startTime) / 60000);
        updatedDuration = editTracking.durationAccumulator + editDurationMinutes;
      }
    } else if (userPermissions.canCreateTimesheetsForSupervisors && selectedSupervisor) {
      newStatus = VisitStatus.VALIDATED;
    } else if ([VisitStatus.VALIDATED, VisitStatus.REJECTED].includes(visit.status as VisitStatus)) {
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
        supervisorID: selectedSupervisor && userPermissions.canCreateTimesheetsForSupervisors ? selectedSupervisor : undefined,
        duration: updatedDuration
      }, token);

      setVisit(updatedVisit);
      setIsEditing(false);
    } catch (err) {
      setError("Failed to update visit.");
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!visit || !userPermissions.canDeleteTimesheets || !token || !window.confirm("Are you sure you want to delete this visit?")) return;
    try {
      await deleteVisit(visit.visitID, token);
      navigate("/timesheet");
    } catch {
      setError("Failed to delete visit.");
    }
  };

  const handleRemovePhoto = (photoUrl: string) => {
    setEditForm(prev => ({
      ...prev,
      photosToRemove: [...prev.photosToRemove, photoUrl],
    }));
  };

  const handleChecklistChange = (id: string, checked: boolean) => {
    if (visit?.status !== "visited") return;
    setEditForm(prev => ({
      ...prev,
      checklists: prev.checklists.map(c => c.id === id ? { ...c, checked } : c),
    }));
  };

  const handleReasonSelect = (reason: Reason) => {
    if (!editForm.reasons.some(r => r.id === reason.reasonID)) {
      setEditForm(prev => ({
        ...prev,
        reasons: [...prev.reasons, { id: reason.reasonID }],
        reasonSearch: "",
      }));
    }
  };

  const handleChecklistSelect = (checklist: Checklist) => {
    if (!editForm.checklists.some(c => c.id === checklist.checklistID)) {
      setEditForm(prev => ({
        ...prev,
        checklists: [...prev.checklists, { id: checklist.checklistID, checked: false }],
        checklistSearch: "",
      }));
    }
  };

  const handleRemoveReason = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      reasons: prev.reasons.filter((_, i) => i !== index),
    }));
  };

  const handleRemoveChecklist = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      checklists: prev.checklists.filter((_, i) => i !== index),
    }));
  };

  const handleImageClick = (photo: string) => setSelectedImage(`${BASE_URL}${photo}`);
  const handleCloseFullscreen = () => setSelectedImage(null);

  const canEditField = (field: string) => {
    if (!visit) return false;
    switch (visit.status) {
      case "visited":
        return ["comment", "checklists", "photos"].includes(field);
      case "pending":
      case "validated":
      case "rejected":
        return ["dateTime", "location", "agentID", "checklists", "reasons", "supervisor"].includes(field);
      default:
        return false;
    }
  };

  if (!permissionsLoaded) {
    return <div className="visit-details-loading">Loading permissions...</div>;
  }

  if (loading) {
    return (
      <div className="visit-details-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="visit-details-container">
        <div className="visit-details-error-card">
          <h2>Oops!</h2>
          <p>{error || "Visit not found."}</p>
          <button className="visit-details-back-btn" onClick={() => navigate("/timesheet")}>
            <FaArrowLeft /> Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="visit-details-container">
      <header className="visit-details-header">
        <h1>
          <FaListUl /> Visit Details - {visit.status}
          <span className={`status-dot status-${visit.status.toLowerCase()}`}></span>
          {visit.duration !== null && (
            <div className="duration-clock">
              <svg className="clock-circle" viewBox="0 0 36 36">
                <circle className="clock-base" cx="18" cy="18" r="16" />
                <circle
                  className="clock-progress"
                  cx="18"
                  cy="18"
                  r="16"
                  strokeDasharray={`${Math.min(visit.duration! / 60 * 100, 100)} 100`}
                />
              </svg>
              <span className="duration-text">{visit.duration}m</span>
            </div>
          )}
        </h1>
      </header>

      <section className="visit-details-section">
        {!isEditing ? (
          <>
            <div className="visit-details-actions-top">
              {userPermissions.canEditTimesheets && (
                <button className="visit-details-edit-btn" onClick={handleEditToggle}>
                  <FaEdit /> Edit
                </button>
              )}
              {userPermissions.canDeleteTimesheets && (
                <button className="visit-details-delete-btn" onClick={handleDelete}>
                  <FaTrash /> Delete
                </button>
              )}
            </div>
            <div className="visit-details-grid">
              <div className="visit-details-card">
                <h2><FaCalendar /> When & Where</h2>
                <div className="card-content">
                  <p><FaCalendar /> {new Date(visit.date).toLocaleDateString("en-GB")}</p>
                  <p><FaClock /> {visit.time.split(":").slice(0, 2).join(":")}</p>
                  <p><FaMapMarkerAlt /> {visit.location || "N/A"}</p>
                </div>
              </div>

              <div className="visit-details-card">
                <h2><FaUser /> Agent</h2>
                <div className="card-content">
                  {agent ? (
                    <>
                      <p><FaUser /> {agent.name} {agent.lastname}</p>
                      <p><FaPhone /> {agent.phone || "N/A"}</p>
                    </>
                  ) : (
                    <p className="no-data">No agent assigned</p>
                  )}
                </div>
              </div>

              <div className="visit-details-card">
                <h2><FaListUl /> Reasons</h2>
                <div className="card-content">
                  {visit.Reasons?.length ? (
                    <ul>
                      {visit.Reasons.map((reason, index) => (
                        <li key={index}>{reason.item || reason.reasonID}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-data">No reasons listed</p>
                  )}
                </div>
              </div>

              <div className="visit-details-card">
                <h2><FaCheckCircle /> Checklist</h2>
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
                    <p className="no-data">No checklist items</p>
                  )}
                </div>
              </div>

              {visit.photos?.length ? (
                <div className="visit-details-card photos-section">
                  <h2><FaCamera /> Photos ({visit.photos.length})</h2>
                  <div className="card-content photo-gallery">
                    {visit.photos.map((photo, index) => (
                      <div key={index} className="photo-container">
                        <img
                          src={`${BASE_URL}${photo}`}
                          alt={`Visit photo ${index + 1}`}
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
                  <h2><FaComment /> Comment</h2>
                  <div className="card-content">
                    <p>{visit.comment}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="visit-details-actions">
              <button className="visit-details-back-btn" onClick={() => navigate("/timesheet")}>
                <FaArrowLeft /> Back
              </button>
              {userPermissions.canLogVisits && (
                <button
                  className="visit-details-log-btn"
                  onClick={handleLogVisit}
                  disabled={[VisitStatus.PENDING, VisitStatus.VISITED, VisitStatus.REJECTED].includes(visit.status as VisitStatus)}
                >
                  Log Visit
                </button>
              )}
              {userPermissions.canValidateTimesheets && (
                <div className="visit-details-log-btn2">
                  <button
                    className="validate-visit-btn"
                    onClick={handleValidate}
                    disabled={[VisitStatus.VALIDATED, VisitStatus.VISITED].includes(visit.status as VisitStatus)}
                  >
                    Validate
                  </button>
                  <button
                    className="reject-visit-btn"
                    onClick={handleReject}
                    disabled={[VisitStatus.REJECTED, VisitStatus.VISITED, VisitStatus.VALIDATED].includes(visit.status as VisitStatus)}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleEditSubmit} className="visit-edit-form">
            {canEditField("supervisor") && userPermissions.canReadSupervisors && (
              <div className="form-group">
                <label htmlFor="supervisor">Supervisor</label>
                <input
                  type="text"
                  placeholder="Search supervisors by name..."
                  value={supervisorSearch}
                  onChange={e => setSupervisorSearch(e.target.value)}
                  className="search-input"
                />
                <input
                  type="tel"
                  placeholder="Or enter supervisor phone number..."
                  value={supervisorPhone}
                  onChange={e => setSupervisorPhone(e.target.value)}
                  className="search-input"
                />
                <select
                  id="supervisor"
                  value={selectedSupervisor}
                  onChange={e => setSelectedSupervisor(e.target.value)}
                  required
                  aria-label="Select a supervisor"
                >
                  <option value="">Select a supervisor</option>
                  {supervisors
                    .filter(s => `${s.firstname || ""} ${s.lastname || ""} ${s.phone || ""}`
                      .toLowerCase().includes(supervisorSearch.toLowerCase()))
                    .map(s => (
                      <option key={s.userID} value={s.userID}>
                        {s.firstname} {s.lastname} ({s.phone})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {canEditField("dateTime") && (
              <div className="form-group datetime-group">
                <label>Date</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={e => !isWeekend(e.target.value) && setEditForm(prev => ({ ...prev, date: e.target.value }))}
                  min={getCurrentDateTime().date}
                  className="search-input"
                  required
                />
                <label>Time</label>
                <input
                  type="time"
                  value={editForm.time}
                  onChange={e => isValidTime(editForm.date, e.target.value) && setEditForm(prev => ({ ...prev, time: e.target.value }))}
                  min={editForm.date === getCurrentDateTime().date ? getCurrentDateTime().time : "08:00"}
                  max="17:00"
                  step="60"
                  className="search-input"
                  required
                />
              </div>
            )}

            {canEditField("agentID") && (
              <>
                <div className="form-group">
                  <label htmlFor="agentPhone">Agent Phone (Optional)</label>
                  <input
                    type="tel"
                    id="agentPhone"
                    placeholder={userPermissions.canReadAgentsByPhone ? "Enter agent's phone number" : "Permission denied"}
                    value={editForm.agentPhone}
                    onChange={e => setEditForm(prev => ({ ...prev, agentPhone: e.target.value }))}
                    className="search-input"
                    disabled={!userPermissions.canReadAgentsByPhone}
                  />
                </div>
                {canEditField("location") && (
                  <div className="form-group">
                    <label htmlFor="location">Location</label>
                    <input
                      type="text"
                      placeholder={userPermissions.canReadAgentsByLocation ? "Search locations..." : "Permission denied"}
                      value={editForm.locationSearch}
                      onChange={e => setEditForm(prev => ({ ...prev, locationSearch: e.target.value }))}
                      className="search-input"
                      disabled={!userPermissions.canReadAgentsByLocation || editForm.agentPhone.length > 0}
                    />
                    <select
                      id="location"
                      value={editForm.location}
                      onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                      required
                      disabled={!userPermissions.canReadAgentsByLocation || editForm.agentPhone.length > 0}
                    >
                      <option value="">Select a location</option>
                      {locations
                        .filter(loc => loc.toLowerCase().includes(editForm.locationSearch.toLowerCase()))
                        .map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="agent">Agent</label>
                  <input
                    type="text"
                    placeholder={userPermissions.canReadAgentsByLocation ? "Search agents..." : "Permission denied"}
                    value={editForm.agentSearch}
                    onChange={e => setEditForm(prev => ({ ...prev, agentSearch: e.target.value }))}
                    className="search-input"
                    disabled={!userPermissions.canReadAgentsByLocation || editForm.agentPhone.length > 0 || !editForm.location}
                  />
                  <select
                    id="agent"
                    value={editForm.agentID}
                    onChange={e => setEditForm(prev => ({ ...prev, agentID: e.target.value }))}
                    required
                    disabled={!userPermissions.canReadAgentsByLocation || editForm.agentPhone.length > 0 || !editForm.location}
                  >
                    <option value="">Select an agent</option>
                    {agents
                      .filter(a => `${a.name || ""} ${a.lastname || ""} ${a.phone || ""}`
                        .toLowerCase().includes(editForm.agentSearch.toLowerCase()))
                      .map(a => (
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
                <label>Reasons</label>
                <input
                  type="text"
                  placeholder={userPermissions.canReadReasons ? "Search reasons..." : "Permission denied"}
                  value={editForm.reasonSearch}
                  onChange={e => setEditForm(prev => ({ ...prev, reasonSearch: e.target.value }))}
                  className="search-input"
                  disabled={!userPermissions.canReadReasons}
                />
                <select
                  value=""
                  onChange={e => {
                    const reason = reasons.find(r => r.reasonID === e.target.value);
                    if (reason) handleReasonSelect(reason);
                  }}
                  disabled={!userPermissions.canReadReasons}
                >
                  <option value="">Select a reason</option>
                  {reasons
                    .filter(r => r.item.toLowerCase().includes(editForm.reasonSearch.toLowerCase()))
                    .map(r => (
                      <option key={r.reasonID} value={r.reasonID}>{r.item}</option>
                    ))}
                </select>
                <div className="selected-items">
                  {editForm.reasons.map((r, index) => (
                    <span
                      key={index}
                      className="selected-item"
                      onClick={() => handleRemoveReason(index)}
                    >
                      {reasons.find(re => re.reasonID === r.id)?.item || r.id} ×
                    </span>
                  ))}
                </div>
              </div>
            )}

            {canEditField("checklists") && (
              <div className="form-group">
                <label>Checklists</label>
                <input
                  type="text"
                  placeholder={userPermissions.canReadChecklists ? "Search checklists..." : "Permission denied"}
                  value={editForm.checklistSearch}
                  onChange={e => setEditForm(prev => ({ ...prev, checklistSearch: e.target.value }))}
                  className="search-input"
                  disabled={!userPermissions.canReadChecklists}
                />
                <select
                  value=""
                  onChange={e => {
                    const checklist = checklists.find(c => c.checklistID === e.target.value);
                    if (checklist) handleChecklistSelect(checklist);
                  }}
                  disabled={!userPermissions.canReadChecklists}
                >
                  <option value="">Select a checklist</option>
                  {checklists
                    .filter(c => c.item.toLowerCase().includes(editForm.checklistSearch.toLowerCase()))
                    .map(c => (
                      <option key={c.checklistID} value={c.checklistID}>{c.item}</option>
                    ))}
                </select>
                <div className="selected-items">
                  {editForm.checklists.map((c, index) => (
                    <div key={index} className="checklist-item">
                      <input
                        type="checkbox"
                        checked={c.checked}
                        onChange={e => handleChecklistChange(c.id, e.target.checked)}
                        disabled={visit.status !== "visited"}
                      />
                      <span>{checklists.find(cl => cl.checklistID === c.id)?.item || c.id}</span>
                      <span className="remove-item" onClick={() => handleRemoveChecklist(index)}>×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canEditField("photos") && (visit.photos?.length || newPhotos.length) ? (
              <div className="form-group photos-section">
                <h2><FaCamera /> Photos ({(visit.photos?.filter(p => !editForm.photosToRemove.includes(p)).length || 0) + newPhotos.length})</h2>
                {visit.status === VisitStatus.VISITED && (
                  <div className="camera-controls">
                    <button type="button" className="camera-btn" onClick={startCamera} disabled={isCameraActive}>
                      <FaCamera /> Start Camera
                    </button>
                    <div className={`camera-container ${isCameraActive ? 'active' : ''}`}>
                      <div className="camera-frame">
                        <video ref={videoRef} className="camera-preview" muted playsInline />
                        <div className={`flash-overlay ${flashEffect ? 'active' : ''}`}></div>
                        <div className="photo-counter">
                          <FaCamera /> {newPhotos.length}
                        </div>
                        {newPhotos.length > 0 && (
                          <div className="thumbnail-preview">
                            <img src={URL.createObjectURL(newPhotos[newPhotos.length - 1])} alt="Last captured" />
                          </div>
                        )}
                      </div>
                      {isCameraActive && (
                        <>
                          <button type="button" className="stop-camera-btn" onClick={stopCamera}>
                            <FaTimes />
                          </button>
                          <button type="button" className="capture-btn" onClick={capturePhoto}>
                            <FaCamera />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {(visit.photos?.length || newPhotos.length) && (
                  <div className="photo-previews">
                    {visit.photos!.filter(p => !editForm.photosToRemove.includes(p)).map((photo, index) => (
                      <div key={`existing-${index}`} className="photo-container">
                        <img
                          src={`${BASE_URL}${photo}`}
                          alt={`Photo ${index + 1}`}
                          className="photo-preview"
                          onClick={() => handleImageClick(photo)}
                        />
                        <button
                          type="button"
                          className="remove-photo-btn"
                          onClick={() => handleRemovePhoto(photo)}
                        >
                          <FaTimes />
                        </button>
                      </div>
                    ))}
                    {newPhotos.map((photo, index) => (
                      <div key={`new-${index}`} className="photo-container">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`New photo ${index + 1}`}
                          className="photo-preview"
                          onClick={() => setSelectedImage(URL.createObjectURL(photo))}
                        />
                        <button
                          type="button"
                          className="remove-photo-btn"
                          onClick={() => removeNewPhoto(index)}
                        >
                          <FaTimes />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {canEditField("comment") && (
              <div className="form-group">
                <label>Comment</label>
                <textarea
                  value={editForm.comment}
                  onChange={e => setEditForm(prev => ({ ...prev, comment: e.target.value }))}
                />
              </div>
            )}

            <div className="form-actions">
              <Button type="submit" className="visit-details-submit-btn">Save</Button>
              <Button type="button" className="visit-details-cancel-btn" onClick={handleEditToggle}>Cancel</Button>
            </div>
          </form>
        )}

        {selectedImage && (
          <div className="fullscreen-image-overlay" onClick={handleCloseFullscreen}>
            <img src={selectedImage} alt="Fullscreen preview" className="fullscreen-image" />
            <button className="fullscreen-close-btn" onClick={handleCloseFullscreen}>
              <FaTimes />
            </button>
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </section>
    </div>
  );
};

export default VisitDetails;