import React, { useState } from "react";
import { FaAngleDown, FaInfoCircle } from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import { createUser } from "../../../apis/userAPI";
import User from "../../../models/User";
import Role from "../../../models/Role";
import Permission from "../../../models/Permission";
import "../AdminDashboard.css";
import { assignRolesToUser, getRolesByUser } from "../../../apis/roleAPI";

interface UserAddProps {
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    roles: Role[];
    view: string;
    token: string;
    setView: (view: "users" | "roles" | "permissions" | "add-user" | "add-role" | "add-permission" | "user-details") => void;
    setError: (error: string | null) => void;
}

const UserAdd: React.FC<UserAddProps> = ({
    users,
    setUsers,
    roles,
    view,
    token,
    setView,
    setError
}) => {
    const { effectivePermissions, userRoles } = useAuth();

    // State
    const [newUser, setNewUser] = useState<Partial<User>>({});
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [selectedRolesForNewUser, setSelectedRolesForNewUser] = useState<string[]>([]);
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
    const [activeRolePopup, setActiveRolePopup] = useState<string | null>(null);
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    // Permission Checks
    const userPermissions = {
        canCreateUsers: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_USERS),
        canAssignRoles: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_ROLES)
    };

    const isSuperAdmin = userRoles?.some(r => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN);

    // Handlers
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
        if (Object.values(errors).some((error) => error)) {
            setError("Please correct the errors before submitting.");
            return;
        }

        setLoading(true);
        try {
            const createdUser = await createUser(
                {
                    email: newUser.email!.trim(),
                    password: newUser.password!,
                    firstname: newUser.firstname!.trim(),
                    lastname: newUser.lastname!.trim(),
                    phone: stripPhoneForDatabase(rawPhone),
                    wallet: stripWalletForDatabase(rawWallet),
                },
                token
            );

            if (selectedRolesForNewUser.length > 0 && userPermissions.canAssignRoles) {
                const filteredRoles = selectedRolesForNewUser.filter((roleID) => {
                    const role = roles.find((r) => r.roleID === roleID);
                    return role?.name !== import.meta.env.VITE_ROLES_SUPER_ADMIN || isSuperAdmin;
                });
                if (filteredRoles.length > 0) {
                    await assignRolesToUser(createdUser.userID, filteredRoles, token);
                    createdUser.Roles = await getRolesByUser(createdUser.userID, token);
                }
                if (
                    selectedRolesForNewUser.some(
                        (roleID) => roles.find((r) => r.roleID === roleID)?.name === import.meta.env.VITE_ROLES_SUPER_ADMIN
                    ) &&
                    !isSuperAdmin
                ) {
                    setError("Super Admin role assignment skipped: Only Super Admins can assign this role.");
                }
            }

            setUsers([...users, createdUser]);
            resetFormStates();
            setSelectedRolesForNewUser([]);
            setView("users");
            setError(null);
        } catch (error) {
            console.error("Failed to create user:", error);
            if (error instanceof Error) {
                setError(error.message || "Failed to create user due to an unexpected error.");
            } else {
                setError("Failed to create user due to an unexpected error.");
            }
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
        setNewUser({ ...newUser, phone: stripPhoneForDatabase(raw) });
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
        setNewUser({});
        setRawPhone("");
        setRawWallet("");
        setPasswordConfirm("");
        setUserFormErrors({ firstname: "", lastname: "", email: "", phone: "", wallet: "", password: "", passwordConfirm: "" });
        setUserTouched({ firstname: false, lastname: false, email: false, phone: false, wallet: false, password: false, passwordConfirm: false });
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

    const getCategorizedPermissionsForRole = (role: Role) => {
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

    // Render
    if (view !== "add-user" || !userPermissions.canCreateUsers) return null;

    return (
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
                <hr />
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
                            onChange={handlePhoneChange}
                            onBlur={() => markUserTouched("phone")}
                            placeholder="XX XXX XXX"
                            className={`user-edit-input ${userTouched.phone ? "touched" : ""} ${userTouched.phone && userFormErrors.phone ? "invalid-vibrate" : ""}`}
                            required
                            maxLength={10}
                        />
                        {userFormErrors.phone && userTouched.phone && <span className="error-text">{userFormErrors.phone}</span>}
                    </div>
                </div>
            </div>
            <div className="form-section">
                <hr />
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
                                    passwordConfirm: validatePasswordConfirm(e.target.value, passwordConfirm, true)
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
                                    passwordConfirm: validatePasswordConfirm(newUser.password || "", e.target.value, true)
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
                        const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 16);
                        setRawWallet(raw);
                        setNewUser({ ...newUser, wallet: stripWalletForDatabase(raw) });
                        setUserFormErrors({ ...userFormErrors, wallet: validateWallet(raw, true) });
                    }}
                    onBlur={() => markUserTouched("wallet")}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className={`user-edit-input ${userTouched.wallet ? "touched" : ""} ${userTouched.wallet && userFormErrors.wallet ? "invalid-vibrate" : ""}`}
                    required
                    maxLength={19}
                />
                {userFormErrors.wallet && userTouched.wallet && <span className="error-text">{userFormErrors.wallet}</span>}
            </div>
            {userPermissions.canAssignRoles && (
                <div className="form-section">
                    <hr />
                    <h3>Role Assignment</h3>
                    <div className="form-group">
                        <label>Assign Roles *</label>
                        <div className="roles-grid">
                            {roles.map(role => (
                                <div key={role.roleID} className="role-toggle-container">
                                    <button
                                        className={`role-toggle-button ${selectedRolesForNewUser.includes(role.roleID) ? "active" : ""}`}
                                        onClick={() => {
                                            if (role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN && !isSuperAdmin) {
                                                setError("Only Super Admins can assign the Super Admin role.");
                                                return;
                                            }
                                            setSelectedRolesForNewUser(prev =>
                                                prev.includes(role.roleID) ? prev.filter(id => id !== role.roleID) : [...prev, role.roleID]
                                            );
                                        }}
                                        disabled={loading}
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
            <button className="action-button" onClick={handleCreateUser} disabled={loading}>
                {loading ? "Creating..." : "Create User"}
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
    );
};

export default UserAdd;