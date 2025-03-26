import React, { useState, useEffect, useMemo } from "react";

import {
    FaSearch, FaFilter, FaSort, FaUserPlus,
    FaPlus, FaArrowLeft, FaInfoCircle, FaAngleDown,
    FaMinus, FaTimes, FaEdit, FaTrash
} from "react-icons/fa";

import { useAuth } from "../../context/AuthContext";

import {
    createUser,
    getAllUsers,
    updateUser,
    deleteUser,
    assignSupervisorsToManager,
    revokeSupervisorsFromManager,
    getSupervisorsByUser,
    getManagersByUser,
} from "../../apis/userAPI";


import {
    assignRolesToUser,
    revokeRolesFromUser,
    getRolesByUser,
    updateRole,
    deleteRole,
    getAllRoles,
    createRole
} from "../../apis/roleAPI";


import {
    getAllPermissions,
    getPermissionById,
    createPermission,
    updatePermission,
    deletePermission,
    assignPermissionsToRole,
    revokePermissionsFromRole,
    getPermissionsByRole,
    addPermissionOverride,
    removePermissionOverride,
    getEffectivePermissions,
    getPermissionOverridesByUser,
} from "../../apis/permissionAPI";

import User from "../../models/User";
import Role from "../../models/Role";
import Permission from "../../models/Permission";
import UserPermissionOverride from "../../models/UserPermissionOverride";

import "./AdminDashboard.css";
import PermissionsAction from "../../models/Enum/PermissionsAction";
import PermissionsClass from "../../models/Enum/PermissionsClass";









const PERMISSIONS = {
    READ_USERS: import.meta.env.VITE_PERMISSIONS_READ_USERS,
    READ_USER_DETAILS: import.meta.env.VITE_PERMISSIONS_READ_USER_DETAILS,

    CREATE_USERS: import.meta.env.VITE_PERMISSIONS_CREATE_USERS,
    UPDATE_USERS: import.meta.env.VITE_PERMISSIONS_UPDATE_USERS,
    DELETE_USERS: import.meta.env.VITE_PERMISSIONS_DELETE_USERS,

    ASSIGN_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_ASSIGN_SUPERVISORS,
    REVOKE_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_REVOKE_SUPERVISORS,
    READ_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
    READ_MANAGERS: import.meta.env.VITE_PERMISSIONS_READ_MANAGERS,



    READ_ROLES: import.meta.env.VITE_PERMISSIONS_READ_ROLES,
    READ_ROLE_DETAILS: import.meta.env.VITE_PERMISSIONS_READ_ROLE_DETAILS,

    CREATE_ROLES: import.meta.env.VITE_PERMISSIONS_CREATE_ROLES,
    UPDATE_ROLES: import.meta.env.VITE_PERMISSIONS_UPDATE_ROLES,
    DELETE_ROLES: import.meta.env.VITE_PERMISSIONS_DELETE_ROLES,

    ASSIGN_ROLES: import.meta.env.VITE_PERMISSIONS_ASSIGN_ROLES,
    REVOKE_ROLES: import.meta.env.VITE_PERMISSIONS_REVOKE_ROLES,




    ASSIGN_PERMISSIONS: import.meta.env.VITE_PERMISSIONS_ASSIGN_PERMISSIONS,
    REVOKE_PERMISSIONS: import.meta.env.VITE_PERMISSIONS_REVOKE_PERMISSIONS,

    READ_PERMISSIONS: import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS,
    READ_PERMISSION_DETAILS: import.meta.env.VITE_PERMISSIONS_READ_PERMISSION_DETAILS,
    READ_PERMISSIONS_BY_ROLE: import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS_BY_ROLE,

    CREATE_PERMISSIONS: import.meta.env.VITE_PERMISSIONS_CREATE_PERMISSIONS,
    UPDATE_PERMISSIONS: import.meta.env.VITE_PERMISSIONS_UPDATE_PERMISSIONS,
    DELETE_PERMISSIONS: import.meta.env.VITE_PERMISSIONS_DELETE_PERMISSIONS,

    CREATE_PERMISSION_OVERRIDES: import.meta.env.VITE_PERMISSIONS_CREATE_PERMISSION_OVERRIDES,
    REMOVE_PERMISSION_OVERRIDES: import.meta.env.VITE_PERMISSIONS_REMOVE_PERMISSION_OVERRIDES,
};

const ROLES = {
    SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
}

// Constants
const ITEMS_PER_PAGE = 10;

// Types
type ViewMode = "users" | "roles" | "permissions" | "add-user" | "add-role" | "add-permission" | "user-details";
type SortField = "name" | "email" | "role";
type SortOrder = "asc" | "desc";

interface ConfirmationState {
    message: string;
    onConfirm: () => void;
}












