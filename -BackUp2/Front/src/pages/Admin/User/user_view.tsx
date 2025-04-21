/**
 * UserView.tsx
 * Component for displaying and managing user details, roles, permissions, and assignments.
 * Optimized with memoization, lazy loading, and suspense for performance.
 * Includes skeleton loaders for dropdowns and form validation for user edits.
 */

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import {
    FaAngleDown,
    FaEdit,
    FaTrash,
    FaPlus,
    FaMinus,
    FaTimes,
    FaFilter,
    FaInfoCircle,
    FaSearch,
} from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import { useError } from "../../../context/ErrorContext";
import {
    updateUser,
    deleteUser,
    assignSupervisorsToManager,
    revokeSupervisorsFromManager,
    getUserById,
    getSupervisorsByUser,
    getManagersByUser,
} from "../../../apis/userAPI";
import {
    removePermissionOverride,
    addPermissionOverride,
    getPermissionOverridesByUser,
    getEffectivePermissions,
    getPermissionsByRole,
    getAllPermissions,
} from "../../../apis/permissionAPI";
import { revokeRolesFromUser, assignRolesToUser, getAllRoles, getRolesByUser } from "../../../apis/roleAPI";
import User from "../../../models/User";
import Role from "../../../models/Role";
import Permission from "../../../models/Permission";
import UserPermissionOverride from "../../../models/UserPermissionOverride";
import PermissionsAction from "../../../models/Enum/PermissionsAction";
import "../AdminDashboard.css";
import { ViewMode } from "../adminTypes";

// Lazy-load InfoPopup
const InfoPopup = lazy(() => import("../InfoPopup"));

// Constants
const ITEMS_PER_PAGE = 10;
const PHONE_REGEX = /^\d{8}$/;
const WALLET_REGEX = /^[a-zA-Z0-9]{10,50}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Interfaces
interface UserViewProps {
    selectedUser: User | null;
    setSelectedUser: React.Dispatch<React.SetStateAction<User | null>>;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    roles: Role[];
    setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
    permissionsList: Permission[];
    setPermissionsList: React.Dispatch<React.SetStateAction<Permission[]>>;
    view: ViewMode;
    userRoles: Role[];
    setView: (view: ViewMode) => void;
    effectivePermissions: Permission[];
    setError: React.Dispatch<React.SetStateAction<string | null>>;
}

interface FormErrors {
    firstname: string;
    lastname: string;
    email: string;
    phone: string;
    wallet: string;
    password: string;
    passwordConfirm: string;
}

interface TouchedFields {
    firstname: boolean;
    lastname: boolean;
    email: boolean;
    phone: boolean;
    wallet: boolean;
    password: boolean;
    passwordConfirm: boolean;
}

// Skeleton Component for UserView
const UserViewSkeleton: React.FC = () => (
    <div className="details-card skeleton">
        <div className="card-header">
            <div className="custom-skeleton" style={{ width: "200px", height: "24px" }} />
            <div className="user-actions">
                <div className="custom-skeleton" style={{ width: "80px", height: "32px" }} />
                <div className="custom-skeleton" style={{ width: "80px", height: "32px" }} />
            </div>
        </div>
        <hr />
        <div className="form-section">
            <div className="custom-skeleton" style={{ width: "150px", height: "20px", marginBottom: "10px" }} />
            <div className="info-grid">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="custom-skeleton" style={{ width: "100%", height: "16px" }} />
                ))}
            </div>
        </div>
        <div className="dropdown-stack">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="dropdown-unit">
                    <div className="dropdown-bar">
                        <div className="custom-skeleton" style={{ width: "150px", height: "20px" }} />
                        <div className="custom-skeleton" style={{ width: "20px", height: "20px" }} />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// Skeleton Components for Dropdowns
const RolesDropdownSkeleton: React.FC = () => (
    <div className="dropdown-body">
        <div className="roles-grid">
            {[...Array(7)].map((_, i) => (
                <div key={i} className="role-toggle-container">
                    <div className="custom-skeleton" style={{ width: "100%", height: "32px" }} />
                </div>
            ))}
        </div>
    </div>
);

