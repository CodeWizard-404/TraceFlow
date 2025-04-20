/**
 * RoleView.tsx
 * Component for viewing and editing a selected role's details and permissions.
 * Optimized with memoization, skeleton loader, and efficient state management.
 * Fetches all permissions using getAllPermissions and role-specific permissions using getPermissionsByRole.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaEdit, FaInfoCircle, FaTrash } from "react-icons/fa";
import { debounce } from "lodash";

// Context and APIs
import { useAuth } from "../../../context/AuthContext";
import { assignPermissionsToRole, revokePermissionsFromRole, getPermissionsByRole, getAllPermissions } from "../../../apis/permissionAPI";
import { deleteRole, updateRole } from "../../../apis/roleAPI";

// Models
import Permission from "../../../models/Permission";
import Role from "../../../models/Role";

// Components
import InfoPopup from "../InfoPopup";

// Styles
import "../AdminDashboard.css";

// Props interface
interface RoleViewProps {
  selectedRole: Role | null;
  setSelectedRole: (role: Role | null) => void;
  roles: Role[];
  setRoles: (roles: Role[]) => void;
  userRoles: Role[];
  setError: (error: string | null) => void;
}

// Constants
const SKELETON_DELAY = 500; // Delay skeleton visibility for 0.5 seconds

// RoleView component, memoized
const RoleView: React.FC<RoleViewProps> = React.memo(
  ({ selectedRole, setSelectedRole, roles, setRoles, userRoles, setError }) => {
    // Auth context
    const { effectivePermissions } = useAuth();

    // State declarations
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [activePermissionPopup, setActivePermissionPopup] = useState<string | null>(null);
    const [confirmation, setConfirmation] = useState<{
      message: string;
      onConfirm: () => void;
    } | null>(null);
    const [editedRole, setEditedRole] = useState<Partial<Role>>({});
    const [isEditingRole, setIsEditingRole] = useState(false);
    const [loading, setLoading] = useState(true);
    const [permissionsLoading, setPermissionsLoading] = useState(false);
    const [permissionSearch, setPermissionSearch] = useState("");
    const [roleFormErrors, setRoleFormErrors] = useState({ name: "", description: "" });
    const [roleTouched, setRoleTouched] = useState({ name: false, description: false });
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [tempPermissions, setTempPermissions] = useState<Permission[]>([]);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Debug log for rendering
    useEffect(() => {
      console.log("RoleView render attempt", {
        selectedRoleId: selectedRole?.roleID,
        roleName: selectedRole?.name,
        allPermissionsLength: allPermissions.length,
        tempPermissionsLength: tempPermissions.length,
        tempPermissions: tempPermissions.map(p => ({ id: p.permissionID, name: p.name })),
        canViewRoleDetails: userPermissions.canViewRoleDetails,
        isRendering: !!selectedRole && userPermissions.canViewRoleDetails,
      });
    }, [selectedRole, allPermissions, tempPermissions, effectivePermissions]);

    // Memoized permissions object
    const userPermissions = useMemo(
      () => ({
        canAssignPermissions: effectivePermissions?.some(
          (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_PERMISSIONS
        ),
        canDeleteRoles: effectivePermissions?.some(
          (p) => p.name === import.meta.env.VITE_PERMISSIONS_DELETE_ROLES
        ),
        canReadPermissionsByRole: effectivePermissions?.some(
          (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS_BY_ROLE
        ),
        canUpdateRoles: effectivePermissions?.some(
          (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_ROLES
        ),
        canViewRoleDetails: effectivePermissions?.some(
          (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_ROLE_DETAILS
        ),
      }),
      [effectivePermissions]
    );

    // Memoized super admin check
    const isSuperAdmin = useMemo(
      () => userRoles?.some((r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN),
      [userRoles]
    );

    // Restricted roles
    const restrictedRoles = useMemo(
      () => [
        import.meta.env.VITE_ROLES_SUPER_ADMIN,
        import.meta.env.VITE_ROLES_ADMIN,
        import.meta.env.VITE_ROLES_MANAGER,
        import.meta.env.VITE_ROLES_SUPERVISOR,
        import.meta.env.VITE_ROLES_PURCHASE_TEAM,
        import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
        import.meta.env.VITE_ROLES_STOCK_MANAGER,
      ],
      []
    );

    const isRestrictedRole = useMemo(
      () => (selectedRole ? restrictedRoles.includes(selectedRole.name) : false),
      [selectedRole, restrictedRoles]
    );

    // Debounced search handler
    const debouncedSetPermissionSearch = useCallback(
      debounce((value: string) => setPermissionSearch(value), 300),
      []
    );

    // Fetch all permissions
    useEffect(() => {
      if (allPermissions.length > 0) return; // Prevent redundant fetches
      const fetchAllPermissions = async () => {
        try {
          const permissions = await getAllPermissions();
          setAllPermissions(permissions || []);
          console.log("Fetched all permissions in RoleView", { permissionsLength: permissions?.length });
        } catch (error: unknown) {
          console.error("Failed to fetch all permissions:", error);
          setError("Failed to load permissions.");
        }
      };
      fetchAllPermissions();
    }, [setError, allPermissions.length]);

    // Fetch role permissions
    useEffect(() => {
      if (selectedRole && userPermissions.canReadPermissionsByRole) {
        const fetchRolePermissions = async () => {
          setPermissionsLoading(true);
          try {
            const permissions = await getPermissionsByRole(selectedRole.roleID);
            console.log("Fetched role permissions", {
              roleId: selectedRole.roleID,
              permissionsLength: permissions?.length,
              permissions: permissions?.map(p => ({ id: p.permissionID, name: p.name })),
            });
            setTempPermissions(permissions || []);
          } catch (error: unknown) {
            console.error("Failed to fetch role permissions:", error);
            setError("Failed to load role permissions.");
            setTempPermissions([]);
          } finally {
            setPermissionsLoading(false);
          }
        };
        fetchRolePermissions();
      } else {
        setTempPermissions([]);
      }
    }, [selectedRole, userPermissions.canReadPermissionsByRole, setError]);

    // Simulate delayed loading for skeleton
    useEffect(() => {
      const timer = setTimeout(() => {
        if (allPermissions.length > 0 && !permissionsLoading) {
          setLoading(false);
        }
      }, SKELETON_DELAY);
      return () => clearTimeout(timer);
    }, [allPermissions.length, permissionsLoading]);

    // Computed permissions
    const categorizedPermissions = useMemo(() => {
      return Object.entries(
        allPermissions
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
    }, [allPermissions, isSuperAdmin]);

    const filteredPermissions = useMemo(() => {
      let result = allPermissions.filter(
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
      return result.reduce((acc: { [key: string]: Permission[] }, perm) => {
        const formattedName = perm.name
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
        if (!acc[perm.class]) acc[perm.class] = [];
        acc[perm.class].push({ ...perm, name: formattedName });
        return acc;
      }, {});
    }, [allPermissions, permissionSearch, selectedCategory, isSuperAdmin]);

    // Validation functions
    const validateRoleName = useCallback((value: string): string => {
      const trimmed = value.trim();
      if (!trimmed) return "Role name is required";
      if (trimmed.length < 3) return "Role name must be at least 3 characters";
      if (trimmed.length > 50) return "Role name must be 50 characters or less";
      if (!/^[A-Za-z0-9\s-_]+$/.test(trimmed))
        return "Role name can only contain letters, numbers, spaces, hyphens, or underscores";
      return "";
    }, []);

    const validateRoleDescription = useCallback((value: string): string => {
      const trimmed = value.trim();
      if (trimmed.length > 150) return "Description must be 150 characters or less";
      return "";
    }, []);

    // Handle role edit
    const handleEditRole = useCallback(() => {
      if (!selectedRole || !userPermissions.canUpdateRoles) return;
      if (selectedRole.name === import.meta.env.VITE_ROLES_SUPER_ADMIN) {
        setError("The Super Admin role cannot be modified.");
        return;
      }
      if (!isSuperAdmin && selectedRole.name === import.meta.env.VITE_ROLES_ADMIN) {
        setError("Only Super Admins can modify the Admin role.");
        return;
      }
      if (isRestrictedRole) {
        setConfirmation({
          message:
            "Warning: Modifying pre-made roles may affect system functionality. Are you sure you want to proceed?",
          onConfirm: () => {
            setIsEditingRole(true);
            setEditedRole({
              name: selectedRole.name,
              description: selectedRole.description,
            });
          },
        });
        return;
      }
      setIsEditingRole(true);
      setEditedRole({
        name: selectedRole.name,
        description: selectedRole.description,
      });
    }, [selectedRole, userPermissions.canUpdateRoles, isSuperAdmin, isRestrictedRole, setError]);

    // Handle save role edit
    const handleSaveRoleEdit = useCallback(async () => {
      if (!selectedRole || !userPermissions.canUpdateRoles || !isEditingRole) return;

      const errors = {
        name: validateRoleName(editedRole.name || ""),
        description: validateRoleDescription(editedRole.description || ""),
      };

      setRoleFormErrors(errors);
      if (Object.values(errors).some((error) => error)) {
        setError("Please correct the errors before saving.");
        return;
      }

      setLoading(true);
      try {
        const updatedRole = await updateRole(selectedRole.roleID, {
          name: editedRole.name!.trim(),
          description: editedRole.description?.trim(),
        });
        const permissionChanges = {
          toAdd: tempPermissions
            .filter(
              (perm) => !selectedRole.Permissions?.some((p) => p.permissionID === perm.permissionID)
            )
            .map((perm) => perm.permissionID),
          toRemove: selectedRole.Permissions
            ?.filter(
              (perm) => !tempPermissions.some((p) => p.permissionID === perm.permissionID)
            )
            .map((perm) => perm.permissionID),
        };

        if (permissionChanges.toAdd.length > 0) {
          await assignPermissionsToRole(selectedRole.roleID, permissionChanges.toAdd);
        }
        if (permissionChanges.toRemove!.length > 0) {
          await revokePermissionsFromRole(selectedRole.roleID, permissionChanges.toRemove!);
        }

        const updatedRoleWithPermissions = {
          ...updatedRole,
          Permissions: tempPermissions, // Note: Ensure backend returns Permissions or adjust accordingly
        };

        setRoles(
          roles.map((r) => (r.roleID === selectedRole.roleID ? updatedRoleWithPermissions : r))
        );
        setSelectedRole(updatedRoleWithPermissions);
        setIsEditingRole(false);
        setEditedRole({});
        setRoleFormErrors({ name: "", description: "" });
        setRoleTouched({ name: false, description: false });
        setHasUnsavedChanges(false);
        setError(null);
      } catch (error: unknown) {
        console.error("Failed to update role:", error);
        setError("Failed to update role or permissions.");
      } finally {
        setLoading(false);
      }
    }, [
      selectedRole,
      userPermissions.canUpdateRoles,
      isEditingRole,
      editedRole,
      tempPermissions,
      roles,
      setRoles,
      setSelectedRole,
      setError,
      validateRoleName,
      validateRoleDescription,
    ]);

    // Handle delete role
    const handleDeleteRole = useCallback(() => {
      if (!selectedRole || !userPermissions.canDeleteRoles) return;
      if (isRestrictedRole) {
        setError("Restricted roles cannot be deleted.");
        return;
      }
      setConfirmation({
        message: `Are you sure you want to delete the role "${selectedRole.name}"?`,
        onConfirm: async () => {
          setLoading(true);
          try {
            await deleteRole(selectedRole.roleID);
            setRoles(roles.filter((r) => r.roleID !== selectedRole.roleID));
            setSelectedRole(null);
            setError(null);
          } catch (error: unknown) {
            console.error("Failed to delete role:", error);
            setError("Failed to delete role.");
          } finally {
            setLoading(false);
          }
        },
      });
    }, [selectedRole, userPermissions.canDeleteRoles, isRestrictedRole, roles, setRoles, setSelectedRole, setError]);

    // Handle permission toggle
    const handleTogglePermission = useCallback(
      (permission: Permission) => {
        if (!userPermissions.canAssignPermissions) return;
        setTempPermissions((prev) => {
          const isAssigned = prev.some((p) => p.permissionID === permission.permissionID);
          const newPermissions = isAssigned
            ? prev.filter((p) => p.permissionID !== permission.permissionID)
            : [...prev, permission];
          console.log("Toggled permission", {
            permissionId: permission.permissionID,
            permissionName: permission.name,
            isAssigned,
            newPermissionsLength: newPermissions.length,
          });
          return newPermissions;
        });
        setHasUnsavedChanges(true);
      },
      [userPermissions.canAssignPermissions]
    );

    // Handle toggle all permissions in class
    const handleToggleAllPermissionsInClass = useCallback(
      (className: string) => {
        if (!userPermissions.canAssignPermissions) return;
        const classPermissions = allPermissions.filter((p) => p.class === className);
        const allSelected = classPermissions.every((p) =>
          tempPermissions.some((tp) => tp.permissionID === p.permissionID)
        );
        const newPermissions = allSelected
          ? tempPermissions.filter(
            (p) => !classPermissions.some((cp) => cp.permissionID === p.permissionID)
          )
          : [
            ...tempPermissions,
            ...classPermissions.filter(
              (p) => !tempPermissions.some((tp) => tp.permissionID === p.permissionID)
            ),
          ];
        setTempPermissions(newPermissions);
        setHasUnsavedChanges(true);
        console.log("Toggled all permissions in class", {
          className,
          allSelected,
          newPermissionsLength: newPermissions.length,
        });
      },
      [userPermissions.canAssignPermissions, allPermissions, tempPermissions]
    );

    // Handle save permissions
    const handleSavePermissions = useCallback(async () => {
      if (!selectedRole || !userPermissions.canAssignPermissions) return;
      setLoading(true);
      try {
        const currentPermissionIds = (await getPermissionsByRole(selectedRole.roleID))?.map((p) => p.permissionID) || [];
        const newPermissionIds = tempPermissions.map((p) => p.permissionID);
        const toAdd = newPermissionIds.filter((id) => !currentPermissionIds.includes(id));
        const toRemove = currentPermissionIds.filter((id) => !newPermissionIds.includes(id));

        if (toAdd.length > 0) {
          await assignPermissionsToRole(selectedRole.roleID, toAdd);
        }
        if (toRemove.length > 0) {
          await revokePermissionsFromRole(selectedRole.roleID, toRemove);
        }

        const updatedRole = { ...selectedRole, Permissions: tempPermissions };
        setRoles(roles.map((r) => (r.roleID === selectedRole.roleID ? updatedRole : r)));
        setSelectedRole(updatedRole);
        setHasUnsavedChanges(false);
        setError(null);
        console.log("Saved permissions", { toAdd, toRemove });
      } catch (error: unknown) {
        console.error("Failed to save permissions:", error);
        setTempPermissions((await getPermissionsByRole(selectedRole.roleID)) || []);
        setError("Failed to save permissions.");
      } finally {
        setLoading(false);
      }
    }, [
      selectedRole,
      userPermissions.canAssignPermissions,
      tempPermissions,
      roles,
      setRoles,
      setSelectedRole,
      setError,
    ]);

    // Confirmation modal component
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

    // Render skeleton loader
    const renderSkeleton = () => (
      <div aria-busy="true">
        <div className="card-header">
          <div className="custom-skeleton pulsing" style={{ width: "200px", height: "24px" }} />
          <div className="role-actions">
            <div className="custom-skeleton pulsing" style={{ width: "60px", height: "32px" }} />
            <div className="custom-skeleton pulsing" style={{ width: "32px", height: "32px" }} />
          </div>
        </div>
        <div className="custom-skeleton pulsing" style={{ width: "150px", height: "16px", marginTop: "10px" }} />
        <div className="permissions-filter-section">
          <div className="custom-skeleton pulsing" style={{ width: "100px", height: "16px" }} />
          <div className="permissions-filter-controls">
            <div className="custom-skeleton pulsing" style={{ width: "150px", height: "32px" }} />
            <div className="custom-skeleton pulsing" style={{ width: "100px", height: "32px" }} />
          </div>
        </div>
        <div className="permissions-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="permission-class-section">
              <div className="custom-skeleton pulsing" style={{ width: "120px", height: "20px" }} />
              <div className="permission-class-grid">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="permission-card">
                    <div className="custom-skeleton pulsing" style={{ width: "80%", height: "16px" }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    // Check rendering conditions
    if (!selectedRole || !userPermissions.canViewRoleDetails) {
      console.log("RoleView not rendered", {
        selectedRoleExists: !!selectedRole,
        canViewRoleDetails: userPermissions.canViewRoleDetails,
      });
      return null;
    }

    // Render UI
    return (
      <div className="details-card">
        {(loading || permissionsLoading) && renderSkeleton()}
        {!(loading || permissionsLoading) && (
          <>
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
            <InfoPopup
              isOpen={!!activePermissionPopup}
              onClose={() => setActivePermissionPopup(null)}
              contentRenderer={() => {
                const permission = allPermissions.find(
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
            <div className="card-header">
              {isEditingRole ? (
                <div className="role-edit-form">
                  <div className="role-edit-header">
                    <h2>Edit Role</h2>
                  </div>
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      value={editedRole.name || ""}
                      onChange={(e) => {
                        setEditedRole({ ...editedRole, name: e.target.value });
                        setRoleFormErrors({
                          ...roleFormErrors,
                          name: validateRoleName(e.target.value),
                        });
                      }}
                      onBlur={() => setRoleTouched({ ...roleTouched, name: true })}
                      className={`role-edit-input ${roleTouched.name && roleFormErrors.name ? "invalid-vibrate" : ""}`}
                      required
                      aria-invalid={roleTouched.name && !!roleFormErrors.name}
                      disabled={isRestrictedRole}
                    />
                    {roleFormErrors.name && roleTouched.name && (
                      <span className="error-text">{roleFormErrors.name}</span>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={editedRole.description || ""}
                      onChange={(e) => {
                        setEditedRole({ ...editedRole, description: e.target.value });
                        setRoleFormErrors({
                          ...roleFormErrors,
                          description: validateRoleDescription(e.target.value),
                        });
                      }}
                      onBlur={() => setRoleTouched({ ...roleTouched, description: true })}
                      placeholder="Role Description"
                      className={`role-edit-textarea ${roleTouched.description && roleFormErrors.description ? "invalid-vibrate" : ""}`}
                      aria-invalid={roleTouched.description && !!roleFormErrors.description}
                    />
                    {roleFormErrors.description && roleTouched.description && (
                      <span className="error-text">{roleFormErrors.description}</span>
                    )}
                  </div>
                  <div className="role-edit-actions">
                    <button
                      className="action-button"
                      onClick={handleSaveRoleEdit}
                      disabled={loading}
                      aria-busy={loading ? "true" : "false"}
                    >
                      {loading ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="cancel-button"
                      onClick={async () => {
                        setIsEditingRole(false);
                        setEditedRole({});
                        setTempPermissions((await getPermissionsByRole(selectedRole.roleID)) || []);
                        setHasUnsavedChanges(false);
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2>{selectedRole.name}</h2>
                  <div className="role-actions">
                    {userPermissions.canUpdateRoles && (
                      <button
                        className="edit-button"
                        onClick={handleEditRole}
                        disabled={loading}
                        aria-label="Edit role"
                      >
                        <FaEdit /> Edit
                      </button>
                    )}
                    {userPermissions.canDeleteRoles && !isRestrictedRole && (
                      <button
                        className="delete-button"
                        onClick={handleDeleteRole}
                        disabled={loading}
                        aria-label="Delete role"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            {!isEditingRole && (
              <>
                <p>Description: {selectedRole.description || "No description"}</p>
                {userPermissions.canReadPermissionsByRole && (
                  <>
                    <div className="permissions-filter-section">
                      <label>Filter Permissions</label>
                      <div className="permissions-filter-controls">
                        <div className="permissions-search">
                          <input
                            type="text"
                            placeholder="Search permissions..."
                            value={permissionSearch}
                            onChange={(e) => debouncedSetPermissionSearch(e.target.value)}
                            className="search-input"
                            aria-label="Search permissions"
                            disabled={loading}
                          />
                        </div>
                        <div className="permissions-category">
                          <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            aria-label="Filter by permission class"
                            disabled={loading}
                          >
                            <option value="all">All Classes</option>
                            {categorizedPermissions.map(([className]) => (
                              <option key={className} value={className}>
                                {className}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <h3>Permissions</h3>
                    <div className="permissions-list">
                      {Object.entries(filteredPermissions).map(([className, permissions]) => (
                        <div key={className} className="permission-class">
                          <div className="permission-class-header">
                            <h4>{className}</h4>
                            {userPermissions.canAssignPermissions && (
                              <button
                                className="toggle-all-button"
                                onClick={() => handleToggleAllPermissionsInClass(className)}
                                disabled={loading}
                              >
                                {allPermissions
                                  .filter((p) => p.class === className)
                                  .every((p) =>
                                    tempPermissions.some((tp) => tp.permissionID === p.permissionID)
                                  )
                                  ? "Deselect All"
                                  : "Select All"}
                              </button>
                            )}
                          </div>
                          <div className="permissions-container">
                            {permissions.length > 0 ? (
                              permissions.map((perm) => (
                                <button
                                  key={perm.permissionID}
                                  className={`permission-button ${tempPermissions.some((p) => p.permissionID === perm.permissionID)
                                    ? "assigned"
                                    : ""
                                    }`}
                                  onClick={() => handleTogglePermission(perm)}
                                  disabled={loading || !userPermissions.canAssignPermissions}
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
                                </button>
                              ))
                            ) : (
                              <p>No permissions available</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {hasUnsavedChanges && userPermissions.canAssignPermissions && (
                      <button
                        className="action-button"
                        onClick={handleSavePermissions}
                        disabled={loading}
                      >
                        {loading ? "Saving..." : "Save Changes"}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    );
  }
);

export default RoleView;