import React, { Dispatch, RefObject, SetStateAction } from "react";
import { FaCamera, FaTimes } from "react-icons/fa";
import { Button } from "../../components/ui/button";
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
//import { useTranslation } from "react-i18next";
import "./VisitDetails.css";


// Constants
const BASE_URL = import.meta.env.VITE_BASE_URL;

// Interfaces
interface EditTracking {
    startTime: number | null;
    durationAccumulator: number;
}

interface EditFormState {
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

/**
 * VisitEditForm component: Handles the form for editing visit details.
 */
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
    setDisableSupervisorInput,
    disableRegionalManagerInput,
    setDisableRegionalManagerInput,
    agentLoading,
    supervisorLoading,
    setFetchMode,
    isCameraActive,
    newPhotos,
    setNewPhotos,
    flashEffect,
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
}) => {
    // Utility function to get current date and time
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

    // Utility function to check if date is weekend
    const isWeekend = (date: string) => new Date(date).getDay() % 6 === 0;

    // Utility function to validate time
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

    // Form submission handler
    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (
            !visit ||
            !userPermissions.canEditTimesheets ||
            !editForm.date ||
            !editForm.time ||
            !editForm.delegationID
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
                location: editForm.delegationID,
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
            navigate(`/visit/${idVisit}`);
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error ? err.message : t("visitDetails.error.updateFailed");
            setError(errorMessage);
            console.error(err);
        }
    };

    // Cancel handler
    const handleCancel = () => {
        setEditForm((prev) => ({
            ...prev,
            date: prev.original.date,
            time: prev.original.time,
            regionID: prev.original.regionID,
            governorateID: prev.original.governorateID,
            delegationID: prev.original.delegationID,
            status: prev.original.status,
            comment: prev.original.comment,
            agentID: prev.original.agentID,
            checklists: [...prev.original.checklists],
            reasons: [...prev.original.reasons],
            photosToRemove: [],
        }));
        setEditTracking({ startTime: null, durationAccumulator: 0 });
        navigate(`/visit/${idVisit}`);
    };

    // Photo handling
    const handleRemovePhoto = (photoUrl: string) => {
        setEditForm((prev) => ({
            ...prev,
            photosToRemove: [...prev.photosToRemove, photoUrl],
        }));
    };

    const handleImageClick = (photo: string) =>
        setSelectedImage(`${BASE_URL}${photo}`);
    const handleCloseFullscreen = () => setSelectedImage(null);

    // Checklist and reason handling
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

    // Photo count display
    const formPhotosCount =
        t("visitDetails.form.photos.count", {
            count:
                (visit?.photos?.filter((p) => !editForm.photosToRemove.includes(p))
                    .length || 0) + newPhotos.length,
        }) ||
        `(${(visit?.photos?.filter((p) => !editForm.photosToRemove.includes(p))
            .length || 0) + newPhotos.length
        } photos)`;

    return (
        <>
            <form onSubmit={handleEditSubmit} className="visit-edit-form">
                {/* Regional Manager Selection */}
                {(isSuperAdmin || isDirector) &&
                    !isRegionalManager &&
                    !isSupervisor &&
                    canEditField("supervisor") && (
                        <div className="form-group">
                            <label htmlFor="regionalManager">
                                {t("visitDetails.form.regionalManager")}
                            </label>
                            <input
                                type="text"
                                id="regional-manager-search"
                                placeholder={t(
                                    "visitDetails.form.placeholders.regionalManagerSearch"
                                )}
                                value={editForm.regionalManagerSearch}
                                onChange={(e) =>
                                    setEditForm((prev) => ({
                                        ...prev,
                                        regionalManagerSearch: e.target.value,
                                    }))
                                }
                                className="search-input"
                                aria-label={t(
                                    "visitDetails.form.placeholders.regionalManagerSearch"
                                )}
                                disabled={disableRegionalManagerInput}
                            />
                            <select
                                id="regionalManager"
                                value={selectedRegionalManager}
                                onChange={(e) => {
                                    setSelectedRegionalManager(e.target.value);
                                    setSelectedSupervisor("");
                                    setEditForm((prev) => ({
                                        ...prev,
                                        regionID: "",
                                        governorateID: "",
                                        delegationID: "",
                                        agentID: "",
                                        agentSearch: "",
                                    }));
                                    setDisableLocationInputs(false);
                                    setDisableSupervisorInput(false);
                                    setDisableRegionalManagerInput(false);
                                    setFetchMode("none");
                                }}
                                aria-label={t(
                                    "visitDetails.form.placeholders.regionalManagerSelect"
                                )}
                                disabled={disableRegionalManagerInput}
                            >
                                <option value="">
                                    {t("visitDetails.form.placeholders.regionalManagerSelect")}
                                </option>
                                {regionalManagers
                                    .filter((rm) =>
                                        `${rm.firstname || ""} ${rm.lastname || ""} ${rm.phone || ""}`
                                            .toLowerCase()
                                            .includes(editForm.regionalManagerSearch.toLowerCase())
                                    )
                                    .map((rm) => (
                                        <option key={rm.userID} value={rm.userID}>
                                            {rm.firstname} {rm.lastname} ({rm.phone})
                                        </option>
                                    ))}
                            </select>
                        </div>
                    )}

                {/* Supervisor Selection */}
                {(isSuperAdmin || isDirector || isRegionalManager) &&
                    !isSupervisor &&
                    userPermissions.canCreateTimesheetsForSupervisors &&
                    userPermissions.canReadSupervisors &&
                    canEditField("supervisor") && (
                        <div className="form-group">
                            <label htmlFor="supervisor">{t("visitDetails.form.supervisor")}</label>
                            <input
                                type="text"
                                id="supervisor-search"
                                placeholder={t("visitDetails.form.placeholders.supervisorSearch")}
                                value={editForm.supervisorSearch}
                                onChange={(e) =>
                                    setEditForm((prev) => ({
                                        ...prev,
                                        supervisorSearch: e.target.value,
                                    }))
                                }
                                className="search-input"
                                aria-label={t("visitDetails.form.placeholders.supervisorSearch")}
                                disabled={supervisorLoading || disableSupervisorInput}
                            />
                            <input
                                type="tel"
                                id="supervisor-phone"
                                placeholder={t("visitDetails.form.placeholders.supervisorPhone")}
                                value={supervisorPhone}
                                onChange={(e) => setSupervisorPhone(e.target.value)}
                                className="search-input"
                                aria-label={t("visitDetails.form.placeholders.supervisorPhone")}
                                disabled={supervisorLoading || disableSupervisorInput}
                            />
                            {supervisorLoading && (
                                <span className="loading-spinner" aria-hidden="true"></span>
                            )}
                            <select
                                id="supervisor"
                                value={selectedSupervisor}
                                onChange={(e) => {
                                    setSelectedSupervisor(e.target.value);
                                    setEditForm((prev) => ({
                                        ...prev,
                                        regionID: "",
                                        governorateID: "",
                                        delegationID: "",
                                        agentID: "",
                                        agentSearch: "",
                                    }));
                                    setDisableLocationInputs(false);
                                    setDisableSupervisorInput(false);
                                    setFetchMode("supervisor");
                                }}
                                required
                                aria-label={t("visitDetails.form.placeholders.supervisorSelect")}
                                disabled={supervisorLoading || disableSupervisorInput}
                            >
                                <option value="">
                                    {t("visitDetails.form.placeholders.supervisorSelect")}
                                </option>
                                {supervisors
                                    .filter((s) =>
                                        `${s.firstname || ""} ${s.lastname || ""} ${s.phone || ""}`
                                            .toLowerCase()
                                            .includes(editForm.supervisorSearch.toLowerCase())
                                    )
                                    .map((s) => (
                                        <option key={s.userID} value={s.userID}>
                                            {s.firstname} {s.lastname} ({s.phone})
                                        </option>
                                    ))}
                            </select>
                        </div>
                    )}

                {/* Date and Time Inputs */}
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

                {/* Region Selection */}
                {canEditField("regionID") && (
                    <div className="form-group">
                        <label htmlFor="region">
                            {t("visitDetails.form.region.label")}
                        </label>
                        <select
                            id="region"
                            value={editForm.regionID}
                            onChange={(e) =>
                                setEditForm((prev) => ({
                                    ...prev,
                                    regionID: e.target.value,
                                }))
                            }
                            required
                            disabled={
                                !userPermissions.canReadAgentsByLocation ||
                                disableLocationInputs
                            }
                            aria-label={t("visitDetails.form.region.ariaLabel")}
                        >
                            <option value="">
                                {t("visitDetails.form.region.selectPlaceholder")}
                            </option>
                            {regions.map((reg) => (
                                <option key={reg.regionID} value={reg.regionID}>
                                    {reg.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Governorate Selection */}
                {canEditField("governorateID") && (
                    <div className="form-group">
                        <label htmlFor="governorate">
                            {t("visitDetails.form.governorate.label")}
                        </label>
                        <select
                            id="governorate"
                            value={editForm.governorateID}
                            onChange={(e) =>
                                setEditForm((prev) => ({
                                    ...prev,
                                    governorateID: e.target.value,
                                }))
                            }
                            required
                            disabled={
                                !userPermissions.canReadAgentsByLocation ||
                                disableLocationInputs ||
                                !editForm.regionID
                            }
                            aria-label={t("visitDetails.form.governorate.ariaLabel")}
                        >
                            <option value="">
                                {t("visitDetails.form.governorate.selectPlaceholder")}
                            </option>
                            {governorates.map((gov) => (
                                <option key={gov.governorateID} value={gov.governorateID}>
                                    {gov.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Delegation Selection */}
                {canEditField("delegationID") && (
                    <div className="form-group">
                        <label htmlFor="delegation">
                            {t("visitDetails.form.delegation.label")}
                        </label>
                        <select
                            id="delegation"
                            value={editForm.delegationID}
                            onChange={(e) =>
                                setEditForm((prev) => ({
                                    ...prev,
                                    delegationID: e.target.value,
                                }))
                            }
                            required
                            disabled={
                                !userPermissions.canReadAgentsByLocation ||
                                disableLocationInputs ||
                                !editForm.governorateID
                            }
                            aria-label={t("visitDetails.form.delegation.ariaLabel")}
                        >
                            <option value="">
                                {t("visitDetails.form.delegation.selectPlaceholder")}
                            </option>
                            {delegations.map((del) => (
                                <option key={del.delegationID} value={del.delegationID}>
                                    {del.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Agent Selection */}
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
                            {agentLoading && (
                                <span className="loading-spinner" aria-hidden="true"></span>
                            )}
                        </div>
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
                                    !!editForm.agentPhone ||
                                    !editForm.delegationID
                                }
                                aria-label={t("visitDetails.form.agent.searchPlaceholder")}
                            />
                            {agentLoading && (
                                <span className="loading-spinner" aria-hidden="true"></span>
                            )}
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
                                    !!editForm.agentPhone ||
                                    !editForm.delegationID ||
                                    agentLoading
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

                {/* Reasons Selection */}
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
                            {editForm.reasons.map((r, index) => {
                                const reasonItem =
                                    reasons.find((re) => re.reasonID === r.id)?.item || r.id;
                                return (
                                    <span
                                        key={index}
                                        className="selected-item"
                                        onClick={() => handleRemoveReason(index)}
                                        aria-label={
                                            t("visitDetails.aria.removeReason", {
                                                item: reasonItem,
                                            }) || `Remove reason ${reasonItem}`
                                        }
                                    >
                                        {reasonItem} ×
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Checklists Selection */}
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
                            aria-label={t("visitDetails.form.checklists.searchPlaceholder")}
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
                            {editForm.checklists.map((c, index) => {
                                const checklistItem =
                                    checklists.find((cl) => cl.checklistID === c.id)?.item ||
                                    c.id;
                                return (
                                    <div key={index} className="checklist-item">
                                        <input
                                            type="checkbox"
                                            checked={c.checked}
                                            onChange={(e) =>
                                                handleChecklistChange(c.id, e.target.checked)
                                            }
                                            disabled={visit.status !== "visited"}
                                            aria-label={
                                                t("visitDetails.aria.checklistItem", {
                                                    item: checklistItem,
                                                }) || `Toggle checklist ${checklistItem}`
                                            }
                                        />
                                        <span>{checklistItem}</span>
                                        <span
                                            className="remove-item"
                                            onClick={() => handleRemoveChecklist(index)}
                                            aria-label={
                                                t("visitDetails.aria.removeChecklist", {
                                                    item: checklistItem,
                                                }) || `Remove checklist ${checklistItem}`
                                            }
                                        >
                                            ×
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Photos Section */}
                {canEditField("photos") &&
                    (visit.photos?.length || newPhotos.length) ? (
                    <div className="form-group photos-section">
                        <h2>
                            <FaCamera /> {t("visitDetails.form.photos.title")}{" "}
                            {formPhotosCount}
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
                                            <FaCamera /> {newPhotos.length}
                                        </div>
                                        {newPhotos.length > 0 && (
                                            <div className="thumbnail-preview">
                                                <img
                                                    src={URL.createObjectURL(
                                                        newPhotos[newPhotos.length - 1]
                                                    )}
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
                                                <FaCamera /> {t("visitDetails.actions.capturePhoto")}
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
                                                alt={
                                                    t("visitDetails.form.photos.existingAlt", {
                                                        index: index + 1,
                                                    }) || `Existing photo ${index + 1}`
                                                }
                                                className="photo-preview"
                                                onClick={() => handleImageClick(photo)}
                                            />
                                            <button
                                                type="button"
                                                className="remove-photo-btn"
                                                onClick={() => handleRemovePhoto(photo)}
                                                aria-label={
                                                    t("visitDetails.aria.removePhoto", {
                                                        index: index + 1,
                                                    }) || `Remove photo ${index + 1}`
                                                }
                                            >
                                                <FaTimes /> {t("visitDetails.actions.removePhoto")}
                                            </button>
                                        </div>
                                    ))}
                                {newPhotos.map((photo, index) => (
                                    <div key={`new-${index}`} className="photo-container">
                                        <img
                                            src={URL.createObjectURL(photo)}
                                            alt={
                                                t("visitDetails.form.photos.newAlt", {
                                                    index: index + 1,
                                                }) || `New photo ${index + 1}`
                                            }
                                            className="photo-preview"
                                            onClick={() =>
                                                setSelectedImage(URL.createObjectURL(photo))
                                            }
                                        />
                                        <button
                                            type="button"
                                            className="remove-photo-btn"
                                            onClick={() => removeNewPhoto(index)}
                                            aria-label={
                                                t("visitDetails.aria.removePhoto", {
                                                    index: index + 1,
                                                }) || `Remove new photo ${index + 1}`
                                            }
                                        >
                                            <FaTimes /> {t("visitDetails.actions.removePhoto")}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="form-group photos-section">
                        <h2>
                            <FaCamera /> {t("visitDetails.form.photos.title")} (0 photos)
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
                                            <FaCamera /> {newPhotos.length}
                                        </div>
                                        {newPhotos.length > 0 && (
                                            <div className="thumbnail-preview">
                                                <img
                                                    src={URL.createObjectURL(
                                                        newPhotos[newPhotos.length - 1]
                                                    )}
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
                                                <FaCamera /> {t("visitDetails.actions.capturePhoto")}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Comment Section */}
                {canEditField("comment") && (
                    <div className="form-group">
                        <label htmlFor="comment">
                            {t("visitDetails.form.comment.label")}
                        </label>
                        <textarea
                            id="comment"
                            value={editForm.comment}
                            onChange={(e) =>
                                setEditForm((prev) => ({
                                    ...prev,
                                    comment: e.target.value,
                                }))
                            }
                            placeholder={t("visitDetails.form.comment.placeholder")}
                            className="search-input"
                            aria-label={t("visitDetails.form.comment.ariaLabel")}
                        />
                    </div>
                )}

                {/* Form Actions */}
                <div className="form-actions">
                    <Button
                        type="submit"
                        disabled={
                            !userPermissions.canEditTimesheets ||
                            !editForm.date ||
                            !editForm.time ||
                            !editForm.delegationID ||
                            (userPermissions.canCreateTimesheetsForSupervisors &&
                                !selectedSupervisor)
                        }
                        aria-label={t("visitDetails.aria.saveChanges")}
                    >
                        {t("visitDetails.actions.save")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        aria-label={t("visitDetails.aria.cancelEdit")}
                    >
                        {t("visitDetails.actions.cancel")}
                    </Button>
                </div>
            </form>

            {/* Fullscreen Image Modal */}
            {selectedImage && (
                <div className="fullscreen-image-modal">
                    <div className="fullscreen-image-content">
                        <button
                            className="close-fullscreen-btn"
                            onClick={handleCloseFullscreen}
                            aria-label={t("visitDetails.aria.closeFullscreen")}
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

            {/* Hidden Canvas for Photo Capture */}
            <canvas ref={canvasRef} style={{ display: "none" }} />
        </>
    );
};

export default VisitEditForm;