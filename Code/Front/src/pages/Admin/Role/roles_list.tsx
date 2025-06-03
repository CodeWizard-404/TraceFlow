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
import PermissionsClass from "../../../models/Enum/PermissionsClass";
import { useTranslation } from "react-i18next";

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
  setConfirmation: (confirmation: {
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null) => void;
}

// Constants
const SKELETON_ROLES_PER_CATEGORY = [2, 5, 0]; // Fixed, Pre-made, Custom role counts

const ROLES = {
  SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
  REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
  DIRECTOR: import.meta.env.VITE_ROLES_DIRECTOR,
  PURCHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
  STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
  HR: import.meta.env.VITE_ROLES_HR,
  ADMIN: import.meta.env.VITE_ROLES_ADMIN,
  SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
}



// Animation variants
const viewVariants = {
  hidden: { height: 0, opacity: 0, marginTop: 0, overflow: "hidden" },
  visible: { height: "auto", opacity: 1, marginTop: 10, overflow: "visible" },
  exit: { height: 0, opacity: 0, marginTop: 0, overflow: "hidden" },
};

const RolesList: React.FC<RolesListProps> = React.memo(
  ({ roles, setRoles, userRoles, view, setSelectedRole, setError, searchQuery, setConfirmation }) => {
    const { effectivePermissions } = useAuth();
    const { t } = useTranslation();
    const [activeRolePopup, setActiveRolePopup] = useState<string | null>(null);
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
    const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
    const [loading, setLoading] = useState(true);
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

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

    const isSuperAdmin = useMemo(
      () => userRoles?.some((r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN),
      [userRoles]
    );

    const debouncedSetSearchQuery = useCallback(
      debounce((value: string) => setInternalSearchQuery(value), 300),
      []
    );

    useEffect(() => {
      debouncedSetSearchQuery(searchQuery);
      return () => debouncedSetSearchQuery.cancel();
    }, [searchQuery, debouncedSetSearchQuery]);

    useEffect(() => {
      if (roles.length > 0) {
        setLoading(false);
      }
    }, [roles]);

    const filteredRoles = useMemo(() => {
      return roles.filter(
        (role) =>
          role.name.toLowerCase().includes(internalSearchQuery.toLowerCase()) ||
          role.description?.toLowerCase().includes(internalSearchQuery.toLowerCase())
      );
    }, [roles, internalSearchQuery]);

    const handleRoleToggle = useCallback(
      (role: Role) => {
        if (!userPermissions.canUpdateRoles) {
          return;
        }
        if (!isSuperAdmin && role.name === ROLES.ADMIN) {
          setError(t("adminDashboard.error.adminModifyRestricted"));
          return;
        }
        if (role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN) {
          setError(t("adminDashboard.error.superAdminModifyRestricted"));
          return;
        }
        const fixedRoles = [
          ROLES.DIRECTOR,
          ROLES.REGIONAL_MANAGER,
          ROLES.SUPERVISOR,
          ROLES.HR,
          ROLES.PURCHASE_TEAM,
          ROLES.STOCK_MANAGER,
        ];
        if (fixedRoles.includes(role.name)) {
          setConfirmation({
            isOpen: true,
            message: t("adminDashboard.actions.modifyPreMadeRolesWarning"),
            onConfirm: () => {
              setSelectedRoleId((prev) => (prev === role.roleID ? null : role.roleID));
              setSelectedRole(role);
              setConfirmation(null);
            },
            onCancel: () => setConfirmation(null),
          });
          return;
        }
        setSelectedRoleId((prev) => (prev === role.roleID ? null : role.roleID));
        setSelectedRole(role);
      },
      [isSuperAdmin, userPermissions.canUpdateRoles, setError, setSelectedRole, setConfirmation, t]
    );

    const toggleClassExpansion = useCallback((className: string) => {
      setExpandedClasses((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(className)) newSet.delete(className);
        else newSet.add(className);
        return newSet;
      });
    }, []);

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

    if (view !== "roles" || !userPermissions.canViewRoles) {
      return null;
    }


    // Render UI
    return (
      <div className="roles-management">
        {loading && renderSkeleton()}
        {!loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <InfoPopup
              isOpen={!!activeRolePopup}
              onClose={() => {
                setActiveRolePopup(null);
                setExpandedClasses(new Set());
              }}
              contentRenderer={() => {
                const role = roles.find((role) => role.roleID === activeRolePopup);
                if (!role) return <p>{t("adminDashboard.error.roleNotFound")}</p>;
                return (
                  <>
                    <h4>{role.name}</h4>
                    <p>{role.description || t("adminDashboard.noDescription")}</p>
                    <h5>{t("adminDashboard.permissionsByClass")}</h5>
                    {Object.entries(getCategorizedPermissionsForRole(role.Permissions)).length > 0 ? (
                      Object.entries(getCategorizedPermissionsForRole(role.Permissions))
                        .sort(([classNameA], [classNameB]) => classNameA.localeCompare(classNameB)) // Sort categories alphabetically
                        .map(([className, perms]) => (
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
                        ))
                    ) : (
                      <p>{t("adminDashboard.noPermissionsAssigned")}</p>
                    )}
                  </>
                );
              }}
            />
            {(() => {
              const fixedRoles = filteredRoles.filter((role) =>
                [ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role.name)
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
                [ROLES.DIRECTOR, ROLES.SUPERVISOR, ROLES.REGIONAL_MANAGER, ROLES.STOCK_MANAGER, ROLES.PURCHASE_TEAM, ROLES.HR].includes(
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
                    ROLES.ADMIN,
                    ROLES.DIRECTOR,
                    ROLES.SUPER_ADMIN,
                    ROLES.SUPERVISOR,
                    ROLES.HR,
                    ROLES.REGIONAL_MANAGER,
                    ROLES.STOCK_MANAGER,
                    ROLES.PURCHASE_TEAM
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
          </motion.div>
        )}
      </div>
    );
  }
);

export default RolesList;