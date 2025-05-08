/**
 * PermissionOverrides.tsx
 * Manages permission overrides, filtering, and effective permissions display.
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { FaAngleDown, FaFilter, FaPlus, FaMinus, FaTimes, FaInfoCircle } from "react-icons/fa";
import { useError } from "../../../context/ErrorContext";
import {
    removePermissionOverride,
    addPermissionOverride,
    getPermissionOverridesByUser,
    getEffectivePermissions,
    getAllPermissions,
} from "../../../apis/permissionAPI";
import User from "../../../models/User";
import Permission from "../../../models/Permission";
import UserPermissionOverride from "../../../models/UserPermissionOverride";
import PermissionsAction from "../../../models/Enum/PermissionsAction";
import "../AdminDashboard.css";

interface PermissionOverridesProps {
    selectedUser: User | null;
    permissionsList: Permission[];
    setPermissionsList: React.Dispatch<React.SetStateAction<Permission[]>>;
    expandedSection: string | null;
    toggleSection: (section: string) => void;
    userPermissions: {
        canAssignPermissions: boolean;
        canReadPermissionsByRole: boolean;
        canCreatePermissionOverrides: boolean;
        canRemovePermissionOverrides: boolean;
    };
    isSuperAdmin: boolean;
    tempOverrides: UserPermissionOverride[];
    setTempOverrides: React.Dispatch<React.SetStateAction<UserPermissionOverride[]>>;
    userOverrides: UserPermissionOverride[];
    setUserOverrides: React.Dispatch<React.SetStateAction<UserPermissionOverride[]>>;
    effectiveUserPermissions: Permission[];
    setEffectiveUserPermissions: React.Dispatch<React.SetStateAction<Permission[]>>;
}

const PermissionsDropdownSkeleton: React.FC = () => (
    <div className="dropdown-body">
        <div className="group-header">
            <div
                className="custom-skeleton"
                style={{ width: "100px", height: "32px" }}
            />
        </div>
        <div className="permissions-filter-section">
            <div className="permissions-filter-header">
                <div
                    className="custom-skeleton"
                    style={{ width: "20px", height: "20px" }}
                />
                <div
                    className="custom-skeleton"
                    style={{ width: "100px", height: "16px" }}
                />
            </div>
            <div className="permissions-filter-controls">
                <div className="permissions-search">
                    <div
                        className="custom-skeleton"
                        style={{ width: "200px", height: "32px" }}
                    />
                </div>
                <div className="permissions-category">
                    <div
                        className="custom-skeleton"
                        style={{ width: "150px", height: "32px" }}
                    />
                </div>
            </div>
        </div>
        <div
            className="custom-skeleton"
            style={{ width: "150px", height: "20px", marginBottom: "10px" }}
        />
        <div className="permissions-list">
            {[...Array(2)].map((_, i) => (
                <div key={i} className="permission-class">
                    <div
                        className="custom-skeleton"
                        style={{ width: "100px", height: "20px", marginBottom: "10px" }}
                    />
                    <div className="permissions-container">
                        {[...Array(3)].map((_, j) => (
                            <div key={j} className="permission-item">
                                <div
                                    className="custom-skeleton"
                                    style={{ width: "150px", height: "32px" }}
                                />
                                <div className="override-controls">
                                    <div
                                        className="custom-skeleton"
                                        style={{ width: "24px", height: "24px" }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const PermissionOverrides: React.FC<PermissionOverridesProps> = ({
    selectedUser,
    permissionsList,
    setPermissionsList,
    expandedSection,
    toggleSection,
    userPermissions,
    isSuperAdmin,
    tempOverrides,
    setTempOverrides,
    userOverrides,
    setUserOverrides,
    effectiveUserPermissions,
    setEffectiveUserPermissions,
}) => {
    const { setError: setGlobalError } = useError();
    const [loadingPermissions, setLoadingPermissions] = useState(false);
    const [permissionSearch, setPermissionSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [hasUnsavedOverrideChanges, setHasUnsavedOverrideChanges] = useState(false);

    useEffect(() => {
        if (expandedSection !== "permissions") return;
        const fetchPermissions = async () => {
            try {
                setLoadingPermissions(true);
                const [permissionsData, overrides, effectivePerms] = await Promise.all([
                    getAllPermissions(),
                    getPermissionOverridesByUser(selectedUser!.userID),
                    getEffectivePermissions(selectedUser!.userID),
                ]);
                setPermissionsList(permissionsData);
                setUserOverrides(overrides || []);
                setTempOverrides(overrides || []);
                setEffectiveUserPermissions(effectivePerms || []);
            } catch (error) {
                setGlobalError(
                    error instanceof Error ? error.message : "Failed to load permissions."
                );
            } finally {
                setLoadingPermissions(false);
            }
        };
        fetchPermissions();
    }, [expandedSection, selectedUser, setPermissionsList, setUserOverrides, setTempOverrides, setEffectiveUserPermissions, setGlobalError]);

    const categorizedPermissions = useMemo(() => {
        const byClass: { [key: string]: Permission[] } = {};
        permissionsList
            .filter(
                (perm) => isSuperAdmin || !["Permission", "Role"].includes(perm.class)
            )
            .forEach((perm) => {
                const formattedName = perm.name
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (char) => char.toUpperCase());
                byClass[perm.class] = byClass[perm.class] || [];
                byClass[perm.class].push({ ...perm, name: formattedName });
            });
        return byClass;
    }, [permissionsList, isSuperAdmin]);

    const filteredPermissions = useMemo(() => {
        let filtered = permissionsList.filter(
            (perm) => isSuperAdmin || !["Permission", "Role"].includes(perm.class)
        );
        if (permissionSearch) {
            filtered = filtered.filter(
                (perm) =>
                    perm.name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                    perm.class.toLowerCase().includes(permissionSearch.toLowerCase())
            );
        }
        if (selectedCategory !== "all") {
            filtered = filtered.filter((perm) => perm.class === selectedCategory);
        }
        return filtered.reduce((acc: { [key: string]: Permission[] }, perm) => {
            const formattedName = perm.name
                .replace(/_/g, " ")
                .replace(/\b\w/g, (char) => char.toUpperCase());
            acc[perm.class] = acc[perm.class] || [];
            acc[perm.class].push({ ...perm, name: formattedName });
            return acc;
        }, {});
    }, [permissionsList, permissionSearch, selectedCategory, isSuperAdmin]);

    const handleAddOverride = useCallback(
        (permissionID: string, action: "grant" | "revoke") => {
            if (!selectedUser || !userPermissions.canAssignPermissions) return;
            const roleID = tempOverrides[0]?.roleID;
            if (!roleID) {
                setGlobalError("No role selected for override.");
                return;
            }
            const newOverride: UserPermissionOverride = {
                overrideID: `temp_${Date.now()}_${permissionID}`,
                userID: selectedUser.userID,
                roleID,
                permissionID,
                action: action as PermissionsAction,
            };
            setTempOverrides([
                ...tempOverrides.filter((o) => o.permissionID !== permissionID),
                newOverride,
            ]);
            setHasUnsavedOverrideChanges(true);
        },
        [selectedUser, userPermissions.canAssignPermissions, tempOverrides, setTempOverrides, setGlobalError]
    );

    const handleRemoveOverride = useCallback(
        (overrideID: string) => {
            if (!selectedUser || !userPermissions.canAssignPermissions) return;
            setTempOverrides(
                tempOverrides.filter((o) => o.overrideID !== overrideID)
            );
            setHasUnsavedOverrideChanges(true);
        },
        [selectedUser, userPermissions.canAssignPermissions, tempOverrides, setTempOverrides]
    );

    const handleSaveOverrides = useCallback(async () => {
        if (
            !selectedUser ||
            !userPermissions.canAssignPermissions ||
            !hasUnsavedOverrideChanges
        )
            return;
        try {
            const currentOverrideIds = userOverrides.map((o) => o.overrideID);
            const tempOverrideIds = tempOverrides.map((o) => o.overrideID);
            const toRemove = userOverrides.filter(
                (o) => !tempOverrideIds.includes(o.overrideID)
            );
            await Promise.all(
                toRemove.map((o) => removePermissionOverride(o.overrideID))
            );
            const toAddOrUpdate = tempOverrides.filter(
                (o) =>
                    o.overrideID.startsWith("temp_") ||
                    !currentOverrideIds.includes(o.overrideID)
            );
            await Promise.all(
                toAddOrUpdate.map((o) =>
                    o.overrideID.startsWith("temp_")
                        ? addPermissionOverride(selectedUser.userID, {
                            roleID: o.roleID,
                            permissionID: o.permissionID,
                            action: o.action,
                        })
                        : Promise.resolve()
                )
            );
            const [updatedOverrides, updatedEffectivePerms] = await Promise.all([
                getPermissionOverridesByUser(selectedUser.userID),
                getEffectivePermissions(selectedUser.userID),
            ]);
            setUserOverrides(updatedOverrides);
            setTempOverrides(updatedOverrides);
            setEffectiveUserPermissions(updatedEffectivePerms);
            setHasUnsavedOverrideChanges(false);
        } catch (error) {
            setGlobalError(
                error instanceof Error
                    ? error.message
                    : "Failed to save permission overrides."
            );
            setTempOverrides(userOverrides);
        }
    }, [
        selectedUser,
        userPermissions.canAssignPermissions,
        hasUnsavedOverrideChanges,
        userOverrides,
        tempOverrides,
        setUserOverrides,
        setTempOverrides,
        setEffectiveUserPermissions,
        setGlobalError,
    ]);

    if (!userPermissions.canAssignPermissions) return null;

    return (
        <div className="dropdown-unit">
            <div
                className="dropdown-bar"
                onClick={() => toggleSection("permissions")}
            >
                <h3>Permission Overrides</h3>
                <FaAngleDown
                    className={`dropdown-icon ${expandedSection === "permissions" ? "expanded" : ""
                        }`}
                />
            </div>
            {expandedSection === "permissions" &&
                (loadingPermissions ? (
                    <PermissionsDropdownSkeleton />
                ) : (
                    <div className="dropdown-body">
                        <div className="group-header">
                            {hasUnsavedOverrideChanges && (
                                <button
                                    className="action-button"
                                    onClick={handleSaveOverrides}
                                >
                                    Save Changes
                                </button>
                            )}
                        </div>
                        <div className="permissions-filter-section">
                            <div className="permissions-filter-header">
                                <FaFilter />
                                <label>Filter Permissions</label>
                            </div>
                            <div className="permissions-filter-controls">
                                <div className="permissions-search">
                                    <input
                                        type="text"
                                        placeholder="Search permissions..."
                                        value={permissionSearch}
                                        onChange={(e) => setPermissionSearch(e.target.value)}
                                        className="search-input"
                                    />
                                </div>
                                <div className="permissions-category">
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                    >
                                        <option value="all">All Categories</option>
                                        {Object.keys(categorizedPermissions).map(
                                            (category) => (
                                                <option key={category} value={category}>
                                                    {category.charAt(0).toUpperCase() +
                                                        category.slice(1)}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <h4>Effective Permissions</h4>
                        {userPermissions.canReadPermissionsByRole && (
                            <div className="permissions-list">
                                {Object.entries(filteredPermissions).map(
                                    ([className, permissions]) => (
                                        <div key={className} className="permission-class">
                                            <h4>{className}</h4>
                                            <div className="permissions-container">
                                                {permissions.map((perm: Permission) => {
                                                    const isEffective =
                                                        effectiveUserPermissions.some(
                                                            (p) => p.permissionID === perm.permissionID
                                                        );
                                                    const tempOverride = tempOverrides.find(
                                                        (o) => o.permissionID === perm.permissionID
                                                    );
                                                    const hasOverride = !!tempOverride;
                                                    const overrideAction = tempOverride?.action;
                                                    return (
                                                        <div
                                                            key={perm.permissionID}
                                                            className="permission-item"
                                                        >
                                                            <button
                                                                className={`permission-button ${(hasOverride
                                                                    ? overrideAction === "grant"
                                                                    : isEffective)
                                                                    ? "assigned"
                                                                    : ""
                                                                    }`}
                                                            >
                                                                {perm.name}
                                                                <FaInfoCircle
                                                                    className="permission-info-icon"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // Note: toggleOverridePopup is handled in InfoPopupWrapper
                                                                    }}
                                                                />
                                                            </button>
                                                            {userPermissions.canAssignPermissions && (
                                                                <div className="override-controls">
                                                                    {!hasOverride && !isEffective && (
                                                                        <button
                                                                            className="override-button grant"
                                                                            onClick={() =>
                                                                                handleAddOverride(
                                                                                    perm.permissionID,
                                                                                    "grant"
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                !userPermissions.canCreatePermissionOverrides
                                                                            }
                                                                            title="Grant Permission"
                                                                        >
                                                                            <FaPlus />
                                                                        </button>
                                                                    )}
                                                                    {!hasOverride && isEffective && (
                                                                        <button
                                                                            className="override-button revoke"
                                                                            onClick={() =>
                                                                                handleAddOverride(
                                                                                    perm.permissionID,
                                                                                    "revoke"
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                !userPermissions.canCreatePermissionOverrides
                                                                            }
                                                                            title="Revoke Permission"
                                                                        >
                                                                            <FaMinus />
                                                                        </button>
                                                                    )}
                                                                    {hasOverride && (
                                                                        <button
                                                                            className="override-button remove"
                                                                            onClick={() =>
                                                                                handleRemoveOverride(
                                                                                    tempOverride.overrideID
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                !userPermissions.canRemovePermissionOverrides
                                                                            }
                                                                            title="Remove Override"
                                                                        >
                                                                            <FaTimes />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                ))}
        </div>
    );
};

export default React.memo(PermissionOverrides);