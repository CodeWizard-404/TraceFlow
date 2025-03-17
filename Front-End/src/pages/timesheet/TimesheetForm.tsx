/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { debounce } from "lodash";
import "./TimesheetForm.css";
import Agent from "../../models/Agent";
import {
  getAgentLocations,
  getAgentsByLocation,
  getAgentByPhone,
} from "../../apis/agentAPI";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { createTimesheet } from "../../apis/timesheetAPI";
import { getSupervisorByPhone, getAllUsers } from "../../apis/userAPI"; // Assuming getAllUsers can filter supervisors
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import { useAuth } from "../../context/AuthContext";
import User from "../../models/User";

const TimesheetForm: React.FC = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth(); // Get user and token from AuthContext
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [locationSearch, setLocationSearch] = useState<string>("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [agentSearch, setAgentSearch] = useState<string>("");
  const [agentPhone, setAgentPhone] = useState<string>("");
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [selectedReasons, setSelectedReasons] = useState<Array<{ id?: string }>>([]);
  const [reasonSearch, setReasonSearch] = useState<string>("");
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [selectedChecklists, setSelectedChecklists] = useState<Array<{ id?: string }>>([]);
  const [checklistSearch, setChecklistSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Supervisor-related states
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");
  const [supervisorPhone, setSupervisorPhone] = useState<string>("");
  const [supervisorSearch, setSupervisorSearch] = useState<string>("");

  // Check if user exists and has the required permission to access this form
  if (!user || !token || !user.roles?.some(role => role.permissions?.includes("create_timesheets"))) {
    navigate("/login");
    return null;
  }

  const canValidateTimesheets = user.roles?.some(role => role.permissions?.includes("validate_timesheets"));
  const supervisorID = canValidateTimesheets && selectedSupervisor ? selectedSupervisor : user.userID;

  // Fetch initial data (locations, reasons, checklists, and supervisors if applicable)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [locationsData, reasonsData, checklistsData, supervisorsData] = await Promise.all([
          getAgentLocations(),
          getAllReasons(),
          getAllChecklists(),
          canValidateTimesheets ? getAllUsers(token).then(users => users.filter(u => u.roles?.some(r => r.name === "Supervisor"))) : Promise.resolve([]), // Filter for supervisors
        ]);
        setLocations(locationsData);
        setReasons(reasonsData);
        setChecklists(checklistsData);
        if (canValidateTimesheets) {
          setSupervisors(supervisorsData);
        }
      } catch (err) {
        setError("Failed to load initial data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, canValidateTimesheets]);

  // Fetch agents by location
  useEffect(() => {
    if (selectedLocation && !agentPhone) {
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
    } else if (!selectedLocation && !agentPhone) {
      setAgents([]);
      setSelectedAgent("");
    }
  }, [selectedLocation, agentPhone]);

  // Debounced fetch agent by phone
  const fetchAgentByPhone = useCallback(
    debounce(async (phone: string) => {
      if (phone.length < 7) {
        setError(null);
        return;
      }
      try {
        const agentData = await getAgentByPhone(phone);
        setSelectedAgent(agentData.agentID);
        setSelectedLocation(agentData.location || "");
        setAgents([agentData]);
        setAgentSearch(`${agentData.name || ""} ${agentData.lastname || ""}`);
        setError(null);
      } catch (err) {
        setError("Agent not found with this phone number");
        setSelectedAgent("");
        setAgents([]);
        setSelectedLocation("");
        console.error(err);
      }
    }, 500),
    []
  );

  useEffect(() => {
    if (agentPhone) {
      fetchAgentByPhone(agentPhone);
    } else {
      setSelectedAgent("");
      setAgents([]);
      setSelectedLocation("");
      setAgentSearch("");
      setError(null);
    }
    return () => {
      fetchAgentByPhone.cancel();
    };
  }, [agentPhone, fetchAgentByPhone]);

  // Debounced fetch supervisor by phone
  const fetchSupervisorByPhone = useCallback(
    debounce(async (phone: string) => {
      if (phone.length < 7) {
        setError(null);
        return;
      }
      try {
        const supervisorData = await getSupervisorByPhone(phone, token);
        setSelectedSupervisor(supervisorData);
        setSupervisors([supervisorData.userID]);
        setSupervisorSearch(`${supervisorData.firstname || ""} ${supervisorData.lastname || ""}`);
        setError(null);
      } catch (err) {
        setError("Supervisor not found with this phone number");
        setSelectedSupervisor("");
        setSupervisors([]);
        console.error(err);
      }
    }, 500),
    [token]
  );

  useEffect(() => {
    if (supervisorPhone && canValidateTimesheets) {
      fetchSupervisorByPhone(supervisorPhone);
    } else if (canValidateTimesheets) {
      setSelectedSupervisor("");
      setSupervisorSearch("");
      setError(null);
    }
    return () => {
      fetchSupervisorByPhone.cancel();
    };
  }, [supervisorPhone, canValidateTimesheets, fetchSupervisorByPhone]);

  const getWeekNumber = (dateStr: string): number => {
    const date = new Date(dateStr);
    const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - (utcDate.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const diffMs = utcDate.getTime() - yearStart.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekNum = Math.ceil((diffMs / dayMs + 1) / 7);
    return weekNum;
  };

  const handleReasonSelect = (reason: Reason) => {
    if (!selectedReasons.some((r) => r.id === reason.reasonID)) {
      setSelectedReasons([...selectedReasons, { id: reason.reasonID }]);
    }
    setReasonSearch("");
  };

  const handleChecklistSelect = (checklist: Checklist) => {
    if (!selectedChecklists.some((c) => c.id === checklist.checklistID)) {
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
      await createTimesheet(timesheetData, token);
      navigate("/timesheet");
    } catch (err) {
      setError("Failed to create timesheet");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isFormComplete =
    date &&
    time &&
    selectedAgent &&
    selectedReasons.length > 0 &&
    selectedChecklists.length > 0 &&
    (!canValidateTimesheets || selectedSupervisor); // Require supervisor if user can validate

  if (loading && !error) return <div className="loading">Loading...</div>;

  return (
    <div className="timesheet-form-container">
      <header className="form-header">
        <h1>Create Visit</h1>
      </header>
      <section className="form-card">
        <form onSubmit={handleSubmit}>
          {canValidateTimesheets && (
            <div className="form-group">
              <label htmlFor="supervisor">Supervisor</label>
              <input
                type="text"
                placeholder="Search supervisors by name..."
                value={supervisorSearch}
                onChange={(e) => setSupervisorSearch(e.target.value)}
                className="search-input"
              />
              <input
                type="tel"
                placeholder="Or enter supervisor phone number..."
                value={supervisorPhone}
                onChange={(e) => setSupervisorPhone(e.target.value)}
                className="search-input"
              />
              <select
                id="supervisor"
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                required
                aria-label="Select a supervisor"
              >
                <option value="">Select a supervisor</option>
                {supervisors
                  .filter((supervisor) =>
                    `${supervisor.firstname || ""} ${supervisor.lastname || ""} ${supervisor.phone || ""}`
                      .toLowerCase()
                      .includes(supervisorSearch.toLowerCase())
                  )
                  .map((supervisor) => (
                    <option key={supervisor.userID} value={supervisor.userID}>
                      {supervisor.firstname} {supervisor.lastname} ({supervisor.phone})
                    </option>
                  ))}
              </select>
              {error && supervisorPhone && <span className="error-text">{error}</span>}
            </div>
          )}
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
            <label htmlFor="agentPhone">Agent Phone (Optional)</label>
            <input
              type="tel"
              id="agentPhone"
              placeholder="Enter agent's phone number"
              value={agentPhone}
              onChange={(e) => setAgentPhone(e.target.value)}
              className="search-input"
            />
            {error && agentPhone && <span className="error-text">{error}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              placeholder="Search locations..."
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              className="search-input"
              disabled={!!agentPhone}
            />
            <select
              id="location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              required
              aria-label="Select a location"
              disabled={!!agentPhone}
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
              disabled={!!agentPhone || !selectedLocation}
              className="search-input"
            />
            <select
              id="agent"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              disabled={!!agentPhone || !selectedLocation}
              required
              aria-label="Select an agent"
            >
              <option value="">Select an agent</option>
              {agents
                .filter((agent) =>
                  `${agent.name || ""} ${agent.lastname || ""} ${agent.phone || ""}`
                    .toLowerCase()
                    .includes(agentSearch.toLowerCase())
                )
                .map((agent) => (
                  <option key={agent.agentID} value={agent.agentID}>
                    {agent.name} {agent.lastname} {agent.phone}
                  </option>
                ))}
            </select>
          </div>
          <div className="form-group">
            <label>Reasons</label>
            <input
              type="text"
              placeholder="Search reasons..."
              value={reasonSearch}
              onChange={(e) => setReasonSearch(e.target.value)}
              className="search-input"
            />
            <select
              value=""
              onChange={(e) => {
                const reason = reasons.find((r) => r.reasonID === e.target.value);
                if (reason) handleReasonSelect(reason);
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
                  onClick={() => setSelectedReasons(selectedReasons.filter((_, i) => i !== index))}
                >
                  {reasons.find((r) => r.reasonID === reason.id)?.item} ×
                </span>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Checklists</label>
            <input
              type="text"
              placeholder="Search checklists..."
              value={checklistSearch}
              onChange={(e) => setChecklistSearch(e.target.value)}
              className="search-input"
            />
            <select
              value=""
              onChange={(e) => {
                const checklist = checklists.find((c) => c.checklistID === e.target.value);
                if (checklist) handleChecklistSelect(checklist);
              }}
              aria-label="Select a checklist"
            >
              <option value="">Select a checklist</option>
              {checklists
                .filter((checklist) => checklist.item.toLowerCase().includes(checklistSearch.toLowerCase()))
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
                  onClick={() => setSelectedChecklists(selectedChecklists.filter((_, i) => i !== index))}
                >
                  {checklists.find((c) => c.checklistID === checklist.id)?.item} ×
                </span>
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button
              type="submit"
              className="submit-btn"
              disabled={!isFormComplete || loading}
            >
              {loading ? "Submitting..." : "Create Timesheet"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default TimesheetForm;