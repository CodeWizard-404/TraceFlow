import React, { useState, useMemo, useEffect } from "react";
import { FaAngleDown, FaInfoCircle } from "react-icons/fa";
import Role from "../../../models/Role";
import { useAuth } from "../../../context/AuthContext";
import "../AdminDashboard.css";
import { getPermissionsByRole } from "../../../apis/permissionAPI";
import Permission from "../../../models/Permission";

interface RolesListProps {
    roles: Role[];
    setRoles: (roles: Role[]) => void;
    userRoles: Role[];
    view: string;
    token: string;
    setSelectedRole: (role: Role | null) => void;
    setError: (error: string | null) => void;
    searchQuery: string;
}

const RolesList: React.FC<RolesListProps> = ({
    roles,
    setRoles,
    userRoles,
    view,
    token,
    setSelectedRole,
    setError,
    searchQuery
}) => {
    const { effectivePermissions } = useAuth();

    // State
    const [activeRolePopup, setActiveRolePopup] = useState<string | null>(null);
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => void } | null>(null);
    const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(false);



    // Permission Checks
    const userPermissions = {
        canViewRoles: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_ROLES),
        canUpdateRoles: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_ROLES),
        canCreateRoles: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_ROLES),
        canViewRoleDetails: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_ROLE_DETAILS),
    };

    const isSuperAdmin = useMemo(() => userRoles?.some(r => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN), [userRoles]);

    // Memoized Data
    const filteredRoles = useMemo(() => {
        return roles.filter(role =>
            role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            role.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [roles, searchQuery]);

    // Fetch permissions for the active role when popup is triggered
    useEffect(() => {
        if (activeRolePopup) {
            const fetchRolePermissions = async () => {
                setLoading(true);
                try {
                    const permissionsResponse = await getPermissionsByRole(activeRolePopup, token);
                    setRolePermissions(permissionsResponse || []);
                } catch (error) {
                    console.error("Failed to fetch role permissions:", error);
                    setError("Failed to load role permissions.");
                    setRolePermissions([]);
                } finally {
                    setLoading(false);
                }
            };
            fetchRolePermissions();
        } else {
            setRolePermissions([]);
        }
    }, [activeRolePopup, token, setError]);

    // Handlers
    const handleRoleSelect = async (role: Role) => {
        if (!isSuperAdmin && role.name === 'Admin') {
            setError('Only Super Admins can modify the Admin role.');
            return;
        }
        if (role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN) {
            setError('The Super Admin role cannot be modified.');
            return;
        }
        const fixedRoles = ['Manager', 'Supervisor', 'Purchase Team', 'Regional Manager', 'Stock Manager'];
        if (fixedRoles.includes(role.name)) {
            setConfirmation({
                message: 'Warning: Modifying pre-made roles may affect system functionality. Are you sure you want to proceed?',
                onConfirm: () => proceedWithRoleSelect(role),
            });
            return;
        }
        if (hasUnsavedChanges) {
            setConfirmation({
                message: 'You have unsaved changes. Are you sure you want to switch roles?',
                onConfirm: () => proceedWithRoleSelect(role),
            });
            return;
        }
        proceedWithRoleSelect(role);
    };

    const proceedWithRoleSelect = async (role: Role) => {
        try {
            const rolePermissions = await getPermissionsByRole(role.roleID, token!);
            const updatedRole = { ...role, permissions: rolePermissions };
            setRoles(roles.map(r => r.roleID === role.roleID ? updatedRole : r));
            setSelectedRole(updatedRole);
            setHasUnsavedChanges(false);
            setError(null);
        } catch (error) {
            console.error("Failed to fetch role permissions:", error);
        }
    };

    const toggleRolePopup = (roleID: string) => {
        setActiveRolePopup(activeRolePopup === roleID ? null : roleID);
        setExpandedClasses(new Set());
    };

    const toggleClassExpansion = (className: string) => {
        setExpandedClasses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(className)) newSet.delete(className);
            else newSet.add(className);
            return newSet;
        });
    };

    const getCategorizedPermissionsForRole = (permissions: Permission[]) => {
        const byClass: { [key: string]: Permission[] } = {};
        permissions
            .filter(perm => isSuperAdmin || !["Role", "Permission"].includes(perm.class))
            .forEach(perm => {
                const formattedName = perm.name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                if (!byClass[perm.class]) byClass[perm.class] = [];
                byClass[perm.class].push({ ...perm, name: formattedName });
            });
        return byClass;
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

    return view === "roles" && userPermissions.canViewRoles ? (
        <div className="roles-management">
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
            {(() => {
                const fixedRoles = filteredRoles.filter(role => ['Admin', import.meta.env.VITE_ROLES_SUPER_ADMIN].includes(role.name));
                return fixedRoles.length > 0 && (
                    <div className="role-category-section">
                        <h2 className="role-category-header">Fixed Roles</h2>
                        <div className="roles-grid">
                            {fixedRoles.map(role => (
                                <div
                                    key={role.roleID}
                                    className={`role-card fix`}
                                    onClick={() => userPermissions.canUpdateRoles && handleRoleSelect(role)}
                                >
                                    <div className="role-card-header">
                                        <h3>{role.name}</h3>
                                        <FaInfoCircle
                                            className="role-info-icon"
                                            onClick={e => { e.stopPropagation(); toggleRolePopup(role.roleID); }}
                                        />
                                    </div>
                                    <span className="permission-count">{role.permissions?.length || 0} Permissions</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {(() => {
                const premadeRoles = filteredRoles.filter(role =>
                    ['Manager', 'Supervisor', 'Purchase Team', 'Regional Manager', 'Stock Manager'].includes(role.name));
                return premadeRoles.length > 0 && (
                    <div className="role-category-section">
                        <h2 className="role-category-header">Pre-made Roles</h2>
                        <div className="roles-grid">
                            {premadeRoles.map(role => (
                                <div
                                    key={role.roleID}
                                    className={`role-card premade`}
                                    onClick={() => userPermissions.canUpdateRoles && handleRoleSelect(role)}
                                >
                                    <h3>{role.name}</h3>
                                    <span className="permission-count">{role.permissions?.length || 0} Permissions</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {(() => {
                const customRoles = filteredRoles.filter(role =>
                    !['Admin', import.meta.env.VITE_ROLES_SUPER_ADMIN, 'Manager', 'Supervisor', 'Purchase Team', 'Regional Manager', 'Stock Manager'].includes(role.name));
                return customRoles.length > 0 && (
                    <div className="role-category-section">
                        <h2 className="role-category-header">Custom Roles</h2>
                        <div className="roles-grid">
                            {customRoles.map(role => (
                                <div
                                    key={role.roleID}
                                    className={`role-card`}
                                    onClick={() => userPermissions.canUpdateRoles && handleRoleSelect(role)}
                                >
                                    <h3>{role.name}</h3>
                                    <span className="permission-count">{role.permissions?.length || 0} Permissions</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Role Info Popup */}
            {activeRolePopup && (
                <div className="role-info-popup-overlay" onClick={() => setActiveRolePopup(null)}>
                    <div className="role-info-popup" onClick={e => e.stopPropagation()}>
                        {(() => {
                            const role = roles.find(role => role.roleID === activeRolePopup);
                            if (!role) return <p>Role not found</p>;
                            return (
                                <>
                                    <h4>{role.name}</h4>
                                    <p>{role.description || 'No description available'}</p>
                                    <h5>Permissions by Class:</h5>
                                    {loading ? (
                                        <div className="page-loading">
                                            <div className="spinner"></div>
                                            <p>Loading...</p>
                                        </div>
                                    ) : Object.entries(getCategorizedPermissionsForRole(rolePermissions)).length > 0 ? (
                                        Object.entries(getCategorizedPermissionsForRole(rolePermissions)).map(([className, perms]) => (
                                            <div key={className} className="permission-class-item">
                                                <button className="class-toggle" onClick={() => toggleClassExpansion(className)}>
                                                    {className} ({perms.length})
                                                    <FaAngleDown className={`toggle-icon ${expandedClasses.has(className) ? 'expanded' : ''}`} />
                                                </button>
                                                <ul className={`permission-list ${expandedClasses.has(className) ? 'expanded' : ''}`}>
                                                    {perms.map(perm => <li key={perm.permissionID}>{perm.name}</li>)}
                                                </ul>
                                            </div>
                                        ))
                                    ) : (
                                        <p>No permissions assigned</p>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    ) : null;
};

export default RolesList;