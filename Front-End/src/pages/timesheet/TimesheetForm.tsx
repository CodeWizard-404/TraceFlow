// src/pages/timesheet/TimesheetForm.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import "./TimesheetForm.css";
import Agent from "../../models/Agent";
import { getAgentLocations, getAgentsByLocation } from "../../apis/agentAPI";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { createTimesheet } from "../../apis/timesheetAPI";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";

const TimesheetForm: React.FC = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState<string>("");
    const [time, setTime] = useState<string>("");
    const [locations, setLocations] = useState<string[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string>("");
    const [locationSearch, setLocationSearch] = useState<string>("");
    const [agents, setAgents] = useState<Agent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<string>("");
    const [agentSearch, setAgentSearch] = useState<string>("");
    const [reasons, setReasons] = useState<Reason[]>([]);
    const [selectedReasons, setSelectedReasons] = useState<Array<{ id?: string; text?: string }>>([]);
    const [reasonSearch, setReasonSearch] = useState<string>("");
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [selectedChecklists, setSelectedChecklists] = useState<Array<{ id?: string; text?: string }>>([]);
    const [checklistSearch, setChecklistSearch] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const supervisorID = "user_001";

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [locationsData, reasonsData, checklistsData] = await Promise.all([
                    getAgentLocations(),
                    getAllReasons(),
                    getAllChecklists(),
                ]);
                setLocations(locationsData);
                setReasons(reasonsData);
                setChecklists(checklistsData);
            } catch (err) {
                setError("Failed to load initial data");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedLocation) {
            const fetchAgents = async () => {
                try {
                    const agentsData = await getAgentsByLocation(selectedLocation);
                    setAgents(agentsData);
                } catch (err) {
                    setError(`Failed to load agents for ${selectedLocation}`);
                    console.error(err);
                }
            };
            fetchAgents();
        } else {
            setAgents([]);
            setSelectedAgent("");
        }
    }, [selectedLocation]);

    const getWeekNumber = (dateStr: string): number => {
        const date = new Date(dateStr);
        const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        utcDate.setUTCDate(utcDate.getUTCDate() + 4 - (utcDate.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
        const diffMs = utcDate.getTime() - yearStart.getTime();
        const dayMs = 24 * 60 * 60 * 1000;
        const weekNum = Math.ceil(((diffMs / dayMs) + 1) / 7);
        console.log(`getWeekNumber: dateStr=${dateStr}, utcDate=${utcDate}, yearStart=${yearStart}, weekNum=${weekNum}`);
        return weekNum;
    };

    const handleReasonSelect = (reason: string | Reason) => {
        if (typeof reason === "string") {
            if (reason.trim() && !selectedReasons.some((r) => r.text === reason)) {
                setSelectedReasons([...selectedReasons, { text: reason }]);
            }
        } else if (!selectedReasons.some((r) => r.id === reason.reasonID)) {
            setSelectedReasons([...selectedReasons, { id: reason.reasonID }]);
        }
        setReasonSearch("");
    };

    const handleChecklistSelect = (checklist: string | Checklist) => {
        if (typeof checklist === "string") {
            if (checklist.trim() && !selectedChecklists.some((c) => c.text === checklist)) {
                setSelectedChecklists([...selectedChecklists, { text: checklist }]);
            }
        } else if (!selectedChecklists.some((c) => c.id === checklist.checklistID)) {
            setSelectedChecklists([...selectedChecklists, { id: checklist.checklistID }]);
        }
        setChecklistSearch("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const year = new Date(date).getFullYear();
        const weekNumber = getWeekNumber(date);

        const timesheetData = {
            weekNumber,
            year,
            supervisorID,
            visits: [
                {
                    date,
                    time: `${time}:00`,
                    agentID: selectedAgent,
                    reasons: selectedReasons,
                    checklists: selectedChecklists,
                },
            ],
        };

        try {
            await createTimesheet(timesheetData);
            navigate("/timesheet");
        } catch (err) {
            setError("Failed to create timesheet");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const isFormComplete = date && time && selectedAgent && selectedReasons.length > 0 && selectedChecklists.length > 0;

    if (loading && !error) return <div className="loading">Loading...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div className="timesheet-form-container">
            <header className="form-header">
                <h1>Create Visit</h1>
            </header>
            <section className="form-card">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="date">Date</label>
                        <input
                            type="date"
                            id="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="time">Time</label>
                        <input
                            type="time"
                            id="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="location">Location</label>
                        <input
                            type="text"
                            placeholder="Search locations..."
                            value={locationSearch}
                            onChange={(e) => setLocationSearch(e.target.value)}
                            className="search-input"
                        />
                        <select
                            id="location"
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                            required
                            aria-label="Select a location"
                        >
                            <option value="">Select a location</option>
                            {locations
                                .filter((loc) => loc.toLowerCase().includes(locationSearch.toLowerCase()))
                                .map((loc) => (
                                    <option key={loc} value={loc}>
                                        {loc}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="agent">Agent</label>
                        <input
                            type="text"
                            placeholder="Search agents..."
                            value={agentSearch}
                            onChange={(e) => setAgentSearch(e.target.value)}
                            disabled={!selectedLocation}
                            className="search-input"
                        />
                        <select
                            id="agent"
                            value={selectedAgent}
                            onChange={(e) => setSelectedAgent(e.target.value)}
                            disabled={!selectedLocation}
                            required
                            aria-label="Select an agent"
                        >
                            <option value="">Select an agent</option>
                            {agents
                                .filter((agent) =>
                                    `${agent.name || ""} ${agent.lastname || ""}`
                                        .toLowerCase()
                                        .includes(agentSearch.toLowerCase())
                                )
                                .map((agent) => (
                                    <option key={agent.agentID} value={agent.agentID}>
                                        {agent.name} {agent.lastname}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Reasons</label>
                        <input
                            type="text"
                            placeholder="Search or type a custom reason"
                            value={reasonSearch}
                            onChange={(e) => setReasonSearch(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && handleReasonSelect(reasonSearch)}
                            className="search-input"
                        />
                        <select
                            value=""
                            onChange={(e) => {
                                const selectedReason = reasons.find((r) => r.reasonID === e.target.value);
                                if (selectedReason) handleReasonSelect(selectedReason);
                            }}
                            aria-label="Select a reason"
                        >
                            <option value="">Select a reason</option>
                            {reasons
                                .filter((reason) => reason.item.toLowerCase().includes(reasonSearch.toLowerCase()))
                                .map((reason) => (
                                    <option key={reason.reasonID} value={reason.reasonID}>
                                        {reason.item}
                                    </option>
                                ))}
                        </select>
                        <div className="selected-items">
                            {selectedReasons.map((reason, index) => (
                                <span
                                    key={index}
                                    className="selected-item"
                                    onClick={() =>
                                        setSelectedReasons(selectedReasons.filter((_, i) => i !== index))
                                    }
                                >
                                    {reason.text || reasons.find((r) => r.reasonID === reason.id)?.item} ×
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Checklists</label>
                        <input
                            type="text"
                            placeholder="Search or type a custom checklist"
                            value={checklistSearch}
                            onChange={(e) => setChecklistSearch(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && handleChecklistSelect(checklistSearch)}
                            className="search-input"
                        />
                        <select
                            value=""
                            onChange={(e) => {
                                const selectedChecklist = checklists.find((c) => c.checklistID === e.target.value);
                                if (selectedChecklist) handleChecklistSelect(selectedChecklist);
                            }}
                            aria-label="Select a checklist"
                        >
                            <option value="">Select a checklist</option>
                            {checklists
                                .filter((checklist) =>
                                    checklist.item.toLowerCase().includes(checklistSearch.toLowerCase())
                                )
                                .map((checklist) => (
                                    <option key={checklist.checklistID} value={checklist.checklistID}>
                                        {checklist.item}
                                    </option>
                                ))}
                        </select>
                        <div className="selected-items">
                            {selectedChecklists.map((checklist, index) => (
                                <span
                                    key={index}
                                    className="selected-item"
                                    onClick={() =>
                                        setSelectedChecklists(selectedChecklists.filter((_, i) => i !== index))
                                    }
                                >
                                    {checklist.text || checklists.find((c) => c.checklistID === checklist.id)?.item} ×
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="submit-btn" disabled={!isFormComplete || loading}>
                            {loading ? "Submitting..." : "Create Timesheet"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
};

export default TimesheetForm;