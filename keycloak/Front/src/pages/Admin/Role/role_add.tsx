import React, { useMemo, useState, useEffect, useCallback } from "react";
import { FaFilter } from "react-icons/fa";
import { debounce } from "lodash";

// Context and APIs
import { useAuth } from "../../../context/AuthContext";
import {
  assignPermissionsToRole,
  getPermissionsByRole,
  getAllPermissions,
} from "../../../apis/permissionAPI";
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
  view: ViewMode;
  setView: (view: ViewMode) => void;
  setError: (error: string | null) => void;
}

// Confirmation Modal Component
const ConfirmationModal: React.FC<{
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ message, onConfirm, onCancel }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleConfirm = () => {
    setIsFadingOut(true);
    setTimeout(() => onConfirm(), 300);
  };

  const handleCancel = () => {
    setIsFadingOut(true);
    setTimeout(() => onCancel(), 300);
  };

  return (
    <div
      className={`confirmation-modal-overlay ${isFadingOut ? "fade-out" : "fade-in"}`}
    >
      <div className="confirmation-modal">
        <p>{message}</p>
        <div className="confirmation-actions">
          <button className="confirm-button" onClick={handleConfirm}>
            Confirm
          </button>
          <button className="cancel-button" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const [selectedPermissionsForNewRole, setSelectedPermissionsForNewRole] =
    useState<string[]>([]);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [roleFormErrors, setRoleFormErrors] = useState({
    name: "",
    description: "",
  });
  const [roleTouched, setRoleTouched] = useState({
    name: false,
    description: false,
  });
  const [loading, setLoading] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [confirmation, setConfirmation] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [localPermissions, setLocalPermissions] = useState<Permission[]>(permissionsList);

  // Permissions
  const userPermissions = {
    canCreateRoles: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_ROLES
    ),
    canAssignPermissions: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_PERMISSIONS
    ),
    canViewPermissions: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS
    ),
  };

  // Super Admin Check
  const isSuperAdmin = useMemo(
    () =>
      userRoles?.some((r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN),
    [userRoles]
  );

  // Fetch Permissions if Empty
  useEffect(() => {
    if (localPermissions.length === 0 && userPermissions.canViewPermissions) {
      const fetchPermissions = async () => {
        setPermissionsLoading(true);
        try {
          const permissions = await getAllPermissions();
          setLocalPermissions(permissions || []);
        } catch {
          setError("Failed to load permissions.");
        } finally {
          setPermissionsLoading(false);
        }
      };
      fetchPermissions();
    } else {
      setPermissionsLoading(false);
    }
  }, [localPermissions, userPermissions.canViewPermissions, setError]);

  // Computed Permissions
  const categorizedPermissions = useMemo(() => {
    return Object.entries(
      localPermissions
        .filter(
          (perm) => isSuperAdmin || !["Role", "Permission"].includes(perm.class)
        )
        .reduce((acc: { [key: string]: Permission[] }, perm) => {
          const formattedName = perm.name
            .replace(/_/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());
          if (!acc[perm.class]) acc[perm.class] = [];
          acc[perm.class].push({ ...perm, name: formattedName });
          return acc;
        }, {})
    );
  }, [localPermissions, isSuperAdmin]);

  const filteredPermissions = useMemo(() => {
    let result = localPermissions.filter(
      (perm) => isSuperAdmin || !["Role", "Permission"].includes(perm.class)
    );
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
  }, [localPermissions, permissionSearch, selectedCategory, isSuperAdmin]);

  // Debounced Search
  const debouncedSetPermissionSearch = useCallback(
    debounce((value: string) => setPermissionSearch(value), 300),
    []
  );

  // Auto-Clear Errors
  useEffect(() => {
    const timer = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(timer);
  }, [setError]);

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

    setConfirmation({
      message: `Are you sure you want to create the role "${newRole.name}"?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const createdRole = await createRole({
            name: newRole.name!.trim(),
            description: newRole.description?.trim(),
          });
          if (
            selectedPermissionsForNewRole.length > 0 &&
            userPermissions.canAssignPermissions
          ) {
            await assignPermissionsToRole(
              createdRole.roleID,
              selectedPermissionsForNewRole
            );
            createdRole.Permissions = await getPermissionsByRole(
              createdRole.roleID
            );
          }
          setRoles([...roles, createdRole]);
          setNewRole({});
          setSelectedPermissionsForNewRole([]);
          setRoleFormErrors({ name: "", description: "" });
          setRoleTouched({ name: false, description: false });
          setView("roles");
          setError(null);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : "Failed to create role.";
          setError(errorMessage);
        } finally {
          setLoading(false);
          setConfirmation(null);
        }
      },
    });
  };

  // Validation
  const validateRoleName = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "Role name is required";
    if (trimmed.length < 3) return "Role name must be at least 3 characters";
    if (trimmed.length > 20) return "Role name must be 20 characters or less";
    if (!/^[a-zA-Z\s-]+$/.test(trimmed))
      return "Role name can only contain letters, spaces, or hyphens";
    return "";
  };

  const validateRoleDescription = (value: string): string => {
    const trimmed = value.trim();
    if (trimmed.length > 150)
      return "Description must be 150 characters or less";
    return "";
  };

  // Skeleton Loader
  const renderSkeleton = () => (
    <div aria-busy="true">
      <div className="form-section">
        <div className="custom-skeleton pulsing" style={{ width: "100px", height: "24px" }} />
        <div className="form-group">
          <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
        </div>
        <div className="form-group">
          <div className="custom-skeleton pulsing" style={{ width: "100%", height: "60px" }} />
        </div>
      </div>
      <div className="form-section">
        <div className="custom-skeleton pulsing" style={{ width: "100px", height: "24px" }} />
        <div className="permissions-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="permission-class">
              <div className="custom-skeleton pulsing" style={{ width: "120px", height: "20px" }} />
              <div className="permissions-container">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="custom-skeleton pulsing" style={{ width: "80%", height: "32px" }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Render
  if (view !== "add-role" || !userPermissions.canCreateRoles) return null;

  return (
    <div className="form-card form-card-0">
      {confirmation && (
        <ConfirmationModal
          message={confirmation.message}
          onConfirm={confirmation.onConfirm}
          onCancel={() => setConfirmation(null)}
        />
      )}
      {permissionsLoading ? renderSkeleton() : (
        <>
          <div className="form-section">
            <h3>Role Details</h3>
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={newRole.name || ""}
                onChange={(e) => {
                  setNewRole({ ...newRole, name: e.target.value });
                  setRoleFormErrors({
                    ...roleFormErrors,
                    name: validateRoleName(e.target.value),
                  });
                }}
                onBlur={() => setRoleTouched({ ...roleTouched, name: true })}
                className={`user-edit-input ${roleTouched.name && roleFormErrors.name ? "invalid-vibrate" : ""
                  }`}
                required
                disabled={loading}
                aria-label="Role name"
                aria-invalid={roleTouched.name && !!roleFormErrors.name}
              />
              {roleFormErrors.name && roleTouched.name && (
                <span className="error-text">{roleFormErrors.name}</span>
              )}
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={newRole.description || ""}
                onChange={(e) => {
                  setNewRole({ ...newRole, description: e.target.value });
                  setRoleFormErrors({
                    ...roleFormErrors,
                    description: validateRoleDescription(e.target.value),
                  });
                }}
                onBlur={() => setRoleTouched({ ...roleTouched, description: true })}
                className={`user-edit-input ${roleTouched.description && roleFormErrors.description
                  ? "invalid-vibrate"
                  : ""
                  }`}
                disabled={loading}
                aria-label="Role description"
                aria-invalid={roleTouched.description && !!roleFormErrors.description}
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
                        onChange={(e) => debouncedSetPermissionSearch(e.target.value)}
                        disabled={loading}
                        aria-label="Search permissions"
                      />
                    </div>
                    <div className="permissions-category">
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        disabled={loading}
                        aria-label="Filter by permission category"
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
                  {Object.entries(filteredPermissions).map(
                    ([className, permissions]) => (
                      <div key={className} className="permission-class">
                        <div className="permission-class-header">
                          <h4>{className}</h4>
                          <button
                            className="toggle-all-button"
                            onClick={() => {
                              const classPermissions = localPermissions.filter(
                                (p) => p.class === className
                              );
                              const allSelected = classPermissions.every((p) =>
                                selectedPermissionsForNewRole.includes(
                                  p.permissionID
                                )
                              );
                              setSelectedPermissionsForNewRole((prev) =>
                                allSelected
                                  ? prev.filter(
                                    (id) =>
                                      !classPermissions.some(
                                        (p) => p.permissionID === id
                                      )
                                  )
                                  : [
                                    ...prev,
                                    ...classPermissions
                                      .filter(
                                        (p) => !prev.includes(p.permissionID)
                                      )
                                      .map((p) => p.permissionID),
                                  ]
                              );
                            }}
                            disabled={loading}
                          >
                            {localPermissions
                              .filter((p) => p.class === className)
                              .every((p) =>
                                selectedPermissionsForNewRole.includes(
                                  p.permissionID
                                )
                              )
                              ? "Deselect All"
                              : "Select All"}
                          </button>
                        </div>
                        <div className="permissions-container">
                          {Array.isArray(permissions) && permissions.length > 0 ? (
                            permissions.map((perm) => (
                              <button
                                key={perm.permissionID}
                                className={`permission-button ${selectedPermissionsForNewRole.includes(
                                  perm.permissionID
                                )
                                  ? "assigned"
                                  : ""
                                  }`}
                                onClick={() => {
                                  setSelectedPermissionsForNewRole((prev) =>
                                    prev.includes(perm.permissionID)
                                      ? prev.filter(
                                        (id) => id !== perm.permissionID
                                      )
                                      : [...prev, perm.permissionID]
                                  );
                                }}
                                disabled={loading}
                                aria-label={`Toggle ${perm.name} permission`}
                              >
                                {perm.name}
                              </button>
                            ))
                          ) : (
                            <p>No permissions available</p>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="form-actions-0">
            <button
              className="action-button"
              onClick={handleCreateRole}
              disabled={loading}
              aria-busy={loading ? "true" : "false"}
            >
              {loading ? "Creating..." : "Create Role"}
            </button>
            <button
              className="cancel-button"
              onClick={() => {
                setNewRole({});
                setSelectedPermissionsForNewRole([]);
                setRoleFormErrors({ name: "", description: "" });
                setRoleTouched({ name: false, description: false });
                setView("roles");
              }}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default RoleAdd;