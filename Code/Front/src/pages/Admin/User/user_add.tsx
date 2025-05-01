/**
 * UserAdd.tsx
 * Component for adding a new user with form validation and role assignment.
 * Optimized with dynamic loading state and fade-in animation.
 */

import React, { useState, useEffect } from "react";
import { FaAngleDown, FaInfoCircle } from "react-icons/fa";
import { motion } from "framer-motion"; // Added Framer Motion import
import {
  getAllRegions,
  getAllGovernorates,
  assignRegionsToRegionalManager,
  assignRegionalManagerToSupervisor,
  assignGovernoratesToSupervisor,
} from "../../../apis/userAPI";
import Select from "react-select"; // For multi-select dropdowns
import Region from "../../../models/Region";
import Governorate from "../../../models/Governorate";

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
  const [allRegions, setAllRegions] = useState<Region[]>([]);
  const [allGovernorates, setAllGovernorates] = useState<Governorate[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]); // For Regional Manager
  const [selectedRegionalManager, setSelectedRegionalManager] = useState<string | null>(null); // For Supervisor
  const [selectedGovernorates, setSelectedGovernorates] = useState<string[]>([]); // For Supervisor
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({});
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [selectedRolesForNewUser, setSelectedRolesForNewUser] = useState<
    string[]
  >([]);
  const [rawPhone, setRawPhone] = useState("");
  const [userFormErrors, setUserFormErrors] = useState({
    firstname: "",
    lastname: "",
    email: "",
    phone: "",
    password: "",
    passwordConfirm: "",
  });
  const [userTouched, setUserTouched] = useState({
    firstname: false,
    lastname: false,
    email: false,
    phone: false,
    password: false,
    passwordConfirm: false,
  });
  const [activeRolePopup, setActiveRolePopup] = useState<string | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true); // Modified to be dynamic

  // Debugging Roles
  useEffect(() => {
    if (roles.length === 0) {
      console.warn("UserAdd: No roles available. Check roles prop or API fetch in parent component.");
    }
  }, [roles, selectedRolesForNewUser]);

  // Dynamic Loading State
  useEffect(() => {
    setLoading(true);
    if (roles.length > 0) {
      setLoading(false);
    }
  }, [roles]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const regions = await getAllRegions();
        setAllRegions(regions);
        const governorates = await getAllGovernorates();
        setAllGovernorates(governorates);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch regions or governorates.";
        setError(errorMessage);
        console.error("UserAdd: Error fetching data:", errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [setError]);

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
      password: validatePassword(newUser.password || "", true),
      passwordConfirm: validatePasswordConfirm(newUser.password || "", passwordConfirm, true),
    };

    // Additional validation for Supervisor
    if (selectedRolesForNewUser.some(roleID => roles.find(r => r.roleID === roleID)?.name === "Supervisor")) {
      if (selectedGovernorates.length === 0) errors.password = "At least one governorate is required for Supervisor.";
    }

    setUserFormErrors(errors);
    if (Object.values(errors).some(error => error)) {
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
      });

      if (selectedRolesForNewUser.length > 0 && userPermissions.canAssignRoles) {
        const filteredRoles = selectedRolesForNewUser.filter(
          roleID => roles.find(r => r.roleID === roleID)?.name !== import.meta.env.VITE_ROLES_SUPER_ADMIN
        );
        if (filteredRoles.length > 0) {
          await assignRolesToUser(createdUser.userID, filteredRoles);
          createdUser.Roles = await getRolesByUser(createdUser.userID);
        }
      }

      setLoadingAssignments(true);
      // Assign regions for Regional Manager
      if (
        selectedRolesForNewUser.some(roleID => roles.find(r => r.roleID === roleID)?.name === "RegionalManager") &&
        selectedRegions.length > 0
      ) {
        await assignRegionsToRegionalManager(createdUser.userID, selectedRegions);
        createdUser.Regions = allRegions.filter(region => selectedRegions.includes(region.regionID));
      }

      // Assign Regional Manager and governorates for Supervisor
      if (
        selectedRolesForNewUser.some(roleID => roles.find(r => r.roleID === roleID)?.name === "Supervisor") &&
        selectedRegionalManager &&
        selectedGovernorates.length > 0
      ) {
        await assignRegionalManagerToSupervisor(createdUser.userID, selectedRegionalManager);
        await assignGovernoratesToSupervisor(createdUser.userID, selectedGovernorates);
        createdUser.regionalManagerID = selectedRegionalManager;
        createdUser.Governorates = allGovernorates.filter(gov => selectedGovernorates.includes(gov.governorateID));
      }

      setUsers([...users, createdUser]);
      resetFormStates();
      setSelectedRolesForNewUser([]);
      setSelectedRegions([]);
      setSelectedRegionalManager(null);
      setSelectedGovernorates([]);
      setView("users");
      setError(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create user or assign roles.";
      setError(errorMessage);
      console.error("UserAdd: Error:", errorMessage);
    } finally {
      setLoading(false);
      setLoadingAssignments(false);
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



  const stripPhoneForDatabase = (raw: string): string => {
    return raw.replace(/[^\d]/g, "");
  };


  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 8);
    setRawPhone(raw);
    setNewUser({ ...newUser, phone: stripPhoneForDatabase(raw) });
    setUserFormErrors({ ...userFormErrors, phone: validatePhone(raw) });
  };

  const regionalManagers = users.filter(user =>
    user.Roles?.some(role => role.name === "Regional Manager")
  );

  const selectedRM = users.find(user => user.userID === selectedRegionalManager);
  const rmRegions = selectedRM?.Regions?.map(region => region.regionID) || [];
  const availableGovernorates = allGovernorates.filter(gov =>
    rmRegions.includes(gov.regionID)
  );



  // Reset Form
  const resetFormStates = () => {
    setNewUser({});
    setRawPhone("");
    setPasswordConfirm("");
    setUserFormErrors({
      firstname: "",
      lastname: "",
      email: "",
      phone: "",
      password: "",
      passwordConfirm: "",
    });
    setUserTouched({
      firstname: false,
      lastname: false,
      email: false,
      phone: false,
      password: false,
      passwordConfirm: false,
    });
    setSelectedRegions([]);
    setSelectedRegionalManager(null);
    setSelectedGovernorates([]);
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

  if (loading) {
    return <UserAddSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
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
                type="text"
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
        </div>
        {userPermissions.canAssignRoles && (
          <div className="form-section">
            <hr />
            <h3>Role Assignment</h3>
            {/* Existing role toggle buttons */}
            <div className="form-group">
              <label>Assign Roles</label>
              {roles.length === 0 ? (
                <p className="error-text">No roles available.</p>
              ) : (
                <div className="roles-grid">
                  {roles
                    .filter(role => role.name !== import.meta.env.VITE_ROLES_SUPER_ADMIN)
                    .map(role => (
                      <div key={role.roleID} className="role-toggle-container">
                        <button
                          className={`role-toggle-button ${selectedRolesForNewUser.includes(role.roleID) ? "active" : ""}`}
                          onClick={() => {
                            setSelectedRolesForNewUser(prev =>
                              prev.includes(role.roleID)
                                ? prev.filter(id => id !== role.roleID)
                                : [...prev, role.roleID]
                            );
                          }}
                          disabled={loading}
                        >
                          <span>{role.name}</span>
                          <FaInfoCircle
                            className="role-info-icon"
                            onClick={e => {
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

        {selectedRolesForNewUser.some(roleID => roles.find(r => r.roleID === roleID)?.name === "RegionalManager") && (
          <div className="form-section">
            <hr />
            <h3>Assign Regions</h3>
            <Select
              isMulti
              options={allRegions.map(region => ({
                value: region.regionID,
                label: region.name,
              }))}
              value={allRegions
                .filter(region => selectedRegions.includes(region.regionID))
                .map(region => ({ value: region.regionID, label: region.name }))}
              onChange={selected => setSelectedRegions(selected.map(option => option.value))}
              placeholder="Select regions"
              isDisabled={loading || loadingAssignments}
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>
        )}

        {selectedRolesForNewUser.some(roleID => roles.find(r => r.roleID === roleID)?.name === "Supervisor") && (
          <div className="form-section">
            <hr />
            <h3>Assign Regional Manager and Governorates</h3>
            <div className="form-group">
              <label>Select Regional Manager *</label>
              <Select
                options={regionalManagers.map(rm => ({
                  value: rm.userID,
                  label: `${rm.firstname} ${rm.lastname}`,
                }))}
                value={regionalManagers
                  .filter(rm => rm.userID === selectedRegionalManager)
                  .map(rm => ({ value: rm.userID, label: `${rm.firstname} ${rm.lastname}` }))[0]}
                onChange={selected => {
                  setSelectedRegionalManager(selected?.value || null);
                  setSelectedGovernorates([]); // Reset governorates when RM changes
                }}
                placeholder="Select Regional Manager"
                isDisabled={loading || loadingAssignments}
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
            {selectedRegionalManager && (
              <div className="form-group">
                <label>Select Governorates *</label>
                <Select
                  isMulti
                  options={availableGovernorates.map(gov => ({
                    value: gov.governorateID,
                    label: gov.name,
                  }))}
                  value={availableGovernorates
                    .filter(gov => selectedGovernorates.includes(gov.governorateID))
                    .map(gov => ({ value: gov.governorateID, label: gov.name }))}
                  onChange={selected => setSelectedGovernorates(selected.map(option => option.value))}
                  placeholder="Select governorates"
                  isDisabled={loading || loadingAssignments}
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>
            )}
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
    </motion.div>
  );
};

export default UserAdd;