import React, { useState, useEffect, useMemo } from "react";
import {
  FaSearch,
  FaSort,
  FaUserPlus,
  FaArrowLeft,
  FaPlus,
  FaTimes,
} from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useError } from "../../context/ErrorContext";
import { getAllUsers } from "../../apis/userAPI";
import {
  getAllRoles,
  resetMainRoles,
  getRolesByUser,
} from "../../apis/roleAPI";
import { getAllPermissions } from "../../apis/permissionAPI";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import User from "../../models/User";
import Role from "../../models/Role";
import Permission from "../../models/Permission";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import UserView from "./User/user_view";
import UserAdd from "./User/user_add";
import UsersList from "./User/users_list";
import RoleView from "./Role/roles_view";
import RoleAdd from "./Role/role_add";
import RolesList from "./Role/roles_list";
import PermView from "./Permission/perm_view";
import PermsList from "./Permission/perms_list";
import ChecklistView from "./Items/Checklists/ChecklistView";
import { SortField, SortOrder, ViewMode } from "./adminTypes";
import ChecklistAdd from "./Items/Checklists/ChecklistAdd";
import ChecklistsList from "./Items/Checklists/ChecklistsList";
import ReasonAdd from "./Items/Reasons/ReasonAdd";
import ReasonsList from "./Items/Reasons/ReasonsList";
import ReasonView from "./Items/Reasons/ReasonView";
import { motion } from "framer-motion";
import "./AdminDashboard.css";

