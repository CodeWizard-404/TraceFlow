import React, { useState, useEffect, useMemo } from "react";
import {
    FaAngleDown, FaEdit, FaTrash, FaPlus, FaMinus, FaTimes, FaFilter, FaInfoCircle, FaSearch
} from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import {
    updateUser, deleteUser, assignSupervisorsToManager, revokeSupervisorsFromManager
} from "../../../apis/userAPI";
import User from "../../../models/User";
import Role from "../../../models/Role";
import Permission from "../../../models/Permission";
import UserPermissionOverride from "../../../models/UserPermissionOverride";
import PermissionsAction from "../../../models/Enum/PermissionsAction";
import "../AdminDashboard.css";
import {
    removePermissionOverride, addPermissionOverride, getPermissionOverridesByUser, getEffectivePermissions,
    getPermissionsByRole
} from "../../../apis/permissionAPI";
import { revokeRolesFromUser, assignRolesToUser } from "../../../apis/roleAPI";
import { ViewMode } from "../adminTypes";

const ITEMS_PER_PAGE = 10;

interface UserViewProps {
    selectedUser: User | null;
    setSelectedUser: React.Dispatch<React.SetStateAction<User | null>>;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    roles: Role[];
    permissionsList: Permission[];
    view: ViewMode;
    effectivePermissions: Permission[];
    userRoles: Role[];
    token: string;
    setView: (view: ViewMode) => void;
    setError: (error: string | null) => void;
}

