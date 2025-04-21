/**
 * RolesList.tsx
 * Component for displaying a categorized list of roles with toggleable RoleView under each role.
 * Optimized with memoization, debouncing, and caching for performance.
 * Uses role.permissions from getAllRoles for permission counts and InfoPopup, eliminating getPermissionsByRole calls.
 * Removed getAllPermissions fetch, as it's now handled in RoleView.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaAngleDown, FaInfoCircle } from "react-icons/fa";
import { AnimatePresence, motion } from "framer-motion";
import { debounce } from "lodash";

// Context
import { useAuth } from "../../../context/AuthContext";

// Models
import Permission from "../../../models/Permission";
import Role from "../../../models/Role";

// Components
import InfoPopup from "../InfoPopup";
import RoleView from "./roles_view";

// Styles
import "../AdminDashboard.css";
import PermissionsClass from "models/Enum/PermissionsClass";

// Props interface
interface RolesListProps {
  roles: Role[];
  setRoles: (roles: Role[]) => void;
  userRoles: Role[];
  view: string;
  setView: (view: string) => void;
  setSelectedRole: (role: Role | null) => void;
  setError: (error: string | null) => void;
  searchQuery: string;
}

// Constants
const SKELETON_DELAY = 500; // Delay skeleton visibility for 0.5 seconds
const SKELETON_ROLES_PER_CATEGORY = [2, 5, 0]; // Fixed, Pre-made, Custom role counts

// Animation variants
const viewVariants = {
  hidden: { height: 0, opacity: 0, marginTop: 0, overflow: "hidden" },
  visible: { height: "auto", opacity: 1, marginTop: 10, overflow: "visible" },
  exit: { height: 0, opacity: 0, marginTop: 0, overflow: "hidden" },
};

// RolesList component, memoized
const RolesList: React.FC<RolesListProps> = React.memo(
  ({ roles, setRoles, userRoles, view, setSelectedRole, setError, searchQuery }) => {
    // Auth context
    const { effectivePermissions } = useAuth();

    // State declarations
    const [activeRolePopup, setActiveRolePopup] = useState<string | null>(null);
    const [confirmation, setConfirmation] = useState<{
      message: string;
      onConfirm: () => void;
    } | null>(null);
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
    const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
    const [loading, setLoading] = useState(true);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null); // Track toggled role


    // Memoized permissions object
    const userPermissions = useMemo(
      () => ({
        canUpdateRoles: effectivePermissions?.some(
          (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_ROLES
        ),
        canViewRoles: effectivePermissions?.some(
          (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_ROLES
        ),
      }),
      [effectivePermissions]
    );

    // Memoized super admin check
    const isSuperAdmin = useMemo(
      () => userRoles?.some((r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN),
      [userRoles]
    );

    // Debounced search query setter
    const debouncedSetSearchQuery = useCallback(
      debounce((value: string) => setInternalSearchQuery(value), 300),
      []
    );

    // Sync search query
    useEffect(() => {
      debouncedSetSearchQuery(searchQuery);
      return () => debouncedSetSearchQuery.cancel();
    }, [searchQuery, debouncedSetSearchQuery]);

    // Simulate delayed loading for skeleton
    useEffect(() => {
      const timer = setTimeout(() => setLoading(false), SKELETON_DELAY);
      return () => clearTimeout(timer);
    }, []);

    // Memoized filtered roles
    const filteredRoles = useMemo(() => {
      return roles.filter(
        (role) =>
          role.name.toLowerCase().includes(internalSearchQuery.toLowerCase()) ||
          role.description?.toLowerCase().includes(internalSearchQuery.toLowerCase())
      );
    }, [roles, internalSearchQuery]);

    // Handle role toggle
    const handleRoleToggle = useCallback(
      (role: Role) => {
        if (!userPermissions.canUpdateRoles) {
          return;
        }
        if (!isSuperAdmin && role.name === "Admin") {
          setError("Only Super Admins can modify the Admin role.");
          return;
        }
        if (role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN) {
          setError("The Super Admin role cannot be modified.");
          return;
        }
        const fixedRoles = [
          "Manager",
          "Supervisor",
          "Purchase Team",
          "Regional Manager",
          "Stock Manager",
        ];
        if (fixedRoles.includes(role.name)) {
          setConfirmation({
            message:
              "Warning: Modifying pre-made roles may affect system functionality. Are you sure you want to proceed?",
            onConfirm: () => {
              setSelectedRoleId((prev) => {
                const newId = prev === role.roleID ? null : role.roleID;
                return newId;
              });
              setSelectedRole(role);
            },
          });
          return;
        }
        setSelectedRoleId((prev) => {
          const newId = prev === role.roleID ? null : role.roleID;
          return newId;
        });
        setSelectedRole(role);
      },
      [isSuperAdmin, userPermissions.canUpdateRoles, setError, setSelectedRole]
    );

    // Toggle permission class expansion
    const toggleClassExpansion = useCallback((className: string) => {
      setExpandedClasses((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(className)) newSet.delete(className);
        else newSet.add(className);
        return newSet;
      });
    }, []);

    // Categorize permissions by class
    const getCategorizedPermissionsForRole = useCallback(
      (permissions: Permission[] | undefined) => {
        const byClass: { [key: string]: Permission[] } = {};
        if (!permissions || permissions.length === 0) {
          return byClass;
        }
        permissions
          .filter((perm) => isSuperAdmin || !["Role", "Permission"].includes(perm.class || ""))
          .forEach((perm) => {
            const classMatch = perm.description?.match(/Class: (\w+)/);
            const className = classMatch ? classMatch[1] : "Unknown";
            const formattedName = perm.name
              .replace(/_/g, " ")
              .replace(/\b\w/g, (char) => char.toUpperCase());
            if (!byClass[className]) byClass[className] = [];
            byClass[className].push({ ...perm, name: formattedName, class: className as PermissionsClass });
          });
        return byClass;
      },
      [isSuperAdmin]
    );

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
      <div className="roles-management" aria-busy="true">
        {["Fixed Roles", "Pre-made Roles", "Custom Roles"].map((category, index) => (
          <div key={category} className="role-category-section">
            <h2 className="role-category-header">
              <div className="custom-skeleton pulsing" style={{ width: "120px" }} />
            </h2>
            <div className="roles-grid">
              {Array.from({ length: SKELETON_ROLES_PER_CATEGORY[index] }).map((_, i) => (
                <div key={i} className={`role-card ${index === 0 ? "fix" : index === 1 ? "premade" : ""}`}>
                  <div className="role-card-header">
                    <div className="custom-skeleton pulsing" style={{ width: "60%" }} />
                  </div>
                  <div className="custom-skeleton pulsing" style={{ width: "40%" }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );

    // Return null if not in roles view or no permission
    if (view !== "roles" || !userPermissions.canViewRoles) {
      return null;
    }

    // Render UI
    return (
      <div className="roles-management">
        {loading && renderSkeleton()}
        {!loading && (
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
              isOpen={!!activeRolePopup}
              onClose={() => {
                setActiveRolePopup(null);
                setExpandedClasses(new Set());
              }}
              contentRenderer={() => {
                const role = roles.find((role) => role.roleID === activeRolePopup);
                if (!role) return <p>Role not found</p>;
                return (
                  <>
                    <h4>{role.name}</h4>
                    <p>{role.description || "No description available"}</p>
                    <h5>Permissions by Class:</h5>
                    {Object.entries(getCategorizedPermissionsForRole(role.Permissions)).length > 0 ? (
                      Object.entries(getCategorizedPermissionsForRole(role.Permissions)).map(
                        ([className, perms]) => (
                          <div key={className} className="permission-class-item">
                            <button
                              className="class-toggle"
                              onClick={() => toggleClassExpansion(className)}
                            >
                              {className} ({perms.length})
                              <FaAngleDown
                                className={`toggle-icon ${expandedClasses.has(className) ? "expanded" : ""}`}
                              />
                            </button>
                            <ul
                              className={`permission-list ${expandedClasses.has(className) ? "expanded" : ""}`}
                            >
                              {perms.map((perm) => (
                                <li key={perm.permissionID}>{perm.name}</li>
                              ))}
                            </ul>
                          </div>
                        )
                      )
                    ) : (
                      <p>No permissions assigned</p>
                    )}
                  </>
                );
              }}
            />
            {(() => {
              const fixedRoles = filteredRoles.filter((role) =>
                ["Admin", import.meta.env.VITE_ROLES_SUPER_ADMIN].includes(role.name)
              );
              return (
                fixedRoles.length > 0 && (
                  <div className="role-category-section">
                    <h2 className="role-category-header">Fixed Roles</h2>
                    <div className="roles-grid">
                      {fixedRoles.map((role) => (
                        <div
                          key={role.roleID}
                          className="role-card fix"
                          onClick={() => handleRoleToggle(role)}
                          aria-expanded={selectedRoleId === role.roleID}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              handleRoleToggle(role);
                            }
                          }}
                        >
                          <div className="role-card-header">
                            <h3>{role.name}</h3>
                            <FaInfoCircle
                              className="role-info-icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveRolePopup(role.roleID);
                              }}
                              aria-label={`View details for ${role.name}`}
                            />
                          </div>
                          <span className="permission-count">
                            {`${role.Permissions?.length || 0} Permissions`}
                          </span>
                        </div>
                      ))}
                    </div>
                    <AnimatePresence>
                      {fixedRoles.some((role) => role.roleID === selectedRoleId) && (
                        <motion.div
                          className="role-view-container"
                          variants={viewVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={{ duration: 0.3 }}
                        >
                          <RoleView
                            selectedRole={roles.find((r) => r.roleID === selectedRoleId) || null}
                            setSelectedRole={setSelectedRole}
                            roles={roles}
                            setRoles={setRoles}
                            userRoles={userRoles}
                            setError={setError}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              );
            })()}
            {(() => {
              const premadeRoles = filteredRoles.filter((role) =>
                ["Manager", "Supervisor", "Purchase Team", "Regional Manager", "Stock Manager"].includes(
                  role.name
                )
              );
              return (
                premadeRoles.length > 0 && (
                  <div className="role-category-section">
                    <h2 className="role-category-header">Pre-made Roles</h2>
                    <div className="roles-grid">
                      {premadeRoles.map((role) => (
                        <div
                          key={role.roleID}
                          className="role-card premade"
                          onClick={() => handleRoleToggle(role)}
                          aria-expanded={selectedRoleId === role.roleID}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              handleRoleToggle(role);
                            }
                          }}
                        >
                          <div className="role-card-header">
                            <h3>{role.name}</h3>
                            <FaInfoCircle
                              className="role-info-icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveRolePopup(role.roleID);
                              }}
                              aria-label={`View details for ${role.name}`}
                            />
                          </div>
                          <span className="permission-count">
                            {`${role.Permissions?.length || 0} Permissions`}
                          </span>
                        </div>
                      ))}
                    </div>
                    <AnimatePresence>
                      {premadeRoles.some((role) => role.roleID === selectedRoleId) && (
                        <motion.div
                          className="role-view-container"
                          variants={viewVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={{ duration: 0.3 }}
                        >
                          <RoleView
                            selectedRole={roles.find((r) => r.roleID === selectedRoleId) || null}
                            setSelectedRole={setSelectedRole}
                            roles={roles}
                            setRoles={setRoles}
                            userRoles={userRoles}
                            setError={setError}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              );
            })()}
            {(() => {
              const customRoles = filteredRoles.filter(
                (role) =>
                  ![
                    "Admin",
                    import.meta.env.VITE_ROLES_SUPER_ADMIN,
                    "Manager",
                    "Supervisor",
                    "Purchase Team",
                    "Regional Manager",
                    "Stock Manager",
                  ].includes(role.name)
              );
              return (
                customRoles.length > 0 && (
                  <div className="role-category-section">
                    <h2 className="role-category-header">Custom Roles</h2>
                    <div className="roles-grid">
                      {customRoles.map((role) => (
                        <div
                          key={role.roleID}
                          className="role-card"
                          onClick={() => handleRoleToggle(role)}
                          aria-expanded={selectedRoleId === role.roleID}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              handleRoleToggle(role);
                            }
                          }}
                        >
                          <div className="role-card-header">
                            <h3>{role.name}</h3>
                            <FaInfoCircle
                              className="role-info-icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveRolePopup(role.roleID);
                              }}
                              aria-label={`View details for ${role.name}`}
                            />
                          </div>
                          <span className="permission-count">
                            {`${role.Permissions?.length || 0} Permissions`}
                          </span>
                        </div>
                      ))}
                    </div>
                    <AnimatePresence>
                      {customRoles.some((role) => role.roleID === selectedRoleId) && (
                        <motion.div
                          className="role-view-container"
                          variants={viewVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={{ duration: 0.3 }}
                        >
                          <RoleView
                            selectedRole={roles.find((r) => r.roleID === selectedRoleId) || null}
                            setSelectedRole={setSelectedRole}
                            roles={roles}
                            setRoles={setRoles}
                            userRoles={userRoles}
                            setError={setError}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              );
            })()}
          </>
        )}
      </div>
    );
  }
);

export default RolesList;