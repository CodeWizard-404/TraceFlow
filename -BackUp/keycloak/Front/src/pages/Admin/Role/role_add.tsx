import React, { useMemo, useState } from "react";
import { FaFilter } from "react-icons/fa";

// Context and APIs
import { useAuth } from "../../../context/AuthContext";
import { assignPermissionsToRole, getPermissionsByRole } from "../../../apis/permissionAPI";
import { createRole } from "../../../apis/roleAPI";

// Models and Types
import Permission from "../../../models/Permission";
import Role from "../../../models/Role";
import { ViewMode } from "../adminTypes";

// Styles
import "../AdminDashboard.css";

// Props Interface
interface RoleAddProps {
    roles: Role[];
    setRoles: (roles: Role[]) => void;
    permissionsList: Permission[];
    view: string;
    setView: (view: ViewMode) => void;
    setError: (error: string | null) => void;
}

// Main Component
const RoleAdd: React.FC<RoleAddProps> = ({
    roles,
    setRoles,
    permissionsList,
    view,
    setView,
    setError,
}) => {
    const { effectivePermissions, userRoles } = useAuth();

    // State
    const [newRole, setNewRole] = useState<Partial<Role>>({});
    const [selectedPermissionsForNewRole, setSelectedPermissionsForNewRole] = useState<string[]>([]);
    const [permissionSearch, setPermissionSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [roleFormErrors, setRoleFormErrors] = useState({ name: "", description: "" });
    const [roleTouched, setRoleTouched] = useState({ name: false, description: false });
    const [loading, setLoading] = useState(false);

    // Permissions
    const userPermissions = {
        canCreateRoles: effectivePermissions?.some((p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_ROLES),
        canAssignPermissions: effectivePermissions?.some((p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_PERMISSIONS),
    };

    // Super Admin Check
    const isSuperAdmin = useMemo(
        () => userRoles?.some((r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN),
        [userRoles]
    );

    // Computed Permissions
    const categorizedPermissions = useMemo(() => {
        return Object.entries(
            permissionsList
                .filter((perm) => isSuperAdmin || !["Role", "Permission"].includes(perm.class))
                .reduce((acc: { [key: string]: Permission[] }, perm) => {
                    const formattedName = perm.name
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (char) => char.toUpperCase());
                    if (!acc[perm.class]) acc[perm.class] = [];
                    acc[perm.class].push({ ...perm, name: formattedName });
                    return acc;
                }, {})
        );
    }, [permissionsList, isSuperAdmin]);

    const filteredPermissions = useMemo(() => {
        let result = permissionsList.filter((perm) => isSuperAdmin || !["Role", "Permission"].includes(perm.class));
        if (permissionSearch) {
            result = result.filter(
                (perm) =>
                    perm.name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                    perm.class.toLowerCase().includes(permissionSearch.toLowerCase())
            );
        }
        if (selectedCategory !== "all") {
            result = result.filter((perm) => perm.class === selectedCategory);
        }
        return result.reduce((acc: { [key: string]: Permission[] }, perm) => {
            const formattedName = perm.name
                .replace(/_/g, " ")
                .replace(/\b\w/g, (char) => char.toUpperCase());
            if (!acc[perm.class]) acc[perm.class] = [];
            acc[perm.class].push({ ...perm, name: formattedName });
            return acc;
        }, {});
    }, [permissionsList, permissionSearch, selectedCategory, isSuperAdmin]);

    // Handlers
    const handleCreateRole = async () => {
        if (!userPermissions.canCreateRoles) return;

        const errors = {
            name: validateRoleName(newRole.name || ""),
            description: validateRoleDescription(newRole.description || ""),
        };

        setRoleFormErrors(errors);
        if (Object.values(errors).some((error) => error)) {
            setError("Please correct the errors before submitting.");
            return;
        }

        setLoading(true);
        try {
            const createdRole = await createRole(
                { name: newRole.name!.trim(), description: newRole.description?.trim() });
            if (selectedPermissionsForNewRole.length > 0 && userPermissions.canAssignPermissions) {
                await assignPermissionsToRole(createdRole.roleID, selectedPermissionsForNewRole);
                createdRole.permissions = await getPermissionsByRole(createdRole.roleID);
            }
            setRoles([...roles, createdRole]);
            setNewRole({});
            setSelectedPermissionsForNewRole([]);
            setRoleFormErrors({ name: "", description: "" });
            setRoleTouched({ name: false, description: false });
            setView("roles");
            setError(null);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Failed to create role.";
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Validation
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

    // Render
    if (view !== "add-role" || !userPermissions.canCreateRoles) return null;

    return (
        <div className="form-card form-card-0">
            <div className="form-section">
                <h3>Role Details</h3>
                <div className="form-group">
                    <label>Name *</label>
                    <input
                        type="text"
                        value={newRole.name || ""}
                        onChange={(e) => {
                            setNewRole({ ...newRole, name: e.target.value });
                            setRoleFormErrors({ ...roleFormErrors, name: validateRoleName(e.target.value) });
                        }}
                        onBlur={() => setRoleTouched({ ...roleTouched, name: true })}
                        className={`user-edit-input ${roleTouched.name && roleFormErrors.name ? "invalid-vibrate" : ""}`}
                        required
                        disabled={loading}
                    />
                    {roleFormErrors.name && roleTouched.name && <span className="error-text">{roleFormErrors.name}</span>}
                </div>
                <div className="form-group">
                    <label>Description</label>
                    <textarea
                        value={newRole.description || ""}
                        onChange={(e) => {
                            setNewRole({ ...newRole, description: e.target.value });
                            setRoleFormErrors({ ...roleFormErrors, description: validateRoleDescription(e.target.value) });
                        }}
                        onBlur={() => setRoleTouched({ ...roleTouched, description: true })}
                        className={`user-edit-input ${roleTouched.description && roleFormErrors.description ? "invalid-vibrate" : ""}`}
                        disabled={loading}
                    />
                    {roleFormErrors.description && roleTouched.description && (
                        <span className="error-text">{roleFormErrors.description}</span>
                    )}
                </div>
            </div>
            {userPermissions.canAssignPermissions && (
                <div className="form-section">
                    <hr />
                    <h3>Permissions</h3>
                    <div className="form-group">
                        <label>Assign Permissions</label>
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
                                        disabled={loading}
                                    />
                                </div>
                                <div className="permissions-category">
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        disabled={loading}
                                    >
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
                        <div className="permissions-grid">
                            {Object.entries(filteredPermissions).map(([className, permissions]) => (
                                <div key={className} className="permission-class">
                                    <div className="permission-class-header">
                                        <h4>{className}</h4>
                                        <button
                                            className="toggle-all-button"
                                            onClick={() => {
                                                const classPermissions = permissionsList.filter((p) => p.class === className);
                                                const allSelected = classPermissions.every((p) =>
                                                    selectedPermissionsForNewRole.includes(p.permissionID)
                                                );
                                                setSelectedPermissionsForNewRole((prev) =>
                                                    allSelected
                                                        ? prev.filter((id) => !classPermissions.some((p) => p.permissionID === id))
                                                        : [...prev, ...classPermissions.filter((p) => !prev.includes(p.permissionID)).map((p) => p.permissionID)]
                                                );
                                            }}
                                            disabled={loading}
                                        >
                                            {permissionsList.filter((p) => p.class === className).every((p) =>
                                                selectedPermissionsForNewRole.includes(p.permissionID)
                                            )
                                                ? "Deselect All"
                                                : "Select All"}
                                        </button>
                                    </div>
                                    <div className="permissions-container">
                                        {Array.isArray(permissions) ? (
                                            permissions.map((perm) => (
                                                <button
                                                    key={perm.permissionID}
                                                    className={`permission-button ${selectedPermissionsForNewRole.includes(perm.permissionID) ? "assigned" : ""
                                                        }`}
                                                    onClick={() => {
                                                        setSelectedPermissionsForNewRole((prev) =>
                                                            prev.includes(perm.permissionID)
                                                                ? prev.filter((id) => id !== perm.permissionID)
                                                                : [...prev, perm.permissionID]
                                                        );
                                                    }}
                                                    disabled={loading}
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
                    </div>
                </div>
            )}
            <button className="action-button" onClick={handleCreateRole} disabled={loading}>
                {loading ? "Creating..." : "Create Role"}
            </button>
        </div>
    );
};

export default RoleAdd;