/* eslint-disable react-hooks/exhaustive-deps */
import React, { Dispatch, RefObject, SetStateAction } from "react";
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
import "./VisitValidation.css";
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
    regionalManagerSearch: string;
    supervisorSearch: string;
    duration: number | null;
    checklists: Array<{ id: string; checked: boolean }>;
    reasons: Array<{ id: string }>;
    photosToRemove: string[];
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
    regionalManagerSearch: string;
    setRegionalManagerSearch: Dispatch<SetStateAction<string>>;
    supervisors: User[];
    selectedSupervisor: string;
    setSelectedSupervisor: Dispatch<SetStateAction<string>>;
    supervisorSearch: string;
    setSupervisorSearch: Dispatch<SetStateAction<string>>;
    agentPhone: string;
    setAgentPhone: Dispatch<SetStateAction<string>>;
    agentLocation: string;
    regions: Region[];
    governorates: Governorate[];
    delegations: Delegation[];
    agents: Agent[];
    reasons: Reason[];
    filteredReasons: Reason[];
    setFilteredReasons: Dispatch<SetStateAction<Reason[]>>;
    checklists: Checklist[];
    filteredChecklists: Checklist[];
    setFilteredChecklists: Dispatch<SetStateAction<Checklist[]>>;
    agentLoading: boolean;
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
    isRecruitmentVisit: boolean;
    setIsRecruitmentVisit: Dispatch<SetStateAction<boolean>>;
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
    regionalManagerSearch,
    setRegionalManagerSearch,
    supervisors,
    selectedSupervisor,
    setSelectedSupervisor,
    supervisorSearch,
    setSupervisorSearch,
    agentPhone,
    setAgentPhone,
    agentLocation,
    regions,
    governorates,
    delegations,
    agents,
    reasons,
    filteredReasons,
    setFilteredReasons,
    checklists,
    filteredChecklists,
    setFilteredChecklists,
    agentLoading,
    isCameraActive,
    setIsCameraActive,
    newPhotos,
    setNewPhotos,
    flashEffect,
    setFlashEffect,
    videoRef,
    canvasRef,
    editTracking,
    setEditTracking,
    selectedImage,
    setSelectedImage,
    startCamera,
    stopCamera,
    capturePhoto,
    removeNewPhoto,
    canEditField,
    idVisit,
    setVisit,
    setError,
    t,
    navigate,
    isRecruitmentVisit,
    setIsRecruitmentVisit,
}) => {
    const currentDate = new Date().toISOString().split("T")[0];
    const currentTime = new Date().toTimeString().slice(0, 5);
    const minTime = editForm.date === currentDate ? currentTime : undefined;
    const isVisited = visit.status === VisitStatus.VISITED;

    // Form Completion Check
    const isFormComplete = isVisited
        ? editForm.checklists.length > 0
        : editForm.date &&
        editForm.time &&
        (isRecruitmentVisit || editForm.agentID) &&
        editForm.reasons.length > 0 &&
        editForm.checklists.length > 0 &&
        (isSupervisor || selectedSupervisor);

    // Handlers
    const handleRegionalManagerSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRegionalManagerSearch(e.target.value);
    };

    const handleSupervisorSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSupervisorSearch(e.target.value);
    };

    const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setEditForm(prev => ({
            ...prev,
            regionID: e.target.value,
            governorateID: "",
            delegationID: "",
            agentID: "",
            agentSearch: ""
        }));
    };

    const handleGovernorateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setEditForm(prev => ({
            ...prev,
            governorateID: e.target.value,
            delegationID: "",
            agentID: "",
            agentSearch: ""
        }));
    };

    const handleDelegationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setEditForm(prev => ({
            ...prev,
            delegationID: e.target.value,
            agentID: "",
            agentSearch: ""
        }));
    };

    const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setEditForm(prev => ({
            ...prev,
            agentID: e.target.value,
            agentSearch: agents.find(a => a.agentID === e.target.value)?.name || ""
        }));
    };

    const handleAgentPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAgentPhone(e.target.value);
        setEditForm(prev => ({ ...prev, agentPhone: e.target.value }));
    };

    const handleRegionalManagerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedRegionalManager(e.target.value);
    };

    const handleSupervisorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedSupervisor(e.target.value);
    };

    const handleReasonSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const searchTerm = e.target.value;
        setEditForm(prev => ({ ...prev, reasonSearch: searchTerm }));
        if (searchTerm) {
            setFilteredReasons(reasons.filter(r =>
                r.item.toLowerCase().includes(searchTerm.toLowerCase())
            ));
        } else {
            setFilteredReasons(reasons);
        }
    };

    const handleChecklistSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const searchTerm = e.target.value;
        setEditForm(prev => ({ ...prev, checklistSearch: searchTerm }));
        if (searchTerm) {
            setFilteredChecklists(checklists.filter(c =>
                c.item.toLowerCase().includes(searchTerm.toLowerCase())
            ));
        } else {
            setFilteredChecklists(checklists);
        }
    };

    const handleReasonSelect = (reason: Reason) => {
        if (!editForm.reasons.some(r => r.id === reason.reasonID) && !isVisited) {
            setEditForm(prev => ({
                ...prev,
                reasons: [...prev.reasons, { id: reason.reasonID }],
                reasonSearch: ""
            }));
        }
    };

    const handleChecklistSelect = (checklist: Checklist) => {
        if (!editForm.checklists.some(c => c.id === checklist.checklistID)) {
            setEditForm(prev => ({
                ...prev,
                checklists: [...prev.checklists, { id: checklist.checklistID, checked: false }],
                checklistSearch: ""
            }));
        }
    };

    const handleRemoveReason = (index: number) => {
        if (!isVisited) {
            setEditForm(prev => ({
                ...prev,
                reasons: prev.reasons.filter((_, i) => i !== index)
            }));
        }
    };

    const handleRemoveChecklist = (index: number) => {
        if (!isVisited) {
            setEditForm(prev => ({
                ...prev,
                checklists: prev.checklists.filter((_, i) => i !== index)
            }));
        }
    };

    const handleChecklistChange = (id: string, checked: boolean) => {
        if (isVisited) {
            setEditForm(prev => ({
                ...prev,
                checklists: prev.checklists.map(c => c.id === id ? { ...c, checked } : c)
            }));
        }
    };

    const handleRemovePhoto = (photoUrl: string) => {
        if (isVisited) {
            setEditForm(prev => ({
                ...prev,
                photosToRemove: [...prev.photosToRemove, photoUrl]
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!visit || !userPermissions.canEditTimesheets || !isFormComplete) {
            setError(t("timesheetForm.errors.formIncomplete"));
            return;
        }

        let newStatus = visit.status;
        let updatedDuration: number | undefined = isSuperAdmin && isVisited
            ? editForm.duration || undefined
            : visit.duration || undefined;

        if (isVisited) {
            newStatus = VisitStatus.VISITED;
            if (isSupervisor && editTracking.startTime) {
                const editDurationMinutes = Math.round((Date.now() - editTracking.startTime) / 60000);
                updatedDuration = (visit.duration || 0) + editDurationMinutes;
                localStorage.removeItem(`editStartTime_${visit.visitID}`);
            }
        } else {
            if (isSupervisor) {
                newStatus = VisitStatus.PENDING;
            } else if (isDirector || isRegionalManager || isSuperAdmin) {
                newStatus = VisitStatus.VALIDATED;
            }
        }

        const location = [
            regions.find(r => r.regionID === editForm.regionID)?.name,
            governorates.find(g => g.governorateID === editForm.governorateID)?.name,
            delegations.find(d => d.delegationID === editForm.delegationID)?.name
        ].filter(Boolean).join(", ") || null;

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
        }
    };

    const handleCancel = () => navigate(`/visit/${idVisit}`);

    const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isSuperAdmin && isVisited) {
            const value = e.target.value;
            if (value === "") {
                setEditForm(prev => ({ ...prev, duration: null }));
            } else {
                const numValue = parseInt(value);
                if (!isNaN(numValue) && numValue >= 0) {
                    setEditForm(prev => ({ ...prev, duration: numValue }));
                }
            }
        }
    };

    const formPhotosCount = t("visitDetails.form.photos.count", {
        count: (visit.photos?.filter(p => !editForm.photosToRemove.includes(p)).length || 0) + newPhotos.length
    }) || `(${(visit.photos?.filter(p => !editForm.photosToRemove.includes(p)).length || 0) + newPhotos.length} photos)`;

    React.useEffect(() => {
        if (isSupervisor && isVisited && !editTracking.startTime) {
            const startTime = Date.now();
            localStorage.setItem(`editStartTime_${visit.visitID}`, startTime.toString());
            setEditTracking({
                startTime,
                durationAccumulator: visit.duration || 0
            });
        }
    }, [isSupervisor, isVisited, visit.visitID, visit.duration, editTracking.startTime, setEditTracking]);

    React.useEffect(() => {
        if (isRecruitmentVisit && !isVisited) {
            setEditForm(prev => ({
                ...prev,
                agentID: "",
                agentPhone: "",
                agentSearch: ""
            }));
            setAgentPhone("");
            const recruitmentReason = reasons.find(r => r.item.toLowerCase() === "recruitment");
            if (recruitmentReason && !editForm.reasons.some(r => r.id === recruitmentReason.reasonID)) {
                setEditForm(prev => ({
                    ...prev,
                    reasons: [{ id: recruitmentReason.reasonID }]
                }));
            }
        }
    }, [isRecruitmentVisit, isVisited, reasons]);

    React.useEffect(() => {
        return () => {
            newPhotos.forEach(photo => URL.revokeObjectURL(URL.createObjectURL(photo)));
        };
    }, [newPhotos]);

    return (
        <div className="timesheet-form-container">
            <form onSubmit={handleSubmit} className="form-card" role="form">
                {(isSuperAdmin || isDirector) && !isVisited && (
                    <div className="form-group">
                        <label htmlFor="regionalManager">{t("timesheetForm.form.regionalManager")}</label>
                        <input
                            type="text"
                            value={regionalManagerSearch}
                            onChange={handleRegionalManagerSearchChange}
                            placeholder={t("timesheetForm.form.placeholders.regionalManagerSearch")}
                            disabled={!canEditField("supervisor")}
                        />
                        <select
                            id="regionalManager"
                            value={selectedRegionalManager}
                            onChange={handleRegionalManagerChange}
                            disabled={!canEditField("supervisor")}
                        >
                            <option value="">{t("timesheetForm.form.placeholders.regionalManagerSelect")}</option>
                            {regionalManagers.map(rm => (
                                <option key={rm.userID} value={rm.userID}>
                                    {`${rm.firstname} ${rm.lastname} (${rm.phone})`}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {(isSuperAdmin || isDirector || isRegionalManager) && !isVisited && (
                    <div className="form-group">
                        <label htmlFor="supervisor">{t("timesheetForm.form.supervisor")}</label>
                        <input
                            type="text"
                            value={supervisorSearch}
                            onChange={handleSupervisorSearchChange}
                            placeholder={t("timesheetForm.form.placeholders.supervisorSearch")}
                            disabled={!canEditField("supervisor")}
                        />
                        <select
                            id="supervisor"
                            value={selectedSupervisor}
                            onChange={handleSupervisorChange}
                            disabled={!canEditField("supervisor")}
                        >
                            <option value="">{t("timesheetForm.form.placeholders.supervisorSelect")}</option>
                            {supervisors.map(s => (
                                <option key={s.userID} value={s.userID}>
                                    {`${s.firstname} ${s.lastname} (${s.phone})`}
                                </option>
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
                                onChange={e => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                                min={currentDate}
                                required
                                disabled={!canEditField("dateTime")}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="time">{t("timesheetForm.form.time")}</label>
                            <input
                                type="time"
                                id="time"
                                value={editForm.time}
                                onChange={e => setEditForm(prev => ({ ...prev, time: e.target.value }))}
                                disabled={!editForm.date || !canEditField("dateTime")}
                                min={minTime}
                                required
                            />
                        </div>
                    </div>
                )}
                {!isVisited && <hr />}
                {!isVisited && (
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="custom-checkbox-label" htmlFor="recruitmentVisit">
                            <input
                                type="checkbox"
                                id="recruitmentVisit"
                                checked={isRecruitmentVisit}
                                onChange={e => setIsRecruitmentVisit(e.target.checked)}
                                className="custom-checkbox-input"
                                disabled={!canEditField("agentID")}
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
                                onChange={handleRegionChange}
                                disabled={!canEditField("regionID")}
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
                                onChange={handleGovernorateChange}
                                disabled={!editForm.regionID || !canEditField("governorateID")}
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
                                onChange={handleDelegationChange}
                                disabled={!editForm.governorateID || !canEditField("delegationID")}
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
                                value={agentPhone}
                                onChange={handleAgentPhoneChange}
                                placeholder={t("timesheetForm.form.placeholders.agentPhone")}
                                maxLength={8}
                                disabled={!canEditField("agentID")}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="agent">{t("timesheetForm.form.agent")}</label>
                            {agentLoading && <span className="loading-spinner"></span>}
                            <select
                                id="agent"
                                value={editForm.agentID}
                                onChange={handleAgentChange}
                                disabled={!(agentPhone || editForm.delegationID) || !canEditField("agentID")}
                                required
                            >
                                <option value="">{t("timesheetForm.form.placeholders.agentSelect")}</option>
                                {agents.map(a => (
                                    <option key={a.agentID} value={a.agentID}>
                                        {`${a.name} ${a.lastname} (${a.phone})`}
                                    </option>
                                ))}
                            </select>
                            {editForm.agentID && agentLocation && (
                                <div className="agent-location">
                                    {t("timesheetForm.form.agentLocation")}: {agentLocation}
                                </div>
                            )}
                        </div>
                    </>
                )}
                {!isVisited && <hr />}
                <div className="form-group" style={{ marginBottom: "0 !important" }}>
                    <label>{t("timesheetForm.form.reasons")}</label>
                    {!isVisited && (
                        <>
                            <input
                                type="text"
                                value={editForm.reasonSearch}
                                onChange={handleReasonSearchChange}
                                placeholder={t("timesheetForm.form.placeholders.reasonSearch")}
                                disabled={
                                    isRecruitmentVisit &&
                                    editForm.reasons.some(r => r.id === reasons.find(r => r.item.toLowerCase() === "recruitment")?.reasonID) ||
                                    !canEditField("reasons")
                                }
                            />
                            <select
                                value=""
                                onChange={e => handleReasonSelect(reasons.find(r => r.reasonID === e.target.value)!)}
                                disabled={
                                    isRecruitmentVisit &&
                                    editForm.reasons.some(r => r.id === reasons.find(r => r.item.toLowerCase() === "recruitment")?.reasonID) ||
                                    !canEditField("reasons")
                                }
                            >
                                <option value="">{t("timesheetForm.form.placeholders.reasonSelect")}</option>
                                {filteredReasons.map(r => (
                                    <option key={r.reasonID} value={r.reasonID}>{r.item}</option>
                                ))}
                            </select>
                        </>
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
                        <>
                            <input
                                type="text"
                                value={editForm.checklistSearch}
                                onChange={handleChecklistSearchChange}
                                placeholder={t("timesheetForm.form.placeholders.checklistSearch")}
                                disabled={!canEditField("checklists")}
                            />
                            <select
                                value=""
                                onChange={e => handleChecklistSelect(checklists.find(c => c.checklistID === e.target.value)!)}
                                disabled={!canEditField("checklists")}
                            >
                                <option value="">{t("timesheetForm.form.placeholders.checklistSelect")}</option>
                                {filteredChecklists.map(c => (
                                    <option key={c.checklistID} value={c.checklistID}>{c.item}</option>
                                ))}
                            </select>
                        </>
                    )}
                    <div className="selected-items">
                        {editForm.checklists.map((c, i) => (
                            <div key={i} className="checklist-item">
                                {isVisited && (
                                    <input
                                        type="checkbox"
                                        checked={c.checked}
                                        onChange={e => handleChecklistChange(c.id, e.target.checked)}
                                        disabled={!canEditField("checklists")}
                                    />
                                )}
                                <span>{checklists.find(ch => ch.checklistID === c.id)?.item}</span>
                                {!isVisited && (
                                    <span className="remove-item" onClick={() => handleRemoveChecklist(i)}>
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
                                    disabled={isCameraActive || !canEditField("photos")}
                                >
                                    <FaCamera /> {t("visitDetails.form.photos.startCamera")}
                                </button>
                                <div className={`camera-container ${isCameraActive ? "active" : ""}`}>
                                    <div className="camera-frame">
                                        <video ref={videoRef} className="camera-preview" muted playsInline />
                                        <canvas ref={canvasRef} style={{ display: "none" }} />
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
                            {(visit.photos?.length! > 0 || newPhotos.length > 0) && (
                                <div className="photo-previews">
                                    {visit.photos
                                        ?.filter(photo => !editForm.photosToRemove.includes(photo))
                                        .map((photo, index) => {
                                            const previewPhotoAria = t("visitDetails.form.photos.previewPhoto", { index: index + 1 });
                                            const removePhotoAria = t("visitDetails.form.photos.removePhoto", { index: index + 1 });
                                            const capturedAlt = t("visitDetails.form.photos.capturedAlt", { index: index + 1 });
                                            return (
                                                <div key={`existing-${index}`} className="photo-container">
                                                    <img
                                                        src={`${BASE_URL}${photo}`}
                                                        alt={capturedAlt}
                                                        className="photo-preview"
                                                        onClick={() => setSelectedImage(`${BASE_URL}${photo}`)}
                                                        aria-label={previewPhotoAria}
                                                    />
                                                    <button
                                                        className="remove-photo-btn"
                                                        onClick={() => handleRemovePhoto(`${photo}`)}
                                                        aria-label={removePhotoAria}
                                                        disabled={!canEditField("photos")}
                                                    >
                                                        <FaTimes />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    {newPhotos.map((photo, index) => {
                                        const previewPhotoAria = t("visitDetails.form.photos.previewPhoto", {
                                            index: (visit.photos?.length || 0) - editForm.photosToRemove.length + index + 1
                                        });
                                        const removePhotoAria = t("visitDetails.form.photos.removePhoto", {
                                            index: (visit.photos?.length || 0) - editForm.photosToRemove.length + index + 1
                                        });
                                        const capturedAlt = t("visitDetails.form.photos.capturedAlt", {
                                            index: (visit.photos?.length || 0) - editForm.photosToRemove.length + index + 1
                                        });
                                        return (
                                            <div key={`new-${index}`} className="photo-container">
                                                <img
                                                    src={URL.createObjectURL(photo)}
                                                    alt={capturedAlt}
                                                    className="photo-preview"
                                                    onClick={() => setSelectedImage(URL.createObjectURL(photo))}
                                                    aria-label={previewPhotoAria}
                                                />
                                                <button
                                                    className="remove-photo-btn"
                                                    onClick={() => removeNewPhoto(index)}
                                                    aria-label={removePhotoAria}
                                                    disabled={!canEditField("photos")}
                                                >
                                                    <FaTimes />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <p className="photo-note">{t("visitDetails.form.photos.note")}</p>
                        </div>
                        <div className="form-group">
                            <label htmlFor="comment">{t("visitDetails.form.comment.label")}</label>
                            <textarea
                                id="comment"
                                value={editForm.comment}
                                onChange={e => setEditForm(prev => ({ ...prev, comment: e.target.value }))}
                                placeholder={t("visitDetails.form.comment.placeholder")}
                                disabled={!canEditField("comment")}
                            />
                        </div>
                    </>
                )}
                <div className="form-actions form-actions-6">
                    <button type="button" className="submit-btn secondary" onClick={handleCancel}>
                        {t("timesheetForm.actions.back")}
                    </button>
                    <button type="submit" className="submit-btn primary" disabled={!isFormComplete}>
                        {t("visitDetails.actions.save")}
                    </button>
                </div>
            </form>
            {selectedImage && (
                <div className="photo-fullscreen-preview">
                    <img src={selectedImage} alt={t("visitDetails.form.photos.fullscreenAlt")} className="fullscreen-image" />
                    <button
                        className="close-preview-btn"
                        onClick={() => setSelectedImage(null)}
                        aria-label={t("visitDetails.actions.closeImage")}
                    >
                        <FaTimes />
                    </button>
                </div>
            )}
        </div>
    );
};

export default VisitEditForm;