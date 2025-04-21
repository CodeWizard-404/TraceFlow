import React, { useState, useEffect } from "react";
import { FaAngleDown, FaInfoCircle } from "react-icons/fa";

// Context and APIs
import { useAuth } from "../../../context/AuthContext";
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

// Skeleton Component for UserAdd
const UserAddSkeleton: React.FC = () => (
  <div className="form-card form-card-0 skeleton">
    {/* Personal Information Section */}
    <div className="form-section">
      <div className="custom-skeleton pulsing" style={{ width: "150px", height: "24px", marginBottom: "16px" }} />
      <div className="form-row">
        <div className="form-group">
          <div className="custom-skeleton pulsing" style={{ width: "80px", height: "16px", marginBottom: "8px" }} />
          <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
        </div>
        <div className="form-group">
          <div className="custom-skeleton pulsing" style={{ width: "80px", height: "16px", marginBottom: "8px" }} />
          <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
        </div>
      </div>
    </div>
    {/* Contact Information Section */}
    <div className="form-section">
      <hr />
      <div className="custom-skeleton pulsing" style={{ width: "150px", height: "24px", marginBottom: "16px" }} />
      <div className="form-row">
        <div className="form-group">
          <div className="custom-skeleton pulsing" style={{ width: "80px", height: "16px", marginBottom: "8px" }} />
          <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
        </div>
        <div className="form-group">
          <div className="custom-skeleton pulsing" style={{ width: "80px", height: "16px", marginBottom: "8px" }} />
          <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
        </div>
      </div>
    </div>
    {/* Credentials Section */}
    <div className="form-section">
      <hr />
      <div className="custom-skeleton pulsing" style={{ width: "150px", height: "24px", marginBottom: "16px" }} />
      <div className="form-row">
        <div className="form-group">
          <div className="custom-skeleton pulsing" style={{ width: "80px", height: "16px", marginBottom: "8px" }} />
          <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
        </div>
        <div className="form-group">
          <div className="custom-skeleton pulsing" style={{ width: "80px", height: "16px", marginBottom: "8px" }} />
          <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
        </div>
      </div>
    </div>
    {/* Wallet Section */}
    <div className="form-section">
      <hr />
      <div className="custom-skeleton pulsing" style={{ width: "150px", height: "24px", marginBottom: "16px" }} />
      <div className="form-group">
        <div className="custom-skeleton pulsing" style={{ width: "80px", height: "16px", marginBottom: "8px" }} />
        <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
      </div>
    </div>
    {/* Role Assignment Section */}
    <div className="form-section">
      <hr />
      <div className="custom-skeleton pulsing" style={{ width: "150px", height: "24px", marginBottom: "16px" }} />
      <div className="form-group">
        <div className="custom-skeleton pulsing" style={{ width: "80px", height: "16px", marginBottom: "8px" }} />
        <div className="roles-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="role-toggle-container">
              <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
    {/* Create Button */}
    <div className="custom-skeleton pulsing" style={{ width: "120px", height: "40px", marginTop: "16px" }} />
  </div>
);

