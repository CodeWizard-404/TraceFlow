import React, { useEffect, useState, useCallback } from "react";
import { FaAngleDown, FaInfoCircle } from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import { useError } from "../../../context/ErrorContext";
import { revokeRolesFromUser, assignRolesToUser, getAllRoles, getRolesByUser } from "../../../apis/roleAPI";
import User from "../../../models/User";
import Role from "../../../models/Role";
import { Tooltip } from "react-tooltip";
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
    setActiveRolePopup: React.Dispatch<React.SetStateAction<string | null>>;
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
    setActiveRolePopup,
}) => {
    const { user: currentUser } = useAuth();
    const { setError: setGlobalError } = useError();
    const [loadingRoles, setLoadingRoles] = useState(false);

    // Define exclusive roles
    const exclusiveRoles = [
        import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
        import.meta.env.VITE_ROLES_DIRECTOR,
        import.meta.env.VITE_ROLES_SUPERVISOR,
    ];

    useEffect(() => {
        if (expandedSection !== "roles" || !selectedUser) return;
        const fetchRoles = async () => {
            try {
                setLoadingRoles(true);
                const [rolesData, userRolesData] = await Promise.all([
                    getAllRoles(),
                    getRolesByUser(selectedUser.userID),
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
            if (!userPermissions.canAssignRoles) return;

            if (role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN) {
                setGlobalError("The Super Admin role cannot be assigned or revoked.");
                return;
            }

            if (selectedUser) {
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
                    let updatedRoles = [...tempRoles];

                    // Handle exclusive roles logic
                    if (exclusiveRoles.includes(role.name)) {
                        if (!hasRole) {
                            // If toggling on an exclusive role, remove other exclusive roles
                            const rolesToRevoke = tempRoles
                                .filter((r) => exclusiveRoles.includes(r.name) && r.roleID !== role.roleID)
                                .map((r) => r.roleID);
                            if (rolesToRevoke.length > 0) {
                                await revokeRolesFromUser(selectedUser.userID, rolesToRevoke);
                                updatedRoles = updatedRoles.filter(
                                    (r) => !exclusiveRoles.includes(r.name) || r.roleID === role.roleID
                                );
                            }
                            // Assign the new role
                            await assignRolesToUser(selectedUser.userID, [role.roleID]);
                            updatedRoles = [...updatedRoles, role];
                        } else {
                            // If toggling off, just remove the role
                            await revokeRolesFromUser(selectedUser.userID, [role.roleID]);
                            updatedRoles = updatedRoles.filter((r) => r.roleID !== role.roleID);
                        }
                    } else {
                        // Handle non-exclusive roles
                        if (hasRole) {
                            await revokeRolesFromUser(selectedUser.userID, [role.roleID]);
                            updatedRoles = updatedRoles.filter((r) => r.roleID !== role.roleID);
                        } else {
                            await assignRolesToUser(selectedUser.userID, [role.roleID]);
                            updatedRoles = [...updatedRoles, role];
                        }
                    }

                    // Update state
                    setTempRoles(updatedRoles);
                    setUsers(
                        users.map((u) =>
                            u.userID === selectedUser.userID
                                ? { ...u, Roles: updatedRoles }
                                : u
                        )
                    );
                    setSelectedUser({ ...selectedUser, Roles: updatedRoles });
                } catch (error) {
                    setGlobalError(
                        error instanceof Error ? error.message : "Failed to toggle role."
                    );
                    setTempRoles(selectedUser.Roles || []);
                }
            } else {
                const hasRole = tempRoles.some((r) => r.roleID === role.roleID);
                if (hasRole) {
                    setTempRoles(tempRoles.filter((r) => r.roleID !== role.roleID));
                } else {
                    setTempRoles([...tempRoles, role]);
                }
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

    // Determine if a role should be disabled due to exclusive role selection
    const isRoleDisabled = (role: Role) => {
        if (role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN) return true;
        if (exclusiveRoles.includes(role.name)) {
            const hasExclusiveRole = tempRoles.some((r) => exclusiveRoles.includes(r.name));
            return hasExclusiveRole && !tempRoles.some((r) => r.roleID === role.roleID);
        }
        return false;
    };

    if (!userPermissions.canAssignRoles) return null;

    return (
        <div className="dropdown-unit">
            <div
                className="dropdown-bar"
                onClick={() => toggleSection("roles")}
            >
                <h3>Role Management</h3>
                <FaAngleDown
                    className={`dropdown-icon ${expandedSection === "roles" ? "expanded" : ""}`}
                />
            </div>
            {expandedSection === "roles" &&
                (loadingRoles ? (
                    <RolesDropdownSkeleton />
                ) : (
                    <div className="dropdown-body">
                        <div className="roles-grid">
                            {roles
                                .filter((role) => role.name !== import.meta.env.VITE_ROLES_SUPER_ADMIN)
                                .map((role) => (
                                    <div key={role.roleID} className="role-toggle-container">
                                        <button
                                            className={`role-toggle-button ${tempRoles.some((r) => r.roleID === role.roleID) ? "active" : ""
                                                } ${isRoleDisabled(role) ? "disabled" : ""}`}
                                            onClick={() => handleToggleRole(role)}
                                            disabled={isRoleDisabled(role)}
                                            data-tooltip-id={`tooltip-${role.roleID}`}
                                            data-tooltip-content={
                                                isRoleDisabled(role)
                                                    ? "Only one of Regional Manager, Manager, or Supervisor can be selected at a time."
                                                    : ""
                                            }
                                        >
                                            <span>{role.name}</span>
                                            <FaInfoCircle
                                                className="role-info-icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveRolePopup(role.roleID);
                                                }}
                                                aria-label={`View details for ${role.name}`}
                                            />
                                        </button>
                                        <Tooltip id={`tooltip-${role.roleID}`} />
                                    </div>
                                ))}
                        </div>
                    </div>
                ))}
        </div>
    );
};

export default React.memo(RoleManagement);