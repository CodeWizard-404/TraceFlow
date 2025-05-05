/**
 * UserView.tsx
 * Parent component for managing user details, roles, permissions, and assignments.
 * Orchestrates sub-components without altering logic.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useError } from "../../../context/ErrorContext";
import { getUserById } from "../../../apis/userAPI";
import User from "../../../models/User";
import Role from "../../../models/Role";
import Permission from "../../../models/Permission";
import UserPermissionOverride from "../../../models/UserPermissionOverride";
import Region from "../../../models/Region";
import Governorate from "../../../models/Governorate";
import "../AdminDashboard.css";
import { ViewMode } from "../adminTypes";
import UserDetails from "./UserDetails";
import RoleManagement from "./RoleManagement";
import PermissionOverrides from "./PermissionOverrides";
import AssignmentsManagement from "./AssignmentsManagement";
import InfoPopupWrapper from "./InfoPopupWrapper";
import Delegation from "../../../models/Delegation";
import Agent from "models/Agent";

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

const UserViewSkeleton: React.FC = () => (
  <div className="details-card skeleton">
    <div className="card-header">
      <div
        className="custom-skeleton"
        style={{ width: "200px", height: "24px" }}
      />
      <div className="user-actions">
        <div
          className="custom-skeleton"
          style={{ width: "80px", height: "32px" }}
        />
        <div
          className="custom-skeleton"
          style={{ width: "80px", height: "32px" }}
        />
      </div>
    </div>
    <hr />
    <div className="form-section">
      <div
        className="custom-skeleton"
        style={{ width: "150px", height: "20px", marginBottom: "10px" }}
      />
      <div className="info-grid">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="custom-skeleton"
            style={{ width: "100%", height: "16px" }}
          />
        ))}
      </div>
    </div>
    <div className="dropdown-stack">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="dropdown-unit">
          <div className="dropdown-bar">
            <div
              className="custom-skeleton"
              style={{ width: "150px", height: "20px" }}
            />
            <div
              className="custom-skeleton"
              style={{ width: "20px", height: "20px" }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
);

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
  const { setError: setGlobalError } = useError();
  const [loading, setLoading] = useState(true);
  const [tempRoles, setTempRoles] = useState<Role[]>([]);
  const [tempSupervisors, setTempSupervisors] = useState<User[]>([]);
  const [tempRegionalManagers, setTempRegionalManagers] = useState<User[]>([]);
  const [tempRegions, setTempRegions] = useState<Region[]>([]);
  const [tempDelegations, setTempDelegations] = useState<Delegation[]>([]);
  const [tempGovernorates, setTempGovernorates] = useState<Governorate[]>([]);
  const [tempAgents, setTempAgents] = useState<Agent[]>([]);
  const [tempDirectors, setTempDirectors] = useState<User[]>([]);
  const [tempOverrides, setTempOverrides] = useState<UserPermissionOverride[]>(
    []
  );
  const [userOverrides, setUserOverrides] = useState<UserPermissionOverride[]>(
    []
  );
  const [effectiveUserPermissions, setEffectiveUserPermissions] = useState<
    Permission[]
  >([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [activeRolePopup, setActiveRolePopup] = useState<string | null>(null);
  const [activeOverridePopup, setActiveOverridePopup] = useState<string | null>(
    null
  );

  // Permission Checks
  const userPermissions = useMemo(
    () => ({
      canViewUserDetails: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_USER_DETAILS
      ),
      canCreateUsers: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_USERS
      ),
      canUpdateUsers: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_USERS
      ),
      canDeleteUsers: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_DELETE_USERS
      ),
      canReadSupervisors: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS
      ),
      canReadRegionalManagers: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_REGIONAL_MANAGERS
      ),
      canAssignRoles: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_ROLES
      ),
      canRevokeRoles: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_ROLES
      ),
      canAssignSupervisors: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_REGIONAL_MANAGER
      ),
      canRevokeSupervisors: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_REGIONAL_MANAGER
      ),
      canAssignRegions: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_REGIONS
      ),
      canRevokeRegions: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_REGIONS
      ),
      canAssignGovernorates: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_GOVERNORATES
      ),
      canRevokeGovernorates: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_GOVERNORATES
      ),
      canAssignPermissions: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_PERMISSIONS
      ),
      canReadPermissionsByRole: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS_BY_ROLE
      ),
      canCreatePermissionOverrides: effectivePermissions.some(
        (p) =>
          p.name === import.meta.env.VITE_PERMISSIONS_CREATE_PERMISSION_OVERRIDES
      ),
      canRemovePermissionOverrides: effectivePermissions.some(
        (p) =>
          p.name === import.meta.env.VITE_PERMISSIONS_REMOVE_PERMISSION_OVERRIDES
      ),
      canAssignDelegations: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_DELEGATIONS
      ),
      canRevokeDelegations: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_DELEGATIONS
      ),
      canAssignAgents: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_SUPERVISOR_TO_AGENT
      ),
      canRevokeAgents: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_SUPERVISOR_FROM_AGENT
      ),
      canReadDirectors: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_DIRECTOR
      ),
      canAssignDirectors: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_DIRECTOR
      ),
      canRevokeDirectors: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_REVOKE_DIRECTOR
      ),
      canReadAgents: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_ALL_AGENTS
      ),
      canAssignRegionalManagers: effectivePermissions.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ASSIGN_REGIONAL_MANAGER
      )
    }),
    [effectivePermissions]
  );

  const isSuperAdmin = useMemo(
    () =>
      userRoles.some((r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN),
    [userRoles]
  );

  // Load initial user data
  useEffect(() => {
    const loadInitialData = async () => {
      if (!selectedUser?.userID) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const userData = await getUserById(selectedUser.userID);
        if (JSON.stringify(userData) !== JSON.stringify(selectedUser)) {
          setSelectedUser(userData);
        }
      } catch (error) {
        setGlobalError(
          error instanceof Error ? error.message : "Failed to load user data."
        );
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, [selectedUser?.userID, setSelectedUser, setGlobalError]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  }, []);



  if (
    view !== "user-details" ||
    !selectedUser ||
    !userPermissions.canViewUserDetails
  ) {
    return null;
  }

  if (loading) {
    return <UserViewSkeleton />;
  }

  return (
    <UserDetails
      selectedUser={selectedUser}
      setSelectedUser={setSelectedUser}
      users={users}
      setUsers={setUsers}
      view={view}
      setView={setView}
      userPermissions={userPermissions}
      roleManagement={
        <RoleManagement
          setActiveRolePopup={setActiveRolePopup}
          selectedUser={selectedUser}
          userRoles={userRoles}
          roles={roles}
          setRoles={setRoles}
          tempRoles={tempRoles}
          setTempRoles={setTempRoles}
          expandedSection={expandedSection}
          toggleSection={toggleSection}
          users={users}
          setUsers={setUsers}
          setSelectedUser={setSelectedUser}
          userPermissions={userPermissions}
          isSuperAdmin={isSuperAdmin}
        />
      }
      permissionOverrides={
        <PermissionOverrides
          selectedUser={selectedUser}
          permissionsList={permissionsList}
          setPermissionsList={setPermissionsList}
          expandedSection={expandedSection}
          toggleSection={toggleSection}
          userPermissions={userPermissions}
          isSuperAdmin={isSuperAdmin}
          tempOverrides={tempOverrides}
          setTempOverrides={setTempOverrides}
          userOverrides={userOverrides}
          setUserOverrides={setUserOverrides}
          effectiveUserPermissions={effectiveUserPermissions}
          setEffectiveUserPermissions={setEffectiveUserPermissions}
        />
      }
      assignmentsManagement={
        <AssignmentsManagement
          selectedUser={selectedUser}
          users={users}
          expandedSection={expandedSection}
          toggleSection={toggleSection}
          userPermissions={userPermissions}
          tempSupervisors={tempSupervisors}
          setTempSupervisors={setTempSupervisors}
          tempRegionalManagers={tempRegionalManagers}
          setTempRegionalManagers={setTempRegionalManagers}
          tempRegions={tempRegions}
          setTempRegions={setTempRegions}
          tempDelegations={tempDelegations}
          setTempDelegations={setTempDelegations}
          tempGovernorates={tempGovernorates}
          setTempGovernorates={setTempGovernorates}
          tempAgents={tempAgents}
          setTempAgents={setTempAgents}
          tempDirectors={tempDirectors}
          setTempDirectors={setTempDirectors}
          setUsers={setUsers}
          setSelectedUser={setSelectedUser}
          onUserUpdate={(updatedUser) => {
            setSelectedUser(updatedUser);
            setUsers((prevUsers) =>
              prevUsers.map((user) =>
                user.userID === updatedUser.userID ? updatedUser : user
              )
            );
          }}
        />
      }
      infoPopupWrapper={
        <InfoPopupWrapper
          roles={roles}
          permissionsList={permissionsList}
          activeRolePopup={activeRolePopup}
          activeOverridePopup={activeOverridePopup}
          setActiveRolePopup={setActiveRolePopup}
          setActiveOverridePopup={setActiveOverridePopup}
          isSuperAdmin={isSuperAdmin}
        />
      }
    />
  );
};

export default React.memo(UserView);