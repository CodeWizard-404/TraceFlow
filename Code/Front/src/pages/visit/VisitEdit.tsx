/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { debounce } from "lodash";
import { FaListUl, FaArrowLeft } from "react-icons/fa";
import "./VisitDetails.css";
import "../Timesheet/TimesheetForm.css";
import { useAuth } from "../../context/AuthContext";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";
import User from "../../models/User";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import Region from "../../models/Region";
import Governorate from "../../models/Governorate";
import Delegation from "../../models/Delegation";
import {
    getAgentById,
    getAgentsByDelegation,
    getAgentByPhone,
    getAgentsByUser,
} from "../../apis/agentAPI";
import {
    getSupervisorsByRegionalManager,
    getRegionalManagerBySupervisor,
    getUsersByRole,
    getUsersByRegion,
    getUsersByGovernorate,
    getUsersByDelegation,
} from "../../apis/userAPI";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { getVisitById } from "../../apis/visitAPI";
import { getTimesheetById } from "../../apis/timesheetAPI";
import {
    getRegionsByUser,
    getAllRegions,
    getDelegationsByGovernorate,
    getGovernoratesByRegion,
    getLocationDetailsById,
    getGovernoratesByUser,
    getDelegationsByUser,
} from "../../apis/locationApi";
import { useTranslation } from "react-i18next";
import VisitEditForm, { EditFormState, EditTracking } from "./VisitEditForm";

// Constants for environment variables and permissions
const PERMISSIONS = {
    ACCESS_VISIT_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS,
    EDIT_TIMESHEETS_FOR_SUPERVISOR: import.meta.env.VITE_PERMISSIONS_EDIT_VISIT,
    READ_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
    READ_AGENTS_BY_LOCATION: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_LOCATION,
    READ_AGENTS_BY_PHONE: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_PHONE,
    READ_REASON_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS,
    READ_CHECKLISTS_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS,
    CREATE_TIMESHEETS_FOR_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR,
    LOG_VISITS: import.meta.env.VITE_PERMISSIONS_LOG_VISITS,
} as const;

const ROLES = {
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
    REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
    DIRECTOR: import.meta.env.VITE_ROLES_DIRECTOR,
};

/**
 * VisitEdit component: Manages editing of visit details with form and camera capabilities.
 */