// Main Component
const AdminDashboard: React.FC = () => {
    // Hooks
    const { token, effectivePermissions, userRoles } = useAuth();

    // State
    // Data Fetching States
    const [users, setUsers] = useState<User[]>([]);                  // All users fetched from API
    const [roles, setRoles] = useState<Role[]>([]);                  // All roles fetched from API
    const [permissionsList, setPermissions] = useState<Permission[]>([]); // All permissions fetched from API

    // Selection States
    const [selectedUser, setSelectedUser] = useState<User | null>(null);    // Currently selected user
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);    // Currently selected role for editing
    const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null); // Currently selected permission for editing

    // Form States - New Entities
    const [newUser, setNewUser] = useState<Partial<User>>({});              // Data for new user creation
    const [newRole, setNewRole] = useState<Partial<Role>>({});             // Data for new role creation
    const [newPermission, setNewPermission] = useState<Partial<Permission>>({}); // Data for new permission creation
    const [passwordConfirm, setPasswordConfirm] = useState("");            // Confirmation password for new user

    // Editing States
    const [isEditingUser, setIsEditingUser] = useState(false);            // Tracks if user details are being edited
    const [editedUser, setEditedUser] = useState<Partial<User> & { passwordConfirm?: string }>({}); // Temporary user edits
    const [isEditingRole, setIsEditingRole] = useState(false);            // Tracks if role is being edited
    const [editedRole, setEditedRole] = useState<Partial<Role>>({});      // Stores temporary edits for role
    const [isEditingPermission, setIsEditingPermission] = useState(false); // Tracks if permission is being edited
    const [editedPermission, setEditedPermission] = useState<Partial<Permission>>({}); // Temporary edits for permission

    // Temporary States
    const [tempRoles, setTempRoles] = useState<Role[]>([]);              // Temporary roles for user editing
    const [tempPermissions, setTempPermissions] = useState<Permission[]>([]); // Temporary permissions for role editing
    const [tempOverrides, setTempOverrides] = useState<UserPermissionOverride[]>([]); // Temporary overrides for editing
    const [tempSupervisors, setTempSupervisors] = useState<User[]>([]);   // Temporary supervisors for selected user
    const [tempManagers, setTempManagers] = useState<User[]>([]);        // Temporary managers for user

    // Selection Arrays
    const [selectedRolesForNewUser, setSelectedRolesForNewUser] = useState<string[]>([]); // Roles selected for new user
    const [selectedPermissionsForNewRole, setSelectedPermissionsForNewRole] = useState<string[]>([]); // Permissions selected for new role

    // Filtering and Sorting
    const [searchQuery, setSearchQuery] = useState("");              // Search query for users or roles
    const [permissionSearch, setPermissionSearch] = useState("");    // Search query for permissions
    const [supervisorSearch, setSupervisorSearch] = useState("");    // Search query for supervisors
    const [managerSearch, setManagerSearch] = useState("");         // Search query for managers
    const [sortField, setSortField] = useState<SortField>("role");   // Field to sort users by
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc");    // Sort direction
    const [roleFilter, setRoleFilter] = useState<string>("all");     // Filter users by role ID
    const [selectedCategory, setSelectedCategory] = useState<string>("all"); // Filter permissions by category

    // UI States
    const [view, setView] = useState<ViewMode>("users");             // Current view mode
    const [activeRolePopup, setActiveRolePopup] = useState<string | null>(null); // ID of role with active popup
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set()); // Expanded permission classes in popup
    const [expandedSection, setExpandedSection] = useState<string | null>(null); // Expanded section in user details

    // Pagination
    const [userPage, setUserPage] = useState(1);                    // Pagination for users
    const [supervisorPage, setSupervisorPage] = useState(1);        // Pagination for supervisors
    const [managerPage, setManagerPage] = useState(1);             // Pagination for managers

    // Permission and Override States
    const [userOverrides, setUserOverrides] = useState<UserPermissionOverride[]>([]); // User's permission overrides
    const [effectiveUserPermissions, setEffectiveUserPermissions] = useState<Permission[]>([]); // User's effective permissions

    // Change Tracking
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);           // Tracks unsaved role permission changes
    const [hasUnsavedUserChanges, setHasUnsavedUserChanges] = useState(false);   // Tracks unsaved user role changes
    const [hasUnsavedOverrideChanges, setHasUnsavedOverrideChanges] = useState(false); // Tracks unsaved override changes
    const [hasUnsavedSupervisorChanges, setHasUnsavedSupervisorChanges] = useState(false); // Tracks unsaved supervisor/manager changes

    // Status States
    const [loading, setLoading] = useState(false);                  // Loading state for async operations
    const [error, setError] = useState<string | null>(null);        // Error state
    const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null); // Confirmation state
    // User Form States (already exist, keeping as is)
    const [userFormErrors, setUserFormErrors] = useState({
        firstname: "",
        lastname: "",
        email: "",
        phone: "",
        wallet: "",
        password: "",
        passwordConfirm: "",
    });

    const [userTouched, setUserTouched] = useState({
        firstname: false,
        lastname: false,
        email: false,
        phone: false,
        wallet: false,
        password: false,
        passwordConfirm: false,
    });

    // Role Form States
    const [roleFormErrors, setRoleFormErrors] = useState({
        name: "",
        description: "",
    });

    const [roleTouched, setRoleTouched] = useState({
        name: false,
        description: false,
    });

    // Permission Form States
    const [permissionFormErrors, setPermissionFormErrors] = useState({
        name: "",
        class: "",
        description: "",
    });

    const [permissionTouched, setPermissionTouched] = useState({
        name: false,
        class: false,
        description: false,
    });
    const [rawPhone, setRawPhone] = useState("");
    const [rawWallet, setRawWallet] = useState("");


    const resetFormStates = () => {
        setNewUser({});
        setRawPhone("");
        setRawWallet("");
        setPasswordConfirm("");
        setEditedUser({});
        setUserFormErrors({ firstname: "", lastname: "", email: "", phone: "", wallet: "", password: "", passwordConfirm: "" });
        setUserTouched({ firstname: false, lastname: false, email: false, phone: false, wallet: false, password: false, passwordConfirm: false });
        setSelectedRolesForNewUser([]);
        setNewRole({});
        setRoleFormErrors({ name: "", description: "" });
        setRoleTouched({ name: false, description: false });
        setNewPermission({});
        setPermissionFormErrors({ name: "", class: "", description: "" });
        setPermissionTouched({ name: false, class: false, description: false });
    };






    // Permission Checks
    const userPermissions = useMemo(() => ({
        canViewUsers: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_USERS),
        canViewUserDetails: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_USER_DETAILS),
        canCreateUsers: effectivePermissions?.some(p => p.name === PERMISSIONS.CREATE_USERS),
        canUpdateUsers: effectivePermissions?.some(p => p.name === PERMISSIONS.UPDATE_USERS),
        canDeleteUsers: effectivePermissions?.some(p => p.name === PERMISSIONS.DELETE_USERS),
        canAssignSupervisors: effectivePermissions?.some(p => p.name === PERMISSIONS.ASSIGN_SUPERVISORS),
        canRevokeSupervisors: effectivePermissions?.some(p => p.name === PERMISSIONS.REVOKE_SUPERVISORS),
        canReadSupervisors: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_SUPERVISORS),
        canReadManagers: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_MANAGERS),
        canViewRoles: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_ROLES),
        canViewRoleDetails: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_ROLE_DETAILS),
        canCreateRoles: effectivePermissions?.some(p => p.name === PERMISSIONS.CREATE_ROLES),
        canUpdateRoles: effectivePermissions?.some(p => p.name === PERMISSIONS.UPDATE_ROLES),
        canDeleteRoles: effectivePermissions?.some(p => p.name === PERMISSIONS.DELETE_ROLES),
        canAssignRoles: effectivePermissions?.some(p => p.name === PERMISSIONS.ASSIGN_ROLES),
        canRevokeRoles: effectivePermissions?.some(p => p.name === PERMISSIONS.REVOKE_ROLES),
        canAssignPermissions: effectivePermissions?.some(p => p.name === PERMISSIONS.ASSIGN_PERMISSIONS),
        canRevokePermissions: effectivePermissions?.some(p => p.name === PERMISSIONS.REVOKE_PERMISSIONS),
        canViewPermissions: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_PERMISSIONS),
        canViewPermissionDetails: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_PERMISSION_DETAILS),
        canReadPermissionsByRole: effectivePermissions?.some(p => p.name === PERMISSIONS.READ_PERMISSIONS_BY_ROLE),
        canCreatePermissions: effectivePermissions?.some(p => p.name === PERMISSIONS.CREATE_PERMISSIONS),
        canUpdatePermissions: effectivePermissions?.some(p => p.name === PERMISSIONS.UPDATE_PERMISSIONS),
        canDeletePermissions: effectivePermissions?.some(p => p.name === PERMISSIONS.DELETE_PERMISSIONS),
        canCreatePermissionOverrides: effectivePermissions?.some(p => p.name === PERMISSIONS.CREATE_PERMISSION_OVERRIDES),
        canRemovePermissionOverrides: effectivePermissions?.some(p => p.name === PERMISSIONS.REMOVE_PERMISSION_OVERRIDES),
    }), [effectivePermissions]);

    // Role Checks
    const isSuperAdmin = useMemo(() => userRoles?.some(r => r.name === ROLES.SUPER_ADMIN), [userRoles]);












    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch users, roles, and permissions concurrently
                const [usersData, rolesData, permissionsData] = await Promise.all([
                    getAllUsers(token!),
                    getAllRoles(token!),
                    getAllPermissions(token!),
                ]);

                // Enrich users with roles, supervisors, and managers
                const usersWithDetails = await Promise.all(usersData.map(async (user) => {
                    const [userRoles, supervisors, managers] = await Promise.all([
                        getRolesByUser(user.userID, token!),
                        getSupervisorsByUser(user.userID, token!),
                        getManagersByUser(user.userID, token!),
                    ]);
                    return { ...user, Roles: userRoles, supervisors, managers };
                }));
                setUsers(usersWithDetails);

                // Enrich roles with permissions
                const rolesWithPermissions = await Promise.all(rolesData.map(async (role) => {
                    const rolePermissions = await getPermissionsByRole(role.roleID, token!);
                    return { ...role, permissions: rolePermissions };
                }));
                setRoles(rolesWithPermissions);

                setPermissions(permissionsData);
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchData();
    }, [token]);

    // Sync Temporary Permissions with Selected Role
    useEffect(() => {
        if (selectedRole) setTempPermissions(selectedRole.permissions || []);
    }, [selectedRole]);

    // Sync Temporary Roles with Selected User
    useEffect(() => {
        if (selectedUser) setTempRoles(selectedUser.Roles || []);
    }, [selectedUser]);













    // Memoized Data Computations
    const filteredUsers = useMemo(() => {
        // Filter users based on search query and role
        let result = users.filter(user => {
            if (!isSuperAdmin) return !user.Roles?.some(role => ["Super Admin", "Admin"].includes(role.name));
            return (
                `${user.firstname} ${user.lastname}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                user.email.toLowerCase().includes(searchQuery.toLowerCase())
            );
        });
        if (roleFilter !== "all") result = result.filter(user => user.Roles?.some(role => role.roleID === roleFilter));

        // Sort users based on selected field and order
        return result.sort((a, b) => {
            const isSuperAdminA = a.Roles?.some(role => role.name === ROLES.SUPER_ADMIN);
            const isSuperAdminB = b.Roles?.some(role => role.name === ROLES.SUPER_ADMIN);
            if (isSuperAdminA && !isSuperAdminB) return -1;
            if (!isSuperAdminA && isSuperAdminB) return 1;
            const fieldA = sortField === "name" ? `${a.firstname} ${a.lastname}` : sortField === "email" ? a.email : (a.Roles?.map(role => role.name).join(", ") || "");
            const fieldB = sortField === "name" ? `${b.firstname} ${b.lastname}` : sortField === "email" ? b.email : (b.Roles?.map(role => role.name).join(", ") || "");
            return sortOrder === "asc" ? (fieldA > fieldB ? 1 : -1) : (fieldA < fieldB ? 1 : -1);
        });
    }, [users, searchQuery, sortField, sortOrder, roleFilter, isSuperAdmin]);

    const filteredRoles = useMemo(() => {
        // Filter roles based on search query
        return roles.filter(role =>
            role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            role.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [roles, searchQuery]);

    const categorizedPermissions = useMemo(() => {
        // Categorize permissions by class and type for display
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
        // Filter users with Supervisor role for assignment
        return users.filter(u => u.Roles?.some(r => r.name === "Supervisor")).filter(s =>
            `${s.firstname} ${s.lastname}`.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
            s.email.toLowerCase().includes(supervisorSearch.toLowerCase())
        );
    }, [users, supervisorSearch]);

    const managerUsers = useMemo(() => {
        // Filter users with Manager role for assignment
        return users.filter(u => u.Roles?.some(r => r.name === "Manager")).filter(m =>
            `${m.firstname} ${m.lastname}`.toLowerCase().includes(managerSearch.toLowerCase()) ||
            m.email.toLowerCase().includes(managerSearch.toLowerCase())
        );
    }, [users, managerSearch]);

    const paginatedSupervisors = useMemo(() => {
        // Paginate supervisor users
        const start = (supervisorPage - 1) * ITEMS_PER_PAGE;
        return supervisorUsers.slice(start, start + ITEMS_PER_PAGE);
    }, [supervisorUsers, supervisorPage]);

    const paginatedManagers = useMemo(() => {
        // Paginate manager users
        const start = (managerPage - 1) * ITEMS_PER_PAGE;
        return managerUsers.slice(start, start + ITEMS_PER_PAGE);
    }, [managerUsers, managerPage]);

    const paginatedUsers = useMemo(() => {
        // Paginate filtered users
        const start = (userPage - 1) * ITEMS_PER_PAGE;
        return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredUsers, userPage]);





















    // Handlers

    //users

    const handleCreateUser = async () => {
        if (!userPermissions.canCreateUsers) return;

        const errors = {
            firstname: validateName(newUser.firstname || "", "First Name"),
            lastname: validateName(newUser.lastname || "", "Last Name"),
            email: validateEmail(newUser.email || ""),
            phone: validatePhone(rawPhone),
            wallet: validateWallet(rawWallet, true),
            password: validatePassword(newUser.password || "", true),
            passwordConfirm: validatePasswordConfirm(newUser.password || "", passwordConfirm, true),
        };

        setUserFormErrors(errors);
        if (Object.values(errors).some(error => error)) {
            setError("Please correct the errors before submitting.");
            return;
        }

        try {
            const createdUser = await createUser({
                email: newUser.email!.trim(),
                password: newUser.password!,
                firstname: newUser.firstname!.trim(),
                lastname: newUser.lastname!.trim(),
                phone: stripPhoneForDatabase(rawPhone),
                wallet: stripWalletForDatabase(rawWallet),
            }, token!);
            if (selectedRolesForNewUser.length > 0 && userPermissions.canAssignRoles) {
                const filteredRoles = selectedRolesForNewUser.filter(roleID => {
                    const role = roles.find(r => r.roleID === roleID);
                    return role?.name !== ROLES.SUPER_ADMIN || isSuperAdmin;
                });
                if (filteredRoles.length > 0) {
                    await assignRolesToUser(createdUser.userID, filteredRoles, token!);
                    createdUser.Roles = await getRolesByUser(createdUser.userID, token!);
                }
                if (selectedRolesForNewUser.some(roleID => roles.find(r => r.roleID === roleID)?.name === ROLES.SUPER_ADMIN) && !isSuperAdmin) {
                    setError("Super Admin role assignment skipped: Only Super Admins can assign this role.");
                }
            }
            setUsers([...users, createdUser]);
            resetFormStates(); // Reset all form states
            setSelectedRolesForNewUser([]); // Reset role selections
            handleViewChange("users"); // Use handleViewChange instead of setView
            if (!error) setError(null);
        } catch (error) {
            console.error("Failed to create user:", error);
        }
    };

    const handleUserSelect = async (user: User) => {
        if ((hasUnsavedUserChanges || hasUnsavedSupervisorChanges || hasUnsavedOverrideChanges)) {
            setConfirmation({
                message: 'You have unsaved changes. Are you sure you want to proceed?',
                onConfirm: async () => {
                    setSelectedUser(user);
                    try {
                        const [userRoles, supervisors, managers, effectivePerms, overrides] = await Promise.all([
                            getRolesByUser(user.userID, token!),
                            getSupervisorsByUser(user.userID, token!),
                            getManagersByUser(user.userID, token!),
                            getEffectivePermissions(user.userID, token!),
                            getPermissionOverridesByUser(user.userID, token!),
                        ]);
                        setUsers(users.map(u => u.userID === user.userID ? { ...u, Roles: userRoles, supervisors, managers } : u));
                        setTempRoles(userRoles);
                        setTempSupervisors(supervisors || []);
                        setTempManagers(managers || []);
                        setEffectiveUserPermissions(effectivePerms);
                        setUserOverrides(overrides || []);
                        setTempOverrides(overrides || []);
                        setHasUnsavedUserChanges(false);
                        setHasUnsavedSupervisorChanges(false);
                        setHasUnsavedOverrideChanges(false);
                        setSupervisorSearch("");
                        setManagerSearch("");
                        setSupervisorPage(1);
                        setManagerPage(1);
                        setUserPage(1);
                        handleViewChange("user-details")
                    } catch (error) {
                        console.error("Failed to fetch user details:", error);
                    }
                },
            });
            return;
        }
        setSelectedUser(user);
        try {
            const [userRoles, supervisors, managers, effectivePerms, overrides] = await Promise.all([
                getRolesByUser(user.userID, token!),
                getSupervisorsByUser(user.userID, token!),
                getManagersByUser(user.userID, token!),
                getEffectivePermissions(user.userID, token!),
                getPermissionOverridesByUser(user.userID, token!),
            ]);
            setUsers(users.map(u => u.userID === user.userID ? { ...u, Roles: userRoles, supervisors, managers } : u));
            setTempRoles(userRoles);
            setTempSupervisors(supervisors || []);
            setTempManagers(managers || []);
            setEffectiveUserPermissions(effectivePerms);
            setUserOverrides(overrides || []);
            setTempOverrides(overrides || []);
            setHasUnsavedUserChanges(false);
            setHasUnsavedSupervisorChanges(false);
            setHasUnsavedOverrideChanges(false);
            setSupervisorSearch("");
            setManagerSearch("");
            setSupervisorPage(1);
            setManagerPage(1);
            setUserPage(1);
            handleViewChange("user-details")
        } catch (error) {
            console.error("Failed to fetch user details:", error);
        }
    };



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
            passwordConfirm: "",
        });
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
            passwordConfirm: validatePasswordConfirm(editedUser.password || "", editedUser.passwordConfirm || "", false),
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
                wallet: stripWalletForDatabase(walletValue || ""),
            };
            if (editedUser.password) updatePayload.password = editedUser.password;

            const updatedUser = await updateUser(selectedUser.userID, updatePayload, token!);
            setUsers(users.map(u => u.userID === selectedUser.userID ? updatedUser : u));
            setSelectedUser(updatedUser);
            resetFormStates(); // Reset all form states
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
        setConfirmation({
            message: `Are you sure you want to delete ${selectedUser.firstname} ${selectedUser.lastname}? This action cannot be undone.`,
            onConfirm: async () => {
                setLoading(true);
                try {
                    await deleteUser(selectedUser.userID, token!);
                    setUsers(users.filter(u => u.userID !== selectedUser.userID));
                    setSelectedUser(null);
                    handleViewChange("users");
                    setError(null);
                } catch (error) {
                    console.error("Failed to delete user:", error);
                } finally {
                    setLoading(false);
                }
            },
        });
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
                    await assignSupervisorsToManager(selectedUser.userID, toAssign, token!);
                }
                if (toRevoke.length > 0) {
                    await revokeSupervisorsFromManager(selectedUser.userID, toRevoke, token!);
                }
            }

            const isSupervisor = selectedUser.Roles?.some(r => r.name === "Supervisor");
            if (isSupervisor) {
                const currentManagerIds = selectedUser.managers?.map(m => m.userID) || [];
                const toAssign = managerIds.filter(id => !currentManagerIds.includes(id));
                const toRevoke = currentManagerIds.filter(id => !managerIds.includes(id));

                if (toAssign.length > 0) {
                    await Promise.all(toAssign.map(managerId =>
                        assignSupervisorsToManager(managerId, [selectedUser.userID], token!)
                    ));
                }
                if (toRevoke.length > 0) {
                    await Promise.all(toRevoke.map(managerId =>
                        revokeSupervisorsFromManager(managerId, [selectedUser.userID], token!)
                    ));
                }
            }

            setUsers(users.map(u => u.userID === selectedUser.userID ? { ...u, supervisors: tempSupervisors, managers: tempManagers } : u));
            setSelectedUser({ ...selectedUser, supervisors: tempSupervisors, managers: tempManagers });
            setHasUnsavedSupervisorChanges(false);
        } catch (error) {
            console.error("Failed to save supervisors/managers:", error);
            setTempSupervisors(selectedUser.supervisors || []);
            setTempManagers(selectedUser.managers || []);
        } finally {
            setLoading(false);
        }
    };




    // Validation User Helpers

    // User Form
    const markUserTouched = (field: keyof typeof userTouched) => {
        setUserTouched(prev => ({ ...prev, [field]: true }));
    };

    // Role Form
    // const markRoleTouched = (field: keyof typeof roleTouched) => {
    //     setRoleTouched(prev => ({ ...prev, [field]: true }));
    // };

    // // Permission Form
    // const markPermissionTouched = (field: keyof typeof permissionTouched) => {
    //     setPermissionTouched(prev => ({ ...prev, [field]: true }));
    // };

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

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
        const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 8);
        if (isEdit) {
            setRawPhone(raw);
            setEditedUser({ ...editedUser, phone: raw === "" ? "" : stripPhoneForDatabase(raw) });
            setUserFormErrors({ ...userFormErrors, phone: validatePhone(raw) });
        } else {
            setRawPhone(raw);
            setNewUser({ ...newUser, phone: stripPhoneForDatabase(raw) });
            setUserFormErrors({ ...userFormErrors, phone: validatePhone(raw) });
        }
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
        const digits = rawValue.replace(/[^\d]/g, ""); // Extract digits only
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
        return formatted.replace(/[^\d]/g, ""); // Remove all non-digits
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







    // roles

    const handleCreateRole = async () => {
        if (!userPermissions.canCreateRoles) return;

        const errors = {
            name: validateRoleName(newRole.name || ""),
            description: validateRoleDescription(newRole.description || ""),
        };

        setRoleFormErrors(errors);
        if (Object.values(errors).some(error => error)) {
            setError("Please correct the errors before submitting.");
            return;
        }

        try {
            const createdRole = await createRole({ name: newRole.name!.trim(), description: newRole.description?.trim() }, token!);
            if (selectedPermissionsForNewRole.length > 0 && userPermissions.canAssignPermissions) {
                await assignPermissionsToRole(createdRole.roleID, selectedPermissionsForNewRole, token!);
                createdRole.permissions = await getPermissionsByRole(createdRole.roleID, token!);
            }
            setRoles([...roles, createdRole]);
            setNewRole({});
            setSelectedPermissionsForNewRole([]);
            setRoleFormErrors({ name: "", description: "" });
            setRoleTouched({ name: false, description: false });
            setView("roles");
            setError(null);
        } catch (error) {
            console.error("Failed to create role:", error);
        }
    };

    const handleRoleSelect = async (role: Role) => {
        if (!isSuperAdmin && role.name === 'Admin') {
            setError('Only Super Admins can modify the Admin role.');
            return;
        }
        if (role.name === ROLES.SUPER_ADMIN) {
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
        setSelectedRole(role);
        try {
            const rolePermissions = await getPermissionsByRole(role.roleID, token!);
            setRoles(roles.map(r => r.roleID === role.roleID ? { ...r, permissions: rolePermissions } : r));
            setTempPermissions(rolePermissions);
            setHasUnsavedChanges(false);
            setError(null);
        } catch (error) {
            console.error("Failed to fetch role permissions:", error);
        }
    };

    const handleToggleRole = async (role: Role) => {
        if (!userPermissions.canAssignRoles) return;
        if (role.name === ROLES.SUPER_ADMIN && !isSuperAdmin) {
            setError("Only Super Admins can assign or revoke the Super Admin role.");
            return;
        }

        const hasRole = tempRoles.some(r => r.roleID === role.roleID);
        if (hasRole) {
            setConfirmation({
                message: `Are you sure you want to revoke the "${role.name}" role from ${selectedUser?.firstname} ${selectedUser?.lastname}?`,
                onConfirm: async () => {
                    setLoading(true);
                    try {
                        const result = await revokeRolesFromUser(selectedUser!.userID, [role.roleID], token!);
                        const revokedRoleID = Array.isArray(result) ? result[0].revokedRole.roleID : result.revokedRole.roleID;
                        const updatedRoles = tempRoles.filter(r => r.roleID !== revokedRoleID);
                        setTempRoles(updatedRoles);
                        setUsers(users.map(u => u.userID === selectedUser!.userID ? { ...u, Roles: updatedRoles } : u));
                        setSelectedUser({ ...selectedUser!, Roles: updatedRoles });
                        setHasUnsavedUserChanges(false);
                        setError(null);
                    } catch (error) {
                        console.error("Failed to toggle role:", error);
                        setTempRoles(selectedUser!.Roles || []);
                    } finally {
                        setLoading(false);
                    }
                },
            });
        } else {
            setLoading(true);
            try {
                const toAdd = [role.roleID];
                await assignRolesToUser(selectedUser!.userID, toAdd, token!);
                const updatedRoles = [...tempRoles, role];
                setTempRoles(updatedRoles);
                setUsers(users.map(u => u.userID === selectedUser!.userID ? { ...u, Roles: updatedRoles } : u));
                setSelectedUser({ ...selectedUser!, Roles: updatedRoles });
                setHasUnsavedUserChanges(false);
                setError(null);
            } catch (error) {
                console.error("Failed to toggle role:", error);
                setTempRoles(selectedUser!.Roles || []);
            } finally {
                setLoading(false);
            }
        }
    };

    const toggleRolePopup = (roleID: string) => {
        // Toggle the role info popup
        setActiveRolePopup(activeRolePopup === roleID ? null : roleID);
        setExpandedClasses(new Set());
    };




    const handleEditRole = (role: Role) => {
        if (!userPermissions.canUpdateRoles) return;
        if (role.name === ROLES.SUPER_ADMIN) {
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
        if (role.name === ROLES.SUPER_ADMIN) {
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


    // Role Validation Helpers
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





    // permissions

    const handleCreatePermission = async () => {
        if (!userPermissions.canCreatePermissions) return;

        const errors = {
            name: validatePermissionName(newPermission.name || ""),
            class: validatePermissionClass(newPermission.class || ""),
            description: validatePermissionDescription(newPermission.description || ""),
        };

        setPermissionFormErrors(errors);
        if (Object.values(errors).some(error => error)) {
            setError("Please correct the errors before submitting.");
            return;
        }

        setLoading(true);
        try {
            const createdPermission = await createPermission({
                name: newPermission.name!.trim(),
                className: newPermission.class!.trim(),
                description: newPermission.description?.trim(),
            }, token!);
            setPermissions([...permissionsList, createdPermission]);
            setNewPermission({});
            setPermissionFormErrors({ name: "", class: "", description: "" });
            setPermissionTouched({ name: false, class: false, description: false });
            setView("permissions");
            setError(null);
        } catch (error) {
            console.error("Failed to create permission:", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePermissionSelect = async (permission: Permission) => {
        if (hasUnsavedChanges) {
            setConfirmation({
                message: 'You have unsaved changes. Are you sure you want to switch permissions?',
                onConfirm: async () => {
                    setSelectedPermission(permission);
                    try {
                        const permDetails = await getPermissionById(permission.permissionID, token!);
                        setSelectedPermission(permDetails);
                    } catch (error) {
                        console.error("Failed to fetch permission details:", error);
                    }
                },
            });
            return;
        }
        setSelectedPermission(permission);
        try {
            const permDetails = await getPermissionById(permission.permissionID, token!);
            setSelectedPermission(permDetails);
        } catch (error) {
            console.error("Failed to fetch permission details:", error);
        }
    };

    const handleTogglePermission = (permissionID: string) => {
        // Toggle a permission for the selected role
        if (!userPermissions.canAssignPermissions) return;
        const hasPermission = tempPermissions.some(perm => perm.permissionID === permissionID);
        setTempPermissions(hasPermission
            ? tempPermissions.filter(p => p.permissionID !== permissionID)
            : [...tempPermissions, permissionsList.find(p => p.permissionID === permissionID)!]);
        setHasUnsavedChanges(true);
    };

    const handleToggleAllPermissionsInClass = (className: string) => {
        // Toggle all permissions in a class for the selected role
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






    const handleEditPermission = (permission: Permission) => {
        if (!userPermissions.canUpdatePermissions) return;
        setIsEditingPermission(true);
        setEditedPermission({ name: permission.name, class: permission.class, description: permission.description });
        setSelectedPermission(permission);
    };

    const handleSavePermissionEdit = async () => {
        if (!selectedPermission || !userPermissions.canUpdatePermissions || !isEditingPermission) return;

        const errors = {
            name: validatePermissionName(editedPermission.name || ""),
            class: validatePermissionClass(editedPermission.class || ""),
            description: validatePermissionDescription(editedPermission.description || ""),
        };

        setPermissionFormErrors(errors);
        if (Object.values(errors).some(error => error)) {
            setError("Please correct the errors before saving.");
            return;
        }

        setLoading(true);
        try {
            const updatedPermission = await updatePermission(selectedPermission.permissionID, {
                name: editedPermission.name!.trim(),
                className: editedPermission.class!.trim(),
                description: editedPermission.description?.trim(),
            }, token!);
            setPermissions(permissionsList.map(p => p.permissionID === selectedPermission.permissionID ? updatedPermission : p));
            setSelectedPermission(updatedPermission);
            setIsEditingPermission(false);
            setEditedPermission({});
            setPermissionFormErrors({ name: "", class: "", description: "" });
            setPermissionTouched({ name: false, class: false, description: false });
            setError(null);
        } catch (error) {
            console.error("Failed to update permission:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePermission = async (permission: Permission) => {
        if (!userPermissions.canUpdatePermissions) return;
        setConfirmation({
            message: `Are you sure you want to delete the "${permission.name}" permission? This action cannot be undone.`,
            onConfirm: async () => {
                setLoading(true);
                try {
                    await deletePermission(permission.permissionID, token!);
                    setPermissions(permissionsList.filter(p => p.permissionID !== permission.permissionID));
                    setSelectedPermission(null);
                    setError(null);
                } catch (error) {
                    console.error("Failed to delete permission:", error);
                } finally {
                    setLoading(false);
                }
            },
        });
    };


    const getCategorizedPermissionsForRole = (role: Role) => {
        // Categorize permissions for a role by class
        const byClass: { [key: string]: Permission[] } = {};
        role.permissions
            ?.filter(perm => isSuperAdmin || !["Role", "Permission", "User"].includes(perm.class))
            .forEach(perm => {
                const formattedName = perm.name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                if (!byClass[perm.class]) byClass[perm.class] = [];
                byClass[perm.class].push({ ...perm, name: formattedName });
            });
        return byClass;
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
            action: action as PermissionsAction,
        };
        setTempOverrides([...tempOverrides.filter(o => o.permissionID !== permissionID), newOverride]);
        setHasUnsavedOverrideChanges(true);
    };

    const handleRemoveOverride = (overrideID: string) => {
        // Remove a permission override for the selected user
        if (!selectedUser || !userPermissions.canAssignPermissions) return;
        setTempOverrides(tempOverrides.filter(o => o.overrideID !== overrideID));
        setHasUnsavedOverrideChanges(true);
    };

    const handleSaveOverrides = async () => {
        // Save permission override changes for the selected user
        if (!selectedUser || !userPermissions.canAssignPermissions || !hasUnsavedOverrideChanges) return;
        setLoading(true);
        try {
            const currentOverrideIds = userOverrides.map(o => o.overrideID);
            const tempOverrideIds = tempOverrides.map(o => o.overrideID);

            const toRemove = userOverrides.filter(o => !tempOverrideIds.includes(o.overrideID));
            await Promise.all(toRemove.map(o => removePermissionOverride(o.overrideID, token!)));

            const toAddOrUpdate = tempOverrides.filter(o => !o.overrideID.startsWith("temp_") || !currentOverrideIds.includes(o.overrideID));
            await Promise.all(toAddOrUpdate.map(o =>
                o.overrideID.startsWith("temp_")
                    ? addPermissionOverride(selectedUser.userID, { roleID: o.roleID, permissionID: o.permissionID, action: o.action }, token!)
                    : Promise.resolve()
            ));

            const [updatedOverrides, updatedEffectivePerms] = await Promise.all([
                getPermissionOverridesByUser(selectedUser.userID, token!),
                getEffectivePermissions(selectedUser.userID, token!),
            ]);
            setUserOverrides(updatedOverrides);
            setTempOverrides(updatedOverrides);
            setEffectiveUserPermissions(updatedEffectivePerms);
            setHasUnsavedOverrideChanges(false);
        } catch (error) {
            console.error("Failed to save overrides:", error);
            setTempOverrides(userOverrides);
        } finally {
            setLoading(false);
        }
    };

    // Permission Validation Helpers
    const validatePermissionName = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return "Permission name is required";
        if (trimmed.length < 10) return "Permission name must be at least 10 characters";
        if (trimmed.length > 30) return "Permission name must be 30 characters or less";
        if (!/^[a-z_]+$/.test(trimmed)) return "Permission name must contain only lowercase letters and underscores (e.g., read_users)";
        return "";
    };

    const validatePermissionClass = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return "Permission class is required";
        if (trimmed.length < 3) return "Class must be at least 3 characters";
        if (trimmed.length > 20) return "Class must be 20 characters or less";
        if (!/^[A-Za-z]+$/.test(trimmed)) return "Class can only contain letters";
        return "";
    };

    const validatePermissionDescription = (value: string): string => {
        const trimmed = value.trim();
        if (trimmed.length > 150) return "Description must be 150 characters or less";
        return "";
    };



















    // others


    const handleBack = () => {
        resetFormStates(); // Ensure reset on back
        setSelectedUser(null);
        setSelectedRole(null);
        handleViewChange(view === "user-details" || view === "add-user" ? "users" : "roles");
    };

    const toggleClassExpansion = (className: string) => {
        // Toggle expansion of a permission class in the popup
        setExpandedClasses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(className)) newSet.delete(className);
            else newSet.add(className);
            return newSet;
        });
    };

    const toggleSection = (section: string) => {
        // Toggle expansion of a section in user details
        setExpandedSection(expandedSection === section ? null : section);
    };

    const clearError = () => setError(null);

    const handleViewChange = (newView: ViewMode) => {
        resetFormStates();
        setView(newView);
        setIsEditingUser(false);
    };







    // Early Return for Loading State
    if (loading) return <div className="loading-text">Loading Admin Dashboard...</div>;

    const ConfirmationModal: React.FC<{ message: string; onConfirm: () => void; onCancel: () => void }> = ({ message, onConfirm, onCancel }) => {
        const [isFadingOut, setIsFadingOut] = useState(false);

        const handleConfirm = () => {
            setIsFadingOut(true);
            setTimeout(() => {
                onConfirm();
            }, 300); // Match CSS animation duration
        };

        const handleCancel = () => {
            setIsFadingOut(true);
            setTimeout(() => {
                onCancel();
            }, 300); // Match CSS animation duration
        };

        return (
            <div className={`confirmation-modal-overlay ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
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






    // Render
    return (

        <div className="admin-dashboard">

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



            {error && (
                <div className="error-message">
                    <span>{error}</span>
                    <button className="close-error" onClick={clearError}>
                        <FaTimes />
                    </button>
                </div>
            )}




            <header className="dashboard-header">
                <h1>
                    {view === "users" && "Users Management"}
                    {view === "roles" && "Roles Management"}
                    {view === "add-user" && (newUser.userID ? "Edit User" : "Add New User")}
                    {view === "add-role" && "Create New Role"}
                    {view === "user-details" && selectedUser && `${selectedUser.firstname} ${selectedUser.lastname}`}
                </h1>
                {(view === "users" || view === "roles") && (
                    <div className="search-container">
                        <FaSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder={view === "roles" ? "Search roles..." : "Search users..."}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="search-input input-0"
                        />
                    </div>
                )}
                {(view === "add-user" || view === "add-role" || view === "user-details") && (
                    <button className="back-button" onClick={handleBack}>
                        <FaArrowLeft /> Back
                    </button>
                )}
            </header>











            <section className="dashboard-content">
                <aside className="sidebar">
                    {/* Sidebar Navigation */}
                    <div className="filter-card">
                        <h3>View</h3>
                        <button className={view === "users" || view === "add-user" || view === "user-details" ? "active" : ""} onClick={() => handleViewChange("users")}>
                            Users
                        </button>
                        <button className={view === "roles" || view === "add-role" ? "active" : ""} onClick={() => handleViewChange("roles")}>
                            Roles
                        </button>
                        {userPermissions.canCreatePermissions &&
                            <button className={view === "permissions" || view === "add-permission" ? "active" : ""} onClick={() => handleViewChange("permissions")}>
                                Permissions
                            </button>
                        }
                    </div>
                    {(view === "users" || view === "add-user" || view === "user-details") && (
                        <>
                            {/* User Sorting Options */}
                            <div className="sort-card">
                                <h3>Sort Users By</h3>
                                <select value={sortField} onChange={e => setSortField(e.target.value as SortField)}>
                                    <option value="name">Name</option>
                                    <option value="email">Email</option>
                                    <option value="role">Role</option>
                                </select>
                                <button onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
                                    <FaSort /> {sortOrder === "asc" ? "Asc" : "Desc"}
                                </button>
                            </div>
                            {/* Role Filter */}
                            <div className="role-filter-card">
                                <h3>Filter by Role</h3>
                                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                                    <option value="all">All Roles</option>
                                    {roles.map(role => (
                                        <option key={role.roleID} value={role.roleID}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                            {userPermissions.canCreateUsers && (
                                <button className="action-button" onClick={() => handleViewChange("add-user")}>
                                    <FaUserPlus /> Add User
                                </button>
                            )}
                        </>
                    )}
                    {(view === "roles" || view === "add-role") && userPermissions.canCreateRoles && (
                        <button className="action-button" onClick={() => handleViewChange("add-role")}>
                            <FaPlus /> Create Role
                        </button>
                    )}
                    {(view === "permissions" || view === "add-permission") && userPermissions.canCreatePermissions && (
                        <button className="action-button" onClick={() => handleViewChange("add-permission")}>
                            <FaPlus /> Create Permission
                        </button>
                    )}
                </aside>









                <main className="main-content">



                    {/* Users List View */}
                    {view === "users" && userPermissions.canViewUsers && (
                        <div className="users-list">
                            <div className="table-card">
                                <h2>Users</h2>
                                <div className="table-container">
                                    <div className="table-head">
                                        <div className="table-row">
                                            <div className="table-cell">Name</div>
                                            <div className="table-cell">Email</div>
                                            <div className="table-cell">Phone</div>
                                            <div className="table-cell">Roles</div>
                                        </div>
                                    </div>
                                    <div className="table-body">
                                        {paginatedUsers.map(user => (
                                            <div
                                                key={user.userID}
                                                className="table-row user-row"
                                                onClick={() => handleUserSelect(user)}
                                            >
                                                <div className="table-cell">{`${user.firstname} ${user.lastname}`}</div>
                                                <div className="table-cell">{user.email}</div>
                                                <div className="table-cell">{`+216 ${formatPhoneDisplay(user.phone || "N/A")}`}</div>
                                                <div className="table-cell">{user.Roles?.[0]?.name || "No Role"}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="pagination">
                                    <button onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage === 1}>
                                        Previous
                                    </button>
                                    <span>Page {userPage} of {Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)}</span>
                                    <button onClick={() => setUserPage(p => p + 1)} disabled={userPage >= Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)}>
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}



                    {/* Roles Management View */}
                    {view === "roles" && userPermissions.canViewRoles && (
                        <div className="roles-management">
                            {(() => {
                                const fixedRoles = filteredRoles.filter(role => ['Admin', ROLES.SUPER_ADMIN].includes(role.name));
                                return fixedRoles.length > 0 && (
                                    <div className="role-category-section">
                                        <h2 className="role-category-header">Fixed Roles</h2>
                                        <div className="roles-grid">
                                            {fixedRoles.map(role => (
                                                <div
                                                    key={role.roleID}
                                                    className={`role-card fix ${selectedRole?.roleID === role.roleID ? "selected" : ""}`}
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
                                                    className={`role-card premade ${selectedRole?.roleID === role.roleID ? "selected" : ""}`}
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
                                    !['Admin', ROLES.SUPER_ADMIN, 'Manager', 'Supervisor', 'Purchase Team', 'Regional Manager', 'Stock Manager'].includes(role.name));
                                return customRoles.length > 0 && (
                                    <div className="role-category-section">
                                        <h2 className="role-category-header">Custom Roles</h2>
                                        <div className="roles-grid">
                                            {customRoles.map(role => (
                                                <div
                                                    key={role.roleID}
                                                    className={`role-card ${selectedRole?.roleID === role.roleID ? "selected" : ""}`}
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
                            {activeRolePopup && userPermissions.canViewRoleDetails && (
                                <div className="role-info-popup-overlay" onClick={() => setActiveRolePopup(null)}>
                                    <div className="role-info-popup" onClick={e => e.stopPropagation()}>
                                        {roles.find(role => role.roleID === activeRolePopup) && (
                                            <>
                                                <h4>{roles.find(role => role.roleID === activeRolePopup)!.name}</h4>
                                                <p>{roles.find(role => role.roleID === activeRolePopup)!.description || 'No description available'}</p>
                                                <h5>Permissions by Class:</h5>
                                                {Object.entries(getCategorizedPermissionsForRole(roles.find(role => role.roleID === activeRolePopup)!)).length > 0 ? (
                                                    Object.entries(getCategorizedPermissionsForRole(roles.find(role => role.roleID === activeRolePopup)!)).map(([className, perms]) => (
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
                                                ) : <p>No permissions assigned</p>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedRole && userPermissions.canUpdateRoles && (
                                <div className="details-card">
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
                                            <h3>Permissions</h3>
                                            {userPermissions.canReadPermissionsByRole && (
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
                                                                        {permissionsList.filter(p => p.class === className).every(p => tempPermissions.some(tp => tp.permissionID === p.permissionID))
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
                            )}
                        </div>
                    )}




                    {/* Permissions Management View */}

                    {view === "permissions" && userPermissions.canViewPermissions && (
                        <div className="permissions-management">
                            {/* Permissions Filter Section */}
                            <div className="permissions-filter-section">
                                <div className="permissions-filter-header">
                                    <FaFilter />
                                    <label>Filter Permissions</label>
                                </div>
                                <div className="permissions-filter-controls">
                                    <div className="permissions-search">
                                        <FaSearch className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search permissions..."
                                            value={permissionSearch}
                                            onChange={e => setPermissionSearch(e.target.value)}
                                            className="search-input"
                                        />
                                    </div>
                                    <div className="permissions-category">
                                        <select
                                            value={selectedCategory}
                                            onChange={e => setSelectedCategory(e.target.value)}
                                        >
                                            <option value="all">All Classes</option>
                                            {Object.values(PermissionsClass).map(className => (
                                                <option key={className} value={className}>
                                                    {className}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Categorized Permissions Display */}
                            <div className="permissions-grid permissions-grid-0">
                                {Object.entries(filteredPermissions).map(([className, permissions]) => (
                                    <div key={className} className="permission-class-section">
                                        <h3 className="permission-class-title">{className}</h3>
                                        <div className="permission-class-grid">

                                            {Array.isArray(permissions) && permissions.map(permission => (
                                                <div
                                                    key={permission.permissionID}
                                                    className={`permission-card ${selectedPermission?.permissionID === permission.permissionID
                                                        ? "selected"
                                                        : ""
                                                        }`}
                                                    onClick={() => userPermissions.canUpdatePermissions && handlePermissionSelect(permission)}
                                                >
                                                    <h4>{permission.name}</h4>
                                                    <p>{permission.description || "No description"}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Permission Details/Edit Panel */}
                            {selectedPermission && userPermissions.canViewPermissionDetails && (
                                <div className="details-card">
                                    <div className="card-header">

                                        {isEditingPermission && userPermissions.canUpdatePermissions ? (
                                            <div className="permission-edit-form">
                                                <div className="permission-edit-header">
                                                    <h2>Edit Permission</h2>

                                                </div>
                                                <input
                                                    type="text"
                                                    value={editedPermission.name || ""}
                                                    onChange={e => {
                                                        setEditedPermission({ ...editedPermission, name: e.target.value });
                                                        setPermissionFormErrors({ ...permissionFormErrors, name: validatePermissionName(e.target.value) });
                                                    }}
                                                    onBlur={() => setPermissionTouched({ ...permissionTouched, name: true })}
                                                    placeholder="Permission Name"
                                                    className={`permission-edit-input ${permissionTouched.name && permissionFormErrors.name ? "invalid-vibrate" : ""}`}
                                                    required
                                                />
                                                {permissionFormErrors.name && permissionTouched.name && <span className="error-text">{permissionFormErrors.name}</span>}
                                                <div className="form-group">
                                                    <label>Class *</label>
                                                    <select
                                                        value={editedPermission.class || ""}
                                                        onChange={e => {
                                                            setEditedPermission({ ...editedPermission, class: e.target.value as PermissionsClass });
                                                            setPermissionFormErrors({ ...permissionFormErrors, class: validatePermissionClass(e.target.value) });
                                                        }}
                                                        onBlur={() => setPermissionTouched({ ...permissionTouched, class: true })}
                                                        className={`permission-edit-input ${permissionTouched.class && permissionFormErrors.class ? "invalid-vibrate" : ""}`}
                                                        required
                                                    >
                                                        <option value="">Select a class</option>
                                                        {Object.values(PermissionsClass).map(className => (
                                                            <option key={className} value={className}>
                                                                {className}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {permissionFormErrors.class && permissionTouched.class && <span className="error-text">{permissionFormErrors.class}</span>}
                                                </div>
                                                <textarea
                                                    value={editedPermission.description || ""}
                                                    onChange={e => {
                                                        setEditedPermission({ ...editedPermission, description: e.target.value });
                                                        setPermissionFormErrors({ ...permissionFormErrors, description: validatePermissionDescription(e.target.value) });
                                                    }}
                                                    onBlur={() => setPermissionTouched({ ...permissionTouched, description: true })}
                                                    placeholder="Permission Description"
                                                    className={`permission-edit-textarea ${permissionTouched.description && permissionFormErrors.description ? "invalid-vibrate" : ""}`}
                                                />
                                                {permissionFormErrors.description && permissionTouched.description && <span className="error-text">{permissionFormErrors.description}</span>}
                                                <div className="permission-edit-actions">
                                                    <button className="action-button" onClick={handleSavePermissionEdit} disabled={loading}>
                                                        {loading ? "Saving..." : "Save"}
                                                    </button>
                                                    <button
                                                        className="cancel-button"
                                                        onClick={() => {
                                                            setIsEditingPermission(false);
                                                            setEditedPermission({});
                                                        }}
                                                        disabled={loading}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (

                                            <>

                                                <h2>{selectedPermission.name}</h2>
                                                <div className="permission-actions">
                                                    <button
                                                        className="edit-button"
                                                        onClick={() => handleEditPermission(selectedPermission)}
                                                        disabled={loading || !userPermissions.canUpdatePermissions}
                                                    >
                                                        <FaEdit /> Edit
                                                    </button>
                                                    <button
                                                        className="delete-button"
                                                        onClick={() => handleDeletePermission(selectedPermission)}
                                                        disabled={loading || !userPermissions.canDeletePermissions}
                                                    >
                                                        <FaTrash /> Delete
                                                    </button>
                                                    <button
                                                        className="close-button"
                                                        onClick={() => {
                                                            setIsEditingPermission(false);
                                                            setEditedPermission({});
                                                            setSelectedPermission(null);
                                                        }}
                                                        disabled={loading}
                                                    >
                                                        <FaTimes />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {!isEditingPermission && userPermissions.canViewPermissionDetails && (
                                        <>
                                            <p>Class: {selectedPermission.class}</p>
                                            <p>Description: {selectedPermission.description || "No description"}</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}















                    {/* Add User Form */}
                    {view === "add-user" && userPermissions.canCreateUsers && (
                        <div className="form-card form-card-0">
                            <div className="form-section">
                                <h3>Personal Information</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>First Name *</label>
                                        <input
                                            type="text"
                                            value={newUser.firstname || ""}
                                            onChange={e => {
                                                setNewUser({ ...newUser, firstname: e.target.value });
                                                setUserFormErrors({ ...userFormErrors, firstname: validateName(e.target.value, "First Name") });
                                            }}
                                            required
                                        />
                                        {userFormErrors.firstname && <span className="error-text">{userFormErrors.firstname}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Last Name *</label>
                                        <input
                                            type="text"
                                            value={newUser.lastname || ""}
                                            onChange={e => {
                                                setNewUser({ ...newUser, lastname: e.target.value });
                                                setUserFormErrors({ ...userFormErrors, lastname: validateName(e.target.value, "Last Name") });
                                            }}
                                            required
                                        />
                                        {userFormErrors.lastname && <span className="error-text">{userFormErrors.lastname}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="form-section">
                                <h3>Contact Information</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Email *</label>
                                        <input
                                            type="email"
                                            value={newUser.email || ""}
                                            onChange={e => {
                                                setNewUser({ ...newUser, email: e.target.value });
                                                setUserFormErrors({ ...userFormErrors, email: validateEmail(e.target.value) });
                                            }}
                                            required
                                        />
                                        {userFormErrors.email && <span className="error-text">{userFormErrors.email}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Phone *</label>
                                        <input
                                            type="text"
                                            value={formatPhoneDisplay(rawPhone)}
                                            onChange={e => handlePhoneChange(e, false)}
                                            onBlur={() => markUserTouched("phone")}
                                            placeholder="XX XXX XXX"
                                            className={`user-edit-input ${userTouched.phone ? "touched" : ""} ${userTouched.phone && userFormErrors.phone ? "invalid-vibrate" : ""}`}
                                            required
                                            maxLength={14}
                                        />
                                        {userFormErrors.phone && userTouched.phone && <span className="error-text">{userFormErrors.phone}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="form-section">
                                <h3>Credentials</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Password *</label>
                                        <input
                                            type="password"
                                            value={newUser.password || ""}
                                            onChange={e => {
                                                setNewUser({ ...newUser, password: e.target.value });
                                                setUserFormErrors({
                                                    ...userFormErrors,
                                                    password: validatePassword(e.target.value, true),
                                                    passwordConfirm: validatePasswordConfirm(e.target.value, passwordConfirm, true),
                                                });
                                            }}
                                            required
                                        />
                                        {userFormErrors.password && <span className="error-text">{userFormErrors.password}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Confirm Password *</label>
                                        <input
                                            type="password"
                                            value={passwordConfirm}
                                            onChange={e => {
                                                setPasswordConfirm(e.target.value);
                                                setUserFormErrors({
                                                    ...userFormErrors,
                                                    passwordConfirm: validatePasswordConfirm(newUser.password || "", e.target.value, true),
                                                });
                                            }}
                                            required
                                        />
                                        {userFormErrors.passwordConfirm && <span className="error-text">{userFormErrors.passwordConfirm}</span>}
                                    </div>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Wallet *</label>
                                <input
                                    type="text"
                                    value={formatWalletDisplay(rawWallet)}
                                    onChange={e => {
                                        const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 16); // Limit to 16 digits
                                        setRawWallet(raw);
                                        setNewUser({ ...newUser, wallet: stripWalletForDatabase(raw) });
                                        setUserFormErrors({ ...userFormErrors, wallet: validateWallet(raw, true) });
                                    }}
                                    onBlur={() => markUserTouched("wallet")}
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                    className={`user-edit-input ${userTouched.wallet ? "touched" : ""} ${userTouched.wallet && userFormErrors.wallet ? "invalid-vibrate" : ""}`}
                                    required
                                    maxLength={19} // "XXXX-XXXX-XXXX-XXXX" length
                                />
                                {userFormErrors.wallet && userTouched.wallet && <span className="error-text">{userFormErrors.wallet}</span>}
                            </div>
                            {userPermissions.canAssignRoles && (
                                <div className="form-section">
                                    <h3>Role Assignment</h3>
                                    <div className="form-group">
                                        <label>Assign Roles *</label>
                                        <div className="roles-grid">
                                            {roles.map(role => (
                                                <div key={role.roleID} className="role-toggle-container">
                                                    <button
                                                        className={`role-toggle-button ${selectedRolesForNewUser.includes(role.roleID) ? "active" : ""}`}
                                                        onClick={() => {
                                                            if (role.name === ROLES.SUPER_ADMIN && !isSuperAdmin) {
                                                                setError("Only Super Admins can assign the Super Admin role.");
                                                                return;
                                                            }
                                                            setSelectedRolesForNewUser(prev =>
                                                                prev.includes(role.roleID) ? prev.filter(id => id !== role.roleID) : [...prev, role.roleID]
                                                            );
                                                        }}
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
                                </div>
                            )}
                            <button className="action-button" onClick={handleCreateUser}>
                                {newUser.userID ? "Update User" : "Create User"}
                            </button>
                            {activeRolePopup && (
                                <div className="role-info-popup-overlay" onClick={() => setActiveRolePopup(null)}>
                                    <div className="role-info-popup" onClick={e => e.stopPropagation()}>
                                        {roles.find(role => role.roleID === activeRolePopup) && (
                                            <>
                                                <h4>{roles.find(role => role.roleID === activeRolePopup)!.name}</h4>
                                                <p>{roles.find(role => role.roleID === activeRolePopup)!.description || 'No description available'}</p>
                                                <h5>Permissions by Class:</h5>
                                                {Object.entries(getCategorizedPermissionsForRole(roles.find(role => role.roleID === activeRolePopup)!)).length > 0 ? (
                                                    Object.entries(getCategorizedPermissionsForRole(roles.find(role => role.roleID === activeRolePopup)!)).map(([className, perms]) => (
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
                                                ) : <p>No permissions assigned</p>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}





                    {/* Add Role Form */}
                    {view === "add-role" && userPermissions.canCreateRoles && (
                        <div className="form-card form-card-0">
                            <div className="form-section">
                                <h3>Role Details</h3>
                                <div className="form-group">
                                    <label>Name *</label>
                                    <input
                                        type="text"
                                        value={newRole.name || ""}
                                        onChange={e => {
                                            setNewRole({ ...newRole, name: e.target.value });
                                            setRoleFormErrors({ ...roleFormErrors, name: validateRoleName(e.target.value) });
                                        }}
                                        onBlur={() => setRoleTouched({ ...roleTouched, name: true })}
                                        className={`user-edit-input ${roleTouched.name && roleFormErrors.name ? "invalid-vibrate" : ""}`}
                                        required
                                    />
                                    {roleFormErrors.name && roleTouched.name && <span className="error-text">{roleFormErrors.name}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={newRole.description || ""}
                                        onChange={e => {
                                            setNewRole({ ...newRole, description: e.target.value });
                                            setRoleFormErrors({ ...roleFormErrors, description: validateRoleDescription(e.target.value) });
                                        }}
                                        onBlur={() => setRoleTouched({ ...roleTouched, description: true })}
                                        className={`user-edit-input ${roleTouched.description && roleFormErrors.description ? "invalid-vibrate" : ""}`}
                                    />
                                    {roleFormErrors.description && roleTouched.description && <span className="error-text">{roleFormErrors.description}</span>}
                                </div>
                            </div>
                            {userPermissions.canAssignPermissions && (
                                <div className="form-section">
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
                                                        onChange={e => setPermissionSearch(e.target.value)}
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
                                        <div className="permissions-grid">
                                            {Object.entries(filteredPermissions).map(([className, permissions]) => (
                                                <div key={className} className="permission-class">
                                                    <div className="permission-class-header">
                                                        <h4>{className}</h4>
                                                        <button
                                                            className="toggle-all-button"
                                                            onClick={() => {
                                                                const classPermissions = permissionsList.filter(p => p.class === className);
                                                                const allSelected = classPermissions.every(p => selectedPermissionsForNewRole.includes(p.permissionID));
                                                                setSelectedPermissionsForNewRole(prev => allSelected
                                                                    ? prev.filter(id => !classPermissions.some(p => p.permissionID === id))
                                                                    : [...prev, ...classPermissions.filter(p => !prev.includes(p.permissionID)).map(p => p.permissionID)]);
                                                            }}
                                                        >
                                                            {permissionsList.filter(p => p.class === className).every(p => selectedPermissionsForNewRole.includes(p.permissionID))
                                                                ? "Deselect All" : "Select All"}
                                                        </button>
                                                    </div>
                                                    <div className="permissions-container">
                                                        {Array.isArray(permissions) ? (
                                                            permissions.map(perm => (
                                                                <button
                                                                    key={perm.permissionID}
                                                                    className={`permission-button ${selectedPermissionsForNewRole.includes(perm.permissionID) ? "assigned" : ""}`}
                                                                    onClick={() => {
                                                                        setSelectedPermissionsForNewRole(prev =>
                                                                            prev.includes(perm.permissionID) ? prev.filter(id => id !== perm.permissionID) : [...prev, perm.permissionID]
                                                                        );
                                                                    }}
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
                            <button className="action-button" onClick={handleCreateRole}>Create Role</button>
                        </div>
                    )}





                    {/* Add Permssions Form */}
                    {view === "add-permission" && userPermissions.canCreatePermissions && (
                        <div className="form-card form-card-0">
                            <div className="form-section">
                                <h3>Create New Permission</h3>
                                <div className="form-group">
                                    <label>Name *</label>
                                    <input
                                        type="text"
                                        value={newPermission.name || ""}
                                        onChange={e => {
                                            setNewPermission({ ...newPermission, name: e.target.value });
                                            setPermissionFormErrors({ ...permissionFormErrors, name: validatePermissionName(e.target.value) });
                                        }}
                                        onBlur={() => setPermissionTouched({ ...permissionTouched, name: true })}
                                        className={`user-edit-input ${permissionTouched.name && permissionFormErrors.name ? "invalid-vibrate" : ""}`}
                                        required
                                    />
                                    {permissionFormErrors.name && permissionTouched.name && <span className="error-text">{permissionFormErrors.name}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Class *</label>
                                    <select
                                        value={newPermission.class || ""}
                                        onChange={e => {
                                            setNewPermission({ ...newPermission, class: e.target.value as PermissionsClass });
                                            setPermissionFormErrors({ ...permissionFormErrors, class: validatePermissionClass(e.target.value) });
                                        }}
                                        onBlur={() => setPermissionTouched({ ...permissionTouched, class: true })}
                                        className={`user-edit-input ${permissionTouched.class && permissionFormErrors.class ? "invalid-vibrate" : ""}`}
                                        required
                                    >
                                        <option value="">Select a class</option>
                                        {Object.values(PermissionsClass).map(className => (
                                            <option key={className} value={className}>
                                                {className}
                                            </option>
                                        ))}
                                    </select>
                                    {permissionFormErrors.class && permissionTouched.class && <span className="error-text">{permissionFormErrors.class}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={newPermission.description || ""}
                                        onChange={e => {
                                            setNewPermission({ ...newPermission, description: e.target.value });
                                            setPermissionFormErrors({ ...permissionFormErrors, description: validatePermissionDescription(e.target.value) });
                                        }}
                                        onBlur={() => setPermissionTouched({ ...permissionTouched, description: true })}
                                        className={`user-edit-input ${permissionTouched.description && permissionFormErrors.description ? "invalid-vibrate" : ""}`}
                                    />
                                    {permissionFormErrors.description && permissionTouched.description && <span className="error-text">{permissionFormErrors.description}</span>}
                                </div>
                                <button className="action-button" onClick={handleCreatePermission} disabled={loading}>
                                    Create Permission
                                </button>
                            </div>
                        </div>
                    )}













                    {/* User Details View */}
                    {view === "user-details" && selectedUser && userPermissions.canViewUserDetails && (
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
                                            value={formatPhoneDisplay(rawPhone === "" ? "" : (rawPhone || editedUser.phone || selectedUser.phone || ""))}
                                            onChange={e => handlePhoneChange(e, true)}
                                            onBlur={() => markUserTouched("phone")}
                                            placeholder="XX XXX XXX"
                                            className={`user-edit-input ${userTouched.phone ? "touched" : ""} ${userTouched.phone && userFormErrors.phone ? "invalid-vibrate" : ""}`}
                                            required
                                            maxLength={10}
                                        />
                                        <input
                                            type="text"
                                            value={formatWalletDisplay(rawWallet || editedUser.wallet || selectedUser.wallet || "")}
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
                                                    passwordConfirm: validatePasswordConfirm(e.target.value, editedUser.passwordConfirm || "", false),
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
                                                    passwordConfirm: validatePasswordConfirm(editedUser.password || "", e.target.value, false),
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
                                {/* Role Management Section */}
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
                                                                disabled={loading || (role.name === ROLES.SUPER_ADMIN) || !userPermissions.canRevokeRoles}
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

                                {/* Permission Overrides Section */}
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

                                {/* Supervisor/Manager Assignments Section */}
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
                                                {selectedUser.Roles?.some(r => r.name === "Manager") && userPermissions.canReadManagers && (
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
                                                {selectedUser.Roles?.some(r => r.name === "Supervisor") && userPermissions.canReadSupervisors && (
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
                                        {roles.find(role => role.roleID === activeRolePopup) && (
                                            <>
                                                <h4>{roles.find(role => role.roleID === activeRolePopup)!.name}</h4>
                                                <p>{roles.find(role => role.roleID === activeRolePopup)!.description || 'No description available'}</p>
                                                <h5>Permissions by Class:</h5>
                                                {Object.entries(getCategorizedPermissionsForRole(roles.find(role => role.roleID === activeRolePopup)!)).length > 0 ? (
                                                    Object.entries(getCategorizedPermissionsForRole(roles.find(role => role.roleID === activeRolePopup)!)).map(([className, perms]) => (
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
                                                ) : <p>No permissions assigned</p>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </section>
        </div>
    );
};

export default AdminDashboard;