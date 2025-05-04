/**
 * UserDetails.tsx
 * Handles the display and editing of user basic information with form validation and phone formatting.
 */

import React, { useState, useCallback } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import User from "../../../models/User";
import { useError } from "../../../context/ErrorContext";
import { updateUser, deleteUser } from "../../../apis/userAPI";
import "../AdminDashboard.css";
import { ViewMode } from "../adminTypes";

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
    roleManagement: React.ReactNode;
    permissionOverrides: React.ReactNode;
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

const UserDetails: React.FC<UserDetailsProps> = ({
    selectedUser,
    setSelectedUser,
    users,
    setUsers,
    view,
    setView,
    userPermissions,
    roleManagement,
    permissionOverrides,
    assignmentsManagement,
    infoPopupWrapper,
}) => {
    const { setError: setGlobalError } = useError();
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
            setGlobalError("Please fix the errors below before saving.");
            return;
        }
        try {
            const updatePayload: Partial<User> & { PFP?: File | null } = {
                firstname: editedUser.firstname!.trim(),
                lastname: editedUser.lastname!.trim(),
                email: editedUser.email!.trim(),
                phone: stripPhoneForDatabase(phoneValue),
                PFP: null,
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
            setGlobalError(errorMessage);
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
        } catch (error) {
            setGlobalError(
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
        setGlobalError,
    ]);

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
                                    className={`user-edit-input ${touched.firstname && formErrors.firstname
                                        ? "invalid-vibrate"
                                        : ""
                                        }`}
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
                                    className={`user-edit-input ${touched.lastname && formErrors.lastname
                                        ? "invalid-vibrate"
                                        : ""
                                        }`}
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
                                    className={`user-edit-input ${touched.email && formErrors.email ? "invalid-vibrate" : ""
                                        }`}
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
                                    className={`user-edit-input ${touched.phone && formErrors.phone ? "invalid-vibrate" : ""
                                        }`}
                                    required
                                    maxLength={10}
                                />
                                {formErrors.phone && touched.phone && (
                                    <span className="error-text">{formErrors.phone}</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="password">Password (Optional)</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={editedUser.password || ""}
                                    onChange={(e) => {
                                        setEditedUser((prev) => ({
                                            ...prev,
                                            password: e.target.value,
                                        }));
                                        setFormErrors((prev) => ({
                                            ...prev,
                                            password: validatePassword(e.target.value),
                                            passwordConfirm: validatePasswordConfirm(
                                                e.target.value,
                                                editedUser.passwordConfirm || ""
                                            ),
                                        }));
                                        setTouched((prev) => ({ ...prev, password: true }));
                                    }}
                                    placeholder="Enter new password"
                                    className={`user-edit-input ${touched.password && formErrors.password
                                        ? "invalid-vibrate"
                                        : ""
                                        }`}
                                />
                                {formErrors.password && touched.password && (
                                    <span className="error-text">{formErrors.password}</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="passwordConfirm">
                                    Confirm Password (Optional)
                                </label>
                                <input
                                    id="passwordConfirm"
                                    type="password"
                                    value={editedUser.passwordConfirm || ""}
                                    onChange={(e) => {
                                        setEditedUser((prev) => ({
                                            ...prev,
                                            passwordConfirm: e.target.value,
                                        }));
                                        setFormErrors((prev) => ({
                                            ...prev,
                                            passwordConfirm: validatePasswordConfirm(
                                                editedUser.password || "",
                                                e.target.value
                                            ),
                                        }));
                                        setTouched((prev) => ({ ...prev, passwordConfirm: true }));
                                    }}
                                    placeholder="Confirm new password"
                                    className={`user-edit-input ${touched.passwordConfirm && formErrors.passwordConfirm
                                        ? "invalid-vibrate"
                                        : ""
                                        }`}
                                />
                                {formErrors.passwordConfirm && touched.passwordConfirm && (
                                    <span className="error-text">
                                        {formErrors.passwordConfirm}
                                    </span>
                                )}
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
                    </div>
                ) : (
                    <>
                        <h2>User Details</h2>
                        {userPermissions.canUpdateUsers && (
                            <div className="user-actions">
                                <button className="edit-button" onClick={handleEditUser}>
                                    <FaEdit /> Edit
                                </button>
                                {userPermissions.canDeleteUsers && (
                                    <button className="delete-button" onClick={handleDeleteUser}>
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
                    <div className="form-section">
                        <h3>Basic Information</h3>
                        <div className="info-grid">
                            <p>
                                <strong>Name:</strong> {selectedUser.firstname}{" "}
                                {selectedUser.lastname}
                            </p>
                            <p>
                                <strong>Email:</strong> {selectedUser.email}
                            </p>
                            <p>
                                <strong>Phone:</strong>{" "}
                                {`+216 ${formatPhoneDisplay(selectedUser.phone || "N/A")}`}
                            </p>
                        </div>
                    </div>
                    <div className="dropdown-stack">
                        {roleManagement}
                        {permissionOverrides}
                        {assignmentsManagement}
                    </div>
                    {infoPopupWrapper}
                </div>
            )}
        </div>
    );
};

export default React.memo(UserDetails);