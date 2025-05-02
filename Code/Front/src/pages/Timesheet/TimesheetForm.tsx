/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { debounce } from "lodash";
import "./TimesheetForm.css";
import Agent from "../../models/Agent";
import User from "../../models/User";
import Region from "../../models/Region";
import Governorate from "../../models/Governorate";
import Delegation from "../../models/Delegation";
import {
  getAgentByPhone,
  getAgentsByLocation,
} from "../../apis/agentAPI";
import {
  getAllRegions,
  getAllGovernorates,
  getAllDelegations,
} from "../../apis/userAPI";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { createTimesheet } from "../../apis/timesheetAPI";
import { getUserByPhone, getSupervisorsByUser, getAllUsers } from "../../apis/userAPI";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import { useAuth } from "../../context/AuthContext";
import { useError } from "../../context/ErrorContext";
import { useTranslation } from "react-i18next";

const PERMISSIONS = {
  CREATE_TIMESHEETS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS,
  CREATE_TIMESHEETS_FOR_SUPERVISOR: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR,
  READ_AGENTS_BY_LOCATION: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_LOCATION,
  READ_AGENTS_BY_PHONE: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_PHONE,
  READ_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
  READ_REASON_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS,
  READ_CHECKLISTS_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS,
};

const ROLES = {
  SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
  SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
  REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
};

