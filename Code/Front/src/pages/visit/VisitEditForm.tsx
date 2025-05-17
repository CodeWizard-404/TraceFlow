import React, { Dispatch, RefObject, SetStateAction, useEffect, useState } from "react";
import { FaCamera, FaTimes } from "react-icons/fa";
import VisitStatus from "../../models/Enum/VisitStatus";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";
import User from "../../models/User";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import Region from "../../models/Region";
import Governorate from "../../models/Governorate";
import Delegation from "../../models/Delegation";
import { updateVisit } from "../../apis/visitAPI";
import "./VisitDetails.css";
import "./VisitValidation.css"
import "../Timesheet/TimesheetForm.css";
const BASE_URL = import.meta.env.VITE_BASE_URL;

export interface EditTracking {
    startTime: number | null;
    durationAccumulator: number;
}

export interface EditFormState {
    date: string;
    time: string;
    regionID: string;
    governorateID: string;
    delegationID: string;
    status: string;
    comment: string;
    agentID: string;
    agentSearch: string;
    agentPhone: string;
    regionSearch: string;
    governorateSearch: string;
    delegationSearch: string;
    reasonSearch: string;
    checklistSearch: string;
    checklists: Array<{ id: string; checked: boolean }>;
    reasons: Array<{ id: string }>;
    photosToRemove: string[];
    regionalManagerSearch: string;
    supervisorSearch: string;
    duration: number | null;
    original: {
        date: string;
        time: string;
        regionID: string;
        governorateID: string;
        delegationID: string;
        status: string;
        comment: string;
        agentID: string;
        checklists: Array<{ id: string; checked: boolean }>;
        reasons: Array<{ id: string }>;
    };
}

interface UserPermissions {
    canAccessVisitDetails: boolean;
    canLogVisits: boolean;
    canEditTimesheets: boolean;
    canReadSupervisors: boolean;
    canReadAgentsByLocation: boolean;
    canReadAgentsByPhone: boolean;
    canReadReasons: boolean;
    canReadChecklists: boolean;
    canCreateTimesheetsForSupervisors: boolean;
}

interface VisitEditFormProps {
    visit: Visit;
    editForm: EditFormState;
    setEditForm: Dispatch<SetStateAction<EditFormState>>;
    userPermissions: UserPermissions;
    isSuperAdmin: boolean;
    isDirector: boolean;
    isRegionalManager: boolean;
    isSupervisor: boolean;
    regionalManagers: User[];
    selectedRegionalManager: string;
    setSelectedRegionalManager: Dispatch<SetStateAction<string>>;
    supervisors: User[];
    selectedSupervisor: string;
    setSelectedSupervisor: Dispatch<SetStateAction<string>>;
    supervisorPhone: string;
    setSupervisorPhone: Dispatch<SetStateAction<string>>;
    regions: Region[];
    governorates: Governorate[];
    delegations: Delegation[];
    agents: Agent[];
    reasons: Reason[];
    checklists: Checklist[];
    disableLocationInputs: boolean;
    setDisableLocationInputs: Dispatch<SetStateAction<boolean>>;
    disableSupervisorInput: boolean;
    setDisableSupervisorInput: Dispatch<SetStateAction<boolean>>;
    disableRegionalManagerInput: boolean;
    setDisableRegionalManagerInput: Dispatch<SetStateAction<boolean>>;
    agentLoading: boolean;
    supervisorLoading: boolean;
    fetchMode: "none" | "supervisor" | "agent";
    setFetchMode: Dispatch<SetStateAction<"none" | "supervisor" | "agent">>;
    isCameraActive: boolean;
    setIsCameraActive: Dispatch<SetStateAction<boolean>>;
    newPhotos: File[];
    setNewPhotos: Dispatch<SetStateAction<File[]>>;
    flashEffect: boolean;
    setFlashEffect: Dispatch<SetStateAction<boolean>>;
    videoRef: RefObject<HTMLVideoElement>;
    canvasRef: RefObject<HTMLCanvasElement>;
    editTracking: EditTracking;
    setEditTracking: Dispatch<SetStateAction<EditTracking>>;
    selectedImage: string | null;
    setSelectedImage: Dispatch<SetStateAction<string | null>>;
    startCamera: () => Promise<void>;
    stopCamera: () => void;
    capturePhoto: () => void;
    removeNewPhoto: (index: number) => void;
    canEditField: (field: string) => boolean;
    supervisorID: string;
    idVisit: string | undefined;
    user: User | null;
    setVisit: Dispatch<SetStateAction<Visit | null>>;
    setError: Dispatch<SetStateAction<string | null>>;
    t: (key: string, options?: any) => string;
    navigate: (path: string) => void;
}

