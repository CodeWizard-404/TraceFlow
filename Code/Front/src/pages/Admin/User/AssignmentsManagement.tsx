/**
 * AssignmentsManagement.tsx
 * Handles assignments for regions, governorates, delegations, supervisors, agents, regional managers, and directors.
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { FaAngleDown, FaSearch } from "react-icons/fa";
import { useError } from "../../../context/ErrorContext";
import {
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
    getAgentByPhone,
    getAgentsByLocation,
} from "../../../apis/agentAPI";
import User from "../../../models/User";
import Agent from "../../../models/Agent";
import Region from "../../../models/Region";
import Governorate from "../../../models/Governorate";
import Delegation from "../../../models/Delegation";
import "../AdminDashboard.css";
import Role from "../../../models/Role";

interface AssignmentsManagementProps {
    selectedUser: User | null;
    users: User[];
    expandedSection: string | null;
    toggleSection: (section: string) => void;
    userPermissions: {
        canCreateUsers: boolean;
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
    tempRoles?: Role[];
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
    tempRoles = [],
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

    const selectedRegionalManager = useMemo(() => {
        return selectedUser?.regionalManagerID
            ? users.find((u) => u.userID === selectedUser.regionalManagerID) || null
            : null;
    }, [selectedUser, users]);

    const selectedDirector = useMemo(() => {
        return selectedUser?.directorID
            ? users.find((u) => u.userID === selectedUser.directorID) || null
            : null;
    }, [selectedUser, users]);

    // Sync temp* states with selectedUser assignments
    useEffect(() => {
        if (!selectedUser) {
            setTempSupervisors([]);
            setTempRegionalManagers([]);
            setTempDirectors([]);
            setTempRegions([]);
            setTempGovernorates([]);
            setTempDelegations([]);
            setTempAgents([]);
            return;
        }

        if (!hasUnsavedAssignmentChanges) {
            setTempSupervisors(selectedUser.supervisors || []);
            setTempRegionalManagers(selectedRegionalManager ? [selectedRegionalManager] : []);
            setTempDirectors(selectedDirector ? [selectedDirector] : []);
            setTempRegions(selectedUser.Regions || []);
            setTempGovernorates(selectedUser.Governorates || []);
            setTempDelegations(selectedUser.Delegations || []);
            setTempAgents(
                availableAgents.filter((agent) => agent.supervisorID === selectedUser.userID) || []
            );
        }
    }, [
        selectedUser,
        selectedRegionalManager,
        selectedDirector,
        availableAgents,
        hasUnsavedAssignmentChanges,
        setTempSupervisors,
        setTempRegionalManagers,
        setTempDirectors,
        setTempRegions,
        setTempGovernorates,
        setTempDelegations,
        setTempAgents,
    ]);

    const fetchAssignments = useCallback(async () => {
        try {
            setLoadingAssignments(true);
            const [regions, governorates, delegations] = await Promise.all([
                getAllRegions(),
                getAllGovernorates(),
                getAllDelegations(),
            ]);
            setAllRegions(regions || []);
            setAllGovernorates(governorates || []);
            setAllDelegations(delegations || []);
        } catch (error) {
            setGlobalError(
                error instanceof Error ? error.message : "Failed to load assignments."
            );
        } finally {
            setLoadingAssignments(false);
        }
    }, [setGlobalError]);

    useEffect(() => {
        if (expandedSection === "assignments") {
            fetchAssignments();
        }
    }, [expandedSection, fetchAssignments]);

    const shouldFetchAgents = useMemo(() => {
        if (selectedUser) {
            return (
                selectedUser.Roles?.some((r) => r.name === ROLES.SUPERVISOR) &&
                tempDelegations.length > 0
            );
        }
        return tempRoles.some((r) => r.name === ROLES.SUPERVISOR) && tempDelegations.length > 0;
    }, [selectedUser, tempRoles, tempDelegations]);

    useEffect(() => {
        if (!shouldFetchAgents) {
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
                const allAgents = Array.from(
                    new Map(
                        agentsResponses
                            .flatMap((response) => response.agents || [])
                            .map((agent) => [agent.agentID, agent])
                    ).values()
                );
                if (!isCancelled) {
                    setAvailableAgents(allAgents);
                }
            } catch (error) {
                if (!isCancelled) {
                    if (error instanceof Error && error.message === "No agents found") {
                        setAvailableAgents([]);
                    } else {
                        setGlobalError(
                            error instanceof Error
                                ? error.message
                                : "Failed to fetch agents by delegations."
                        );
                    }
                }
            }
        };

        fetchAgentsByDelegations();

        return () => {
            isCancelled = true;
        };
    }, [shouldFetchAgents, tempDelegations, setGlobalError]);

    const handlePhoneInput = useCallback(
        async (type: "supervisor" | "regionalManager" | "director" | "agent", phone: string) => {
            if (type === "agent") {
                setAgentPhoneInput(phone);
            } else if (type === "supervisor") {
                setSupervisorPhoneInput(phone);
            } else if (type === "regionalManager") {
                setRegionalManagerPhoneInput(phone);
            } else if (type === "director") {
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
                if (type === "agent") {
                    const response = await getAgentByPhone(phone);
                    const agent = response.agent;
                    setTempAgents((prev) => {
                        if (!prev.some((a) => a.agentID === agent.agentID)) {
                            const selected = [agent];
                            const unselected = prev
                                .filter((a) => a.agentID !== agent.agentID)
                                .sort((a, b) =>
                                    `${a.name} ${a.lastname}`.localeCompare(`${b.name} ${b.lastname}`)
                                );
                            return [...selected, ...unselected];
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
                    if (type === "supervisor" && userRoles.some((r: { name: string }) => r.name === ROLES.SUPERVISOR)) {
                        setTempSupervisors((prev) => {
                            if (!prev.some((s) => s.userID === userID)) {
                                const selected = [user];
                                const unselected = prev
                                    .filter((s) => s.userID !== userID)
                                    .sort((a, b) =>
                                        `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                                    );
                                return [...selected, ...unselected];
                            }
                            return prev;
                        });
                        setSupervisorPhoneInput("");
                    } else if (
                        type === "regionalManager" &&
                        userRoles.some((r: { name: string }) => r.name === ROLES.REGIONAL_MANAGER)
                    ) {
                        setTempRegionalManagers([user]);
                        setRegionalManagerPhoneInput("");
                    } else if (
                        type === "director" &&
                        userRoles.some((r: { name: string }) => r.name === ROLES.DIRECTOR)
                    ) {
                        setTempDirectors([user]);
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
        const filtered = users
            .filter((u) => u.Roles?.some((r) => r.name === ROLES.SUPERVISOR))
            .filter(
                (s) =>
                    `${s.firstname} ${s.lastname}`
                        .toLowerCase()
                        .includes(supervisorSearch.toLowerCase()) ||
                    s.phone.includes(supervisorSearch) ||
                    s.email.toLowerCase().includes(supervisorSearch.toLowerCase())
            );
        const selected = filtered.filter((s) => tempSupervisors.some((ts) => ts.userID === s.userID));
        const unselected = filtered
            .filter((s) => !tempSupervisors.some((ts) => ts.userID === s.userID))
            .sort((a, b) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`));
        return [...selected, ...unselected];
    }, [users, supervisorSearch, tempSupervisors]);

    const regionalManagerUsers = useMemo(() => {
        const filtered = users
            .filter((u) => u.Roles?.some((r) => r.name === ROLES.REGIONAL_MANAGER))
            .filter(
                (m) =>
                    `${m.firstname} ${m.lastname}`
                        .toLowerCase()
                        .includes(regionalManagerSearch.toLowerCase()) ||
                    m.phone.includes(regionalManagerSearch) ||
                    m.email.toLowerCase().includes(regionalManagerSearch.toLowerCase())
            );
        const selected = filtered.filter((m) => tempRegionalManagers.some((tm) => tm.userID === m.userID));
        const unselected = filtered
            .filter((m) => !tempRegionalManagers.some((tm) => tm.userID === m.userID))
            .sort((a, b) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`));
        return [...selected, ...unselected];
    }, [users, regionalManagerSearch, tempRegionalManagers]);

    const directorUsers = useMemo(() => {
        const filtered = users
            .filter((u) => u.Roles?.some((r) => r.name === ROLES.DIRECTOR))
            .filter(
                (d) =>
                    `${d.firstname} ${d.lastname}`
                        .toLowerCase()
                        .includes(directorSearch.toLowerCase()) ||
                    d.phone.includes(directorSearch) ||
                    d.email.toLowerCase().includes(directorSearch.toLowerCase())
            );
        const selected = filtered.filter((d) => tempDirectors.some((td) => td.userID === d.userID));
        const unselected = filtered
            .filter((d) => !tempDirectors.some((td) => td.userID === d.userID))
            .sort((a, b) => `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`));
        return [...selected, ...unselected];
    }, [users, directorSearch, tempDirectors]);

    const filteredAgents = useMemo(() => {
        const filtered = availableAgents.filter(
            (a) =>
                `${a.name} ${a.lastname}`
                    .toLowerCase()
                    .includes(agentSearch.toLowerCase()) ||
                a.phone.includes(agentSearch)
        );
        const selected = filtered.filter((a) => tempAgents.some((ta) => ta.agentID === a.agentID));
        const unselected = filtered
            .filter((a) => !tempAgents.some((ta) => ta.agentID === a.agentID))
            .sort((a, b) => `${a.name} ${a.lastname}`.localeCompare(`${b.name} ${b.lastname}`));
        return [...selected, ...unselected];
    }, [availableAgents, agentSearch, tempAgents]);

    const filteredRegions = useMemo(() => {
        const filtered = allRegions.filter((region) =>
            region.name.toLowerCase().includes(regionSearch.toLowerCase())
        );
        const selected = filtered.filter((r) => tempRegions.some((tr) => tr.regionID === r.regionID));
        const unselected = filtered
            .filter((r) => !tempRegions.some((tr) => tr.regionID === r.regionID))
            .sort((a, b) => a.name.localeCompare(b.name));
        return [...selected, ...unselected];
    }, [allRegions, regionSearch, tempRegions]);

    const filteredGovernorates = useMemo(() => {
        const rmRegions =
            tempRegionalManagers
                .flatMap((rm) => rm.Regions || [])
                .map((region) => region.regionID) || [];
        const filtered = allGovernorates
            .filter((gov) => rmRegions.includes(gov.regionID))
            .filter((gov) => gov.name.toLowerCase().includes(governorateSearch.toLowerCase()));
        const selected = filtered.filter((g) => tempGovernorates.some((tg) => tg.governorateID === g.governorateID));
        const unselected = filtered
            .filter((g) => !tempGovernorates.some((tg) => tg.governorateID === g.governorateID))
            .sort((a, b) => a.name.localeCompare(b.name));
        return [...selected, ...unselected];
    }, [allGovernorates, governorateSearch, tempRegionalManagers, tempGovernorates]);

    const filteredDelegations = useMemo(() => {
        const supervisorGovernorates = tempGovernorates.map((gov) => gov.governorateID) || [];
        const filtered = allDelegations
            .filter((del) => supervisorGovernorates.includes(del.governorateID))
            .filter((del) => del.name.toLowerCase().includes(delegationSearch.toLowerCase()));
        const selected = filtered.filter((d) => tempDelegations.some((td) => td.delegationID === d.delegationID));
        const unselected = filtered
            .filter((d) => !tempDelegations.some((td) => td.delegationID === d.delegationID))
            .sort((a, b) => a.name.localeCompare(b.name));
        return [...selected, ...unselected];
    }, [allDelegations, delegationSearch, tempGovernorates, tempDelegations]);

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
            if (!userPermissions.canAssignSupervisors) return;
            setTempSupervisors((prev: User[]) => {
                const hasSupervisor = prev.some((s) => s.userID === supervisor.userID);
                if (hasSupervisor) {
                    return prev
                        .filter((s) => s.userID !== supervisor.userID)
                        .sort((a, b) =>
                            `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                        );
                } else {
                    const selected = [supervisor];
                    const unselected = prev
                        .filter((s) => s.userID !== supervisor.userID)
                        .sort((a, b) =>
                            `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                        );
                    return [...selected, ...unselected];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignSupervisors, setTempSupervisors]
    );

    const handleToggleRegionalManager = useCallback(
        (regionalManager: User) => {
            if (!userPermissions.canAssignSupervisors) return;
            setTempRegionalManagers((prev: User[]) => {
                const hasRegionalManager = prev.some((m) => m.userID === regionalManager.userID);
                if (hasRegionalManager) {
                    return prev
                        .filter((m) => m.userID !== regionalManager.userID)
                        .sort((a, b) =>
                            `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                        );
                } else {
                    return [regionalManager];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignSupervisors, setTempRegionalManagers]
    );

    const handleToggleDirector = useCallback(
        (director: User) => {
            if (!userPermissions.canAssignDirectors) return;
            setTempDirectors((prev: User[]) => {
                const hasDirector = prev.some((d) => d.userID === director.userID);
                if (hasDirector) {
                    return prev
                        .filter((d) => d.userID !== director.userID)
                        .sort((a, b) =>
                            `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                        );
                } else {
                    return [director];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignDirectors, setTempDirectors]
    );

    const handleToggleRegion = useCallback(
        (region: Region) => {
            if (!userPermissions.canAssignRegions) return;
            setTempRegions((prev: Region[]) => {
                const hasRegion = prev.some((r) => r.regionID === region.regionID);
                if (hasRegion) {
                    return prev
                        .filter((r) => r.regionID !== region.regionID)
                        .sort((a, b) => a.name.localeCompare(b.name));
                } else {
                    const selected = [region];
                    const unselected = prev
                        .filter((r) => r.regionID !== region.regionID)
                        .sort((a, b) => a.name.localeCompare(b.name));
                    return [...selected, ...unselected];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignRegions, setTempRegions]
    );

    const handleToggleGovernorate = useCallback(
        (governorate: Governorate) => {
            if (!userPermissions.canAssignGovernorates) return;
            setTempGovernorates((prev: Governorate[]) => {
                const hasGovernorate = prev.some(
                    (g) => g.governorateID === governorate.governorateID
                );
                if (hasGovernorate) {
                    return prev.filter((g) => g.governorateID !== governorate.governorateID);
                } else {
                    return [...prev, governorate];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignGovernorates, setTempGovernorates]
    );

    const handleToggleDelegation = useCallback(
        (delegation: Delegation) => {
            if (!userPermissions.canAssignDelegations) return;
            setTempDelegations((prev: Delegation[]) => {
                const hasDelegation = prev.some((d) => d.delegationID === delegation.delegationID);
                if (hasDelegation) {
                    return prev
                        .filter((d) => d.delegationID !== delegation.delegationID)
                        .sort((a, b) => a.name.localeCompare(b.name));
                } else {
                    const selected = [delegation];
                    const unselected = prev
                        .filter((d) => d.delegationID !== delegation.delegationID)
                        .sort((a, b) => a.name.localeCompare(b.name));
                    return [...selected, ...unselected];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignDelegations, setTempDelegations]
    );

    const handleToggleAgent = useCallback(
        (agent: Agent) => {
            if (!userPermissions.canAssignAgents) return;
            setTempAgents((prev: Agent[]) => {
                const hasAgent = prev.some((a) => a.agentID === agent.agentID);
                if (hasAgent) {
                    return prev
                        .filter((a) => a.agentID !== agent.agentID)
                        .sort((a, b) => `${a.name} ${a.lastname}`.localeCompare(`${b.name} ${b.lastname}`));
                } else {
                    const selected = [agent];
                    const unselected = prev
                        .filter((a) => a.agentID !== agent.agentID)
                        .sort((a, b) => `${a.name} ${a.lastname}`.localeCompare(`${b.name} ${b.lastname}`));
                    return [...selected, ...unselected];
                }
            });
            setHasUnsavedAssignmentChanges(true);
        },
        [userPermissions.canAssignAgents, setTempAgents]
    );

    const handleSaveAssignments = useCallback(async () => {
        if (!selectedUser) return;
        try {
            const isRegionalManager = selectedUser.Roles?.some(
                (r) => r.name === ROLES.REGIONAL_MANAGER
            );
            const isSupervisor = selectedUser.Roles?.some(
                (r) => r.name === ROLES.SUPERVISOR
            );

            if (isRegionalManager) {
                if (userPermissions.canAssignRegions) {
                    const currentRegionIds = selectedUser.Regions?.map((r) => r.regionID) || [];
                    const newRegionIds = tempRegions.map((r) => r.regionID);
                    const regionsToAssign = newRegionIds.filter((id) => !currentRegionIds.includes(id));
                    const regionsToRevoke = currentRegionIds.filter((id) => !newRegionIds.includes(id));

                    if (regionsToAssign.length > 0) {
                        await assignRegionsToRegionalManager(selectedUser.userID, regionsToAssign);
                    }
                    if (regionsToRevoke.length > 0) {
                        await revokeRegionsFromRegionalManager(selectedUser.userID, regionsToRevoke);
                    }
                }

                if (userPermissions.canAssignDirectors) {
                    const currentDirectorId = selectedUser.directorID || "";
                    const newDirectorId = tempDirectors[0]?.userID || "";
                    if (newDirectorId && newDirectorId !== currentDirectorId) {
                        await assignDirectorToRegionalManager(selectedUser.userID, newDirectorId);
                    } else if (currentDirectorId && !newDirectorId) {
                        await revokeDirectorFromRegionalManager(selectedUser.userID);
                    }
                }

                if (userPermissions.canAssignSupervisors) {
                    const currentSupervisorIds = selectedUser.supervisors?.map((s) => s.userID) || [];
                    const newSupervisorIds = tempSupervisors.map((s) => s.userID);
                    const supervisorsToAssign = newSupervisorIds.filter(
                        (id) => !currentSupervisorIds.includes(id)
                    );
                    const supervisorsToRevoke = currentSupervisorIds.filter(
                        (id) => !newSupervisorIds.includes(id)
                    );

                    for (const supervisorId of supervisorsToAssign) {
                        await assignRegionalManagerToSupervisor(supervisorId, selectedUser.userID);
                    }
                    for (const supervisorId of supervisorsToRevoke) {
                        await revokeRegionalManagerFromSupervisor(supervisorId, selectedUser.userID);
                    }
                }
            }

            if (isSupervisor) {
                if (userPermissions.canAssignSupervisors) {
                    const currentRegionalManagerId = selectedUser.regionalManagerID || "";
                    const newRegionalManagerId = tempRegionalManagers[0]?.userID || "";
                    if (newRegionalManagerId && newRegionalManagerId !== currentRegionalManagerId) {
                        await assignRegionalManagerToSupervisor(selectedUser.userID, newRegionalManagerId);
                    } else if (currentRegionalManagerId && !newRegionalManagerId) {
                        await revokeRegionalManagerFromSupervisor(selectedUser.userID, currentRegionalManagerId);
                    }
                }

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
                        await assignGovernoratesToSupervisor(selectedUser.userID, governoratesToAssign);
                    }
                    if (governoratesToRevoke.length > 0) {
                        await revokeGovernoratesFromSupervisor(selectedUser.userID, governoratesToRevoke);
                    }
                }

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
                        await assignDelegationsToSupervisor(selectedUser.userID, delegationsToAssign);
                    }
                    if (delegationsToRevoke.length > 0) {
                        await revokeDelegationsFromSupervisor(selectedUser.userID, delegationsToRevoke);
                    }
                }

                if (userPermissions.canAssignAgents) {
                    const currentAgentIds =
                        (selectedUser.agents || []).map((agent) => agent.agentID) || [];
                    const newAgentIds = tempAgents.map((agent) => agent.agentID);
                    const agentsToAssign = tempAgents.filter(
                        (agent) => !currentAgentIds.includes(agent.agentID)
                    );
                    const agentsToRevoke = currentAgentIds.filter((id) => !newAgentIds.includes(id));
                    const delegation = tempDelegations[0];
                    if (!delegation && agentsToAssign.length > 0) {
                        throw new Error("At least one delegation must be assigned to the supervisor.");
                    }

                    for (const agent of agentsToAssign) {
                        await assignSupervisorToAgent(agent.agentID, selectedUser.userID, delegation.delegationID);
                    }

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
                agents: tempAgents,
            };

            setUsers((prevUsers) =>
                prevUsers.map((u) => (u.userID === selectedUser.userID ? updatedUser : u))
            );
            setSelectedUser(updatedUser);
            setHasUnsavedAssignmentChanges(false);
        } catch (error) {
            setGlobalError(
                error instanceof Error ? error.message : "Failed to save assignments."
            );
            if (selectedUser) {
                setTempSupervisors(selectedUser.supervisors || []);
                setTempRegionalManagers(selectedRegionalManager ? [selectedRegionalManager] : []);
                setTempDirectors(selectedDirector ? [selectedDirector] : []);
                setTempRegions(selectedUser.Regions || []);
                setTempGovernorates(selectedUser.Governorates || []);
                setTempDelegations(selectedUser.Delegations || []);
                setTempAgents(
                    availableAgents.filter((agent) => agent.supervisorID === selectedUser.userID) || []
                );
            }
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
        selectedRegionalManager,
        selectedDirector,
        availableAgents,
    ]);

    const shouldRender = useMemo(
        () =>
            (selectedUser &&
                (selectedUser.Roles?.some((r) => r.name === ROLES.REGIONAL_MANAGER) ||
                    selectedUser.Roles?.some((r) => r.name === ROLES.SUPERVISOR))) ||
            (!selectedUser &&
                tempRoles.some((r) =>
                    [ROLES.REGIONAL_MANAGER, ROLES.SUPERVISOR, ROLES.DIRECTOR].includes(r.name)
                )),
        [selectedUser, tempRoles]
    );

    if (
        !shouldRender ||
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
                            {hasUnsavedAssignmentChanges && selectedUser && (
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
                        {((selectedUser?.Roles?.some((r) => r.name === ROLES.REGIONAL_MANAGER)) ||
                            (!selectedUser && tempRoles.some((r) => r.name === ROLES.REGIONAL_MANAGER))) &&
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
                                        {paginatedRegions.map((region) => (
                                            <div key={region.regionID} className="list-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={tempRegions.some((r) => r.regionID === region.regionID)}
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

                        {((selectedUser?.Roles?.some((r) => r.name === ROLES.REGIONAL_MANAGER)) ||
                            (!selectedUser && tempRoles.some((r) => r.name === ROLES.REGIONAL_MANAGER))) &&
                            userPermissions.canAssignDirectors && (
                                <div className="assignment-list">
                                    <h4>Directors Assigned to This Regional Manager</h4>
                                    <div className="search-container assignment-search">
                                        <input
                                            type="text"
                                            placeholder="Enter director phone (8 digits)"
                                            value={directorPhoneInput}
                                            onChange={(e) => handlePhoneInput("director", e.target.value)}
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
                                        {paginatedDirectors.map((director) => (
                                            <div key={director.userID} className="list-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={tempDirectors.some((d) => d.userID === director.userID)}
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

                        {((selectedUser?.Roles?.some((r) => r.name === ROLES.REGIONAL_MANAGER)) ||
                            (!selectedUser && tempRoles.some((r) => r.name === ROLES.REGIONAL_MANAGER))) &&
                            userPermissions.canReadSupervisors && (
                                <div className="assignment-list">
                                    <h4>Supervisors Assigned to This Regional Manager</h4>
                                    <div className="search-container assignment-search">
                                        <input
                                            type="text"
                                            placeholder="Enter supervisor phone (8 digits)"
                                            value={supervisorPhoneInput}
                                            onChange={(e) => handlePhoneInput("supervisor", e.target.value)}
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
                                        {paginatedSupervisors.map((supervisor) => (
                                            <div key={supervisor.userID} className="list-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={tempSupervisors.some((s) => s.userID === supervisor.userID)}
                                                        onChange={() => handleToggleSupervisor(supervisor)}
                                                        disabled={!userPermissions.canAssignSupervisors && !userPermissions.canRevokeSupervisors}
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

                        {((selectedUser?.Roles?.some((r) => r.name === ROLES.SUPERVISOR)) ||
                            (!selectedUser && tempRoles.some((r) => r.name === ROLES.SUPERVISOR))) &&
                            userPermissions.canReadRegionalManagers && (
                                <div className="assignment-list">
                                    <h4>Regional Managers Assigned to This Supervisor</h4>
                                    <div className="search-container assignment-search">
                                        <input
                                            type="text"
                                            placeholder="Enter regional manager phone (8 digits)"
                                            value={regionalManagerPhoneInput}
                                            onChange={(e) => handlePhoneInput("regionalManager", e.target.value)}
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
                                        {paginatedRegionalManagers.map((regionalManager) => (
                                            <div key={regionalManager.userID} className="list-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={tempRegionalManagers.some((m) => m.userID === regionalManager.userID)}
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

                        {((selectedUser?.Roles?.some((r) => r.name === ROLES.SUPERVISOR)) ||
                            (!selectedUser && tempRoles.some((r) => r.name === ROLES.SUPERVISOR))) &&
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
                                        {paginatedGovernorates.map((governorate) => (
                                            <div key={governorate.governorateID} className="list-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={tempGovernorates.some((g) => g.governorateID === governorate.governorateID)}
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

                        {((selectedUser?.Roles?.some((r) => r.name === ROLES.SUPERVISOR)) ||
                            (!selectedUser && tempRoles.some((r) => r.name === ROLES.SUPERVISOR))) &&
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
                                        {paginatedDelegations.map((delegation) => (
                                            <div key={delegation.delegationID} className="list-item">
                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={tempDelegations.some((d) => d.delegationID === delegation.delegationID)}
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

                        {((selectedUser?.Roles?.some((r) => r.name === ROLES.SUPERVISOR)) ||
                            (!selectedUser && tempRoles.some((r) => r.name === ROLES.SUPERVISOR))) &&
                            userPermissions.canAssignAgents && (
                                <div className="assignment-list">
                                    <h4>Agents Assigned to This Supervisor</h4>
                                    <div className="search-container assignment-search">
                                        <input
                                            type="text"
                                            placeholder="Enter agent phone (8 digits)"
                                            value={agentPhoneInput}
                                            onChange={(e) => handlePhoneInput("agent", e.target.value)}
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
                                            paginatedAgents.map((agent) => (
                                                <div key={agent.agentID} className="list-item">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={tempAgents.some((a) => a.agentID === agent.agentID)}
                                                            onChange={() => handleToggleAgent(agent)}
                                                            disabled={!userPermissions.canAssignAgents && !userPermissions.canRevokeAgents}
                                                        />
                                                        {`${agent.name} ${agent.lastname} (${agent.phone})`}
                                                    </label>
                                                </div>
                                            ))
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