const TimesheetForm: React.FC = () => {
  const navigate = useNavigate();
  const { user, effectivePermissions, permissionsLoaded, userRoles } = useAuth();
  const { setError, error } = useError();
  const { t } = useTranslation();

  // State
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [allGovernorates, setAllGovernorates] = useState<Governorate[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("");
  const [allDelegations, setAllDelegations] = useState<Delegation[]>([]);
  const [selectedDelegation, setSelectedDelegation] = useState<string>("");
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
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");
  const [supervisorPhone, setSupervisorPhone] = useState<string>("");
  const [supervisorSearch, setSupervisorSearch] = useState<string>("");
  const [regionalManagers, setRegionalManagers] = useState<User[]>([]);
  const [selectedRegionalManager, setSelectedRegionalManager] = useState<string>("");
  const [regionalManagerSearch, setRegionalManagerSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [agentLoading, setAgentLoading] = useState<boolean>(false);
  const [supervisorLoading, setSupervisorLoading] = useState<boolean>(false);

  const currentDate = new Date().toISOString().split("T")[0];

  // Role Checks
  const isSuperAdmin = useMemo(() => userRoles?.some((role) => role.name === ROLES.SUPER_ADMIN), [userRoles]);
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
  }), [effectivePermissions]);

  if (!permissionsLoaded) return <div className="page-loading"><div className="spinner"></div><p>{t("timesheetForm.loading")}</p></div>;
  if (!user) return null;

  const supervisorID = userPermissions.canReadSupervisors && selectedSupervisor ? selectedSupervisor : user.userID;

  // Fetch Initial Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const promises = [
          userPermissions.canReadAgentsByLocation
            ? isSupervisor
              ? Promise.resolve(user.Regions || [])
              : isRegionalManager
                ? Promise.resolve(user.Regions || [])
                : getAllRegions()
            : Promise.resolve([]),
          userPermissions.canReadAgentsByLocation
            ? getAllGovernorates()
            : Promise.resolve([]),
          userPermissions.canReadAgentsByLocation
            ? getAllDelegations()
            : Promise.resolve([]),
          userPermissions.canReadReasons ? getAllReasons() : Promise.resolve([]),
          userPermissions.canReadChecklists ? getAllChecklists() : Promise.resolve([]),
          userPermissions.canReadSupervisors
            ? isSuperAdmin
              ? getAllUsers().then((users) => users.filter((u) => u.Roles?.some((role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase())))
              : isRegionalManager
                ? getSupervisorsByUser(user.userID)
                : Promise.resolve(user.supervisors || [])
            : Promise.resolve([]),
          isSuperAdmin
            ? getAllUsers().then((users) => users.filter((u) => u.Roles?.some((role) => role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase())))
            : Promise.resolve([]),
        ];
        const [regionsData, governoratesData, delegationsData, reasonsData, checklistsData, supervisorsData, regionalManagersData] = await Promise.all(promises);
        setRegions(regionsData as Region[]);
        setAllGovernorates(governoratesData as Governorate[]);
        setAllDelegations(delegationsData as Delegation[]);
        setReasons(reasonsData as Reason[]);
        setChecklists(checklistsData as Checklist[]);
        if (userPermissions.canCreateTimesheetsForSupervisors && userPermissions.canReadSupervisors) {
          setSupervisors(supervisorsData as User[]);
        }
        if (isSuperAdmin) {
          setRegionalManagers(regionalManagersData as User[]);
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadInitialData"));
        console.error("Fetch initial data error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userPermissions, user.userID, setError, t, isSuperAdmin, isRegionalManager, isSupervisor, user.Regions, user.supervisors]);

  // Memoized Supervisors and Regional Managers
  const memoizedSupervisors = useMemo(() => supervisors, [supervisors]);
  const memoizedRegionalManagers = useMemo(() => regionalManagers, [regionalManagers]);

  // Filtered Regions
  const filteredRegions = useMemo(() => {
    let availableRegions = isSupervisor
      ? user.Regions || []
      : isRegionalManager
        ? user.Regions || []
        : regions;

    if (selectedRegionalManager && isSuperAdmin) {
      const regionalManager = memoizedRegionalManagers.find((rm) => rm.userID === selectedRegionalManager);
      if (regionalManager?.Regions) {
        availableRegions = availableRegions.filter((r) =>
          regionalManager.Regions?.some((rmr) => rmr.regionID === r.regionID)
        );
      } else {
        availableRegions = [];
      }
    } else if (selectedSupervisor && !isSupervisor) {
      const supervisor = memoizedSupervisors.find((s) => s.userID === selectedSupervisor);
      if (supervisor?.regionalManagerID) {
        const regionalManager = memoizedRegionalManagers.find((rm) => rm.userID === supervisor.regionalManagerID);
        if (regionalManager?.Regions) {
          availableRegions = availableRegions.filter((r) =>
            regionalManager.Regions?.some((rmr) => rmr.regionID === r.regionID)
          );
        } else {
          availableRegions = [];
        }
      } else {
        // If supervisor has no regional manager, show all regions (or user's regions)
        availableRegions = isSuperAdmin ? regions : user.Regions || [];
      }
    }

    return availableRegions.sort((a, b) => a.name.localeCompare(b.name));
  }, [
    regions,
    selectedSupervisor,
    selectedRegionalManager,
    isSupervisor,
    isRegionalManager,
    isSuperAdmin,
    memoizedSupervisors,
    memoizedRegionalManagers,
    user.Regions,
  ]);

  // Filtered Governorates
  const filteredGovernorates = useMemo(() => {
    if (!selectedRegion || !userPermissions.canReadAgentsByLocation || agentPhone) {
      return [];
    }

    let availableGovernorates = isSupervisor
      ? user.Governorates || []
      : allGovernorates.filter((gov) => gov.regionID === selectedRegion);

    if (selectedRegionalManager && isSuperAdmin) {
      const regionalManager = memoizedRegionalManagers.find((rm) => rm.userID === selectedRegionalManager);
      if (regionalManager?.Regions) {
        availableGovernorates = availableGovernorates.filter((gov) =>
          regionalManager.Regions?.some((rmr) => rmr.regionID === gov.regionID)
        );
      } else {
        availableGovernorates = [];
      }
    }

    if (selectedSupervisor && !isSupervisor) {
      const supervisor = memoizedSupervisors.find((s) => s.userID === selectedSupervisor);
      if (supervisor?.Governorates) {
        availableGovernorates = availableGovernorates.filter((gov) =>
          supervisor.Governorates?.some((sg) => sg.governorateID === gov.governorateID)
        );
      } else {
        availableGovernorates = [];
      }
    }

    return availableGovernorates.sort((a, b) => a.name.localeCompare(b.name));
  }, [
    selectedRegion,
    selectedSupervisor,
    selectedRegionalManager,
    userPermissions.canReadAgentsByLocation,
    agentPhone,
    isSupervisor,
    isSuperAdmin,
    memoizedSupervisors,
    memoizedRegionalManagers,
    allGovernorates,
    user.Governorates,
  ]);

  // Filtered Delegations
  const filteredDelegations = useMemo(() => {
    if (!selectedGovernorate || !userPermissions.canReadAgentsByLocation || agentPhone) {
      return [];
    }

    let availableDelegations = isSupervisor
      ? user.Delegations || []
      : allDelegations.filter((del) => del.governorateID === selectedGovernorate);

    if (selectedSupervisor && !isSupervisor) {
      const supervisor = memoizedSupervisors.find((s) => s.userID === selectedSupervisor);
      if (supervisor?.Delegations) {
        availableDelegations = availableDelegations.filter((del) =>
          supervisor.Delegations?.some((sd) => sd.delegationID === del.delegationID)
        );
      } else {
        availableDelegations = [];
      }
    }

    if (selectedRegionalManager && isSuperAdmin) {
      const regionalManager = memoizedRegionalManagers.find((rm) => rm.userID === selectedRegionalManager);
      if (regionalManager?.Regions) {
        const managerGovernorates = allGovernorates.filter((gov) =>
          regionalManager.Regions?.some((rmr) => rmr.regionID === gov.regionID)
        );
        availableDelegations = availableDelegations.filter((del) =>
          managerGovernorates.some((mg) => mg.governorateID === del.governorateID)
        );
      } else {
        availableDelegations = [];
      }
    }

    return availableDelegations.sort((a, b) => a.name.localeCompare(b.name));
  }, [
    selectedGovernorate,
    selectedSupervisor,
    selectedRegionalManager,
    userPermissions.canReadAgentsByLocation,
    agentPhone,
    isSupervisor,
    isSuperAdmin,
    memoizedSupervisors,
    memoizedRegionalManagers,
    allDelegations,
    allGovernorates,
    user.Delegations,
  ]);

  // Update Regions when Supervisor or Regional Manager Changes
  useEffect(() => {
    const currentRegionIDs = regions.map((r) => r.regionID).sort();
    const newRegionIDs = filteredRegions.map((r) => r.regionID).sort();
    if (JSON.stringify(currentRegionIDs) !== JSON.stringify(newRegionIDs)) {
      setRegions(filteredRegions);
      if (!filteredRegions.some((r) => r.regionID === selectedRegion)) {
        setSelectedRegion("");
      }
    }
  }, [filteredRegions, regions, selectedRegion]);

  // Update Governorates when Region, Supervisor, or Regional Manager Changes
  useEffect(() => {
    if (filteredGovernorates.length === 0) {
      setSelectedGovernorate("");
    } else if (!filteredGovernorates.some((g) => g.governorateID === selectedGovernorate)) {
      setSelectedGovernorate("");
    }
  }, [filteredGovernorates, selectedGovernorate]);

  // Update Delegations when Governorate, Supervisor, or Regional Manager Changes
  useEffect(() => {
    if (filteredDelegations.length === 0) {
      setSelectedDelegation("");
      setAgents([]);
      setSelectedAgent("");
    } else if (!filteredDelegations.some((d) => d.delegationID === selectedDelegation)) {
      setSelectedDelegation("");
      setAgents([]);
      setSelectedAgent("");
    }
  }, [filteredDelegations, selectedDelegation]);

  // Fetch and Filter Agents by Delegation
  useEffect(() => {
    if (selectedDelegation && !agentPhone && userPermissions.canReadAgentsByLocation) {
      const fetchAgents = async () => {
        setAgentLoading(true);
        try {
          const agentsData = await getAgentsByLocation(selectedDelegation);
          let filteredAgents = isSupervisor
            ? agentsData.agents.filter((agent: Agent) => agent.supervisorID === user.userID)
            : agentsData.agents;

          if (selectedSupervisor && !isSupervisor) {
            filteredAgents = filteredAgents.filter(
              (agent: Agent) => agent.supervisorID === selectedSupervisor
            );
          }

          if (selectedRegionalManager && isSuperAdmin) {
            const regionalManager = memoizedRegionalManagers.find((rm) => rm.userID === selectedRegionalManager);
            if (regionalManager?.Regions) {
              const managerGovernorates = allGovernorates.filter((g) =>
                regionalManager.Regions?.some((rmr) => rmr.regionID === g.regionID)
              );
              const managerDelegations = allDelegations.filter((d) =>
                managerGovernorates.some((mg) => mg.governorateID === d.governorateID)
              );
              filteredAgents = filteredAgents.filter((agent: Agent) =>
                managerDelegations.some((md) => md.delegationID === agent.delegationID)
              );
            }
          }

          setAgents(filteredAgents);
        } catch (err) {
          setError(t("timesheetForm.errors.loadAgents", { location: selectedDelegation }));
          console.error("Fetch agents by delegation error:", err);
        } finally {
          setAgentLoading(false);
        }
      };
      fetchAgents();
    } else {
      setAgents([]);
      setSelectedAgent("");
    }
  }, [
    selectedDelegation,
    selectedSupervisor,
    selectedRegionalManager,
    agentPhone,
    userPermissions.canReadAgentsByLocation,
    isSupervisor,
    isSuperAdmin,
    user.userID,
    memoizedRegionalManagers,
    allGovernorates,
    allDelegations,
    setError,
    t,
  ]);

  // Filter Supervisors by Regional Manager (Super Admin only)
  useEffect(() => {
    if (!isSuperAdmin || !userPermissions.canReadSupervisors || !selectedRegionalManager) {
      return;
    }
    const filterSupervisors = async () => {
      setSupervisorLoading(true);
      try {
        const regionalManager = memoizedRegionalManagers.find((rm) => rm.userID === selectedRegionalManager);
        let filteredSupervisors: User[] = [];
        if (regionalManager) {
          const supervisorsData = await getSupervisorsByUser(regionalManager.userID);
          filteredSupervisors = supervisorsData || [];
        }
        setSupervisors(filteredSupervisors);
        if (!filteredSupervisors.some((s) => s.userID === selectedSupervisor)) {
          setSelectedSupervisor("");
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadSupervisors"));
        console.error("Filter supervisors error:", err);
      } finally {
        setSupervisorLoading(false);
      }
    };
    filterSupervisors();
  }, [isSuperAdmin, userPermissions.canReadSupervisors, selectedRegionalManager, memoizedRegionalManagers, setError, t]);

  // Reset Supervisors when Regional Manager is deselected (Super Admin only)
  useEffect(() => {
    if (!isSuperAdmin || !userPermissions.canReadSupervisors || selectedRegionalManager) {
      return;
    }
    const resetSupervisors = async () => {
      setSupervisorLoading(true);
      try {
        const supervisorsData = await getAllUsers();
        const filteredSupervisors = supervisorsData.filter((u) =>
          u.Roles?.some((role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase())
        );
        setSupervisors(filteredSupervisors);
        setSelectedSupervisor("");
      } catch (err) {
        setError(t("timesheetForm.errors.loadSupervisors"));
        console.error("Reset supervisors error:", err);
      } finally {
        setSupervisorLoading(false);
      }
    };
    resetSupervisors();
  }, [isSuperAdmin, userPermissions.canReadSupervisors, selectedRegionalManager, setError, t]);

  // Debounced Fetch Agent by Phone
  const fetchAgentByPhone = useCallback(
    debounce(async (phone: string) => {
      if (phone.length < 7 || !userPermissions.canReadAgentsByPhone) return;
      setAgentLoading(true);
      try {
        const agentData = await getAgentByPhone(phone);
        setSelectedAgent(agentData.agent.agentID);
        setSelectedDelegation(agentData.agent.delegationID || "");
        const delegation = allDelegations.find((d) => d.delegationID === agentData.agent.delegationID);
        if (delegation) {
          setSelectedGovernorate(delegation.governorateID);
          const governorate = allGovernorates.find((g) => g.governorateID === delegation.governorateID);
          if (governorate) {
            setSelectedRegion(governorate.regionID);
          }
        }
        setAgents([agentData.agent]);
        setAgentSearch(`${agentData.agent.name || ""} ${agentData.agent.lastname || ""}`);
        if (agentData.agent.supervisorID) {
          setSelectedSupervisor(agentData.agent.supervisorID);
        }
      } catch (err) {
        setError(t("timesheetForm.errors.agentNotFound"));
        setSelectedAgent("");
        setAgents([]);
        setSelectedDelegation("");
        setSelectedGovernorate("");
        setSelectedRegion("");
        setSelectedSupervisor("");
        console.error("Fetch agent by phone error:", err);
      } finally {
        setAgentLoading(false);
      }
    }, 500),
    [userPermissions.canReadAgentsByPhone, setError, t, allDelegations, allGovernorates]
  );

  useEffect(() => {
    if (agentPhone) fetchAgentByPhone(agentPhone);
    else {
      setSelectedAgent("");
      setAgents([]);
      setSelectedDelegation("");
      setSelectedGovernorate("");
      setSelectedRegion("");
      setAgentSearch("");
    }
    return () => fetchAgentByPhone.cancel();
  }, [agentPhone, fetchAgentByPhone]);

  // Debounced Fetch Supervisor by Phone
  const fetchSupervisorByPhone = useCallback(
    debounce(async (phone: string) => {
      if (phone.length < 7 || !userPermissions.canReadSupervisors || !userPermissions.canCreateTimesheetsForSupervisors) return;
      setSupervisorLoading(true);
      try {
        const supervisor = await getUserByPhone(phone);
        if (isSuperAdmin && !supervisor.Roles?.some((role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase())) {
          throw new Error("User is not a supervisor");
        }
        setSelectedSupervisor(supervisor.userID);
        setSupervisors((prev) => prev.some((s) => s.userID === supervisor.userID) ? prev : [...prev, supervisor]);
        setSupervisorSearch(`${supervisor.firstname || ""} ${supervisor.lastname || ""}`);
      } catch (err) {
        setError(t("timesheetForm.errors.supervisorNotFound"));
        setSelectedSupervisor("");
        console.error("Fetch supervisor by phone error:", err);
      } finally {
        setSupervisorLoading(false);
      }
    }, 500),
    [userPermissions.canReadSupervisors, userPermissions.canCreateTimesheetsForSupervisors, setError, t, isSuperAdmin]
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
    if (selectedDate >= currentDate) {
      setDate(selectedDate);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTime(e.target.value);
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
    if (!isFormComplete) {
      setError(t("timesheetForm.errors.formIncomplete"));
      return;
    }
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
      status: userPermissions.canCreateTimesheetsForSupervisors ? "validated" : "pending",
    };

    try {
      await createTimesheet(timesheetData);
      navigate("/timesheet");
    } catch (err) {
      setError(t("timesheetForm.errors.createFailed"));
      console.error("Submit error:", err);
    } finally {
      setLoading(false);
    }
  };

  const isFormComplete = useMemo(
    () =>
      date &&
      time &&
      selectedAgent &&
      selectedReasons.length > 0 &&
      selectedChecklists.length > 0 &&
      (!userPermissions.canCreateTimesheetsForSupervisors || selectedSupervisor) &&
      (isSupervisor || selectedRegion) &&
      selectedGovernorate &&
      selectedDelegation,
    [
      date,
      time,
      selectedAgent,
      selectedReasons,
      selectedChecklists,
      userPermissions.canCreateTimesheetsForSupervisors,
      selectedSupervisor,
      isSupervisor,
      selectedRegion,
      selectedGovernorate,
      selectedDelegation,
    ]
  );

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>{t("timesheetForm.loading")}</p>
      </div>
    );
  }

  return (
    <div className="timesheet-form-container">
      <header className="form-header">
        <h1>{t("timesheetForm.title")}</h1>
      </header>
      <section className="form-card" role="form" aria-labelledby="form-title">
        {error && (
          <div className="error-message" role="alert" aria-live="assertive" tabIndex={0}>
            {t("timesheetForm.accessibility.errorAnnouncement", { message: error })}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {isSuperAdmin && userPermissions.canCreateTimesheetsForSupervisors && userPermissions.canReadSupervisors && (
            <div className="form-group">
              <label htmlFor="regionalManager">{t("timesheetForm.form.regionalManager")} <span aria-hidden>*</span></label>
              <input
                type="text"
                id="regional-manager-search"
                placeholder={t("timesheetForm.form.placeholders.regionalManagerSearch")}
                value={regionalManagerSearch}
                onChange={(e) => setRegionalManagerSearch(e.target.value)}
                className="search-input"
                aria-label={t("timesheetForm.form.placeholders.regionalManagerSearch")}
              />
              <select
                id="regionalManager"
                value={selectedRegionalManager}
                onChange={(e) => setSelectedRegionalManager(e.target.value)}
                aria-label={t("timesheetForm.form.placeholders.regionalManagerSelect")}
              >
                <option value="">{t("timesheetForm.form.placeholders.regionalManagerSelect")}</option>
                {regionalManagers
                  .filter((rm) => `${rm.firstname || ""} ${rm.lastname || ""} ${rm.phone || ""}`.toLowerCase().includes(regionalManagerSearch.toLowerCase()))
                  .map((rm) => (
                    <option key={rm.userID} value={rm.userID}>
                      {rm.firstname} {rm.lastname} ({rm.phone})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {userPermissions.canCreateTimesheetsForSupervisors && userPermissions.canReadSupervisors && (
            <div className="form-group">
              <label htmlFor="supervisor">{t("timesheetForm.form.supervisor")} <span aria-hidden>*</span></label>
              <input
                type="text"
                id="supervisor-search"
                placeholder={t("timesheetForm.form.placeholders.supervisorSearch")}
                value={supervisorSearch}
                onChange={(e) => setSupervisorSearch(e.target.value)}
                className="search-input"
                aria-label={t("timesheetForm.form.placeholders.supervisorSearch")}
                disabled={supervisorLoading}
              />
              <input
                type="tel"
                id="supervisor-phone"
                placeholder={t("timesheetForm.form.placeholders.supervisorPhone")}
                value={supervisorPhone}
                onChange={(e) => setSupervisorPhone(e.target.value)}
                className="search-input"
                aria-label={t("timesheetForm.form.placeholders.supervisorPhone")}
                disabled={supervisorLoading}
              />
              {supervisorLoading && <span className="loading-spinner" aria-hidden="true"></span>}
              <select
                id="supervisor"
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                required
                aria-label={t("timesheetForm.form.placeholders.supervisorSelect")}
                disabled={supervisorLoading}
              >
                <option value="">{t("timesheetForm.form.placeholders.supervisorSelect")}</option>
                {supervisors
                  .filter((s) => `${s.firstname || ""} ${s.lastname || ""} ${s.phone || ""}`.toLowerCase().includes(supervisorSearch.toLowerCase()))
                  .map((s) => (
                    <option key={s.userID} value={s.userID}>
                      {s.firstname} {s.lastname} ({s.phone})
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="date">{t("timesheetForm.form.date")} <span aria-hidden>*</span></label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={handleDateChange}
              min={currentDate}
              required
              aria-label={t("timesheetForm.form.date")}
            />
          </div>

          <div className="form-group">
            <label htmlFor="time">{t("timesheetForm.form.time")} <span aria-hidden>*</span></label>
            <input
              type="time"
              id="time"
              value={time}
              onChange={handleTimeChange}
              required
              disabled={!date}
              aria-label={t("timesheetForm.form.time")}
            />
          </div>

          <div className="form-group">
            <label htmlFor="agentPhone">{t("timesheetForm.form.agentPhone")}</label>
            <input
              type="tel"
              id="agentPhone"
              placeholder={userPermissions.canReadAgentsByPhone ? t("timesheetForm.form.placeholders.agentPhone") : t("timesheetForm.form.placeholders.permissionDenied")}
              value={agentPhone}
              onChange={(e) => setAgentPhone(e.target.value)}
              className="search-input"
              disabled={!userPermissions.canReadAgentsByPhone}
              aria-label={t("timesheetForm.form.placeholders.agentPhone")}
            />
          </div>

          {!isSupervisor && (
            <div className="form-group">
              <label htmlFor="region">{t("timesheetForm.form.region")} <span aria-hidden>*</span></label>
              <select
                id="region"
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                required
                aria-label={t("timesheetForm.form.placeholders.regionSelect")}
                disabled={!!agentPhone || !userPermissions.canReadAgentsByLocation}
              >
                <option value="">{t("timesheetForm.form.placeholders.regionSelect")}</option>
                {filteredRegions.map((region) => (
                  <option key={region.regionID} value={region.regionID}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="governorate">{t("timesheetForm.form.governorate")} <span aria-hidden>*</span></label>
            <select
              id="governorate"
              value={selectedGovernorate}
              onChange={(e) => setSelectedGovernorate(e.target.value)}
              required
              aria-label={t("timesheetForm.form.placeholders.governorateSelect")}
              disabled={!!agentPhone || !selectedRegion || !userPermissions.canReadAgentsByLocation}
            >
              <option value="">{t("timesheetForm.form.placeholders.governorateSelect")}</option>
              {filteredGovernorates.map((gov) => (
                <option key={gov.governorateID} value={gov.governorateID}>
                  {gov.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="delegation">{t("timesheetForm.form.delegation")} <span aria-hidden>*</span></label>
            <select
              id="delegation"
              value={selectedDelegation}
              onChange={(e) => setSelectedDelegation(e.target.value)}
              required
              aria-label={t("timesheetForm.form.placeholders.delegationSelect")}
              disabled={!!agentPhone || !selectedGovernorate || !userPermissions.canReadAgentsByLocation}
            >
              <option value="">{t("timesheetForm.form.placeholders.delegationSelect")}</option>
              {filteredDelegations.map((del) => (
                <option key={del.delegationID} value={del.delegationID}>
                  {del.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="agent">{t("timesheetForm.form.agent")} <span aria-hidden>*</span></label>
            <input
              type="text"
              id="agent-search"
              placeholder={userPermissions.canReadAgentsByLocation ? t("timesheetForm.form.placeholders.agentSearch") : t("timesheetForm.form.placeholders.permissionDenied")}
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              disabled={!!agentPhone || !selectedDelegation || !userPermissions.canReadAgentsByLocation}
              className="search-input"
              aria-label={t("timesheetForm.form.placeholders.agentSearch")}
            />
            {agentLoading && <span className="loading-spinner" aria-hidden="true"></span>}
            <select
              id="agent"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              disabled={!!agentPhone || !selectedDelegation || !userPermissions.canReadAgentsByLocation || agentLoading}
              required
              aria-label={t("timesheetForm.form.placeholders.agentSelect")}
            >
              <option value="">{t("timesheetForm.form.placeholders.agentSelect")}</option>
              {agents
                .filter((agent) => `${agent.name || ""} ${agent.lastname || ""} ${agent.phone || ""}`.toLowerCase().includes(agentSearch.toLowerCase()))
                .map((agent) => (
                  <option key={agent.agentID} value={agent.agentID}>
                    {agent.name} {agent.lastname} ({agent.phone})
                  </option>
                ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t("timesheetForm.form.reasons")} <span aria-hidden>*</span></label>
            <input
              type="text"
              id="reason-search"
              placeholder={userPermissions.canReadReasons ? t("timesheetForm.form.placeholders.reasonSearch") : t("timesheetForm.form.placeholders.permissionDenied")}
              value={reasonSearch}
              onChange={(e) => setReasonSearch(e.target.value)}
              className="search-input"
              disabled={!userPermissions.canReadReasons}
              aria-label={t("timesheetForm.form.placeholders.reasonSearch")}
            />
            <select
              id="reason-select"
              value=""
              onChange={(e) => {
                const reason = reasons.find((r) => r.reasonID === e.target.value);
                if (reason) handleReasonSelect(reason);
              }}
              aria-label={t("timesheetForm.form.placeholders.reasonSelect")}
              disabled={!userPermissions.canReadReasons}
            >
              <option value="">{t("timesheetForm.form.placeholders.reasonSelect")}</option>
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
                  onKeyDown={(e) => e.key === "Enter" && setSelectedReasons(selectedReasons.filter((_, i) => i !== index))}
                  role="button"
                  tabIndex={0}
                  aria-label={t("timesheetForm.accessibility.removeReason", { item: reasons.find((r) => r.reasonID === reason.id)?.item })}
                >
                  {reasons.find((r) => r.reasonID === reason.id)?.item} ×
                </span>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>{t("timesheetForm.form.checklists")} <span aria-hidden>*</span></label>
            <input
              type="text"
              id="checklist-search"
              placeholder={userPermissions.canReadChecklists ? t("timesheetForm.form.placeholders.checklistSearch") : t("timesheetForm.form.placeholders.permissionDenied")}
              value={checklistSearch}
              onChange={(e) => setChecklistSearch(e.target.value)}
              className="search-input"
              disabled={!userPermissions.canReadChecklists}
              aria-label={t("timesheetForm.form.placeholders.checklistSearch")}
            />
            <select
              id="checklist-select"
              value=""
              onChange={(e) => {
                const checklist = checklists.find((c) => c.checklistID === e.target.value);
                if (checklist) handleChecklistSelect(checklist);
              }}
              aria-label={t("timesheetForm.form.placeholders.checklistSelect")}
              disabled={!userPermissions.canReadChecklists}
            >
              <option value="">{t("timesheetForm.form.placeholders.checklistSelect")}</option>
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
                  onKeyDown={(e) => e.key === "Enter" && setSelectedChecklists(selectedChecklists.filter((_, i) => i !== index))}
                  role="button"
                  tabIndex={0}
                  aria-label={t("timesheetForm.accessibility.removeChecklist", { item: checklists.find((c) => c.checklistID === checklist.id)?.item })}
                >
                  {checklists.find((c) => c.checklistID === checklist.id)?.item} ×
                </span>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="submit-btn secondary"
              onClick={() => navigate(-1)}
              aria-label={t("timesheetForm.actions.back")}
            >
              {t("timesheetForm.actions.back")}
            </button>
            <button
              type="submit"
              className="submit-btn primary"
              disabled={!isFormComplete || loading || !(userPermissions.canCreateTimesheets || userPermissions.canCreateTimesheetsForSupervisors)}
              aria-label={t("timesheetForm.actions.create")}
            >
              {loading ? t("timesheetForm.actions.submitting") : t("timesheetForm.actions.create")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default TimesheetForm;