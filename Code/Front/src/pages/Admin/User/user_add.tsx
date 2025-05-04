/**
 * UserAdd.tsx
 * Component for adding a new user with form validation, role assignment, and assignments management.
 * Includes auto-generated password and integrates AssignmentsManagement and RoleManagement components.
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  assignRegionsToRegionalManager,
  assignRegionalManagerToSupervisor,
  assignGovernoratesToSupervisor,
  assignDelegationsToSupervisor,
  assignDirectorToRegionalManager,
  assignSupervisorToAgent,
} from "../../../apis/userAPI";
import { getAllRegions, getAllGovernorates } from "../../../apis/locationApi";
import { assignRolesToUser, getRolesByUser } from "../../../apis/roleAPI";
import { createUser } from "../../../apis/userAPI";
import User from "../../../models/User";
import Role from "../../../models/Role";
import Region from "../../../models/Region";
import Governorate from "../../../models/Governorate";
import Delegation from "../../../models/Delegation";
import Agent from "../../../models/Agent";
import { useAuth } from "../../../context/AuthContext";
import { ViewMode } from "../adminTypes";
import RoleManagement from "./RoleManagement";
import AssignmentsManagement from "./AssignmentsManagement";
import InfoPopupWrapper from "./InfoPopupWrapper";
import "../AdminDashboard.css";

// Props Interface
interface UserAddProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  view: string;
  setView: (view: ViewMode) => void;
  setError: (error: string | null) => void;
}

// Skeleton Component for UserAdd
const UserAddSkeleton: React.FC = () => (
  <div className="form-card form-card-0 skeleton">
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
    <div className="dropdown-stack">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="dropdown-unit">
          <div className="dropdown-bar">
            <div className="custom-skeleton pulsing" style={{ width: "150px", height: "20px" }} />
            <div className="custom-skeleton pulsing" style={{ width: "20px", height: "20px" }} />
          </div>
        </div>
      ))}
    </div>
    <div className="custom-skeleton pulsing" style={{ width: "120px", height: "40px", marginTop: "16px" }} />
  </div>
);

// Password Generation Function
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

// Main Component
const UserAdd: React.FC<UserAddProps> = ({
  users,
  setUsers,
  roles,
  view,
  setRoles,
  setView,
  setError,
}) => {
  const { effectivePermissions, userRoles } = useAuth();
  const [newUser, setNewUser] = useState<Partial<User>>({});
  const [rawPhone, setRawPhone] = useState("");
  const [userFormErrors, setUserFormErrors] = useState({
    firstname: "",
    lastname: "",
    email: "",
    phone: "",
  });
  const [userTouched, setUserTouched] = useState({
    firstname: false,
    lastname: false,
    email: false,
    phone: false,
  });
  const [loading, setLoading] = useState(true);
  const [tempRoles, setTempRoles] = useState<Role[]>([]);
  const [tempSupervisors, setTempSupervisors] = useState<User[]>([]);
  const [tempRegionalManagers, setTempRegionalManagers] = useState<User[]>([]);
  const [tempRegions, setTempRegions] = useState<Region[]>([]);
  const [tempGovernorates, setTempGovernorates] = useState<Governorate[]>([]);
  const [tempDelegations, setTempDelegations] = useState<Delegation[]>([]);
  const [tempAgents, setTempAgents] = useState<Agent[]>([]);
  const [tempDirectors, setTempDirectors] = useState<User[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [activeRolePopup, setActiveRolePopup] = useState<string | null>(null);
  const [activeOverridePopup, setActiveOverridePopup] = useState<string | null>(null);

  // Permissions
  const userPermissions = {
    canCreateUsers: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_USERS
    ),
    canAssignRoles: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_ROLES
    ),
    canAssignRegions: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_REGIONS
    ),
    canRevokeRegions: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_REGIONS
    ),
    canAssignGovernorates: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_GOVERNORATES
    ),
    canRevokeGovernorates: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_GOVERNORATES
    ),
    canAssignDelegations: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_DELEGATIONS
    ),
    canRevokeDelegations: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_DELEGATIONS
    ),
    canAssignSupervisors: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_REGIONAL_MANAGER
    ),
    canRevokeSupervisors: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_REGIONAL_MANAGER
    ),
    canAssignAgents: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_SUPERVISOR_TO_AGENT
    ),
    canRevokeAgents: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_SUPERVISOR_FROM_AGENT
    ),
    canAssignDirectors: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_DIRECTORS
    ),
    canRevokeDirectors: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_DIRECTORS
    ),
    canReadSupervisors: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS
    ),
    canReadRegionalManagers: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_REGIONAL_MANAGERS
    ),
    canReadAgents: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_AGENTS
    ),
    canReadDirectors: effectivePermissions?.some(
      (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_DIRECTORS
    ),
  };

  const isSuperAdmin = userRoles?.some(
    (r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN
  );

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
        await Promise.all([getAllRegions(), getAllGovernorates()]);
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

  // Handlers
  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const handleCreateUser = async () => {
    if (!userPermissions.canCreateUsers) return;

    const errors = {
      firstname: validateName(newUser.firstname || "", "First Name"),
      lastname: validateName(newUser.lastname || "", "Last Name"),
      email: validateEmail(newUser.email || ""),
      phone: validatePhone(rawPhone),
    };

    setUserFormErrors(errors);
    if (Object.values(errors).some((error) => error)) {
      setError("Please correct the errors before submitting.");
      return;
    }

    setLoading(true);
    try {
      const password = generatePassword();
      const createdUser = await createUser({
        email: newUser.email!.trim(),
        password,
        firstname: newUser.firstname!.trim(),
        lastname: newUser.lastname!.trim(),
        phone: stripPhoneForDatabase(rawPhone),
      });

      // Assign Roles
      if (tempRoles.length > 0 && userPermissions.canAssignRoles) {
        const filteredRoles = tempRoles
          .filter((role) => role.name !== import.meta.env.VITE_ROLES_SUPER_ADMIN)
          .map((role) => role.roleID);
        if (filteredRoles.length > 0) {
          await assignRolesToUser(createdUser.userID, filteredRoles);
          createdUser.Roles = await getRolesByUser(createdUser.userID);
        }
      }

      // Assign Regions for Regional Manager
      if (
        tempRoles.some((role) => role.name === "RegionalManager") &&
        tempRegions.length > 0 &&
        userPermissions.canAssignRegions
      ) {
        await assignRegionsToRegionalManager(createdUser.userID, tempRegions.map((r) => r.regionID));
        createdUser.Regions = tempRegions;
      }

      // Assign Regional Manager and Governorates for Supervisor
      if (
        tempRoles.some((role) => role.name === "Supervisor") &&
        tempRegionalManagers[0]?.userID &&
        tempGovernorates.length > 0 &&
        userPermissions.canAssignSupervisors &&
        userPermissions.canAssignGovernorates
      ) {
        await assignRegionalManagerToSupervisor(createdUser.userID, tempRegionalManagers[0].userID);
        await assignGovernoratesToSupervisor(createdUser.userID, tempGovernorates.map((g) => g.governorateID));
        createdUser.regionalManagerID = tempRegionalManagers[0].userID;
        createdUser.Governorates = tempGovernorates;
      }

      // Assign Delegations for Supervisor
      if (
        tempRoles.some((role) => role.name === "Supervisor") &&
        tempDelegations.length > 0 &&
        userPermissions.canAssignDelegations
      ) {
        await assignDelegationsToSupervisor(createdUser.userID, tempDelegations.map((d) => d.delegationID));
        createdUser.Delegations = tempDelegations;
      }

      // Assign Agents for Supervisor
      if (
        tempRoles.some((role) => role.name === "Supervisor") &&
        tempAgents.length > 0 &&
        userPermissions.canAssignAgents &&
        tempDelegations.length > 0
      ) {
        for (const agent of tempAgents) {
          await assignSupervisorToAgent(agent.agentID, createdUser.userID, tempDelegations[0].delegationID);
        }
      }

      // Assign Director for Regional Manager
      if (
        tempRoles.some((role) => role.name === "RegionalManager") &&
        tempDirectors[0]?.userID &&
        userPermissions.canAssignDirectors
      ) {
        await assignDirectorToRegionalManager(createdUser.userID, tempDirectors[0].userID);
        createdUser.directorID = tempDirectors[0].userID;
      }

      setUsers([...users, createdUser]);
      resetFormStates();
      setView("users");
      setError(null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create user or assign roles.";
      setError(errorMessage);
      console.error("UserAdd: Error:", errorMessage);
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

  // Reset Form
  const resetFormStates = () => {
    setNewUser({});
    setRawPhone("");
    setUserFormErrors({
      firstname: "",
      lastname: "",
      email: "",
      phone: "",
    });
    setUserTouched({
      firstname: false,
      lastname: false,
      email: false,
      phone: false,
    });
    setTempRoles([]);
    setTempSupervisors([]);
    setTempRegionalManagers([]);
    setTempRegions([]);
    setTempGovernorates([]);
    setTempDelegations([]);
    setTempAgents([]);
    setTempDirectors([]);
    setActiveRolePopup(null);
    setActiveOverridePopup(null);
  };

  // Render
  if (view !== "add-user") return null;

  if (loading) {
    return <UserAddSkeleton />;
  }

  return (
    <motion.div
      className="form-card form-card-0"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="form-section">
        <h2>Add New User</h2>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstname">First Name</label>
            <input
              type="text"
              id="firstname"
              value={newUser.firstname || ""}
              onChange={(e) =>
                setNewUser({ ...newUser, firstname: e.target.value })
              }
              onBlur={() => markUserTouched("firstname")}
              placeholder="Enter first name"
              className={userFormErrors.firstname && userTouched.firstname ? "input-error" : ""}
            />
            {userFormErrors.firstname && userTouched.firstname && (
              <div className="error-message">{userFormErrors.firstname}</div>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="lastname">Last Name</label>
            <input
              type="text"
              id="lastname"
              value={newUser.lastname || ""}
              onChange={(e) =>
                setNewUser({ ...newUser, lastname: e.target.value })
              }
              onBlur={() => markUserTouched("lastname")}
              placeholder="Enter last name"
              className={userFormErrors.lastname && userTouched.lastname ? "input-error" : ""}
            />
            {userFormErrors.lastname && userTouched.lastname && (
              <div className="error-message">{userFormErrors.lastname}</div>
            )}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={newUser.email || ""}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              onBlur={() => markUserTouched("email")}
              placeholder="Enter email"
              className={userFormErrors.email && userTouched.email ? "input-error" : ""}
            />
            {userFormErrors.email && userTouched.email && (
              <div className="error-message">{userFormErrors.email}</div>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="phone">Phone</label>
            <input
              type="text"
              id="phone"
              value={formatPhoneDisplay(rawPhone)}
              onChange={handlePhoneChange}
              onBlur={() => markUserTouched("phone")}
              placeholder="Enter phone (e.g., 12 345 678)"
              className={userFormErrors.phone && userTouched.phone ? "input-error" : ""}
            />
            {userFormErrors.phone && userTouched.phone && (
              <div className="error-message">{userFormErrors.phone}</div>
            )}
          </div>
        </div>
      </div>
      <hr />
      <div className="dropdown-stack">
        <RoleManagement
          setActiveRolePopup={setActiveRolePopup}
          selectedUser={null}
          setRoles={setRoles}
          users={users}
          setUsers={setUsers}
          setSelectedUser={() => { }}
          roles={roles}
          tempRoles={tempRoles}
          setTempRoles={setTempRoles}
          userPermissions={{
            ...userPermissions,
            canAssignRoles: userPermissions.canAssignRoles ?? false,
          }}
          expandedSection={expandedSection}
          toggleSection={toggleSection}
          isSuperAdmin={isSuperAdmin ?? false}
          userRoles={userRoles ?? []}
        />
        <AssignmentsManagement
          selectedUser={null}
          users={users}
          tempRoles={tempRoles}
          expandedSection={expandedSection}
          toggleSection={toggleSection}
          userPermissions={{
            canAssignRegions: userPermissions.canAssignRegions ?? false,
            canRevokeRegions: userPermissions.canRevokeRegions ?? false,
            canAssignGovernorates: userPermissions.canAssignGovernorates ?? false,
            canRevokeGovernorates: userPermissions.canRevokeGovernorates ?? false,
            canAssignDelegations: userPermissions.canAssignDelegations ?? false,
            canRevokeDelegations: userPermissions.canRevokeDelegations ?? false,
            canAssignSupervisors: userPermissions.canAssignSupervisors ?? false,
            canRevokeSupervisors: userPermissions.canRevokeSupervisors ?? false,
            canAssignAgents: userPermissions.canAssignAgents ?? false,
            canRevokeAgents: userPermissions.canRevokeAgents ?? false,
            canAssignDirectors: userPermissions.canAssignDirectors ?? false,
            canRevokeDirectors: userPermissions.canRevokeDirectors ?? false,
            canReadSupervisors: userPermissions.canReadSupervisors ?? false,
            canReadRegionalManagers: userPermissions.canReadRegionalManagers ?? false,
            canReadAgents: userPermissions.canReadAgents ?? false,
            canReadDirectors: userPermissions.canReadDirectors ?? false,
          }}
          tempSupervisors={tempSupervisors}
          setTempSupervisors={setTempSupervisors}
          tempRegionalManagers={tempRegionalManagers}
          setTempRegionalManagers={setTempRegionalManagers}
          tempRegions={tempRegions}
          setTempRegions={setTempRegions}
          tempGovernorates={tempGovernorates}
          setTempGovernorates={setTempGovernorates}
          tempDelegations={tempDelegations}
          setTempDelegations={setTempDelegations}
          tempAgents={tempAgents}
          setTempAgents={setTempAgents}
          tempDirectors={tempDirectors}
          setTempDirectors={setTempDirectors}
          setUsers={setUsers}
          setSelectedUser={() => { }}
        />
      </div>
      <hr />
      <button
        className="action-button"
        onClick={handleCreateUser}
        disabled={loading || !userPermissions.canCreateUsers}
      >
        {loading ? "Creating..." : "Create User"}
      </button>
      <InfoPopupWrapper
        roles={roles}
        permissionsList={[]}
        activeRolePopup={activeRolePopup}
        activeOverridePopup={activeOverridePopup}
        setActiveRolePopup={setActiveRolePopup}
        setActiveOverridePopup={setActiveOverridePopup}
        isSuperAdmin={isSuperAdmin ?? false}
      />
    </motion.div>
  );
};

export default UserAdd;