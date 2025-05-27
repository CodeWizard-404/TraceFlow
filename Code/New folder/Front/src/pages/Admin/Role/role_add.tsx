import React, { useMemo, useState, useEffect, useCallback } from "react";
import { FaFilter, FaInfoCircle, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { debounce } from "lodash";
import { motion, AnimatePresence } from "framer-motion";

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

// Components
import InfoPopup from "../InfoPopup";

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
  const [activePermissionPopup, setActivePermissionPopup] = useState<string | null>(null);
  const [expandedActions, setExpandedActions] = useState<{ [key: string]: boolean }>({});

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

  // Categorize permissions by action type
  const categorizeByAction = (permissions: Permission[]) => {
    const categories: { [key: string]: Permission[] } = {
      Access: [],
      Update: [],
      Delete: [],
      Create: [],
      Assign: [],
      Revoke: [],
      View: [],
      Manage: [],
      Others: [],
    };

    permissions.forEach((perm) => {
      const nameParts = perm.name.includes('_') ? perm.name.split('_') : perm.name.split(' ');
      const firstWord = nameParts[0].toLowerCase();
      if (firstWord === 'access') categories.Access.push(perm);
      else if (firstWord === 'update') categories.Update.push(perm);
      else if (firstWord === 'delete') categories.Delete.push(perm);
      else if (firstWord === 'create') categories.Create.push(perm);
      else if (firstWord === 'assign') categories.Assign.push(perm);
      else if (firstWord === 'revoke') categories.Revoke.push(perm);
      else if (firstWord === 'view') categories.View.push(perm);
      else if (firstWord === 'manage') categories.Manage.push(perm);
      else categories.Others.push(perm);
    });

    Object.keys(categories).forEach((category) => {
      categories[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    return categories;
  };

  // Computed Permissions
  const categorizedPermissions = useMemo(() => {
    const filteredPerms = localPermissions.filter(
      (perm) => isSuperAdmin || !["Role", "Permission"].includes(perm.class)
    );
    return Object.entries(
      filteredPerms.reduce((acc: { [key: string]: Permission[] }, perm) => {
        const formattedName = perm.name
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
        if (!acc[perm.class]) acc[perm.class] = [];
        acc[perm.class].push({ ...perm, name: formattedName });
        return acc;
      }, {})
    ).map(([className, perms]) => ({
      className,
      actions: categorizeByAction(perms),
    }));
  }, [localPermissions, isSuperAdmin]);

  const filteredPermissions = useMemo(() => {
    let result = localPermissions.filter(
      (perm) => isSuperAdmin || !["Role", "Permission"].includes(perm.class)
    );
    if (permissionSearch) {
      result = result.filter(
        (perm) =>
          perm.name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
          perm.description?.toLowerCase().includes(permissionSearch.toLowerCase())
      );
    }
    if (selectedCategory !== "all") {
      result = result.filter((perm) => perm.class === selectedCategory);
    }
    return Object.entries(
      result.reduce((acc: { [key: string]: Permission[] }, perm) => {
        const formattedName = perm.name
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
        if (!acc[perm.class]) acc[perm.class] = [];
        acc[perm.class].push({ ...perm, name: formattedName });
        return acc;
      }, {})
    ).map(([className, perms]) => ({
      className,
      actions: categorizeByAction(perms),
    }));
  }, [localPermissions, permissionSearch, selectedCategory, isSuperAdmin]);

  // Debounced Search
  const debouncedSetPermissionSearch = useCallback(
    debounce((value: string) => setPermissionSearch(value), 300),
    []
  );

  // Toggle Action Expansion
  const toggleActionExpansion = useCallback((className: string, action: string) => {
    const key = `${className}-${action}`.toLowerCase().replace(/\s+/g, '-');
    setExpandedActions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  // Toggle All Permissions in Action
  const handleToggleAllPermissionsInAction = useCallback(
    (className: string, action: string) => {
      if (!userPermissions.canAssignPermissions) return;
      const validActions = ['access', 'update', 'delete', 'create', 'assign', 'revoke', 'view', 'manage'];
      const actionPermissions = localPermissions.filter((p) => {
        if (p.class !== className) return false;
        const nameParts = p.name.includes('_') ? p.name.split('_') : p.name.split(' ');
        const firstWord = nameParts[0].toLowerCase();
        if (action.toLowerCase() === 'others') {
          return !validActions.includes(firstWord);
        }
        return firstWord === action.toLowerCase();
      });

      const allSelected = actionPermissions.every((p) =>
        selectedPermissionsForNewRole.includes(p.permissionID)
      );
      setSelectedPermissionsForNewRole((prev) =>
        allSelected
          ? prev.filter(
            (id) => !actionPermissions.some((ap) => ap.permissionID === id)
          )
          : [
            ...prev,
            ...actionPermissions
              .filter((p) => !prev.includes(p.permissionID))
              .map((p) => p.permissionID),
          ]
      );
    },
    [userPermissions.canAssignPermissions, localPermissions, selectedPermissionsForNewRole]
  );

  // Toggle All Permissions in Class
  const handleToggleAllPermissionsInClass = useCallback(
    (className: string) => {
      if (!userPermissions.canAssignPermissions) return;
      const classPermissions = localPermissions.filter((p) => p.class === className);
      const allSelected = classPermissions.every((p) =>
        selectedPermissionsForNewRole.includes(p.permissionID)
      );
      setSelectedPermissionsForNewRole((prev) =>
        allSelected
          ? prev.filter(
            (id) => !classPermissions.some((cp) => cp.permissionID === id)
          )
          : [
            ...prev,
            ...classPermissions
              .filter((p) => !prev.includes(p.permissionID))
              .map((p) => p.permissionID),
          ]
      );
    },
    [userPermissions.canAssignPermissions, localPermissions, selectedPermissionsForNewRole]
  );

  // Handle Permission Toggle
  const handleTogglePermission = useCallback(
    (permission: Permission) => {
      if (!userPermissions.canAssignPermissions) return;
      setSelectedPermissionsForNewRole((prev) =>
        prev.includes(permission.permissionID)
          ? prev.filter((id) => id !== permission.permissionID)
          : [...prev, permission.permissionID]
      );
    },
    [userPermissions.canAssignPermissions]
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
    if (trimmed.length < 2) return "Role name must be at least 2 characters";
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
                {Array.from({ length: 2 }).map((_, j) => (
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
      <InfoPopup
        isOpen={!!activePermissionPopup}
        onClose={() => setActivePermissionPopup(null)}
        contentRenderer={() => {
          const permission = localPermissions.find(
            (p) => p.permissionID === activePermissionPopup
          );
          return permission ? (
            <>
              <h4>{permission.name}</h4>
              <p>
                <strong>Class:</strong> {permission.class}
              </p>
              <p>
                <strong>Description:</strong>{" "}
                {permission.description || "No description available"}
              </p>
            </>
          ) : (
            <p>Permission not found</p>
          );
        }}
      />
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
                className={`user-edit-input ${roleTouched.name && roleFormErrors.name ? "invalid-vibrate" : ""}`}
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
                className={`user-edit-input ${roleTouched.description && roleFormErrors.description ? "invalid-vibrate" : ""}`}
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
                        {categorizedPermissions.map(({ className }) => (
                          <option key={className} value={className}>
                            {className}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="permissions-list">
                  {filteredPermissions.map(({ className, actions }) => (
                    <div key={className} className="permission-class">
                      <div className="permission-class-header">
                        <h4>{className}</h4>
                        <button
                          className="toggle-all-button"
                          onClick={() => handleToggleAllPermissionsInClass(className)}
                          disabled={loading}
                          aria-label={`Toggle all permissions for ${className}`}
                        >
                          {localPermissions
                            .filter((p) => p.class === className)
                            .every((p) =>
                              selectedPermissionsForNewRole.includes(p.permissionID)
                            )
                            ? "Deselect All"
                            : "Select All"}
                        </button>
                      </div>
                      {Object.entries(actions).map(([action, permissions]) =>
                        permissions.length > 0 ? (
                          <div key={action} className="permission-action">
                            <div
                              className="permission-action-header"
                              onClick={() => toggleActionExpansion(className, action)}
                              style={{ cursor: "pointer" }}
                            >
                              <h5>
                                {action} ({permissions.length})
                                <motion.span
                                  animate={{
                                    rotate: expandedActions[`${className}-${action}`.toLowerCase().replace(/\s+/g, '-')]
                                      ? 180
                                      : 0,
                                  }}
                                  transition={{ duration: 0.3, ease: "easeInOut" }}
                                >
                                  {expandedActions[`${className}-${action}`.toLowerCase().replace(/\s+/g, '-')] ? (
                                    <FaChevronUp />
                                  ) : (
                                    <FaChevronDown />
                                  )}
                                </motion.span>
                              </h5>
                              <button
                                className="toggle-all-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleAllPermissionsInAction(className, action);
                                }}
                                disabled={loading}
                              >
                                {permissions.every((p) =>
                                  selectedPermissionsForNewRole.includes(p.permissionID)
                                )
                                  ? "Deselect All"
                                  : "Select All"}
                              </button>
                            </div>
                            <AnimatePresence>
                              {expandedActions[`${className}-${action}`.toLowerCase().replace(/\s+/g, '-')] && (
                                <motion.div
                                  className="permissions-container"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3, ease: "easeInOut" }}
                                >
                                  {permissions.map((perm, index) => (
                                    <motion.button
                                      key={perm.permissionID}
                                      className={`permission-button ${selectedPermissionsForNewRole.includes(perm.permissionID)
                                        ? "assigned"
                                        : ""
                                        }`}
                                      onClick={() => handleTogglePermission(perm)}
                                      disabled={loading}
                                      initial={{ opacity: 0, y: -10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: index * 0.05, duration: 0.2 }}
                                    >
                                      <span>{perm.name}</span>
                                      <FaInfoCircle
                                        className="permission-info-icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActivePermissionPopup(perm.permissionID);
                                        }}
                                        aria-label={`View details for ${perm.name}`}
                                      />
                                    </motion.button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ) : null
                      )}
                    </div>
                  ))}
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