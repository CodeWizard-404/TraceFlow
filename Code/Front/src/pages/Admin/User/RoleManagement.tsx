/**
 * RoleManagement.tsx
 * Manages role toggling and displays role-related UI, including dropdown and role grid.
 */

import React, { useEffect, useState, useCallback } from "react";
import { FaAngleDown, FaInfoCircle } from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import { useError } from "../../../context/ErrorContext";
import { revokeRolesFromUser, assignRolesToUser, getAllRoles, getRolesByUser } from "../../../apis/roleAPI";
import User from "../../../models/User";
import Role from "../../../models/Role";
import "../AdminDashboard.css";

interface RoleManagementProps {
    selectedUser: User | null;
    userRoles: Role[];
    roles: Role[];
    setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
    tempRoles: Role[];
    setTempRoles: React.Dispatch<React.SetStateAction<Role[]>>;
    expandedSection: string | null;
    toggleSection: (section: string) => void;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    setSelectedUser: React.Dispatch<React.SetStateAction<User | null>>;
    userPermissions: {
        canAssignRoles: boolean;
    };
    isSuperAdmin: boolean;
}

const RolesDropdownSkeleton: React.FC = () => (
    <div className="dropdown-body">
        <div className="roles-grid">
            {[...Array(7)].map((_, i) => (
                <div key={i} className="role-toggle-container">
                    <div
                        className="custom-skeleton"
                        style={{ width: "100%", height: "32px" }}
                    />
                </div>
            ))}
        </div>
    </div>
);

const RoleManagement: React.FC<RoleManagementProps> = ({
    selectedUser,
    roles,
    setRoles,
    tempRoles,
    setTempRoles,
    expandedSection,
    toggleSection,
    users,
    setUsers,
    setSelectedUser,
    userPermissions,
    isSuperAdmin,
}) => {
    const { user: currentUser } = useAuth();
    const { setError: setGlobalError } = useError();
    const [loadingRoles, setLoadingRoles] = useState(false);

    useEffect(() => {
        if (expandedSection !== "roles") return;
        const fetchRoles = async () => {
            try {
                setLoadingRoles(true);
                const [rolesData, userRolesData] = await Promise.all([
                    getAllRoles(),
                    getRolesByUser(selectedUser!.userID),
                ]);
                setRoles(rolesData);
                setTempRoles(userRolesData || []);
            } catch (error) {
                setGlobalError(
                    error instanceof Error ? error.message : "Failed to load roles."
                );
            } finally {
                setLoadingRoles(false);
            }
        };
        fetchRoles();
    }, [expandedSection, selectedUser, setRoles, setTempRoles, setGlobalError]);

    const handleToggleRole = useCallback(
        async (role: Role) => {
            if (!userPermissions.canAssignRoles || !selectedUser) return;
            if (role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN) {
                setGlobalError("The Super Admin role cannot be assigned or revoked.");
                return;
            }
            const isCurrentUser = selectedUser.userID === currentUser?.userID;
            const hasAdminRole = tempRoles.some(
                (r) => r.name === import.meta.env.VITE_ROLES_ADMIN
            );
            if (
                isCurrentUser &&
                role.name === import.meta.env.VITE_ROLES_ADMIN &&
                hasAdminRole &&
                !isSuperAdmin
            ) {
                setGlobalError("You cannot revoke your own Admin role.");
                return;
            }
            try {
                const hasRole = tempRoles.some((r) => r.roleID === role.roleID);
                if (hasRole) {
                    await revokeRolesFromUser(selectedUser.userID, [role.roleID]);
                    const updatedRoles = tempRoles.filter(
                        (r) => r.roleID !== role.roleID
                    );
                    setTempRoles(updatedRoles);
                    setUsers(
                        users.map((u) =>
                            u.userID === selectedUser.userID
                                ? { ...u, Roles: updatedRoles }
                                : u
                        )
                    );
                    setSelectedUser({ ...selectedUser, Roles: updatedRoles });
                } else {
                    await assignRolesToUser(selectedUser.userID, [role.roleID]);
                    const updatedRoles = [...tempRoles, role];
                    setTempRoles(updatedRoles);
                    setUsers(
                        users.map((u) =>
                            u.userID === selectedUser.userID
                                ? { ...u, Roles: updatedRoles }
                                : u
                        )
                    );
                    setSelectedUser({ ...selectedUser, Roles: updatedRoles });
                }
            } catch (error) {
                setGlobalError(
                    error instanceof Error ? error.message : "Failed to toggle role."
                );
                setTempRoles(selectedUser.Roles || []);
            }
        },
        [
            userPermissions.canAssignRoles,
            selectedUser,
            currentUser,
            tempRoles,
            isSuperAdmin,
            users,
            setUsers,
            setSelectedUser,
            setTempRoles,
            setGlobalError,
        ]
    );

    if (!userPermissions.canAssignRoles) return null;

    return (
        <div className="dropdown-unit">
            <div
                className="dropdown-bar"
                onClick={() => toggleSection("roles")}
            >
                <h3>Role Management</h3>
                <FaAngleDown
                    className={`dropdown-icon ${expandedSection === "roles" ? "expanded" : ""
                        }`}
                />
            </div>
            {expandedSection === "roles" &&
                (loadingRoles ? (
                    <RolesDropdownSkeleton />
                ) : (
                    <div className="dropdown-body">
                        <div className="roles-grid">
                            {roles.map((role) => (
                                <div key={role.roleID} className="role-toggle-container">
                                    <button
                                        className={`role-toggle-button ${tempRoles.some((r) => r.roleID === role.roleID)
                                            ? "active"
                                            : ""
                                            }`}
                                        onClick={() => handleToggleRole(role)}
                                        disabled={
                                            role.name ===
                                            import.meta.env.VITE_ROLES_SUPER_ADMIN ||
                                            (selectedUser?.userID === currentUser?.userID &&
                                                role.name === import.meta.env.VITE_ROLES_ADMIN &&
                                                !isSuperAdmin &&
                                                tempRoles.some(
                                                    (r) =>
                                                        r.name === import.meta.env.VITE_ROLES_ADMIN
                                                ))
                                        }
                                    >
                                        <span>{role.name}</span>
                                        <FaInfoCircle
                                            className="role-info-icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Note: toggleRolePopup is handled in InfoPopupWrapper
                                            }}
                                        />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
        </div>
    );
};

export default React.memo(RoleManagement);