// Main Component
const UserAdd: React.FC<UserAddProps> = ({
  users,
  setUsers,
  roles,
  view,
  setView,
  setError,
}) => {
  const { effectivePermissions, userRoles } = useAuth();

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
  const [showSkeleton, setShowSkeleton] = useState(true);

  // Debugging Roles
  useEffect(() => {
    console.log("UserAdd: Roles prop received:", roles);
    console.log("UserAdd: Number of roles:", roles.length);
    console.log("UserAdd: Selected roles:", selectedRolesForNewUser);
    if (roles.length === 0) {
      console.warn("UserAdd: No roles available. Check roles prop or API fetch in parent component.");
    }
  }, [roles, selectedRolesForNewUser]);

  // Skeleton Delay
  useEffect(() => {
    console.log("UserAdd: Showing skeleton for 3 seconds");
    const timer = setTimeout(() => {
      setShowSkeleton(false);
      console.log("UserAdd: Skeleton hidden, rendering form");
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
      passwordConfirm: validatePasswordConfirm(
        newUser.password || "",
        passwordConfirm,
        true
      ),
    };

    setUserFormErrors(errors);
    if (Object.values(errors).some((error) => error)) {
      setError("Please correct the errors before submitting.");
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
          console.log("UserAdd: Assigning roles:", filteredRoles);
          await assignRolesToUser(createdUser.userID, filteredRoles);
          createdUser.Roles = await getRolesByUser(createdUser.userID);
          console.log("UserAdd: Assigned roles fetched:", createdUser.Roles);
        }
      }

      setUsers([...users, createdUser]);
      resetFormStates();
      setSelectedRolesForNewUser([]);
      setView("users");
      setError(null);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create user.";
      setError(errorMessage);
      console.error("UserAdd: Error creating user:", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Validation
  const markUserTouched = (field: keyof typeof userTouched) => {
    setUserTouched((prev) => ({ ...prev, [field]: true }));
  };

  const validateName = (value: string, field: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return `${field} is required`;
    if (trimmed.length < 3) return `${field} must be at least 3 characters`;
    if (trimmed.length > 20) return `${field} must be 20 characters or less`;
    if (!/^[a-zA-Z\s'-]+$/.test(trimmed))
      return `${field} can only contain letters, spaces, hyphens, or apostrophes`;
    return "";
  };

  const validateEmail = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "Email is required";
    if (trimmed.length > 70) return "Email must be 70 characters or less";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
      return "Invalid email format";
    return "";
  };

  const validatePhone = (value: string): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return "Phone is required";
    if (digits.length !== 8) return "Phone must be 8 digits";
    return "";
  };

  const validateWallet = (value: string, isNewUser: boolean): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits && isNewUser) return "Wallet is required";
    if (digits && digits.length !== 16)
      return "Wallet must be exactly 16 digits";
    return "";
  };

  const validatePassword = (value: string, isNewUser: boolean): string => {
    if (!value && isNewUser) return "Password is required";
    if (value && value.length < 8)
      return "Password must be at least 8 characters";
    if (value.length > 128) return "Password must be 128 characters or less";
    if (
      value &&
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$/.test(value)
    ) {
      return "Password must include uppercase, lowercase, digit, and special character, no spaces";
    }
    return "";
  };

  const validatePasswordConfirm = (
    password: string,
    confirm: string,
    isNewUser: boolean
  ): string => {
    if ((!password && confirm) || (password && !confirm && isNewUser))
      return "Password confirmation is required";
    if (password && confirm && password !== confirm)
      return "Passwords do not match";
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
    setUserFormErrors({ ...userFormErrors, wallet: validateWallet(raw, true) });
  };

  // Reset Form
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
    role.Permissions
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
    if (!role) return <p>Role not found</p>;
    return (
      <>
        <h4>{role.name}</h4>
        <p>{role.description || "No description available"}</p>
        <h5>Permissions by Class:</h5>
        {Object.entries(getCategorizedPermissionsForRole(role)).length > 0 ? (
          Object.entries(getCategorizedPermissionsForRole(role)).map(
            ([className, perms]) => (
              <div key={className} className="permission-class-item">
                <button
                  className="class-toggle"
                  onClick={() => toggleClassExpansion(className)}
                >
                  {className} ({perms.length})
                  <FaAngleDown
                    className={`toggle-icon ${expandedClasses.has(className) ? "expanded" : ""
                      }`}
                  />
                </button>
                <ul
                  className={`permission-list ${expandedClasses.has(className) ? "expanded" : ""
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
          <p>No permissions assigned</p>
        )}
      </>
    );
  };

  // Render
  if (view !== "add-user" || !userPermissions.canCreateUsers) return null;

  if (showSkeleton || loading) {
    return <UserAddSkeleton />;
  }

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
              onChange={(e) => {
                setNewUser({ ...newUser, firstname: e.target.value });
                setUserFormErrors({
                  ...userFormErrors,
                  firstname: validateName(e.target.value, "First Name"),
                });
              }}
              onBlur={() => markUserTouched("firstname")}
              className={`user-edit-input ${userTouched.firstname ? "touched" : ""
                } ${userTouched.firstname && userFormErrors.firstname
                  ? "invalid-vibrate"
                  : ""
                }`}
              required
              disabled={loading}
            />
            {userFormErrors.firstname && userTouched.firstname && (
              <span className="error-text">{userFormErrors.firstname}</span>
            )}
          </div>
          <div className="form-group">
            <label>Last Name *</label>
            <input
              type="text"
              value={newUser.lastname || ""}
              onChange={(e) => {
                setNewUser({ ...newUser, lastname: e.target.value });
                setUserFormErrors({
                  ...userFormErrors,
                  lastname: validateName(e.target.value, "Last Name"),
                });
              }}
              onBlur={() => markUserTouched("lastname")}
              className={`user-edit-input ${userTouched.lastname ? "touched" : ""
                } ${userTouched.lastname && userFormErrors.lastname
                  ? "invalid-vibrate"
                  : ""
                }`}
              required
              disabled={loading}
            />
            {userFormErrors.lastname && userTouched.lastname && (
              <span className="error-text">{userFormErrors.lastname}</span>
            )}
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
              onChange={(e) => {
                setNewUser({ ...newUser, email: e.target.value });
                setUserFormErrors({
                  ...userFormErrors,
                  email: validateEmail(e.target.value),
                });
              }}
              onBlur={() => markUserTouched("email")}
              className={`user-edit-input ${userTouched.email ? "touched" : ""
                } ${userTouched.email && userFormErrors.email
                  ? "invalid-vibrate"
                  : ""
                }`}
              required
              disabled={loading}
            />
            {userFormErrors.email && userTouched.email && (
              <span className="error-text">{userFormErrors.email}</span>
            )}
          </div>
          <div className="form-group">
            <label>Phone *</label>
            <input
              type="text"
              value={formatPhoneDisplay(rawPhone)}
              onChange={handlePhoneChange}
              onBlur={() => markUserTouched("phone")}
              placeholder="XX XXX XXX"
              className={`user-edit-input ${userTouched.phone ? "touched" : ""
                } ${userTouched.phone && userFormErrors.phone
                  ? "invalid-vibrate"
                  : ""
                }`}
              required
              maxLength={10}
              disabled={loading}
            />
            {userFormErrors.phone && userTouched.phone && (
              <span className="error-text">{userFormErrors.phone}</span>
            )}
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
              className={`user-edit-input ${userTouched.password ? "touched" : ""
                } ${userTouched.password && userFormErrors.password
                  ? "invalid-vibrate"
                  : ""
                }`}
              required
              disabled={loading}
            />
            {userFormErrors.password && userTouched.password && (
              <span className="error-text">{userFormErrors.password}</span>
            )}
          </div>
          <div className="form-group">
            <label>Confirm Password *</label>
            <input
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
              className={`user-edit-input ${userTouched.passwordConfirm ? "touched" : ""
                } ${userTouched.passwordConfirm && userFormErrors.passwordConfirm
                  ? "invalid-vibrate"
                  : ""
                }`}
              required
              disabled={loading}
            />
            {userFormErrors.passwordConfirm && userTouched.passwordConfirm && (
              <span className="error-text">
                {userFormErrors.passwordConfirm}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="form-section">
        <hr />
        <h3>Wallet</h3>
        <div className="form-group">
          <label>Wallet *</label>
          <input
            type="text"
            value={formatWalletDisplay(rawWallet)}
            onChange={handleWalletChange}
            onBlur={() => markUserTouched("wallet")}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className={`user-edit-input ${userTouched.wallet ? "touched" : ""
              } ${userTouched.wallet && userFormErrors.wallet
                ? "invalid-vibrate"
                : ""
              }`}
            required
            maxLength={19}
            disabled={loading}
          />
          {userFormErrors.wallet && userTouched.wallet && (
            <span className="error-text">{userFormErrors.wallet}</span>
          )}
        </div>
      </div>
      {userPermissions.canAssignRoles && (
        <div className="form-section">
          <hr />
          <h3>Role Assignment</h3>
          <div className="form-group">
            <label>Assign Roles</label>
            {roles.length === 0 ? (
              <p className="error-text">No roles available. Please check role fetching.</p>
            ) : (
              <div className="roles-grid">
                {roles
                  .filter(
                    (role) => role.name !== import.meta.env.VITE_ROLES_SUPER_ADMIN
                  )
                  .map((role) => (
                    <div key={role.roleID} className="role-toggle-container">
                      <button
                        className={`role-toggle-button ${selectedRolesForNewUser.includes(role.roleID)
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
            )}
          </div>
        </div>
      )}
      <button
        className="action-button"
        onClick={handleCreateUser}
        disabled={loading}
      >
        {loading ? "Creating..." : "Create User"}
      </button>
      <InfoPopup
        isOpen={!!activeRolePopup}
        onClose={() => setActiveRolePopup(null)}
        contentRenderer={() => renderRolePopupContent(activeRolePopup!)}
      />
    </div>
  );
};

export default UserAdd;