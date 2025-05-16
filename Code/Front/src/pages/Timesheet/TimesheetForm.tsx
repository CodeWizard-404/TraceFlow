/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { debounce } from "lodash";
import { toast } from "react-toastify";
import "./TimesheetForm.css";
import Agent from "../../models/Agent";
import User from "../../models/User";
import Region from "../../models/Region";
import Governorate from "../../models/Governorate";
import Delegation from "../../models/Delegation";
import {
  getAgentByPhone,
  getAgentsByUser,
  getAgentById,
  getAgentsByDelegation,
} from "../../apis/agentAPI";
import {
  getSupervisorsByRegionalManager,
  getRegionalManagerBySupervisor,
  getUsersByRegion,
  getUsersByGovernorate,
  getUsersByDelegation,
  getUsersByRole,
} from "../../apis/userAPI";
import {
  getGovernoratesByUser,
  getDelegationsByUser,
  getRegionsByUser,
  getAllRegions,
  getGovernoratesByRegion,
  getDelegationsByGovernorate,
} from "../../apis/locationApi";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { createTimesheet } from "../../apis/timesheetAPI";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import { useAuth } from "../../context/AuthContext";
import { useError } from "../../context/ErrorContext";
import { useTranslation } from "react-i18next";

// Define roles and permissions from environment variables
const ROLES = {
  SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
  SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
  REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
  DIRECTOR: import.meta.env.VITE_ROLES_DIRECTOR,
};

const PERMISSIONS = {
  CREATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS,
  CREATE_TIMESHEETS_FOR_SUPERVISOR: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR,
  READ_AGENTS_BY_LOCATION: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_LOCATION,
  READ_AGENTS_BY_PHONE: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_PHONE,
  READ_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
  READ_REASON_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS,
  READ_CHECKLISTS_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS,
  VALIDATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_VALIDATE_TIMESHEETS,
};

/**
 * TimesheetForm Component
 * A form for creating timesheet entries with dynamic inputs based on user roles and permissions.
 */
