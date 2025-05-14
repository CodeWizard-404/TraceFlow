/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { debounce } from "lodash";
import { toast } from "react-toastify"; // Add react-toastify for notifications
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
  getUserByPhone,
  getSupervisorsByRegionalManager,
  getRegionalManagerBySupervisor,
  getAllUsers,
  getUsersByRegion,
  getUsersByGovernorate,
  getUsersByDelegation,
  getUserById,
} from "../../apis/userAPI";
import {
  getGovernoratesByUser,
  getDelegationsByUser,
  getRegionsByUser,
  getAllRegions,
  getGovernoratesByRegion,
  getDelegationsByGovernorate,
  getRegionsByGovernorate,
  getAllDelegations,
  getGovernoratesByDelegation,
} from "../../apis/locationApi";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { createTimesheet } from "../../apis/timesheetAPI";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import { useAuth } from "../../context/AuthContext";
import { useError } from "../../context/ErrorContext";
import { useTranslation } from "react-i18next";
import { AgentsByDelegationResponse } from "../../apis/index";

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
  DIRECTOR: import.meta.env.VITE_ROLES_DIRECTOR,
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
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("");
  const [delegations, setDelegations] = useState<Delegation[]>([]);
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
  const [disableLocationInputs, setDisableLocationInputs] = useState<boolean>(false);
  const [disableSupervisorInput, setDisableSupervisorInput] = useState<boolean>(false);
  const [disableRegionalManagerInput, setDisableRegionalManagerInput] = useState<boolean>(false);
  const [fetchMode, setFetchMode] = useState<"none" | "supervisor" | "agent">("none");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false); // Prevent refetch during submission

  const currentDate = new Date().toISOString().split("T")[0];

  // Role Checks
  const isSuperAdmin = useMemo(() => userRoles?.some((role) => role.name === ROLES.SUPER_ADMIN), [userRoles]);
  const isRegionalManager = useMemo(() => userRoles?.some((role) => role.name === ROLES.REGIONAL_MANAGER), [userRoles]);
  const isSupervisor = useMemo(() => userRoles?.some((role) => role.name === ROLES.SUPERVISOR), [userRoles]);
  const isDirector = useMemo(() => userRoles?.some((role) => role.name === ROLES.DIRECTOR), [userRoles]);

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

  // Determine Supervisor ID
  const supervisorID = isSupervisor ? user.userID : userPermissions.canReadSupervisors && selectedSupervisor ? selectedSupervisor : "";

  // Reset Form State
  const resetForm = useCallback(() => {
    setDate("");
    setTime("");
    setSelectedRegion("");
    setSelectedGovernorate("");
    setSelectedDelegation("");
    setSelectedAgent("");
    setAgentSearch("");
    setAgentPhone("");
    setSelectedReasons([]);
    setReasonSearch("");
    setSelectedChecklists([]);
    setChecklistSearch("");
    setSelectedSupervisor("");
    setSupervisorPhone("");
    setSupervisorSearch("");
    setSelectedRegionalManager("");
    setRegionalManagerSearch("");
    setDisableLocationInputs(false);
    setDisableSupervisorInput(false);
    setDisableRegionalManagerInput(false);
    setFetchMode("none");
  }, []);

  // Fetch Initial Data
  useEffect(() => {
    const fetchInitialData = async () => {
      if (isSubmitting) return; // Prevent refetch during submission
      setLoading(true);
      try {
        const promises = [
          userPermissions.canReadSupervisors && (isSuperAdmin || isDirector || isRegionalManager)
            ? isRegionalManager
              ? getSupervisorsByRegionalManager(user.userID)
              : getAllUsers().then((users) => users.filter((u) => u.Roles?.some((role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase())))
            : Promise.resolve([]),
          (isSuperAdmin || isDirector)
            ? getAllUsers().then((users) => users.filter((u) => u.Roles?.some((role) => role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase())))
            : Promise.resolve([]),
          userPermissions.canReadAgentsByLocation
            ? isSupervisor
              ? getRegionalManagerBySupervisor(user.userID).then((rms) => rms.length > 0 ? getRegionsByUser(rms[0].userID) : [])
              : isRegionalManager
                ? getRegionsByUser(user.userID)
                : getAllRegions()
            : Promise.resolve([]),
          userPermissions.canReadReasons ? getAllReasons() : Promise.resolve([]),
          userPermissions.canReadChecklists ? getAllChecklists() : Promise.resolve([]),
        ];
        const [supervisorsData, regionalManagersData, regionsData, reasonsData, checklistsData] = await Promise.all(promises);
        setSupervisors(supervisorsData as User[]);
        setRegionalManagers(regionalManagersData as User[]);
        setRegions(regionsData as Region[]);
        setReasons(reasonsData as Reason[]);
        setChecklists(checklistsData as Checklist[]);
      } catch (err) {
        setError(t("timesheetForm.errors.loadInitialData"));
        console.error("Fetch initial data error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [userPermissions, user.userID, isSuperAdmin, isRegionalManager, isSupervisor, isDirector, isSubmitting]);

  // Handle Regional Manager Selection
  useEffect(() => {
    const handleRegionalManagerSelection = async () => {
      if (isSubmitting || !userPermissions.canReadAgentsByLocation || !selectedRegionalManager) {
        setSupervisors([]);
        setRegions([]);
        setSelectedRegion("");
        setGovernorates([]);
        setSelectedGovernorate("");
        setDelegations([]);
        setSelectedDelegation("");
        setAgents([]);
        setSelectedAgent("");
        setDisableLocationInputs(false);
        setFetchMode("none");
        return;
      }
      try {
        const [supervisorsData, regionsData] = await Promise.all([
          getSupervisorsByRegionalManager(selectedRegionalManager),
          getRegionsByUser(selectedRegionalManager),
        ]);
        setSupervisors(supervisorsData);
        setRegions(regionsData);
        setSelectedRegion(regionsData.length === 1 ? regionsData[0].regionID : "");
        setGovernorates([]);
        setSelectedGovernorate("");
        setDelegations([]);
        setSelectedDelegation("");
        setAgents([]);
        setSelectedAgent("");
        setDisableLocationInputs(false);
        setFetchMode("none");
      } catch (err) {
        setError(t("timesheetForm.errors.loadRegionalManagerData"));
        console.error("Fetch regional manager data error:", err);
      }
    };
    handleRegionalManagerSelection();
  }, [selectedRegionalManager, userPermissions.canReadAgentsByLocation, isSubmitting]);

  // Handle Supervisor Selection
  useEffect(() => {
    const handleSupervisorSelection = async () => {
      if (isSubmitting || !supervisorID || fetchMode === "agent") {
        if (fetchMode !== "agent") {
          setSelectedRegionalManager("");
          setRegions([]);
          setSelectedRegion("");
          setGovernorates([]);
          setSelectedGovernorate("");
          setDelegations([]);
          setSelectedDelegation("");
          setAgents([]);
          setSelectedAgent("");
          setDisableLocationInputs(false);
          setFetchMode("none");
        }
        return;
      }
      try {
        const regionalManagers = await getRegionalManagerBySupervisor(supervisorID);
        const regionalManagerID = regionalManagers.length > 0 ? regionalManagers[0].userID : "";
        setSelectedRegionalManager(regionalManagerID);
        const regionsData = regionalManagerID ? await getRegionsByUser(regionalManagerID) : await getAllRegions();
        setRegions(regionsData);
        setSelectedRegion(regionsData.length === 1 ? regionsData[0].regionID : "");
        setGovernorates([]);
        setSelectedGovernorate("");
        setDelegations([]);
        setSelectedDelegation("");
        setAgents([]);
        setSelectedAgent("");
        setDisableLocationInputs(false);
        setFetchMode("supervisor");
      } catch (err) {
        setError(t("timesheetForm.errors.loadSupervisorData"));
        console.error("Fetch supervisor data error:", err);
      }
    };
    handleSupervisorSelection();
  }, [supervisorID, fetchMode, isSubmitting]);

  // Fetch Governorates when Region is Selected
  useEffect(() => {
    const fetchGovernorates = async () => {
      if (isSubmitting || !userPermissions.canReadAgentsByLocation || !selectedRegion || disableLocationInputs) {
        setGovernorates([]);
        setSelectedGovernorate("");
        setDelegations([]);
        setSelectedDelegation("");
        setAgents([]);
        setSelectedAgent("");
        return;
      }
      try {
        let governoratesData: Governorate[] = [];
        if (fetchMode === "supervisor" && supervisorID) {
          governoratesData = await getGovernoratesByRegion(selectedRegion);
          const supervisorGovernorates = await getGovernoratesByUser(supervisorID);
          governoratesData = governoratesData.filter((gov) =>
            supervisorGovernorates.some((sg) => sg.governorateID === gov.governorateID)
          );
        } else if (fetchMode === "none") {
          governoratesData = await getGovernoratesByRegion(selectedRegion);
        } else {
          return;
        }
        setGovernorates(governoratesData);
        setSelectedGovernorate(governoratesData.length === 1 ? governoratesData[0].governorateID : "");
        setDelegations([]);
        setSelectedDelegation("");
        setAgents([]);
        setSelectedAgent("");
      } catch (err) {
        setError(t("timesheetForm.errors.loadGovernorates"));
        console.error("Fetch governorates error:", err);
      }
    };
    fetchGovernorates();
  }, [selectedRegion, supervisorID, userPermissions.canReadAgentsByLocation, disableLocationInputs, fetchMode, isSubmitting]);

  // Fetch Delegations when Governorate is Selected
  useEffect(() => {
    const fetchDelegations = async () => {
      if (isSubmitting || !userPermissions.canReadAgentsByLocation || !selectedGovernorate || disableLocationInputs) {
        setDelegations([]);
        setSelectedDelegation("");
        setAgents([]);
        setSelectedAgent("");
        return;
      }
      try {
        let delegationsData: Delegation[] = [];
        if (fetchMode === "supervisor" && supervisorID) {
          delegationsData = await getDelegationsByGovernorate(selectedGovernorate);
          const supervisorDelegations = await getDelegationsByUser(supervisorID);
          delegationsData = delegationsData.filter((del) =>
            supervisorDelegations.some((sd) => sd.delegationID === del.delegationID)
          );
        } else if (fetchMode === "none") {
          delegationsData = await getDelegationsByGovernorate(selectedGovernorate);
        } else {
          return;
        }
        setDelegations(delegationsData);
        setSelectedDelegation(delegationsData.length === 1 ? delegationsData[0].delegationID : "");
        setAgents([]);
        setSelectedAgent("");
      } catch (err: unknown) {
        setError(t("timesheetForm.errors.loadDelegations"));
        console.error("Fetch delegations error:", err);
      }
    };
    fetchDelegations();
  }, [selectedGovernorate, supervisorID, userPermissions.canReadAgentsByLocation, disableLocationInputs, fetchMode, isSubmitting]);

  // Fetch Agents when Delegation is Selected
  useEffect(() => {
    const fetchAgents = async () => {
      if (isSubmitting || !userPermissions.canReadAgentsByLocation || !selectedDelegation || fetchMode === "agent") {
        if (fetchMode !== "agent") {
          setAgents([]);
          setSelectedAgent("");
        }
        return;
      }
      setAgentLoading(true);
      try {
        let agentsData: AgentsByDelegationResponse = { agents: [] };
        if (fetchMode === "supervisor" && supervisorID) {
          agentsData = await getAgentsByUser(supervisorID);
          agentsData.agents = agentsData.agents.filter((agent) => agent.delegationID === selectedDelegation);
        } else if (fetchMode === "none") {
          agentsData = await getAgentsByDelegation(selectedDelegation);
        }
        setAgents(agentsData.agents);
        setSelectedAgent(agentsData.agents.length === 1 ? agentsData.agents[0].agentID : "");
      } catch (err) {
        setError(t("timesheetForm.errors.loadAgents", { location: selectedDelegation }));
        console.error("Fetch agents error:", err);
      } finally {
        setAgentLoading(false);
      }
    };
    fetchAgents();
  }, [selectedDelegation, supervisorID, userPermissions.canReadAgentsByLocation, fetchMode, isSubmitting]);

  // Filter Regional Managers when Region is Selected
  useEffect(() => {
    const fetchRegionalManagersByRegion = async () => {
      if (isSubmitting || !(isSuperAdmin || isDirector) || selectedRegionalManager || supervisorID || !selectedRegion || fetchMode === "agent") {
        return;
      }
      try {
        const regionalManagersData = await getUsersByRegion(selectedRegion);
        const filteredRegionalManagers = regionalManagersData.filter((u) =>
          u.Roles?.some((role) => role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase())
        );
        setRegionalManagers(filteredRegionalManagers);
        setSelectedRegionalManager(filteredRegionalManagers.length === 1 ? filteredRegionalManagers[0].userID : "");
        setDisableRegionalManagerInput(filteredRegionalManagers.length === 1);
      } catch (err) {
        setError(t("timesheetForm.errors.loadRegionalManagers"));
        console.error("Fetch regional managers error:", err);
      }
    };
    fetchRegionalManagersByRegion();
  }, [isSuperAdmin, isDirector, selectedRegion, selectedRegionalManager, supervisorID, fetchMode, isSubmitting]);

  // Filter Supervisors when Governorate, Delegation, or Agent is Selected
  useEffect(() => {
    const filterSupervisorsByLocationOrAgent = async () => {
      if (isSubmitting || !userPermissions.canReadSupervisors || supervisorID || !(selectedAgent || selectedDelegation || selectedGovernorate) || fetchMode === "agent") {
        return;
      }
      setSupervisorLoading(true);
      try {
        let supervisorsData: User[] = [];
        if (selectedAgent) {
          const agent = await getAgentById(selectedAgent);
          if (agent?.supervisorID) {
            const supervisor = await getUserById(agent.supervisorID);
            supervisorsData = [supervisor];
          }
        } else if (selectedDelegation) {
          supervisorsData = await getUsersByDelegation(selectedDelegation);
          supervisorsData = supervisorsData.filter((u) =>
            u.Roles?.some((role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase())
          );
        } else if (selectedGovernorate) {
          supervisorsData = await getUsersByGovernorate(selectedGovernorate);
          supervisorsData = supervisorsData.filter((u) =>
            u.Roles?.some((role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase())
          );
        }
        setSupervisors(supervisorsData);
        setSelectedSupervisor(supervisorsData.length === 1 ? supervisorsData[0].userID : "");
        setDisableSupervisorInput(supervisorsData.length === 1);
      } catch (err) {
        setError(t("timesheetForm.errors.loadSupervisors"));
        console.error("Fetch supervisors error:", err);
      } finally {
        setSupervisorLoading(false);
      }
    };
    filterSupervisorsByLocationOrAgent();
  }, [
    selectedGovernorate,
    selectedDelegation,
    selectedAgent,
    supervisorID,
    userPermissions.canReadSupervisors,
    fetchMode,
    isSubmitting,
  ]);

  // Debounced Fetch Agent by Phone
  const fetchAgentByPhone = useCallback(
    debounce(async (phone: string) => {
      if (isSubmitting || phone.length !== 8 || !userPermissions.canReadAgentsByPhone) return;
      setAgentLoading(true);
      try {
        const agentData = await getAgentByPhone(phone);
        if (!agentData) throw new Error("Agent not found");
        if (!agentData.delegationID) throw new Error("Agent has no delegation assigned");

        let supervisor: User | null = null;
        if (agentData.supervisorID) {
          supervisor = await getUserById(agentData.supervisorID);
        } else {
          throw new Error("Agent has no supervisor assigned");
        }

        const allDelegations = await getAllDelegations();
        const agentDelegation = allDelegations.find((del) => del.delegationID === agentData.delegationID);
        if (!agentDelegation) throw new Error("Delegation not found");
        const supervisorDelegations = await getDelegationsByUser(supervisor.userID);
        if (!supervisorDelegations.some((sd) => sd.delegationID === agentData.delegationID)) {
          throw new Error("Agent's delegation is not assigned to the supervisor");
        }

        const governoratesData = await getGovernoratesByDelegation(agentData.delegationID);
        if (governoratesData.length === 0) throw new Error("No governorate found for delegation");
        if (governoratesData.length > 1) throw new Error("Multiple governorates found for delegation");
        const supervisorGovernorates = await getGovernoratesByUser(supervisor.userID);
        if (!supervisorGovernorates.some((sg) => sg.governorateID === governoratesData[0].governorateID)) {
          throw new Error("Delegation's governorate is not assigned to the supervisor");
        }

        const regionsData = await getRegionsByGovernorate(governoratesData[0].governorateID);
        if (regionsData.length === 0) throw new Error("No region found for governorate");
        if (regionsData.length > 1) throw new Error("Multiple regions found for governorate");

        setSelectedAgent(agentData.agentID);
        setAgents([agentData]);
        setAgentSearch(`${agentData.name || ""} ${agentData.lastname || ""}`);
        setSelectedDelegation(agentData.delegationID);
        setDelegations([agentDelegation]);
        setSelectedGovernorate(governoratesData[0].governorateID);
        setGovernorates(governoratesData);
        setSelectedRegion(regionsData[0].regionID);
        setRegions(regionsData);
        setSelectedSupervisor(supervisor.userID);
        setSupervisors([supervisor]);
        setDisableSupervisorInput(true);

        const regionalManagersData = await getUsersByRegion(regionsData[0].regionID);
        const filteredRegionalManagers = regionalManagersData.filter((u) =>
          u.Roles?.some((role) => role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase())
        );
        setRegionalManagers(filteredRegionalManagers);
        if (filteredRegionalManagers.length === 1) {
          setSelectedRegionalManager(filteredRegionalManagers[0].userID);
          setDisableRegionalManagerInput(true);
        } else {
          setSelectedRegionalManager("");
          setDisableRegionalManagerInput(false);
        }

        setDisableLocationInputs(true);
        setFetchMode("agent");
      } catch (err: any) {
        setError(t("timesheetForm.errors.agentNotFound") + `: ${err.message}`);
        setSelectedAgent("");
        setAgents([]);
        setAgentSearch("");
        setSelectedDelegation("");
        setDelegations([]);
        setSelectedGovernorate("");
        setGovernorates([]);
        setSelectedRegion("");
        setRegions([]);
        setSelectedSupervisor("");
        setSupervisors([]);
        setSelectedRegionalManager("");
        setRegionalManagers([]);
        setDisableLocationInputs(false);
        setDisableSupervisorInput(false);
        setDisableRegionalManagerInput(false);
        setFetchMode("none");
        console.error("Fetch agent by phone error:", err);
      } finally {
        setAgentLoading(false);
      }
    }, 500),
    [userPermissions.canReadAgentsByPhone, isSubmitting]
  );

  // Handle Agent Phone Input and Reset
  useEffect(() => {
    if (isSubmitting) return;
    if (agentPhone) {
      fetchAgentByPhone(agentPhone);
    } else {
      resetForm();
      const refetchInitialData = async () => {
        try {
          const promises = [
            userPermissions.canReadSupervisors && (isSuperAdmin || isDirector || isRegionalManager)
              ? isRegionalManager
                ? getSupervisorsByRegionalManager(user.userID)
                : getAllUsers().then((users) => users.filter((u) => u.Roles?.some((role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase())))
              : Promise.resolve([]),
            (isSuperAdmin || isDirector)
              ? getAllUsers().then((users) => users.filter((u) => u.Roles?.some((role) => role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase())))
              : Promise.resolve([]),
            userPermissions.canReadAgentsByLocation
              ? isSupervisor
                ? getRegionalManagerBySupervisor(user.userID).then((rms) => rms.length > 0 ? getRegionsByUser(rms[0].userID) : [])
                : isRegionalManager
                  ? getRegionsByUser(user.userID)
                  : getAllRegions()
              : Promise.resolve([]),
          ];
          const [supervisorsData, regionalManagersData, regionsData] = await Promise.all(promises);
          setSupervisors(supervisorsData as User[]);
          setRegionalManagers(regionalManagersData as User[]);
          setRegions(regionsData as Region[]);
        } catch (err) {
          setError(t("timesheetForm.errors.loadInitialData"));
          console.error("Refetch initial data error:", err);
        }
      };
      refetchInitialData();
    }
    return () => fetchAgentByPhone.cancel();
  }, [agentPhone, fetchAgentByPhone, userPermissions, user.userID, isSuperAdmin, isRegionalManager, isSupervisor, isDirector, isSubmitting, resetForm]);

  // Debounced Fetch Supervisor by Phone
  const fetchSupervisorByPhone = useCallback(
    debounce(async (phone: string) => {
      if (isSubmitting || phone.length < 8 || !userPermissions.canReadSupervisors || !userPermissions.canCreateTimesheetsForSupervisors) return;
      setSupervisorLoading(true);
      try {
        const supervisor = await getUserByPhone(phone);
        if ((isSuperAdmin || isDirector || isRegionalManager) && !supervisor.Roles?.some((role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase())) {
          throw new Error("User is not a supervisor");
        }
        setSelectedSupervisor(supervisor.userID);
        setSupervisors((prev) => prev.some((s) => s.userID === supervisor.userID) ? prev : [...prev, supervisor]);
        setSupervisorSearch(`${supervisor.firstname || ""} ${supervisor.lastname || ""}`);
        const regionalManagers = await getRegionalManagerBySupervisor(supervisor.userID);
        if (regionalManagers.length > 0) {
          setSelectedRegionalManager(regionalManagers[0].userID);
          setDisableRegionalManagerInput(true);
        }
        setFetchMode("supervisor");
      } catch (err) {
        setError(t("timesheetForm.errors.supervisorNotFound"));
        setSelectedSupervisor("");
        setFetchMode("none");
        console.error("Fetch supervisor by phone error:", err);
      } finally {
        setSupervisorLoading(false);
      }
    }, 500),
    [userPermissions.canReadSupervisors, userPermissions.canCreateTimesheetsForSupervisors, isSuperAdmin, isDirector, isRegionalManager, isSubmitting]
  );

  useEffect(() => {
    if (isSubmitting) return;
    if (supervisorPhone && userPermissions.canCreateTimesheetsForSupervisors && userPermissions.canReadSupervisors && !isSupervisor) {
      fetchSupervisorByPhone(supervisorPhone);
    } else if (userPermissions.canCreateTimesheetsForSupervisors) {
      setSupervisorSearch("");
      if (!isSupervisor) setFetchMode("none");
    }
    return () => fetchSupervisorByPhone.cancel();
  }, [supervisorPhone, userPermissions.canCreateTimesheetsForSupervisors, userPermissions.canReadSupervisors, isSupervisor, fetchSupervisorByPhone, isSubmitting]);

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
    setIsSubmitting(true);
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
      toast.success(t("timesheetForm.success.created"));
      resetForm();
      navigate("/timesheet");
    } catch (err: any) {
      console.error("Submit error:", err);
      if (err.message.includes("Google Calendar sync failed")) {
        toast.success(t("timesheetForm.success.partialSuccess"));
        resetForm();
        navigate("/timesheet");
      } else {
        setError(t("timesheetForm.errors.createFailed"));
      }
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const isFormComplete = useMemo(
    () =>
      date &&
      time &&
      selectedAgent &&
      selectedReasons.length > 0 &&
      selectedChecklists.length > 0 &&
      (isSupervisor || supervisorID) &&
      selectedRegion &&
      selectedGovernorate &&
      selectedDelegation,
    [
      date,
      time,
      selectedAgent,
      selectedReasons,
      selectedChecklists,
      isSupervisor,
      supervisorID,
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
          {(isSuperAdmin || isDirector) && !isRegionalManager && !isSupervisor && (
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
                disabled={disableRegionalManagerInput}
              />
              <select
                id="regionalManager"
                value={selectedRegionalManager}
                onChange={(e) => {
                  setSelectedRegionalManager(e.target.value);
                  setSelectedSupervisor("");
                  setSelectedRegion("");
                  setSelectedGovernorate("");
                  setSelectedDelegation("");
                  setSelectedAgent("");
                  setDisableLocationInputs(false);
                  setDisableSupervisorInput(false);
                  setDisableRegionalManagerInput(false);
                  setFetchMode("none");
                }}
                aria-label={t("timesheetForm.form.placeholders.regionalManagerSelect")}
                disabled={disableRegionalManagerInput}
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

          {(isSuperAdmin || isDirector || isRegionalManager) && !isSupervisor && userPermissions.canCreateTimesheetsForSupervisors && userPermissions.canReadSupervisors && (
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
                disabled={supervisorLoading || disableSupervisorInput}
              />
              <input
                type="tel"
                id="supervisor-phone"
                placeholder={t("timesheetForm.form.placeholders.supervisorPhone")}
                value={supervisorPhone}
                onChange={(e) => setSupervisorPhone(e.target.value)}
                className="search-input"
                aria-label={t("timesheetForm.form.placeholders.supervisorPhone")}
                disabled={supervisorLoading || disableSupervisorInput}
              />
              {supervisorLoading && <span className="loading-spinner" aria-hidden="true"></span>}
              <select
                id="supervisor"
                value={selectedSupervisor}
                onChange={(e) => {
                  setSelectedSupervisor(e.target.value);
                  setSelectedRegion("");
                  setSelectedGovernorate("");
                  setSelectedDelegation("");
                  setSelectedAgent("");
                  setDisableLocationInputs(false);
                  setDisableSupervisorInput(false);
                  setFetchMode("supervisor");
                }}
                required
                aria-label={t("timesheetForm.form.placeholders.supervisorSelect")}
                disabled={supervisorLoading || disableSupervisorInput}
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

          <div className="form-group">
            <label htmlFor="region">{t("timesheetForm.form.region")} <span aria-hidden>*</span></label>
            <select
              id="region"
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedGovernorate("");
                setSelectedDelegation("");
                setSelectedAgent("");
                setFetchMode(fetchMode === "supervisor" ? "supervisor" : "none");
              }}
              required
              aria-label={t("timesheetForm.form.placeholders.regionSelect")}
              disabled={disableLocationInputs || !userPermissions.canReadAgentsByLocation}
            >
              <option value="">{t("timesheetForm.form.placeholders.regionSelect")}</option>
              {regions.map((region) => (
                <option key={region.regionID} value={region.regionID}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="governorate">{t("timesheetForm.form.governorate")} <span aria-hidden>*</span></label>
            <select
              id="governorate"
              value={selectedGovernorate}
              onChange={(e) => {
                setSelectedGovernorate(e.target.value);
                setSelectedDelegation("");
                setSelectedAgent("");
                setFetchMode(fetchMode === "supervisor" ? "supervisor" : "none");
              }}
              required
              aria-label={t("timesheetForm.form.placeholders.governorateSelect")}
              disabled={disableLocationInputs || !userPermissions.canReadAgentsByLocation}
            >
              <option value="">{t("timesheetForm.form.placeholders.governorateSelect")}</option>
              {governorates.map((gov) => (
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
              onChange={(e) => {
                setSelectedDelegation(e.target.value);
                setSelectedAgent("");
                setFetchMode(fetchMode === "supervisor" ? "supervisor" : "none");
              }}
              required
              aria-label={t("timesheetForm.form.placeholders.delegationSelect")}
              disabled={disableLocationInputs || !userPermissions.canReadAgentsByLocation}
            >
              <option value="">{t("timesheetForm.form.placeholders.delegationSelect")}</option>
              {delegations.map((del) => (
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