const PermissionsDropdownSkeleton: React.FC = () => (
    <div className="dropdown-body">
        <div className="group-header">
            <div className="custom-skeleton" style={{ width: "100px", height: "32px" }} />
        </div>
        <div className="permissions-filter-section">
            <div className="permissions-filter-header">
                <div className="custom-skeleton" style={{ width: "20px", height: "20px" }} />
                <div className="custom-skeleton" style={{ width: "100px", height: "16px" }} />
            </div>
            <div className="permissions-filter-controls">
                <div className="permissions-search">
                    <div className="custom-skeleton" style={{ width: "200px", height: "32px" }} />
                </div>
                <div className="permissions-category">
                    <div className="custom-skeleton" style={{ width: "150px", height: "32px" }} />
                </div>
            </div>
        </div>
        <div className="custom-skeleton" style={{ width: "150px", height: "20px", marginBottom: "10px" }} />
        <div className="permissions-list">
            {[...Array(2)].map((_, i) => (
                <div key={i} className="permission-class">
                    <div className="custom-skeleton" style={{ width: "100px", height: "20px", marginBottom: "10px" }} />
                    <div className="permissions-container">
                        {[...Array(3)].map((_, j) => (
                            <div key={j} className="permission-item">
                                <div className="custom-skeleton" style={{ width: "150px", height: "32px" }} />
                                <div className="override-controls">
                                    <div className="custom-skeleton" style={{ width: "24px", height: "24px" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const AssignmentsDropdownSkeleton: React.FC = () => (
    <div className="dropdown-body">
        <div className="group-header">
            <div className="custom-skeleton" style={{ width: "100px", height: "32px" }} />
        </div>
        <div className="assignment-list">
            <div className="custom-skeleton" style={{ width: "200px", height: "20px", marginBottom: "10px" }} />
            <div className="search-container assignment-search">
                <div className="custom-skeleton" style={{ width: "200px", height: "32px" }} />
            </div>
            <div className="list-container">
                {[...Array(3)].map((_, j) => (
                    <div key={j} className="list-item">
                        <div className="custom-skeleton" style={{ width: "250px", height: "20px" }} />
                    </div>
                ))}
            </div>
            <div className="pagination">
                <div className="custom-skeleton" style={{ width: "80px", height: "32px" }} />
                <div className="custom-skeleton" style={{ width: "100px", height: "20px" }} />
                <div className="custom-skeleton" style={{ width: "80px", height: "32px" }} />
            </div>
        </div>
    </div>
);

// Main Component
const UserView: React.FC<UserViewProps> = ({
    selectedUser,
    setSelectedUser,
    users,
    setUsers,
    roles,
    setRoles,
    permissionsList,
    setPermissionsList,
    view,
    userRoles,
    setView,
    effectivePermissions,
}) => {
    const { user: currentUser } = useAuth();
    const { setError: setGlobalError } = useError();
    const [loading, setLoading] = useState(true);

    // State Declarations
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
    const [activeOverridePopup, setActiveOverridePopup] = useState<string | null>(null);
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
    const [hasUnsavedSupervisorChanges, setHasUnsavedSupervisorChanges] = useState(false);
    const [hasUnsavedOverrideChanges, setHasUnsavedOverrideChanges] = useState(false);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [loadingPermissions, setLoadingPermissions] = useState(false);
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
    const [rawPhone, setRawPhone] = useState("");
    const [rawWallet, setRawWallet] = useState("");
    const [formErrors, setFormErrors] = useState<FormErrors>({
        firstname: "",
        lastname: "",
        email: "",
        phone: "",
        wallet: "",
        password: "",
        passwordConfirm: "",
    });
    const [touched, setTouched] = useState<TouchedFields>({
        firstname: false,
        lastname: false,
        email: false,
        phone: false,
        wallet: false,
        password: false,
        passwordConfirm: false,
    });

    // Permission Checks
    const userPermissions = useMemo(() => ({
        canViewUserDetails: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_USER_DETAILS
        ),
        canUpdateUsers: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_USERS
        ),
        canDeleteUsers: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_DELETE_USERS
        ),
        canAssignSupervisors: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_SUPERVISORS
        ),
        canRevokeSupervisors: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_SUPERVISORS
        ),
        canReadSupervisors: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS
        ),
        canReadManagers: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_MANAGERS
        ),
        canAssignRoles: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_ROLES
        ),
        canRevokeRoles: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_ROLES
        ),
        canAssignPermissions: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_PERMISSIONS
        ),
        canReadPermissionsByRole: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS_BY_ROLE
        ),
        canCreatePermissionOverrides: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_PERMISSION_OVERRIDES
        ),
        canRemovePermissionOverrides: effectivePermissions.some(
            (p) => p.name === import.meta.env.VITE_PERMISSIONS_REMOVE_PERMISSION_OVERRIDES
        ),
    }), [effectivePermissions]);

    const isSuperAdmin = useMemo(
        () => userRoles.some((r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN),
        [userRoles]
    );

    // Persist view state on refresh
    useEffect(() => {
        if (selectedUser) {
            localStorage.setItem("adminView", "user-details");
            localStorage.setItem("selectedUserId", selectedUser.userID);
        }
    }, [selectedUser]);

    // Load initial user data
    useEffect(() => {
        const loadInitialData = async () => {
            if (!selectedUser) {
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                const userData = await getUserById(selectedUser.userID);
                setSelectedUser(userData);
            } catch (error) {
                setGlobalError(error instanceof Error ? error.message : "Failed to load user data.");
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [selectedUser?.userID, setSelectedUser, setGlobalError]);

    // Load roles when roles dropdown is opened
    useEffect(() => {
        if (expandedSection !== "roles") return;
        const fetchRoles = async () => {
            try {
                setLoadingRoles(true);
                const [rolesData, userRolesData] = await Promise.all([
                    getAllRoles(),
                    getRolesByUser(selectedUser!.userID),
                ]);
                setRoles(rolesData);
                setTempRoles(userRolesData || []);
            } catch (error) {
                setGlobalError(error instanceof Error ? error.message : "Failed to load roles.");
            } finally {
                setLoadingRoles(false);
            }
        };
        fetchRoles();
    }, [expandedSection, selectedUser, setRoles, setGlobalError]);

    // Load permissions and overrides when permissions dropdown is opened
    useEffect(() => {
        if (expandedSection !== "permissions") return;
        const fetchPermissions = async () => {
            try {
                setLoadingPermissions(true);
                const [permissionsData, overrides, effectivePerms] = await Promise.all([
                    getAllPermissions(),
                    getPermissionOverridesByUser(selectedUser!.userID),
                    getEffectivePermissions(selectedUser!.userID),
                ]);
                setPermissionsList(permissionsData);
                setUserOverrides(overrides || []);
                setTempOverrides(overrides || []);
                setEffectiveUserPermissions(effectivePerms || []);
            } catch (error) {
                setGlobalError(error instanceof Error ? error.message : "Failed to load permissions.");
            } finally {
                setLoadingPermissions(false);
            }
        };
        fetchPermissions();
    }, [expandedSection, selectedUser, setPermissionsList, setGlobalError]);

    // Load supervisors and managers when assignments dropdown is opened
    useEffect(() => {
        if (expandedSection !== "assignments") return;
        const fetchAssignments = async () => {
            try {
                setLoadingAssignments(true);
                const [supervisors, managers] = await Promise.all([
                    getSupervisorsByUser(selectedUser!.userID),
                    getManagersByUser(selectedUser!.userID),
                ]);
                setTempSupervisors(supervisors || []);
                setTempManagers(managers || []);
            } catch (error) {
                setGlobalError(error instanceof Error ? error.message : "Failed to load assignments.");
            } finally {
                setLoadingAssignments(false);
            }
        };
        fetchAssignments();
    }, [expandedSection, selectedUser, setGlobalError]);

    // Load role permissions on popup open
    useEffect(() => {
        if (!activeRolePopup) {
            setRolePermissions([]);
            return;
        }
        const fetchRolePermissions = async () => {
            try {
                const permissions = await getPermissionsByRole(activeRolePopup);
                setRolePermissions(permissions || []);
            } catch (error) {
                setGlobalError(error instanceof Error ? error.message : "Failed to load role permissions.");
            }
        };
        fetchRolePermissions();
    }, [activeRolePopup, setGlobalError]);

    // Memoized Computations
    const categorizedPermissions = useMemo(() => {
        const byClass: { [key: string]: Permission[] } = {};
        permissionsList
            .filter((perm) => isSuperAdmin || !["Permission", "Role"].includes(perm.class))
            .forEach((perm) => {
                const formattedName = perm.name
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (char) => char.toUpperCase());
                byClass[perm.class] = byClass[perm.class] || [];
                byClass[perm.class].push({ ...perm, name: formattedName });
            });
        return byClass;
    }, [permissionsList, isSuperAdmin]);

    const filteredPermissions = useMemo(() => {
        let filtered = permissionsList.filter(
            (perm) => isSuperAdmin || !["Permission", "Role"].includes(perm.class)
        );
        if (permissionSearch) {
            filtered = filtered.filter(
                (perm) =>
                    perm.name.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                    perm.class.toLowerCase().includes(permissionSearch.toLowerCase())
            );
        }
        if (selectedCategory !== "all") {
            filtered = filtered.filter((perm) => perm.class === selectedCategory);
        }
        return filtered.reduce((acc: { [key: string]: Permission[] }, perm) => {
            const formattedName = perm.name
                .replace(/_/g, " ")
                .replace(/\b\w/g, (char) => char.toUpperCase());
            acc[perm.class] = acc[perm.class] || [];
            acc[perm.class].push({ ...perm, name: formattedName });
            return acc;
        }, {});
    }, [permissionsList, permissionSearch, selectedCategory, isSuperAdmin]);

    const supervisorUsers = useMemo(() => {
        return users
            .filter((u) => u.Roles?.some((r) => r.name === "Supervisor"))
            .filter(
                (s) =>
                    `${s.firstname} ${s.lastname}`.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
                    s.email.toLowerCase().includes(supervisorSearch.toLowerCase())
            );
    }, [users, supervisorSearch]);

    const managerUsers = useMemo(() => {
        return users
            .filter((u) => u.Roles?.some((r) => r.name === "Manager"))
            .filter(
                (m) =>
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

    // Validation Helpers
    const validateName = useCallback((value: string, field: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return `${field} is required.`;
        if (!/^[a-zA-Z]{2,50}$/.test(trimmed)) return `${field} must be 2–50 letters only.`;
        return "";
    }, []);

    const validateEmail = useCallback((value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return "Email is required.";
        if (!EMAIL_REGEX.test(trimmed)) return "Please enter a valid email.";
        return "";
    }, []);

    const validatePhone = useCallback((value: string): string => {
        const digits = value.replace(/[^\d]/g, "");
        if (!digits) return "Phone number is required.";
        if (!PHONE_REGEX.test(digits)) return "Phone number must be 8 digits.";
        return "";
    }, []);

    const validateWallet = useCallback((value: string): string => {
        if (!value) return "";
        if (!WALLET_REGEX.test(value)) return "Wallet must be 10–50 alphanumeric characters.";
        return "";
    }, []);

    const validatePassword = useCallback((value: string): string => {
        if (!value) return "";
        if (value.length < 6) return "Password must be at least 6 characters.";
        return "";
    }, []);

    const validatePasswordConfirm = useCallback((password: string, confirm: string): string => {
        if (!password && !confirm) return "";
        if (password !== confirm) return "Passwords do not match.";
        return "";
    }, []);

    const formatPhoneDisplay = useCallback((rawValue: string): string => {
        const digits = rawValue.replace(/[^\d]/g, "");
        let formatted = "";
        if (digits.length > 0) formatted += digits.slice(0, 2);
        if (digits.length > 2) formatted += " " + digits.slice(2, 5);
        if (digits.length > 5) formatted += " " + digits.slice(5, 8);
        return formatted;
    }, []);

    const formatWalletDisplay = useCallback((rawValue: string): string => {
        const digits = rawValue.replace(/[^\d]/g, "");
        let formatted = "";
        if (digits.length > 0) formatted += digits.slice(0, 4);
        if (digits.length > 4) formatted += "-" + digits.slice(4, 8);
        if (digits.length > 8) formatted += "-" + digits.slice(8, 12);
        if (digits.length > 12) formatted += "-" + digits.slice(12, 16);
        return formatted;
    }, []);

    const stripPhoneForDatabase = useCallback((raw: string): string => {
        return raw.replace(/[^\d]/g, "");
    }, []);

    const stripWalletForDatabase = useCallback((formatted: string): string => {
        return formatted.replace(/[^\d]/g, "");
    }, []);

    // Handlers
    const handleEditUser = useCallback(() => {
        if (!userPermissions.canUpdateUsers || !selectedUser) return;
        setIsEditingUser(true);
        setEditedUser({
            firstname: selectedUser.firstname,
            lastname: selectedUser.lastname,
            email: selectedUser.email,
            phone: selectedUser.phone,
            wallet: selectedUser.wallet,
            password: "",
            passwordConfirm: "",
        });
        setRawPhone(selectedUser.phone || "");
        setRawWallet(selectedUser.wallet || "");
    }, [selectedUser, userPermissions.canUpdateUsers]);

    const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 8);
        setRawPhone(raw);
        setEditedUser((prev) => ({ ...prev, phone: stripPhoneForDatabase(raw) }));
        setFormErrors((prev) => ({ ...prev, phone: validatePhone(raw) }));
    }, [stripPhoneForDatabase, validatePhone]);

    const handleWalletChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 16);
        setRawWallet(raw);
        setEditedUser((prev) => ({ ...prev, wallet: stripWalletForDatabase(raw) }));
        setFormErrors((prev) => ({ ...prev, wallet: validateWallet(raw) }));
    }, [stripWalletForDatabase, validateWallet]);

    const handleSaveUserEdit = useCallback(async () => {
        if (!selectedUser || !userPermissions.canUpdateUsers || !isEditingUser) return;
        const phoneValue = rawPhone || selectedUser.phone;
        const walletValue = rawWallet || editedUser.wallet || selectedUser.wallet;
        const errors: FormErrors = {
            firstname: validateName(editedUser.firstname || "", "First name"),
            lastname: validateName(editedUser.lastname || "", "Last name"),
            email: validateEmail(editedUser.email || ""),
            phone: validatePhone(phoneValue),
            wallet: validateWallet(walletValue || ""),
            password: validatePassword(editedUser.password || ""),
            passwordConfirm: validatePasswordConfirm(editedUser.password || "", editedUser.passwordConfirm || ""),
        };
        setFormErrors(errors);
        setTouched({
            firstname: true,
            lastname: true,
            email: true,
            phone: true,
            wallet: true,
            password: true,
            passwordConfirm: true,
        });
        if (Object.values(errors).some((error) => error)) {
            setGlobalError("Please fix the errors below before saving.");
            return;
        }
        try {
            const updatePayload: Partial<User> = {
                firstname: editedUser.firstname!.trim(),
                lastname: editedUser.lastname!.trim(),
                email: editedUser.email!.trim(),
                phone: stripPhoneForDatabase(phoneValue),
                wallet: stripWalletForDatabase(walletValue || ""),
            };
            if (editedUser.password) updatePayload.password = editedUser.password;
            const updatedUser = await updateUser(selectedUser.userID, updatePayload);
            setUsers(users.map((u) => (u.userID === selectedUser.userID ? updatedUser : u)));
            setSelectedUser(updatedUser);
            setIsEditingUser(false);
            setEditedUser({});
            setFormErrors({
                firstname: "",
                lastname: "",
                email: "",
                phone: "",
                wallet: "",
                password: "",
                passwordConfirm: "",
            });
            setTouched({
                firstname: false,
                lastname: false,
                email: false,
                phone: false,
                wallet: false,
                password: false,
                passwordConfirm: false,
            });
            setRawPhone("");
            setRawWallet("");
        } catch (error) {
            let errorMessage = error instanceof Error ? error.message : "Failed to update user.";
            if (errorMessage.includes("This Google email is already linked to another user")) {
                errorMessage = "This email is already associated with another Google account.";
                setFormErrors((prev) => ({ ...prev, email: errorMessage }));
            }
            setGlobalError(errorMessage);
        }
    }, [
        selectedUser,
        userPermissions.canUpdateUsers,
        isEditingUser,
        editedUser,
        rawPhone,
        rawWallet,
        users,
        stripPhoneForDatabase,
        stripWalletForDatabase,
        validateName,
        validateEmail,
        validatePhone,
        validateWallet,
        validatePassword,
        validatePasswordConfirm,
        setUsers,
        setSelectedUser,
        setGlobalError,
    ]);

    const handleCancelEdit = useCallback(() => {
        setIsEditingUser(false);
        setEditedUser({});
        setFormErrors({
            firstname: "",
            lastname: "",
            email: "",
            phone: "",
            wallet: "",
            password: "",
            passwordConfirm: "",
        });
        setTouched({
            firstname: false,
            lastname: false,
            email: false,
            phone: false,
            wallet: false,
            password: false,
            passwordConfirm: false,
        });
        setRawPhone("");
        setRawWallet("");
    }, []);

    const handleDeleteUser = useCallback(async () => {
        if (!selectedUser || !userPermissions.canDeleteUsers) return;
        try {
            await deleteUser(selectedUser.userID);
            setUsers(users.filter((u) => u.userID !== selectedUser.userID));
            setSelectedUser(null);
            setView("users");
            localStorage.removeItem("adminView");
            localStorage.removeItem("selectedUserId");
        } catch (error) {
            setGlobalError(error instanceof Error ? error.message : "Failed to delete user.");
        }
    }, [selectedUser, userPermissions.canDeleteUsers, users, setUsers, setSelectedUser, setView, setGlobalError]);

    const handleToggleSupervisor = useCallback((supervisor: User) => {
        if (!userPermissions.canAssignSupervisors || !selectedUser) return;
        setTempSupervisors((prev) => {
            const hasSupervisor = prev.some((s) => s.userID === supervisor.userID);
            return hasSupervisor
                ? prev.filter((s) => s.userID !== supervisor.userID)
                : [...prev, supervisor];
        });
        setHasUnsavedSupervisorChanges(true);
    }, [userPermissions.canAssignSupervisors, selectedUser]);

    const handleToggleManager = useCallback((manager: User) => {
        if (!userPermissions.canAssignSupervisors || !selectedUser) return;
        setTempManagers((prev) => {
            const hasManager = prev.some((m) => m.userID === manager.userID);
            return hasManager
                ? prev.filter((m) => m.userID !== manager.userID)
                : [...prev, manager];
        });
        setHasUnsavedSupervisorChanges(true);
    }, [userPermissions.canAssignSupervisors, selectedUser]);

    const handleSaveSupervisorsAndManagers = useCallback(async () => {
        if (!selectedUser || !userPermissions.canAssignSupervisors) return;
        try {
            const supervisorIds = tempSupervisors.map((s) => s.userID);
            const managerIds = tempManagers.map((m) => m.userID);
            const isManager = selectedUser.Roles?.some((r) => r.name === "Manager");
            if (isManager) {
                const currentSupervisorIds = selectedUser.supervisors?.map((s) => s.userID) || [];
                const toAssign = supervisorIds.filter((id) => !currentSupervisorIds.includes(id));
                const toRevoke = currentSupervisorIds.filter((id) => !supervisorIds.includes(id));
                if (toAssign.length > 0) {
                    await assignSupervisorsToManager(selectedUser.userID, toAssign);
                }
                if (toRevoke.length > 0) {
                    await revokeSupervisorsFromManager(selectedUser.userID, toRevoke);
                }
            }
            const isSupervisor = selectedUser.Roles?.some((r) => r.name === "Supervisor");
            if (isSupervisor) {
                const currentManagerIds = selectedUser.managers?.map((m) => m.userID) || [];
                const toAssign = managerIds.filter((id) => !currentManagerIds.includes(id));
                const toRevoke = currentManagerIds.filter((id) => !managerIds.includes(id));
                if (toAssign.length > 0) {
                    await Promise.all(
                        toAssign.map((managerId) =>
                            assignSupervisorsToManager(managerId, [selectedUser.userID])
                        )
                    );
                }
                if (toRevoke.length > 0) {
                    await Promise.all(
                        toRevoke.map((managerId) =>
                            revokeSupervisorsFromManager(managerId, [selectedUser.userID])
                        )
                    );
                }
            }
            const updatedUser = { ...selectedUser, supervisors: tempSupervisors, managers: tempManagers };
            setUsers(users.map((u) => (u.userID === selectedUser.userID ? updatedUser : u)));
            setSelectedUser(updatedUser);
            setHasUnsavedSupervisorChanges(false);
        } catch (error) {
            setGlobalError(error instanceof Error ? error.message : "Failed to save assignments.");
            setTempSupervisors(selectedUser.supervisors || []);
            setTempManagers(selectedUser.managers || []);
        }
    }, [
        selectedUser,
        userPermissions.canAssignSupervisors,
        tempSupervisors,
        tempManagers,
        users,
        setUsers,
        setSelectedUser,
        setGlobalError,
    ]);

    const handleToggleRole = useCallback(async (role: Role) => {
        if (!userPermissions.canAssignRoles || !selectedUser) return;
        if (role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN) {
            setGlobalError("The Super Admin role cannot be assigned or revoked.");
            return;
        }
        const isCurrentUser = selectedUser.userID === currentUser?.userID;
        const hasAdminRole = tempRoles.some((r) => r.name === import.meta.env.VITE_ROLES_ADMIN);
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
            if (hasRole) {
                await revokeRolesFromUser(selectedUser.userID, [role.roleID]);
                const updatedRoles = tempRoles.filter((r) => r.roleID !== role.roleID);
                setTempRoles(updatedRoles);
                setUsers(
                    users.map((u) =>
                        u.userID === selectedUser.userID ? { ...u, Roles: updatedRoles } : u
                    )
                );
                setSelectedUser({ ...selectedUser, Roles: updatedRoles });
            } else {
                await assignRolesToUser(selectedUser.userID, [role.roleID]);
                const updatedRoles = [...tempRoles, role];
                setTempRoles(updatedRoles);
                setUsers(
                    users.map((u) =>
                        u.userID === selectedUser.userID ? { ...u, Roles: updatedRoles } : u
                    )
                );
                setSelectedUser({ ...selectedUser, Roles: updatedRoles });
            }
        } catch (error) {
            setGlobalError(error instanceof Error ? error.message : "Failed to toggle role.");
            setTempRoles(selectedUser.Roles || []);
        }
    }, [
        userPermissions.canAssignRoles,
        selectedUser,
        currentUser,
        tempRoles,
        isSuperAdmin,
        users,
        setUsers,
        setSelectedUser,
        setGlobalError,
    ]);

    const handleAddOverride = useCallback((permissionID: string, action: "grant" | "revoke") => {
        if (!selectedUser || !userPermissions.canAssignPermissions) return;
        const roleID = tempRoles[0]?.roleID;
        if (!roleID) {
            setGlobalError("No role selected for override.");
            return;
        }
        const newOverride: UserPermissionOverride = {
            overrideID: `temp_${Date.now()}_${permissionID}`,
            userID: selectedUser.userID,
            roleID,
            permissionID,
            action: action as PermissionsAction,
        };
        setTempOverrides([
            ...tempOverrides.filter((o) => o.permissionID !== permissionID),
            newOverride,
        ]);
        setHasUnsavedOverrideChanges(true);
    }, [selectedUser, userPermissions.canAssignPermissions, tempRoles, tempOverrides, setGlobalError]);

    const handleRemoveOverride = useCallback((overrideID: string) => {
        if (!selectedUser || !userPermissions.canAssignPermissions) return;
        setTempOverrides(tempOverrides.filter((o) => o.overrideID !== overrideID));
        setHasUnsavedOverrideChanges(true);
    }, [selectedUser, userPermissions.canAssignPermissions, tempOverrides]);

    const handleSaveOverrides = useCallback(async () => {
        if (!selectedUser || !userPermissions.canAssignPermissions || !hasUnsavedOverrideChanges)
            return;
        try {
            const currentOverrideIds = userOverrides.map((o) => o.overrideID);
            const tempOverrideIds = tempOverrides.map((o) => o.overrideID);
            const toRemove = userOverrides.filter(
                (o) => !tempOverrideIds.includes(o.overrideID)
            );
            await Promise.all(toRemove.map((o) => removePermissionOverride(o.overrideID)));
            const toAddOrUpdate = tempOverrides.filter(
                (o) => o.overrideID.startsWith("temp_") || !currentOverrideIds.includes(o.overrideID)
            );
            await Promise.all(
                toAddOrUpdate.map((o) =>
                    o.overrideID.startsWith("temp_")
                        ? addPermissionOverride(
                            selectedUser.userID,
                            { roleID: o.roleID, permissionID: o.permissionID, action: o.action }
                        )
                        : Promise.resolve()
                )
            );
            const [updatedOverrides, updatedEffectivePerms] = await Promise.all([
                getPermissionOverridesByUser(selectedUser.userID),
                getEffectivePermissions(selectedUser.userID),
            ]);
            setUserOverrides(updatedOverrides);
            setTempOverrides(updatedOverrides);
            setEffectiveUserPermissions(updatedEffectivePerms);
            setHasUnsavedOverrideChanges(false);
        } catch (error) {
            setGlobalError(error instanceof Error ? error.message : "Failed to save permission overrides.");
            setTempOverrides(userOverrides);
        }
    }, [
        selectedUser,
        userPermissions.canAssignPermissions,
        hasUnsavedOverrideChanges,
        userOverrides,
        tempOverrides,
        setGlobalError,
    ]);

    const toggleSection = useCallback((section: string) => {
        setExpandedSection((prev) => (prev === section ? null : section));
    }, []);

    const toggleRolePopup = useCallback((roleID: string) => {
        setActiveRolePopup((prev) => (prev === roleID ? null : roleID));
        setExpandedClasses(new Set());
    }, []);

    const toggleOverridePopup = useCallback((permissionID: string) => {
        setActiveOverridePopup((prev) => (prev === permissionID ? null : permissionID));
        setExpandedClasses(new Set());
    }, []);

    const toggleClassExpansion = useCallback((className: string) => {
        setExpandedClasses((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(className)) newSet.delete(className);
            else newSet.add(className);
            return newSet;
        });
    }, []);

    // Render Functions
    const renderRolePopupContent = useCallback((roleID: string) => {
        const role = roles.find((r) => r.roleID === roleID);
        if (!role) return <p>Role not found.</p>;
        return (
            <>
                <h4>{role.name}</h4>
                <p>{role.description || "No description available."}</p>
                <h5>Permissions by Class:</h5>
                {rolePermissions.length > 0 ? (
                    Object.entries(
                        rolePermissions
                            .filter((perm) => isSuperAdmin || !["Role", "Permission"].includes(perm.class))
                            .reduce((acc: { [key: string]: Permission[] }, perm) => {
                                const formattedName = perm.name
                                    .replace(/_/g, " ")
                                    .replace(/\b\w/g, (char) => char.toUpperCase());
                                acc[perm.class] = acc[perm.class] || [];
                                acc[perm.class].push({ ...perm, name: formattedName });
                                return acc;
                            }, {})
                    ).map(([className, perms]) => (
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
                    <p>No permissions assigned.</p>
                )}
            </>
        );
    }, [rolePermissions, isSuperAdmin, expandedClasses, toggleClassExpansion]);

    const renderOverridePopupContent = useCallback((permissionID: string) => {
        const permission = permissionsList.find((perm) => perm.permissionID === permissionID);
        if (!permission) return <p>Permission not found.</p>;
        return (
            <>
                <h4>{permission.name}</h4>
                <p>{permission.description || "No description available."}</p>
                <p><strong>Class:</strong> {permission.class}</p>
            </>
        );
    }, [permissionsList]);

    // Main Render
    if (view !== "user-details" || !selectedUser || !userPermissions.canViewUserDetails) {
        return null;
    }

    if (loading) {
        return <UserViewSkeleton />;
    }

    return (
        <div className="details-card">
            <div className="card-header">
                {isEditingUser ? (
                    <div className="user-edit-form form-section">
                        <h2>Edit User</h2>
                        <div className="form-grid">
                            <div className="form-group">
                                <label htmlFor="firstname">First Name *</label>
                                <input
                                    id="firstname"
                                    type="text"
                                    value={editedUser.firstname || ""}
                                    onChange={(e) => {
                                        setEditedUser((prev) => ({ ...prev, firstname: e.target.value }));
                                        setFormErrors((prev) => ({
                                            ...prev,
                                            firstname: validateName(e.target.value, "First name"),
                                        }));
                                        setTouched((prev) => ({ ...prev, firstname: true }));
                                    }}
                                    placeholder="Enter first name"
                                    className={`user-edit-input ${touched.firstname && formErrors.firstname ? "invalid-vibrate" : ""}`}
                                    required
                                />
                                {formErrors.firstname && touched.firstname && (
                                    <span className="error-text">{formErrors.firstname}</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="lastname">Last Name *</label>
                                <input
                                    id="lastname"
                                    type="text"
                                    value={editedUser.lastname || ""}
                                    onChange={(e) => {
                                        setEditedUser((prev) => ({ ...prev, lastname: e.target.value }));
                                        setFormErrors((prev) => ({
                                            ...prev,
                                            lastname: validateName(e.target.value, "Last name"),
                                        }));
                                        setTouched((prev) => ({ ...prev, lastname: true }));
                                    }}
                                    placeholder="Enter last name"
                                    className={`user-edit-input ${touched.lastname && formErrors.lastname ? "invalid-vibrate" : ""}`}
                                    required
                                />
                                {formErrors.lastname && touched.lastname && (
                                    <span className="error-text">{formErrors.lastname}</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="email">Email *</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={editedUser.email || ""}
                                    onChange={(e) => {
                                        setEditedUser((prev) => ({ ...prev, email: e.target.value }));
                                        setFormErrors((prev) => ({
                                            ...prev,
                                            email: validateEmail(e.target.value),
                                        }));
                                        setTouched((prev) => ({ ...prev, email: true }));
                                    }}
                                    placeholder="Enter email"
                                    className={`user-edit-input ${touched.email && formErrors.email ? "invalid-vibrate" : ""}`}
                                    required
                                />
                                {formErrors.email && touched.email && (
                                    <span className="error-text">{formErrors.email}</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="phone">Phone Number *</label>
                                <input
                                    id="phone"
                                    type="text"
                                    value={formatPhoneDisplay(rawPhone)}
                                    onChange={handlePhoneChange}
                                    placeholder="XX XXX XXX"
                                    className={`user-edit-input ${touched.phone && formErrors.phone ? "invalid-vibrate" : ""}`}
                                    required
                                    maxLength={10}
                                />
                                {formErrors.phone && touched.phone && (
                                    <span className="error-text">{formErrors.phone}</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="wallet">Wallet Address</label>
                                <input
                                    id="wallet"
                                    type="text"
                                    value={formatWalletDisplay(rawWallet)}
                                    onChange={handleWalletChange}
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                    className={`user-edit-input ${touched.wallet && formErrors.wallet ? "invalid-vibrate" : ""}`}
                                    maxLength={19}
                                />
                                {formErrors.wallet && touched.wallet && (
                                    <span className="error-text">{formErrors.wallet}</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="password">Password (Optional)</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={editedUser.password || ""}
                                    onChange={(e) => {
                                        setEditedUser((prev) => ({ ...prev, password: e.target.value }));
                                        setFormErrors((prev) => ({
                                            ...prev,
                                            password: validatePassword(e.target.value),
                                            passwordConfirm: validatePasswordConfirm(e.target.value, editedUser.passwordConfirm || ""),
                                        }));
                                        setTouched((prev) => ({ ...prev, password: true }));
                                    }}
                                    placeholder="Enter new password"
                                    className={`user-edit-input ${touched.password && formErrors.password ? "invalid-vibrate" : ""}`}
                                />
                                {formErrors.password && touched.password && (
                                    <span className="error-text">{formErrors.password}</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="passwordConfirm">Confirm Password (Optional)</label>
                                <input
                                    id="passwordConfirm"
                                    type="password"
                                    value={editedUser.passwordConfirm || ""}
                                    onChange={(e) => {
                                        setEditedUser((prev) => ({ ...prev, passwordConfirm: e.target.value }));
                                        setFormErrors((prev) => ({
                                            ...prev,
                                            passwordConfirm: validatePasswordConfirm(editedUser.password || "", e.target.value),
                                        }));
                                        setTouched((prev) => ({ ...prev, passwordConfirm: true }));
                                    }}
                                    placeholder="Confirm new password"
                                    className={`user-edit-input ${touched.passwordConfirm && formErrors.passwordConfirm ? "invalid-vibrate" : ""}`}
                                />
                                {formErrors.passwordConfirm && touched.passwordConfirm && (
                                    <span className="error-text">{formErrors.passwordConfirm}</span>
                                )}
                            </div>
                        </div>
                        <div className="user-edit-actions">
                            <button
                                className="action-button"
                                onClick={handleSaveUserEdit}
                            >
                                Save
                            </button>
                            <button
                                className="cancel-button"
                                onClick={handleCancelEdit}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h2>User Details</h2>
                        {userPermissions.canUpdateUsers && (
                            <div className="user-actions">
                                <button
                                    className="edit-button"
                                    onClick={handleEditUser}
                                >
                                    <FaEdit /> Edit
                                </button>
                                {userPermissions.canDeleteUsers && (
                                    <button
                                        className="delete-button"
                                        onClick={handleDeleteUser}
                                    >
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
                            <FaAngleDown
                                className={`dropdown-icon ${expandedSection === "roles" ? "expanded" : ""}`}
                            />
                        </div>
                        {expandedSection === "roles" && (
                            loadingRoles ? <RolesDropdownSkeleton /> : (
                                <div className="dropdown-body">
                                    <div className="roles-grid">
                                        {roles.map((role) => (
                                            <div key={role.roleID} className="role-toggle-container">
                                                <button
                                                    className={`role-toggle-button ${tempRoles.some((r) => r.roleID === role.roleID) ? "active" : ""}`}
                                                    onClick={() => handleToggleRole(role)}
                                                    disabled={
                                                        role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN ||
                                                        (selectedUser.userID === currentUser?.userID &&
                                                            role.name === import.meta.env.VITE_ROLES_ADMIN &&
                                                            !isSuperAdmin &&
                                                            tempRoles.some((r) => r.name === import.meta.env.VITE_ROLES_ADMIN))
                                                    }
                                                >
                                                    <span>{role.name}</span>
                                                    <FaInfoCircle
                                                        className="role-info-icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleRolePopup(role.roleID);
                                                        }}
                                                    />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
                {userPermissions.canAssignPermissions && (
                    <div className="dropdown-unit">
                        <div className="dropdown-bar" onClick={() => toggleSection("permissions")}>
                            <h3>Permission Overrides</h3>
                            <FaAngleDown
                                className={`dropdown-icon ${expandedSection === "permissions" ? "expanded" : ""}`}
                            />
                        </div>
                        {expandedSection === "permissions" && (
                            loadingPermissions ? <PermissionsDropdownSkeleton /> : (
                                <div className="dropdown-body">
                                    <div className="group-header">
                                        {hasUnsavedOverrideChanges && (
                                            <button
                                                className="action-button"
                                                onClick={handleSaveOverrides}
                                            >
                                                Save Changes
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
                                                    onChange={(e) => setPermissionSearch(e.target.value)}
                                                    className="search-input"
                                                />
                                            </div>
                                            <div className="permissions-category">
                                                <select
                                                    value={selectedCategory}
                                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                                >
                                                    <option value="all">All Categories</option>
                                                    {Object.keys(categorizedPermissions).map((category) => (
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
                                                        {permissions.map((perm: Permission) => {
                                                            const isEffective = effectiveUserPermissions.some(
                                                                (p) => p.permissionID === perm.permissionID
                                                            );
                                                            const tempOverride = tempOverrides.find(
                                                                (o) => o.permissionID === perm.permissionID
                                                            );
                                                            const hasOverride = !!tempOverride;
                                                            const overrideAction = tempOverride?.action;
                                                            return (
                                                                <div key={perm.permissionID} className="permission-item">
                                                                    <button
                                                                        className={`permission-button ${(hasOverride ? overrideAction === "grant" : isEffective) ? "assigned" : ""}`}
                                                                    >
                                                                        {perm.name}
                                                                        <FaInfoCircle
                                                                            className="permission-info-icon"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleOverridePopup(perm.permissionID);
                                                                            }}
                                                                        />
                                                                    </button>
                                                                    {userPermissions.canAssignPermissions && (
                                                                        <div className="override-controls">
                                                                            {!hasOverride && !isEffective && (
                                                                                <button
                                                                                    className="override-button grant"
                                                                                    onClick={() => handleAddOverride(perm.permissionID, "grant")}
                                                                                    disabled={!userPermissions.canCreatePermissionOverrides}
                                                                                    title="Grant Permission"
                                                                                >
                                                                                    <FaPlus />
                                                                                </button>
                                                                            )}
                                                                            {!hasOverride && isEffective && (
                                                                                <button
                                                                                    className="override-button revoke"
                                                                                    onClick={() => handleAddOverride(perm.permissionID, "revoke")}
                                                                                    disabled={!userPermissions.canCreatePermissionOverrides}
                                                                                    title="Revoke Permission"
                                                                                >
                                                                                    <FaMinus />
                                                                                </button>
                                                                            )}
                                                                            {hasOverride && (
                                                                                <button
                                                                                    className="override-button remove"
                                                                                    onClick={() => handleRemoveOverride(tempOverride.overrideID)}
                                                                                    disabled={!userPermissions.canRemovePermissionOverrides}
                                                                                    title="Remove Override"
                                                                                >
                                                                                    <FaTimes />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                )}
                {(selectedUser.Roles?.some((r) => r.name === "Manager") ||
                    selectedUser.Roles?.some((r) => r.name === "Supervisor")) &&
                    userPermissions.canAssignSupervisors && (
                        <div className="dropdown-unit">
                            <div className="dropdown-bar" onClick={() => toggleSection("assignments")}>
                                <h3>Assignments</h3>
                                <FaAngleDown
                                    className={`dropdown-icon ${expandedSection === "assignments" ? "expanded" : ""}`}
                                />
                            </div>
                            {expandedSection === "assignments" && (
                                loadingAssignments ? <AssignmentsDropdownSkeleton /> : (
                                    <div className="dropdown-body">
                                        <div className="group-header">
                                            {hasUnsavedSupervisorChanges && (
                                                <button
                                                    className="action-button"
                                                    onClick={handleSaveSupervisorsAndManagers}
                                                >
                                                    Save Assignments
                                                </button>
                                            )}
                                        </div>
                                        {selectedUser.Roles?.some((r) => r.name === "Manager") &&
                                            userPermissions.canReadSupervisors && (
                                                <div className="assignment-list">
                                                    <h4>Supervisors Assigned to This Manager</h4>
                                                    <div className="search-container assignment-search">
                                                        <FaSearch className="search-icon" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search supervisors..."
                                                            value={supervisorSearch}
                                                            onChange={(e) => setSupervisorSearch(e.target.value)}
                                                            className="search-input"
                                                        />
                                                    </div>
                                                    <div className="list-container">
                                                        {paginatedSupervisors.map((supervisor) => (
                                                            <div key={supervisor.userID} className="list-item">
                                                                <label>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={tempSupervisors.some((s) => s.userID === supervisor.userID)}
                                                                        onChange={() => handleToggleSupervisor(supervisor)}
                                                                        disabled={!userPermissions.canRevokeSupervisors}
                                                                    />
                                                                    {`${supervisor.firstname} ${supervisor.lastname} (${supervisor.phone})`}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="pagination">
                                                        <button
                                                            onClick={() => setSupervisorPage((p) => Math.max(1, p - 1))}
                                                            disabled={supervisorPage === 1}
                                                        >
                                                            Previous
                                                        </button>
                                                        <span>
                                                            Page {supervisorPage} of {Math.ceil(supervisorUsers.length / ITEMS_PER_PAGE)}
                                                        </span>
                                                        <button
                                                            onClick={() => setSupervisorPage((p) => p + 1)}
                                                            disabled={
                                                                supervisorPage >= Math.ceil(supervisorUsers.length / ITEMS_PER_PAGE)
                                                            }
                                                        >
                                                            Next
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        {selectedUser.Roles?.some((r) => r.name === "Supervisor") &&
                                            userPermissions.canReadManagers && (
                                                <div className="assignment-list">
                                                    <h4>Managers Assigned to This Supervisor</h4>
                                                    <div className="search-container assignment-search">
                                                        <FaSearch className="search-icon" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search managers..."
                                                            value={managerSearch}
                                                            onChange={(e) => setManagerSearch(e.target.value)}
                                                            className="search-input"
                                                        />
                                                    </div>
                                                    <div className="list-container">
                                                        {paginatedManagers.map((manager) => (
                                                            <div key={manager.userID} className="list-item">
                                                                <label>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={tempManagers.some((m) => m.userID === manager.userID)}
                                                                        onChange={() => handleToggleManager(manager)}
                                                                        disabled={!userPermissions.canRevokeSupervisors}
                                                                    />
                                                                    {`${manager.firstname} ${manager.lastname} (${manager.phone})`}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="pagination">
                                                        <button
                                                            onClick={() => setManagerPage((p) => Math.max(1, p - 1))}
                                                            disabled={managerPage === 1}
                                                        >
                                                            Previous
                                                        </button>
                                                        <span>
                                                            Page {managerPage} of {Math.ceil(managerUsers.length / ITEMS_PER_PAGE)}
                                                        </span>
                                                        <button
                                                            onClick={() => setManagerPage((p) => p + 1)}
                                                            disabled={managerPage >= Math.ceil(managerUsers.length / ITEMS_PER_PAGE)}
                                                        >
                                                            Next
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                    </div>
                                ))}
                        </div>
                    )}
            </div>
            <Suspense fallback={<div>Loading popup...</div>}>
                <InfoPopup
                    isOpen={!!activeRolePopup}
                    onClose={() => setActiveRolePopup(null)}
                    contentRenderer={() => renderRolePopupContent(activeRolePopup!)}
                />
                <InfoPopup
                    isOpen={!!activeOverridePopup}
                    onClose={() => setActiveOverridePopup(null)}
                    contentRenderer={() => renderOverridePopupContent(activeOverridePopup!)}
                />
            </Suspense>
        </div>
    );
};

export default React.memo(UserView);