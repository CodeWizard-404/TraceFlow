/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { FaAngleDown, FaSearch } from "react-icons/fa";
import { useError } from "../../../context/ErrorContext";
import {
    assignDirectorToRegionalManager,
    revokeDirectorFromRegionalManager,
    assignRegionalManagerToSupervisor,
    revokeRegionalManagerFromSupervisor,
    assignSupervisorToAgent,
    revokeSupervisorFromAgent,
    assignRegionsToRegionalManager,
    revokeRegionsFromRegionalManager,
    assignGovernoratesToSupervisor,
    revokeGovernoratesFromSupervisor,
    assignDelegationsToSupervisor,
    revokeDelegationsFromSupervisor,
    getUserByPhone,
    getUsersByRole,
    getRegionalManagersByUser,
    getDirectorByUser,
    getSupervisorsByUser,

} from "../../../apis/userAPI";
import {
    getRegionsByUser,
    getGovernoratesByUser,
    getDelegationsByUser,
    getAllRegions,
    getGovernoratesByRegion,
    getDelegationsByGovernorate,
} from "../../../apis/locationApi";
import { getAgentByPhone, getAgentsByDelegation, getAgentsByUser } from "../../../apis/agentAPI";
import User from "../../../models/User";
import Agent from "../../../models/Agent";
import Region from "../../../models/Region";
import Governorate from "../../../models/Governorate";
import Delegation from "../../../models/Delegation";
import Role from "../../../models/Role";
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
    tempRoles?: Role[];
}

const ITEMS_PER_PAGE = 10;
const ROLES = {
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
    SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
    REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
    DIRECTOR: import.meta.env.VITE_ROLES_DIRECTOR,
    AGENT: import.meta.env.VITE_ROLES_AGENT,
};

interface AssignmentListItem {
    id?: string;
    regionID?: string;
    governorateID?: string;
    delegationID?: string;
    agentID?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    name?: string;
}

