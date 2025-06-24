import React, { useState, useCallback, useMemo } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import User from "../../../models/User";
import { updateUser, deleteUser } from "../../../apis/userAPI";
import "../AdminDashboard.css";
import { ViewMode } from "../adminTypes";
import Role from "models/Role";

interface UserDetailsProps {
    selectedUser: User | null;
    setSelectedUser: React.Dispatch<React.SetStateAction<User | null>>;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    view: ViewMode;
    setView: (view: ViewMode) => void;
    userPermissions: {
        canViewUserDetails: boolean;
        canUpdateUsers: boolean;
        canDeleteUsers: boolean;
    };
    setError: React.Dispatch<React.SetStateAction<string | null>>;
    roleManagement: React.ReactNode;
    assignmentsManagement: React.ReactNode;
    infoPopupWrapper: React.ReactNode;
}

interface FormErrors {
    firstname: string;
    lastname: string;
    email: string;
    phone: string;
    password: string;
    passwordConfirm: string;
}

interface TouchedFields {
    firstname: boolean;
    lastname: boolean;
    email: boolean;
    phone: boolean;
    password: boolean;
    passwordConfirm: boolean;
}

const PHONE_REGEX = /^\d{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generatePassword = (): string => {
    if (import.meta.env.MODE === "development") {
        return "123456Pp*";
    }

    const length = 12;
    const upperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowerCase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    const allChars = upperCase + lowerCase + numbers + symbols;

    let password = "";
    password += upperCase[Math.floor(Math.random() * upperCase.length)];
    password += lowerCase[Math.floor(Math.random() * lowerCase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    password = password
        .split("")
        .sort(() => Math.random() - 0.5)
        .join("");

    return password;
};

const UserDetails: React.FC<UserDetailsProps> = ({
    selectedUser,
    setSelectedUser,
    users,
    setUsers,
    view,
    setView,
    userPermissions,
    setError,
    roleManagement,
    assignmentsManagement,
    infoPopupWrapper,
}) => {
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [editedUser, setEditedUser] = useState<
        Partial<User> & { passwordConfirm?: string }
    >({});
    const [rawPhone, setRawPhone] = useState("");
    const [formErrors, setFormErrors] = useState<FormErrors>({
        firstname: "",
        lastname: "",
        email: "",
        phone: "",
        password: "",
        passwordConfirm: "",
    });
    const [touched, setTouched] = useState<TouchedFields>({
        firstname: false,
        lastname: false,
        email: false,
        phone: false,
        password: false,
        passwordConfirm: false,
    });
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState("");

    // Check if selectedUser has superadmin role
    const isSelectedUserSuperAdmin = useMemo(() => {
        if (!selectedUser || !selectedUser.Roles) return false;
        return selectedUser.Roles.some(
            (role: Role) => role.name === import.meta.env.VITE_ROLES_SUPER_ADMIN
        );
    }, [selectedUser]);

    // Validation Helpers
    const validateName = useCallback((value: string, field: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return `${field} is required.`;
        if (!/^[a-zA-Z]{2,50}$/.test(trimmed))
            return `${field} must be 2–50 letters only.`;
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

    const validatePassword = useCallback((value: string): string => {
        if (!value) return "";
        if (value.length < 6) return "Password must be at least 6 characters.";
        return "";
    }, []);

    const validatePasswordConfirm = useCallback(
        (password: string, confirm: string): string => {
            if (!password && !confirm) return "";
            if (password !== confirm) return "Passwords do not match.";
            return "";
        },
        []
    );

    const formatPhoneDisplay = useCallback((rawValue: string): string => {
        const digits = rawValue.replace(/[^\d]/g, "");
        let formatted = "";
        if (digits.length > 0) formatted += digits.slice(0, 2);
        if (digits.length > 2) formatted += " " + digits.slice(2, 5);
        if (digits.length > 5) formatted += " " + digits.slice(5, 8);
        return formatted;
    }, []);

    const stripPhoneForDatabase = useCallback((raw: string): string => {
        return raw.replace(/[^\d]/g, "");
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
            password: "",
            passwordConfirm: "",
        });
        setRawPhone(selectedUser.phone || "");
    }, [selectedUser, userPermissions.canUpdateUsers]);

    const handlePhoneChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 8);
            setRawPhone(raw);
            setEditedUser((prev) => ({ ...prev, phone: stripPhoneForDatabase(raw) }));
            setFormErrors((prev) => ({ ...prev, phone: validatePhone(raw) }));
        },
        [stripPhoneForDatabase, validatePhone]
    );

    const handleResetPassword = useCallback(() => {
        const newPassword = generatePassword();
        setGeneratedPassword(newPassword);
        setShowResetConfirm(true);
    }, []);

    const handleConfirmReset = useCallback(async () => {
        if (!selectedUser || !userPermissions.canUpdateUsers) return;
        try {
            const updatePayload: Partial<User> = {
                password: generatedPassword,
            };
            const updatedUser = await updateUser(selectedUser.userID, updatePayload);
            setUsers(
                users.map((u) => (u.userID === selectedUser.userID ? updatedUser : u))
            );
            setSelectedUser(updatedUser);
            setShowResetConfirm(false);
            setGeneratedPassword("");
            setError(null);
        } catch (error) {
            setError(
                error instanceof Error ? error.message : "Failed to reset password."
            );
        }
    }, [
        selectedUser,
        userPermissions.canUpdateUsers,
        generatedPassword,
        users,
        setUsers,
        setSelectedUser,
        setError,
    ]);

    const handleCancelReset = useCallback(() => {
        setShowResetConfirm(false);
        setGeneratedPassword("");
    }, []);

    const handleSaveUserEdit = useCallback(async () => {
        if (!selectedUser || !userPermissions.canUpdateUsers || !isEditingUser)
            return;
        const phoneValue = rawPhone || selectedUser.phone;
        const errors: FormErrors = {
            firstname: validateName(editedUser.firstname || "", "First name"),
            lastname: validateName(editedUser.lastname || "", "Last name"),
            email: validateEmail(editedUser.email || ""),
            phone: validatePhone(phoneValue),
            password: validatePassword(editedUser.password || ""),
            passwordConfirm: validatePasswordConfirm(
                editedUser.password || "",
                editedUser.passwordConfirm || ""
            ),
        };
        setFormErrors(errors);
        setTouched({
            firstname: true,
            lastname: true,
            email: true,
            phone: true,
            password: true,
            passwordConfirm: true,
        });
        if (Object.values(errors).some((error) => error)) {
            setError("Please fix the errors below before saving.");
            return;
        }
        try {
            const updatePayload: Partial<User> = {
                firstname: editedUser.firstname!.trim(),
                lastname: editedUser.lastname!.trim(),
                email: editedUser.email!.trim(),
                phone: stripPhoneForDatabase(phoneValue),
            };
            if (editedUser.password) updatePayload.password = editedUser.password;
            const updatedUser = await updateUser(selectedUser.userID, updatePayload);
            setUsers(
                users.map((u) => (u.userID === selectedUser.userID ? updatedUser : u))
            );
            setSelectedUser(updatedUser);
            setIsEditingUser(false);
            setEditedUser({});
            setFormErrors({
                firstname: "",
                lastname: "",
                email: "",
                phone: "",
                password: "",
                passwordConfirm: "",
            });
            setTouched({
                firstname: false,
                lastname: false,
                email: false,
                phone: false,
                password: false,
                passwordConfirm: false,
            });
            setRawPhone("");
            setError(null);
        } catch (error) {
            let errorMessage =
                error instanceof Error ? error.message : "Failed to update user.";
            if (
                errorMessage.includes(
                    "This Google email is already linked to another user"
                )
            ) {
                errorMessage =
                    "This email is already associated with another Google account.";
                setFormErrors((prev) => ({ ...prev, email: errorMessage }));
            }
            setError(errorMessage);
        }
    }, [
        selectedUser,
        userPermissions.canUpdateUsers,
        isEditingUser,
        editedUser,
        rawPhone,
        users,
        stripPhoneForDatabase,
        validateName,
        validateEmail,
        validatePhone,
        validatePassword,
        validatePasswordConfirm,
        setUsers,
        setSelectedUser,
        setError,
    ]);

    const handleCancelEdit = useCallback(() => {
        setIsEditingUser(false);
        setEditedUser({});
        setFormErrors({
            firstname: "",
            lastname: "",
            email: "",
            phone: "",
            password: "",
            passwordConfirm: "",
        });
        setTouched({
            firstname: false,
            lastname: false,
            email: false,
            phone: false,
            password: false,
            passwordConfirm: false,
        });
        setRawPhone("");
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
            setError(null);
        } catch (error) {
            setError(
                error instanceof Error ? error.message : "Failed to delete user."
            );
        }
    }, [
        selectedUser,
        userPermissions.canDeleteUsers,
        users,
        setUsers,
        setSelectedUser,
        setView,
        setError,
    ]);

    const isValidBase64 = (str: string): boolean => {
        try {
            if (!str || str === "[object Object]" || str === "W29iamVjdCBPYmplY3Rd") {
                console.warn("Invalid base64: Invalid or object detected");
                return false;
            }
            if (!/^[A-Za-z0-9+/=]+$/.test(str)) {
                console.warn("Base64 string contains invalid characters");
                return false;
            }
            const decoded = atob(str);
            return btoa(decoded) === str;
        } catch (error) {
            console.warn("Base64 validation failed:", error);
            return false;
        }
    };

    const getImageSrc = (base64: string): string => {
        if (!base64) {
            console.warn("Empty base64 string provided");
            return "";
        }
        const prefix = base64.substring(0, Math.min(20, base64.length));
        let mimeType = "image/jpeg";
        if (prefix.includes("iVBORw0KGgo")) {
            mimeType = "image/png";
        } else if (prefix.includes("/9j/")) {
            mimeType = "image/jpeg";
        }
        return `data:${mimeType};base64,${base64}`;
    };

    if (
        view !== "user-details" ||
        !selectedUser ||
        !userPermissions.canViewUserDetails
    ) {
        return null;
    }

    return (
        <div className="details-card">
            <div className="card-header">
                {isEditingUser ? (
                    <div className="u-profile-panel">
                        <h2>Edit User</h2>
                        <div className="u-profile-body">
                            <div className="u-profile-header">
                                {selectedUser.PFP &&
                                    typeof selectedUser.PFP === "string" &&
                                    isValidBase64(selectedUser.PFP) ? (
                                    <img
                                        src={getImageSrc(selectedUser.PFP)}
                                        alt={`${selectedUser.firstname} ${selectedUser.lastname}'s profile picture`}
                                        className="u-profile-image"
                                        onError={(e) => {
                                            console.warn(
                                                "Failed to load profile picture:",
                                                selectedUser.PFP!.substring(0, 50)
                                            );
                                            e.currentTarget.style.display = "none";
                                        }}
                                    />
                                ) : (
                                    <div className="u-profile-image-placeholder">
                                        {(editedUser.firstname || selectedUser.firstname)[0]}
                                        {(editedUser.lastname || selectedUser.lastname)[0]}
                                    </div>
                                )}
                                <div className="u-profile-identity">
                                    <input
                                        id="firstname"
                                        type="text"
                                        value={editedUser.firstname || ""}
                                        onChange={(e) => {
                                            setEditedUser((prev) => ({
                                                ...prev,
                                                firstname: e.target.value,
                                            }));
                                            setFormErrors((prev) => ({
                                                ...prev,
                                                firstname: validateName(e.target.value, "First name"),
                                            }));
                                            setTouched((prev) => ({ ...prev, firstname: true }));
                                        }}
                                        placeholder="Enter first name"
                                        className={`u-profile-name user-edit-input ${touched.firstname && formErrors.firstname
                                            ? "invalid-vibrate"
                                            : ""
                                            }`}
                                        required
                                    />
                                    {formErrors.firstname && touched.firstname && (
                                        <span className="error-text">{formErrors.firstname}</span>
                                    )}
                                    <input
                                        id="lastname"
                                        type="text"
                                        value={editedUser.lastname || ""}
                                        onChange={(e) => {
                                            setEditedUser((prev) => ({
                                                ...prev,
                                                lastname: e.target.value,
                                            }));
                                            setFormErrors((prev) => ({
                                                ...prev,
                                                lastname: validateName(e.target.value, "Last name"),
                                            }));
                                            setTouched((prev) => ({ ...prev, lastname: true }));
                                        }}
                                        placeholder="Enter last name"
                                        className={`u-profile-name user-edit-input ${touched.lastname && formErrors.lastname
                                            ? "invalid-vibrate"
                                            : ""
                                            }`}
                                        required
                                    />
                                    {formErrors.lastname && touched.lastname && (
                                        <span className="error-text">{formErrors.lastname}</span>
                                    )}
                                    <span className="u-profile-id">ID: {selectedUser.userID}</span>
                                </div>
                            </div>
                            <div className="u-profile-info">
                                <div className="u-info-row">
                                    <span className="u-info-label">Email</span>
                                    <div className="u-info-value">
                                        <input
                                            id="email"
                                            type="email"
                                            value={editedUser.email || ""}
                                            onChange={(e) => {
                                                setEditedUser((prev) => ({
                                                    ...prev,
                                                    email: e.target.value,
                                                }));
                                                setFormErrors((prev) => ({
                                                    ...prev,
                                                    email: validateEmail(e.target.value),
                                                }));
                                                setTouched((prev) => ({ ...prev, email: true }));
                                            }}
                                            placeholder="Enter email"
                                            className={`user-edit-input ${touched.email && formErrors.email
                                                ? "invalid-vibrate"
                                                : ""
                                                }`}
                                            required
                                        />
                                        {formErrors.email && touched.email && (
                                            <span className="error-text">{formErrors.email}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="u-info-row">
                                    <span className="u-info-label">Phone</span>
                                    <div className="u-info-value">
                                        <input
                                            id="phone"
                                            type="text"
                                            value={formatPhoneDisplay(rawPhone)}
                                            onChange={handlePhoneChange}
                                            placeholder="XX XXX XXX"
                                            className={`user-edit-input ${touched.phone && formErrors.phone
                                                ? "invalid-vibrate"
                                                : ""
                                                }`}
                                            required
                                            maxLength={10}
                                        />
                                        {formErrors.phone && touched.phone && (
                                            <span className="error-text">{formErrors.phone}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="u-info-row">
                                    <span className="u-info-label">Password</span>
                                    <div className="u-info-value">
                                        <button
                                            className="action-button reset-button"
                                            onClick={handleResetPassword}
                                        >
                                            Reset Password
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="user-edit-actions">
                            <button className="action-button" onClick={handleSaveUserEdit}>
                                Save
                            </button>
                            <button className="cancel-button" onClick={handleCancelEdit}>
                                Cancel
                            </button>
                        </div>
                        {showResetConfirm && (
                            <div className="reset-confirm-popup">
                                <p>
                                    Are you sure you want to reset the password? The new password
                                    will be: <strong>{generatedPassword}</strong>
                                </p>
                                <p>It will be sent to the user's email.</p>
                                <div className="reset-confirm-actions">
                                    <button
                                        className="action-button"
                                        onClick={handleConfirmReset}
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        className="cancel-button"
                                        onClick={handleCancelReset}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <h2>User Details</h2>
                        {userPermissions.canUpdateUsers && !isSelectedUserSuperAdmin && (
                            <div className="user-actions">
                                <button className="edit-button" onClick={handleEditUser}>
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
                <div>
                    <div className="u-profile-panel">
                        <div className="u-profile-body">
                            <div className="u-profile-header">
                                {selectedUser.PFP &&
                                    typeof selectedUser.PFP === "string" &&
                                    isValidBase64(selectedUser.PFP) ? (
                                    <img
                                        src={getImageSrc(selectedUser.PFP)}
                                        alt={`${selectedUser.firstname} ${selectedUser.lastname}'s profile picture`}
                                        className="u-profile-image"
                                        onError={(e) => {
                                            console.warn(
                                                "Failed to load profile picture:",
                                                selectedUser.PFP!.substring(0, 50)
                                            );
                                            e.currentTarget.style.display = "none";
                                        }}
                                    />
                                ) : (
                                    <div className="u-profile-image-placeholder">
                                        {selectedUser.firstname[0]}
                                        {selectedUser.lastname[0]}
                                    </div>
                                )}
                                <div className="u-profile-identity">
                                    <span className="u-profile-name">
                                        {selectedUser.firstname} {selectedUser.lastname}
                                    </span>
                                    <span className="u-profile-id">ID: {selectedUser.userID}</span>
                                </div>
                            </div>
                            <div className="u-profile-info">
                                <div className="u-info-row">
                                    <span className="u-info-label">Email</span>
                                    <span className="u-info-value">{selectedUser.email}</span>
                                </div>
                                <div className="u-info-row">
                                    <span className="u-info-label">Phone</span>
                                    <span className="u-info-value">{`+216 ${formatPhoneDisplay(
                                        selectedUser.phone || "N/A"
                                    )}`}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="u-admin-settings">
                        {roleManagement}
                        {assignmentsManagement}
                    </div>
                    {infoPopupWrapper}
                </div>
            )}
        </div>
    );
};

export default React.memo(UserDetails);