const UserView: React.FC<UserViewProps> = ({
    selectedUser,
    setSelectedUser,
    users,
    setUsers,
    roles,
    permissionsList,
    view,
    userRoles,
    token,
    setView,
    setError
}) => {
    const { effectivePermissions: authEffectivePermissions, user: currentUser } = useAuth();

    // State
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [editedUser, setEditedUser] = useState<Partial<User> & { passwordConfirm?: string }>({});
    const [tempRoles, setTempRoles] = useState<Role[]>([]);
    const [tempSupervisors, setTempSupervisors] = useState<User[]>([]);
    const [tempManagers, setTempManagers] = useState<User[]>([]);
    const [tempOverrides, setTempOverrides] = useState<UserPermissionOverride[]>([]);
    const [userOverrides, setUserOverrides] = useState<UserPermissionOverride[]>([]);
    const [effectiveUserPermissions, setEffectiveUserPermissions] = useState<Permission[]>([]);
    const [expandedSection, setExpandedSection] = useState<string | null>(null);
    const [supervisorSearch, setSupervisorSearch] = useState("");
    const [managerSearch, setManagerSearch] = useState("");
    const [permissionSearch, setPermissionSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [supervisorPage, setSupervisorPage] = useState(1);
    const [managerPage, setManagerPage] = useState(1);
    const [activeRolePopup, setActiveRolePopup] = useState<string | null>(null);
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
    const [hasUnsavedSupervisorChanges, setHasUnsavedSupervisorChanges] = useState(false);
    const [hasUnsavedOverrideChanges, setHasUnsavedOverrideChanges] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
    const [rawPhone, setRawPhone] = useState("");
    const [rawWallet, setRawWallet] = useState("");
    const [userFormErrors, setUserFormErrors] = useState({
        firstname: "",
        lastname: "",
        email: "",
        phone: "",
        wallet: "",
        password: "",
        passwordConfirm: ""
    });
    const [userTouched, setUserTouched] = useState({
        firstname: false,
        lastname: false,
        email: false,
        phone: false,
        wallet: false,
        password: false,
        passwordConfirm: false
    });

    // Permission Checks
    const userPermissions = useMemo(() => ({
        canViewUserDetails: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_USER_DETAILS),
        canUpdateUsers: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_USERS),
        canDeleteUsers: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_DELETE_USERS),

        canAssignSupervisors: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_SUPERVISORS),
        canRevokeSupervisors: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_SUPERVISORS),
        canReadSupervisors: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS),
        canReadManagers: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_MANAGERS),

        canAssignRoles: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_ROLES),
        canRevokeRoles: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_ROLES),

        canAssignPermissions: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_PERMISSIONS),
        canReadPermissionsByRole: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS_BY_ROLE),

        canCreatePermissionOverrides: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_PERMISSION_OVERRIDES),
        canRemovePermissionOverrides: authEffectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_REMOVE_PERMISSION_OVERRIDES)
    }), [authEffectivePermissions]);

    const isSuperAdmin = useMemo(() => userRoles?.some(r => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN), [userRoles]);

    // Effects
    useEffect(() => {
        if (selectedUser) {
            setTempRoles(selectedUser.Roles || []);
            setTempSupervisors(selectedUser.supervisors || []);
            setTempManagers(selectedUser.managers || []);
            const fetchOverridesAndPermissions = async () => {
                try {
                    const [overrides, effectivePerms] = await Promise.all([
                        getPermissionOverridesByUser(selectedUser.userID, token),
                        getEffectivePermissions(selectedUser.userID, token)
                    ]);
                    setUserOverrides(overrides);
                    setTempOverrides(overrides);
                    setEffectiveUserPermissions(effectivePerms);
                } catch (error) {
                    console.error("Failed to fetch overrides or permissions:", error);
                    setError("Failed to load user permissions.");
                }
            };
            fetchOverridesAndPermissions();
        }
    }, [selectedUser, token, setError]);

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
            setRolePermissions([]); // Reset when popup closes
        }
    }, [activeRolePopup, token, setError]);

    // Memoized Computations
    const categorizedPermissions = useMemo(() => {
        const byClass: { [key: string]: Permission[] } = {};
        permissionsList
            .filter(perm => isSuperAdmin || !["Permission"].includes(perm.class))
            .forEach(perm => {
                const formattedName = perm.name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                if (!byClass[perm.class]) byClass[perm.class] = [];
                byClass[perm.class].push({ ...perm, name: formattedName });
            });
        return byClass;
    }, [permissionsList, isSuperAdmin]);

    const filteredPermissions = useMemo(() => {
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
    }, [permissionsList, permissionSearch, selectedCategory, isSuperAdmin]);

    const supervisorUsers = useMemo(() => {
        return users.filter(u => u.Roles?.some(r => r.name === "Supervisor")).filter(s =>
            `${s.firstname} ${s.lastname}`.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
            s.email.toLowerCase().includes(supervisorSearch.toLowerCase())
        );
    }, [users, supervisorSearch]);

    const managerUsers = useMemo(() => {
        return users.filter(u => u.Roles?.some(r => r.name === "Manager")).filter(m =>
            `${m.firstname} ${m.lastname}`.toLowerCase().includes(managerSearch.toLowerCase()) ||
            m.email.toLowerCase().includes(managerSearch.toLowerCase())
        );
    }, [users, managerSearch]);

    const paginatedSupervisors = useMemo(() => {
        const start = (supervisorPage - 1) * ITEMS_PER_PAGE;
        return supervisorUsers.slice(start, start + ITEMS_PER_PAGE);
    }, [supervisorUsers, supervisorPage]);

    const paginatedManagers = useMemo(() => {
        const start = (managerPage - 1) * ITEMS_PER_PAGE;
        return managerUsers.slice(start, start + ITEMS_PER_PAGE);
    }, [managerUsers, managerPage]);

    // Handlers
    const handleEditUser = () => {
        if (!userPermissions.canUpdateUsers || !selectedUser) return;
        setIsEditingUser(true);
        setEditedUser({
            firstname: selectedUser.firstname,
            lastname: selectedUser.lastname,
            email: selectedUser.email,
            phone: selectedUser.phone,
            wallet: selectedUser.wallet,
            password: "",
            passwordConfirm: ""
        });
        setRawPhone(selectedUser.phone || "");
        setRawWallet(selectedUser.wallet || "");
    };

    const handleSaveUserEdit = async () => {
        if (!selectedUser || !userPermissions.canUpdateUsers || !isEditingUser) return;

        const phoneValue = rawPhone || selectedUser.phone;
        const walletValue = rawWallet || editedUser.wallet || selectedUser.wallet;
        const errors = {
            firstname: validateName(editedUser.firstname || "", "First Name"),
            lastname: validateName(editedUser.lastname || "", "Last Name"),
            email: validateEmail(editedUser.email || ""),
            phone: validatePhone(phoneValue),
            wallet: validateWallet(walletValue, false),
            password: validatePassword(editedUser.password || "", false),
            passwordConfirm: validatePasswordConfirm(editedUser.password || "", editedUser.passwordConfirm || "", false)
        };

        setUserFormErrors(errors);
        if (Object.values(errors).some(error => error)) {
            setError("Please correct the errors before saving.");
            return;
        }

        setLoading(true);
        try {
            const updatePayload: Partial<User> = {
                firstname: editedUser.firstname!.trim(),
                lastname: editedUser.lastname!.trim(),
                email: editedUser.email!.trim(),
                phone: stripPhoneForDatabase(phoneValue),
                wallet: stripWalletForDatabase(walletValue || "")
            };
            if (editedUser.password) updatePayload.password = editedUser.password;

            const updatedUser = await updateUser(selectedUser.userID, updatePayload, token);
            setUsers(users.map(u => u.userID === selectedUser.userID ? updatedUser : u));
            setSelectedUser(updatedUser);
            resetFormStates();
            setIsEditingUser(false);
            setError(null);
        } catch (error) {
            console.error("Failed to update user:", error);
            setError("Failed to update user.");
        } finally {
            setLoading(false);
        }
    };

    const handleCancelEdit = () => {
        resetFormStates();
        setIsEditingUser(false);
    };

    const handleDeleteUser = async () => {
        if (!selectedUser || !userPermissions.canDeleteUsers) return;
        setLoading(true);
        try {
            await deleteUser(selectedUser.userID, token);
            setUsers(users.filter(u => u.userID !== selectedUser.userID));
            setSelectedUser(null);
            setView("users");
            setError(null);
        } catch (error) {
            console.error("Failed to delete user:", error);
            setError("Failed to delete user.");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSupervisor = (supervisor: User) => {
        if (!userPermissions.canAssignSupervisors || !selectedUser) return;
        const hasSupervisor = tempSupervisors.some(s => s.userID === supervisor.userID);
        if (hasSupervisor) {
            setTempSupervisors(tempSupervisors.filter(s => s.userID !== supervisor.userID));
        } else {
            setTempSupervisors([...tempSupervisors, supervisor]);
        }
        setHasUnsavedSupervisorChanges(true);
    };

    const handleToggleManager = (manager: User) => {
        if (!userPermissions.canAssignSupervisors || !selectedUser) return;
        const hasManager = tempManagers.some(m => m.userID === manager.userID);
        if (hasManager) {
            setTempManagers(tempManagers.filter(m => m.userID !== manager.userID));
        } else {
            setTempManagers([...tempManagers, manager]);
        }
        setHasUnsavedSupervisorChanges(true);
    };

    const handleSaveSupervisorsAndManagers = async () => {
        if (!selectedUser || !userPermissions.canAssignSupervisors) return;
        setLoading(true);
        try {
            const supervisorIds = tempSupervisors.map(s => s.userID);
            const managerIds = tempManagers.map(m => m.userID);

            const isManager = selectedUser.Roles?.some(r => r.name === "Manager");
            if (isManager) {
                const currentSupervisorIds = selectedUser.supervisors?.map(s => s.userID) || [];
                const toAssign = supervisorIds.filter(id => !currentSupervisorIds.includes(id));
                const toRevoke = currentSupervisorIds.filter(id => !supervisorIds.includes(id));

                if (toAssign.length > 0) {
                    await assignSupervisorsToManager(selectedUser.userID, toAssign, token);
                }
                if (toRevoke.length > 0) {
                    await revokeSupervisorsFromManager(selectedUser.userID, toRevoke, token);
                }
            }

            const isSupervisor = selectedUser.Roles?.some(r => r.name === "Supervisor");
            if (isSupervisor) {
                const currentManagerIds = selectedUser.managers?.map(m => m.userID) || [];
                const toAssign = managerIds.filter(id => !currentManagerIds.includes(id));
                const toRevoke = currentManagerIds.filter(id => !managerIds.includes(id));

                if (toAssign.length > 0) {
                    await Promise.all(toAssign.map(managerId =>
                        assignSupervisorsToManager(managerId, [selectedUser.userID], token)
                    ));
                }
                if (toRevoke.length > 0) {
                    await Promise.all(toRevoke.map(managerId =>
                        revokeSupervisorsFromManager(managerId, [selectedUser.userID], token)
                    ));
                }
            }

            const updatedUser = { ...selectedUser, supervisors: tempSupervisors, managers: tempManagers };
            setUsers(users.map(u => u.userID === selectedUser.userID ? updatedUser : u));
            setSelectedUser(updatedUser);
            setHasUnsavedSupervisorChanges(false);
            setError(null);
        } catch (error) {
            console.error("Failed to save supervisors/managers:", error);
            setTempSupervisors(selectedUser.supervisors || []);
            setTempManagers(selectedUser.managers || []);
            setError("Failed to save assignments.");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleRole = async (role: Role) => {
        if (!userPermissions.canAssignRoles || !selectedUser) return;

        // Prevent toggling "Super Admin" role for anyone
        if (role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN) {
            setError("The Super Admin role cannot be assigned or revoked.");
            return;
        }

        // Prevent logged-in user from revoking their own "Admin" role
        const isCurrentUser = selectedUser.userID === currentUser?.userID;
        const hasAdminRole = tempRoles.some(r => r.name === import.meta.env.VITE_ROLES_ADMIN);
        if (isCurrentUser && role.name === import.meta.env.VITE_ROLES_ADMIN && hasAdminRole && !isSuperAdmin) {
            setError("You cannot revoke your own Admin role.");
            return;
        }

        const hasRole = tempRoles.some(r => r.roleID === role.roleID);
        setLoading(true);
        try {
            if (hasRole) {
                const result = await revokeRolesFromUser(selectedUser.userID, [role.roleID], token);
                const revokedRoleID = Array.isArray(result) ? result[0].revokedRole.roleID : result.revokedRole.roleID;
                const updatedRoles = tempRoles.filter(r => r.roleID !== revokedRoleID);
                setTempRoles(updatedRoles);
                setUsers(users.map(u => u.userID === selectedUser.userID ? { ...u, Roles: updatedRoles } : u));
                setSelectedUser({ ...selectedUser, Roles: updatedRoles });
            } else {
                await assignRolesToUser(selectedUser.userID, [role.roleID], token);
                const updatedRoles = [...tempRoles, role];
                setTempRoles(updatedRoles);
                setUsers(users.map(u => u.userID === selectedUser.userID ? { ...u, Roles: updatedRoles } : u));
                setSelectedUser({ ...selectedUser, Roles: updatedRoles });
            }
            setError(null);
        } catch (error) {
            console.error("Failed to toggle role:", error);
            setTempRoles(selectedUser.Roles || []);
            setError("Failed to toggle role.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddOverride = (permissionID: string, action: "grant" | "revoke") => {
        if (!selectedUser || !userPermissions.canAssignPermissions) return;
        const roleID = tempRoles[0]?.roleID;
        if (!roleID) {
            setError("No role selected for override");
            return;
        }
        const newOverride: UserPermissionOverride = {
            overrideID: `temp_${Date.now()}_${permissionID}`,
            userID: selectedUser.userID,
            roleID,
            permissionID,
            action: action as PermissionsAction
        };
        setTempOverrides([...tempOverrides.filter(o => o.permissionID !== permissionID), newOverride]);
        setHasUnsavedOverrideChanges(true);
    };

    const handleRemoveOverride = (overrideID: string) => {
        if (!selectedUser || !userPermissions.canAssignPermissions) return;
        setTempOverrides(tempOverrides.filter(o => o.overrideID !== overrideID));
        setHasUnsavedOverrideChanges(true);
    };

    const handleSaveOverrides = async () => {
        if (!selectedUser || !userPermissions.canAssignPermissions || !hasUnsavedOverrideChanges) return;
        setLoading(true);
        try {
            const currentOverrideIds = userOverrides.map(o => o.overrideID);
            const tempOverrideIds = tempOverrides.map(o => o.overrideID);

            const toRemove = userOverrides.filter(o => !tempOverrideIds.includes(o.overrideID));
            await Promise.all(toRemove.map(o => removePermissionOverride(o.overrideID, token)));

            const toAddOrUpdate = tempOverrides.filter(o => o.overrideID.startsWith("temp_") || !currentOverrideIds.includes(o.overrideID));
            await Promise.all(toAddOrUpdate.map(o =>
                o.overrideID.startsWith("temp_")
                    ? addPermissionOverride(selectedUser.userID, { roleID: o.roleID, permissionID: o.permissionID, action: o.action }, token)
                    : Promise.resolve()
            ));

            const [updatedOverrides, updatedEffectivePerms] = await Promise.all([
                getPermissionOverridesByUser(selectedUser.userID, token),
                getEffectivePermissions(selectedUser.userID, token)
            ]);
            setUserOverrides(updatedOverrides);
            setTempOverrides(updatedOverrides);
            setEffectiveUserPermissions(updatedEffectivePerms);
            setHasUnsavedOverrideChanges(false);
            setError(null);
        } catch (error) {
            console.error("Failed to save overrides:", error);
            setTempOverrides(userOverrides);
            setError("Failed to save permission overrides.");
        } finally {
            setLoading(false);
        }
    };

    // Validation Helpers
    const markUserTouched = (field: keyof typeof userTouched) => {
        setUserTouched(prev => ({ ...prev, [field]: true }));
    };

    const validateName = (value: string, field: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return `${field} is required`;
        if (trimmed.length < 3) return `${field} must be at least 3 characters`;
        if (trimmed.length > 20) return `${field} must be 20 characters or less`;
        if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) return `${field} can only contain letters, spaces, hyphens, or apostrophes`;
        return "";
    };

    const validateEmail = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return "Email is required";
        if (trimmed.length > 70) return "Email must be 70 characters or less";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Invalid email format";
        return "";
    };

    const formatPhoneDisplay = (rawValue: string): string => {
        const digits = rawValue.replace(/[^\d]/g, "");
        let formatted = "";
        if (digits.length > 0) formatted += digits.slice(0, 2);
        if (digits.length > 2) formatted += " " + digits.slice(2, 5);
        if (digits.length > 5) formatted += " " + digits.slice(5, 8);
        return formatted;
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 8);
        setRawPhone(raw);
        setEditedUser({ ...editedUser, phone: raw === "" ? "" : stripPhoneForDatabase(raw) });
        setUserFormErrors({ ...userFormErrors, phone: validatePhone(raw) });
    };

    const validatePhone = (value: string): string => {
        const digits = value.replace(/[^\d]/g, "");
        if (!digits) return "Phone is required";
        if (digits.length !== 8) return "Phone must be 8 digits";
        return "";
    };

    const stripPhoneForDatabase = (raw: string): string => {
        return raw.replace(/[^\d]/g, "");
    };

    const formatWalletDisplay = (rawValue: string): string => {
        const digits = rawValue.replace(/[^\d]/g, "");
        let formatted = "";
        if (digits.length > 0) formatted += digits.slice(0, 4);
        if (digits.length > 4) formatted += "-" + digits.slice(4, 8);
        if (digits.length > 8) formatted += "-" + digits.slice(8, 12);
        if (digits.length > 12) formatted += "-" + digits.slice(12, 16);
        return formatted;
    };

    const validateWallet = (value: string, isNewUser: boolean): string => {
        const digits = value.replace(/[^\d]/g, "");
        if (!digits && isNewUser) return "Wallet is required";
        if (digits && digits.length !== 16) return "Wallet must be exactly 16 digits";
        return "";
    };

    const stripWalletForDatabase = (formatted: string): string => {
        return formatted.replace(/[^\d]/g, "");
    };

    const validatePassword = (value: string, isNewUser: boolean): string => {
        if (!value && isNewUser) return "Password is required";
        if (value && value.length < 8) return "Password must be at least 8 characters";
        if (value.length > 128) return "Password must be 128 characters or less";
        if (value && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$/.test(value)) {
            return "Password must include uppercase, lowercase, digit, and special character, no spaces";
        }
        return "";
    };

    const validatePasswordConfirm = (password: string, confirm: string, isNewUser: boolean): string => {
        if ((!password && confirm) || (password && !confirm && isNewUser)) return "Password confirmation is required";
        if (password && confirm && password !== confirm) return "Passwords do not match";
        return "";
    };

    const resetFormStates = () => {
        setEditedUser({});
        setUserFormErrors({ firstname: "", lastname: "", email: "", phone: "", wallet: "", password: "", passwordConfirm: "" });
        setUserTouched({ firstname: false, lastname: false, email: false, phone: false, wallet: false, password: false, passwordConfirm: false });
        setRawPhone("");
        setRawWallet("");
    };

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
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



    // Render
    if (view !== "user-details" || !selectedUser || !userPermissions.canViewUserDetails) return null;

    return (
        <div className="details-card">
            <div className="card-header">
                {isEditingUser ? (
                    <div className="user-edit-form">
                        <h2>Edit User</h2>
                        <input
                            type="text"
                            value={editedUser.firstname || ""}
                            onChange={e => {
                                setEditedUser({ ...editedUser, firstname: e.target.value });
                                setUserFormErrors({ ...userFormErrors, firstname: validateName(e.target.value, "First Name") });
                            }}
                            placeholder="First Name *"
                            className="user-edit-input"
                            required
                        />
                        {userFormErrors.firstname && <span className="error-text">{userFormErrors.firstname}</span>}
                        <input
                            type="text"
                            value={editedUser.lastname || ""}
                            onChange={e => {
                                setEditedUser({ ...editedUser, lastname: e.target.value });
                                setUserFormErrors({ ...userFormErrors, lastname: validateName(e.target.value, "Last Name") });
                            }}
                            placeholder="Last Name *"
                            className="user-edit-input"
                            required
                        />
                        {userFormErrors.lastname && <span className="error-text">{userFormErrors.lastname}</span>}
                        <input
                            type="email"
                            value={editedUser.email || ""}
                            onChange={e => {
                                setEditedUser({ ...editedUser, email: e.target.value });
                                setUserFormErrors({ ...userFormErrors, email: validateEmail(e.target.value) });
                            }}
                            placeholder="Email *"
                            className="user-edit-input"
                            required
                        />
                        {userFormErrors.email && <span className="error-text">{userFormErrors.email}</span>}
                        <input
                            type="text"
                            value={formatPhoneDisplay(rawPhone === "" ? "" : rawPhone)}
                            onChange={handlePhoneChange}
                            onBlur={() => markUserTouched("phone")}
                            placeholder="XX XXX XXX"
                            className={`user-edit-input ${userTouched.phone ? "touched" : ""} ${userTouched.phone && userFormErrors.phone ? "invalid-vibrate" : ""}`}
                            required
                            maxLength={10}
                        />
                        {userFormErrors.phone && userTouched.phone && <span className="error-text">{userFormErrors.phone}</span>}
                        <input
                            type="text"
                            value={formatWalletDisplay(rawWallet || "")}
                            onChange={e => {
                                const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 16);
                                setRawWallet(raw);
                                setEditedUser({ ...editedUser, wallet: stripWalletForDatabase(raw) });
                                setUserFormErrors({ ...userFormErrors, wallet: validateWallet(raw, false) });
                            }}
                            onBlur={() => markUserTouched("wallet")}
                            placeholder="XXXX-XXXX-XXXX-XXXX"
                            className={`user-edit-input ${userTouched.wallet ? "touched" : ""} ${userTouched.wallet && userFormErrors.wallet ? "invalid-vibrate" : ""}`}
                            maxLength={19}
                        />
                        {userFormErrors.wallet && userTouched.wallet && <span className="error-text">{userFormErrors.wallet}</span>}
                        <input
                            type="password"
                            value={editedUser.password || ""}
                            onChange={e => {
                                setEditedUser({ ...editedUser, password: e.target.value });
                                setUserFormErrors({
                                    ...userFormErrors,
                                    password: validatePassword(e.target.value, false),
                                    passwordConfirm: validatePasswordConfirm(e.target.value, editedUser.passwordConfirm || "", false)
                                });
                            }}
                            placeholder="Password (optional)"
                            className="user-edit-input"
                        />
                        {userFormErrors.password && <span className="error-text">{userFormErrors.password}</span>}
                        <input
                            type="password"
                            value={editedUser.passwordConfirm || ""}
                            onChange={e => {
                                setEditedUser({ ...editedUser, passwordConfirm: e.target.value });
                                setUserFormErrors({
                                    ...userFormErrors,
                                    passwordConfirm: validatePasswordConfirm(editedUser.password || "", e.target.value, false)
                                });
                            }}
                            placeholder="Confirm Password (optional)"
                            className="user-edit-input"
                        />
                        {userFormErrors.passwordConfirm && <span className="error-text">{userFormErrors.passwordConfirm}</span>}
                        <div className="user-edit-actions">
                            <button className="action-button" onClick={handleSaveUserEdit} disabled={loading}>
                                {loading ? "Saving..." : "Save"}
                            </button>
                            <button className="cancel-button" onClick={handleCancelEdit} disabled={loading}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h2>User Details</h2>
                        {userPermissions.canUpdateUsers && (
                            <div className="user-actions">
                                <button className="edit-button" onClick={handleEditUser} disabled={loading}>
                                    <FaEdit /> Edit
                                </button>
                                {userPermissions.canDeleteUsers && (
                                    <button className="delete-button" onClick={handleDeleteUser} disabled={loading}>
                                        <FaTrash /> Delete
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            <hr />
            {!isEditingUser && (
                <div className="form-section">
                    <h3>Basic Information</h3>
                    <div className="info-grid">
                        <p><strong>Name:</strong> {selectedUser.firstname} {selectedUser.lastname}</p>
                        <p><strong>Email:</strong> {selectedUser.email}</p>
                        <p><strong>Phone:</strong> {`+216 ${formatPhoneDisplay(selectedUser.phone || "N/A")}`}</p>
                        <p><strong>Wallet:</strong> {formatWalletDisplay(selectedUser.wallet || "") || "N/A"}</p>
                    </div>
                </div>
            )}

            <div className="dropdown-stack">
                {userPermissions.canAssignRoles && (
                    <div className="dropdown-unit">
                        <div className="dropdown-bar" onClick={() => toggleSection("roles")}>
                            <h3>Role Management</h3>
                            <FaAngleDown className={`dropdown-icon ${expandedSection === "roles" ? "expanded" : ""}`} />
                        </div>
                        {expandedSection === "roles" && (
                            <div className="dropdown-body">
                                <div className="roles-grid">
                                    {roles.map(role => (
                                        <div key={role.roleID} className="role-toggle-container">
                                            <button
                                                className={`role-toggle-button ${tempRoles.some(r => r.roleID === role.roleID) ? "active" : ""}`}
                                                onClick={() => handleToggleRole(role)}
                                                disabled={
                                                    loading ||
                                                    role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN ||
                                                    (selectedUser.userID === currentUser?.userID &&
                                                        role.name === import.meta.env.VITE_ROLES_ADMIN &&
                                                        !isSuperAdmin &&
                                                        tempRoles.some(r => r.name === import.meta.env.VITE_ROLES_ADMIN))
                                                }
                                            >
                                                <span>{role.name}</span>
                                                <FaInfoCircle
                                                    className="role-info-icon"
                                                    onClick={e => { e.stopPropagation(); toggleRolePopup(role.roleID); }}
                                                />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {userPermissions.canAssignPermissions && (
                    <div className="dropdown-unit">
                        <div className="dropdown-bar" onClick={() => toggleSection("permissions")}>
                            <h3>Permission Overrides</h3>
                            <FaAngleDown className={`dropdown-icon ${expandedSection === "permissions" ? "expanded" : ""}`} />
                        </div>
                        {expandedSection === "permissions" && (
                            <div className="dropdown-body">
                                <div className="group-header">
                                    {hasUnsavedOverrideChanges && (
                                        <button className="action-button" onClick={handleSaveOverrides} disabled={loading}>
                                            {loading ? "Saving..." : "Save Changes"}
                                        </button>
                                    )}
                                </div>
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
                                                onChange={e => setPermissionSearch(e.target.value)}
                                                className="search-input"
                                            />
                                        </div>
                                        <div className="permissions-category">
                                            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                                                <option value="all">All Categories</option>
                                                {Object.keys(categorizedPermissions).map(category => (
                                                    <option key={category} value={category}>
                                                        {category.charAt(0).toUpperCase() + category.slice(1)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <h4>Effective Permissions</h4>
                                {userPermissions.canReadPermissionsByRole && (
                                    <div className="permissions-list">
                                        {Object.entries(filteredPermissions).map(([className, permissions]) => (
                                            <div key={className} className="permission-class">
                                                <h4>{className}</h4>
                                                <div className="permissions-container">
                                                    {Array.isArray(permissions) ? (
                                                        permissions.map((perm: Permission) => {
                                                            const isEffective = effectiveUserPermissions.some(p => p.permissionID === perm.permissionID);
                                                            const tempOverride = tempOverrides.find(o => o.permissionID === perm.permissionID);
                                                            const hasOverride = !!tempOverride;
                                                            const overrideAction = tempOverride?.action;
                                                            return (
                                                                <div key={perm.permissionID} className="permission-item">
                                                                    <button
                                                                        className={`permission-button ${(hasOverride ? (overrideAction === "grant") : isEffective) ? "assigned" : ""}`}
                                                                        disabled={loading}
                                                                    >
                                                                        {perm.name}
                                                                    </button>
                                                                    {userPermissions.canAssignPermissions && (
                                                                        <div className="override-controls">
                                                                            {!hasOverride && !isEffective && (
                                                                                <button
                                                                                    className="override-button grant"
                                                                                    onClick={() => handleAddOverride(perm.permissionID, "grant")}
                                                                                    disabled={loading || !userPermissions.canCreatePermissionOverrides}
                                                                                    title="Grant Permission"
                                                                                >
                                                                                    <FaPlus />
                                                                                </button>
                                                                            )}
                                                                            {!hasOverride && isEffective && (
                                                                                <button
                                                                                    className="override-button revoke"
                                                                                    onClick={() => handleAddOverride(perm.permissionID, "revoke")}
                                                                                    disabled={loading || !userPermissions.canCreatePermissionOverrides}
                                                                                    title="Revoke Permission"
                                                                                >
                                                                                    <FaMinus />
                                                                                </button>
                                                                            )}
                                                                            {hasOverride && (
                                                                                <button
                                                                                    className="override-button remove"
                                                                                    onClick={() => handleRemoveOverride(tempOverride.overrideID)}
                                                                                    disabled={loading || !userPermissions.canRemovePermissionOverrides}
                                                                                    title="Remove Override"
                                                                                >
                                                                                    <FaTimes />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <p>No permissions available</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {(selectedUser.Roles?.some(r => r.name === "Manager") || selectedUser.Roles?.some(r => r.name === "Supervisor")) && userPermissions.canAssignSupervisors && (
                    <div className="dropdown-unit">
                        <div className="dropdown-bar" onClick={() => toggleSection("assignments")}>
                            <h3>Assignments</h3>
                            <FaAngleDown className={`dropdown-icon ${expandedSection === "assignments" ? "expanded" : ""}`} />
                        </div>
                        {expandedSection === "assignments" && (
                            <div className="dropdown-body">
                                <div className="group-header">
                                    {hasUnsavedSupervisorChanges && (
                                        <button className="action-button" onClick={handleSaveSupervisorsAndManagers} disabled={loading}>
                                            {loading ? "Saving..." : "Save Assignments"}
                                        </button>
                                    )}
                                </div>
                                {selectedUser.Roles?.some(r => r.name === "Manager") && userPermissions.canReadSupervisors && (
                                    <div className="assignment-list">
                                        <h4>Supervisors Assigned to This Manager</h4>
                                        <div className="search-container assignment-search">
                                            <FaSearch className="search-icon" />
                                            <input
                                                type="text"
                                                placeholder="Search supervisors..."
                                                value={supervisorSearch}
                                                onChange={e => setSupervisorSearch(e.target.value)}
                                                className="search-input"
                                            />
                                        </div>
                                        <div className="list-container">
                                            {paginatedSupervisors.map(supervisor => (
                                                <div key={supervisor.userID} className="list-item">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={tempSupervisors.some(s => s.userID === supervisor.userID)}
                                                            onChange={() => handleToggleSupervisor(supervisor)}
                                                            disabled={loading || !userPermissions.canRevokeSupervisors}
                                                        />
                                                        {`${supervisor.firstname} ${supervisor.lastname} (${supervisor.phone})`}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pagination">
                                            <button onClick={() => setSupervisorPage(p => Math.max(1, p - 1))} disabled={supervisorPage === 1}>
                                                Previous
                                            </button>
                                            <span>Page {supervisorPage} of {Math.ceil(supervisorUsers.length / ITEMS_PER_PAGE)}</span>
                                            <button onClick={() => setSupervisorPage(p => p + 1)} disabled={supervisorPage >= Math.ceil(supervisorUsers.length / ITEMS_PER_PAGE)}>
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {selectedUser.Roles?.some(r => r.name === "Supervisor") && userPermissions.canReadManagers && (
                                    <div className="assignment-list">
                                        <h4>Managers Assigned to This Supervisor</h4>
                                        <div className="search-container assignment-search">
                                            <FaSearch className="search-icon" />
                                            <input
                                                type="text"
                                                placeholder="Search managers..."
                                                value={managerSearch}
                                                onChange={e => setManagerSearch(e.target.value)}
                                                className="search-input"
                                            />
                                        </div>
                                        <div className="list-container">
                                            {paginatedManagers.map(manager => (
                                                <div key={manager.userID} className="list-item">
                                                    <label>
                                                        <input
                                                            type="checkbox"
                                                            checked={tempManagers.some(m => m.userID === manager.userID)}
                                                            onChange={() => handleToggleManager(manager)}
                                                            disabled={loading || !userPermissions.canRevokeSupervisors}
                                                        />
                                                        {`${manager.firstname} ${manager.lastname} (${manager.phone})`}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pagination">
                                            <button onClick={() => setManagerPage(p => Math.max(1, p - 1))} disabled={managerPage === 1}>
                                                Previous
                                            </button>
                                            <span>Page {managerPage} of {Math.ceil(managerUsers.length / ITEMS_PER_PAGE)}</span>
                                            <button onClick={() => setManagerPage(p => p + 1)} disabled={managerPage >= Math.ceil(managerUsers.length / ITEMS_PER_PAGE)}>
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

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
                                        <p>Loading permissions...</p>
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
    );
};

export default UserView;