const AssignmentList: React.FC<{
    title: string;
    items: AssignmentListItem[];
    selectedItems: AssignmentListItem[];
    onToggle: (item: AssignmentListItem) => void;
    renderLabel: (item: AssignmentListItem) => string;
    search: string;
    setSearch: (value: string) => void;
    phoneInput?: string;
    setPhoneInput?: (value: string) => void;
    handlePhoneInput?: (phone: string) => void;
    page: number;
    setPage: (page: number) => void;
    disabled: boolean;
    singleSelection?: boolean;
}> = ({
    title,
    items,
    selectedItems,
    onToggle,
    renderLabel,
    search,
    setSearch,
    phoneInput,
    setPhoneInput,
    handlePhoneInput,
    page,
    setPage,
    disabled,
    singleSelection = false,
}) => {
        const filteredItems = useMemo(() => {
            const searchLower = search.toLowerCase();
            return items.filter((item) =>
                renderLabel(item).toLowerCase().includes(searchLower) ||
                (item.phone && item.phone.includes(search))
            );
        }, [items, search, renderLabel]);

        const paginatedItems = useMemo(() => {
            const start = (page - 1) * ITEMS_PER_PAGE;
            return filteredItems.slice(start, start + ITEMS_PER_PAGE);
        }, [filteredItems, page]);

        return (
            <div className="assignment-list">
                <h4>{title}</h4>
                <div className="search-container assignment-search">
                    {phoneInput !== undefined && setPhoneInput && handlePhoneInput && (
                        <>
                            <input
                                type="number"
                                placeholder="Enter phone (8 digits)"
                                value={phoneInput}
                                onChange={(e) => {
                                    const value = e.target.value.slice(0, 8);
                                    setPhoneInput(value);
                                    if (value.length === 8) handlePhoneInput(value);
                                }}
                                className="search-input"
                                maxLength={8}
                            />
                            <FaSearch className="search-icon" />
                        </>
                    )}
                    <input
                        type="text"
                        placeholder="Search by name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="search-input"
                    />
                    <FaSearch className="search-icon" />
                </div>
                <div className="list-container">
                    {paginatedItems.length > 0 ? (
                        paginatedItems.map((item) => (
                            <div
                                key={item.id || item.regionID || item.governorateID || item.delegationID || item.agentID}
                                className="list-item"
                            >
                                <label>
                                    <input
                                        type={singleSelection ? "radio" : "checkbox"}
                                        name={singleSelection ? title : undefined}
                                        checked={selectedItems.some(
                                            (s) =>
                                                s.id === item.id ||
                                                s.regionID === item.regionID ||
                                                s.governorateID === item.governorateID ||
                                                s.delegationID === item.delegationID ||
                                                s.agentID === item.agentID
                                        )}
                                        onChange={() => onToggle(item)}
                                        disabled={disabled}
                                    />
                                    {renderLabel(item)}
                                </label>
                            </div>
                        ))
                    ) : (
                        <div className="no-items-message">No items found.</div>
                    )}
                </div>
                {filteredItems.length > ITEMS_PER_PAGE && (
                    <div className="pagination">
                        <button
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page === 1}
                        >
                            Previous
                        </button>
                        <span>
                            Page {page} of {Math.ceil(filteredItems.length / ITEMS_PER_PAGE)}
                        </span>
                        <button
                            onClick={() => setPage(page + 1)}
                            disabled={page >= Math.ceil(filteredItems.length / ITEMS_PER_PAGE)}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        );
    };

const AssignmentsManagement: React.FC<AssignmentsManagementProps> = ({
    selectedUser,
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
    const [loading, setLoading] = useState(false);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showConfirm, setShowConfirm] = useState<{
        message: string;
        onConfirm: (cascade: boolean) => void;
    } | null>(null);
    const [state, setState] = useState({
        allDirectors: [] as User[],
        allRegionalManagers: [] as User[],
        allSupervisors: [] as User[],
        allRegions: [] as Region[],
        availableGovernorates: [] as Governorate[],
        availableDelegations: [] as Delegation[],
        availableAgents: [] as Agent[],
        assignedDirector: null as User | null,
        assignedRegionalManager: null as User | null,
        assignedRegions: [] as Region[],
        assignedSupervisors: [] as User[],
        assignedGovernorates: [] as Governorate[],
        assignedDelegations: [] as Delegation[],
        assignedAgents: [] as Agent[],
        directorSearch: "",
        regionalManagerSearch: "",
        supervisorSearch: "",
        regionSearch: "",
        governorateSearch: "",
        delegationSearch: "",
        agentSearch: "",
        directorPhoneInput: "",
        regionalManagerPhoneInput: "",
        supervisorPhoneInput: "",
        agentPhoneInput: "",
        directorPage: 1,
        regionalManagerPage: 1,
        supervisorPage: 1,
        regionPage: 1,
        governoratePage: 1,
        delegationPage: 1,
        agentPage: 1,
    });

    const role = selectedUser?.Roles?.[0]?.name || tempRoles[0]?.name;

    const updateState = useCallback((updates: Partial<typeof state>) => {
        setState((prev) => ({ ...prev, ...updates }));
    }, []);

    // Fetch data based on role when section is expanded
    useEffect(() => {
        if (expandedSection !== "assignments" || !selectedUser) return;
        setLoading(true);
        const fetchData = async () => {
            try {
                if (role === ROLES.DIRECTOR) {
                    const [allRMs, assignedRMs] = await Promise.all([
                        getUsersByRole(ROLES.REGIONAL_MANAGER),
                        getRegionalManagersByUser(selectedUser.userID),
                    ]);
                    updateState({ allRegionalManagers: allRMs, assignedRegionalManagers: assignedRMs });
                    setTempRegionalManagers(assignedRMs);
                } else if (role === ROLES.REGIONAL_MANAGER) {
                    const [allDirectors, assignedDirector, allRegions, assignedRegions, allSupervisors, assignedSupervisors] = await Promise.all([
                        getUsersByRole(ROLES.DIRECTOR),
                        getDirectorByUser(selectedUser.userID),
                        getAllRegions(),
                        getRegionsByUser(selectedUser.userID),
                        getUsersByRole(ROLES.SUPERVISOR),
                        getSupervisorsByUser(selectedUser.userID),
                    ]);
                    updateState({
                        allDirectors,
                        assignedDirector,
                        allRegions,
                        assignedRegions,
                        allSupervisors,
                        assignedSupervisors,
                    });
                    setTempDirectors(assignedDirector ? [assignedDirector] : []);
                    setTempRegions(assignedRegions);
                    setTempSupervisors(assignedSupervisors);
                } else if (role === ROLES.SUPERVISOR) {
                    const [allRMs, assignedRM, assignedGovs, assignedDels, assignedAgents] = await Promise.all([
                        getUsersByRole(ROLES.REGIONAL_MANAGER),
                        getRegionalManagersByUser(selectedUser.userID),
                        getGovernoratesByUser(selectedUser.userID),
                        getDelegationsByUser(selectedUser.userID),
                        getAgentsByUser(selectedUser.userID),
                    ]);
                    updateState({
                        allRegionalManagers: allRMs,
                        assignedRegionalManager: assignedRM[0] || null,
                        assignedGovernorates: assignedGovs,
                        assignedDelegations: assignedDels,
                        assignedAgents,
                    });
                    setTempRegionalManagers(assignedRM[0] ? [assignedRM[0]] : []);
                    setTempGovernorates(assignedGovs);
                    setTempDelegations(assignedDels);
                    setTempAgents(assignedAgents);
                }
            } catch (error) {
                setGlobalError("Failed to fetch initial data.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [expandedSection, selectedUser, role]);

    // Fetch governorates when regional manager changes (Supervisor role)
    useEffect(() => {
        if (role !== ROLES.SUPERVISOR || tempRegionalManagers.length === 0) {
            updateState({ availableGovernorates: [], availableDelegations: [], availableAgents: [] });
            return;
        }
        const fetchGovernorates = async () => {
            try {
                setLoading(true);
                const regions = await getRegionsByUser(tempRegionalManagers[0].userID);
                const governorates = await Promise.all(regions.map((r) => getGovernoratesByRegion(r.regionID)));
                updateState({ availableGovernorates: governorates.flat() });
            } catch (error) {
                setGlobalError("Failed to fetch governorates.");
            } finally {
                setLoading(false);
            }
        };
        fetchGovernorates();
    }, [tempRegionalManagers, role]);

    // Fetch delegations when governorates change (Supervisor role)
    useEffect(() => {
        if (role !== ROLES.SUPERVISOR || tempGovernorates.length === 0) {
            updateState({ availableDelegations: [], availableAgents: [] });
            return;
        }
        const fetchDelegations = async () => {
            try {
                setLoading(true);
                const delegations = await Promise.all(tempGovernorates.map((g) => getDelegationsByGovernorate(g.governorateID)));
                updateState({ availableDelegations: delegations.flat() });
            } catch (error) {
                setGlobalError("Failed to fetch delegations.");
            } finally {
                setLoading(false);
            }
        };
        fetchDelegations();
    }, [tempGovernorates, role]);

    // Fetch agents when delegations change (Supervisor role)
    useEffect(() => {
        if (role !== ROLES.SUPERVISOR || tempDelegations.length === 0) {
            updateState({ availableAgents: [] });
            return;
        }
        const fetchAgents = async () => {
            try {
                setLoading(true);
                const agents = await Promise.all(tempDelegations.map((d) => getAgentsByDelegation(d.delegationID)));
                updateState({ availableAgents: agents.flat() });
            } catch (error) {
                setGlobalError("Failed to fetch agents.");
            } finally {
                setLoading(false);
            }
        };
        fetchAgents();
    }, [tempDelegations, role]);

    const handlePhoneInput = useCallback(
        async (type: "director" | "regionalManager" | "supervisor" | "agent", phone: string) => {
            if (phone.length !== 8) return;
            try {
                setPhoneError(null);
                if (type === "agent") {
                    const agent = await getAgentByPhone(phone);
                    setTempAgents((prev) => (prev.some((a) => a.agentID === agent.agentID) ? prev : [...prev, agent]));
                } else {
                    const user = await getUserByPhone(phone);
                    const roleCheck = {
                        director: ROLES.DIRECTOR,
                        regionalManager: ROLES.REGIONAL_MANAGER,
                        supervisor: ROLES.SUPERVISOR,
                    }[type];
                    if (!user.Roles?.some((r) => r.name === roleCheck)) {
                        setPhoneError("User does not have the required role.");
                        return;
                    }
                    const setter = {
                        director: setTempDirectors,
                        regionalManager: setTempRegionalManagers,
                        supervisor: setTempSupervisors,
                    }[type];
                    setter((prev) => (type === "director" || type === "regionalManager" ? [user] : [...prev, user]));
                }
                updateState({ [`${type}PhoneInput`]: "" });
                setHasUnsavedChanges(true);
            } catch (error) {
                setPhoneError("User or agent not found.");
            }
        },
        [setTempDirectors, setTempRegionalManagers, setTempSupervisors, setTempAgents]
    );

    const handleToggle = useCallback(
        (setter: React.Dispatch<any>, item: any, key: string, multiple: boolean) => {
            setter((prev: any[]) => {
                const exists = prev.some((i: any) => i[key] === item[key]);
                if (exists && ["regionID", "governorateID", "delegationID", "userID"].includes(key)) {
                    let message = "";
                    if (key === "regionID") {
                        message = `Revoking region ${item.name} will remove all assigned governorates and delegations for ${selectedUser?.firstname} ${selectedUser?.lastname}. Apply cascade?`;
                    } else if (key === "governorateID") {
                        message = `Revoking governorate ${item.name} will remove all assigned delegations for ${selectedUser?.firstname} ${selectedUser?.lastname}. Apply cascade?`;
                    } else if (key === "delegationID") {
                        message = `Revoking delegation ${item.name} will remove all assigned agents for ${selectedUser?.firstname} ${selectedUser?.lastname}. Apply cascade?`;
                    } else if (key === "userID" && role === ROLES.DIRECTOR) {
                        message = `Revoking regional manager ${item.firstname} ${item.lastname} will remove all their assignments. Apply cascade?`;
                    } else if (key === "userID" && role === ROLES.REGIONAL_MANAGER && setter === setTempSupervisors) {
                        message = `Revoking supervisor ${item.firstname} ${item.lastname} will remove all their assignments. Apply cascade?`;
                    }
                    if (message) {
                        setShowConfirm({
                            message,
                            onConfirm: (cascade) => {
                                setter(prev.filter((i) => i[key] !== item[key]));
                                setHasUnsavedChanges(true);
                                setShowConfirm(null);
                            },
                        });
                        return prev;
                    }
                }
                const updated = multiple
                    ? exists
                        ? prev.filter((i) => i[key] !== item[key])
                        : [...prev, item]
                    : exists
                        ? []
                        : [item];
                setHasUnsavedChanges(true);
                return updated;
            });
        },
        [selectedUser, role]
    );

    const handleSaveAssignments = useCallback(async () => {
        if (!selectedUser) return;
        setLoading(true);
        try {
            if (role === ROLES.DIRECTOR) {
                const currentRMs = state.assignedRegionalManagers.map((rm) => rm.userID);
                const newRMs = tempRegionalManagers.map((rm) => rm.userID);
                const toAssign = newRMs.filter((id) => !currentRMs.includes(id));
                const toRevoke = currentRMs.filter((id) => !newRMs.includes(id));
                await Promise.all([
                    ...toAssign.map((id) => assignDirectorToRegionalManager(id, selectedUser.userID)),
                    ...toRevoke.map((id) =>
                        setShowConfirm({
                            message: `Revoking regional manager will remove all their assignments. Apply cascade?`,
                            onConfirm: async (cascade) => {
                                await revokeDirectorFromRegionalManager(id, cascade);
                                setShowConfirm(null);
                            },
                        })
                    ),
                ]);
            } else if (role === ROLES.REGIONAL_MANAGER) {
                const currentDirector = state.assignedDirector?.userID || "";
                const newDirector = tempDirectors[0]?.userID || "";
                if (newDirector && newDirector !== currentDirector) {
                    await assignDirectorToRegionalManager(selectedUser.userID, newDirector);
                } else if (currentDirector && !newDirector) {
                    setShowConfirm({
                        message: `Revoking director will affect regional manager assignments. Apply cascade?`,
                        onConfirm: async (cascade) => {
                            await revokeDirectorFromRegionalManager(selectedUser.userID, cascade);
                            setShowConfirm(null);
                        },
                    });
                }
                const currentRegions = state.assignedRegions.map((r) => r.regionID);
                const newRegions = tempRegions.map((r) => r.regionID);
                const regionsToAssign = newRegions.filter((id) => !currentRegions.includes(id));
                const regionsToRevoke = currentRegions.filter((id) => !newRegions.includes(id));
                if (regionsToAssign.length) {
                    await assignRegionsToRegionalManager(selectedUser.userID, regionsToAssign);
                }
                if (regionsToRevoke.length) {
                    setShowConfirm({
                        message: `Revoking regions will remove all assigned governorates and delegations. Apply cascade?`,
                        onConfirm: async (cascade) => {
                            await revokeRegionsFromRegionalManager(selectedUser.userID, regionsToRevoke, cascade);
                            setShowConfirm(null);
                        },
                    });
                }
                const currentSupervisors = state.assignedSupervisors.map((s) => s.userID);
                const newSupervisors = tempSupervisors.map((s) => s.userID);
                const supervisorsToAssign = newSupervisors.filter((id) => !currentSupervisors.includes(id));
                const supervisorsToRevoke = currentSupervisors.filter((id) => !newSupervisors.includes(id));
                await Promise.all([
                    ...supervisorsToAssign.map((id) => assignRegionalManagerToSupervisor(id, selectedUser.userID)),
                    ...supervisorsToRevoke.map((id) =>
                        setShowConfirm({
                            message: `Revoking supervisor will remove all their assignments. Apply cascade?`,
                            onConfirm: async (cascade) => {
                                await revokeRegionalManagerFromSupervisor(id, cascade);
                                setShowConfirm(null);
                            },
                        })
                    ),
                ]);
            } else if (role === ROLES.SUPERVISOR) {
                const currentRM = state.assignedRegionalManager?.userID || "";
                const newRM = tempRegionalManagers[0]?.userID || "";
                if (newRM && newRM !== currentRM) {
                    await assignRegionalManagerToSupervisor(selectedUser.userID, newRM);
                } else if (currentRM && !newRM) {
                    setShowConfirm({
                        message: `Revoking regional manager will affect supervisor assignments. Apply cascade?`,
                        onConfirm: async (cascade) => {
                            await revokeRegionalManagerFromSupervisor(selectedUser.userID, cascade);
                            setShowConfirm(null);
                        },
                    });
                }
                const currentGovs = state.assignedGovernorates.map((g) => g.governorateID);
                const newGovs = tempGovernorates.map((g) => g.governorateID);
                const govsToAssign = newGovs.filter((id) => !currentGovs.includes(id));
                const govsToRevoke = currentGovs.filter((id) => !newGovs.includes(id));
                if (govsToAssign.length) {
                    await assignGovernoratesToSupervisor(selectedUser.userID, govsToAssign);
                }
                if (govsToRevoke.length) {
                    setShowConfirm({
                        message: `Revoking governorates will remove all assigned delegations. Apply cascade?`,
                        onConfirm: async (cascade) => {
                            await revokeGovernoratesFromSupervisor(selectedUser.userID, govsToRevoke, cascade);
                            setShowConfirm(null);
                        },
                    });
                }
                const currentDels = state.assignedDelegations.map((d) => d.delegationID);
                const newDels = tempDelegations.map((d) => d.delegationID);
                const delsToAssign = newDels.filter((id) => !currentDels.includes(id));
                const delsToRevoke = currentDels.filter((id) => !newDels.includes(id));
                if (delsToAssign.length) {
                    await assignDelegationsToSupervisor(selectedUser.userID, delsToAssign);
                }
                if (delsToRevoke.length) {
                    setShowConfirm({
                        message: `Revoking delegations will remove all assigned agents. Apply cascade?`,
                        onConfirm: async (cascade) => {
                            await revokeDelegationsFromSupervisor(selectedUser.userID, delsToRevoke, cascade);
                            setShowConfirm(null);
                        },
                    });
                }
                const currentAgents = state.assignedAgents.map((a) => a.agentID);
                const newAgents = tempAgents.map((a) => a.agentID);
                const agentsToAssign = tempAgents.filter((a) => !currentAgents.includes(a.agentID));
                const agentsToRevoke = currentAgents.filter((id) => !newAgents.includes(id));
                await Promise.all([
                    ...agentsToAssign.map((a) => assignSupervisorToAgent(a.agentID, selectedUser.userID, a.delegationID!)),
                    ...agentsToRevoke.map((id) =>
                        setShowConfirm({
                            message: `Revoking agent will remove their assignment. Apply cascade?`,
                            onConfirm: async (cascade) => {
                                await revokeSupervisorFromAgent(id, cascade);
                                setShowConfirm(null);
                            },
                        })
                    ),
                ]);
            }
            const updatedUser = {
                ...selectedUser,
                directorID: tempDirectors[0]?.userID || "",
                regionalManagerID: tempRegionalManagers[0]?.userID || "",
                Regions: tempRegions,
                Governorates: tempGovernorates,
                Delegations: tempDelegations,
                supervisors: tempSupervisors,
            };
            setUsers((prev) => prev.map((u) => (u.userID === selectedUser.userID ? updatedUser : u)));
            setSelectedUser(updatedUser);
            setHasUnsavedChanges(false);
        } catch (error) {
            setGlobalError("Failed to save assignments.");
        } finally {
            setLoading(false);
        }
    }, [
        selectedUser,
        role,
        tempDirectors,
        tempRegionalManagers,
        tempRegions,
        tempGovernorates,
        tempDelegations,
        tempSupervisors,
        tempAgents,
        state,
    ]);

    return (
        <div className="dropdown-unit" aria-expanded={expandedSection === "assignments"}>
            <div className="dropdown-bar" onClick={() => toggleSection("assignments")} role="button" tabIndex={0}>
                <h3>Assignments</h3>
                <FaAngleDown className={`dropdown-icon ${expandedSection === "assignments" ? "expanded" : ""}`} />
            </div>
            {expandedSection === "assignments" && (
                <div className="dropdown-body">
                    <div className="group-header">
                        {hasUnsavedChanges && selectedUser && (
                            <button className="action-button" onClick={handleSaveAssignments} disabled={loading}>
                                {loading ? "Saving..." : "Save Assignments"}
                            </button>
                        )}
                        {phoneError && <div className="error-message" style={{ color: "red" }}>{phoneError}</div>}
                    </div>
                    {loading ? (
                        <div className="dropdown-body">
                            {[...Array(3)].map((_, i) => (
                                <div
                                    key={i}
                                    className="custom-skeleton"
                                    style={{ width: "100%", height: "100px", marginBottom: "10px" }}
                                />
                            ))}
                        </div>
                    ) : (
                        <>
                            {role === ROLES.DIRECTOR && (
                                <AssignmentList
                                    title="Regional Managers Assigned to This Director"
                                    items={state.allRegionalManagers}
                                    selectedItems={tempRegionalManagers}
                                    onToggle={(item) => handleToggle(setTempRegionalManagers, item, "userID", true)}
                                    renderLabel={(user) => `${user.firstname} ${user.lastname} (${user.phone})`}
                                    search={state.regionalManagerSearch}
                                    setSearch={(value) => updateState({ regionalManagerSearch: value })}
                                    phoneInput={state.regionalManagerPhoneInput}
                                    setPhoneInput={(value) => updateState({ regionalManagerPhoneInput: value })}
                                    handlePhoneInput={(phone) => handlePhoneInput("regionalManager", phone)}
                                    page={state.regionalManagerPage}
                                    setPage={(page) => updateState({ regionalManagerPage: page })}
                                    disabled={!userPermissions.canAssignRegionalManagers}
                                />
                            )}
                            {role === ROLES.REGIONAL_MANAGER && (
                                <>
                                    <AssignmentList
                                        title="Director Assigned to This Regional Manager"
                                        items={state.allDirectors}
                                        selectedItems={tempDirectors}
                                        onToggle={(item) => handleToggle(setTempDirectors, item, "userID", false)}
                                        renderLabel={(user) => `${user.firstname} ${user.lastname} (${user.phone})`}
                                        search={state.directorSearch}
                                        setSearch={(value) => updateState({ directorSearch: value })}
                                        phoneInput={state.directorPhoneInput}
                                        setPhoneInput={(value) => updateState({ directorPhoneInput: value })}
                                        handlePhoneInput={(phone) => handlePhoneInput("director", phone)}
                                        page={state.directorPage}
                                        setPage={(page) => updateState({ directorPage: page })}
                                        disabled={!userPermissions.canAssignDirectors}
                                        singleSelection={true}
                                    />
                                    <AssignmentList
                                        title="Regions Assigned to This Regional Manager"
                                        items={state.allRegions}
                                        selectedItems={tempRegions}
                                        onToggle={(item) => handleToggle(setTempRegions, item, "regionID", true)}
                                        renderLabel={(region) => region.name || ""}
                                        search={state.regionSearch}
                                        setSearch={(value) => updateState({ regionSearch: value })}
                                        page={state.regionPage}
                                        setPage={(page) => updateState({ regionPage: page })}
                                        disabled={!userPermissions.canAssignRegions}
                                    />
                                    <AssignmentList
                                        title="Supervisors Assigned to This Regional Manager"
                                        items={state.allSupervisors}
                                        selectedItems={tempSupervisors}
                                        onToggle={(item) => handleToggle(setTempSupervisors, item, "userID", true)}
                                        renderLabel={(user) => `${user.firstname} ${user.lastname} (${user.phone})`}
                                        search={state.supervisorSearch}
                                        setSearch={(value) => updateState({ supervisorSearch: value })}
                                        phoneInput={state.supervisorPhoneInput}
                                        setPhoneInput={(value) => updateState({ supervisorPhoneInput: value })}
                                        handlePhoneInput={(phone) => handlePhoneInput("supervisor", phone)}
                                        page={state.supervisorPage}
                                        setPage={(page) => updateState({ supervisorPage: page })}
                                        disabled={!userPermissions.canAssignSupervisors}
                                    />
                                </>
                            )}
                            {role === ROLES.SUPERVISOR && (
                                <>
                                    <AssignmentList
                                        title="Regional Manager Assigned to This Supervisor"
                                        items={state.allRegionalManagers}
                                        selectedItems={tempRegionalManagers}
                                        onToggle={(item) => handleToggle(setTempRegionalManagers, item, "userID", false)}
                                        renderLabel={(user) => `${user.firstname} ${user.lastname} (${user.phone})`}
                                        search={state.regionalManagerSearch}
                                        setSearch={(value) => updateState({ regionalManagerSearch: value })}
                                        phoneInput={state.regionalManagerPhoneInput}
                                        setPhoneInput={(value) => updateState({ regionalManagerPhoneInput: value })}
                                        handlePhoneInput={(phone) => handlePhoneInput("regionalManager", phone)}
                                        page={state.regionalManagerPage}
                                        setPage={(page) => updateState({ regionalManagerPage: page })}
                                        disabled={!userPermissions.canAssignRegionalManagers}
                                        singleSelection={true}
                                    />
                                    <AssignmentList
                                        title="Governorates Assigned to This Supervisor"
                                        items={state.availableGovernorates}
                                        selectedItems={tempGovernorates}
                                        onToggle={(item) => handleToggle(setTempGovernorates, item, "governorateID", true)}
                                        renderLabel={(gov) => gov.name || ""}
                                        search={state.governorateSearch}
                                        setSearch={(value) => updateState({ governorateSearch: value })}
                                        page={state.governoratePage}
                                        setPage={(page) => updateState({ governoratePage: page })}
                                        disabled={!userPermissions.canAssignGovernorates}
                                    />
                                    <AssignmentList
                                        title="Delegations Assigned to This Supervisor"
                                        items={state.availableDelegations}
                                        selectedItems={tempDelegations}
                                        onToggle={(item) => handleToggle(setTempDelegations, item, "delegationID", true)}
                                        renderLabel={(del) => del.name || ""}
                                        search={state.delegationSearch}
                                        setSearch={(value) => updateState({ delegationSearch: value })}
                                        page={state.delegationPage}
                                        setPage={(page) => updateState({ delegationPage: page })}
                                        disabled={!userPermissions.canAssignDelegations}
                                    />
                                    <AssignmentList
                                        title="Agents Assigned to This Supervisor"
                                        items={state.availableAgents}
                                        selectedItems={tempAgents}
                                        onToggle={(item) => handleToggle(setTempAgents, item, "agentID", true)}
                                        renderLabel={(agent) => `${agent.name} ${agent.lastname} (${agent.phone})`}
                                        search={state.agentSearch}
                                        setSearch={(value) => updateState({ agentSearch: value })}
                                        phoneInput={state.agentPhoneInput}
                                        setPhoneInput={(value) => updateState({ agentPhoneInput: value })}
                                        handlePhoneInput={(phone) => handlePhoneInput("agent", phone)}
                                        page={state.agentPage}
                                        setPage={(page) => updateState({ agentPage: page })}
                                        disabled={!userPermissions.canAssignAgents}
                                    />
                                </>
                            )}
                        </>
                    )}
                    {showConfirm && (
                        <div
                            className="confirmation-modal"
                            style={{
                                position: "fixed",
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                background: "white",
                                padding: "20px",
                                border: "1px solid #ccc",
                            }}
                        >
                            <p>{showConfirm.message}</p>
                            <button onClick={() => showConfirm.onConfirm(true)}>Yes (Cascade)</button>
                            <button onClick={() => showConfirm.onConfirm(false)}>No</button>
                            <button onClick={() => setShowConfirm(null)}>Cancel</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default React.memo(AssignmentsManagement);