const TimesheetForm: React.FC = () => {
  const navigate = useNavigate();
  const { user, effectivePermissions, permissionsLoaded, userRoles } = useAuth();
  const { setError } = useError();
  const { t } = useTranslation();

  // State Declarations
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [regionalManagers, setRegionalManagers] = useState<User[]>([]);
  const [selectedRegionalManager, setSelectedRegionalManager] = useState<string>("");
  const [regionalManagerSearch, setRegionalManagerSearch] = useState<string>("");
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");
  const [supervisorSearch, setSupervisorSearch] = useState<string>("");
  const [supervisorPhone, setSupervisorPhone] = useState<string>("");
  const [agentPhone, setAgentPhone] = useState<string>("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("");
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [selectedDelegation, setSelectedDelegation] = useState<string>("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [selectedReasons, setSelectedReasons] = useState<Array<{ id?: string }>>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [selectedChecklists, setSelectedChecklists] = useState<Array<{ id?: string }>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [agentLoading, setAgentLoading] = useState<boolean>(false);

  // Current date and time for input validation
  const currentDate = new Date().toISOString().split("T")[0];
  const currentTime = new Date().toTimeString().slice(0, 5);
  const minTime = date === currentDate ? currentTime : undefined;

  // Role Checks
  const isSuperAdmin = useMemo(() => userRoles?.some((role) => role.name === ROLES.SUPER_ADMIN), [userRoles]);
  const isDirector = useMemo(() => userRoles?.some((role) => role.name === ROLES.DIRECTOR), [userRoles]);
  const isRegionalManager = useMemo(() => userRoles?.some((role) => role.name === ROLES.REGIONAL_MANAGER), [userRoles]);
  const isSupervisor = useMemo(() => userRoles?.some((role) => role.name === ROLES.SUPERVISOR), [userRoles]);

  // Permission Checks
  const userPermissions = useMemo(() => ({
    canCreateTimesheets: effectivePermissions?.some((p) => p.name === PERMISSIONS.CREATE_TIMESHEETS),
    canCreateTimesheetsForSupervisors: effectivePermissions?.some((p) => p.name === PERMISSIONS.CREATE_TIMESHEETS_FOR_SUPERVISOR),
    canReadAgentsByLocation: effectivePermissions?.some((p) => p.name === PERMISSIONS.READ_AGENTS_BY_LOCATION),
    canReadAgentsByPhone: effectivePermissions?.some((p) => p.name === PERMISSIONS.READ_AGENTS_BY_PHONE),
    canReadSupervisors: effectivePermissions?.some((p) => p.name === PERMISSIONS.READ_SUPERVISORS),
    canReadReasons: effectivePermissions?.some((p) => p.name === PERMISSIONS.READ_REASON_ITEMS),
    canReadChecklists: effectivePermissions?.some((p) => p.name === PERMISSIONS.READ_CHECKLISTS_ITEMS),
    canValidateTimesheets: effectivePermissions?.some((p) => p.name === PERMISSIONS.VALIDATE_TIMESHEETS),
  }), [effectivePermissions]);

  // Form Completion Check
  const isFormComplete = useMemo(() =>
    date && time && selectedAgent && selectedReasons.length > 0 && selectedChecklists.length > 0 && (isSupervisor || selectedSupervisor),
    [date, time, selectedAgent, selectedReasons, selectedChecklists, isSupervisor, selectedSupervisor]
  );

  // Handlers for form input changes
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value);
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => setTime(e.target.value);
  const handleRegionalManagerChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedRegionalManager(e.target.value);
  const handleSupervisorChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSupervisor(e.target.value);
  const handleSupervisorPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => setSupervisorPhone(e.target.value);
  const handleAgentPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => setAgentPhone(e.target.value);
  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedRegion(e.target.value);
  const handleGovernorateChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedGovernorate(e.target.value);
  const handleDelegationChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedDelegation(e.target.value);
  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedAgent(e.target.value);
  const handleReasonSelect = (reason: Reason) => {
    if (!selectedReasons.some((r) => r.id === reason.reasonID)) {
      setSelectedReasons([...selectedReasons, { id: reason.reasonID }]);
    }
  };
  const handleChecklistSelect = (checklist: Checklist) => {
    if (!selectedChecklists.some((c) => c.id === checklist.checklistID)) {
      setSelectedChecklists([...selectedChecklists, { id: checklist.checklistID }]);
    }
  };

  // Utility function to calculate week number from date
  const getWeekNumber = (dateStr: string): number => {
    const date = new Date(dateStr);
    const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - (utcDate.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    return Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  // Debounced fetch for agent by phone
  const fetchAgentByPhone = useCallback(
    debounce(async (phone: string) => {
      if (phone.length !== 8) return;
      setAgentLoading(true);
      try {
        const agent = await getAgentByPhone(phone);
        setAgents([agent!]);
        setSelectedAgent(agent!.agentID);
      } catch (err) {
        setError(t("timesheetForm.errors.agentNotFound"));
        setAgents([]);
        setSelectedAgent("");
      } finally {
        setAgentLoading(false);
      }
    }, 500),
    [setError, t]
  );

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormComplete) {
      setError(t("timesheetForm.errors.formIncomplete"));
      return;
    }
    setLoading(true);
    const year = new Date(date).getFullYear();
    const weekNumber = getWeekNumber(date);
    const timesheetData = {
      weekNumber,
      year,
      supervisorID: isSupervisor ? user!.userID : selectedSupervisor,
      visits: [{
        date,
        time: `${time}:00`,
        agentID: selectedAgent,
        reasons: selectedReasons,
        checklists: selectedChecklists,
        status: userPermissions.canValidateTimesheets ? "validated" : (userPermissions.canCreateTimesheetsForSupervisors ? "validated" : "pending"),
      }],
    };
    try {
      await createTimesheet(timesheetData);
      toast.success(t("timesheetForm.success.created"));
      navigate("/timesheet");
    } catch (err) {
      setError(t("timesheetForm.errors.createFailed"));
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial data (regions, reasons, checklists)
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [regionsData, reasonsData, checklistsData] = await Promise.all([
          getAllRegions(),
          getAllReasons(),
          getAllChecklists(),
        ]);
        setRegions(regionsData);
        setReasons(reasonsData);
        setChecklists(checklistsData);
        // Automatically select if only one reason is available
        if (reasonsData.length === 1) {
          setSelectedReasons([{ id: reasonsData[0].reasonID }]);
        }
        // Automatically select if only one checklist is available
        if (checklistsData.length === 1) {
          setSelectedChecklists([{ id: checklistsData[0].checklistID }]);
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadInitialData"));
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [setError, t]);

  // Fetch regional managers based on role and filters
  useEffect(() => {
    const fetchRegionalManagers = async () => {
      if (!(isSuperAdmin || isDirector)) return;
      let rmList: User[] = [];
      try {
        if (selectedSupervisor && selectedRegion) {
          const [supervisorRM, regionRM] = await Promise.all([
            getRegionalManagerBySupervisor(selectedSupervisor),
            getUsersByRegion(selectedRegion).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.REGIONAL_MANAGER))),
          ]);
          rmList = supervisorRM.filter(rm => regionRM.some(rrm => rrm.userID === rm.userID));
        } else if (selectedSupervisor) {
          rmList = await getRegionalManagerBySupervisor(selectedSupervisor);
        } else if (selectedRegion) {
          rmList = await getUsersByRegion(selectedRegion).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.REGIONAL_MANAGER)));
        } else {
          rmList = await getUsersByRole(ROLES.REGIONAL_MANAGER);
        }
        if (regionalManagerSearch) {
          rmList = rmList.filter(rm => `${rm.firstname} ${rm.lastname} ${rm.phone}`.toLowerCase().includes(regionalManagerSearch.toLowerCase()));
        }
        setRegionalManagers(rmList);
        // Automatically select if only one regional manager is available
        if (rmList.length === 1) {
          setSelectedRegionalManager(rmList[0].userID);
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadRegionalManagers"));
      }
    };
    fetchRegionalManagers();
  }, [isSuperAdmin, isDirector, selectedSupervisor, selectedRegion, regionalManagerSearch, setError, t]);

  // Fetch supervisors based on role and filters
  useEffect(() => {
    const fetchSupervisors = async () => {
      if (!(isSuperAdmin || isDirector || isRegionalManager)) return;
      let supList: User[] = [];
      try {
        if (selectedRegionalManager || selectedGovernorate || selectedDelegation || selectedAgent) {
          const promises: Promise<User[]>[] = [];
          if (selectedRegionalManager) promises.push(getSupervisorsByRegionalManager(selectedRegionalManager));
          if (selectedGovernorate) promises.push(getUsersByGovernorate(selectedGovernorate).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.SUPERVISOR))));
          if (selectedDelegation) promises.push(getUsersByDelegation(selectedDelegation).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.SUPERVISOR))));
          if (selectedAgent) promises.push(getAgentById(selectedAgent).then(agent => getUsersByRole(ROLES.SUPERVISOR).then(users => users.filter(u => u.userID === agent?.supervisorID))));
          const results = await Promise.all(promises);
          supList = results.reduce((acc, curr) => acc.filter(a => curr.some(c => c.userID === a.userID)), results[0] || []);
        } else {
          supList = await getUsersByRole(ROLES.SUPERVISOR);
        }
        if (supervisorSearch) {
          supList = supList.filter(s => `${s.firstname} ${s.lastname}`.toLowerCase().includes(supervisorSearch.toLowerCase()));
        }
        if (supervisorPhone && supervisorPhone.length === 8) {
          supList = supList.filter(s => s.phone === supervisorPhone);
        }
        setSupervisors(supList);
        // Automatically select if only one supervisor is available
        if (supList.length === 1) {
          setSelectedSupervisor(supList[0].userID);
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadSupervisors"));
      }
    };
    fetchSupervisors();
  }, [isSuperAdmin, isDirector, isRegionalManager, selectedRegionalManager, selectedGovernorate, selectedDelegation, selectedAgent, supervisorSearch, supervisorPhone, setError, t]);

  // Fetch regions based on selected regional manager
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const regionsData = selectedRegionalManager ? await getRegionsByUser(selectedRegionalManager) : await getAllRegions();
        setRegions(regionsData);
        // Automatically select if only one region is available
        if (regionsData.length === 1) {
          setSelectedRegion(regionsData[0].regionID);
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadRegions"));
      }
    };
    fetchRegions();
  }, [selectedRegionalManager, setError, t]);

  // Fetch governorates based on selected region or supervisor
  useEffect(() => {
    const fetchGovernorates = async () => {
      if (!(selectedRegion || selectedSupervisor)) {
        setGovernorates([]);
        return;
      }
      try {
        let govList: Governorate[] = [];
        if (selectedRegion && selectedSupervisor) {
          const [regionGovs, userGovs] = await Promise.all([
            getGovernoratesByRegion(selectedRegion),
            getGovernoratesByUser(selectedSupervisor),
          ]);
          govList = regionGovs.filter(g => userGovs.some(ug => ug.governorateID === g.governorateID));
        } else if (selectedRegion) {
          govList = await getGovernoratesByRegion(selectedRegion);
        } else if (selectedSupervisor) {
          govList = await getGovernoratesByUser(selectedSupervisor);
        }
        setGovernorates(govList);
        // Automatically select if only one governorate is available
        if (govList.length === 1) {
          setSelectedGovernorate(govList[0].governorateID);
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadGovernorates"));
      }
    };
    fetchGovernorates();
  }, [selectedRegion, selectedSupervisor, setError, t]);

  // Fetch delegations based on selected governorate
  useEffect(() => {
    const fetchDelegations = async () => {
      if (!selectedGovernorate) {
        setDelegations([]);
        return;
      }
      try {
        let delList: Delegation[] = [];
        if (selectedSupervisor) {
          const [govDels, userDels] = await Promise.all([
            getDelegationsByGovernorate(selectedGovernorate),
            getDelegationsByUser(selectedSupervisor),
          ]);
          delList = govDels.filter(d => userDels.some(ud => ud.delegationID === d.delegationID));
        } else {
          delList = await getDelegationsByGovernorate(selectedGovernorate);
        }
        setDelegations(delList);
        // Automatically select if only one delegation is available
        if (delList.length === 1) {
          setSelectedDelegation(delList[0].delegationID);
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadDelegations"));
      }
    };
    fetchDelegations();
  }, [selectedGovernorate, selectedSupervisor, setError, t]);

  // Fetch agents based on selected delegation or supervisor
  useEffect(() => {
    const fetchAgents = async () => {
      if (!(agentPhone || selectedDelegation)) {
        setAgents([]);
        return;
      }
      try {
        let agentList: Agent[] = [];
        if (selectedDelegation && selectedSupervisor) {
          const [delAgents, userAgents] = await Promise.all([
            getAgentsByDelegation(selectedDelegation),
            getAgentsByUser(selectedSupervisor),
          ]);
          agentList = delAgents.agents.filter(a => userAgents.agents.some(ua => ua.agentID === a.agentID));
        } else if (selectedDelegation) {
          agentList = (await getAgentsByDelegation(selectedDelegation)).agents;
        }
        setAgents(agentList);
        // Automatically select if only one agent is available
        if (agentList.length === 1) {
          setSelectedAgent(agentList[0].agentID);
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadAgents"));
      }
    };
    if (!agentPhone) fetchAgents();
  }, [selectedDelegation, selectedSupervisor, setError, t]);

  // Fetch agent by phone number
  useEffect(() => {
    if (agentPhone) fetchAgentByPhone(agentPhone);
  }, [agentPhone, fetchAgentByPhone]);

  // Render loading state if permissions or user data are not loaded
  if (!permissionsLoaded || !user) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>{t("timesheetForm.loading")}</p>
      </div>
    );
  }

  // Render form
  return (
    <div className="timesheet-form-container">
      <header className="form-header">
        <h1>{t("timesheetForm.title")}</h1>
      </header>
      <section className="form-card" role="form">
        {loading ? (
          <div className="page-loading">
            <div className="spinner"></div>
            <p>{t("timesheetForm.loading")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {(isSuperAdmin || isDirector) && (
              <div className="form-group">
                <label htmlFor="regionalManager">{t("timesheetForm.form.regionalManager")}</label>
                <input
                  type="text"
                  value={regionalManagerSearch}
                  onChange={(e) => setRegionalManagerSearch(e.target.value)}
                  placeholder={t("timesheetForm.form.placeholders.regionalManagerSearch")}
                />
                <select id="regionalManager" value={selectedRegionalManager} onChange={handleRegionalManagerChange}>
                  <option value="">{t("timesheetForm.form.placeholders.regionalManagerSelect")}</option>
                  {regionalManagers.map(rm => (
                    <option key={rm.userID} value={rm.userID}>{`${rm.firstname} ${rm.lastname} (${rm.phone})`}</option>
                  ))}
                </select>
              </div>
            )}
            {(isSuperAdmin || isDirector || isRegionalManager) && (
              <div className="form-group">
                <label htmlFor="supervisor">{t("timesheetForm.form.supervisor")}</label>
                <input
                  type="text"
                  value={supervisorSearch}
                  onChange={(e) => setSupervisorSearch(e.target.value)}
                  placeholder={t("timesheetForm.form.placeholders.supervisorSearch")}
                />
                <input
                  type="tel"
                  value={supervisorPhone}
                  onChange={handleSupervisorPhoneChange}
                  placeholder={t("timesheetForm.form.placeholders.supervisorPhone")}
                />
                <select id="supervisor" value={selectedSupervisor} onChange={handleSupervisorChange}>
                  <option value="">{t("timesheetForm.form.placeholders.supervisorSelect")}</option>
                  {supervisors.map(s => (
                    <option key={s.userID} value={s.userID}>{`${s.firstname} ${s.lastname} (${s.phone})`}</option>
                  ))}
                </select>
              </div>
            )}
            <hr />
            {/* Date and Time Inputs */}
            <div className="form-group-row">
              <div className="form-group">
                <label htmlFor="date">{t("timesheetForm.form.date")}</label>
                <input type="date" id="date" value={date} onChange={handleDateChange} min={currentDate} required />
              </div>
              <div className="form-group">
                <label htmlFor="time">{t("timesheetForm.form.time")}</label>
                <input type="time" id="time" value={time} onChange={handleTimeChange} disabled={!date} min={minTime} required />
              </div>
            </div>
            <hr />
            <div className="form-group">
              <label htmlFor="agentPhone">{t("timesheetForm.form.agentPhone")}</label>
              <input type="tel" id="agentPhone" value={agentPhone} onChange={handleAgentPhoneChange} placeholder={t("timesheetForm.form.placeholders.agentPhone")} />
            </div>
            <div className="form-group-row">
              <div className="form-group">
                <label htmlFor="region">{t("timesheetForm.form.region")}</label>
                <select id="region" value={selectedRegion} onChange={handleRegionChange}>
                  <option value="">{t("timesheetForm.form.placeholders.regionSelect")}</option>
                  {regions.map(r => (
                    <option key={r.regionID} value={r.regionID}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="governorate">{t("timesheetForm.form.governorate")}</label>
                <select id="governorate" value={selectedGovernorate} onChange={handleGovernorateChange} disabled={!(selectedRegion || selectedSupervisor)}>
                  <option value="">{t("timesheetForm.form.placeholders.governorateSelect")}</option>
                  {governorates.map(g => (
                    <option key={g.governorateID} value={g.governorateID}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="delegation">{t("timesheetForm.form.delegation")}</label>
                <select id="delegation" value={selectedDelegation} onChange={handleDelegationChange} disabled={!selectedGovernorate}>
                  <option value="">{t("timesheetForm.form.placeholders.delegationSelect")}</option>
                  {delegations.map(d => (
                    <option key={d.delegationID} value={d.delegationID}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="agent">{t("timesheetForm.form.agent")}</label>
              {agentLoading && <span className="loading-spinner"></span>}
              <select id="agent" value={selectedAgent} onChange={handleAgentChange} disabled={!(agentPhone || selectedDelegation)}>
                <option value="">{t("timesheetForm.form.placeholders.agentSelect")}</option>
                {agents.map(a => (
                  <option key={a.agentID} value={a.agentID}>{`${a.name} ${a.lastname} (${a.phone})`}</option>
                ))}
              </select>
            </div>
            <hr />
            <div className="form-group" style={{ marginBottom: "0 !important" }}>
              <label>{t("timesheetForm.form.reasons")}</label>
              <select value="" onChange={(e) => handleReasonSelect(reasons.find(r => r.reasonID === e.target.value)!)}>
                <option value="">{t("timesheetForm.form.placeholders.reasonSelect")}</option>
                {reasons.map(r => (
                  <option key={r.reasonID} value={r.reasonID}>{r.item}</option>
                ))}
              </select>
              <div className="selected-items">
                {selectedReasons.map((r, i) => (
                  <span key={i} className="selected-item" onClick={() => setSelectedReasons(selectedReasons.filter((_, idx) => idx !== i))}>
                    {reasons.find(re => re.reasonID === r.id)?.item} ×
                  </span>
                ))}
              </div>
            </div>
            <div className="form-group" >
              <label>{t("timesheetForm.form.checklists")}</label>
              <select value="" onChange={(e) => handleChecklistSelect(checklists.find(c => c.checklistID === e.target.value)!)}>
                <option value="">{t("timesheetForm.form.placeholders.checklistSelect")}</option>
                {checklists.map(c => (
                  <option key={c.checklistID} value={c.checklistID}>{c.item}</option>
                ))}
              </select>
              <div className="selected-items">
                {selectedChecklists.map((c, i) => (
                  <span key={i} className="selected-item" onClick={() => setSelectedChecklists(selectedChecklists.filter((_, idx) => idx !== i))}>
                    {checklists.find(ch => ch.checklistID === c.id)?.item} ×
                  </span>
                ))}
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="submit-btn secondary" onClick={() => navigate(-1)}>
                {t("timesheetForm.actions.back")}
              </button>
              <button type="submit" className="submit-btn primary" disabled={!isFormComplete || loading}>
                {loading ? t("timesheetForm.actions.submitting") : t("timesheetForm.actions.create")}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
};

export default TimesheetForm;