/**
 * AssignmentsManagement.tsx
 * Handles assignments for regions, governorates, delegations, supervisors, agents, regional managers, and directors.
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { FaAngleDown, FaSearch } from "react-icons/fa";
import { useError } from "../../../context/ErrorContext";
import {
    getSupervisorsByUser,
    getRegionalManagersByUser,
    getDirectorByUser,
    assignRegionalManagerToSupervisor,
    revokeRegionalManagerFromSupervisor,
    assignRegionsToRegionalManager,
    revokeRegionsFromRegionalManager,
    assignGovernoratesToSupervisor,
    revokeGovernoratesFromSupervisor,
    assignDelegationsToSupervisor,
    revokeDelegationsFromSupervisor,
    assignDirectorToRegionalManager,
    revokeDirectorFromRegionalManager,
    assignSupervisorToAgent,
    revokeSupervisorFromAgent,
    getAllRegions,
    getAllGovernorates,
    getAllDelegations,
    getUserByPhone,
} from "../../../apis/userAPI";
import {
    getAllAgents,
    getAgentByPhone,
    getAgentsByLocation,
} from "../../../apis/agentAPI";
import User from "../../../models/User";
import Agent from "../../../models/Agent";
import Region from "../../../models/Region";
import Governorate from "../../../models/Governorate";
import Delegation from "../../../models/Delegation";
import "../AdminDashboard.css";

interface AssignmentsManagementProps {
    selectedUser: User | null;
    users: User[];
    expandedSection: string | null;
    toggleSection: (section: string) => void;
    userPermissions: {
        canAssignRegions: boolean;
        canRevokeRegions: boolean;
        canAssignGovernorates: boolean;
        canRevokeGovernorates: boolean;
        canAssignDelegations: boolean;
        canRevokeDelegations: boolean;
        canAssignSupervisors: boolean;
        canRevokeSupervisors: boolean;
        canAssignAgents: boolean;
        canRevokeAgents: boolean;
        canAssignDirectors: boolean;
        canRevokeDirectors: boolean;
        canReadSupervisors: boolean;
        canReadRegionalManagers: boolean;
        canReadAgents: boolean;
        canReadDirectors: boolean;
    };
    tempSupervisors: User[];
    setTempSupervisors: React.Dispatch<React.SetStateAction<User[]>>;
    tempRegionalManagers: User[];
    setTempRegionalManagers: React.Dispatch<React.SetStateAction<User[]>>;
    tempRegions: Region[];
    setTempRegions: React.Dispatch<React.SetStateAction<Region[]>>;
    tempGovernorates: Governorate[];
    setTempGovernorates: React.Dispatch<React.SetStateAction<Governorate[]>>;
    tempDelegations: Delegation[];
    setTempDelegations: React.Dispatch<React.SetStateAction<Delegation[]>>;
    tempAgents: Agent[];
    setTempAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
    tempDirectors: User[];
    setTempDirectors: React.Dispatch<React.SetStateAction<User[]>>;
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    setSelectedUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const ITEMS_PER_PAGE = 10;
const ROLES = {
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
    MANAGER: import.meta.env.VITE_ROLES_MANAGER,
    REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
    DIRECTOR: import.meta.env.VITE_ROLES_DIRECTOR,
    AGENT: import.meta.env.VITE_ROLES_AGENT,
};

const AssignmentsDropdownSkeleton: React.FC = () => (
    <div className="dropdown-body">
        <div className="group-header">
            <div
                className="custom-skeleton"
                style={{ width: "100px", height: "32px" }}
            />
        </div>
        <div className="assignment-list">
            <div
                className="custom-skeleton"
                style={{ width: "200px", height: "20px", marginBottom: "10px" }}
            />
            <div className="search-container assignment-search">
                <div
                    className="custom-skeleton"
                    style={{ width: "200px", height: "32px" }}
                />
            </div>
            <div className="list-container">
                {[...Array(3)].map((_, j) => (
                    <div key={j} className="list-item">
                        <div
                            className="custom-skeleton"
                            style={{ width: "250px", height: "20px" }}
                        />
                    </div>
                ))}
            </div>
            <div className="pagination">
                <div
                    className="custom-skeleton"
                    style={{ width: "80px", height: "32px" }}
                />
                <div
                    className="custom-skeleton"
                    style={{ width: "100px", height: "20px" }}
                />
                <div
                    className="custom-skeleton"
                    style={{ width: "80px", height: "32px" }}
                />
            </div>
        </div>
    </div>
);

const AssignmentsManagement: React.FC<AssignmentsManagementProps> = ({
    selectedUser,
    users,
    expandedSection,
    toggleSection,
    userPermissions,
    tempSupervisors,
    setTempSupervisors,
    tempRegionalManagers,
    setTempRegionalManagers,
    tempRegions,
    setTempRegions,
    tempGovernorates,
    setTempGovernorates,
    tempDelegations,
    setTempDelegations,
    tempAgents,
    setTempAgents,
    tempDirectors,
    setTempDirectors,
    setUsers,
    setSelectedUser,
}) => {
    const { setError: setGlobalError } = useError();
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [supervisorSearch, setSupervisorSearch] = useState("");
    const [regionalManagerSearch, setRegionalManagerSearch] = useState("");
    const [regionSearch, setRegionSearch] = useState("");
    const [governorateSearch, setGovernorateSearch] = useState("");
    const [delegationSearch, setDelegationSearch] = useState("");
    const [agentSearch, setAgentSearch] = useState("");
    const [directorSearch, setDirectorSearch] = useState("");
    const [supervisorPhoneInput, setSupervisorPhoneInput] = useState("");
    const [regionalManagerPhoneInput, setRegionalManagerPhoneInput] = useState("");
    const [directorPhoneInput, setDirectorPhoneInput] = useState("");
    const [agentPhoneInput, setAgentPhoneInput] = useState("");
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [supervisorPage, setSupervisorPage] = useState(1);
    const [regionalManagerPage, setRegionalManagerPage] = useState(1);
    const [regionPage, setRegionPage] = useState(1);
    const [governoratePage, setGovernoratePage] = useState(1);
    const [delegationPage, setDelegationPage] = useState(1);
    const [agentPage, setAgentPage] = useState(1);
    const [directorPage, setDirectorPage] = useState(1);
    const [allRegions, setAllRegions] = useState<Region[]>([]);
    const [allGovernorates, setAllGovernorates] = useState<Governorate[]>([]);
    const [allDelegations, setAllDelegations] = useState<Delegation[]>([]);
    const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
    const [hasUnsavedAssignmentChanges, setHasUnsavedAssignmentChanges] = useState(false);

    useEffect(() => {
        if (expandedSection !== "assignments" || !selectedUser) return;
        const fetchAssignments = async () => {
            try {
                setLoadingAssignments(true);
                const [
                    supervisors,
                    regionalManagers,
                    director,
                    regions,
                    governorates,
                    delegations,
                    agentsResponse,
                ] = await Promise.all([
                    getSupervisorsByUser(selectedUser.userID),
                    getRegionalManagersByUser(selectedUser.userID),
                    getDirectorByUser(selectedUser.userID),
                    getAllRegions(),
                    getAllGovernorates(),
                    getAllDelegations(),
                    getAllAgents(),
                ]);
                setTempSupervisors(
                    (supervisors || []).sort((a, b) =>
                        `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                    )
                );
                setTempRegionalManagers(
                    regionalManagers?.regionalManagers?.length
                        ? regionalManagers.regionalManagers.sort((a, b) =>
                            `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                        )
                        : selectedUser.regionalManagerID
                            ? users
                                .filter((u) => u.userID === selectedUser.regionalManagerID)
                                .sort((a, b) =>
                                    `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                                )
                            : []
                );
                setTempDirectors(
                    director?.director
                        ? [director.director].sort((a, b) =>
                            `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                        )
                        : []
                );
                setAllRegions(regions || []);
                setAllGovernorates(governorates || []);
                setAllDelegations(delegations || []);
                setTempRegions(
                    (selectedUser.Regions || []).sort((a, b) => a.name.localeCompare(b.name))
                );
                setTempGovernorates(
                    (selectedUser.Governorates || []).sort((a, b) => a.name.localeCompare(b.name))
                );
                setTempDelegations(
                    (selectedUser.Delegations || []).sort((a, b) => a.name.localeCompare(b.name))
                );
                setTempAgents(
                    (agentsResponse.agents.filter(
                        (agent) => agent.supervisorID === selectedUser.userID
                    ) || []).sort((a, b) =>
                        `${a.name} ${a.lastname}`.localeCompare(`${b.name} ${b.lastname}`)
                    )
                );
                setAvailableAgents(agentsResponse.agents || []);
            } catch (error) {
                if (error instanceof Error && error.message === "No agents found") {
                    setTempAgents([]);
                    setAvailableAgents([]);
                } else {
                    setGlobalError(
                        error instanceof Error ? error.message : "Failed to load assignments."
                    );
                }
            } finally {
                setLoadingAssignments(false);
            }
        };
        fetchAssignments();
    }, [expandedSection, selectedUser, setGlobalError, users]);

    // Debug state updates

    useEffect(() => {
        if (
            !selectedUser ||
            !selectedUser.Roles?.some((r) => r.name === ROLES.SUPERVISOR) ||
            !tempDelegations.length
        ) {
            setAvailableAgents([]);
            return;
        }

        let isCancelled = false;

        const fetchAgentsByDelegations = async () => {
            try {
                const agentsPromises = tempDelegations.map((delegation) =>
                    getAgentsByLocation(delegation.delegationID)
                );
                const agentsResponses = await Promise.all(agentsPromises);
                const allAgents = agentsResponses.flatMap((response) => response.agents);
                if (!isCancelled) {
                    setAvailableAgents(allAgents);
                }
            } catch (error) {
                if (!isCancelled) {
                    if (error instanceof Error && error.message === "No agents found") {
                        setAvailableAgents([]);
                    } else {
                        setGlobalError(
                            error instanceof Error ? error.message : "Failed to fetch agents by delegations."
                        );
                    }
                }
            }
        };

        fetchAgentsByDelegations();

        return () => {
            isCancelled = true;
        };
    }, [tempDelegations, selectedUser, setGlobalError]);

    const handlePhoneInput = useCallback(
        async (type: 'supervisor' | 'regionalManager' | 'director' | 'agent', phone: string) => {
            if (type === 'agent') {
                setAgentPhoneInput(phone);
            } else if (type === 'supervisor') {
                setSupervisorPhoneInput(phone);
            } else if (type === 'regionalManager') {
                setRegionalManagerPhoneInput(phone);
            } else if (type === 'director') {
                setDirectorPhoneInput(phone);
            }

            if (!phone) {
                setPhoneError(null);
                return;
            }

            if (!/^\d{8}$/.test(phone)) {
                setPhoneError("Phone number must be 8 digits.");
                return;
            }

            try {
                setPhoneError(null);
                if (type === 'agent') {
                    const response = await getAgentByPhone(phone);
                    const agent = response.agent;
                    setTempAgents((prev) => {
                        if (!prev.some((a) => a.agentID === agent.agentID)) {
                            // Add agent to the top, sort remaining
                            return [
                                agent,
                                ...prev.sort((a, b) =>
                                    `${a.name} ${a.lastname}`.localeCompare(`${b.name} ${b.lastname}`)
                                ),
                            ];
                        }
                        return prev;
                    });
                    setAgentPhoneInput("");
                    setHasUnsavedAssignmentChanges(true);
                } else {
                    const response = await getUserByPhone(phone);
                    const user = response;
                    const userRoles = user.Roles || [];
                    const userID = user.userID;
                    if (type === 'supervisor' && userRoles.some((r: { name: string }) => r.name === ROLES.SUPERVISOR)) {
                        setTempSupervisors((prev) => {
                            if (!prev.some((s) => s.userID === userID)) {
                                // Add supervisor to the top, sort remaining
                                return [
                                    user,
                                    ...prev.sort((a, b) =>
                                        `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                                    ),
                                ];
                            }
                            return prev;
                        });
                        setSupervisorPhoneInput("");
                    } else if (
                        type === 'regionalManager' &&
                        userRoles.some((r: { name: string }) => r.name === ROLES.REGIONAL_MANAGER)
                    ) {
                        setTempRegionalManagers([user]); // Single selection
                        setRegionalManagerPhoneInput("");
                    } else if (
                        type === 'director' &&
                        userRoles.some((r: { name: string }) => r.name === ROLES.DIRECTOR)
                    ) {
                        setTempDirectors([user]); // Single selection
                        setDirectorPhoneInput("");
                    } else {
                        setPhoneError("User does not have the required role.");
                        return;
                    }
                    setHasUnsavedAssignmentChanges(true);
                }
            } catch (error) {
                setPhoneError(error instanceof Error ? error.message : "User or agent not found.");
            }
        },
        [setTempAgents, setTempSupervisors, setTempRegionalManagers, setTempDirectors]
    );

    const supervisorUsers = useMemo(() => {
        return users
            .filter((u) => u.Roles?.some((r) => r.name === ROLES.SUPERVISOR))
            .filter(
                (s) =>
                    `${s.firstname} ${s.lastname}`
                        .toLowerCase()
                        .includes(supervisorSearch.toLowerCase()) ||
                    s.phone.includes(supervisorSearch) ||
                    s.email.toLowerCase().includes(supervisorSearch.toLowerCase())
            )
            .sort((a, b) =>
                `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
            );
    }, [users, supervisorSearch]);

    const regionalManagerUsers = useMemo(() => {
        return users
            .filter((u) => u.Roles?.some((r) => r.name === ROLES.REGIONAL_MANAGER))
            .filter(
                (m) =>
                    `${m.firstname} ${m.lastname}`
                        .toLowerCase()
                        .includes(regionalManagerSearch.toLowerCase()) ||
                    m.phone.includes(regionalManagerSearch) ||
                    m.email.toLowerCase().includes(regionalManagerSearch.toLowerCase())
            )
            .sort((a, b) =>
                `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
            );
    }, [users, regionalManagerSearch]);

    const directorUsers = useMemo(() => {
        return users
            .filter((u) => u.Roles?.some((r) => r.name === ROLES.DIRECTOR))
            .filter(
                (d) =>
                    `${d.firstname} ${d.lastname}`
                        .toLowerCase()
                        .includes(directorSearch.toLowerCase()) ||
                    d.phone.includes(directorSearch) ||
                    d.email.toLowerCase().includes(directorSearch.toLowerCase())
            )
            .sort((a, b) =>
                `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
            );
    }, [users, directorSearch]);

    const filteredAgents = useMemo(() => {
        return availableAgents
            .filter(
                (a) =>
                    `${a.name} ${a.lastname}`
                        .toLowerCase()
                        .includes(agentSearch.toLowerCase()) ||
                    a.phone.includes(agentSearch)
            )
            .sort((a, b) => `${a.name} ${a.lastname}`.localeCompare(`${b.name} ${b.lastname}`));
    }, [availableAgents, agentSearch]);

    const filteredRegions = useMemo(() => {
        return allRegions
            .filter((region) => region.name.toLowerCase().includes(regionSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allRegions, regionSearch]);

    const filteredGovernorates = useMemo(() => {
        const rmRegions =
            tempRegionalManagers
                .flatMap((rm) => rm.Regions || [])
                .map((region) => region.regionID) || [];
        return allGovernorates
            .filter((gov) => rmRegions.includes(gov.regionID))
            .filter((gov) => gov.name.toLowerCase().includes(governorateSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allGovernorates, governorateSearch, tempRegionalManagers]);

    const filteredDelegations = useMemo(() => {
        const supervisorGovernorates =
            tempGovernorates.map((gov) => gov.governorateID) || [];
        return allDelegations
            .filter((del) => supervisorGovernorates.includes(del.governorateID))
            .filter((del) => del.name.toLowerCase().includes(delegationSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allDelegations, delegationSearch, tempGovernorates]);

    const paginatedSupervisors = useMemo(() => {
        const start = (supervisorPage - 1) * ITEMS_PER_PAGE;
        return supervisorUsers.slice(start, start + ITEMS_PER_PAGE);
    }, [supervisorUsers, supervisorPage]);

    const paginatedRegionalManagers = useMemo(() => {
        const start = (regionalManagerPage - 1) * ITEMS_PER_PAGE;
        return regionalManagerUsers.slice(start, start + ITEMS_PER_PAGE);
    }, [regionalManagerUsers, regionalManagerPage]);

    const paginatedDirectors = useMemo(() => {
        const start = (directorPage - 1) * ITEMS_PER_PAGE;
        return directorUsers.slice(start, start + ITEMS_PER_PAGE);
    }, [directorUsers, directorPage]);

    const paginatedRegions = useMemo(() => {
        const start = (regionPage - 1) * ITEMS_PER_PAGE;
        return filteredRegions.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredRegions, regionPage]);

    const paginatedGovernorates = useMemo(() => {
        const start = (governoratePage - 1) * ITEMS_PER_PAGE;
        return filteredGovernorates.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredGovernorates, governoratePage]);

    const paginatedDelegations = useMemo(() => {
        const start = (delegationPage - 1) * ITEMS_PER_PAGE;
        return filteredDelegations.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredDelegations, delegationPage]);

    const paginatedAgents = useMemo(() => {
        const start = (agentPage - 1) * ITEMS_PER_PAGE;
        return filteredAgents.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredAgents, agentPage]);

    const handleToggleSupervisor = useCallback(
        (supervisor: User) => {
            if (!userPermissions.canAssignSupervisors || !selectedUser) return;
            setTempSupervisors((prev: User[]) => {
                const hasSupervisor = prev.some((s) => s.userID === supervisor.userID);
                if (hasSupervisor) {
                    // Remove supervisor and sort remaining alphabetically
                    return prev
                        .filter((s) => s.userID !== supervisor.userID)
                        .sort((a, b) =>
                            `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                        );
                } else {
                    // Add supervisor to the top
                    return [
                        supervisor,
                        ...prev.sort((a, b) =>
                            `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                        ),
                    ];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignSupervisors, selectedUser, setTempSupervisors]
    );

    const handleToggleRegionalManager = useCallback(
        (regionalManager: User) => {
            if (!userPermissions.canAssignSupervisors || !selectedUser) return;
            setTempRegionalManagers((prev: User[]) => {
                const hasRegionalManager = prev.some((m) => m.userID === regionalManager.userID);
                if (hasRegionalManager) {
                    // Remove regional manager and sort remaining alphabetically
                    return prev
                        .filter((m) => m.userID !== regionalManager.userID)
                        .sort((a, b) =>
                            `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                        );
                } else {
                    // Set only the selected regional manager (single selection)
                    return [regionalManager];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignSupervisors, selectedUser, setTempRegionalManagers]
    );

    const handleToggleDirector = useCallback(
        (director: User) => {
            if (!userPermissions.canAssignDirectors || !selectedUser) return;
            setTempDirectors((prev: User[]) => {
                const hasDirector = prev.some((d) => d.userID === director.userID);
                if (hasDirector) {
                    // Remove director and sort remaining alphabetically
                    return prev
                        .filter((d) => d.userID !== director.userID)
                        .sort((a, b) =>
                            `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                        );
                } else {
                    // Set only the selected director (single selection)
                    return [director];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignDirectors, selectedUser, setTempDirectors]
    );

    const handleToggleRegion = useCallback(
        (region: Region) => {
            if (!userPermissions.canAssignRegions || !selectedUser) return;
            setTempRegions((prev: Region[]) => {
                const hasRegion = prev.some((r) => r.regionID === region.regionID);
                if (hasRegion) {
                    // Remove region and sort remaining alphabetically
                    return prev
                        .filter((r) => r.regionID !== region.regionID)
                        .sort((a, b) => a.name.localeCompare(b.name));
                } else {
                    // Add region to the top
                    return [region, ...prev.sort((a, b) => a.name.localeCompare(b.name))];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignRegions, selectedUser, setTempRegions]
    );

    const handleToggleGovernorate = useCallback(
        (governorate: Governorate) => {
            if (!userPermissions.canAssignGovernorates || !selectedUser) return;
            setTempGovernorates((prev: Governorate[]) => {
                const hasGovernorate = prev.some(
                    (g) => g.governorateID === governorate.governorateID
                );
                if (hasGovernorate) {
                    // Remove governorate and sort remaining alphabetically
                    return prev
                        .filter((g) => g.governorateID !== governorate.governorateID)
                        .sort((a, b) => a.name.localeCompare(b.name));
                } else {
                    // Add governorate to the top
                    return [governorate, ...prev.sort((a, b) => a.name.localeCompare(b.name))];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignGovernorates, selectedUser, setTempGovernorates]
    );

    const handleToggleDelegation = useCallback(
        (delegation: Delegation) => {
            if (!userPermissions.canAssignDelegations || !selectedUser) return;
            setTempDelegations((prev: Delegation[]) => {
                const hasDelegation = prev.some((d) => d.delegationID === delegation.delegationID);
                if (hasDelegation) {
                    // Remove delegation and sort remaining alphabetically
                    return prev
                        .filter((d) => d.delegationID !== delegation.delegationID)
                        .sort((a, b) => a.name.localeCompare(b.name));
                } else {
                    // Add delegation to the top
                    return [delegation, ...prev.sort((a, b) => a.name.localeCompare(b.name))];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignDelegations, selectedUser, setTempDelegations]
    );

    const handleToggleAgent = useCallback(
        (agent: Agent) => {
            if (!userPermissions.canAssignAgents || !selectedUser) return;
            setTempAgents((prev: Agent[]) => {
                const hasAgent = prev.some((a) => a.agentID === agent.agentID);
                if (hasAgent) {
                    // Remove agent and sort remaining alphabetically
                    return prev
                        .filter((a) => a.agentID !== agent.agentID)
                        .sort((a, b) => `${a.name} ${a.lastname}`.localeCompare(`${b.name} ${b.lastname}`));
                } else {
                    // Add agent to the top
                    return [
                        agent,
                        ...prev.sort((a, b) =>
                            `${a.name} ${a.lastname}`.localeCompare(`${b.name} ${b.lastname}`)
                        ),
                    ];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignAgents, selectedUser, setTempAgents]
    );

    const handleSaveAssignments = useCallback(async () => {
        if (!selectedUser || !userPermissions.canAssignSupervisors) return;
        try {
            const isRegionalManager = selectedUser.Roles?.some(
                (r) => r.name === ROLES.REGIONAL_MANAGER
            );
            const isSupervisor = selectedUser.Roles?.some(
                (r) => r.name === ROLES.SUPERVISOR
            );

            if (isRegionalManager) {
                // Handle Regions
                if (userPermissions.canAssignRegions) {
                    const currentRegionIds = selectedUser.Regions?.map((r) => r.regionID) || [];
                    const newRegionIds = tempRegions.map((r) => r.regionID);
                    const regionsToAssign = newRegionIds.filter((id) => !currentRegionIds.includes(id));
                    const regionsToRevoke = currentRegionIds.filter((id) => !newRegionIds.includes(id));

                    if (regionsToAssign.length > 0) {
                        await assignRegionsToRegionalManager(
                            selectedUser.userID,
                            regionsToAssign
                        );
                    }
                    if (regionsToRevoke.length > 0) {
                        await revokeRegionsFromRegionalManager(
                            selectedUser.userID,
                            regionsToRevoke
                        );
                    }
                }

                // Handle Directors
                if (userPermissions.canAssignDirectors) {
                    const currentDirectorId = selectedUser.directorID || "";
                    const newDirectorId = tempDirectors[0]?.userID || "";
                    if (newDirectorId && newDirectorId !== currentDirectorId) {
                        await assignDirectorToRegionalManager(
                            selectedUser.userID,
                            newDirectorId
                        );
                    } else if (currentDirectorId && !newDirectorId) {
                        await revokeDirectorFromRegionalManager(selectedUser.userID);
                    }
                }
            }

            if (isSupervisor) {
                // Handle Regional Managers
                if (userPermissions.canAssignSupervisors) {
                    const currentRegionalManagerId = selectedUser.regionalManagerID || "";
                    const newRegionalManagerId = tempRegionalManagers[0]?.userID || "";
                    if (newRegionalManagerId && newRegionalManagerId !== currentRegionalManagerId) {
                        await assignRegionalManagerToSupervisor(
                            selectedUser.userID,
                            newRegionalManagerId
                        );
                    } else if (currentRegionalManagerId && !newRegionalManagerId) {
                        await revokeRegionalManagerFromSupervisor(
                            selectedUser.userID,
                            currentRegionalManagerId
                        );
                    }
                }

                // Handle Governorates
                if (userPermissions.canAssignGovernorates) {
                    const currentGovernorateIds =
                        selectedUser.Governorates?.map((g) => g.governorateID) || [];
                    const newGovernorateIds = tempGovernorates.map((g) => g.governorateID);
                    const governoratesToAssign = newGovernorateIds.filter(
                        (id) => !currentGovernorateIds.includes(id)
                    );
                    const governoratesToRevoke = currentGovernorateIds.filter(
                        (id) => !newGovernorateIds.includes(id)
                    );

                    if (governoratesToAssign.length > 0) {
                        await assignGovernoratesToSupervisor(
                            selectedUser.userID,
                            governoratesToAssign
                        );
                    }
                    if (governoratesToRevoke.length > 0) {
                        await revokeGovernoratesFromSupervisor(
                            selectedUser.userID,
                            governoratesToRevoke
                        );
                    }
                }

                // Handle Delegations
                if (userPermissions.canAssignDelegations) {
                    const currentDelegationIds =
                        selectedUser.Delegations?.map((d) => d.delegationID) || [];
                    const newDelegationIds = tempDelegations.map((d) => d.delegationID);
                    const delegationsToAssign = newDelegationIds.filter(
                        (id) => !currentDelegationIds.includes(id)
                    );
                    const delegationsToRevoke = currentDelegationIds.filter(
                        (id) => !newDelegationIds.includes(id)
                    );

                    if (delegationsToAssign.length > 0) {
                        await assignDelegationsToSupervisor(
                            selectedUser.userID,
                            delegationsToAssign
                        );
                    }
                    if (delegationsToRevoke.length > 0) {
                        await revokeDelegationsFromSupervisor(
                            selectedUser.userID,
                            delegationsToRevoke
                        );
                    }
                }

                // Handle Agents
                if (userPermissions.canAssignAgents) {
                    const currentAgentIds = tempAgents
                        .filter((agent) => agent.supervisorID === selectedUser.userID)
                        .map((agent) => agent.agentID) || [];
                    const newAgentIds = tempAgents.map((agent) => agent.agentID);
                    const agentsToAssign = tempAgents.filter(
                        (agent) => !currentAgentIds.includes(agent.agentID)
                    );
                    const agentsToRevoke = currentAgentIds.filter(
                        (id) => !newAgentIds.includes(id)
                    );
                    const delegation = tempDelegations[0]; // Assume one delegation for simplicity
                    if (!delegation) {
                        throw new Error("At least one delegation must be assigned to the supervisor.");
                    }

                    // Assign supervisors to agents
                    for (const agent of agentsToAssign) {
                        await assignSupervisorToAgent(
                            agent.agentID,
                            selectedUser.userID,
                            delegation.delegationID
                        );
                    }

                    // Revoke supervisors from agents
                    for (const agentId of agentsToRevoke) {
                        await revokeSupervisorFromAgent(agentId);
                    }
                }
            }

            const updatedUser = {
                ...selectedUser,
                supervisors: tempSupervisors,
                regionalManagerID: tempRegionalManagers[0]?.userID || "",
                directorID: tempDirectors[0]?.userID || "",
                Regions: tempRegions,
                Governorates: tempGovernorates,
                Delegations: tempDelegations,
            };
            setUsers(
                users.map((u) => (u.userID === selectedUser.userID ? updatedUser : u))
            );
            setSelectedUser(updatedUser);
            setHasUnsavedAssignmentChanges(false);
        } catch (error) {
            setGlobalError(
                error instanceof Error ? error.message : "Failed to save assignments."
            );
            // Reset to original state on error
            setTempSupervisors(selectedUser.supervisors || []);
            setTempRegionalManagers(
                selectedUser.regionalManagerID
                    ? users.filter((u) => u.userID === selectedUser.regionalManagerID)
                    : []
            );
            setTempDirectors(
                selectedUser.directorID
                    ? users.filter((u) => u.userID === selectedUser.directorID)
                    : []
            );
            setTempRegions(selectedUser.Regions || []);
            setTempGovernorates(selectedUser.Governorates || []);
            setTempDelegations(selectedUser.Delegations || []);
            setTempAgents(
                tempAgents.filter((agent) => agent.supervisorID === selectedUser.userID) || []
            );
        }
    }, [
        selectedUser,
        userPermissions,
        tempSupervisors,
        tempRegionalManagers,
        tempDirectors,
        tempRegions,
        tempGovernorates,
        tempDelegations,
        tempAgents,
        users,
        setUsers,
        setSelectedUser,
        setTempSupervisors,
        setTempRegionalManagers,
        setTempDirectors,
        setTempRegions,
        setTempGovernorates,
        setTempDelegations,
        setTempAgents,
        setGlobalError,
    ]);

    if (
        !selectedUser ||
        !(
            selectedUser.Roles?.some((r) => r.name === ROLES.REGIONAL_MANAGER) ||
            selectedUser.Roles?.some((r) => r.name === ROLES.SUPERVISOR)
        ) ||
        !(
            userPermissions.canAssignRegions ||
            userPermissions.canAssignGovernorates ||
            userPermissions.canAssignDelegations ||
            userPermissions.canAssignSupervisors ||
            userPermissions.canAssignAgents ||
            userPermissions.canAssignDirectors
        )
    ) {
        return null;
    }

    return (
        <div className="dropdown-unit">
            <div
                className="dropdown-bar"
                onClick={() => toggleSection("assignments")}
            >
                <h3>Assignments</h3>
                <FaAngleDown
                    className={`dropdown-icon ${expandedSection === "assignments" ? "expanded" : ""}`}
                />
            </div>
            {expandedSection === "assignments" &&
                (loadingAssignments ? (
                    <AssignmentsDropdownSkeleton />
                ) : (
                    <div className="dropdown-body">
                        <div className="group-header">
                            {hasUnsavedAssignmentChanges && (
                                <button
                                    className="action-button"
                                    onClick={handleSaveAssignments}
                                >
                                    Save Assignments
                                </button>
                            )}
                            {phoneError && (
                                <div className="error-message" style={{ color: "red" }}>
                                    {phoneError}
                                </div>
                            )}
                        </div>
                        {selectedUser.Roles?.some((r) => r.name === ROLES.REGIONAL_MANAGER) &&
                            userPermissions.canAssignRegions && (
                                <div className="assignment-list">
                                    <h4>Regions Assigned to This Regional Manager</h4>
                                    <div className="search-container assignment-search">
                                        <FaSearch className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search regions..."
                                            value={regionSearch}
                                            onChange={(e) => setRegionSearch(e.target.value)}
                                            className="search-input"
                                        />
                                    </div>
                                    <div className="list-container">
                                        {/* Render selected regions first */}
                                        {tempRegions.map((region) => (
                                            <div key={region.regionID} className="list-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={true}
                                                        onChange={() => handleToggleRegion(region)}
                                                        disabled={!userPermissions.canAssignRegions && !userPermissions.canRevokeRegions}
                                                    />
                                                    {region.name}
                                                </label>
                                            </div>
                                        ))}
                                        {/* Render remaining available regions */}
                                        {paginatedRegions
                                            .filter((region) => !tempRegions.some((r) => r.regionID === region.regionID))
                                            .map((region) => (
                                                <div key={region.regionID} className="list-item">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={false}
                                                            onChange={() => handleToggleRegion(region)}
                                                            disabled={!userPermissions.canAssignRegions && !userPermissions.canRevokeRegions}
                                                        />
                                                        {region.name}
                                                    </label>
                                                </div>
                                            ))}
                                    </div>
                                    <div className="pagination">
                                        <button
                                            onClick={() => setRegionPage((p) => Math.max(1, p - 1))}
                                            disabled={regionPage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span>
                                            Page {regionPage} of {Math.ceil(filteredRegions.length / ITEMS_PER_PAGE)}
                                        </span>
                                        <button
                                            onClick={() => setRegionPage((p) => p + 1)}
                                            disabled={regionPage >= Math.ceil(filteredRegions.length / ITEMS_PER_PAGE)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}

                        {selectedUser.Roles?.some((r) => r.name === ROLES.REGIONAL_MANAGER) &&
                            userPermissions.canAssignDirectors && (
                                <div className="assignment-list">
                                    <h4>Directors Assigned to This Regional Manager</h4>
                                    <div className="search-container assignment-search">
                                        <input
                                            type="text"
                                            placeholder="Enter director phone (8 digits)"
                                            value={directorPhoneInput}
                                            onChange={(e) => handlePhoneInput('director', e.target.value)}
                                            className="search-input"
                                        />
                                        <FaSearch className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search by name or phone..."
                                            value={directorSearch}
                                            onChange={(e) => setDirectorSearch(e.target.value)}
                                            className="search-input"
                                        />
                                    </div>
                                    <div className="list-container">
                                        {/* Render selected directors first */}
                                        {tempDirectors.map((director) => (
                                            <div key={director.userID} className="list-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={true}
                                                        onChange={() => handleToggleDirector(director)}
                                                        disabled={!userPermissions.canAssignDirectors && !userPermissions.canRevokeDirectors}
                                                    />
                                                    {`${director.firstname} ${director.lastname} (${director.phone})`}
                                                </label>
                                            </div>
                                        ))}
                                        {/* Render remaining available directors */}
                                        {paginatedDirectors
                                            .filter((director) => !tempDirectors.some((d) => d.userID === director.userID))
                                            .map((director) => (
                                                <div key={director.userID} className="list-item">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={false}
                                                            onChange={() => handleToggleDirector(director)}
                                                            disabled={!userPermissions.canAssignDirectors && !userPermissions.canRevokeDirectors}
                                                        />
                                                        {`${director.firstname} ${director.lastname} (${director.phone})`}
                                                    </label>
                                                </div>
                                            ))}
                                    </div>
                                    <div className="pagination">
                                        <button
                                            onClick={() => setDirectorPage((p) => Math.max(1, p - 1))}
                                            disabled={directorPage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span>
                                            Page {directorPage} of {Math.ceil(directorUsers.length / ITEMS_PER_PAGE)}
                                        </span>
                                        <button
                                            onClick={() => setDirectorPage((p) => p + 1)}
                                            disabled={directorPage >= Math.ceil(directorUsers.length / ITEMS_PER_PAGE)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}

                        {selectedUser.Roles?.some((r) => r.name === ROLES.REGIONAL_MANAGER) &&
                            userPermissions.canReadSupervisors && (
                                <div className="assignment-list">
                                    <h4>Supervisors Assigned to This Regional Manager</h4>
                                    <div className="search-container assignment-search">
                                        <input
                                            type="text"
                                            placeholder="Enter supervisor phone (8 digits)"
                                            value={supervisorPhoneInput}
                                            onChange={(e) => handlePhoneInput('supervisor', e.target.value)}
                                            className="search-input"
                                        />
                                        <FaSearch className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search by name or phone..."
                                            value={supervisorSearch}
                                            onChange={(e) => setSupervisorSearch(e.target.value)}
                                            className="search-input"
                                        />
                                    </div>
                                    <div className="list-container">
                                        {/* Render selected supervisors first */}
                                        {tempSupervisors.map((supervisor) => (
                                            <div key={supervisor.userID} className="list-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={true}
                                                        onChange={() => handleToggleSupervisor(supervisor)}
                                                        disabled={!userPermissions.canRevokeSupervisors}
                                                    />
                                                    {`${supervisor.firstname} ${supervisor.lastname} (${supervisor.phone})`}
                                                </label>
                                            </div>
                                        ))}
                                        {/* Render remaining available supervisors */}
                                        {paginatedSupervisors
                                            .filter((supervisor) => !tempSupervisors.some((s) => s.userID === supervisor.userID))
                                            .map((supervisor) => (
                                                <div key={supervisor.userID} className="list-item">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={false}
                                                            onChange={() => handleToggleSupervisor(supervisor)}
                                                            disabled={!userPermissions.canRevokeSupervisors}
                                                        />
                                                        {`${supervisor.firstname} ${supervisor.lastname} (${supervisor.phone})`}
                                                    </label>
                                                </div>
                                            ))}
                                    </div>
                                    <div className="pagination">
                                        <button
                                            onClick={() => setSupervisorPage((p) => Math.max(1, p - 1))}
                                            disabled={supervisorPage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span>
                                            Page {supervisorPage} of {Math.ceil(supervisorUsers.length / ITEMS_PER_PAGE)}
                                        </span>
                                        <button
                                            onClick={() => setSupervisorPage((p) => p + 1)}
                                            disabled={supervisorPage >= Math.ceil(supervisorUsers.length / ITEMS_PER_PAGE)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}

                        {selectedUser.Roles?.some((r) => r.name === ROLES.SUPERVISOR) &&
                            userPermissions.canReadRegionalManagers && (
                                <div className="assignment-list">
                                    <h4>Regional Managers Assigned to This Supervisor</h4>
                                    <div className="search-container assignment-search">
                                        <input
                                            type="text"
                                            placeholder="Enter regional manager phone (8 digits)"
                                            value={regionalManagerPhoneInput}
                                            onChange={(e) => handlePhoneInput('regionalManager', e.target.value)}
                                            className="search-input"
                                        />
                                        <FaSearch className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search by name or phone..."
                                            value={regionalManagerSearch}
                                            onChange={(e) => setRegionalManagerSearch(e.target.value)}
                                            className="search-input"
                                        />
                                    </div>
                                    <div className="list-container">
                                        {/* Render selected regional managers first */}
                                        {tempRegionalManagers.map((regionalManager) => (
                                            <div key={regionalManager.userID} className="list-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={true}
                                                        onChange={() => handleToggleRegionalManager(regionalManager)}
                                                        disabled={!userPermissions.canAssignSupervisors}
                                                    />
                                                    {`${regionalManager.firstname} ${regionalManager.lastname} (${regionalManager.phone})`}
                                                </label>
                                            </div>
                                        ))}
                                        {/* Render remaining available regional managers */}
                                        {paginatedRegionalManagers
                                            .filter((regionalManager) =>
                                                !tempRegionalManagers.some((m) => m.userID === regionalManager.userID)
                                            )
                                            .map((regionalManager) => (
                                                <div key={regionalManager.userID} className="list-item">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={false}
                                                            onChange={() => handleToggleRegionalManager(regionalManager)}
                                                            disabled={!userPermissions.canAssignSupervisors}
                                                        />
                                                        {`${regionalManager.firstname} ${regionalManager.lastname} (${regionalManager.phone})`}
                                                    </label>
                                                </div>
                                            ))}
                                    </div>
                                    <div className="pagination">
                                        <button
                                            onClick={() => setRegionalManagerPage((p) => Math.max(1, p - 1))}
                                            disabled={regionalManagerPage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span>
                                            Page {regionalManagerPage} of{" "}
                                            {Math.ceil(regionalManagerUsers.length / ITEMS_PER_PAGE)}
                                        </span>
                                        <button
                                            onClick={() => setRegionalManagerPage((p) => p + 1)}
                                            disabled={
                                                regionalManagerPage >= Math.ceil(regionalManagerUsers.length / ITEMS_PER_PAGE)
                                            }
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}

                        {selectedUser.Roles?.some((r) => r.name === ROLES.SUPERVISOR) &&
                            userPermissions.canAssignGovernorates && (
                                <div className="assignment-list">
                                    <h4>Governorates Assigned to This Supervisor</h4>
                                    <div className="search-container assignment-search">
                                        <FaSearch className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search governorates..."
                                            value={governorateSearch}
                                            onChange={(e) => setGovernorateSearch(e.target.value)}
                                            className="search-input"
                                        />
                                    </div>
                                    <div className="list-container">
                                        {/* Render selected governorates first */}
                                        {tempGovernorates.map((governorate) => (
                                            <div key={governorate.governorateID} className="list-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={true}
                                                        onChange={() => handleToggleGovernorate(governorate)}
                                                        disabled={
                                                            !userPermissions.canAssignGovernorates && !userPermissions.canRevokeGovernorates
                                                        }
                                                    />
                                                    {governorate.name}
                                                </label>
                                            </div>
                                        ))}
                                        {/* Render remaining available governorates */}
                                        {paginatedGovernorates
                                            .filter((governorate) =>
                                                !tempGovernorates.some((g) => g.governorateID === governorate.governorateID)
                                            )
                                            .map((governorate) => (
                                                <div key={governorate.governorateID} className="list-item">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={false}
                                                            onChange={() => handleToggleGovernorate(governorate)}
                                                            disabled={
                                                                !userPermissions.canAssignGovernorates && !userPermissions.canRevokeGovernorates
                                                            }
                                                        />
                                                        {governorate.name}
                                                    </label>
                                                </div>
                                            ))}
                                    </div>
                                    <div className="pagination">
                                        <button
                                            onClick={() => setGovernoratePage((p) => Math.max(1, p - 1))}
                                            disabled={governoratePage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span>
                                            Page {governoratePage} of {Math.ceil(filteredGovernorates.length / ITEMS_PER_PAGE)}
                                        </span>
                                        <button
                                            onClick={() => setGovernoratePage((p) => p + 1)}
                                            disabled={
                                                governoratePage >= Math.ceil(filteredGovernorates.length / ITEMS_PER_PAGE)
                                            }
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}

                        {selectedUser.Roles?.some((r) => r.name === ROLES.SUPERVISOR) &&
                            userPermissions.canAssignDelegations && (
                                <div className="assignment-list">
                                    <h4>Delegations Assigned to This Supervisor</h4>
                                    <div className="search-container assignment-search">
                                        <FaSearch className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search delegations..."
                                            value={delegationSearch}
                                            onChange={(e) => setDelegationSearch(e.target.value)}
                                            className="search-input"
                                        />
                                    </div>
                                    <div className="list-container">
                                        {/* Render selected delegations first */}
                                        {tempDelegations.map((delegation) => (
                                            <div key={delegation.delegationID} className="list-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={true}
                                                        onChange={() => handleToggleDelegation(delegation)}
                                                        disabled={
                                                            !userPermissions.canAssignDelegations && !userPermissions.canRevokeDelegations
                                                        }
                                                    />
                                                    {delegation.name}
                                                </label>
                                            </div>
                                        ))}
                                        {/* Render remaining available delegations */}
                                        {paginatedDelegations
                                            .filter((delegation) =>
                                                !tempDelegations.some((d) => d.delegationID === delegation.delegationID)
                                            )
                                            .map((delegation) => (
                                                <div key={delegation.delegationID} className="list-item">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={false}
                                                            onChange={() => handleToggleDelegation(delegation)}
                                                            disabled={
                                                                !userPermissions.canAssignDelegations && !userPermissions.canRevokeDelegations
                                                            }
                                                        />
                                                        {delegation.name}
                                                    </label>
                                                </div>
                                            ))}
                                    </div>
                                    <div className="pagination">
                                        <button
                                            onClick={() => setDelegationPage((p) => Math.max(1, p - 1))}
                                            disabled={delegationPage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span>
                                            Page {delegationPage} of {Math.ceil(filteredDelegations.length / ITEMS_PER_PAGE)}
                                        </span>
                                        <button
                                            onClick={() => setDelegationPage((p) => p + 1)}
                                            disabled={delegationPage >= Math.ceil(filteredDelegations.length / ITEMS_PER_PAGE)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}

                        {selectedUser.Roles?.some((r) => r.name === ROLES.SUPERVISOR) &&
                            userPermissions.canAssignAgents && (
                                <div className="assignment-list">
                                    <h4>Agents Assigned to This Supervisor</h4>
                                    <div className="search-container assignment-search">
                                        <input
                                            type="text"
                                            placeholder="Enter agent phone (8 digits)"
                                            value={agentPhoneInput}
                                            onChange={(e) => handlePhoneInput('agent', e.target.value)}
                                            className="search-input"
                                        />
                                        <FaSearch className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search by name or phone..."
                                            value={agentSearch}
                                            onChange={(e) => setAgentSearch(e.target.value)}
                                            className="search-input"
                                        />
                                    </div>
                                    <div className="list-container">
                                        {paginatedAgents.length > 0 ? (
                                            <>
                                                {/* Render selected agents first */}
                                                {tempAgents.map((agent) => (
                                                    <div key={agent.agentID} className="list-item">
                                                        <label>
                                                            <input
                                                                type="checkbox"
                                                                checked={true}
                                                                onChange={() => handleToggleAgent(agent)}
                                                                disabled={!userPermissions.canAssignAgents && !userPermissions.canRevokeAgents}
                                                            />
                                                            {`${agent.name} ${agent.lastname} (${agent.phone})`}
                                                        </label>
                                                    </div>
                                                ))}
                                                {/* Render remaining available agents */}
                                                {paginatedAgents
                                                    .filter((agent) => !tempAgents.some((a) => a.agentID === agent.agentID))
                                                    .map((agent) => (
                                                        <div key={agent.agentID} className="list-item">
                                                            <label>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={false}
                                                                    onChange={() => handleToggleAgent(agent)}
                                                                    disabled={!userPermissions.canAssignAgents && !userPermissions.canRevokeAgents}
                                                                />
                                                                {`${agent.name} ${agent.lastname} (${agent.phone})`}
                                                            </label>
                                                        </div>
                                                    ))}
                                            </>
                                        ) : (
                                            <div className="no-agents-message">
                                                No agents found in the selected delegation(s).
                                            </div>
                                        )}
                                    </div>
                                    {paginatedAgents.length > 0 && (
                                        <div className="pagination">
                                            <button
                                                onClick={() => setAgentPage((p) => Math.max(1, p - 1))}
                                                disabled={agentPage === 1}
                                            >
                                                Previous
                                            </button>
                                            <span>
                                                Page {agentPage} of {Math.ceil(filteredAgents.length / ITEMS_PER_PAGE)}
                                            </span>
                                            <button
                                                onClick={() => setAgentPage((p) => p + 1)}
                                                disabled={agentPage >= Math.ceil(filteredAgents.length / ITEMS_PER_PAGE)}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                    </div>
                ))}
        </div>
    );
};

export default React.memo(AssignmentsManagement);
