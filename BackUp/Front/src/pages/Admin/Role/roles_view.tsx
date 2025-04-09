import React, { useState, useEffect, useMemo } from "react";
import {
    FaEdit, FaTrash
} from "react-icons/fa";
import Role from "../../../models/Role";
import Permission from "../../../models/Permission";
import { useAuth } from "../../../context/AuthContext";
import {
    updateRole,
    deleteRole,
} from "../../../apis/roleAPI";
import "../AdminDashboard.css";
import { assignPermissionsToRole, revokePermissionsFromRole } from "../../../apis/permissionAPI";

interface RoleViewProps {
    selectedRole: Role | null;
    setSelectedRole: (role: Role | null) => void;
    roles: Role[];
    setRoles: (roles: Role[]) => void;
    permissionsList: Permission[];
    view: string;
    userRoles: Role[];
    setError: (error: string | null) => void;
}

const RoleView: React.FC<RoleViewProps> = ({
    selectedRole,
    setSelectedRole,
    roles,
    setRoles,
    permissionsList,
    view,
    userRoles,
    setError
}) => {
    const { token, effectivePermissions } = useAuth();

    // State
    const [isEditingRole, setIsEditingRole] = useState(false);
    const [editedRole, setEditedRole] = useState<Partial<Role>>({});
    const [tempPermissions, setTempPermissions] = useState<Permission[]>([]);
    const [permissionSearch, setPermissionSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [loading, setLoading] = useState(false);
    const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => void } | null>(null);
    const [roleFormErrors, setRoleFormErrors] = useState({ name: "", description: "" });
    const [roleTouched, setRoleTouched] = useState({ name: false, description: false });

    // Permission Checks
    const userPermissions = {
        canUpdateRoles: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_ROLES),
        canDeleteRoles: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_DELETE_ROLES),
        canAssignPermissions: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_PERMISSIONS),
        canReadPermissionsByRole: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS_BY_ROLE),
        canViewRoleDetails: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_ROLE_DETAILS),
    };

    const isSuperAdmin = useMemo(() => userRoles?.some(r => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN), [userRoles]);

    // Sync Temporary Permissions with Selected Role
    useEffect(() => {
        if (selectedRole) setTempPermissions(selectedRole.permissions || []);
    }, [selectedRole]);

    // Handlers
    const handleEditRole = (role: Role) => {
        if (!userPermissions.canUpdateRoles) return;
        if (role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN) {
            setError("The Super Admin role cannot be modified.");
            return;
        }
        setIsEditingRole(true);
        setEditedRole({ name: role.name, description: role.description });
        setSelectedRole(role);
    };

    const handleSaveRoleEdit = async () => {
        if (!selectedRole || !userPermissions.canUpdateRoles || !isEditingRole) return;

        const errors = {
            name: validateRoleName(editedRole.name || ""),
            description: validateRoleDescription(editedRole.description || ""),
        };

        setRoleFormErrors(errors);
        if (Object.values(errors).some(error => error)) {
            setError("Please correct the errors before saving.");
            return;
        }

        setLoading(true);
        try {
            const updatedRole = await updateRole(selectedRole.roleID, {
                name: editedRole.name!.trim(),
                description: editedRole.description?.trim()
            }, token!);
            setRoles(roles.map(r => r.roleID === selectedRole.roleID ? { ...updatedRole, permissions: selectedRole.permissions } : r));
            setSelectedRole({ ...updatedRole, permissions: selectedRole.permissions });
            setIsEditingRole(false);
            setEditedRole({});
            setRoleFormErrors({ name: "", description: "" });
            setRoleTouched({ name: false, description: false });
            setError(null);
        } catch (error) {
            console.error("Failed to update role:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRole = async (role: Role) => {
        if (!userPermissions.canUpdateRoles) return;
        if (role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN) {
            setError("The Super Admin role cannot be deleted.");
            return;
        }
        setConfirmation({
            message: `Are you sure you want to delete the "${role.name}" role? This action cannot be undone.`,
            onConfirm: async () => {
                setLoading(true);
                try {
                    await deleteRole(role.roleID, token!);
                    setRoles(roles.filter(r => r.roleID !== role.roleID));
                    setSelectedRole(null);
                    setError(null);
                } catch (error) {
                    console.error("Failed to delete role:", error);
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const handleTogglePermission = (permissionID: string) => {
        if (!userPermissions.canAssignPermissions) return;
        const hasPermission = tempPermissions.some(perm => perm.permissionID === permissionID);
        setTempPermissions(hasPermission
            ? tempPermissions.filter(p => p.permissionID !== permissionID)
            : [...tempPermissions, permissionsList.find(p => p.permissionID === permissionID)!]);
        setHasUnsavedChanges(true);
    };

    const handleToggleAllPermissionsInClass = (className: string) => {
        if (!userPermissions.canAssignPermissions) return;
        const classPermissions = permissionsList.filter(p => p.class === className);
        const allSelected = classPermissions.every(p => tempPermissions.some(tp => tp.permissionID === p.permissionID));
        setTempPermissions(allSelected
            ? tempPermissions.filter(p => !classPermissions.some(cp => cp.permissionID === p.permissionID))
            : [...tempPermissions, ...classPermissions.filter(p => !tempPermissions.some(tp => tp.permissionID === p.permissionID))]);
        setHasUnsavedChanges(true);
    };

    const handleSavePermissions = async () => {
        if (!selectedRole || !userPermissions.canUpdateRoles || !userPermissions.canAssignPermissions) return;
        setLoading(true);
        try {
            const currentPermissionIds = selectedRole.permissions?.map(p => p.permissionID) || [];
            const newPermissionIds = tempPermissions.map(p => p.permissionID);
            const toAdd = newPermissionIds.filter(id => !currentPermissionIds.includes(id));
            const toRemove = currentPermissionIds.filter(id => !newPermissionIds.includes(id));

            if (toAdd.length > 0) await assignPermissionsToRole(selectedRole.roleID, toAdd, token!);
            if (toRemove.length > 0) await revokePermissionsFromRole(selectedRole.roleID, toRemove, token!);

            setRoles(roles.map(r => r.roleID === selectedRole.roleID ? { ...r, permissions: tempPermissions } : r));
            setSelectedRole({ ...selectedRole, permissions: tempPermissions });
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error("Failed to save permissions:", error);
            setTempPermissions(selectedRole.permissions || []);
        } finally {
            setLoading(false);
        }
    };

    const validateRoleName = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return "Role name is required";
        if (trimmed.length < 3) return "Role name must be at least 3 characters";
        if (trimmed.length > 20) return "Role name must be 20 characters or less";
        if (!/^[a-zA-Z\s-]+$/.test(trimmed)) return "Role name can only contain letters, spaces, or hyphens";
        return "";
    };

    const validateRoleDescription = (value: string): string => {
        const trimmed = value.trim();
        if (trimmed.length > 150) return "Description must be 150 characters or less";
        return "";
    };

    const categorizedPermissions = Object.entries(permissionsList.reduce((acc: { [key: string]: Permission[] }, perm) => {
        const formattedName = perm.name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
        if (!acc[perm.class]) acc[perm.class] = [];
        acc[perm.class].push({ ...perm, name: formattedName });
        return acc;
    }, {} as { [key: string]: Permission[] }));

    const filteredPermissions = () => {
        let result = permissionsList.filter(perm => isSuperAdmin || !["Permission"].includes(perm.class));
        if (permissionSearch) {
            result = result.filter(perm =>
                perm.name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                perm.class.toLowerCase().includes(permissionSearch.toLowerCase())
            );
        }
        if (selectedCategory !== "all") result = result.filter(perm => perm.class === selectedCategory);
        return result.reduce((acc: { [key: string]: Permission[] }, perm) => {
            const formattedName = perm.name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
            if (!acc[perm.class]) acc[perm.class] = [];
            acc[perm.class].push({ ...perm, name: formattedName });
            return acc;
        }, {} as { [key: string]: Permission[] });
    };

    const ConfirmationModal: React.FC<{ message: string; onConfirm: () => void; onCancel: () => void }> = ({ message, onConfirm, onCancel }) => {
        const [isFadingOut, setIsFadingOut] = useState(false);

        const handleConfirm = () => {
            setIsFadingOut(true);
            setTimeout(() => {
                onConfirm();
            }, 300);
        };

        const handleCancel = () => {
            setIsFadingOut(true);
            setTimeout(() => {
                onCancel();
            }, 300);
        };

        return (
            <div className={`confirmation-modal-overlay ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
                <div className="confirmation-modal">
                    <p>{message}</p>
                    <div className="confirmation-actions">
                        <button className="confirm-button" onClick={handleConfirm}>Confirm</button>
                        <button className="cancel-button" onClick={handleCancel}>Cancel</button>
                    </div>
                </div>
            </div>
        );
    };

    return view === "roles" && selectedRole && userPermissions.canUpdateRoles ? (
        <div className="details-card">
            {confirmation && (
                <ConfirmationModal
                    message={confirmation.message}
                    onConfirm={() => {
                        confirmation.onConfirm();
                        setConfirmation(null);
                    }}
                    onCancel={() => setConfirmation(null)}
                />
            )}
            <div className="card-header">
                {isEditingRole ? (
                    <div className="role-edit-form">
                        <input
                            type="text"
                            value={editedRole.name || ""}
                            onChange={e => {
                                setEditedRole({ ...editedRole, name: e.target.value });
                                setRoleFormErrors({ ...roleFormErrors, name: validateRoleName(e.target.value) });
                            }}
                            onBlur={() => setRoleTouched({ ...roleTouched, name: true })}
                            placeholder="Role Name"
                            className={`role-edit-input ${roleTouched.name && roleFormErrors.name ? "invalid-vibrate" : ""}`}
                            required
                        />
                        {roleFormErrors.name && roleTouched.name && <span className="error-text">{roleFormErrors.name}</span>}
                        <textarea
                            value={editedRole.description || ""}
                            onChange={e => {
                                setEditedRole({ ...editedRole, description: e.target.value });
                                setRoleFormErrors({ ...roleFormErrors, description: validateRoleDescription(e.target.value) });
                            }}
                            onBlur={() => setRoleTouched({ ...roleTouched, description: true })}
                            placeholder="Role Description"
                            className={`role-edit-textarea ${roleTouched.description && roleFormErrors.description ? "invalid-vibrate" : ""}`}
                        />
                        {roleFormErrors.description && roleTouched.description && <span className="error-text">{roleFormErrors.description}</span>}
                        <div className="role-edit-actions">
                            <button className="action-button" onClick={handleSaveRoleEdit} disabled={loading}>
                                {loading ? "Saving..." : "Save"}
                            </button>
                            <button className="cancel-button" onClick={() => { setIsEditingRole(false); setEditedRole({}); }} disabled={loading}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h2>{selectedRole.name}</h2>
                        <div className="role-actions">
                            <button className="edit-button" onClick={() => handleEditRole(selectedRole)} disabled={loading || !userPermissions.canUpdateRoles}>
                                <FaEdit /> Edit
                            </button>
                            <button className="delete-button" onClick={() => handleDeleteRole(selectedRole)} disabled={loading || !userPermissions.canDeleteRoles}>
                                <FaTrash /> Delete
                            </button>
                        </div>
                    </>
                )}
            </div>
            {!isEditingRole && (
                <>
                    <p>{selectedRole.description}</p>
                    <div className="permissions-filter-section">
                        <div className="permissions-filter-header">
                            <label>Filter Permissions</label>
                        </div>
                        <div className="permissions-filter-controls">
                            <div className="permissions-search">
                                <input
                                    type="text"
                                    placeholder="Search permissions..."
                                    value={permissionSearch}
                                    onChange={e => setPermissionSearch(e.target.value)}
                                />
                            </div>
                            <div className="permissions-category">
                                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                                    <option value="all">All Categories</option>
                                    {categorizedPermissions.map(([category]) => (
                                        <option key={category} value={category}>
                                            {category.charAt(0).toUpperCase() + category.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <h3>Permissions</h3>
                    {userPermissions.canReadPermissionsByRole && (
                        <div className="permissions-list">
                            {Object.entries(filteredPermissions()).map(([className, permissions]) => (
                                <div key={className} className="permission-class">
                                    <div className="permission-class-header">
                                        <h4>{className}</h4>
                                        {userPermissions.canAssignPermissions && (
                                            <button
                                                className="toggle-all-button"
                                                onClick={() => handleToggleAllPermissionsInClass(className)}
                                                disabled={loading}
                                            >
                                                {permissionsList.filter(p => p.class === className).every(p =>
                                                    tempPermissions.some(tp => tp.permissionID === p.permissionID))
                                                    ? "Deselect All" : "Select All"}
                                            </button>
                                        )}
                                    </div>
                                    <div className="permissions-container">
                                        {Array.isArray(permissions) ? (
                                            permissions.map(perm => (
                                                <button
                                                    key={perm.permissionID}
                                                    className={`permission-button ${tempPermissions.some(p => p.permissionID === perm.permissionID) ? "assigned" : ""}`}
                                                    onClick={() => handleTogglePermission(perm.permissionID)}
                                                    disabled={loading || !userPermissions.canAssignPermissions}
                                                >
                                                    {perm.name}
                                                </button>
                                            ))
                                        ) : (
                                            <p>No permissions available</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {hasUnsavedChanges && userPermissions.canAssignPermissions && (
                        <button className="action-button" onClick={handleSavePermissions} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                </>
            )}

        </div>
    ) : null;
};

export default RoleView;