const ITEMS_PER_PAGE = 10;

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { effectivePermissions, userRoles } = useAuth();
  const { setError: setGlobalError, clearError } = useError();

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionsList, setPermissionsList] = useState<Permission[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermission, setSelectedPermission] =
    useState<Permission | null>(null);
  const [selectedChecklist, setSelectedChecklist] = useState<Checklist | null>(
    null
  );
  const [selectedReason, setSelectedReason] = useState<Reason | null>(null);
  const [view, setView] = useState<ViewMode>("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("role");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [usersPage, setUsersPage] = useState(1);
  const [checklistsPage, setChecklistsPage] = useState(1);
  const [reasonsPage, setReasonsPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setLocalError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Permission Checks
  const userPermissions = useMemo(
    () => ({
      canViewUsers: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_USERS
      ),
      canCreateUsers: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_USERS
      ),
      canViewRoles: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_ROLES
      ),
      canCreateRoles: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_ROLES
      ),
      canUpdateRoles: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_ROLES
      ),
      canViewPermissions: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS
      ),
      canCreatePermissions: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_PERMISSIONS
      ),
      canViewChecklists: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS
      ),
      canCreateChecklists: effectivePermissions?.some(
        (p) =>
          p.name === import.meta.env.VITE_PERMISSIONS_CREATE_CHECKLISTS_ITEMS
      ),
      canViewReasons: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS
      ),
      canCreateReasons: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_REASON_ITEMS
      ),
      canResetRoles: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_RESET_MAIN_ROLES
      ),
    }),
    [effectivePermissions]
  );

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      if (
        !userPermissions.canViewUsers &&
        !userPermissions.canViewRoles &&
        !userPermissions.canViewPermissions &&
        !userPermissions.canViewChecklists &&
        !userPermissions.canViewReasons
      ) {
        setLocalError(t("adminDashboard.error.noToken"));
        setGlobalError(t("adminDashboard.error.noToken"));
        return;
      }

      setLoading(true);
      try {
        const [
          usersData,
          rolesData,
          permissionsData,
          checklistsData,
          reasonsData,
        ] = await Promise.all([
          userPermissions.canViewUsers ? getAllUsers() : Promise.resolve([]),
          userPermissions.canViewRoles ? getAllRoles() : Promise.resolve([]),
          userPermissions.canViewPermissions
            ? getAllPermissions()
            : Promise.resolve([]),
          userPermissions.canViewChecklists
            ? getAllChecklists()
            : Promise.resolve([]),
          userPermissions.canViewReasons
            ? getAllReasons()
            : Promise.resolve([]),
        ]);

        const usersWithRoles = await Promise.all(
          usersData.map(async (user) => {
            const userRoles = await getRolesByUser(user.userID);
            return { ...user, Roles: userRoles };
          })
        );

        setUsers(usersWithRoles);
        setRoles(rolesData);
        setPermissionsList(permissionsData);
        setChecklists(checklistsData);
        setReasons(reasonsData);
        clearError();
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
        const errorMessage = t("adminDashboard.error.fetchFailed");
        setLocalError(errorMessage);
        setGlobalError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userPermissions, t, setGlobalError, clearError]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setLocalError(null);
        clearError();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Reset Main Roles Handler
  const handleResetMainRoles = async () => {
    if (!window.confirm(t("adminDashboard.actions.resetRolesConfirm"))) {
      return;
    }

    setResetLoading(true);
    try {
      const response = await resetMainRoles();
      const updatedRoles = await getAllRoles();
      setRoles(updatedRoles);
      setLocalError(null);
      clearError();

      const resetDetails = (
        response.details as Array<{
          roleName: string;
          permissionsAssigned: number;
          permissionsRevoked: number;
          totalPermissions: number;
        }>
      )
        .map((detail) =>
          t("adminDashboard.success.resetRolesDetail", {
            roleName: detail.roleName,
            permissionsAssigned: detail.permissionsAssigned,
            permissionsRevoked: detail.permissionsRevoked,
            totalPermissions: detail.totalPermissions,
          })
        )
        .join(", ");
      setTimeout(() => {
        const successMessage = t("adminDashboard.success.resetRoles", {
          details: resetDetails,
        });
        setLocalError(successMessage);
      }, 500);
    } catch (err) {
      console.error("Failed to reset main roles:", err);
      const errorMessage = t("adminDashboard.error.resetRolesFailed");
      setLocalError(errorMessage);
      setGlobalError(errorMessage);
    } finally {
      setResetLoading(false);
    }
  };

  // Handlers
  const handleViewChange = (newView: ViewMode) => {
    setView(newView);
    setSelectedUser(null);
    setSelectedRole(null);
    setSelectedPermission(null);
    setSelectedChecklist(null);
    setSelectedReason(null);
    if (newView === "users") setUsersPage(1);
    else if (newView === "checklists") setChecklistsPage(1);
    else if (newView === "reasons") setReasonsPage(1);
  };

  // Render
  return (
    <div className="admin-dashboard" role="main">
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="error-message"
          role="alert"
        >
          <span>{error}</span>
          <button
            className="close-error"
            onClick={() => {
              setLocalError(null);
              clearError();
            }}
            aria-label={t("errorDisplay.actions.dismiss")}
          >
            <FaTimes aria-hidden="true" />
          </button>
        </motion.div>
      )}

      <header className="dashboard-header">
        <h1 id="dashboard-title">
          {view === "users" && t("adminDashboard.header.users")}
          {view === "roles" && t("adminDashboard.header.roles")}
          {view === "permissions" && t("adminDashboard.header.permissions")}
          {view === "add-user" && t("adminDashboard.header.addUser")}
          {view === "add-role" && t("adminDashboard.header.addRole")}
          {view === "add-permission" &&
            t("adminDashboard.header.addPermission")}
          {view === "user-details" &&
            selectedUser &&
            t("adminDashboard.header.userDetails", {
              firstName: selectedUser.firstname,
              lastName: selectedUser.lastname,
            })}
          {view === "checklists" && t("adminDashboard.header.checklists")}
          {view === "add-checklist" && t("adminDashboard.header.addChecklist")}
          {view === "checklist-details" &&
            selectedChecklist &&
            t("adminDashboard.header.checklistDetails", {
              item: selectedChecklist.item,
            })}
          {view === "reasons" && t("adminDashboard.header.reasons")}
          {view === "add-reason" && t("adminDashboard.header.addReason")}
          {view === "reason-details" &&
            selectedReason &&
            t("adminDashboard.header.reasonDetails", {
              item: selectedReason.item,
            })}
        </h1>
        {(view === "users" ||
          view === "roles" ||
          view === "permissions" ||
          view === "checklists" ||
          view === "reasons") && (
          <div className="search-container">
            <FaSearch className="search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder={t("adminDashboard.search.placeholder", { view })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input input-0"
              aria-label={t("adminDashboard.search.placeholder", { view })}
            />
          </div>
        )}
        {(view === "add-user" ||
          view === "add-role" ||
          view === "add-permission" ||
          view === "user-details" ||
          view === "add-checklist" ||
          view === "checklist-details" ||
          view === "add-reason" ||
          view === "reason-details") && (
          <motion.button
            className="back-button"
            onClick={() =>
              handleViewChange(
                view.includes("user")
                  ? "users"
                  : view.includes("role")
                  ? "roles"
                  : view.includes("permission")
                  ? "permissions"
                  : view.includes("checklist")
                  ? "checklists"
                  : "reasons"
              )
            }
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={t("adminDashboard.actions.back")}
          >
            <FaArrowLeft aria-hidden="true" />{" "}
            {t("adminDashboard.actions.back")}
          </motion.button>
        )}
      </header>

      <section className="dashboard-content">
        <aside className="sidebar" role="navigation">
          <div className="filter-card">
            <h3>{t("adminDashboard.sidebar.view")}</h3>
            {userPermissions.canViewUsers && (
              <button
                className={
                  view === "users" ||
                  view === "add-user" ||
                  view === "user-details"
                    ? "active"
                    : ""
                }
                onClick={() => handleViewChange("users")}
                aria-current={view === "users" ? "page" : undefined}
              >
                {t("adminDashboard.sidebar.users")}
              </button>
            )}
            {userPermissions.canViewRoles && (
              <button
                className={
                  view === "roles" || view === "add-role" ? "active" : ""
                }
                onClick={() => handleViewChange("roles")}
                aria-current={view === "roles" ? "page" : undefined}
              >
                {t("adminDashboard.sidebar.roles")}
              </button>
            )}
            {userPermissions.canViewPermissions && (
              <button
                className={
                  view === "permissions" || view === "add-permission"
                    ? "active"
                    : ""
                }
                onClick={() => handleViewChange("permissions")}
                aria-current={view === "permissions" ? "page" : undefined}
              >
                {t("adminDashboard.sidebar.permissions")}
              </button>
            )}
            {userPermissions.canViewChecklists && (
              <button
                className={
                  view === "checklists" ||
                  view === "add-checklist" ||
                  view === "checklist-details"
                    ? "active"
                    : ""
                }
                onClick={() => handleViewChange("checklists")}
                aria-current={view === "checklists" ? "page" : undefined}
              >
                {t("adminDashboard.sidebar.checklists")}
              </button>
            )}
            {userPermissions.canViewReasons && (
              <button
                className={
                  view === "reasons" ||
                  view === "add-reason" ||
                  view === "reason-details"
                    ? "active"
                    : ""
                }
                onClick={() => handleViewChange("reasons")}
                aria-current={view === "reasons" ? "page" : undefined}
              >
                {t("adminDashboard.sidebar.reasons")}
              </button>
            )}
          </div>
          {userPermissions.canViewUsers && view === "users" && (
            <>
              <div className="sort-card">
                <h3>{t("adminDashboard.sidebar.sortUsersBy")}</h3>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  aria-label={t("adminDashboard.sidebar.sortUsersBy")}
                >
                  <option value="name">
                    {t("adminDashboard.sidebar.sortOptions.name")}
                  </option>
                  <option value="email">
                    {t("adminDashboard.sidebar.sortOptions.email")}
                  </option>
                  <option value="role">
                    {t("adminDashboard.sidebar.sortOptions.role")}
                  </option>
                </select>
                <motion.button
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={t("adminDashboard.sidebar.sortOrder", {
                    order:
                      sortOrder === "asc"
                        ? t("adminDashboard.sidebar.sortOrder.asc")
                        : t("adminDashboard.sidebar.sortOrder.desc"),
                  })}
                >
                  <FaSort aria-hidden="true" />{" "}
                  {sortOrder === "asc"
                    ? t("adminDashboard.sidebar.sortOrder.asc")
                    : t("adminDashboard.sidebar.sortOrder.desc")}
                </motion.button>
              </div>
              <div className="role-filter-card">
                <h3>{t("adminDashboard.sidebar.filterByRole")}</h3>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  aria-label={t("adminDashboard.sidebar.filterByRole")}
                >
                  <option value="all">
                    {t("adminDashboard.sidebar.allRoles")}
                  </option>
                  {roles.map((role) => (
                    <option key={role.roleID} value={role.roleID}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {userPermissions.canCreateUsers &&
            (view === "users" ||
              view === "add-user" ||
              view === "user-details") && (
              <motion.button
                className="action-button"
                onClick={() => handleViewChange("add-user")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={t("adminDashboard.sidebar.addUser")}
              >
                <FaUserPlus aria-hidden="true" />{" "}
                {t("adminDashboard.sidebar.addUser")}
              </motion.button>
            )}
          {userPermissions.canViewRoles && view === "roles" && (
            <>
              {userPermissions.canCreateRoles && (
                <motion.button
                  className="action-button"
                  onClick={() => handleViewChange("add-role")}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={t("adminDashboard.sidebar.addRole")}
                >
                  <FaPlus aria-hidden="true" />{" "}
                  {t("adminDashboard.sidebar.addRole")}
                </motion.button>
              )}
              {userPermissions.canResetRoles && (
                <motion.button
                  className="action-button reset-button"
                  onClick={handleResetMainRoles}
                  disabled={resetLoading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={t("adminDashboard.actions.resetRoles")}
                >
                  {resetLoading
                    ? t("adminDashboard.actions.resetting")
                    : t("adminDashboard.actions.resetRoles")}
                </motion.button>
              )}
            </>
          )}
          {userPermissions.canViewChecklists &&
            view === "checklists" &&
            userPermissions.canCreateChecklists && (
              <motion.button
                className="action-button"
                onClick={() => handleViewChange("add-checklist")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={t("adminDashboard.sidebar.addChecklist")}
              >
                <FaPlus aria-hidden="true" />{" "}
                {t("adminDashboard.sidebar.addChecklist")}
              </motion.button>
            )}
          {userPermissions.canViewReasons &&
            view === "reasons" &&
            userPermissions.canCreateReasons && (
              <motion.button
                className="action-button"
                onClick={() => handleViewChange("add-reason")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label={t("adminDashboard.sidebar.addReason")}
              >
                <FaPlus aria-hidden="true" />{" "}
                {t("adminDashboard.sidebar.addReason")}
              </motion.button>
            )}
        </aside>

        <main
          className="main-content"
          role="region"
          aria-labelledby="dashboard-title"
        >
          {loading && (
            <div
              className="spinner"
              style={{ marginBottom: "-1rem" }}
              aria-label={t("adminDashboard.loading")}
            >
              <span className="visually-hidden">
                {t("adminDashboard.loading")}
              </span>
            </div>
          )}
          <UsersList
            users={users}
            setUsers={setUsers}
            view={view}
            setView={setView}
            setSelectedUser={setSelectedUser}
            setError={setLocalError}
            searchQuery={searchQuery}
            sortField={sortField}
            sortOrder={sortOrder}
            userRoles={userRoles || []}
            roleFilter={roleFilter}
            currentPage={usersPage}
            setCurrentPage={setUsersPage}
            itemsPerPage={ITEMS_PER_PAGE}
          />
          <UserView
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            users={users}
            setUsers={setUsers}
            roles={roles}
            permissionsList={permissionsList}
            view={view}
            effectivePermissions={effectivePermissions || []}
            userRoles={userRoles || []}
            setView={setView}
            setError={setLocalError}
          />
          <UserAdd
            users={users}
            setUsers={setUsers}
            roles={roles}
            view={view}
            setView={setView}
            setError={setLocalError}
          />
          <RolesList
            roles={roles}
            setRoles={setRoles}
            view={view}
            setSelectedRole={setSelectedRole}
            setError={setLocalError}
            userRoles={userRoles || []}
            searchQuery={searchQuery}
          />
          <RoleView
            selectedRole={selectedRole}
            setSelectedRole={setSelectedRole}
            roles={roles}
            setRoles={setRoles}
            permissionsList={permissionsList}
            view={view}
            userRoles={userRoles || []}
            setError={setLocalError}
          />
          <RoleAdd
            roles={roles}
            setRoles={setRoles}
            permissionsList={permissionsList}
            view={view}
            setView={setView}
            setError={setLocalError}
          />
          <PermsList
            permissionsList={permissionsList}
            view={view}
            setSelectedPermission={setSelectedPermission}
            searchQuery={searchQuery}
          />
          <PermView
            selectedPermission={selectedPermission}
            setSelectedPermission={setSelectedPermission}
            permissionsList={permissionsList}
            setPermissionsList={setPermissionsList}
            view={view}
            setError={setLocalError}
          />
          <ChecklistsList
            checklists={checklists}
            setChecklists={setChecklists}
            view={view}
            setSelectedChecklist={setSelectedChecklist}
            setError={setLocalError}
            searchQuery={searchQuery}
            currentPage={checklistsPage}
            setCurrentPage={setChecklistsPage}
            itemsPerPage={ITEMS_PER_PAGE}
          />
          <ChecklistView
            selectedChecklist={selectedChecklist}
            setSelectedChecklist={setSelectedChecklist}
            checklists={checklists}
            setChecklists={setChecklists}
            view={view}
            setError={setLocalError}
          />
          <ChecklistAdd
            checklists={checklists}
            setChecklists={setChecklists}
            view={view}
            setView={setView}
            setError={setLocalError}
          />
          <ReasonsList
            reasons={reasons}
            setReasons={setReasons}
            view={view}
            setSelectedReason={setSelectedReason}
            setError={setLocalError}
            searchQuery={searchQuery}
            currentPage={reasonsPage}
            setCurrentPage={setReasonsPage}
            itemsPerPage={ITEMS_PER_PAGE}
          />
          <ReasonView
            selectedReason={selectedReason}
            setSelectedReason={setSelectedReason}
            reasons={reasons}
            setReasons={setReasons}
            view={view}
            setError={setLocalError}
          />
          <ReasonAdd
            reasons={reasons}
            setReasons={setReasons}
            view={view}
            setView={setView}
            setError={setLocalError}
          />
        </main>
      </section>
    </div>
  );
};

export default AdminDashboard;
