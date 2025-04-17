import React, { useState } from "react";
import { FaAngleDown, FaInfoCircle } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

// Context and APIs
import { useAuth } from "../../../context/AuthContext";
import { useError } from "../../../context/ErrorContext";
import { assignRolesToUser, getRolesByUser } from "../../../apis/roleAPI";
import { createUser } from "../../../apis/userAPI";

// Models and Types
import Role from "../../../models/Role";
import User from "../../../models/User";
import Permission from "../../../models/Permission";

import { ViewMode } from "../adminTypes";

// Components
import InfoPopup from "../InfoPopup";

// Styles
import "../AdminDashboard.css";

// Props Interface
interface UserAddProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  roles: Role[];
  view: string;
  setView: (view: ViewMode) => void;
  setError: (error: string | null) => void;
}

// Main Component
const UserAdd: React.FC<UserAddProps> = ({
  users,
  setUsers,
  roles,
  view,
  setView,
  setError,
}) => {
  const { t } = useTranslation();
  const { effectivePermissions, userRoles } = useAuth();
  const { setError: setGlobalError } = useError();

  // State
  const [newUser, setNewUser] = useState<Partial<User>>({});
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [selectedRolesForNewUser, setSelectedRolesForNewUser] = useState<
    string[]
  >([]);
  const [rawPhone, setRawPhone] = useState("");
  const [rawWallet, setRawWallet] = useState("");
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
  const [activeRolePopup, setActiveRolePopup] = useState<string | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(false);

  // Permissions
  const userPermissions = {
    canCreateUsers: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_USERS
    ),
    canAssignRoles: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_ROLES
    ),
  };

  const isSuperAdmin = userRoles?.some(
    (r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN
  );

  // Validation
  const markUserTouched = (field: keyof typeof userTouched) => {
    setUserTouched((prev) => ({ ...prev, [field]: true }));
  };

  const validateName = (value: string, field: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return t(`userAdd.validation.${field}Required`);
    if (trimmed.length < 3) return t(`userAdd.validation.${field}LengthMin`);
    if (trimmed.length > 20) return t(`userAdd.validation.${field}LengthMax`);
    if (!/^[a-zA-Z\s'-]+$/.test(trimmed))
      return t(`userAdd.validation.${field}Format`);
    return "";
  };

  const validateEmail = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return t("userAdd.validation.emailRequired");
    if (trimmed.length > 70) return t("userAdd.validation.emailLength");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
      return t("userAdd.validation.emailFormat");
    return "";
  };

  const validatePhone = (value: string): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return t("userAdd.validation.phoneRequired");
    if (digits.length !== 8) return t("userAdd.validation.phoneLength");
    return "";
  };

  const validateWallet = (value: string, isNewUser: boolean): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits && isNewUser) return t("userAdd.validation.walletRequired");
    if (digits && digits.length !== 16)
      return t("userAdd.validation.walletLength");
    return "";
  };

  const validatePassword = (value: string, isNewUser: boolean): string => {
    if (!value && isNewUser) return t("userAdd.validation.passwordRequired");
    if (value && value.length < 8)
      return t("userAdd.validation.passwordLengthMin");
    if (value.length > 128) return t("userAdd.validation.passwordLengthMax");
    if (
      value &&
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$/.test(value)
    ) {
      return t("userAdd.validation.passwordFormat");
    }
    return "";
  };

  const validatePasswordConfirm = (
    password: string,
    confirm: string,
    isNewUser: boolean
  ): string => {
    if ((!password && confirm) || (password && !confirm && isNewUser))
      return t("userAdd.validation.passwordConfirmRequired");
    if (password && confirm && password !== confirm)
      return t("userAdd.validation.passwordMismatch");
    return "";
  };

  // Formatting
  const formatPhoneDisplay = (rawValue: string): string => {
    const digits = rawValue.replace(/[^\d]/g, "");
    let formatted = "";
    if (digits.length > 0) formatted += digits.slice(0, 2);
    if (digits.length > 2) formatted += " " + digits.slice(2, 5);
    if (digits.length > 5) formatted += " " + digits.slice(5, 8);
    return formatted;
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

  const stripPhoneForDatabase = (raw: string): string => {
    return raw.replace(/[^\d]/g, "");
  };

  const stripWalletForDatabase = (formatted: string): string => {
    return formatted.replace(/[^\d]/g, "");
  };

  // Handlers
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 8);
    setRawPhone(raw);
    setNewUser({ ...newUser, phone: stripPhoneForDatabase(raw) });
    setUserFormErrors({ ...userFormErrors, phone: validatePhone(raw) });
  };

  const handleWalletChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 16);
    setRawWallet(raw);
    setNewUser({ ...newUser, wallet: stripWalletForDatabase(raw) });
    setUserFormErrors({
      ...userFormErrors,
      wallet: validateWallet(raw, true),
    });
  };

  const resetFormStates = () => {
    setNewUser({});
    setRawPhone("");
    setRawWallet("");
    setPasswordConfirm("");
    setUserFormErrors({
      firstname: "",
      lastname: "",
      email: "",
      phone: "",
      wallet: "",
      password: "",
      passwordConfirm: "",
    });
    setUserTouched({
      firstname: false,
      lastname: false,
      email: false,
      phone: false,
      wallet: false,
      password: false,
      passwordConfirm: false,
    });
  };

  const handleCreateUser = async () => {
    if (!userPermissions.canCreateUsers) return;

    const errors = {
      firstname: validateName(newUser.firstname || "", "firstname"),
      lastname: validateName(newUser.lastname || "", "lastname"),
      email: validateEmail(newUser.email || ""),
      phone: validatePhone(rawPhone),
      wallet: validateWallet(rawWallet, true),
      password: validatePassword(newUser.password || "", true),
      passwordConfirm: validatePasswordConfirm(
        newUser.password || "",
        passwordConfirm,
        true
      ),
    };

    setUserFormErrors(errors);
    setUserTouched({
      firstname: true,
      lastname: true,
      email: true,
      phone: true,
      wallet: true,
      password: true,
      passwordConfirm: true,
    });

    if (Object.values(errors).some((error) => error)) {
      const errorMessage = t("userAdd.error.validationFailed");
      setError(errorMessage);
      setGlobalError(errorMessage);
      return;
    }

    setLoading(true);
    try {
      const createdUser = await createUser({
        email: newUser.email!.trim(),
        password: newUser.password!,
        firstname: newUser.firstname!.trim(),
        lastname: newUser.lastname!.trim(),
        phone: stripPhoneForDatabase(rawPhone),
        wallet: stripWalletForDatabase(rawWallet),
      });

      if (
        selectedRolesForNewUser.length > 0 &&
        userPermissions.canAssignRoles
      ) {
        const filteredRoles = selectedRolesForNewUser.filter(
          (roleID) =>
            roles.find((r) => r.roleID === roleID)?.name !==
            import.meta.env.VITE_ROLES_SUPER_ADMIN
        );
        if (filteredRoles.length > 0) {
          await assignRolesToUser(createdUser.userID, filteredRoles);
          createdUser.Roles = await getRolesByUser(createdUser.userID);
        }
      }

      setUsers((prev) => [...prev, createdUser]);
      resetFormStates();
      setSelectedRolesForNewUser([]);
      setView("users");
      setError(null);
      setGlobalError(null);
    } catch (error: unknown) {
      const errorMessage = t("userAdd.error.createFailed");
      setError(errorMessage);
      setGlobalError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Role Popup
  const toggleRolePopup = (roleID: string) => {
    setActiveRolePopup(activeRolePopup === roleID ? null : roleID);
    setExpandedClasses(new Set());
  };

  const toggleClassExpansion = (className: string) => {
    setExpandedClasses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(className)) newSet.delete(className);
      else newSet.add(className);
      return newSet;
    });
  };

  const getCategorizedPermissionsForRole = (role: Role) => {
    const byClass: { [key: string]: Permission[] } = {};
    role.permissions
      ?.filter(
        (perm) => isSuperAdmin || !["Role", "Permission"].includes(perm.class)
      )
      .forEach((perm) => {
        const formattedName = perm.name
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());
        if (!byClass[perm.class]) byClass[perm.class] = [];
        byClass[perm.class].push({ ...perm, name: formattedName });
      });
    return byClass;
  };

  const renderRolePopupContent = (roleID: string) => {
    const role = roles.find((r) => r.roleID === roleID);
    if (!role) return <p>{t("userAdd.rolePopup.notFound")}</p>;
    return (
      <>
        <h4>{role.name}</h4>
        <p>{role.description || t("userAdd.rolePopup.noDescription")}</p>
        <h5>{t("userAdd.rolePopup.permissionsTitle")}</h5>
        {Object.entries(getCategorizedPermissionsForRole(role)).length > 0 ? (
          Object.entries(getCategorizedPermissionsForRole(role)).map(
            ([className, perms]) => (
              <div key={className} className="permission-class-item">
                <motion.button
                  className="class-toggle"
                  onClick={() => toggleClassExpansion(className)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-expanded={expandedClasses.has(className)}
                  aria-label={t("userAdd.actions.togglePermissionClass", {
                    className,
                  })}
                >
                  {className} ({perms.length})
                  <FaAngleDown
                    className={`toggle-icon ${
                      expandedClasses.has(className) ? "expanded" : ""
                    }`}
                    aria-hidden="true"
                  />
                </motion.button>
                <ul
                  className={`permission-list ${
                    expandedClasses.has(className) ? "expanded" : ""
                  }`}
                >
                  {perms.map((perm) => (
                    <li key={perm.permissionID}>{perm.name}</li>
                  ))}
                </ul>
              </div>
            )
          )
        ) : (
          <p>{t("userAdd.rolePopup.noPermissions")}</p>
        )}
      </>
    );
  };

  // Render
  if (view !== "add-user" || !userPermissions.canCreateUsers) return null;

  return (
    <div
      className="form-card form-card-0"
      role="form"
      aria-labelledby="user-add-title"
    >
      <h2 id="user-add-title">{t("userAdd.title")}</h2>
      <InfoPopup
        isOpen={!!activeRolePopup}
        onClose={() => setActiveRolePopup(null)}
        contentRenderer={() => renderRolePopupContent(activeRolePopup!)}
      />
      <div className="form-section">
        <h3>{t("userAdd.sections.personalInfo")}</h3>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="first-name">
              {t("userAdd.form.labels.firstName")}
            </label>
            <input
              id="first-name"
              type="text"
              value={newUser.firstname || ""}
              onChange={(e) => {
                setNewUser({ ...newUser, firstname: e.target.value });
                setUserFormErrors({
                  ...userFormErrors,
                  firstname: validateName(e.target.value, "firstname"),
                });
              }}
              onBlur={() => markUserTouched("firstname")}
              placeholder={t("userAdd.form.placeholders.firstName")}
              className={`user-edit-input ${
                userTouched.firstname && userFormErrors.firstname
                  ? "invalid-vibrate"
                  : ""
              }`}
              required
              disabled={loading}
              aria-invalid={userTouched.firstname && !!userFormErrors.firstname}
              aria-describedby={
                userTouched.firstname && userFormErrors.firstname
                  ? "first-name-error"
                  : undefined
              }
            />
            {userFormErrors.firstname && userTouched.firstname && (
              <span className="error-text" id="first-name-error">
                {userFormErrors.firstname}
              </span>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="last-name">
              {t("userAdd.form.labels.lastName")}
            </label>
            <input
              id="last-name"
              type="text"
              value={newUser.lastname || ""}
              onChange={(e) => {
                setNewUser({ ...newUser, lastname: e.target.value });
                setUserFormErrors({
                  ...userFormErrors,
                  lastname: validateName(e.target.value, "lastname"),
                });
              }}
              onBlur={() => markUserTouched("lastname")}
              placeholder={t("userAdd.form.placeholders.lastName")}
              className={`user-edit-input ${
                userTouched.lastname && userFormErrors.lastname
                  ? "invalid-vibrate"
                  : ""
              }`}
              required
              disabled={loading}
              aria-invalid={userTouched.lastname && !!userFormErrors.lastname}
              aria-describedby={
                userTouched.lastname && userFormErrors.lastname
                  ? "last-name-error"
                  : undefined
              }
            />
            {userFormErrors.lastname && userTouched.lastname && (
              <span className="error-text" id="last-name-error">
                {userFormErrors.lastname}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="form-section">
        <hr />
        <h3>{t("userAdd.sections.contactInfo")}</h3>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="email">{t("userAdd.form.labels.email")}</label>
            <input
              id="email"
              type="email"
              value={newUser.email || ""}
              onChange={(e) => {
                setNewUser({ ...newUser, email: e.target.value });
                setUserFormErrors({
                  ...userFormErrors,
                  email: validateEmail(e.target.value),
                });
              }}
              onBlur={() => markUserTouched("email")}
              placeholder={t("userAdd.form.placeholders.email")}
              className={`user-edit-input ${
                userTouched.email && userFormErrors.email
                  ? "invalid-vibrate"
                  : ""
              }`}
              required
              disabled={loading}
              aria-invalid={userTouched.email && !!userFormErrors.email}
              aria-describedby={
                userTouched.email && userFormErrors.email
                  ? "email-error"
                  : undefined
              }
            />
            {userFormErrors.email && userTouched.email && (
              <span className="error-text" id="email-error">
                {userFormErrors.email}
              </span>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="phone">{t("userAdd.form.labels.phone")}</label>
            <input
              id="phone"
              type="text"
              value={formatPhoneDisplay(rawPhone)}
              onChange={handlePhoneChange}
              onBlur={() => markUserTouched("phone")}
              placeholder={t("userAdd.form.placeholders.phone")}
              className={`user-edit-input ${
                userTouched.phone && userFormErrors.phone
                  ? "invalid-vibrate"
                  : ""
              }`}
              required
              maxLength={10}
              disabled={loading}
              aria-invalid={userTouched.phone && !!userFormErrors.phone}
              aria-describedby={
                userTouched.phone && userFormErrors.phone
                  ? "phone-error"
                  : undefined
              }
            />
            {userFormErrors.phone && userTouched.phone && (
              <span className="error-text" id="phone-error">
                {userFormErrors.phone}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="form-section">
        <hr />
        <h3>{t("userAdd.sections.credentials")}</h3>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="password">
              {t("userAdd.form.labels.password")}
            </label>
            <input
              id="password"
              type="password"
              value={newUser.password || ""}
              onChange={(e) => {
                setNewUser({ ...newUser, password: e.target.value });
                setUserFormErrors({
                  ...userFormErrors,
                  password: validatePassword(e.target.value, true),
                  passwordConfirm: validatePasswordConfirm(
                    e.target.value,
                    passwordConfirm,
                    true
                  ),
                });
              }}
              onBlur={() => markUserTouched("password")}
              placeholder={t("userAdd.form.placeholders.password")}
              className={`user-edit-input ${
                userTouched.password && userFormErrors.password
                  ? "invalid-vibrate"
                  : ""
              }`}
              required
              disabled={loading}
              aria-invalid={userTouched.password && !!userFormErrors.password}
              aria-describedby={
                userTouched.password && userFormErrors.password
                  ? "password-error"
                  : undefined
              }
            />
            {userFormErrors.password && userTouched.password && (
              <span className="error-text" id="password-error">
                {userFormErrors.password}
              </span>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">
              {t("userAdd.form.labels.confirmPassword")}
            </label>
            <input
              id="confirm-password"
              type="password"
              value={passwordConfirm}
              onChange={(e) => {
                setPasswordConfirm(e.target.value);
                setUserFormErrors({
                  ...userFormErrors,
                  passwordConfirm: validatePasswordConfirm(
                    newUser.password || "",
                    e.target.value,
                    true
                  ),
                });
              }}
              onBlur={() => markUserTouched("passwordConfirm")}
              placeholder={t("userAdd.form.placeholders.confirmPassword")}
              className={`user-edit-input ${
                userTouched.passwordConfirm && userFormErrors.passwordConfirm
                  ? "invalid-vibrate"
                  : ""
              }`}
              required
              disabled={loading}
              aria-invalid={
                userTouched.passwordConfirm && !!userFormErrors.passwordConfirm
              }
              aria-describedby={
                userTouched.passwordConfirm && userFormErrors.passwordConfirm
                  ? "confirm-password-error"
                  : undefined
              }
            />
            {userFormErrors.passwordConfirm && userTouched.passwordConfirm && (
              <span className="error-text" id="confirm-password-error">
                {userFormErrors.passwordConfirm}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="form-section">
        <hr />
        <h3>{t("userAdd.sections.wallet")}</h3>
        <div className="form-group">
          <label htmlFor="wallet">{t("userAdd.form.labels.wallet")}</label>
          <input
            id="wallet"
            type="text"
            value={formatWalletDisplay(rawWallet)}
            onChange={handleWalletChange}
            onBlur={() => markUserTouched("wallet")}
            placeholder={t("userAdd.form.placeholders.wallet")}
            className={`user-edit-input ${
              userTouched.wallet && userFormErrors.wallet
                ? "invalid-vibrate"
                : ""
            }`}
            required
            maxLength={19}
            disabled={loading}
            aria-invalid={userTouched.wallet && !!userFormErrors.wallet}
            aria-describedby={
              userTouched.wallet && userFormErrors.wallet
                ? "wallet-error"
                : undefined
            }
          />
          {userFormErrors.wallet && userTouched.wallet && (
            <span className="error-text" id="wallet-error">
              {userFormErrors.wallet}
            </span>
          )}
        </div>
      </div>
      {userPermissions.canAssignRoles && (
        <div className="form-section">
          <hr />
          <h3>{t("userAdd.sections.roleAssignment")}</h3>
          <div className="form-group">
            <label htmlFor="assign-roles">
              {t("userAdd.form.labels.assignRoles")}
            </label>
            <div className="roles-grid" id="assign-roles">
              {roles
                .filter(
                  (role) =>
                    role.name !== import.meta.env.VITE_ROLES_SUPER_ADMIN ||
                    isSuperAdmin
                )
                .map((role) => (
                  <div key={role.roleID} className="role-toggle-container">
                    <motion.button
                      className={`role-toggle-button ${
                        selectedRolesForNewUser.includes(role.roleID)
                          ? "active"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedRolesForNewUser((prev) =>
                          prev.includes(role.roleID)
                            ? prev.filter((id) => id !== role.roleID)
                            : [...prev, role.roleID]
                        );
                      }}
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      aria-label={t("userAdd.actions.toggleRole", {
                        role: role.name,
                      })}
                    >
                      <span>{role.name}</span>
                      <FaInfoCircle
                        className="role-info-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRolePopup(role.roleID);
                        }}
                        aria-label={t("userAdd.actions.viewRoleInfo", {
                          role: role.name,
                        })}
                        aria-hidden="true"
                      />
                    </motion.button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
      <div className="form-actions">
        <motion.button
          className="action-button"
          onClick={handleCreateUser}
          disabled={loading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={t("userAdd.actions.create")}
        >
          {loading
            ? t("userAdd.actions.creating")
            : t("userAdd.actions.create")}
        </motion.button>
        <motion.button
          className="cancel-button"
          onClick={() => setView("users")}
          disabled={loading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={t("userAdd.actions.cancel")}
        >
          {t("userAdd.actions.cancel")}
        </motion.button>
      </div>
    </div>
  );
};

export default UserAdd;
