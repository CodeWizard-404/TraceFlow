/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { getUserByPhone, getSupervisorsByUser } from "../../apis/userAPI";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import User from "../../models/User";
import { useAuth } from "../../context/AuthContext";
import { useError } from "../../context/ErrorContext";

const PERMISSIONS = {
  CREATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS,
  CREATE_TIMESHEETS_FOR_SUPERVISOR: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR,
  READ_AGENTS_BY_LOCATION: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_LOCATION,
  READ_AGENTS_BY_PHONE: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_PHONE,
  READ_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
  READ_REASON_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS,
  READ_CHECKLISTS_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS,
};

// Main Component
const TimesheetForm: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, effectivePermissions, permissionsLoaded } = useAuth();
  const { setError } = useError();

  // State
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
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");
  const [supervisorPhone, setSupervisorPhone] = useState<string>("");
  const [supervisorSearch, setSupervisorSearch] = useState<string>("");

  // Current date/time setup
  const currentDateTime = new Date(Date.now());
  const currentDate = currentDateTime.toISOString().split('T')[0];
  const currentHours = currentDateTime.getHours().toString().padStart(2, '0');
  const currentMinutes = currentDateTime.getMinutes().toString().padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;

  // Permission Checks
  const userPermissions = useMemo(() => ({
    canCreateTimesheets: effectivePermissions?.some(p => p.name === PERMISSIONS.CREATE_TIMESHEETS),
    canCreateTimesheetsForSupervisors: effectivePermissions?.some(p => p.name === PERMISSIONS.CREATE_TIMESHEETS_FOR_SUPERVISOR),
    canReadAgentsByLocation: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_AGENTS_BY_LOCATION),
    canReadAgentsByPhone: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_AGENTS_BY_PHONE),
    canReadSupervisors: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_SUPERVISORS),
    canReadReasons: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_REASON_ITEMS),
    canReadChecklists: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_CHECKLISTS_ITEMS),
  }), [effectivePermissions]);

  if (!permissionsLoaded) return <div className="loading">Loading permissions...</div>;
  if (!user || !token) return null;

  const supervisorID = userPermissions.canReadSupervisors && selectedSupervisor ? selectedSupervisor : user.userID;

  // Date/Time Validation Functions
  const isWeekend = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    const day = date.getDay();
    return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
  };

  const isValidTime = (timeStr: string, dateStr: string): boolean => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (hours < 8 || (hours >= 16 && minutes > 30)) {
      return false;
    }
    if (dateStr === currentDate) {
      const [currentH, currentM] = currentTime.split(':').map(Number);
      if (hours < currentH || (hours === currentH && minutes < currentM)) {
        return false;
      }
    }
    return true;
  };

  // Fetch Initial Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const promises = [
          userPermissions.canReadAgentsByLocation ? getAgentLocations(token) : Promise.resolve([]),
          userPermissions.canReadReasons ? getAllReasons(token) : Promise.resolve([]),
          userPermissions.canReadChecklists ? getAllChecklists(token) : Promise.resolve([]),
          userPermissions.canReadSupervisors ? getSupervisorsByUser(user.userID, token) : Promise.resolve([]),
        ];
        const [locationsData, reasonsData, checklistsData, supervisorsData] = await Promise.all(promises);

        setLocations(locationsData as string[]);
        setReasons(reasonsData as Reason[]);
        setChecklists(checklistsData as Checklist[]);
        if (userPermissions.canCreateTimesheetsForSupervisors && userPermissions.canReadSupervisors) {
          setSupervisors(supervisorsData as User[]);
        }
      } catch (err) {
        setError("Failed to load initial data. Please try again.");
        console.error("Fetch initial data error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, userPermissions, user.userID, setError]);

  // Fetch Agents by Location
  useEffect(() => {
    if (selectedLocation && !agentPhone && userPermissions.canReadAgentsByLocation) {
      const fetchAgents = async () => {
        try {
          const agentsData = await getAgentsByLocation(selectedLocation, token);
          setAgents(agentsData);
        } catch (err) {
          setError(`Failed to load agents for ${selectedLocation}`);
          console.error("Fetch agents by location error:", err);
        }
      };
      fetchAgents();
    } else if (!selectedLocation && !agentPhone) {
      setAgents([]);
      setSelectedAgent("");
    }
  }, [selectedLocation, agentPhone, userPermissions.canReadAgentsByLocation, token, setError]);

  // Debounced Fetch Agent by Phone
  const fetchAgentByPhone = useCallback(
    debounce(async (phone: string) => {
      if (phone.length < 7 || !userPermissions.canReadAgentsByPhone) return;
      try {
        const agentData = await getAgentByPhone(phone, token);
        setSelectedAgent(agentData.agentID);
        setSelectedLocation(agentData.location || "");
        setAgents([agentData]);
        setAgentSearch(`${agentData.name || ""} ${agentData.lastname || ""}`);
      } catch (err) {
        setError("Agent not found with this phone number");
        setSelectedAgent("");
        setAgents([]);
        setSelectedLocation("");
        console.error("Fetch agent by phone error:", err);
      }
    }, 500),
    [userPermissions.canReadAgentsByPhone, token, setError]
  );

  useEffect(() => {
    if (agentPhone) fetchAgentByPhone(agentPhone);
    else {
      setSelectedAgent("");
      setAgents([]);
      setSelectedLocation("");
      setAgentSearch("");
    }
    return () => fetchAgentByPhone.cancel();
  }, [agentPhone, fetchAgentByPhone]);

  // Debounced Fetch Supervisor by Phone
  const fetchSupervisorByPhone = useCallback(
    debounce(async (phone: string) => {
      if (phone.length < 7 || !userPermissions.canReadSupervisors || !userPermissions.canCreateTimesheetsForSupervisors) return;
      try {
        const supervisor = await getUserByPhone(phone, token);
        setSelectedSupervisor(supervisor.userID);
        setSupervisors(prev => prev.some(s => s.userID === supervisor.userID) ? prev : [...prev, supervisor]);
        setSupervisorSearch(`${supervisor.firstname || ""} ${supervisor.lastname || ""}`);
      } catch (err) {
        setError("Supervisor not found with this phone number");
        setSelectedSupervisor("");
        console.error("Fetch supervisor by phone error:", err);
      }
    }, 500),
    [token, supervisors, userPermissions.canReadSupervisors, userPermissions.canCreateTimesheetsForSupervisors, setError]
  );

  useEffect(() => {
    if (supervisorPhone && userPermissions.canCreateTimesheetsForSupervisors && userPermissions.canReadSupervisors) {
      fetchSupervisorByPhone(supervisorPhone);
    } else if (userPermissions.canCreateTimesheetsForSupervisors) {
      setSelectedSupervisor("");
      setSupervisorSearch("");
    }
    return () => fetchSupervisorByPhone.cancel();
  }, [supervisorPhone, userPermissions.canCreateTimesheetsForSupervisors, userPermissions.canReadSupervisors, fetchSupervisorByPhone]);

  // Utility Functions
  const getWeekNumber = (dateStr: string): number => {
    const date = new Date(dateStr);
    const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - (utcDate.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    return Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  // Handlers
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value;
    if (selectedDate >= currentDate && !isWeekend(selectedDate)) {
      setDate(selectedDate);
      if (time && !isValidTime(time, selectedDate)) {
        setTime('');
      }
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedTime = e.target.value;
    if (date && isValidTime(selectedTime, date)) {
      setTime(selectedTime);
    }
  };

  const handleReasonSelect = (reason: Reason) => {
    if (!selectedReasons.some(r => r.id === reason.reasonID)) {
      setSelectedReasons([...selectedReasons, { id: reason.reasonID }]);
    }
    setReasonSearch("");
  };

  const handleChecklistSelect = (checklist: Checklist) => {
    if (!selectedChecklists.some(c => c.id === checklist.checklistID)) {
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
      visits: [{
        date,
        time: `${time}:00`,
        agentID: selectedAgent,
        reasons: selectedReasons,
        checklists: selectedChecklists,
      }],
      status: userPermissions.canCreateTimesheetsForSupervisors ? "validated" : "pending",
    };

    try {
      await createTimesheet(timesheetData, token);
      navigate("/timesheet");
    } catch (err) {
      setError("Failed to create timesheet. Please try again.");
      console.error("Submit error:", err);
    } finally {
      setLoading(false);
    }
  };

  const isFormComplete = useMemo(() => (
    date &&
    time &&
    selectedAgent &&
    selectedReasons.length > 0 &&
    selectedChecklists.length > 0 &&
    (!userPermissions.canCreateTimesheetsForSupervisors || selectedSupervisor)
  ), [date, time, selectedAgent, selectedReasons, selectedChecklists, userPermissions.canCreateTimesheetsForSupervisors, selectedSupervisor]);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="timesheet-form-container">
      <header className="form-header">
        <h1>Create Visit</h1>
      </header>
      <section className="form-card">
        <form onSubmit={handleSubmit}>
          {userPermissions.canCreateTimesheetsForSupervisors && userPermissions.canReadSupervisors && (
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
                  .filter((s) =>
                    `${s.firstname || ""} ${s.lastname || ""} ${s.phone || ""}`
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

          <div className="form-group">
            <label htmlFor="date">Date</label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={handleDateChange}
              min={currentDate}
              onInvalid={(e) => e.preventDefault()} // Prevents browser default validation popup
              required
            />
            {/* Add custom style to visually disable weekends */}
            <style>{`
              input[type="date"]::-webkit-calendar-picker-indicator {
                filter: opacity(1);
              }
              input[type="date"] {
                position: relative;
              }
            `}</style>
          </div>

          <div className="form-group">
            <label htmlFor="time">Time</label>
            <input
              type="time"
              id="time"
              value={time}
              onChange={handleTimeChange}
              min={date === currentDate ? currentTime : "08:00"}
              max="17:00"
              step="300"
              required
              disabled={!date} // Disable time until date is selected
            />
          </div>

          <div className="form-group">
            <label htmlFor="agentPhone">Agent Phone (Optional)</label>
            <input
              type="tel"
              id="agentPhone"
              placeholder={userPermissions.canReadAgentsByPhone ? "Enter agent's phone number" : "Permission denied"}
              value={agentPhone}
              onChange={(e) => setAgentPhone(e.target.value)}
              className="search-input"
              disabled={!userPermissions.canReadAgentsByPhone}
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              placeholder={userPermissions.canReadAgentsByLocation ? "Search locations..." : "Permission denied"}
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              className="search-input"
              disabled={!!agentPhone || !userPermissions.canReadAgentsByLocation}
            />
            <select
              id="location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              required
              aria-label="Select a location"
              disabled={!!agentPhone || !userPermissions.canReadAgentsByLocation}
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
              placeholder={userPermissions.canReadAgentsByLocation ? "Search agents..." : "Permission denied"}
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              disabled={!!agentPhone || !selectedLocation || !userPermissions.canReadAgentsByLocation}
              className="search-input"
            />
            <select
              id="agent"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              disabled={!!agentPhone || !selectedLocation || !userPermissions.canReadAgentsByLocation}
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
                    {agent.name} {agent.lastname} ({agent.phone})
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label>Reasons</label>
            <input
              type="text"
              placeholder={userPermissions.canReadReasons ? "Search reasons..." : "Permission denied"}
              value={reasonSearch}
              onChange={(e) => setReasonSearch(e.target.value)}
              className="search-input"
              disabled={!userPermissions.canReadReasons}
            />
            <select
              value=""
              onChange={(e) => {
                const reason = reasons.find((r) => r.reasonID === e.target.value);
                if (reason) handleReasonSelect(reason);
              }}
              aria-label="Select a reason"
              disabled={!userPermissions.canReadReasons}
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
              placeholder={userPermissions.canReadChecklists ? "Search checklists..." : "Permission denied"}
              value={checklistSearch}
              onChange={(e) => setChecklistSearch(e.target.value)}
              className="search-input"
              disabled={!userPermissions.canReadChecklists}
            />
            <select
              value=""
              onChange={(e) => {
                const checklist = checklists.find((c) => c.checklistID === e.target.value);
                if (checklist) handleChecklistSelect(checklist);
              }}
              aria-label="Select a checklist"
              disabled={!userPermissions.canReadChecklists}
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
            <button type="button" className="submit-btn" onClick={() => navigate(-1)}>Back</button>
            <button
              type="submit"
              className="submit-btn"
              disabled={
                !isFormComplete ||
                loading ||
                !(userPermissions.canCreateTimesheets || userPermissions.canCreateTimesheetsForSupervisors)
              }
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