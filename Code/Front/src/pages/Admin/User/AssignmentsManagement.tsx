/* eslint-disable @typescript-eslint/no-explicit-any */
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
    getRegionalManagersByDirector,
    getDirectorByRegionalManager,
    getRegionalManagerBySupervisor,
    getSupervisorsByRegionalManager,
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
        canAssignRegionalManagers: boolean;
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
    isLoading: boolean;
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
    isLoading,
}) => {
        const filteredItems = useMemo(() => {
            const searchLower = search.toLowerCase();
            return items.filter(
                (item) =>
                    renderLabel(item).toLowerCase().includes(searchLower) ||
                    (item.phone && item.phone.includes(search))
            );
        }, [items, search, renderLabel]);

        const paginatedItems = useMemo(() => {
            const start = (page - 1) * ITEMS_PER_PAGE;
            return filteredItems.slice(start, start + ITEMS_PER_PAGE);
        }, [filteredItems, page]);

        // Determine the unique key for an item
        const getItemKey = (item: AssignmentListItem) =>
            item.id || item.regionID || item.governorateID || item.delegationID || item.agentID || "";

        return (
            <div className="assignment-list">
                <h4>{title}</h4>
                <div className="search-container assignment-search">
                    {phoneInput !== undefined && setPhoneInput && handlePhoneInput && (
                        <>
                            <input
                                type="tel"
                                placeholder="Enter phone (8 digits)"
                                value={phoneInput}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, "").slice(0, 8);
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
                    {isLoading ? (
                        [...Array(5)].map((_, i) => (
                            <div
                                key={i}
                                className="custom-skeleton"
                                style={{ width: "100%", height: "40px", marginBottom: "10px" }}
                            />
                        ))
                    ) : paginatedItems.length > 0 ? (
                        paginatedItems.map((item) => (
                            <div
                                key={getItemKey(item)}
                                className="list-item"
                            >
                                <label>
                                    <input
                                        type={singleSelection ? "radio" : "checkbox"}
                                        name={singleSelection ? title : undefined}
                                        checked={selectedItems.some((s) => getItemKey(s) === getItemKey(item))}
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
                            disabled={page === 1 || isLoading}
                        >
                            Previous
                        </button>
                        <span>
                            Page {page} of {Math.ceil(filteredItems.length / ITEMS_PER_PAGE)}
                        </span>
                        <button
                            onClick={() => setPage(page + 1)}
                            disabled={page >= Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || isLoading}
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
    const [loading, setLoading] = useState({
        directors: false,
        regionalManagers: false,
        supervisors: false,
        regions: false,
        governorates: false,
        delegations: false,
        agents: false,
    });
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showConfirm, setShowConfirm] = useState<{
        message: string;
        onConfirm: (cascade: boolean) => Promise<void>;
    } | null>(null);
    const [state, setState] = useState({
        allDirectors: [] as User[],
        allRegionalManagers: [] as User[],
        allSupervisors: [] as User[],
        allRegions: [] as Region[],
        availableGovernorates: [] as Governorate[],
        availableDelegations: [] as Delegation[],
        availableAgents: [] as Agent[],
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

    // Cache for API responses

    // Cache for API responses
    const cache = useMemo(() => new Map<string, any>(), []);

    const role = selectedUser?.Roles?.[0]?.name || tempRoles[0]?.name;

    const updateState = useCallback((updates: Partial<typeof state>) => {
        setState((prev) => ({ ...prev, ...updates }));
    }, []);

    const updateLoading = useCallback((updates: Partial<typeof loading>) => {
        setLoading((prev) => ({ ...prev, ...updates }));
    }, []);

    // Generic fetch with caching
    const fetchWithCache = useCallback(async function <T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = await fetchFn();
        cache.set(key, result);
        return result;
    }, [cache]);
    // Fetch data based on role when section is expanded
    useEffect(() => {
        if (expandedSection !== "assignments" || !selectedUser) return;

        const fetchDirectorData = async () => {
            updateLoading({ regionalManagers: true });
            try {
                const [allRMs, assignedRMs] = await Promise.all([
                    fetchWithCache(`regionalManagers_${ROLES.REGIONAL_MANAGER}`, () =>
                        getUsersByRole(ROLES.REGIONAL_MANAGER)
                    ),
                    fetchWithCache(`regionalManagersByDirector_${selectedUser.userID}`, () =>
                        getRegionalManagersByDirector(selectedUser.userID)
                    ),
                ]);
                updateState({ allRegionalManagers: allRMs });
                setTempRegionalManagers(assignedRMs);
            } catch {
                setGlobalError("Failed to fetch regional managers.");
            } finally {
                updateLoading({ regionalManagers: false });
            }
        };

        const fetchRegionalManagerData = async () => {
            updateLoading({ directors: true, regions: true, supervisors: true });
            try {
                const [allDirectors, assignedDirectors, allRegions, assignedRegions, allSupervisors, assignedSupervisors] = await Promise.all([
                    fetchWithCache(`directors_${ROLES.DIRECTOR}`, () => getUsersByRole(ROLES.DIRECTOR)),
                    fetchWithCache(`directorByRegionalManager_${selectedUser.userID}`, () =>
                        getDirectorByRegionalManager(selectedUser.userID)
                    ),
                    fetchWithCache("allRegions", () => getAllRegions()),
                    fetchWithCache(`regionsByUser_${selectedUser.userID}`, () =>
                        getRegionsByUser(selectedUser.userID)
                    ),
                    fetchWithCache(`supervisors_${ROLES.SUPERVISOR}`, () => getUsersByRole(ROLES.SUPERVISOR)),
                    fetchWithCache(`supervisorsByRegionalManager_${selectedUser.userID}`, () =>
                        getSupervisorsByRegionalManager(selectedUser.userID)
                    ),
                ]);
                updateState({
                    allDirectors,
                    allRegions,
                    allSupervisors,
                });
                setTempDirectors(assignedDirectors);
                setTempRegions(assignedRegions);
                setTempSupervisors(assignedSupervisors);
            } catch {
                setGlobalError("Failed to fetch regional manager data.");
            } finally {
                updateLoading({ directors: false, regions: false, supervisors: false });
            }
        };

        const fetchSupervisorData = async () => {
            updateLoading({ regionalManagers: true });
            try {
                const [allRMs, assignedRMs] = await Promise.all([
                    fetchWithCache(`regionalManagers_${ROLES.REGIONAL_MANAGER}`, () =>
                        getUsersByRole(ROLES.REGIONAL_MANAGER)
                    ),
                    fetchWithCache(`regionalManagerBySupervisor_${selectedUser.userID}`, () =>
                        getRegionalManagerBySupervisor(selectedUser.userID)
                    ),
                ]);
                updateState({ allRegionalManagers: allRMs });
                setTempRegionalManagers(assignedRMs);
            } catch {
                setGlobalError("Failed to fetch regional managers for supervisor.");
            } finally {
                updateLoading({ regionalManagers: false });
            }
        };

        if (role === ROLES.DIRECTOR) {
            fetchDirectorData();
        } else if (role === ROLES.REGIONAL_MANAGER) {
            fetchRegionalManagerData();
        } else if (role === ROLES.SUPERVISOR) {
            fetchSupervisorData();
        }
    }, [expandedSection, selectedUser, role, fetchWithCache, setGlobalError, setTempDirectors, setTempRegionalManagers, setTempRegions, setTempSupervisors, updateLoading, updateState]);

    // Fetch governorates when regional managers change (Supervisor role)
    useEffect(() => {
        if (role !== ROLES.SUPERVISOR || tempRegionalManagers.length === 0) {
            updateState({ availableGovernorates: [], availableDelegations: [], availableAgents: [] });
            setTempGovernorates([]);
            setTempDelegations([]);
            setTempAgents([]);
            return;
        }

        const fetchGovernorates = async () => {
            updateLoading({ governorates: true });
            try {
                const regions = await fetchWithCache(`regionsByUser_${tempRegionalManagers[0].userID}`, () =>
                    getRegionsByUser(tempRegionalManagers[0].userID)
                );
                const governorates = await Promise.all(
                    regions.map((r) =>
                        fetchWithCache(`governoratesByRegion_${r.regionID}`, () => getGovernoratesByRegion(r.regionID))
                    )
                );
                const assignedGovs = await fetchWithCache(`governoratesByUser_${selectedUser!.userID}`, () =>
                    getGovernoratesByUser(selectedUser!.userID)
                );
                updateState({ availableGovernorates: governorates.flat() });
                setTempGovernorates(assignedGovs);
            } catch {
                setGlobalError("Failed to fetch governorates.");
            } finally {
                updateLoading({ governorates: false });
            }
        };

        fetchGovernorates();
    }, [tempRegionalManagers, role, selectedUser, fetchWithCache, setGlobalError, setTempGovernorates, setTempDelegations, setTempAgents, updateLoading, updateState]);

    // Fetch delegations when governorates change (Supervisor role)
    useEffect(() => {
        if (role !== ROLES.SUPERVISOR || tempGovernorates.length === 0) {
            updateState({ availableDelegations: [], availableAgents: [] });
            setTempDelegations([]);
            setTempAgents([]);
            return;
        }

        const fetchDelegations = async () => {
            updateLoading({ delegations: true });
            try {
                const delegations = await Promise.all(
                    tempGovernorates.map((g) =>
                        fetchWithCache(`delegationsByGovernorate_${g.governorateID}`, () =>
                            getDelegationsByGovernorate(g.governorateID)
                        )
                    )
                );
                const assignedDels = await fetchWithCache(`delegationsByUser_${selectedUser!.userID}`, () =>
                    getDelegationsByUser(selectedUser!.userID)
                );
                updateState({ availableDelegations: delegations.flat() });
                setTempDelegations(assignedDels);
            } catch {
                setGlobalError("Failed to fetch delegations.");
            } finally {
                updateLoading({ delegations: false });
            }
        };

        fetchDelegations();
    }, [tempGovernorates, role, selectedUser, fetchWithCache, setGlobalError, setTempDelegations, setTempAgents, updateLoading, updateState]);

    // Fetch agents when delegations change (Supervisor role)
    useEffect(() => {
        if (role !== ROLES.SUPERVISOR || tempDelegations.length === 0) {
            updateState({ availableAgents: [] });
            setTempAgents([]);
            return;
        }

        const fetchAgents = async () => {
            updateLoading({ agents: true });
            try {
                const agents = await Promise.all(
                    tempDelegations.map((d) =>
                        fetchWithCache(`agentsByDelegation_${d.delegationID}`, () =>
                            getAgentsByDelegation(d.delegationID)
                        )
                    )
                );
                const assignedAgents = await fetchWithCache(`agentsByUser_${selectedUser!.userID}`, () =>
                    getAgentsByUser(selectedUser!.userID)
                );
                updateState({ availableAgents: agents.flat().map((a) => a.agents).flat() });
                setTempAgents(assignedAgents.agents);
            } catch {
                setGlobalError("Failed to fetch agents.");
            } finally {
                updateLoading({ agents: false });
            }
        };

        fetchAgents();
    }, [tempDelegations, role, selectedUser, fetchWithCache, setGlobalError, setTempAgents, updateLoading, updateState]);

    const handlePhoneInput = useCallback(
        async (type: "director" | "regionalManager" | "supervisor" | "agent", phone: string) => {
            if (phone.length !== 8) return;
            try {
                setPhoneError(null);
                if (type === "agent") {
                    const agent = await fetchWithCache(`agentByPhone_${phone}`, () => getAgentByPhone(phone));
                    if (agent) { // Check if agent is not null
                        setTempAgents((prev) =>
                            prev.some((a) => a.agentID === agent.agentID) ? prev : [...prev, agent]
                        );
                    } else {
                        setPhoneError("Agent not found.");
                    }
                } else {
                    const user = await fetchWithCache(`userByPhone_${phone}`, () => getUserByPhone(phone));
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
                    setter((prev) =>
                        type === "director" || type === "regionalManager"
                            ? [user]
                            : prev.some((u) => u.userID === user.userID)
                                ? prev
                                : [...prev, user]
                    );
                }
                updateState({ [`${type}PhoneInput`]: "" });
                setHasUnsavedChanges(true);
            } catch {
                setPhoneError("User or agent not found.");
            }
        },
        [fetchWithCache, setTempDirectors, setTempRegionalManagers, setTempSupervisors, setTempAgents, updateState]
    );

    const handleToggle = useCallback(
        (setter: React.Dispatch<any>, item: any, key: string, multiple: boolean, revokeMessage: string) => {
            setter((prev: any[]) => {
                const itemKey = item[key];
                const exists = prev.some((i: any) => i[key] === itemKey);
                if (exists) {
                    setShowConfirm({
                        message: revokeMessage,
                        onConfirm: async () => {
                            setShowConfirm(null);
                            setter(prev.filter((i) => i[key] !== itemKey));
                            setHasUnsavedChanges(true);
                        },
                    });
                    return prev;
                }
                const updated = multiple ? [...prev, item] : [item];
                setHasUnsavedChanges(true);
                return updated;
            });
        },
        []
    );

    const handleSaveAssignments = useCallback(async () => {
        if (!selectedUser) return;
        setLoading({
            directors: true,
            regionalManagers: true,
            supervisors: true,
            regions: true,
            governorates: true,
            delegations: true,
            agents: true,
        });

        try {
            if (role === ROLES.DIRECTOR) {
                const currentRMs = (await getRegionalManagersByDirector(selectedUser.userID)).map((rm) => rm.userID);
                const newRMs = tempRegionalManagers.map((rm) => rm.userID);
                const toAssign = newRMs.filter((id) => !currentRMs.includes(id));
                const toRevoke = currentRMs.filter((id) => !newRMs.includes(id));

                await Promise.all([
                    ...toAssign.map((id) => assignDirectorToRegionalManager(id, selectedUser.userID)),
                    ...toRevoke.map((id) =>
                        new Promise<void>((resolve) => {
                            setShowConfirm({
                                message: `Revoking regional manager ${id} will remove all their assignments. Apply cascade?`,
                                onConfirm: async () => {
                                    await revokeDirectorFromRegionalManager(id);
                                    setShowConfirm(null);
                                    resolve();
                                },
                            });
                        })
                    ),
                ]);
            } else if (role === ROLES.REGIONAL_MANAGER) {
                const currentDirectors = await getDirectorByRegionalManager(selectedUser.userID);
                const currentDirectorID = currentDirectors[0]?.userID || "";
                const newDirectorID = tempDirectors[0]?.userID || "";

                if (newDirectorID && newDirectorID !== currentDirectorID) {
                    await assignDirectorToRegionalManager(selectedUser.userID, newDirectorID);
                } else if (currentDirectorID && !newDirectorID) {
                    await new Promise<void>((resolve) => {
                        setShowConfirm({
                            message: `Revoking director will affect regional manager assignments. Apply cascade?`,
                            onConfirm: async () => {
                                await revokeDirectorFromRegionalManager(selectedUser.userID);
                                setShowConfirm(null);
                                resolve();
                            },
                        });
                    });
                }

                const currentRegions = (await getRegionsByUser(selectedUser.userID)).map((r) => r.regionID);
                const newRegions = tempRegions.map((r) => r.regionID);
                const regionsToAssign = newRegions.filter((id) => !currentRegions.includes(id));
                const regionsToRevoke = currentRegions.filter((id) => !newRegions.includes(id));

                if (regionsToAssign.length) {
                    await assignRegionsToRegionalManager(selectedUser.userID, regionsToAssign);
                }
                if (regionsToRevoke.length) {
                    await new Promise<void>((resolve) => {
                        setShowConfirm({
                            message: `Revoking regions will remove all assigned governorates and delegations. Apply cascade?`,
                            onConfirm: async (cascade) => {
                                await revokeRegionsFromRegionalManager(selectedUser.userID, regionsToRevoke, { cascadeConfirmed: cascade });
                                setShowConfirm(null);
                                resolve();
                            },
                        });
                    });
                }

                const currentSupervisors = (await getSupervisorsByRegionalManager(selectedUser.userID)).map((s) => s.userID);
                const newSupervisors = tempSupervisors.map((s) => s.userID);
                const supervisorsToAssign = newSupervisors.filter((id) => !currentSupervisors.includes(id));
                const supervisorsToRevoke = currentSupervisors.filter((id) => !newSupervisors.includes(id));

                await Promise.all([
                    ...supervisorsToAssign.map((id) => assignRegionalManagerToSupervisor(id, selectedUser.userID)),
                    ...supervisorsToRevoke.map((id) =>
                        new Promise<void>((resolve) => {
                            setShowConfirm({
                                message: `Revoking supervisor ${id} will remove all their assignments. Apply cascade?`,
                                onConfirm: async (cascade) => {
                                    await revokeRegionalManagerFromSupervisor(id, {
                                        revokeGovernorates: cascade,
                                        revokeDelegations: cascade,
                                        revokeAgents: cascade,
                                    });
                                    setShowConfirm(null);
                                    resolve();
                                },
                            });
                        })
                    ),
                ]);
            } else if (role === ROLES.SUPERVISOR) {
                const currentRMs = (await getRegionalManagerBySupervisor(selectedUser.userID)).map((rm) => rm.userID);
                const newRM = tempRegionalManagers[0]?.userID || "";

                if (newRM && !currentRMs.includes(newRM)) {
                    await assignRegionalManagerToSupervisor(selectedUser.userID, newRM);
                } else if (currentRMs.length > 0 && !newRM) {
                    await new Promise<void>((resolve) => {
                        setShowConfirm({
                            message: `Revoking regional manager will affect supervisor assignments. Apply cascade?`,
                            onConfirm: async (cascade) => {
                                await revokeRegionalManagerFromSupervisor(selectedUser.userID, {
                                    revokeGovernorates: cascade,
                                    revokeDelegations: cascade,
                                    revokeAgents: cascade,
                                });
                                setShowConfirm(null);
                                resolve();
                            },
                        });
                    });
                }

                const currentGovs = (await getGovernoratesByUser(selectedUser.userID)).map((g) => g.governorateID);
                const newGovs = tempGovernorates.map((g) => g.governorateID);
                const govsToAssign = newGovs.filter((id) => !currentGovs.includes(id));
                const govsToRevoke = currentGovs.filter((id) => !newGovs.includes(id));

                if (govsToAssign.length) {
                    await assignGovernoratesToSupervisor(selectedUser.userID, govsToAssign);
                }
                if (govsToRevoke.length) {
                    await new Promise<void>((resolve) => {
                        setShowConfirm({
                            message: `Revoking governorates will remove all assigned delegations and agents. Apply cascade?`,
                            onConfirm: async (cascade) => {
                                await revokeGovernoratesFromSupervisor(selectedUser.userID, govsToRevoke, {
                                    revokeDelegations: cascade,
                                    revokeAgents: cascade,
                                });
                                setShowConfirm(null);
                                resolve();
                            },
                        });
                    });
                }

                const currentDels = (await getDelegationsByUser(selectedUser.userID)).map((d) => d.delegationID);
                const newDels = tempDelegations.map((d) => d.delegationID);
                const delsToAssign = newDels.filter((id) => !currentDels.includes(id));
                const delsToRevoke = currentDels.filter((id) => !newDels.includes(id));

                if (delsToAssign.length) {
                    await assignDelegationsToSupervisor(selectedUser.userID, delsToAssign);
                }
                if (delsToRevoke.length) {
                    await new Promise<void>((resolve) => {
                        setShowConfirm({
                            message: `Revoking delegations will remove all assigned agents. Apply cascade?`,
                            onConfirm: async (cascade) => {
                                await revokeDelegationsFromSupervisor(selectedUser.userID, delsToRevoke, cascade);
                                setShowConfirm(null);
                                resolve();
                            },
                        });
                    });
                }

                const currentAgents = (await getAgentsByUser(selectedUser.userID)).agents.map((a) => a.agentID);
                const newAgents = tempAgents.map((a) => a.agentID);
                const agentsToAssign = tempAgents.filter((a) => !currentAgents.includes(a.agentID));
                const agentsToRevoke = currentAgents.filter((id) => !newAgents.includes(id));

                await Promise.all([
                    ...agentsToAssign.map((a) => assignSupervisorToAgent(a.agentID, selectedUser.userID, a.delegationID!)),
                    ...agentsToRevoke.map((id) =>
                        new Promise<void>((resolve) => {
                            setShowConfirm({
                                message: `Revoking agent ${id} will remove their assignment. Apply cascade?`,
                                onConfirm: async () => {
                                    await revokeSupervisorFromAgent(id);
                                    setShowConfirm(null);
                                    resolve();
                                },
                            });
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
            cache.clear(); // Clear cache after saving to ensure fresh data
        } catch {
            setGlobalError("Failed to save assignments.");
        } finally {
            setLoading({
                directors: false,
                regionalManagers: false,
                supervisors: false,
                regions: false,
                governorates: false,
                delegations: false,
                agents: false,
            });
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
        setGlobalError,
        setUsers,
        setSelectedUser,
        cache,
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
                            <button className="action-button" onClick={handleSaveAssignments} disabled={Object.values(loading).some((l) => l)}>
                                {Object.values(loading).some((l) => l) ? "Saving..." : "Save Assignments"}
                            </button>
                        )}
                        {phoneError && <div className="error-message" style={{ color: "red" }}>{phoneError}</div>}
                    </div>
                    <>
                        {role === ROLES.DIRECTOR && (
                            <AssignmentList
                                title="Regional Managers Assigned to This Director"
                                items={state.allRegionalManagers}
                                selectedItems={tempRegionalManagers}
                                onToggle={(item) =>
                                    handleToggle(
                                        setTempRegionalManagers,
                                        item,
                                        "userID",
                                        true,
                                        `Revoking regional manager ${item.firstname} ${item.lastname} will remove all their assignments. Apply cascade?`
                                    )
                                }
                                renderLabel={(user) => `${user.firstname} ${user.lastname} (${user.phone})`}
                                search={state.regionalManagerSearch}
                                setSearch={(value) => updateState({ regionalManagerSearch: value })}
                                phoneInput={state.regionalManagerPhoneInput}
                                setPhoneInput={(value) => updateState({ regionalManagerPhoneInput: value })}
                                handlePhoneInput={(phone) => handlePhoneInput("regionalManager", phone)}
                                page={state.regionalManagerPage}
                                setPage={(page) => updateState({ regionalManagerPage: page })}
                                disabled={!userPermissions.canAssignRegionalManagers}
                                isLoading={loading.regionalManagers}
                            />
                        )}
                        {role === ROLES.REGIONAL_MANAGER && (
                            <>
                                <AssignmentList
                                    title="Director Assigned to This Regional Manager"
                                    items={state.allDirectors}
                                    selectedItems={tempDirectors}
                                    onToggle={(item) =>
                                        handleToggle(
                                            setTempDirectors,
                                            item,
                                            "userID",
                                            false,
                                            `Revoking director ${item.firstname} ${item.lastname} will affect regional manager assignments. Apply cascade?`
                                        )
                                    }
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
                                    isLoading={loading.directors}
                                />
                                <AssignmentList
                                    title="Regions Assigned to This Regional Manager"
                                    items={state.allRegions}
                                    selectedItems={tempRegions}
                                    onToggle={(item) =>
                                        handleToggle(
                                            setTempRegions,
                                            item,
                                            "regionID",
                                            true,
                                            `Revoking region ${item.name} will remove all assigned governorates and delegations. Apply cascade?`
                                        )
                                    }
                                    renderLabel={(region) => region.name || ""}
                                    search={state.regionSearch}
                                    setSearch={(value) => updateState({ regionSearch: value })}
                                    page={state.regionPage}
                                    setPage={(page) => updateState({ regionPage: page })}
                                    disabled={!userPermissions.canAssignRegions}
                                    isLoading={loading.regions}
                                />
                                <AssignmentList
                                    title="Supervisors Assigned to This Regional Manager"
                                    items={state.allSupervisors}
                                    selectedItems={tempSupervisors}
                                    onToggle={(item) =>
                                        handleToggle(
                                            setTempSupervisors,
                                            item,
                                            "userID",
                                            true,
                                            `Revoking supervisor ${item.firstname} ${item.lastname} will remove all their assignments. Apply cascade?`
                                        )
                                    }
                                    renderLabel={(user) => `${user.firstname} ${user.lastname} (${user.phone})`}
                                    search={state.supervisorSearch}
                                    setSearch={(value) => updateState({ supervisorSearch: value })}
                                    phoneInput={state.supervisorPhoneInput}
                                    setPhoneInput={(value) => updateState({ supervisorPhoneInput: value })}
                                    handlePhoneInput={(phone) => handlePhoneInput("supervisor", phone)}
                                    page={state.supervisorPage}
                                    setPage={(page) => updateState({ supervisorPage: page })}
                                    disabled={!userPermissions.canAssignSupervisors}
                                    isLoading={loading.supervisors}
                                />
                            </>
                        )}
                        {role === ROLES.SUPERVISOR && (
                            <>
                                <AssignmentList
                                    title="Regional Manager Assigned to This Supervisor"
                                    items={state.allRegionalManagers}
                                    selectedItems={tempRegionalManagers}
                                    onToggle={(item) =>
                                        handleToggle(
                                            setTempRegionalManagers,
                                            item,
                                            "userID",
                                            false,
                                            `Revoking regional manager ${item.firstname} ${item.lastname} will affect supervisor assignments. Apply cascade?`
                                        )
                                    }
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
                                    isLoading={loading.regionalManagers}
                                />
                                <AssignmentList
                                    title="Governorates Assigned to This Supervisor"
                                    items={state.availableGovernorates}
                                    selectedItems={tempGovernorates}
                                    onToggle={(item) =>
                                        handleToggle(
                                            setTempGovernorates,
                                            item,
                                            "governorateID",
                                            true,
                                            `Revoking governorate ${item.name} will remove all assigned delegations and agents. Apply cascade?`
                                        )
                                    }
                                    renderLabel={(gov) => gov.name || ""}
                                    search={state.governorateSearch}
                                    setSearch={(value) => updateState({ governorateSearch: value })}
                                    page={state.governoratePage}
                                    setPage={(page) => updateState({ governoratePage: page })}
                                    disabled={!userPermissions.canAssignGovernorates}
                                    isLoading={loading.governorates}
                                />
                                <AssignmentList
                                    title="Delegations Assigned to This Supervisor"
                                    items={state.availableDelegations}
                                    selectedItems={tempDelegations}
                                    onToggle={(item) =>
                                        handleToggle(
                                            setTempDelegations,
                                            item,
                                            "delegationID",
                                            true,
                                            `Revoking delegation ${item.name} will remove all assigned agents. Apply cascade?`
                                        )
                                    }
                                    renderLabel={(del) => del.name || ""}
                                    search={state.delegationSearch}
                                    setSearch={(value) => updateState({ delegationSearch: value })}
                                    page={state.delegationPage}
                                    setPage={(page) => updateState({ delegationPage: page })}
                                    disabled={!userPermissions.canAssignDelegations}
                                    isLoading={loading.delegations}
                                />
                                <AssignmentList
                                    title="Agents Assigned to This Supervisor"
                                    items={state.availableAgents}
                                    selectedItems={tempAgents}
                                    onToggle={(item) =>
                                        handleToggle(
                                            setTempAgents,
                                            item,
                                            "agentID",
                                            true,
                                            `Revoking agent ${item.name} ${item.lastname} will remove their assignment. Apply cascade?`
                                        )
                                    }
                                    renderLabel={(agent) => `${agent.name} ${agent.lastname} (${agent.phone})`}
                                    search={state.agentSearch}
                                    setSearch={(value) => updateState({ agentSearch: value })}
                                    phoneInput={state.agentPhoneInput}
                                    setPhoneInput={(value) => updateState({ agentPhoneInput: value })}
                                    handlePhoneInput={(phone) => handlePhoneInput("agent", phone)}
                                    page={state.agentPage}
                                    setPage={(page) => updateState({ agentPage: page })}
                                    disabled={!userPermissions.canAssignAgents}
                                    isLoading={loading.agents}
                                />
                            </>
                        )}
                    </>
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
                                zIndex: 1000,
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