import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FaTimes } from "react-icons/fa";
import { motion } from "framer-motion";
import Select from "react-select";
import { suggestTimesheet, SuggestTimesheetResponse } from "../../apis/timesheetAPI";
import { useAuth } from "../../context/AuthContext";
import { getAgentsByUser } from "../../apis/agentAPI";
import { getGovernoratesByUser, getDelegationsByUser } from "../../apis/locationApi";
import Agent from "../../models/Agent";
import Delegation from "../../models/Delegation";
import Governorate from "../../models/Governorate";

import "../Timesheet/Timesheets.css";
import "./TimesheetSuggestionsModal.css";

interface TimesheetSuggestionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    weekNumber: number;
    year: number;
    onSuggestionsGenerated: (suggestions: SuggestTimesheetResponse) => void;
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

    // State
    const [agents, setAgents] = useState<Agent[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [formData, setFormData] = useState({
        governorateIds: [] as string[],
        delegationIds: [] as string[],
        agentIds: [] as string[],
        supervisorLocation: { latitude: 36.8065, longitude: 10.1815 },
        preferredDays: [] as string[],
        timeInterval: { startHour: 8, endHour: 20 },
        maxVisitsPerAgentPerWeek: 1,
        filters: {} as Record<string, any>,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch agents, governorates, and delegations
    const fetchData = useCallback(async () => {
        if (!supervisorID) return;
        try {
            const [agentsData, governoratesData, delegationsData] = await Promise.all([
                getAgentsByUser(supervisorID),
                getGovernoratesByUser(supervisorID),
                getDelegationsByUser(supervisorID),
            ]);
            setAgents(agentsData.agents);
            setGovernorates(governoratesData || []);
            setDelegations(delegationsData || []);
        } catch (err) {
            console.error("Error fetching data:", err);
            setError(t("timesheets.suggestions.fetchError"));
        }
    }, [supervisorID, t]);

    React.useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, fetchData]);

    // Form handlers
    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const { name, value } = e.target;
        if (name === "latitude" || name === "longitude") {
            setFormData(prev => ({
                ...prev,
                supervisorLocation: {
                    ...prev.supervisorLocation,
                    [name]: parseFloat(value) || 0,
                },
            }));
        } else if (name === "startHour" || name === "endHour") {
            setFormData(prev => ({
                ...prev,
                timeInterval: {
                    ...prev.timeInterval,
                    [name]: parseInt(value) || 0,
                },
            }));
        } else if (name === "maxVisitsPerAgentPerWeek") {
            setFormData(prev => ({
                ...prev,
                [name]: parseInt(value) || 1,
            }));
        }
    };

    const handleSelectChange = (
        selected: any,
        field: "governorateIds" | "delegationIds" | "agentIds" | "preferredDays"
    ) => {
        setFormData(prev => ({
            ...prev,
            [field]: selected ? selected.map((option: any) => option.value) : [],
        }));
    };

    // Generate suggestions
    const generateSuggestions = useCallback(async () => {
        if (!supervisorID) {
            setError(t("timesheets.suggestions.noSupervisor"));
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await suggestTimesheet({
                supervisorId: supervisorID,
                weekNumber,
                year,
                criteria: formData,
            });
            console.log("Suggestions Response:", JSON.stringify(response, null, 2));
            onSuggestionsGenerated(response);
            onClose();
        } catch (err: any) {
            console.error("Error generating suggestions:", err);
            setError(err.message || t("timesheets.suggestions.generateError"));
        } finally {
            setLoading(false);
        }
    }, [supervisorID, weekNumber, year, formData, t, onSuggestionsGenerated, onClose]);

    // Options for react-select
    const governorateOptions = useMemo(() =>
        governorates.map(gov => ({
            value: gov.governorateID,
            label: gov.name,
        })), [governorates]);

    const delegationOptions = useMemo(() =>
        delegations.map(del => ({
            value: del.delegationID,
            label: del.name,
        })), [delegations]);

    const agentOptions = useMemo(() =>
        agents.map(agent => ({
            value: agent.agentID,
            label: `${agent.name} ${agent.lastname}`,
        })), [agents]);

    const dayOptions = useMemo(() =>
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(day => ({
            value: day,
            label: t(`timesheets.days.${day}`),
        })), [t]);

    if (!isOpen) return null;

    return (
        <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="modal-content"
                initial={{ y: "-50%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                exit={{ y: "-50%", opacity: 0 }}
            >
                <button className="modal-close" onClick={onClose} aria-label={t("timesheets.suggestions.close")}>
                    <FaTimes />
                </button>
                <div className="modal-form">
                    <h2>{t("timesheets.suggestions.title")}</h2>
                    <form onSubmit={e => { e.preventDefault(); generateSuggestions(); }}>
                        <div className="form-group">
                            <label>{t("timesheets.suggestions.governorateIds")}</label>
                            <Select
                                isMulti
                                options={governorateOptions}
                                value={governorateOptions.filter(option => formData.governorateIds.includes(option.value))}
                                onChange={(selected) => handleSelectChange(selected, "governorateIds")}
                                placeholder={t("timesheets.suggestions.selectGovernorates")}
                                classNamePrefix="react-select"
                            />
                        </div>
                        <div className="form-group">
                            <label>{t("timesheets.suggestions.delegationIds")}</label>
                            <Select
                                isMulti
                                options={delegationOptions}
                                value={delegationOptions.filter(option => formData.delegationIds.includes(option.value))}
                                onChange={(selected) => handleSelectChange(selected, "delegationIds")}
                                placeholder={t("timesheets.suggestions.selectDelegations")}
                                classNamePrefix="react-select"
                            />
                        </div>
                        <div className="form-group">
                            <label>{t("timesheets.suggestions.agentIds")}</label>
                            <Select
                                isMulti
                                options={agentOptions}
                                value={agentOptions.filter(option => formData.agentIds.includes(option.value))}
                                onChange={(selected) => handleSelectChange(selected, "agentIds")}
                                placeholder={t("timesheets.suggestions.selectAgents")}
                                classNamePrefix="react-select"
                            />
                        </div>
                        <div className="form-group">
                            <label>{t("timesheets.suggestions.supervisorLocation")}</label>
                            <input
                                type="number"
                                name="latitude"
                                value={formData.supervisorLocation.latitude}
                                onChange={handleInputChange}
                                placeholder="Latitude"
                                step="any"
                            />
                            <input
                                type="number"
                                name="longitude"
                                value={formData.supervisorLocation.longitude}
                                onChange={handleInputChange}
                                placeholder="Longitude"
                                step="any"
                            />
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
                            />
                        </div>
                        <div className="form-group">
                            <label>{t("timesheets.suggestions.timeInterval")}</label>
                            <input
                                type="number"
                                name="startHour"
                                value={formData.timeInterval.startHour}
                                onChange={handleInputChange}
                                placeholder="Start Hour (0-23)"
                                min="0"
                                max="23"
                            />
                            <input
                                type="number"
                                name="endHour"
                                value={formData.timeInterval.endHour}
                                onChange={handleInputChange}
                                placeholder="End Hour (1-24)"
                                min="1"
                                max="24"
                            />
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
                            />
                        </div>
                        {error && <p className="error">{error}</p>}
                        <button type="submit" disabled={loading}>
                            {loading ? t("timesheets.suggestions.generating") : t("timesheets.suggestions.generate")}
                        </button>
                    </form>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default TimesheetSuggestionsModal;
