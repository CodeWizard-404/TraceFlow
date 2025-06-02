/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  getLocationDetailsById,
} from "../../apis/locationApi";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { createTimesheet } from "../../apis/timesheetAPI";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import { useAuth } from "../../context/AuthContext";
import { useError } from "../../context/ErrorContext";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

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
  const [searchParams] = useSearchParams();

  // State Declarations
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [isRecruitmentVisit, setIsRecruitmentVisit] = useState<boolean>(false);
  const [regionalManagers, setRegionalManagers] = useState<User[]>([]);
  const [allRegionalManagers, setAllRegionalManagers] = useState<User[]>([]);
  const [selectedRegionalManager, setSelectedRegionalManager] = useState<string>("");
  const [regionalManagerSearch, setRegionalManagerSearch] = useState<string>("");
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [allSupervisors, setAllSupervisors] = useState<User[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");
  const [supervisorSearch, setSupervisorSearch] = useState<string>("");
  const [agentPhone, setAgentPhone] = useState<string>("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("");
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [selectedDelegation, setSelectedDelegation] = useState<string>("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [agentLocation, setAgentLocation] = useState<string>("");
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [filteredReasons, setFilteredReasons] = useState<Reason[]>([]);
  const [reasonSearch, setReasonSearch] = useState<string>("");
  const [selectedReasons, setSelectedReasons] = useState<Array<{ id?: string }>>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [filteredChecklists, setFilteredChecklists] = useState<Checklist[]>([]);
  const [checklistSearch, setChecklistSearch] = useState<string>("");
  const [selectedChecklists, setSelectedChecklists] = useState<Array<{ id?: string }>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [agentLoading, setAgentLoading] = useState<boolean>(false);

  // Track previous selectedSupervisor to detect changes
  const prevSelectedSupervisor = useRef<string>("");

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

  // Construct location string
  const location = useMemo(() => {
    const parts: string[] = [];
    if (selectedRegion) {
      const region = regions.find(r => r.regionID === selectedRegion);
      if (region) parts.push(region.name);
    }
    if (selectedGovernorate) {
      const governorate = governorates.find(g => g.governorateID === selectedGovernorate);
      if (governorate) parts.push(governorate.name);
    }
    if (selectedDelegation) {
      const delegation = delegations.find(d => d.delegationID === selectedDelegation);
      if (delegation) parts.push(delegation.name);
    }
    return parts.length > 0 ? parts.join(", ") : null;
  }, [selectedRegion, selectedGovernorate, selectedDelegation, regions, governorates, delegations]);

  // Form Completion Check
  const isFormComplete = useMemo(() =>
    date &&
    time &&
    (isRecruitmentVisit || selectedAgent) &&
    selectedReasons.length > 0 &&
    selectedChecklists.length > 0 &&
    (isSupervisor || selectedSupervisor),
    [date, time, isRecruitmentVisit, selectedAgent, selectedReasons, selectedChecklists, isSupervisor, selectedSupervisor]
  );

  // Handlers for form input changes
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value);
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => setTime(e.target.value);
  const handleRecruitmentVisitToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsRecruitmentVisit(e.target.checked);
    if (e.target.checked) {
      setSelectedAgent("");
      setAgentPhone("");
      setAgents([]);
      setAgentLocation("");
      const recruitmentReason = reasons.find(r => r.item.toLowerCase() === "recruitment");
      if (recruitmentReason && !selectedReasons.some(r => r.id === recruitmentReason.reasonID)) {
        setSelectedReasons([{ id: recruitmentReason.reasonID }]);
      }
    }
  };
  const handleRegionalManagerChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedRegionalManager(e.target.value);
  const handleSupervisorChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSupervisor(e.target.value);
  const handleAgentPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => setAgentPhone(e.target.value);
  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRegion(e.target.value);
    setSelectedGovernorate("");
    setSelectedDelegation("");
  };
  const handleGovernorateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGovernorate(e.target.value);
    setSelectedDelegation("");
  };
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
  const handleReasonSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value;
    setReasonSearch(searchTerm);
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
    setChecklistSearch(searchTerm);
    if (searchTerm) {
      setFilteredChecklists(checklists.filter(c =>
        c.item.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    } else {
      setFilteredChecklists(checklists);
    }
  };
  const handleSupervisorSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchTerm = e.target.value;
    setSupervisorSearch(searchTerm);
    let filteredSupervisors = [...allSupervisors];
    if (searchTerm) {
      filteredSupervisors = filteredSupervisors.filter(s =>
        `${s.firstname} ${s.lastname} ${s.phone}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    const applyAdditionalFilters = async () => {
      const promises: Promise<User[]>[] = [];
      // Only apply regional manager filter if selectedSupervisor changed and regional manager is selected
      if (selectedRegionalManager && prevSelectedSupervisor.current !== selectedSupervisor) {
        promises.push(getSupervisorsByRegionalManager(selectedRegionalManager));
      }
      if (selectedGovernorate) promises.push(getUsersByGovernorate(selectedGovernorate).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.SUPERVISOR))));
      if (selectedDelegation) promises.push(getUsersByDelegation(selectedDelegation).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.SUPERVISOR))));
      if (selectedAgent) promises.push(getAgentById(selectedAgent).then(agent => agent?.supervisorID ? [allSupervisors.find(u => u.userID === agent.supervisorID)!].filter(u => u) : []));
      if (promises.length > 0) {
        try {
          const results = await Promise.all(promises);
          filteredSupervisors = results.reduce((acc, curr) => acc.filter(a => curr.some(c => c.userID === a.userID)), filteredSupervisors);
        } catch (err) {
          setError(t("timesheetForm.errors.loadSupervisors"));
        }
      }
      setSupervisors(filteredSupervisors);
      if (filteredSupervisors.length === 1) {
        setSelectedSupervisor(filteredSupervisors[0].userID);
      } else if (!filteredSupervisors.some(s => s.userID === selectedSupervisor)) {
        setSelectedSupervisor("");
      }
    };
    applyAdditionalFilters();
  };

  // Update prevSelectedSupervisor when selectedSupervisor changes
  useEffect(() => {
    prevSelectedSupervisor.current = selectedSupervisor;
  }, [selectedSupervisor]);

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
      if (phone.length !== 8 || isRecruitmentVisit) return;
      setAgentLoading(true);
      try {
        const agent = await getAgentByPhone(phone);
        if (agent) {
          setAgents([agent]);
          setSelectedAgent(agent.agentID);
          if (agent.delegationID) {
            const locationDetails = await getLocationDetailsById(agent.delegationID);
            if (locationDetails.success && locationDetails.address) {
              setAgentLocation(locationDetails.address);
            } else {
              setAgentLocation("");
            }
          }
        } else {
          setAgents([]);
          setSelectedAgent("");
          setAgentPhone("");
          setAgentLocation("");
          setError(t("timesheetForm.errors.agentNotFound"));
        }
      } catch (err) {
        setAgents([]);
        setSelectedAgent("");
        setAgentPhone("");
        setAgentLocation("");
        setError(t("timesheetForm.errors.agentNotFound"));
      } finally {
        setAgentLoading(false);
      }
    }, 500),
    [setError, t, isRecruitmentVisit]
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
        agentID: isRecruitmentVisit ? null : selectedAgent,
        location: location,
        reasons: selectedReasons
          .filter((r) => r.id !== undefined)
          .map((r) => ({ id: r.id! })),
        checklists: selectedChecklists
          .filter((c) => c.id !== undefined)
          .map((c) => ({ id: c.id! })),
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

  // Fetch initial data (regions, reasons, checklists, regional managers, supervisors)
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [regionsData, reasonsData, checkpointsData, regionalManagersData, supervisorsData] = await Promise.all([
          getAllRegions(),
          getAllReasons(),
          getAllChecklists(),
          getUsersByRole(ROLES.REGIONAL_MANAGER),
          getUsersByRole(ROLES.SUPERVISOR),
        ]);
        setRegions(regionsData);
        setReasons(reasonsData);
        setFilteredReasons(reasonsData);
        setChecklists(checkpointsData);
        setFilteredChecklists(checkpointsData);
        setAllRegionalManagers(regionalManagersData);
        setRegionalManagers(regionalManagersData);
        setAllSupervisors(supervisorsData);
        setSupervisors(supervisorsData);

        const agentId = searchParams.get('agentId');
        const dateParam = searchParams.get('date');
        const timeParam = searchParams.get('time');

        if (dateParam) setDate(dateParam);
        if (timeParam) setTime(timeParam);

        if (agentId) {
          try {
            const agent = await getAgentById(agentId);
            if (agent) {
              setAgents([agent]);
              setSelectedAgent(agent.agentID);
              setAgentPhone(agent.phone);
              if (agent.delegationID) {
                const locationDetails = await getLocationDetailsById(agent.delegationID);
                if (locationDetails.success && locationDetails.address) {
                  setAgentLocation(locationDetails.address);
                }
              }
              if (agent.supervisorID) {
                setSelectedSupervisor(agent.supervisorID);
                const supervisor = supervisorsData.find(s => s.userID === agent.supervisorID);
                if (supervisor) {
                  setSupervisors([supervisor]);
                }
              }
            }
          } catch (err) {
            setError(t('timesheetForm.errors.agentNotFound'));
          }
        }

        if (reasonsData.length === 1 && !isRecruitmentVisit) {
          setSelectedReasons([{ id: reasonsData[0].reasonID }]);
        }
        if (checkpointsData.length === 1) {
          setSelectedChecklists([{ id: checkpointsData[0].checklistID }]);
        }
      } catch (err) {
        setError(t('timesheetForm.errors.loadInitialData'));
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [setError, t, isRecruitmentVisit, searchParams]);

  // Filter regional managers based on search and filters
  useEffect(() => {
    const filterRegionalManagers = async () => {
      if (!(isSuperAdmin || isDirector)) {
        setRegionalManagers([]);
        return;
      }
      try {
        let rmList = [...allRegionalManagers];
        if (selectedSupervisor && selectedRegion) {
          const [supervisorRM, regionRM] = await Promise.all([
            getRegionalManagerBySupervisor(selectedSupervisor),
            getUsersByRegion(selectedRegion).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.REGIONAL_MANAGER))),
          ]);
          rmList = rmList.filter(rm =>
            supervisorRM.some(srm => srm.userID === rm.userID) &&
            regionRM.some(rrm => rrm.userID === rm.userID)
          );
        } else if (selectedSupervisor) {
          const supervisorRM = await getRegionalManagerBySupervisor(selectedSupervisor);
          rmList = rmList.filter(rm => supervisorRM.some(srm => srm.userID === rm.userID));
        } else if (selectedRegion) {
          const regionRM = await getUsersByRegion(selectedRegion).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.REGIONAL_MANAGER)));
          rmList = rmList.filter(rm => regionRM.some(rrm => rrm.userID === rm.userID));
        }
        if (regionalManagerSearch) {
          rmList = rmList.filter(rm =>
            `${rm.firstname} ${rm.lastname} ${rm.phone}`.toLowerCase().includes(regionalManagerSearch.toLowerCase())
          );
        }
        setRegionalManagers(rmList);
        if (rmList.length === 1) {
          setSelectedRegionalManager(rmList[0].userID);
        } else if (!rmList.some(rm => rm.userID === selectedRegionalManager)) {
          setSelectedRegionalManager("");
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadRegionalManagers"));
      }
    };
    filterRegionalManagers();
  }, [isSuperAdmin, isDirector, selectedSupervisor, selectedRegion, regionalManagerSearch, allRegionalManagers, setError, t]);

  // Fetch regions based on supervisor's regional manager (logged-in or selected)
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        let regionsData: Region[] = [];
        const currentSupervisor = isSupervisor ? user!.userID : selectedSupervisor;
        if (currentSupervisor) {
          // Get the regional manager(s) of the current supervisor
          const supervisorRMs = await getRegionalManagerBySupervisor(currentSupervisor);
          if (supervisorRMs.length > 0) {
            // Fetch regions for the first regional manager (assuming a supervisor has one primary RM)
            regionsData = await getRegionsByUser(supervisorRMs[0].userID);
          } else {
            // Fallback to all regions if no regional manager is found
            regionsData = await getAllRegions();
          }
        } else {
          // If no supervisor is available, fetch all regions
          regionsData = await getAllRegions();
        }
        setRegions(regionsData);
        if (regionsData.length === 1) {
          setSelectedRegion(regionsData[0].regionID);
        } else {
          setSelectedRegion("");
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadRegions"));
      }
    };
    fetchRegions();
  }, [isSupervisor, user, selectedSupervisor, setError, t]);

  // Fetch governorates based on supervisor (logged-in or selected) and region
  useEffect(() => {
    const fetchGovernorates = async () => {
      const currentSupervisor = isSupervisor ? user!.userID : selectedSupervisor;
      if (!selectedRegion || !currentSupervisor) {
        setGovernorates([]);
        setSelectedGovernorate("");
        setDelegations([]);
        setSelectedDelegation("");
        return;
      }
      try {
        // Fetch governorates for the selected region
        let govList: Governorate[] = await getGovernoratesByRegion(selectedRegion);
        // Filter by supervisor's governorates
        const userGovs = await getGovernoratesByUser(currentSupervisor);
        govList = govList.filter(g => userGovs.some(ug => ug.governorateID === g.governorateID));
        setGovernorates(govList);
        if (govList.length === 1) {
          setSelectedGovernorate(govList[0].governorateID);
        } else {
          setSelectedGovernorate("");
        }
        setDelegations([]);
        setSelectedDelegation("");
      } catch (err) {
        setError(t("timesheetForm.errors.loadGovernorates"));
      }
    };
    fetchGovernorates();
  }, [selectedRegion, isSupervisor, user, selectedSupervisor, setError, t]);

  // Fetch delegations based on supervisor (logged-in or selected) and governorate
  useEffect(() => {
    const fetchDelegations = async () => {
      const currentSupervisor = isSupervisor ? user!.userID : selectedSupervisor;
      if (!selectedGovernorate || !currentSupervisor) {
        setDelegations([]);
        setSelectedDelegation("");
        return;
      }
      try {
        // Fetch delegations for the selected governorate
        let delList: Delegation[] = await getDelegationsByGovernorate(selectedGovernorate);
        // Filter by supervisor's delegations
        const userDels = await getDelegationsByUser(currentSupervisor);
        delList = delList.filter(d => userDels.some(ud => ud.delegationID === d.delegationID));
        setDelegations(delList);
        if (delList.length === 1) {
          setSelectedDelegation(delList[0].delegationID);
        } else {
          setSelectedDelegation("");
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadDelegations"));
      }
    };
    fetchDelegations();
  }, [selectedGovernorate, isSupervisor, user, selectedSupervisor, setError, t]);

  // Fetch agents based on supervisor (logged-in or selected) and governorate
  useEffect(() => {
    const fetchAgents = async () => {
      const currentSupervisor = isSupervisor ? user!.userID : selectedSupervisor;
      if (!currentSupervisor || (!agentPhone && !selectedGovernorate)) {
        setAgents([]);
        setSelectedAgent("");
        setAgentLocation("");
        return;
      }
      try {
        let agentList: Agent[] = [];
        // Fetch agents by supervisor
        const userAgents = await getAgentsByUser(currentSupervisor);
        if (selectedGovernorate) {
          // Fetch agents by delegation if a governorate is selected (via delegations)
          const delList = await getDelegationsByGovernorate(selectedGovernorate);
          const delAgentsPromises = delList.map(d => getAgentsByDelegation(d.delegationID));
          const delAgentsResults = await Promise.all(delAgentsPromises);
          const delAgents = delAgentsResults.flatMap(result => result.agents);
          // Filter agents to those under the supervisor and in the governorate's delegations
          agentList = userAgents.agents.filter(a => delAgents.some(da => da.agentID === a.agentID));
        } else {
          // If no governorate, use only supervisor's agents
          agentList = userAgents.agents;
        }
        setAgents(agentList);
        if (agentList.length === 1) {
          setSelectedAgent(agentList[0].agentID);
          if (agentList[0].delegationID) {
            const locationDetails = await getLocationDetailsById(agentList[0].delegationID);
            if (locationDetails.success && locationDetails.address) {
              setAgentLocation(locationDetails.address);
            } else {
              setAgentLocation("");
            }
          }
        } else {
          setSelectedAgent("");
          setAgentLocation("");
        }
      } catch (err) {
        setError(t("timesheetForm.errors.loadAgents"));
      }
    };
    if (!agentPhone) fetchAgents();
  }, [isSupervisor, user, selectedSupervisor, selectedGovernorate, setError, t, agentPhone]);

  // Fetch agent by phone number, filter by supervisor (logged-in or selected) and governorate
  useEffect(() => {
    const fetchAgentByPhoneWithFilters = async () => {
      const currentSupervisor = isSupervisor ? user!.userID : selectedSupervisor;
      if (!agentPhone || agentPhone.length !== 8 || isRecruitmentVisit || !currentSupervisor) {
        setAgents([]);
        setSelectedAgent("");
        setAgentLocation("");
        return;
      }
      setAgentLoading(true);
      try {
        const agent = await getAgentByPhone(agentPhone);
        if (agent) {
          // Fetch supervisor's agents
          const userAgents = await getAgentsByUser(currentSupervisor);
          const isAgentUnderSupervisor = userAgents.agents.some(ua => ua.agentID === agent.agentID);
          if (!isAgentUnderSupervisor) {
            setAgents([]);
            setSelectedAgent("");
            setAgentPhone("");
            setAgentLocation("");
            setError(t("timesheetForm.errors.agentNotUnderSupervisor"));
            return;
          }
          // If governorate is selected, check if agent is in one of its delegations
          if (selectedGovernorate) {
            const delList = await getDelegationsByGovernorate(selectedGovernorate);
            const delAgentsPromises = delList.map(d => getAgentsByDelegation(d.delegationID));
            const delAgentsResults = await Promise.all(delAgentsPromises);
            const delAgents = delAgentsResults.flatMap(result => result.agents);
            const isAgentInGovernorate = delAgents.some(da => da.agentID === agent.agentID);
            if (!isAgentInGovernorate) {
              setAgents([]);
              setSelectedAgent("");
              setAgentPhone("");
              setAgentLocation("");
              setError(t("timesheetForm.errors.agentNotInGovernorate"));
              return;
            }
          }
          setAgents([agent]);
          setSelectedAgent(agent.agentID);
          if (agent.delegationID) {
            const locationDetails = await getLocationDetailsById(agent.delegationID);
            if (locationDetails.success && locationDetails.address) {
              setAgentLocation(locationDetails.address);
            } else {
              setAgentLocation("");
            }
          }
        } else {
          setAgents([]);
          setSelectedAgent("");
          setAgentPhone("");
          setAgentLocation("");
          setError(t("timesheetForm.errors.agentNotFound"));
        }
      } catch (err) {
        setAgents([]);
        setSelectedAgent("");
        setAgentPhone("");
        setAgentLocation("");
        setError(t("timesheetForm.errors.agentNotFound"));
      } finally {
        setAgentLoading(false);
      }
    };
    fetchAgentByPhoneWithFilters();
  }, [agentPhone, isSupervisor, user, selectedSupervisor, selectedGovernorate, isRecruitmentVisit, setError, t]);

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
                  onChange={handleSupervisorSearchChange}
                  placeholder={t("timesheetForm.form.placeholders.supervisorSearch")}
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
            <div className="form-group" style={{ margin: 0 }}>
              <label className="custom-checkbox-label" htmlFor="recruitmentVisit">
                <input
                  type="checkbox"
                  id="recruitmentVisit"
                  checked={isRecruitmentVisit}
                  onChange={handleRecruitmentVisitToggle}
                  className="custom-checkbox-input"
                />
                <span className="custom-checkbox">
                  <i className="fas fa-check check-icon"></i>
                </span>
                <span className="checklist-text">{t("timesheetForm.form.recruitmentVisit")}</span>
              </label>
            </div>
            <hr />
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
                <select
                  id="governorate"
                  value={selectedGovernorate}
                  onChange={handleGovernorateChange}
                  disabled={!selectedRegion}
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
                  value={selectedDelegation}
                  onChange={handleDelegationChange}
                  disabled={!selectedGovernorate}
                >
                  <option value="">{t("timesheetForm.form.placeholders.delegationSelect")}</option>
                  {delegations.map(d => (
                    <option key={d.delegationID} value={d.delegationID}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {!isRecruitmentVisit && (
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
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="agent">{t("timesheetForm.form.agent")}</label>
                  {agentLoading && <span className="loading-spinner"></span>}
                  <select
                    id="agent"
                    value={selectedAgent}
                    onChange={handleAgentChange}
                    disabled={!(agentPhone || selectedDelegation)}
                  >
                    <option value="">{t("timesheetForm.form.placeholders.agentSelect")}</option>
                    {agents.map(a => (
                      <option key={a.agentID} value={a.agentID}>{`${a.name} ${a.lastname} (${a.phone})`}</option>
                    ))}
                  </select>
                  {selectedAgent && agentLocation && (
                    <div className="agent-location">
                      {t("timesheetForm.form.agentLocation")}: {agentLocation}
                    </div>
                  )}
                </div>
              </>
            )}
            <hr />
            <div className="form-group" style={{ marginBottom: "0 !important" }}>
              <label>{t("timesheetForm.form.reasons")}</label>
              <input
                type="text"
                value={reasonSearch}
                onChange={handleReasonSearchChange}
                placeholder={t("timesheetForm.form.placeholders.reasonSearch")}
              />
              <select
                value=""
                onChange={(e) => handleReasonSelect(reasons.find(r => r.reasonID === e.target.value)!)}
                disabled={isRecruitmentVisit && selectedReasons.some(r => r.id === reasons.find(r => r.item.toLowerCase() === "recruitment")?.reasonID)}
              >
                <option value="">{t("timesheetForm.form.placeholders.reasonSelect")}</option>
                {filteredReasons.map(r => (
                  <option key={r.reasonID} value={r.reasonID}>{r.item}</option>
                ))}
              </select>
              <div className="selected-items">
                {selectedReasons.map((r, i) => (
                  <span
                    key={i}
                    className="selected-item"
                    onClick={() => setSelectedReasons(selectedReasons.filter((_, idx) => idx !== i))}
                  >
                    {reasons.find(re => re.reasonID === r.id)?.item} ×
                  </span>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>{t("timesheetForm.form.checklists")}</label>
              <input
                type="text"
                value={checklistSearch}
                onChange={handleChecklistSearchChange}
                placeholder={t("timesheetForm.form.placeholders.checklistSearch")}
              />
              <select
                value=""
                onChange={(e) => handleChecklistSelect(checklists.find(c => c.checklistID === e.target.value)!)}
              >
                <option value="">{t("timesheetForm.form.placeholders.checklistSelect")}</option>
                {filteredChecklists.map(c => (
                  <option key={c.checklistID} value={c.checklistID}>{c.item}</option>
                ))}
              </select>
              <div className="selected-items">
                {selectedChecklists.map((c, i) => (
                  <span
                    key={i}
                    className="selected-item"
                    onClick={() => setSelectedChecklists(selectedChecklists.filter((_, idx) => idx !== i))}
                  >
                    {checklists.find(ch => ch.checklistID === c.id)?.item} ×
                  </span>
                ))}
              </div>
            </div>
            <div className="form-actions form-actions-6">
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