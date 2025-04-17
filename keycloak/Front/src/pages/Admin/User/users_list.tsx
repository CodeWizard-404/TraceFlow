import React, { useMemo, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { getSupervisorsByUser, getManagersByUser } from "../../../apis/userAPI";
import User from "../../../models/User";
import "../AdminDashboard.css";
import { getRolesByUser } from "../../../apis/roleAPI";
import Role from "models/Role";
import { SortField, SortOrder, ViewMode } from "../adminTypes";
import { t } from "i18next";

interface UsersListProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  view: ViewMode;
  setView: (view: ViewMode) => void;
  setSelectedUser: React.Dispatch<React.SetStateAction<User | null>>;
  setError: (error: string | null) => void;
  searchQuery: string;
  sortField: SortField;
  sortOrder: SortOrder;
  userRoles: Role[];
  roleFilter: string;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
}

const UsersList: React.FC<UsersListProps> = ({
  users,
  setUsers,
  view,
  setView,
  setSelectedUser,
  setError,
  searchQuery,
  sortField,
  sortOrder,
  userRoles,
  roleFilter,
  currentPage,
  setCurrentPage,
  itemsPerPage,
}) => {
  const { effectivePermissions } = useAuth();

  const isSuperAdmin = useMemo(
    () =>
      userRoles?.some((r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN),
    [userRoles]
  );

  // Permission Checks
  const userPermissions = useMemo(
    () => ({
      canViewUsers: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_USERS
      ),
      canCreateUsers: effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_USERS
      ),
    }),
    [effectivePermissions]
  );

  // Filter and Sort Users
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Hide Super Admin users if the logged-in user is not a Super Admin
    if (!isSuperAdmin) {
      result = result.filter(
        (user) =>
          !user.Roles?.some(
            (r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN
          )
      );
    }

    // Apply search filter
    if (searchQuery) {
      result = result.filter(
        (user) =>
          `${user.firstname} ${user.lastname}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (user.phone && user.phone.includes(searchQuery))
      );
    }

    // Apply role filter
    if (roleFilter !== "all") {
      result = result.filter((user) => {
        const userRoles = user.Roles || [];
        const hasRole = userRoles.some((role) => {
          const match = role.roleID === roleFilter;
          return match;
        });
        return hasRole;
      });
    }

    // Sort: Prioritize "Super Admin" at the top, then apply selected sort
    result.sort((a, b) => {
      const aIsSuperAdmin =
        a.Roles?.some(
          (r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN
        ) || false;
      const bIsSuperAdmin =
        b.Roles?.some(
          (r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN
        ) || false;

      // If one is Super Admin and the other isn't, Super Admin comes first
      if (aIsSuperAdmin && !bIsSuperAdmin) return -1;
      if (!aIsSuperAdmin && bIsSuperAdmin) return 1;

      // If both are Super Admin or neither are, apply the selected sort
      let valueA: string, valueB: string;
      switch (sortField) {
        case "name":
          valueA = `${a.firstname} ${a.lastname}`.toLowerCase();
          valueB = `${b.firstname} ${b.lastname}`.toLowerCase();
          break;
        case "email":
          valueA = a.email.toLowerCase();
          valueB = b.email.toLowerCase();
          break;
        case "role":
          valueA = a.Roles?.[0]?.name?.toLowerCase() || "no role";
          valueB = b.Roles?.[0]?.name?.toLowerCase() || "no role";
          break;
        default:
          valueA = "";
          valueB = "";
      }
      return sortOrder === "asc"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    });

    return result;
  }, [users, isSuperAdmin, searchQuery, roleFilter, sortField, sortOrder]);

  // Pagination
  const totalItems = filteredAndSortedUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredAndSortedUsers.slice(start, end);
  }, [filteredAndSortedUsers, currentPage, itemsPerPage]);

  // Adjust currentPage if it exceeds totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage, setCurrentPage]);

  // Handlers
  const handleUserSelect = async (user: User) => {
    setSelectedUser(user);
    try {
      const [userRoles, supervisors, managers] = await Promise.all([
        getRolesByUser(user.userID),
        getSupervisorsByUser(user.userID),
        getManagersByUser(user.userID),
      ]);
      const updatedUser = { ...user, Roles: userRoles, supervisors, managers };
      setUsers(users.map((u) => (u.userID === user.userID ? updatedUser : u)));
      setSelectedUser(updatedUser);
      setView("user-details");
      setError(null);
    } catch (error) {
      console.error("Failed to fetch user details:", error);
      setError("Failed to load user details.");
    }
  };

  const formatPhoneDisplay = (rawValue: string): string => {
    const digits = rawValue.replace(/[^\d]/g, "");
    let formatted = "";
    if (digits.length > 0) formatted += digits.slice(0, 2);
    if (digits.length > 2) formatted += " " + digits.slice(2, 5);
    if (digits.length > 5) formatted += " " + digits.slice(5, 8);
    return formatted;
  };

  if (view !== "users" || !userPermissions.canViewUsers) return null;

  return (
    <div className="users-list">
      <div className="table-card">
        <h2>Users</h2>
        <div className="table-container">
          <div className="table-head">
            <div className="table-row">
              <div className="table-cell">
                {t("usersList.tableHeaders.name")}
              </div>
              <div className="table-cell">
                {t("usersList.tableHeaders.email")}
              </div>
              <div className="table-cell">
                {t("usersList.tableHeaders.phone")}
              </div>
              <div className="table-cell">
                {t("usersList.tableHeaders.roles")}
              </div>
            </div>
          </div>
          <div className="table-body">
            {paginatedUsers.length > 0 ? (
              paginatedUsers.map((user) => (
                <div
                  key={user.userID}
                  className="table-row user-row"
                  onClick={() => handleUserSelect(user)}
                >
                  <div className="table-cell">{`${user.firstname} ${user.lastname}`}</div>
                  <div className="table-cell">{user.email}</div>
                  <div className="table-cell">{`+216 ${formatPhoneDisplay(
                    user.phone || "-- --- ---"
                  )}`}</div>
                  <div className="table-cell">
                    {(user.Roles?.map((r) => r.name).join(", ") || "").length >
                    16
                      ? user.Roles?.map((r) => r.name)
                          .join(", ")
                          .slice(0, 16) + "..."
                      : user.Roles?.map((r) => r.name).join(", ") || "No Role"}
                  </div>
                </div>
              ))
            ) : (
              <div className="table-row">
                <div className="table-cell">{t("usersList.noUsers")}</div>
              </div>
            )}
          </div>
        </div>
        <div className="pagination">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            {t("userView.pagination.previous")}
          </button>
          <span>
            {" "}
            {t("userView.pagination.pageInfo", {
              currentPage,
              totalPages,
            })}{" "}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            {t("userView.pagination.next")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsersList;
