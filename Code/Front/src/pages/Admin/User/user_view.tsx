// UserView.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useError } from "../../../context/ErrorContext";
import { getUserById } from "../../../apis/userAPI";
import User from "../../../models/User";
import Role from "../../../models/Role";
import Permission from "../../../models/Permission";
import Region from "../../../models/Region";
import Governorate from "../../../models/Governorate";
import Delegation from "../../../models/Delegation";
import Agent from "../../../models/Agent";
import { ViewMode } from "../adminTypes";
import UserDetails from "./UserDetails";
import RoleManagement from "./RoleManagement";
import AssignmentsManagement from "./AssignmentsManagement";
import InfoPopupWrapper from "./InfoPopupWrapper";
import { onNotification, offNotification, isSocketConnected } from "../../../lib/socket";
import { getEntityEvents, NotificationEvent } from "../../../lib/notifEvents";

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


const isValidUser = (data: unknown): data is User => {
  return !!data && typeof data === "object" && "userID" in data && typeof data.userID === "string";
};


const UserView: React.FC<UserViewProps> = ({
  selectedUser,
  setSelectedUser,
  users,
  setUsers,
  roles,
  setRoles,
  permissionsList,
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
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [activeRolePopup, setActiveRolePopup] = useState<string | null>(null);
  const [activeOverridePopup, setActiveOverridePopup] = useState<string | null>(null);

  // Permission Checks (unchanged)
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
      ),
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
        console.log("UserView fetched userData.Roles =", userData.Roles); // Debug log
        if (JSON.stringify(userData) !== JSON.stringify(selectedUser)) {
          setSelectedUser(userData);
          setUsers((prev) =>
            prev.map((u) => (u.userID === userData.userID ? userData : u))
          );
          setTempRoles(userData.Roles || []); // Reset tempRoles
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
  }, [selectedUser?.userID, setSelectedUser, setGlobalError, setUsers]);

  // WebSocket updates for selectedUser
  useEffect(() => {
    if (
      view !== "user-details" ||
      !selectedUser ||
      !userPermissions.canViewUserDetails ||
      !isSocketConnected()
    ) {
      return;
    }

    let isMounted = true;

    const handleUserEvent = async (event: NotificationEvent, data: unknown) => {
      if (!isMounted || !isValidUser(data)) {
        return;
      }

      if (data.userID !== selectedUser.userID) {
        return;
      }

      try {
        const updatedUser: User = {
          ...data,
          createdAt: data.createdAt ? new Date(data.createdAt) : selectedUser.createdAt || new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
          Roles: Array.isArray(data.Roles) ? data.Roles : selectedUser.Roles || [],
          password: data.password || selectedUser.password || "",
          firstname: data.firstname || selectedUser.firstname || "Unknown",
          lastname: data.lastname || selectedUser.lastname || "User",
          email: data.email || selectedUser.email || "",
          phone: data.phone || selectedUser.phone || "",
        };

        console.log("WebSocket updatedUser.Roles =", updatedUser.Roles); // Debug log

        if (event === "user:updated" || event === "user:profile_updated" || event === "user:supervisors_assigned" || event === "user:supervisors_revoked") {
          setSelectedUser(updatedUser);
          setUsers((prev) =>
            prev.map((u) => (u.userID === updatedUser.userID ? updatedUser : u))
          );
          setTempRoles(updatedUser.Roles || []); // Update tempRoles
        } else if (event === "user:deleted") {
          setSelectedUser(null);
          setUsers((prev) => prev.filter((u) => u.userID !== data.userID));
          setView("users");
        }
      } catch (err) {
        console.error("Failed to handle user event in UserView:", err);
        setGlobalError("Failed to update user data in real-time.");
      }
    };

    const setupNotifications = async () => {
      try {
        const userEvents = await getEntityEvents("user");
        userEvents.forEach((event) => {
          onNotification((ev: NotificationEvent, data: unknown) => {
            if (ev === event && isMounted) {
              handleUserEvent(ev, data);
            }
          });
        });
      } catch (err) {
        console.error("Failed to set up WebSocket notifications in UserView:", err);
        setGlobalError("Failed to set up real-time updates.");
      }
    };

    setupNotifications();

    return () => {
      isMounted = false;
      offNotification();
    };
  }, [
    view,
    selectedUser,
    userPermissions.canViewUserDetails,
    setSelectedUser,
    setUsers,
    setView,
    setGlobalError,
  ]);

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
      setError={setGlobalError}
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