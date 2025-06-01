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
    onUserUpdate: (user: User) => void;
    tempRoles?: Role[];
    setSelectedUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const ITEMS_PER_PAGE = 7;
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
    userID?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    name?: string;
    email?: string;
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
}> = React.memo(
    ({
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
            const filtered = items.filter(
                (item) =>
                    renderLabel(item).toLowerCase().includes(searchLower) ||
                    (item.phone && item.phone.includes(search))
            );

            // Sort items alphabetically and prioritize selected items
            const selected = filtered
                .filter((item) =>
                    selectedItems.some((s) => {
                        if (item.agentID) {
                            return (
                                item.agentID === s.agentID &&
                                item.delegationID === s.delegationID
                            );
                        }
                        if (item.governorateID) {
                            return item.governorateID === s.governorateID;
                        }
                        if (item.delegationID) {
                            return item.delegationID === s.delegationID;
                        }
                        return (item.userID || item.regionID) === (s.userID || s.regionID);
                    })
                )
                .sort((a, b) => renderLabel(a).localeCompare(renderLabel(b)));
            const unselected = filtered
                .filter(
                    (item) =>
                        !selectedItems.some((s) => {
                            if (item.agentID) {
                                return (
                                    item.agentID === s.agentID &&
                                    item.delegationID === s.delegationID
                                );
                            }
                            if (item.governorateID) {
                                return item.governorateID === s.governorateID;
                            }
                            if (item.delegationID) {
                                return item.delegationID === s.delegationID;
                            }
                            return (item.userID || item.regionID) === (s.userID || s.regionID);
                        })
                )
                .sort((a, b) => renderLabel(a).localeCompare(renderLabel(b)));

            return [...selected, ...unselected];
        }, [items, search, selectedItems, renderLabel]);

        const paginatedItems = useMemo(() => {
            const start = (page - 1) * ITEMS_PER_PAGE;
            return filteredItems.slice(start, start + ITEMS_PER_PAGE);
        }, [filteredItems, page]);

        const getItemKey = (item: AssignmentListItem, index: number) => {
            if (item.governorateID) {
                return `gov_${item.governorateID}_${item.regionID || 'no-region'}_${index}`;
            } else if (item.delegationID) {
                const cleanDelegationID = item.delegationID.replace(/^del_/, "");
                return `del_${cleanDelegationID}_${item.governorateID || 'no-gov'}_${index}`;
            } else if (item.agentID) {
                const delegationID = item.delegationID || "no-delegation";
                return `agent_${item.agentID}_${delegationID}_${index}`;
            }
            const key = item.id || item.userID || item.regionID || item.governorateID || item.delegationID;
            if (!key) {
                console.warn("Item missing valid ID:", item);
                return `fallback_${index}`;
            }
            return `${key}_${index}`;
        };

        if (title === "Agents Assigned to This Supervisor") {
            console.debug("Rendering Agents List - tempAgents:", selectedItems);
        }

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
                        paginatedItems.map((item, index) => {
                            const itemKey = getItemKey(item, index);
                            const isChecked = selectedItems.some((s) => {
                                if (item.regionID) {
                                    return s.regionID === item.regionID;
                                }
                                if (item.agentID) {
                                    return (
                                        s.agentID === item.agentID &&
                                        s.delegationID === item.delegationID
                                    );
                                }
                                if (item.governorateID) {
                                    return s.governorateID === item.governorateID;
                                }
                                if (item.delegationID) {
                                    return s.delegationID === item.delegationID;
                                }
                                return s.userID === item.userID;
                            });
                            console.debug(
                                `Rendering item: ${item.agentID || item.userID || item.regionID}, isChecked: ${isChecked}`
                            );
                            return (
                                <div key={itemKey} className="list-item">
                                    <label>
                                        <input
                                            type={singleSelection ? "radio" : "checkbox"}
                                            name={singleSelection ? title : undefined}
                                            checked={isChecked}
                                            onChange={() => {
                                                console.debug(`Toggling item:`, item);
                                                onToggle(item);
                                            }}
                                            disabled={disabled}
                                        />
                                        {renderLabel(item)}
                                    </label>
                                </div>
                            );
                        })
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
    }
);

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
    onUserUpdate,
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
        onCancel?: () => void;
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

    const role = selectedUser?.Roles?.[0]?.name || tempRoles[0]?.name;

    const updateState = useCallback((updates: Partial<typeof state>) => {
        setState((prev) => ({ ...prev, ...updates }));
    }, []);

    const updateLoading = useCallback((updates: Partial<typeof loading>) => {
        setLoading((prev) => ({ ...prev, ...updates }));
    }, []);

    const cache = useMemo(() => new Map<string, any>(), []);

    const fetchWithCache = useCallback(
        async function <T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
            if (cache.has(key)) {
                return cache.get(key);
            }
            const result = await fetchFn();
            cache.set(key, result);
            return result;
        },
        [cache]
    );

    const handleToggle = useCallback(
        (
            setter: React.Dispatch<React.SetStateAction<any[]>>,
            item: any,
            key: string,
            multiple: boolean
        ) => {
            console.debug(`Toggling item with key ${key}:`, item);
            setter((prev: any[]) => {
                const itemKey = key === "agentID" ? `${item[key]}_${item.delegationID}` : item[key];
                if (!itemKey) {
                    console.warn(`Item missing ${key}:`, item);
                    return prev;
                }
                const exists = prev.some((i: any) => {
                    const iKey = key === "agentID" ? `${i[key]}_${i.delegationID}` : i[key];
                    return iKey === itemKey;
                });

                if (exists) {
                    // Remove the item (revoke)
                    const newSelected = prev.filter((i) => {
                        const iKey = key === "agentID" ? `${i[key]}_${i.delegationID}` : i[key];
                        return iKey !== itemKey;
                    });
                    console.debug(`Revoking item: ${itemKey}`, newSelected);
                    setHasUnsavedChanges(true);
                    return newSelected;
                }

                // Add the item (assign)
                const updated = multiple ? [...prev, item] : [item];
                console.debug(`Adding item: ${itemKey}`, updated);
                setHasUnsavedChanges(true);
                return updated;
            });
        },
        []
    );

    useEffect(() => {
        if (expandedSection !== "assignments" || !role) return;

        const fetchInitialData = async () => {
            if (selectedUser) {
                if (role === ROLES.DIRECTOR) {
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
                        const validRMs = allRMs.filter((rm) => rm.userID && typeof rm.userID === "string").map((rm) => ({
                            userID: rm.userID,
                            firstname: rm.firstname || "Unnamed",
                            lastname: rm.lastname || "",
                            phone: rm.phone || "",
                            email: rm.email || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        }));
                        const validAssignedRMs = assignedRMs.filter((rm) => rm.userID && typeof rm.userID === "string").map((rm) => ({
                            userID: rm.userID,
                            firstname: rm.firstname || "Unnamed",
                            lastname: rm.lastname || "",
                            phone: rm.phone || "",
                            email: rm.email || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        }));
                        updateState({ allRegionalManagers: validRMs });
                        setTempRegionalManagers(validAssignedRMs);
                    } catch {
                        setGlobalError("Failed to fetch regional managers.");
                    } finally {
                        updateLoading({ regionalManagers: false });
                    }
                } else if (role === ROLES.REGIONAL_MANAGER) {
                    updateLoading({ directors: true, regions: true, supervisors: true });
                    try {
                        const [allDirectors, assignedDirectors, allRegions, assignedRegions, allSupervisors, assignedSupervisors] =
                            await Promise.all([
                                fetchWithCache(`directors_${ROLES.DIRECTOR}`, () => getUsersByRole(ROLES.DIRECTOR)),
                                fetchWithCache(`directorByRegionalManager_${selectedUser.userID}`, () => getDirectorByRegionalManager(selectedUser.userID)),
                                fetchWithCache("allRegions", () => getAllRegions()),
                                fetchWithCache(`regionsByUser_${selectedUser.userID}`, () => getRegionsByUser(selectedUser.userID)),
                                fetchWithCache(`supervisors_${ROLES.SUPERVISOR}`, () => getUsersByRole(ROLES.SUPERVISOR)),
                                fetchWithCache(`supervisorsByRegionalManager_${selectedUser.userID}`, () => getSupervisorsByRegionalManager(selectedUser.userID)),
                            ]);
                        const validDirectors = allDirectors.filter((d) => d.userID && typeof d.userID === "string").map((d) => ({
                            userID: d.userID,
                            firstname: d.firstname || "Unnamed",
                            lastname: d.lastname || "",
                            phone: d.phone || "",
                            email: d.email || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        }));
                        const validAssignedDirectors = assignedDirectors.filter((d) => d.userID && typeof d.userID === "string").map((d) => ({
                            userID: d.userID,
                            firstname: d.firstname || "Unnamed",
                            lastname: d.lastname || "",
                            phone: d.phone || "",
                            email: d.email || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        }));
                        const validRegions = allRegions.filter((r) => r.regionID && typeof r.regionID === "string").map((r) => ({
                            regionID: r.regionID,
                            name: r.name || "Unnamed Region",
                        }));
                        const validAssignedRegions = assignedRegions.filter((r) => r.regionID && typeof r.regionID === "string").map((r) => ({
                            regionID: r.regionID,
                            name: r.name || "Unnamed Region",
                        }));
                        const validSupervisors = allSupervisors.filter((s) => s.userID && typeof s.userID === "string").map((s) => ({
                            userID: s.userID,
                            firstname: s.firstname || "Unnamed",
                            lastname: s.lastname || "",
                            phone: s.phone || "",
                            email: s.email || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        }));
                        const validAssignedSupervisors = assignedSupervisors.filter((s) => s.userID && typeof s.userID === "string").map((s) => ({
                            userID: s.userID,
                            firstname: s.firstname || "Unnamed",
                            lastname: s.lastname || "",
                            phone: s.phone || "",
                            email: s.email || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        }));
                        updateState({
                            allDirectors: validDirectors,
                            allRegions: validRegions,
                            allSupervisors: validSupervisors,
                        });
                        setTempDirectors(validAssignedDirectors);
                        setTempRegions(validAssignedRegions);
                        setTempSupervisors(validAssignedSupervisors);
                    } catch {
                        setGlobalError("Failed to fetch regional manager data.");
                    } finally {
                        updateLoading({ directors: false, regions: false, supervisors: false });
                    }
                } else if (role === ROLES.SUPERVISOR) {
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
                        const validRMs = allRMs.filter((rm) => rm.userID && typeof rm.userID === "string").map((rm) => ({
                            userID: rm.userID,
                            firstname: rm.firstname || "Unnamed",
                            lastname: rm.lastname || "",
                            phone: rm.phone || "",
                            email: rm.email || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        }));
                        const validAssignedRMs = assignedRMs.filter((rm) => rm.userID && typeof rm.userID === "string").map((rm) => ({
                            userID: rm.userID,
                            firstname: rm.firstname || "Unnamed",
                            lastname: rm.lastname || "",
                            phone: rm.phone || "",
                            email: rm.email || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        }));
                        updateState({ allRegionalManagers: validRMs });
                        setTempRegionalManagers(validAssignedRMs);
                    } catch {
                        setGlobalError("Failed to fetch regional managers for supervisor.");
                    } finally {
                        updateLoading({ regionalManagers: false });
                    }
                }
            } else {
                if (role === ROLES.DIRECTOR) {
                    updateLoading({ regionalManagers: true });
                    try {
                        const allRMs = await fetchWithCache(`regionalManagers_${ROLES.REGIONAL_MANAGER}`, () =>
                            getUsersByRole(ROLES.REGIONAL_MANAGER)
                        );
                        const validRMs = allRMs.filter((rm) => rm.userID && typeof rm.userID === "string").map((rm) => ({
                            userID: rm.userID,
                            firstname: rm.firstname || "Unnamed",
                            lastname: rm.lastname || "",
                            phone: rm.phone || "",
                            email: rm.email || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        }));
                        updateState({ allRegionalManagers: validRMs });
                        setTempRegionalManagers([]);
                    } catch {
                        setGlobalError("Failed to fetch regional managers for new director.");
                    } finally {
                        updateLoading({ regionalManagers: false });
                    }
                } else if (role === ROLES.REGIONAL_MANAGER) {
                    updateLoading({ directors: true, regions: true, supervisors: true });
                    try {
                        const [allDirectors, allRegions, allSupervisors] = await Promise.all([
                            fetchWithCache(`directors_${ROLES.DIRECTOR}`, () => getUsersByRole(ROLES.DIRECTOR)),
                            fetchWithCache("allRegions", () => getAllRegions()),
                            fetchWithCache(`supervisors_${ROLES.SUPERVISOR}`, () => getUsersByRole(ROLES.SUPERVISOR)),
                        ]);
                        const validDirectors = allDirectors.filter((d) => d.userID && typeof d.userID === "string").map((d) => ({
                            userID: d.userID,
                            firstname: d.firstname || "Unnamed",
                            lastname: d.lastname || "",
                            phone: d.phone || "",
                            email: d.email || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        }));
                        const validRegions = allRegions.filter((r) => r.regionID && typeof r.regionID === "string").map((r) => ({
                            regionID: r.regionID,
                            name: r.name || "Unnamed Region",
                        }));
                        const validSupervisors = allSupervisors.filter((s) => s.userID && typeof s.userID === "string").map((s) => ({
                            userID: s.userID,
                            firstname: s.firstname || "Unnamed",
                            lastname: s.lastname || "",
                            phone: s.phone || "",
                            email: s.email || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        }));
                        updateState({
                            allDirectors: validDirectors,
                            allRegions: validRegions,
                            allSupervisors: validSupervisors,
                        });
                        setTempDirectors([]);
                        setTempRegions([]);
                        setTempSupervisors([]);
                    } catch {
                        setGlobalError("Failed to fetch data for new regional manager.");
                    } finally {
                        updateLoading({ directors: false, regions: false, supervisors: false });
                    }
                } else if (role === ROLES.SUPERVISOR) {
                    updateLoading({ regionalManagers: true });
                    try {
                        const allRMs = await fetchWithCache(`regionalManagers_${ROLES.REGIONAL_MANAGER}`, () =>
                            getUsersByRole(ROLES.REGIONAL_MANAGER)
                        );
                        const validRMs = allRMs.filter((rm) => rm.userID && typeof rm.userID === "string").map((rm) => ({
                            userID: rm.userID,
                            firstname: rm.firstname || "Unnamed",
                            lastname: rm.lastname || "",
                            phone: rm.phone || "",
                            email: rm.email || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        }));
                        updateState({ allRegionalManagers: validRMs });
                        setTempRegionalManagers([]);
                    } catch {
                        setGlobalError("Failed to fetch regional managers for new supervisor.");
                    } finally {
                        updateLoading({ regionalManagers: false });
                    }
                }
            }
        };

        fetchInitialData();
    }, [
        expandedSection,
        selectedUser,
        role,
        fetchWithCache,
        setGlobalError,
        setTempDirectors,
        setTempRegionalManagers,
        setTempRegions,
        setTempSupervisors,
        updateLoading,
        updateState,
    ]);

    useEffect(() => {
        if (role !== ROLES.SUPERVISOR) {
            updateState({ availableGovernorates: [], availableDelegations: [], availableAgents: [] });
            setTempGovernorates([]);
            setTempDelegations([]);
            setTempAgents([]);
            return;
        }

        const fetchGovernorates = async () => {
            updateLoading({ governorates: true });
            try {
                const regions = tempRegionalManagers.length > 0
                    ? await fetchWithCache(`regionsByUser_${tempRegionalManagers[0].userID}`, () =>
                        getRegionsByUser(tempRegionalManagers[0].userID)
                    )
                    : [];
                const governoratesFromRegions = regions.length > 0
                    ? await Promise.all(
                        regions.map((r) =>
                            fetchWithCache(`governoratesByRegion_${r.regionID}`, () =>
                                getGovernoratesByRegion(r.regionID)
                            )
                        )
                    )
                    : [];
                const assignedGovs = selectedUser
                    ? await fetchWithCache(`governoratesByUser_${selectedUser.userID}`, () =>
                        getGovernoratesByUser(selectedUser.userID)
                    )
                    : [];

                const validGovernoratesFromRegions = governoratesFromRegions
                    .flat()
                    .filter((gov) => gov.governorateID && typeof gov.governorateID === "string")
                    .map((gov) => ({
                        governorateID: gov.governorateID,
                        name: gov.name || "Unnamed Governorate",
                        regionID: gov.regionID || "",
                    }));
                const validAssignedGovs = Array.isArray(assignedGovs)
                    ? assignedGovs
                        .filter((gov) => gov.governorateID && typeof gov.governorateID === "string")
                        .map((gov) => ({
                            governorateID: gov.governorateID,
                            name: gov.name || "Unnamed Governorate",
                            regionID: gov.regionID || "",
                        }))
                    : [];

                // Log raw data for debugging
                console.debug("Governorates from regions:", validGovernoratesFromRegions);
                console.debug("Assigned governorates:", validAssignedGovs);

                // Combine governorates, preferring assigned governorates for consistency
                const govMap = new Map<string, Governorate>();
                // First, add governorates from regions
                for (const gov of validGovernoratesFromRegions) {
                    govMap.set(gov.governorateID, { ...gov });
                }
                // Then, overwrite with assigned governorates to prioritize their regionID
                for (const gov of validAssignedGovs) {
                    govMap.set(gov.governorateID, { ...gov });
                }

                const combinedGovernorates = Array.from(govMap.values());

                // Log combined governorates
                console.debug("Combined governorates:", combinedGovernorates);

                // Ensure no duplicates with the same governorateID and regionID
                const uniqueGovernorates = Array.from(
                    new Map(
                        combinedGovernorates.map((gov) => [
                            `${gov.governorateID}_${gov.regionID || 'no-region'}`,
                            gov,
                        ])
                    ).values()
                );

                // Log final unique governorates
                console.debug("Unique governorates:", uniqueGovernorates);

                updateState({ availableGovernorates: uniqueGovernorates });
                setTempGovernorates(validAssignedGovs.length > 0 ? validAssignedGovs : []);
            } catch (error) {
                console.error("Error fetching governorates:", error);
                setGlobalError("Failed to fetch governorates.");
                if (selectedUser) {
                    cache.delete(`governoratesByUser_${selectedUser.userID}`);
                }
                setTempGovernorates([]);
            } finally {
                updateLoading({ governorates: false });
            }
        };

        fetchGovernorates();
    }, [
        tempRegionalManagers,
        role,
        selectedUser,
        fetchWithCache,
        setGlobalError,
        setTempGovernorates,
        setTempDelegations,
        setTempAgents,
        updateLoading,
        updateState,
        cache,
    ]);

    useEffect(() => {
        if (role !== ROLES.SUPERVISOR) {
            updateState({ availableDelegations: [], availableAgents: [] });
            setTempDelegations([]);
            setTempAgents([]);
            return;
        }

        const fetchDelegations = async () => {
            updateLoading({ delegations: true });
            try {
                const delegationsFromGovs = tempGovernorates.length > 0
                    ? await Promise.all(
                        tempGovernorates.map((g) =>
                            fetchWithCache(`delegationsByGovernorate_${g.governorateID}`, () =>
                                getDelegationsByGovernorate(g.governorateID)
                            )
                        )
                    )
                    : [];
                const assignedDels = selectedUser
                    ? await fetchWithCache(`delegationsByUser_${selectedUser.userID}`, () =>
                        getDelegationsByUser(selectedUser.userID)
                    )
                    : [];
                const validDelegationsFromGovs = delegationsFromGovs
                    .flat()
                    .filter((del) => del.delegationID && typeof del.delegationID === "string")
                    .map((del) => ({
                        delegationID: del.delegationID,
                        name: del.name || "Unnamed Delegation",
                        governorateID: del.governorateID || "",
                    }));
                const validAssignedDels = Array.isArray(assignedDels)
                    ? assignedDels
                        .filter((del) => del.delegationID && typeof del.delegationID === "string")
                        .map((del) => ({
                            delegationID: del.delegationID,
                            name: del.name || "Unnamed Delegation",
                            governorateID: del.governorateID || "",
                        }))
                    : [];

                // Combine delegations from governorates and assigned delegations, deduplicate by delegationID
                const delegationKeySet = new Set<string>();
                const combinedDelegations: Delegation[] = [];
                for (const del of [...validDelegationsFromGovs, ...validAssignedDels]) {
                    const delKey = del.delegationID;
                    if (!delegationKeySet.has(delKey)) {
                        delegationKeySet.add(delKey);
                        combinedDelegations.push(del);
                    }
                }

                const normalizedDelegations = combinedDelegations.map((del) => {
                    const assignedDel = validAssignedDels.find((ad) => ad.delegationID === del.delegationID);
                    return {
                        ...del,
                        governorateID: assignedDel?.governorateID || del.governorateID,
                    };
                });

                if (delegationKeySet.size !== combinedDelegations.length) {
                    console.warn("Duplicate delegation keys detected, clearing cache");
                    cache.clear();
                }

                updateState({ availableDelegations: normalizedDelegations });
                setTempDelegations(validAssignedDels.length > 0 ? validAssignedDels : []);
            } catch (error) {
                console.error("Error fetching delegations:", error);
                setGlobalError("Failed to fetch delegations.");
                if (selectedUser) {
                    cache.delete(`delegationsByUser_${selectedUser.userID}`);
                }
                setTempDelegations([]);
            } finally {
                updateLoading({ delegations: false });
            }
        };

        fetchDelegations();
    }, [
        tempGovernorates,
        role,
        selectedUser,
        fetchWithCache,
        setGlobalError,
        setTempDelegations,
        setTempAgents,
        updateLoading,
        updateState,
        cache,
    ]);

    useEffect(() => {
        if (role !== ROLES.SUPERVISOR) {
            updateState({ availableAgents: [] });
            setTempAgents([]);
            return;
        }

        const fetchAgents = async () => {
            updateLoading({ agents: true });
            try {
                const agentsFromDels = tempDelegations.length > 0
                    ? await Promise.all(
                        tempDelegations.map((d) =>
                            fetchWithCache(`agentsByDelegation_${d.delegationID}`, () =>
                                getAgentsByDelegation(d.delegationID)
                            )
                        )
                    )
                    : [];
                const assignedAgents = selectedUser
                    ? await fetchWithCache(`agentsByUser_${selectedUser.userID}`, () =>
                        getAgentsByUser(selectedUser.userID)
                    )
                    : { agents: [] };
                const validAgentsFromDels = agentsFromDels
                    .flat()
                    .map((a) => a.agents)
                    .flat()
                    .filter((agent) => {
                        if (!agent.agentID || !agent.delegationID) {
                            console.warn("Invalid agent data:", agent);
                            return false;
                        }
                        return true;
                    })
                    .map((agent) => ({
                        agentID: agent.agentID,
                        name: agent.name || "Unnamed Agent",
                        lastname: agent.lastname || "",
                        phone: agent.phone || "",
                        email: agent.email || "",
                        location: agent.location || "",
                        delegationID: agent.delegationID,
                        createdAt: agent.createdAt || new Date().toISOString(),
                        updatedAt: agent.updatedAt || new Date().toISOString(),
                        Supervisor: agent.Supervisor || {
                            userID: selectedUser?.userID || "",
                            firstname: selectedUser?.firstname || "Unknown",
                            lastname: selectedUser?.lastname || "",
                            email: selectedUser?.email || "",
                            phone: selectedUser?.phone || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        },
                        Delegation: agent.Delegation || {
                            delegationID: agent.delegationID,
                            name: tempDelegations.find((d) => d.delegationID === agent.delegationID)?.name || "Unknown Delegation",
                            Governorate: {
                                governorateID: tempDelegations.find((d) => d.delegationID === agent.delegationID)?.governorateID || "",
                                name: tempGovernorates.find((g) => g.governorateID === tempDelegations.find((d) => d.delegationID === agent.delegationID)?.governorateID)?.name || "Unknown Governorate",
                            },
                        },
                    }));
                const validAssignedAgents = assignedAgents.agents
                    .filter((agent) => {
                        if (!agent.agentID || !agent.delegationID) {
                            console.warn("Invalid assigned agent data:", agent);
                            return false;
                        }
                        return true;
                    })
                    .map((agent) => ({
                        agentID: agent.agentID,
                        name: agent.name || "Unnamed Agent",
                        lastname: agent.lastname || "",
                        phone: agent.phone || "",
                        email: agent.email || "",
                        location: agent.location || "",
                        delegationID: agent.delegationID,
                        createdAt: agent.createdAt || new Date().toISOString(),
                        updatedAt: agent.updatedAt || new Date().toISOString(),
                        Supervisor: agent.Supervisor || {
                            userID: selectedUser?.userID || "",
                            firstname: selectedUser?.firstname || "Unknown",
                            lastname: selectedUser?.lastname || "",
                            email: selectedUser?.email || "",
                            phone: selectedUser?.phone || "",
                            password: "",
                            keycloakId: "",
                            Roles: [],
                        },
                        Delegation: agent.Delegation || {
                            delegationID: agent.delegationID,
                            name: tempDelegations.find((d) => d.delegationID === agent.delegationID)?.name || "Unknown Delegation",
                            Governorate: {
                                governorateID: tempDelegations.find((d) => d.delegationID === agent.delegationID)?.governorateID || "",
                                name: tempGovernorates.find((g) => g.governorateID === tempDelegations.find((d) => d.delegationID === agent.delegationID)?.governorateID)?.name || "Unknown Governorate",
                            },
                        },
                    }));

                // Combine agents from delegations and assigned agents, deduplicate by agentID and delegationID
                const agentKeySet = new Set<string>();
                const combinedAgents: Agent[] = [];
                for (const agent of [...validAgentsFromDels, ...validAssignedAgents]) {
                    const agentKey = `${agent.agentID}_${agent.delegationID}`;
                    if (!agentKeySet.has(agentKey)) {
                        agentKeySet.add(agentKey);
                        combinedAgents.push(agent);
                    }
                }

                if (agentKeySet.size !== combinedAgents.length) {
                    console.warn("Duplicate agent keys detected, clearing cache");
                    cache.clear();
                }

                console.debug("Valid agents:", combinedAgents);
                console.debug("Assigned agents:", validAssignedAgents);

                updateState({ availableAgents: combinedAgents });
                setTempAgents(validAssignedAgents.length > 0 ? validAssignedAgents : []);
            } catch (error) {
                console.error("Error fetching agents:", error);
                setGlobalError("Failed to fetch agents.");
                if (selectedUser) {
                    cache.delete(`agentsByUser_${selectedUser.userID}`);
                }
                setTempAgents([]);
            } finally {
                updateLoading({ agents: false });
            }
        };

        fetchAgents();
    }, [tempDelegations, role, selectedUser, fetchWithCache, setGlobalError, setTempAgents, updateLoading, updateState, cache, tempGovernorates]);

    const handlePhoneInput = useCallback(
        async (type: "director" | "regionalManager" | "supervisor" | "agent", phone: string) => {
            if (phone.length !== 8) return;
            try {
                setPhoneError(null);
                if (type === "agent") {
                    const agent = await fetchWithCache(`agentByPhone_${phone}`, () => getAgentByPhone(phone));
                    if (agent && agent.agentID && agent.delegationID) {
                        setTempAgents((prev) => {
                            const agentKey = `${agent.agentID}_${agent.delegationID}`;
                            const exists = prev.some((a) => `${a.agentID}_${a.delegationID}` === agentKey);
                            if (exists) {
                                console.debug(`Agent already exists: ${agentKey}`);
                                return prev;
                            }
                            console.debug(`Adding agent: ${agentKey}`);
                            return [
                                ...prev,
                                {
                                    agentID: agent.agentID,
                                    name: agent.name || "Unnamed Agent",
                                    lastname: agent.lastname || "",
                                    phone: agent.phone || "",
                                    email: agent.email || "",
                                    location: agent.location || "",
                                    delegationID: agent.delegationID,
                                    createdAt: agent.createdAt || new Date().toISOString(),
                                    updatedAt: agent.updatedAt || new Date().toISOString(),
                                    Supervisor: agent.Supervisor || {
                                        userID: selectedUser?.userID || "",
                                        firstname: selectedUser?.firstname || "Unknown",
                                        lastname: selectedUser?.lastname || "",
                                        email: selectedUser?.email || "",
                                        phone: selectedUser?.phone || "",
                                        password: "",
                                        keycloakId: "",
                                        Roles: [],
                                    },
                                    Delegation: agent.Delegation || {
                                        delegationID: agent.delegationID,
                                        name: tempDelegations.find((d) => d.delegationID === agent.delegationID)?.name || "Unknown Delegation",
                                        Governorate: {
                                            governorateID: tempDelegations.find((d) => d.delegationID === agent.delegationID)?.governorateID || "",
                                            name: tempGovernorates.find((g) => g.governorateID === tempDelegations.find((d) => d.delegationID === agent.delegationID)?.governorateID)?.name || "Unknown Governorate",
                                        },
                                    },
                                },
                            ];
                        });
                    } else {
                        setPhoneError("Agent not found or missing delegationID.");
                    }
                } else {
                    const user = await fetchWithCache(`userByPhone_${phone}`, () => getUserByPhone(phone));
                    const roleCheck = {
                        director: ROLES.DIRECTOR,
                        regionalManager: ROLES.REGIONAL_MANAGER,
                        supervisor: ROLES.SUPERVISOR,
                    }[type];
                    if (!user.Roles?.some((r) => r.name === roleCheck) || !user.userID) {
                        setPhoneError("User does not have the required role or missing ID.");
                        return;
                    }
                    const setter = {
                        director: setTempDirectors,
                        regionalManager: setTempRegionalManagers,
                        supervisor: setTempSupervisors,
                    }[type];
                    const userData: User = {
                        userID: user.userID,
                        firstname: user.firstname || "Unnamed",
                        lastname: user.lastname || "",
                        phone: user.phone || "",
                        email: user.email || "",
                        password: "",
                        keycloakId: "",
                        Roles: user.Roles || [],
                    };
                    setter((prev) =>
                        type === "director" || type === "regionalManager"
                            ? [userData]
                            : prev.some((u) => u.userID === userData.userID)
                                ? prev
                                : [...prev, userData]
                    );
                }
                updateState({ [`${type}PhoneInput`]: "" });
                setHasUnsavedChanges(true);
            } catch {
                setPhoneError("User or agent not found.");
            }
        },
        [fetchWithCache, setTempDirectors, setTempRegionalManagers, setTempSupervisors, setTempAgents, updateState, selectedUser, tempDelegations, tempGovernorates]
    );

    const handleSaveAssignments = useCallback(async (newUserId?: string) => {
        if (!selectedUser && !tempRoles.length && !newUserId) return;
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
            const userID = newUserId || selectedUser?.userID;
            if (!userID) {
                setGlobalError("User ID is missing.");
                return;
            }

            if (role === ROLES.DIRECTOR) {
                const currentRMs = (await getRegionalManagersByDirector(userID)).map((rm) => rm.userID);
                const newRMs = tempRegionalManagers.map((rm) => rm.userID);
                const toAssign = newRMs.filter((id) => !currentRMs.includes(id));
                const toRevoke = currentRMs.filter((id) => !newRMs.includes(id));

                await Promise.all([
                    ...toAssign.map((id) => assignDirectorToRegionalManager(id, userID)),
                    ...toRevoke.map((id) => revokeDirectorFromRegionalManager(id)),
                ]);
            } else if (role === ROLES.REGIONAL_MANAGER) {
                const currentDirectors = await getDirectorByRegionalManager(userID);
                const currentDirectorID = currentDirectors[0]?.userID || "";
                const newDirectorID = tempDirectors[0]?.userID || "";

                if (newDirectorID && newDirectorID !== currentDirectorID) {
                    await assignDirectorToRegionalManager(userID, newDirectorID);
                } else if (currentDirectorID && !newDirectorID) {
                    await revokeDirectorFromRegionalManager(userID);
                }

                const currentRegions = (await getRegionsByUser(userID)).map((r) => r.regionID);
                const newRegions = tempRegions.map((r) => r.regionID);
                console.log(`Current regions: ${currentRegions}`);
                console.log(`New regions: ${newRegions}`);
                const regionsToAssign = newRegions.filter((id) => !currentRegions.includes(id));
                const regionsToRevoke = currentRegions.filter((id) => !newRegions.includes(id));
                console.log(`Regions to assign: ${regionsToAssign}`);
                console.log(`Regions to revoke: ${regionsToRevoke}`);

                if (regionsToAssign.length) {
                    await assignRegionsToRegionalManager(userID, regionsToAssign);
                }
                if (regionsToRevoke.length) {
                    await new Promise<void>((resolve, reject) => {
                        setShowConfirm({
                            message: `Revoking regions will remove all assigned supervisors. Apply cascade?`,
                            onConfirm: async (cascade) => {
                                try {
                                    console.log(`Revoking regions: ${regionsToRevoke}, with cascade: ${cascade}`);
                                    await revokeRegionsFromRegionalManager(userID, regionsToRevoke, {
                                        revokeSupervisors: cascade,
                                    });
                                    console.log(`Successfully revoked regions: ${regionsToRevoke}`);
                                    setShowConfirm(null);
                                    resolve();
                                } catch (error) {
                                    console.error(`Error revoking regions:`, error);
                                    setGlobalError("Failed to revoke regions.");
                                    setShowConfirm(null);
                                    reject(error);
                                }
                            },
                            onCancel: () => {
                                setShowConfirm(null);
                                reject(new Error("Save operation cancelled"));
                            },
                        });
                    });
                }

                const currentSupervisors = (await getSupervisorsByRegionalManager(userID)).map((s) => s.userID);
                const newSupervisors = tempSupervisors.map((s) => s.userID);
                const supervisorsToAssign = newSupervisors.filter((id) => !currentSupervisors.includes(id));
                const supervisorsToRevoke = currentSupervisors.filter((id) => !newSupervisors.includes(id));

                await Promise.all([
                    ...supervisorsToAssign.map((id) => assignRegionalManagerToSupervisor(id, userID)),
                    ...(supervisorsToRevoke.length
                        ? [
                            new Promise<void>((resolve, reject) => {
                                setShowConfirm({
                                    message: `Revoking supervisors will remove all their assignments. Apply cascade?`,
                                    onConfirm: async (cascade) => {
                                        try {
                                            await Promise.all(
                                                supervisorsToRevoke.map((id) =>
                                                    revokeRegionalManagerFromSupervisor(id, { revokeAll: cascade })
                                                )
                                            );
                                            setShowConfirm(null);
                                            resolve();
                                        } catch (error) {
                                            setGlobalError("Failed to revoke supervisors.");
                                            setShowConfirm(null);
                                            reject(error);
                                        }
                                    },
                                    onCancel: () => {
                                        setShowConfirm(null);
                                        reject(new Error("Save operation cancelled"));
                                    },
                                });
                            }),
                        ]
                        : []),
                ]);
            } else if (role === ROLES.SUPERVISOR) {
                const currentRMs = (await getRegionalManagerBySupervisor(userID)).map((rm) => rm.userID);
                const newRM = tempRegionalManagers[0]?.userID || "";

                if (newRM && !currentRMs.includes(newRM)) {
                    await assignRegionalManagerToSupervisor(userID, newRM);
                } else if (currentRMs.length > 0 && !newRM) {
                    await new Promise<void>((resolve, reject) => {
                        setShowConfirm({
                            message: `Revoking regional manager will remove all assignments. Apply cascade?`,
                            onConfirm: async (cascade) => {
                                try {
                                    await revokeRegionalManagerFromSupervisor(userID, { revokeAll: cascade });
                                    setShowConfirm(null);
                                    resolve();
                                } catch (error) {
                                    setGlobalError("Failed to revoke regional manager.");
                                    setShowConfirm(null);
                                    reject(error);
                                }
                            },
                            onCancel: () => {
                                setShowConfirm(null);
                                reject(new Error("Save operation cancelled"));
                            },
                        });
                    });
                }

                const currentGovs = (await getGovernoratesByUser(userID)).map((g) => g.governorateID);
                const newGovs = tempGovernorates.map((g) => g.governorateID);
                const govsToAssign = newGovs.filter((id) => !currentGovs.includes(id));
                const govsToRevoke = currentGovs.filter((id) => !newGovs.includes(id));

                if (govsToAssign.length) {
                    await assignGovernoratesToSupervisor(userID, govsToAssign);
                }
                if (govsToRevoke.length) {
                    await new Promise<void>((resolve, reject) => {
                        setShowConfirm({
                            message: `Revoking governorates can remove all assigned delegations and agents. approve?`,
                            onConfirm: async (cascade) => {
                                try {
                                    await revokeGovernoratesFromSupervisor(userID, govsToRevoke, {
                                        revokeAll: cascade,
                                    });
                                    setShowConfirm(null);
                                    resolve();
                                } catch (error) {
                                    setGlobalError("Failed to revoke governorates.");
                                    setShowConfirm(null);
                                    reject(error);
                                }
                            },
                            onCancel: () => {
                                setShowConfirm(null);
                                reject(new Error("Save operation cancelled"));
                            },
                        });
                    });
                }

                const currentDels = (await getDelegationsByUser(userID)).map((d) => d.delegationID);
                const newDels = tempDelegations.map((d) => d.delegationID);
                const delsToAssign = newDels.filter((id) => !currentDels.includes(id));
                const delsToRevoke = currentDels.filter((id) => !newDels.includes(id));

                if (delsToAssign.length) {
                    await assignDelegationsToSupervisor(userID, delsToAssign);
                }
                if (delsToRevoke.length) {
                    await new Promise<void>((resolve, reject) => {
                        setShowConfirm({
                            message: `Revoking delegations will remove all assigned agents. Apply cascade?`,
                            onConfirm: async (cascade) => {
                                try {
                                    await revokeDelegationsFromSupervisor(userID, delsToRevoke, {
                                        revokeAgents: cascade,
                                    });
                                    setShowConfirm(null);
                                    resolve();
                                } catch (error) {
                                    setGlobalError("Failed to revoke delegations.");
                                    setShowConfirm(null);
                                    reject(error);
                                }
                            },
                            onCancel: () => {
                                setShowConfirm(null);
                                reject(new Error("Save operation cancelled"));
                            },
                        });
                    });
                }

                const currentAgents = (await getAgentsByUser(userID)).agents.map((a) => ({
                    agentID: a.agentID,
                    delegationID: a.delegationID,
                }));
                const newAgents = tempAgents.map((a) => ({
                    agentID: a.agentID,
                    delegationID: a.delegationID,
                }));
                const agentsToAssign = tempAgents.filter(
                    (a) => !currentAgents.some((ca) => ca.agentID === a.agentID && ca.delegationID === a.delegationID)
                );
                const agentsToRevoke = currentAgents
                    .filter((ca) => !newAgents.some((na) => na.agentID === ca.agentID && na.delegationID === ca.delegationID))
                    .map((ca) => ca.agentID);

                await Promise.all([
                    ...agentsToAssign.map((a) => assignSupervisorToAgent(a.agentID, userID, a.delegationID!)),
                    ...agentsToRevoke.map((id) => revokeSupervisorFromAgent(id)),
                ]);
            }

            const newUser = {
                ...selectedUser,
                userID,
                directorID: tempDirectors[0]?.userID || "",
                regionalManagerID: tempRegionalManagers[0]?.userID || "",
                Regions: tempRegions,
                Governorates: tempGovernorates,
                Delegations: tempDelegations,
                supervisors: tempSupervisors,
            };

            const validNewUser: User = {
                ...newUser,
                firstname: newUser.firstname || "Unnamed",
                lastname: newUser.lastname || "",
                phone: newUser.phone || "",
                email: newUser.email || "",
                password: newUser.password || "",
            };
            setUsers((prev) => prev.map((u) => (u.userID === userID ? validNewUser : u)));
            onUserUpdate(validNewUser);
            cache.clear();
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error("Error saving assignments:", error);
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
        tempRoles,
        setGlobalError,
        setUsers,
        onUserUpdate,
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
                        {selectedUser && hasUnsavedChanges && (
                            <button
                                className="action-button"
                                onClick={() => handleSaveAssignments()}
                                disabled={Object.values(loading).some((l) => l)}
                            >
                                {Object.values(loading).some((l) => l) ? "Saving..." : "Save Assignments"}
                            </button>
                        )}
                        {phoneError && (
                            <div className="error-message" style={{ color: "red" }}>
                                {phoneError}
                            </div>
                        )}
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
                                        true
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
                                            false
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
                                        handleToggle(setTempRegions, item, "regionID", true)
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
                                            true
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
                                            false
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
                                            true
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
                                            true
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
                                            true
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
                        <div className="sop-confirmation-modal">
                            <div className="sop-modal-content">
                                <p className="sop-modal-message">{showConfirm.message}</p>
                                <div className="sop-modal-buttons">
                                    <button
                                        className="sop-modal-button sop-modal-confirm"
                                        onClick={() => showConfirm.onConfirm(true)}
                                    >
                                        Yes, Apply Cascade
                                    </button>
                                    <button
                                        className="sop-modal-button sop-modal-revoke"
                                        onClick={() => showConfirm.onConfirm(false)}
                                    >
                                        No, Just Revoke
                                    </button>
                                    <button
                                        className="sop-modal-button sop-modal-cancel"
                                        onClick={() => showConfirm.onCancel?.()}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

};

export default React.memo(AssignmentsManagement);