const VisitEdit: React.FC = () => {
    const { t } = useTranslation();
    const { idVisit } = useParams<{ idVisit: string }>();
    const navigate = useNavigate();
    const { user, effectivePermissions, permissionsLoaded } = useAuth();

    // State management
    const [visit, setVisit] = useState<Visit | null>(null);
    const [regions, setRegions] = useState<Region[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [delegations, setDelegations] = useState<Delegation[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [reasons, setReasons] = useState<Reason[]>([]);
    const [filteredReasons, setFilteredReasons] = useState<Reason[]>([]);
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [filteredChecklists, setFilteredChecklists] = useState<Checklist[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [regionalManagers, setRegionalManagers] = useState<User[]>([]);
    const [allRegionalManagers, setAllRegionalManagers] = useState<User[]>([]);
    const [selectedRegionalManager, setSelectedRegionalManager] = useState<string>("");
    const [regionalManagerSearch, setRegionalManagerSearch] = useState<string>("");
    const [supervisors, setSupervisors] = useState<User[]>([]);
    const [allSupervisors, setAllSupervisors] = useState<User[]>([]);
    const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");
    const [supervisorSearch, setSupervisorSearch] = useState<string>("");
    const [agentPhone, setAgentPhone] = useState<string>("");
    const [agentLocation, setAgentLocation] = useState<string>("");
    const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
    const [flashEffect, setFlashEffect] = useState<boolean>(false);
    const [agentLoading, setAgentLoading] = useState<boolean>(false);
    const [isRecruitmentVisit, setIsRecruitmentVisit] = useState<boolean>(false);
    const [newPhotos, setNewPhotos] = useState<File[]>([]);
    const videoRef = useRef<HTMLVideoElement>(null) as React.RefObject<HTMLVideoElement>;
    const canvasRef = useRef<HTMLCanvasElement>(null) as React.RefObject<HTMLCanvasElement>;
    const prevSelectedSupervisor = useRef<string>("");

    const [editTracking, setEditTracking] = useState<EditTracking>({
        startTime: null,
        durationAccumulator: 0,
    });
    const [editForm, setEditForm] = useState<EditFormState>({
        date: "",
        time: "",
        regionID: "",
        governorateID: "",
        delegationID: "",
        status: "",
        comment: "",
        agentID: "",
        agentSearch: "",
        agentPhone: "",
        regionSearch: "",
        governorateSearch: "",
        delegationSearch: "",
        reasonSearch: "",
        checklistSearch: "",
        regionalManagerSearch: "",
        supervisorSearch: "",
        duration: null,
        checklists: [],
        reasons: [],
        photosToRemove: [],
        original: {
            date: "",
            time: "",
            regionID: "",
            governorateID: "",
            delegationID: "",
            status: "",
            comment: "",
            agentID: "",
            checklists: [],
            reasons: [],
        },
    });

    // Permission checks
    const userPermissions = useMemo(
        () => ({
            canAccessVisitDetails: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.ACCESS_VISIT_DETAILS
            ) ?? false,
            canLogVisits: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.LOG_VISITS
            ) ?? false,
            canEditTimesheets: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.EDIT_TIMESHEETS_FOR_SUPERVISOR
            ) ?? false,
            canReadSupervisors: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.READ_SUPERVISORS
            ) ?? false,
            canReadAgentsByLocation: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.READ_AGENTS_BY_LOCATION
            ) ?? false,
            canReadAgentsByPhone: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.READ_AGENTS_BY_PHONE
            ) ?? false,
            canReadReasons: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.READ_REASON_ITEMS
            ) ?? false,
            canReadChecklists: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.READ_CHECKLISTS_ITEMS
            ) ?? false,
            canCreateTimesheetsForSupervisors: effectivePermissions?.some(
                (p) => p.name === PERMISSIONS.CREATE_TIMESHEETS_FOR_SUPERVISORS
            ) ?? false,
        }),
        [effectivePermissions]
    );

    // Role checks
    const isSuperAdmin = useMemo(
        () => user?.Roles?.some((role) => role.name === ROLES.SUPER_ADMIN) ?? false,
        [user]
    );
    const isRegionalManager = useMemo(
        () => user?.Roles?.some((role) => role.name === ROLES.REGIONAL_MANAGER) ?? false,
        [user]
    );
    const isSupervisor = useMemo(
        () => user?.Roles?.some((role) => role.name === ROLES.SUPERVISOR) ?? false,
        [user]
    );
    const isDirector = useMemo(
        () => user?.Roles?.some((role) => role.name === ROLES.DIRECTOR) ?? false,
        [user]
    );

    // Fetch visit data
    const fetchVisitData = useCallback(async () => {
        if (!idVisit || !userPermissions.canAccessVisitDetails) {
            navigate("/access-denied");
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const visitData = await getVisitById(idVisit);
            setVisit(visitData);

            const timesheetData = await getTimesheetById(visitData.timesheetID);
            const agentData = visitData.agentID ? await getAgentById(visitData.agentID) : null;

            // Fetch initial data
            const promises: [
                Promise<Region[]>,
                Promise<Reason[]>,
                Promise<Checklist[]>,
                Promise<User[]>,
                Promise<User[]>
            ] = [
                    getAllRegions(),
                    getAllReasons(),
                    getAllChecklists(),
                    getUsersByRole(ROLES.REGIONAL_MANAGER),
                    getUsersByRole(ROLES.SUPERVISOR),
                ];

            const [regionsData, reasonsData, checklistsData, regionalManagersData, supervisorsData] = await Promise.all(promises);
            setRegions(regionsData);
            setReasons(reasonsData);
            setFilteredReasons(reasonsData);
            setChecklists(checklistsData);
            setFilteredChecklists(checklistsData);
            setAllRegionalManagers(regionalManagersData);
            setRegionalManagers(regionalManagersData);
            setAllSupervisors(supervisorsData);
            setSupervisors(supervisorsData);

            // Initialize location fields
            let regionID = "";
            let governorateID = "";
            let delegationID = "";
            let agentLocation = "";

            if (agentData && agentData.delegationID) {
                const locationDetails = await getLocationDetailsById(agentData.delegationID);
                if (locationDetails.success && locationDetails.address) {
                    agentLocation = locationDetails.address;
                }
                const governoratesData = await getGovernoratesByRegion(locationDetails.addressInfo?.regionID || "");
                const delegationsData = await getDelegationsByGovernorate(locationDetails.addressInfo?.governorateID || "");
                regionID = locationDetails.addressInfo?.regionID || "";
                governorateID = locationDetails.addressInfo?.governorateID || "";
                delegationID = agentData.delegationID;
                setGovernorates(governoratesData);
                setDelegations(delegationsData);
                setAgentLocation(agentLocation);
            } else if (visitData.location) {
                const locationParts = visitData.location.split(",").map(part => part.trim());
                if (locationParts.length >= 3) {
                    const [regionName, governorateName, delegationName] = locationParts;
                    const region = regionsData.find(r => r.name.toLowerCase() === regionName.toLowerCase());
                    regionID = region?.regionID || "";
                    governorateID = governorateName;
                    delegationID = delegationName;
                } else if (locationParts.length === 1) {
                    delegationID = locationParts[0];
                }
            }

            setEditForm({
                ...editForm,
                date: visitData.date,
                time: visitData.time.slice(0, 5),
                regionID,
                governorateID,
                delegationID,
                status: visitData.status,
                comment: visitData.comment || "",
                agentID: visitData.agentID || "",
                agentSearch: agentData ? `${agentData.name} ${agentData.lastname}` : "",
                agentPhone: agentData?.phone || "",
                regionSearch: "",
                governorateSearch: "",
                delegationSearch: "",
                reasonSearch: "",
                checklistSearch: "",
                regionalManagerSearch: "",
                supervisorSearch: "",
                duration: visitData.duration || null,
                checklists: visitData.Checklists?.map((c) => ({
                    id: c.checklistID,
                    checked: c.VisitChecklist?.checked || false,
                })) || [],
                reasons: visitData.Reasons?.map((r) => ({ id: r.reasonID })) || [],
                photosToRemove: [],
                original: {
                    date: visitData.date,
                    time: visitData.time.slice(0, 5),
                    regionID,
                    governorateID,
                    delegationID,
                    status: visitData.status,
                    comment: visitData.comment || "",
                    agentID: visitData.agentID || "",
                    checklists: visitData.Checklists?.map((c) => ({
                        id: c.checklistID,
                        checked: c.VisitChecklist?.checked || false,
                    })) || [],
                    reasons: visitData.Reasons?.map((r) => ({ id: r.reasonID })) || [],
                },
            });
            setSelectedSupervisor(timesheetData.supervisorID || "");
            setAgentPhone(agentData?.phone || "");
            setIsRecruitmentVisit(!visitData.agentID);
            if (agentData?.supervisorID) {
                setSelectedSupervisor(agentData.supervisorID);
                const supervisor = supervisorsData.find(s => s.userID === agentData.supervisorID);
                if (supervisor) {
                    setSupervisors([supervisor]);
                }
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : t("visitDetails.error.fetchFailed");
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [idVisit, userPermissions, user, navigate, t]);

    // Effect to fetch visit data
    useEffect(() => {
        if (permissionsLoaded) fetchVisitData();
    }, [fetchVisitData, permissionsLoaded]);

    // Update prevSelectedSupervisor
    useEffect(() => {
        prevSelectedSupervisor.current = selectedSupervisor;
    }, [selectedSupervisor]);

    // Filter regional managers based on selectedSupervisor and regionID
    useEffect(() => {
        const filterRegionalManagers = async () => {
            if (!(isSuperAdmin || isDirector)) {
                setRegionalManagers([]);
                return;
            }
            try {
                let rmList = [...allRegionalManagers];
                if (selectedSupervisor && editForm.regionID) {
                    const [supervisorRM, regionRM] = await Promise.all([
                        getRegionalManagerBySupervisor(selectedSupervisor),
                        getUsersByRegion(editForm.regionID).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.REGIONAL_MANAGER))),
                    ]);
                    rmList = rmList.filter(rm =>
                        supervisorRM.some(srm => srm.userID === rm.userID) &&
                        regionRM.some(rrm => rrm.userID === rm.userID)
                    );
                } else if (selectedSupervisor) {
                    const supervisorRM = await getRegionalManagerBySupervisor(selectedSupervisor);
                    rmList = rmList.filter(rm => supervisorRM.some(srm => srm.userID === rm.userID));
                } else if (editForm.regionID) {
                    const regionRM = await getUsersByRegion(editForm.regionID).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.REGIONAL_MANAGER)));
                    rmList = rmList.filter(rm => regionRM.some(rrm => rrm.userID === rm.userID));
                }
                // Apply local search filtering
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
    }, [isSuperAdmin, isDirector, selectedSupervisor, editForm.regionID, allRegionalManagers, t]);

    // Filter supervisors based on selectedRegionalManager, governorateID, delegationID, and agentID
    useEffect(() => {
        const filterSupervisors = async () => {
            let filteredSupervisors = [...allSupervisors];
            const applyAdditionalFilters = async () => {
                const promises: Promise<User[]>[] = [];
                if (selectedRegionalManager) {
                    promises.push(getSupervisorsByRegionalManager(selectedRegionalManager));
                }
                if (editForm.governorateID) {
                    promises.push(getUsersByGovernorate(editForm.governorateID).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.SUPERVISOR))));
                }
                if (editForm.delegationID) {
                    promises.push(getUsersByDelegation(editForm.delegationID).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.SUPERVISOR))));
                }
                if (editForm.agentID) {
                    promises.push(getAgentById(editForm.agentID).then(agent => agent?.supervisorID ? [allSupervisors.find(u => u.userID === agent.supervisorID)!].filter(u => u) : []));
                }
                if (promises.length > 0) {
                    try {
                        const results = await Promise.all(promises);
                        filteredSupervisors = results.reduce((acc, curr) => acc.filter(a => curr.some(c => c.userID === a.userID)), filteredSupervisors);
                    } catch (err) {
                        setError(t("timesheetForm.errors.loadSupervisors"));
                    }
                }
                // Apply local search filtering
                if (supervisorSearch) {
                    filteredSupervisors = filteredSupervisors.filter(s =>
                        `${s.firstname} ${s.lastname} ${s.phone}`.toLowerCase().includes(supervisorSearch.toLowerCase())
                    );
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
        filterSupervisors();
    }, [selectedRegionalManager, editForm.governorateID, editForm.delegationID, editForm.agentID, allSupervisors, t]);

    // Fetch regions based on selected regional manager
    useEffect(() => {
        const fetchRegions = async () => {
            try {
                const regionsData = (isRecruitmentVisit && selectedRegionalManager)
                    ? await getRegionsByUser(selectedRegionalManager)
                    : await getAllRegions();
                setRegions(regionsData);
                if (regionsData.length === 1 && !editForm.regionID) {
                    setEditForm(prev => ({ ...prev, regionID: regionsData[0].regionID }));
                }
            } catch (err) {
                setError(t("timesheetForm.errors.loadRegions"));
            }
        };
        if (userPermissions.canReadAgentsByLocation) {
            fetchRegions();
        }
    }, [selectedRegionalManager, isRecruitmentVisit, userPermissions, t, editForm.regionID]);

    // Fetch governorates based on selected region
    useEffect(() => {
        const fetchGovernorates = async () => {
            if (!editForm.regionID) {
                setGovernorates([]);
                setEditForm(prev => ({ ...prev, governorateID: "", delegationID: "" }));
                return;
            }
            try {
                let govList: Governorate[] = await getGovernoratesByRegion(editForm.regionID);
                if (!isRecruitmentVisit && selectedSupervisor) {
                    const userGovs = await getGovernoratesByUser(selectedSupervisor);
                    govList = govList.filter(g => userGovs.some(ug => ug.governorateID === g.governorateID));
                }
                setGovernorates(govList);
                if (govList.length === 1) {
                    setEditForm(prev => ({ ...prev, governorateID: govList[0].governorateID }));
                } else if (!govList.some(g => g.governorateID === editForm.governorateID)) {
                    setEditForm(prev => ({ ...prev, governorateID: "", delegationID: "" }));
                }
            } catch (err) {
                setError(t("timesheetForm.errors.loadGovernorates"));
            }
        };
        if (userPermissions.canReadAgentsByLocation) {
            fetchGovernorates();
        }
    }, [editForm.regionID, selectedSupervisor, isRecruitmentVisit, userPermissions, t, editForm.governorateID]);

    // Fetch delegations based on selected governorate
    useEffect(() => {
        const fetchDelegations = async () => {
            if (!editForm.governorateID) {
                setDelegations([]);
                setEditForm(prev => ({ ...prev, delegationID: "" }));
                return;
            }
            try {
                let delList: Delegation[] = await getDelegationsByGovernorate(editForm.governorateID);
                if (!isRecruitmentVisit && selectedSupervisor) {
                    const userDels = await getDelegationsByUser(selectedSupervisor);
                    delList = delList.filter(d => userDels.some(ud => ud.delegationID === d.delegationID));
                }
                setDelegations(delList);
                if (delList.length === 1) {
                    setEditForm(prev => ({ ...prev, delegationID: delList[0].delegationID }));
                } else if (!delList.some(d => d.delegationID === editForm.delegationID)) {
                    setEditForm(prev => ({ ...prev, delegationID: "" }));
                }
            } catch (err) {
                setError(t("timesheetForm.errors.loadDelegations"));
            }
        };
        if (userPermissions.canReadAgentsByLocation) {
            fetchDelegations();
        }
    }, [editForm.governorateID, selectedSupervisor, isRecruitmentVisit, userPermissions, t, editForm.delegationID]);

    // Fetch agents based on selected delegation or supervisor
    useEffect(() => {
        const fetchAgents = async () => {
            if (!(agentPhone || editForm.delegationID)) {
                setAgents([]);
                setEditForm(prev => ({ ...prev, agentID: "", agentSearch: "" }));
                return;
            }
            try {
                setAgentLoading(true);
                let agentList: Agent[] = [];
                if (editForm.delegationID && selectedSupervisor) {
                    const [delAgents, userAgents] = await Promise.all([
                        getAgentsByDelegation(editForm.delegationID),
                        getAgentsByUser(selectedSupervisor),
                    ]);
                    agentList = delAgents.agents.filter(a => userAgents.agents.some(ua => ua.agentID === a.agentID));
                } else if (editForm.delegationID) {
                    agentList = (await getAgentsByDelegation(editForm.delegationID)).agents;
                }
                setAgents(agentList);
                if (agentList.length === 1) {
                    setEditForm(prev => ({
                        ...prev,
                        agentID: agentList[0].agentID,
                        agentSearch: `${agentList[0].name} ${agentList[0].lastname}`
                    }));
                    if (agentList[0].delegationID) {
                        const locationDetails = await getLocationDetailsById(agentList[0].delegationID);
                        if (locationDetails.success && locationDetails.address) {
                            setAgentLocation(locationDetails.address);
                        } else {
                            setAgentLocation("");
                        }
                    }
                }
            } catch (err) {
                setError(t("timesheetForm.errors.loadAgents"));
            } finally {
                setAgentLoading(false);
            }
        };
        if (userPermissions.canReadAgentsByLocation && !agentPhone) {
            fetchAgents();
        }
    }, [editForm.delegationID, selectedSupervisor, userPermissions, t, agentPhone]);

    // Fetch agent by phone
    const fetchAgentByPhone = useCallback(
        debounce(async (phone: string) => {
            if (phone.length !== 8 || isRecruitmentVisit || !userPermissions.canReadAgentsByPhone) {
                setAgents([]);
                setEditForm(prev => ({ ...prev, agentID: "", agentSearch: "" }));
                return;
            }
            setAgentLoading(true);
            try {
                const agent = await getAgentByPhone(phone);
                if (agent) {
                    setAgents([agent]);
                    setEditForm(prev => ({
                        ...prev,
                        agentID: agent.agentID,
                        agentSearch: `${agent.name} ${agent.lastname}`
                    }));
                    setAgentPhone(agent.phone);
                    if (agent.delegationID) {
                        const locationDetails = await getLocationDetailsById(agent.delegationID);
                        if (locationDetails.success && locationDetails.address) {
                            setAgentLocation(locationDetails.address);
                        }
                        setEditForm(prev => ({
                            ...prev,
                            regionID: locationDetails.addressInfo?.regionID || "",
                            governorateID: locationDetails.addressInfo?.governorateID || "",
                            delegationID: agent.delegationID
                        }));
                        const [governoratesData, delegationsData] = await Promise.all([
                            getGovernoratesByRegion(locationDetails.addressInfo?.regionID || ""),
                            getDelegationsByGovernorate(locationDetails.addressInfo?.governorateID || "")
                        ]);
                        setGovernorates(governoratesData);
                        setDelegations(delegationsData);
                    }
                    if (agent.supervisorID) {
                        setSelectedSupervisor(agent.supervisorID);
                        const supervisor = allSupervisors.find(s => s.userID === agent.supervisorID);
                        if (supervisor) {
                            setSupervisors([supervisor]);
                        }
                    }
                } else {
                    setAgents([]);
                    setEditForm(prev => ({ ...prev, agentID: "", agentSearch: "", agentPhone: "" }));
                    setAgentLocation("");
                    setError(t("timesheetForm.errors.agentNotFound"));
                }
            } catch (err) {
                setAgents([]);
                setEditForm(prev => ({ ...prev, agentID: "", agentSearch: "", agentPhone: "" }));
                setAgentLocation("");
                setError(t("timesheetForm.errors.agentNotFound"));
            } finally {
                setAgentLoading(false);
            }
        }, 500),
        [userPermissions.canReadAgentsByPhone, isRecruitmentVisit, allSupervisors, t]
    );

    // Effect for agent phone
    useEffect(() => {
        if (agentPhone && agentPhone.length === 8) {
            fetchAgentByPhone(agentPhone);
        } else {
            setAgents([]);
            setEditForm(prev => ({ ...prev, agentID: "", agentSearch: "" }));
            setAgentLocation("");
        }
    }, [agentPhone, fetchAgentByPhone]);

    // Camera handling
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsCameraActive(true);
                await new Promise<void>((resolve, reject) => {
                    if (videoRef.current) {
                        videoRef.current.oncanplay = () => resolve();
                        videoRef.current.onerror = () => reject(new Error("Video failed to play"));
                        videoRef.current.play();
                    } else {
                        reject(new Error("Video ref is null"));
                    }
                });
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error
                ? err.name === "NotReadableError"
                    ? t("visitDetails.error.cameraInUse")
                    : t("visitDetails.error.cameraAccess")
                : t("visitDetails.error.unknown");
            setError(errorMessage);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
            videoRef.current.srcObject = null;
            setIsCameraActive(false);
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) {
            setError(t("visitDetails.error.videoNotFound"));
            return;
        }
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            setError(t("visitDetails.error.videoNotReady"));
            return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) {
            setError(t("visitDetails.error.canvasContextFailed"));
            return;
        }
        try {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const file = new File([blob], `photo-${Date.now()}.jpg`, {
                            type: "image/jpeg",
                        });
                        setNewPhotos((prev) => [...prev, file]);
                        setFlashEffect(true);
                        setTimeout(() => setFlashEffect(false), 300);
                    } else {
                        setError(t("visitDetails.error.blobCreationFailed"));
                    }
                },
                "image/jpeg",
                0.95
            );
        } catch (err) {
            setError(t("visitDetails.error.captureFailed"));
        }
    };

    const removeNewPhoto = (index: number) => {
        setNewPhotos((prev) => prev.filter((_, i) => i !== index));
    };

    const canEditField = (field: string) => {
        if (!visit) return false;
        switch (visit.status) {
            case "visited":
                return ["comment", "checklists", "photos"].includes(field);
            case "pending":
            case "validated":
            case "rejected":
                return [
                    "dateTime",
                    "regionID",
                    "governorateID",
                    "delegationID",
                    "agentID",
                    "checklists",
                    "reasons",
                    "supervisor",
                ].includes(field);
            default:
                return false;
        }
    };

    const supervisorID = isSupervisor ? user!.userID : selectedSupervisor;

    // Render
    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner"></div>
                <p>{t("visitDetails.loading")}</p>
            </div>
        );
    }
    if (error || !visit) {
        return (
            <div className="visit-details-container">
                <div className="visit-details-error-card">
                    <h2>{t("visitDetails.error.title")}</h2>
                    <p>{error || t("visitDetails.error.notFound")}</p>
                    <button
                        className="visit-details-back-btn"
                        onClick={() => navigate(`/visit/${idVisit}`)}
                        aria-label={t("visitDetails.aria.backButton")}
                    >
                        <FaArrowLeft /> {t("visitDetails.actions.back")}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="visit-details-container">
            <header className="visit-details-header">
                <h1>
                    <FaListUl /> {t("visitDetails.title")} - {t("visitDetails.actions.edit")}
                    <span className={`status-dot status-${visit.status.toLowerCase()}`}></span>
                    {visit.duration !== null && (
                        <div className="duration-clock">
                            <svg className="clock-circle" viewBox="0 0 36 36">
                                <circle className="clock-base" cx="18" cy="18" r="16" />
                                <circle
                                    className="clock-progress"
                                    cx="18"
                                    cy="18"
                                    r="16"
                                    strokeDasharray={`${Math.min((visit.duration! / 60) * 100, 100)} 100`}
                                />
                            </svg>
                            <span className="duration-text">{visit.duration}m</span>
                        </div>
                    )}
                </h1>
            </header>
            <section>
                <VisitEditForm
                    visit={visit}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    userPermissions={userPermissions}
                    isSuperAdmin={isSuperAdmin}
                    isDirector={isDirector}
                    isRegionalManager={isRegionalManager}
                    isSupervisor={isSupervisor}
                    regionalManagers={regionalManagers}
                    selectedRegionalManager={selectedRegionalManager}
                    setSelectedRegionalManager={setSelectedRegionalManager}
                    regionalManagerSearch={regionalManagerSearch}
                    setRegionalManagerSearch={setRegionalManagerSearch}
                    supervisors={supervisors}
                    selectedSupervisor={selectedSupervisor}
                    setSelectedSupervisor={setSelectedSupervisor}
                    supervisorSearch={supervisorSearch}
                    setSupervisorSearch={setSupervisorSearch}
                    agentPhone={agentPhone}
                    setAgentPhone={setAgentPhone}
                    agentLocation={agentLocation}
                    regions={regions}
                    governorates={governorates}
                    delegations={delegations}
                    agents={agents}
                    reasons={reasons}
                    filteredReasons={filteredReasons}
                    setFilteredReasons={setFilteredReasons}
                    checklists={checklists}
                    filteredChecklists={filteredChecklists}
                    setFilteredChecklists={setFilteredChecklists}
                    agentLoading={agentLoading}
                    isCameraActive={isCameraActive}
                    setIsCameraActive={setIsCameraActive}
                    newPhotos={newPhotos}
                    setNewPhotos={setNewPhotos}
                    flashEffect={flashEffect}
                    setFlashEffect={setFlashEffect}
                    videoRef={videoRef}
                    canvasRef={canvasRef}
                    editTracking={editTracking}
                    setEditTracking={setEditTracking}
                    selectedImage={selectedImage}
                    setSelectedImage={setSelectedImage}
                    startCamera={startCamera}
                    stopCamera={stopCamera}
                    capturePhoto={capturePhoto}
                    removeNewPhoto={removeNewPhoto}
                    canEditField={canEditField}
                    supervisorID={supervisorID}
                    idVisit={idVisit}
                    user={user}
                    setVisit={setVisit}
                    setError={setError}
                    t={t}
                    navigate={navigate}
                    isRecruitmentVisit={isRecruitmentVisit}
                    setIsRecruitmentVisit={setIsRecruitmentVisit}
                />
            </section>
        </div>
    );
};

export default VisitEdit;