const VisitEditForm: React.FC<VisitEditFormProps> = ({
    visit,
    editForm,
    setEditForm,
    userPermissions,
    isSuperAdmin,
    isDirector,
    isRegionalManager,
    isSupervisor,
    regionalManagers,
    selectedRegionalManager,
    setSelectedRegionalManager,
    supervisors,
    selectedSupervisor,
    setSelectedSupervisor,
    supervisorPhone,
    setSupervisorPhone,
    regions,
    governorates,
    delegations,
    agents,
    reasons,
    checklists,
    disableLocationInputs,
    setDisableLocationInputs,
    disableSupervisorInput,
    disableRegionalManagerInput,
    agentLoading,
    supervisorLoading,
    setFetchMode,
    isCameraActive,
    setNewPhotos,
    newPhotos,
    flashEffect,
    videoRef,
    editTracking,
    setEditTracking,
    selectedImage,
    setSelectedImage,
    startCamera,
    stopCamera,
    capturePhoto,
    removeNewPhoto,
    idVisit,
    setVisit,
    setError,
    t,
    navigate,
}) => {
    const currentDate = new Date().toISOString().split("T")[0];
    const currentTime = new Date().toTimeString().slice(0, 5);
    const minTime = editForm.date === currentDate ? currentTime : undefined;
    const isVisited = visit.status === VisitStatus.VISITED;
    const [isRecruitmentVisit, setIsRecruitmentVisit] = useState<boolean>(!visit.agentID);

    // Initialize edit tracking for supervisors when editing a visited visit
    useEffect(() => {
        if (isSupervisor && isVisited && !editTracking.startTime) {
            const startTime = Date.now();
            localStorage.setItem(`editStartTime_${visit.visitID}`, startTime.toString());
            setEditTracking({ startTime, durationAccumulator: visit.duration || 0 });
        }
    }, [isSupervisor, isVisited, visit.visitID, visit.duration, editTracking.startTime, setEditTracking]);

    // Reset agent fields when toggling recruitment visit
    useEffect(() => {
        if (isRecruitmentVisit) {
            setEditForm(prev => ({ ...prev, agentID: "", agentPhone: "", agentSearch: "" }));
            setFetchMode("none");
            setDisableLocationInputs(false);
        }
    }, [isRecruitmentVisit, setEditForm, setFetchMode, setDisableLocationInputs]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!visit || !userPermissions.canEditTimesheets) return;

        let newStatus = visit.status;
        let updatedDuration: number | undefined = isSuperAdmin && isVisited ? editForm.duration || undefined : visit.duration || undefined;

        if (isVisited) {
            // Case 1: Visited status (editable: comment, checklists, photos, duration)
            newStatus = VisitStatus.VISITED;
            if (isSupervisor && editTracking.startTime) {
                const editDurationMinutes = Math.round((Date.now() - editTracking.startTime) / 60000);
                updatedDuration = (visit.duration || 0) + editDurationMinutes;
                localStorage.removeItem(`editStartTime_${visit.visitID}`);
            }
        } else {
            // Case 2: Non-visited status (pending, validated, rejected)
            if (isSupervisor) {
                newStatus = VisitStatus.PENDING;
            } else if (isDirector || isRegionalManager || isSuperAdmin) {
                newStatus = VisitStatus.VALIDATED;
            }
        }

        const location = [regions.find(r => r.regionID === editForm.regionID)?.name, governorates.find(g => g.governorateID === editForm.governorateID)?.name, delegations.find(d => d.delegationID === editForm.delegationID)?.name].filter(Boolean).join(", ") || null;

        const updateData: any = {
            status: newStatus,
            duration: updatedDuration,
            checklists: editForm.checklists.map(c => ({ id: c.id, checked: c.checked })),
        };

        if (!isVisited) {
            updateData.date = editForm.date;
            updateData.time = `${editForm.time}:00`;
            updateData.location = location;
            updateData.agentID = isRecruitmentVisit ? null : editForm.agentID;
            updateData.reasons = editForm.reasons;
            if (selectedSupervisor) {
                updateData.supervisorID = selectedSupervisor;
            }
        } else {
            updateData.comment = editForm.comment;
            updateData.photos = newPhotos;
            updateData.photosToRemove = editForm.photosToRemove;
        }

        try {
            const updatedVisit = await updateVisit(visit.visitID, updateData);
            setVisit(updatedVisit);
            setNewPhotos([]);
            stopCamera();
            setEditTracking({ startTime: null, durationAccumulator: 0 });
            navigate(`/visit/${idVisit}`);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : t("visitDetails.error.updateFailed");
            setError(errorMessage);
            console.error(err);
        }
    };

    const handleCancel = () => navigate(`/visit/${idVisit}`);

    const handleReasonSelect = (reason: Reason) => {
        if (!editForm.reasons.some(r => r.id === reason.reasonID) && !isVisited) {
            setEditForm(prev => ({ ...prev, reasons: [...prev.reasons, { id: reason.reasonID }], reasonSearch: "" }));
        }
    };

    const handleChecklistSelect = (checklist: Checklist) => {
        if (!editForm.checklists.some(c => c.id === checklist.checklistID)) {
            setEditForm(prev => ({ ...prev, checklists: [...prev.checklists, { id: checklist.checklistID, checked: false }], checklistSearch: "" }));
        }
    };

    const handleRemoveReason = (index: number) => {
        if (!isVisited) {
            setEditForm(prev => ({ ...prev, reasons: prev.reasons.filter((_, i) => i !== index) }));
        }
    };

    const handleRemoveChecklist = (index: number) => {
        if (!isVisited) {
            setEditForm(prev => ({ ...prev, checklists: prev.checklists.filter((_, i) => i !== index) }));
        }
    };

    const handleChecklistChange = (id: string, checked: boolean) => {
        if (isVisited) {
            setEditForm(prev => ({
                ...prev,
                checklists: prev.checklists.map(c => c.id === id ? { ...c, checked } : c),
            }));
        }
    };

    const handleRemovePhoto = (photoUrl: string) => {
        if (isVisited) {
            setEditForm(prev => ({ ...prev, photosToRemove: [...prev.photosToRemove, photoUrl] }));
        }
    };

    const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isSuperAdmin && isVisited) {
            const value = e.target.value;
            // Allow empty input to clear the field
            if (value === "") {
                setEditForm(prev => ({ ...prev, duration: null }));
            } else {
                const numValue = parseInt(value);
                // Only update if the value is a non-negative integer
                if (!isNaN(numValue) && numValue >= 0) {
                    setEditForm(prev => ({ ...prev, duration: numValue }));
                }
            }
        }
    };

    const formPhotosCount = t("visitDetails.form.photos.count", {
        count: (visit.photos?.filter(p => !editForm.photosToRemove.includes(p)).length || 0) + newPhotos.length,
    }) || `(${(visit.photos?.filter(p => !editForm.photosToRemove.includes(p)).length || 0) + newPhotos.length} photos)`;

    const isFormComplete = isVisited
        ? editForm.checklists.length > 0
        : editForm.date && editForm.time && editForm.regionID && editForm.governorateID && editForm.delegationID && (isRecruitmentVisit || editForm.agentID) && editForm.reasons.length > 0 && editForm.checklists.length > 0 && (isSupervisor || selectedSupervisor);

    return (
        <div className="timesheet-form-container">
            <form onSubmit={handleSubmit} className="form-card" role="form">
                {(isSuperAdmin || isDirector) && !isVisited && (
                    <div className="form-group">
                        <label htmlFor="regionalManager">{t("timesheetForm.form.regionalManager")}</label>
                        <input
                            type="text"
                            value={editForm.regionalManagerSearch}
                            onChange={(e) => setEditForm(prev => ({ ...prev, regionalManagerSearch: e.target.value }))}
                            placeholder={t("timesheetForm.form.placeholders.regionalManagerSearch")}
                        />
                        <select
                            id="regionalManager"
                            value={selectedRegionalManager}
                            onChange={(e) => setSelectedRegionalManager(e.target.value)}
                            disabled={disableRegionalManagerInput}
                        >
                            <option value="">{t("timesheetForm.form.placeholders.regionalManagerSelect")}</option>
                            {regionalManagers.map(rm => (
                                <option key={rm.userID} value={rm.userID}>{`${rm.firstname} ${rm.lastname} (${rm.phone})`}</option>
                            ))}
                        </select>
                    </div>
                )}
                {(isSuperAdmin || isDirector || isRegionalManager) && !isVisited && (
                    <div className="form-group">
                        <label htmlFor="supervisor">{t("timesheetForm.form.supervisor")}</label>
                        <input
                            type="text"
                            value={editForm.supervisorSearch}
                            onChange={(e) => setEditForm(prev => ({ ...prev, supervisorSearch: e.target.value }))}
                            placeholder={t("timesheetForm.form.placeholders.supervisorSearch")}
                            disabled={supervisorLoading}
                        />
                        <input
                            type="tel"
                            value={supervisorPhone}
                            onChange={(e) => setSupervisorPhone(e.target.value)}
                            placeholder={t("timesheetForm.form.placeholders.supervisorPhone")}
                            disabled={supervisorLoading}
                        />
                        <select
                            id="supervisor"
                            value={selectedSupervisor}
                            onChange={(e) => setSelectedSupervisor(e.target.value)}
                            disabled={supervisorLoading || disableSupervisorInput}
                        >
                            <option value="">{t("timesheetForm.form.placeholders.supervisorSelect")}</option>
                            {supervisors.map(s => (
                                <option key={s.userID} value={s.userID}>{`${s.firstname} ${s.lastname} (${s.phone})`}</option>
                            ))}
                        </select>
                    </div>
                )}
                {!isVisited && <hr />}
                {!isVisited && (
                    <div className="form-group-row">
                        <div className="form-group">
                            <label htmlFor="date">{t("timesheetForm.form.date")}</label>
                            <input
                                type="date"
                                id="date"
                                value={editForm.date}
                                onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                                min={currentDate}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="time">{t("timesheetForm.form.time")}</label>
                            <input
                                type="time"
                                id="time"
                                value={editForm.time}
                                onChange={(e) => setEditForm(prev => ({ ...prev, time: e.target.value }))}
                                disabled={!editForm.date}
                                min={minTime}
                                required
                            />
                        </div>
                    </div>
                )}
                {!isVisited && <hr />}
                {!isVisited && (
                    <div className="form-group" >
                        <label className="custom-checkbox-label" htmlFor="recruitmentVisit">
                            <input
                                type="checkbox"
                                id="recruitmentVisit"
                                checked={isRecruitmentVisit}
                                onChange={(e) => setIsRecruitmentVisit(e.target.checked)}
                                className="custom-checkbox-input"
                            />
                            <span className="custom-checkbox">
                                <i className="fas fa-check check-icon"></i>
                            </span>
                            <span className="checklist-text">{t("timesheetForm.form.recruitmentVisit")}</span>
                        </label>
                    </div>
                )}
                {!isVisited && <hr />}
                {!isVisited && (
                    <div className="form-group-row">
                        <div className="form-group">
                            <label htmlFor="region">{t("timesheetForm.form.region")}</label>
                            <select
                                id="region"
                                value={editForm.regionID}
                                onChange={(e) => setEditForm(prev => ({ ...prev, regionID: e.target.value, governorateID: "", delegationID: "" }))}
                                required
                            >
                                <option value="">{t("timesheetForm.form.placeholders.regionSelect")}</option>
                                {regions.map(r => (
                                    <option key={r.regionID} value={r.regionID}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="governorate">{t("timesheetForm.form.governorate")}</label>
                            <select
                                id="governorate"
                                value={editForm.governorateID}
                                onChange={(e) => setEditForm(prev => ({ ...prev, governorateID: e.target.value, delegationID: "" }))}
                                disabled={!editForm.regionID}
                                required
                            >
                                <option value="">{t("timesheetForm.form.placeholders.governorateSelect")}</option>
                                {governorates.map(g => (
                                    <option key={g.governorateID} value={g.governorateID}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="delegation">{t("timesheetForm.form.delegation")}</label>
                            <select
                                id="delegation"
                                value={editForm.delegationID}
                                onChange={(e) => setEditForm(prev => ({ ...prev, delegationID: e.target.value }))}
                                disabled={!editForm.governorateID}
                                required
                            >
                                <option value="">{t("timesheetForm.form.placeholders.delegationSelect")}</option>
                                {delegations.map(d => (
                                    <option key={d.delegationID} value={d.delegationID}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
                {!isRecruitmentVisit && !isVisited && (
                    <>
                        <div className="form-group">
                            <label htmlFor="agentPhone">{t("timesheetForm.form.agentPhone")}</label>
                            <input
                                type="tel"
                                id="agentPhone"
                                value={editForm.agentPhone}
                                onChange={(e) => setEditForm(prev => ({ ...prev, agentPhone: e.target.value }))}
                                placeholder={t("timesheetForm.form.placeholders.agentPhone")}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="agent">{t("timesheetForm.form.agent")}</label>
                            {agentLoading && <span className="loading-spinner"></span>}
                            <select
                                id="agent"
                                value={editForm.agentID}
                                onChange={(e) => setEditForm(prev => ({ ...prev, agentID: e.target.value }))}
                                disabled={!(editForm.agentPhone || editForm.delegationID)}
                                required
                            >
                                <option value="">{t("timesheetForm.form.placeholders.agentSelect")}</option>
                                {agents.map(a => (
                                    <option key={a.agentID} value={a.agentID}>{`${a.name} ${a.lastname} (${a.phone})`}</option>
                                ))}
                            </select>
                        </div>
                    </>
                )}
                {!isVisited && <hr />}
                <div className="form-group" style={{ marginBottom: "0 !important" }}>
                    <label>{t("timesheetForm.form.reasons")}</label>
                    {!isVisited && (
                        <select
                            value=""
                            onChange={(e) => handleReasonSelect(reasons.find(r => r.reasonID === e.target.value)!)}
                            disabled={isRecruitmentVisit && editForm.reasons.some(r => r.id === reasons.find(r => r.item.toLowerCase() === "recruitment")?.reasonID)}
                        >
                            <option value="">{t("timesheetForm.form.placeholders.reasonSelect")}</option>
                            {reasons.map(r => (
                                <option key={r.reasonID} value={r.reasonID}>{r.item}</option>
                            ))}
                        </select>
                    )}
                    <div className="selected-items">
                        {editForm.reasons.map((r, i) => (
                            <span
                                key={i}
                                className="selected-item"
                                onClick={() => handleRemoveReason(i)}
                            >
                                {reasons.find(re => re.reasonID === r.id)?.item} {!isVisited && "×"}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="form-group">
                    <label>{t("timesheetForm.form.checklists")}</label>
                    {!isVisited && (
                        <select
                            value=""
                            onChange={(e) => handleChecklistSelect(checklists.find(c => c.checklistID === e.target.value)!)}
                        >
                            <option value="">{t("timesheetForm.form.placeholders.checklistSelect")}</option>
                            {checklists.map(c => (
                                <option key={c.checklistID} value={c.checklistID}>{c.item}</option>
                            ))}
                        </select>
                    )}
                    <div className="selected-items">
                        {editForm.checklists.map((c, i) => (
                            <div key={i} className="checklist-item">
                                {isVisited && (
                                    <input
                                        type="checkbox"
                                        checked={c.checked}
                                        onChange={(e) => handleChecklistChange(c.id, e.target.checked)}
                                    />
                                )}
                                <span>{checklists.find(ch => ch.checklistID === c.id)?.item}</span>
                                {!isVisited && (
                                    <span
                                        className="remove-item"
                                        onClick={() => handleRemoveChecklist(i)}
                                    >
                                        ×
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                {isSuperAdmin && isVisited && (
                    <div className="form-group duration-group">
                        <label htmlFor="duration">{t("visitDetails.form.duration")}</label>
                        <div className="duration-input-container">
                            <input
                                type="number"
                                id="duration"
                                value={editForm.duration ?? ""}
                                onChange={handleDurationChange}
                                placeholder={t("visitDetails.form.durationPlaceholder")}
                                min="0"
                                step="1"
                                required
                            />
                            <span className="duration-unit">{t("visitDetails.form.minutes")}</span>
                        </div>
                    </div>
                )}
                {isVisited && (
                    <>
                        <div className="form-group photos-section">
                            <h2>
                                <FaCamera /> {t("visitDetails.form.photos.title")} {formPhotosCount}
                            </h2>
                            <div className="camera-controls">
                                <button
                                    type="button"
                                    className="camera-btn"
                                    onClick={startCamera}
                                    disabled={isCameraActive}
                                >
                                    <FaCamera /> {t("visitDetails.form.photos.startCamera")}
                                </button>
                                <div className={`camera-container ${isCameraActive ? "active" : ""}`}>
                                    <div className="camera-frame">
                                        <video ref={videoRef} className="camera-preview" muted playsInline />
                                        <div className={`flash-overlay ${flashEffect ? "active" : ""}`}></div>
                                        <div className="photo-counter">
                                            <FaCamera /> {newPhotos.length}
                                        </div>
                                        {newPhotos.length > 0 && (
                                            <div className="thumbnail-preview">
                                                <img
                                                    src={URL.createObjectURL(newPhotos[newPhotos.length - 1])}
                                                    alt={t("visitDetails.form.photos.lastCapturedAlt")}
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
                                            >
                                                <FaTimes /> {t("visitDetails.actions.stopCamera")}
                                            </button>
                                            <button
                                                type="button"
                                                className="capture-btn"
                                                onClick={capturePhoto}
                                            >
                                                <FaCamera /> {t("visitDetails.actions.capturePhoto")}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {(visit.photos?.length || newPhotos.length) && (
                                <div className="photo-previews">
                                    {visit.photos?.filter(p => !editForm.photosToRemove.includes(p)).map((photo, index) => (
                                        <div key={`existing-${index}`} className="photo-container">
                                            <img
                                                src={`${BASE_URL}${photo}`}
                                                alt={t("visitDetails.form.photos.existingAlt", { index: index + 1 })}
                                                className="photo-preview"
                                                onClick={() => setSelectedImage(`${BASE_URL}${photo}`)}
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
                                                alt={t("visitDetails.form.photos.newAlt", { index: index + 1 })}
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
                        <div className="form-group">
                            <label htmlFor="comment">{t("visitDetails.form.comment.label")}</label>
                            <textarea
                                id="comment"
                                value={editForm.comment}
                                onChange={(e) => setEditForm(prev => ({ ...prev, comment: e.target.value }))}
                                placeholder={t("visitDetails.form.comment.placeholder")}
                            />
                        </div>
                    </>
                )}
                <div className="form-actions">
                    <button type="button" className="submit-btn secondary" onClick={handleCancel}>
                        {t("timesheetForm.actions.back")}
                    </button>
                    <button type="submit" className="submit-btn primary" disabled={!isFormComplete}>
                        {t("visitDetails.actions.save")}
                    </button>
                </div>
            </form>
            {selectedImage && (
                <div className="fullscreen-image-modal">
                    <div className="fullscreen-image-content">
                        <button
                            className="close-fullscreen-btn"
                            onClick={() => setSelectedImage(null)}
                            aria-label={t("visitDetails.actions.closeImage")}
                        >
                            <FaTimes />
                        </button>
                        <img
                            src={selectedImage}
                            alt={t("visitDetails.form.photos.fullscreenAlt")}
                            className="fullscreen-image"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default VisitEditForm;