import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FaTimes } from "react-icons/fa";
import { motion } from "framer-motion";
import Select, { MultiValue, SingleValue } from "react-select";
import { debounce } from "lodash";
import { suggestTimesheet, SuggestTimesheetResponse, cancelTimesheetSuggestion } from "../../apis/timesheetAPI";
import { useAuth } from "../../context/AuthContext";
import { getAgentsByUser } from "../../apis/agentAPI";
import { getDelegationsByUser, getRegionsByUser, getGovernoratesByRegion, getDelegationsByGovernorate } from "../../apis/locationApi";
import { getRegionalManagerBySupervisor } from "../../apis/userAPI";
import Agent from "../../models/Agent";
import Delegation from "../../models/Delegation";
import Region from "../../models/Region";
import Governorate from "../../models/Governorate";
import User from "../../models/User";
import "./TimesheetSuggestionsModal.css";

interface TimesheetSuggestionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    weekNumber: number;
    year: number;
    onSuggestionsGenerated: (suggestions: SuggestTimesheetResponse) => void;
}

interface SelectOption {
    value: string;
    label: string;
}

const TimesheetSuggestionsModal: React.FC<TimesheetSuggestionsModalProps> = ({
    isOpen,
    onClose,
    weekNumber,
    year,
    onSuggestionsGenerated,
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const supervisorID = user?.userID;

    // State for data
    const [agents, setAgents] = useState<Agent[]>([]);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [recruitmentDelegations, setRecruitmentDelegations] = useState<Delegation[]>([]);
    const [regionalManager, setRegionalManager] = useState<User | null>(null);

    // Loading states for skeleton UI
    const [isAgentsLoading, setIsAgentsLoading] = useState(false);
    const [isDelegationsLoading, setIsDelegationsLoading] = useState(false);
    const [isRegionsLoading, setIsRegionsLoading] = useState(false);
    const [isGovernoratesLoading, setIsGovernoratesLoading] = useState(false);
    const [isRecruitmentDelegationsLoading, setIsRecruitmentDelegationsLoading] = useState(false);

    // Form data
    const [formData, setFormData] = useState({
        delegationIds: [] as string[],
        agentIds: [] as string[],
        preferredDays: [] as string[],
        timeInterval: { startHour: 9, endHour: 17 },
        maxVisitsPerAgentPerWeek: 2,
        includeRecruitmentVisits: false,
        selectedRegion: "",
        selectedGovernorate: "",
        selectedRecruitmentDelegation: "",
        description: "",
        filters: {} as Record<string, any>,
    });

    // Other states
    const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }>({ lat: 36.8065, lng: 10.1815 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [requestId, setRequestId] = useState<string | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    // Refs to track fetch status and prevent duplicate calls
    const fetchedAgents = useRef(false);
    const fetchedDelegations = useRef(false);
    const fetchedRegions = useRef(false);
    const fetchedGovernorates = useRef(new Map<string, boolean>());
    const fetchedRecruitmentDelegations = useRef(new Map<string, boolean>());

    // Fetch regional manager for the supervisor
    const fetchRegionalManager = useCallback(async () => {
        if (!supervisorID || regionalManager) return;
        try {
            const rmList = await getRegionalManagerBySupervisor(supervisorID);
            setRegionalManager(rmList[0] || null); // Assume one regional manager
        } catch (err) {
            console.error("Error fetching regional manager:", err);
            setError(t("timesheets.suggestions.fetchError"));
        }
    }, [supervisorID, regionalManager, t]);

    // Fetch user location (debounced to prevent rapid calls)
    const fetchUserLocation = useCallback(
        debounce(() => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setCoordinates({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        });
                        setLocationError(null);
                    },
                    (err) => {
                        setLocationError(t("timesheets.suggestions.locationError"));
                        console.warn("Geolocation error:", err);
                    },
                    { timeout: 10000 }
                );
            } else {
                setLocationError(t("timesheets.suggestions.geolocationUnsupported"));
            }
        }, 500),
        [t]
    );

    // Fetch agents (only when dropdown is focused)
    const fetchAgents = useCallback(async () => {
        if (!supervisorID || fetchedAgents.current) return;
        setIsAgentsLoading(true);
        try {
            const agentsData = await getAgentsByUser(supervisorID);
            setAgents(agentsData.agents);
            fetchedAgents.current = true;
        } catch (err) {
            console.error("Error fetching agents:", err);
            setError(t("timesheets.suggestions.fetchError"));
        } finally {
            setIsAgentsLoading(false);
        }
    }, [supervisorID, t]);

    // Fetch delegations (only when dropdown is focused)
    const fetchDelegations = useCallback(async () => {
        if (!supervisorID || fetchedDelegations.current) return;
        setIsDelegationsLoading(true);
        try {
            const delegationsData = await getDelegationsByUser(supervisorID);
            setDelegations(delegationsData || []);
            fetchedDelegations.current = true;
        } catch (err) {
            console.error("Error fetching delegations:", err);
            setError(t("timesheets.suggestions.fetchError"));
        } finally {
            setIsDelegationsLoading(false);
        }
    }, [supervisorID, t]);

    // Fetch regions for regional manager (only when recruitment areas dropdown is focused)
    const fetchRegions = useCallback(async () => {
        if (!regionalManager?.userID || fetchedRegions.current) return;
        setIsRegionsLoading(true);
        try {
            const regionsData = await getRegionsByUser(regionalManager.userID);
            setRegions(regionsData);
            if (regionsData.length === 1) {
                setFormData(prev => ({ ...prev, selectedRegion: regionsData[0].regionID }));
            }
            fetchedRegions.current = true;
        } catch (err) {
            console.error("Error fetching regions:", err);
            setError(t("timesheets.suggestions.fetchError"));
        } finally {
            setIsRegionsLoading(false);
        }
    }, [regionalManager, t]);

    // Fetch governorates (only when region is selected and dropdown is focused)
    const fetchGovernorates = useCallback(async (regionId: string) => {
        if (!regionId || fetchedGovernorates.current.has(regionId)) return;
        setIsGovernoratesLoading(true);
        try {
            const govList = await getGovernoratesByRegion(regionId);
            setGovernorates(govList);
            if (govList.length === 1) {
                setFormData(prev => ({ ...prev, selectedGovernorate: govList[0].governorateID }));
            }
            fetchedGovernorates.current.set(regionId, true);
        } catch (err) {
            console.error("Error fetching governorates:", err);
            setError(t("timesheets.suggestions.fetchError"));
        } finally {
            setIsGovernoratesLoading(false);
        }
    }, [t]);

    // Fetch recruitment delegations (only when governorate is selected and dropdown is focused)
    const fetchRecruitmentDelegations = useCallback(async (governorateId: string) => {
        if (!governorateId || fetchedRecruitmentDelegations.current.has(governorateId)) return;
        setIsRecruitmentDelegationsLoading(true);
        try {
            const delList = await getDelegationsByGovernorate(governorateId);
            setRecruitmentDelegations(delList);
            if (delList.length === 1) {
                setFormData(prev => ({ ...prev, selectedRecruitmentDelegation: delList[0].delegationID }));
            }
            fetchedRecruitmentDelegations.current.set(governorateId, true);
        } catch (err) {
            console.error("Error fetching delegations:", err);
            setError(t("timesheets.suggestions.fetchError"));
        } finally {
            setIsRecruitmentDelegationsLoading(false);
        }
    }, [t]);

    // Initialize modal
    useEffect(() => {
        if (isOpen) {
            fetchRegionalManager();
            fetchUserLocation();
            setRequestId(null);
            setError(null);
            // Reset fetch status
            fetchedAgents.current = false;
            fetchedDelegations.current = false;
            fetchedRegions.current = false;
            fetchedGovernorates.current.clear();
            fetchedRecruitmentDelegations.current.clear();
        }
    }, [isOpen, fetchRegionalManager, fetchUserLocation]);

    // Handle input changes
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            ...(name === "startHour" || name === "endHour"
                ? {
                    timeInterval: {
                        ...prev.timeInterval,
                        [name]: parseInt(value) || 0,
                    },
                }
                : name === "maxVisitsPerAgentPerWeek"
                    ? { [name]: parseInt(value) || 1 }
                    : { [name]: value }),
        }));
    }, []);

    // Handle multi-select changes
    const handleSelectChange = useCallback(
        (selected: MultiValue<SelectOption>, field: "delegationIds" | "agentIds" | "preferredDays") => {
            setFormData(prev => ({
                ...prev,
                [field]: selected.map(option => option.value),
            }));
        },
        []
    );

    // Handle recruitment location changes
    const handleRecruitmentLocationChange = useCallback(
        (selected: SingleValue<SelectOption>, field: "selectedRegion" | "selectedGovernorate" | "selectedRecruitmentDelegation") => {
            const value = selected?.value || "";
            setFormData(prev => ({
                ...prev,
                [field]: value,
                ...(field === "selectedRegion" ? { selectedGovernorate: "", selectedRecruitmentDelegation: "" } : {}),
                ...(field === "selectedGovernorate" ? { selectedRecruitmentDelegation: "" } : {}),
            }));
            if (field === "selectedRegion" && value) {
                fetchGovernorates(value);
            } else if (field === "selectedGovernorate" && value) {
                fetchRecruitmentDelegations(value);
            }
        },
        [fetchGovernorates, fetchRecruitmentDelegations]
    );

    // Handle checkbox change
    const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            includeRecruitmentVisits: e.target.checked,
            selectedRegion: e.target.checked ? prev.selectedRegion : "",
            selectedGovernorate: e.target.checked ? prev.selectedGovernorate : "",
            selectedRecruitmentDelegation: e.target.checked ? prev.selectedRecruitmentDelegation : "",
        }));
    }, []);

    // Cancel suggestion
    const cancelSuggestion = useCallback(async () => {
        if (!requestId) return;
        setLoading(false);
        try {
            await cancelTimesheetSuggestion(requestId);
            setError(t("timesheets.suggestions.canceled"));
            setRequestId(null);
        } catch (err: any) {
            console.error("Error canceling suggestion:", err);
            setError(err.message || t("timesheets.suggestions.cancelError"));
        }
    }, [requestId, t]);

    // Generate suggestions
    const generateSuggestions = useCallback(async () => {
        if (!supervisorID) {
            setError(t("timesheets.suggestions.noSupervisor"));
            return;
        }
        if (formData.includeRecruitmentVisits && !formData.selectedRecruitmentDelegation) {
            setError(t("timesheets.suggestions.missingRecruitmentAreas"));
            return;
        }
        if (typeof coordinates.lat !== "number" || typeof coordinates.lng !== "number") {
            setError(t("timesheets.suggestions.invalidCoordinates"));
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const recruitmentAreas = formData.includeRecruitmentVisits
                ? [
                    regions.find(r => r.regionID === formData.selectedRegion)?.name ?? "",
                    governorates.find(g => g.governorateID === formData.selectedGovernorate)?.name ?? "",
                    recruitmentDelegations.find(d => d.delegationID === formData.selectedRecruitmentDelegation)?.name ?? "",
                ]
                    .filter(str => str !== "")
                    .join(", ") || ""
                : "";
            const { suggestions, requestId: newRequestId } = await suggestTimesheet({
                supervisorId: supervisorID,
                weekNumber,
                year,
                criteria: {
                    ...formData,
                    recruitmentAreas: recruitmentAreas ? [recruitmentAreas] : [],
                },
                coordinates,
            });
            setRequestId(newRequestId);
            onSuggestionsGenerated(suggestions);
            onClose();
        } catch (err: any) {
            console.error("Error generating suggestions:", err);
            setError(err.message || t("timesheets.suggestions.generateError"));
        } finally {
            setLoading(false);
        }
    }, [supervisorID, weekNumber, year, formData, coordinates, regions, governorates, recruitmentDelegations, t, onSuggestionsGenerated, onClose]);

    // Memoized select options
    const delegationOptions = useMemo(
        () => delegations.map(del => ({ value: del.delegationID, label: del.name })),
        [delegations]
    );
    const agentOptions = useMemo(
        () => agents.map(agent => ({ value: agent.agentID, label: `${agent.name} ${agent.lastname}` })),
        [agents]
    );
    const dayOptions = useMemo(
        () =>
            ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => ({
                value: day,
                label: t(`timesheets.days.${day}`),
            })),
        [t]
    );
    const regionOptions = useMemo(
        () => regions.map(r => ({ value: r.regionID, label: r.name })),
        [regions]
    );
    const governorateOptions = useMemo(
        () => governorates.map(g => ({ value: g.governorateID, label: g.name })),
        [governorates]
    );
    const recruitmentDelegationOptions = useMemo(
        () => recruitmentDelegations.map(d => ({ value: d.delegationID, label: d.name })),
        [recruitmentDelegations]
    );

    // Skeleton loader component
    const SkeletonSelect = () => (
        <div className="skeleton-select">
            <div className="skeleton-placeholder"></div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
        >
            <motion.div
                className="modal-content"
                initial={{ y: "-50%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                exit={{ y: "-50%", opacity: 0 }}
                transition={{ duration: 0.3 }}
            >
                <button
                    className="modal-close"
                    onClick={onClose}
                    aria-label={t("timesheets.suggestions.close")}
                >
                    <FaTimes />
                </button>
                <div className="modal-form">
                    <h2>{t("timesheets.suggestions.title")}</h2>
                    {error && <div className="error-message">{error}</div>}
                    {locationError && <div className="warning-message">{locationError}</div>}
                    <form onSubmit={e => { e.preventDefault(); generateSuggestions(); }}>
                        <div className="form-group">
                            <label>{t("timesheets.suggestions.delegationIds")}</label>
                            {isDelegationsLoading ? (
                                <SkeletonSelect />
                            ) : (
                                <Select
                                    isMulti
                                    options={delegationOptions}
                                    value={delegationOptions.filter(option => formData.delegationIds.includes(option.value))}
                                    onChange={(selected) => handleSelectChange(selected, "delegationIds")}
                                    onFocus={fetchDelegations}
                                    placeholder={t("timesheets.suggestions.selectDelegations")}
                                    classNamePrefix="react-select"
                                    isDisabled={loading}
                                />
                            )}
                        </div>
                        <div className="form-group">
                            <label>{t("timesheets.suggestions.agentIds")}</label>
                            {isAgentsLoading ? (
                                <SkeletonSelect />
                            ) : (
                                <Select
                                    isMulti
                                    options={agentOptions}
                                    value={agentOptions.filter(option => formData.agentIds.includes(option.value))}
                                    onChange={(selected) => handleSelectChange(selected, "agentIds")}
                                    onFocus={fetchAgents}
                                    placeholder={t("timesheets.suggestions.selectAgents")}
                                    classNamePrefix="react-select"
                                    isDisabled={loading}
                                />
                            )}
                        </div>
                        <div className="form-group">
                            <label>{t("timesheets.suggestions.preferredDays")}</label>
                            <Select
                                isMulti
                                options={dayOptions}
                                value={dayOptions.filter(option => formData.preferredDays.includes(option.value))}
                                onChange={(selected) => handleSelectChange(selected, "preferredDays")}
                                placeholder={t("timesheets.suggestions.selectDays")}
                                classNamePrefix="react-select"
                                isDisabled={loading}
                            />
                        </div>
                        <div className="form-group time-interval-group">
                            <label>{t("timesheets.suggestions.timeInterval")}</label>
                            <div className="input-pair">
                                <input
                                    type="number"
                                    name="startHour"
                                    value={formData.timeInterval.startHour}
                                    onChange={handleInputChange}
                                    placeholder="Start Hour (0-23)"
                                    min="0"
                                    max="23"
                                    disabled={loading}
                                    className="filter-input"
                                />
                                <input
                                    type="number"
                                    name="endHour"
                                    value={formData.timeInterval.endHour}
                                    onChange={handleInputChange}
                                    placeholder="End Hour (1-24)"
                                    min="1"
                                    max="24"
                                    disabled={loading}
                                    className="filter-input"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>{t("timesheets.suggestions.maxVisitsPerAgentPerWeek")}</label>
                            <input
                                type="number"
                                name="maxVisitsPerAgentPerWeek"
                                value={formData.maxVisitsPerAgentPerWeek}
                                onChange={handleInputChange}
                                placeholder="Max Visits"
                                min="1"
                                disabled={loading}
                                className="filter-input"
                            />
                        </div>
                        <div className="form-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={formData.includeRecruitmentVisits}
                                    onChange={handleCheckboxChange}
                                    disabled={loading}
                                />
                                {t("timesheets.suggestions.includeRecruitmentVisits")}
                            </label>
                        </div>
                        <div className={`form-group recruitment-areas ${formData.includeRecruitmentVisits ? "" : "hidden"}`}>
                            <label>{t("timesheets.suggestions.recruitmentAreas")}</label>
                            <div className="location-selects">
                                {isRegionsLoading ? (
                                    <SkeletonSelect />
                                ) : (
                                    <Select
                                        options={regionOptions}
                                        value={regionOptions.find(option => option.value === formData.selectedRegion) || null}
                                        onChange={(selected) => handleRecruitmentLocationChange(selected, "selectedRegion")}
                                        onFocus={fetchRegions}
                                        placeholder={t("timesheetForm.form.placeholders.regionSelect")}
                                        classNamePrefix="react-select"
                                        isDisabled={loading || !formData.includeRecruitmentVisits}
                                    />
                                )}
                                {isGovernoratesLoading ? (
                                    <SkeletonSelect />
                                ) : (
                                    <Select
                                        options={governorateOptions}
                                        value={governorateOptions.find(option => option.value === formData.selectedGovernorate) || null}
                                        onChange={(selected) => handleRecruitmentLocationChange(selected, "selectedGovernorate")}
                                        placeholder={t("timesheetForm.form.placeholders.governorateSelect")}
                                        classNamePrefix="react-select"
                                        isDisabled={loading || !formData.includeRecruitmentVisits || !formData.selectedRegion}
                                    />
                                )}
                                {isRecruitmentDelegationsLoading ? (
                                    <SkeletonSelect />
                                ) : (
                                    <Select
                                        options={recruitmentDelegationOptions}
                                        value={recruitmentDelegationOptions.find(option => option.value === formData.selectedRecruitmentDelegation) || null}
                                        onChange={(selected) => handleRecruitmentLocationChange(selected, "selectedRecruitmentDelegation")}
                                        placeholder={t("timesheetForm.form.placeholders.delegationSelect")}
                                        classNamePrefix="react-select"
                                        isDisabled={loading || !formData.includeRecruitmentVisits || !formData.selectedGovernorate}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="form-group">
                            <label>{t("timesheets.suggestions.description")}</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                placeholder={t("timesheets.suggestions.descriptionPlaceholder")}
                                disabled={loading}
                                className="filter-textarea"
                            />
                        </div>
                        <div className="form-buttons">
                            <button
                                type="submit"
                                disabled={loading}
                                className="create-btn"
                            >
                                {loading ? t("timesheets.suggestions.generating") : t("timesheets.suggestions.generate")}
                            </button>
                            {loading && requestId && (
                                <button
                                    type="button"
                                    onClick={cancelSuggestion}
                                    disabled={!loading}
                                    className="cancel-btn"
                                >
                                    {t("timesheets.suggestions.cancel")}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default TimesheetSuggestionsModal;