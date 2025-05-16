/* eslint-disable react-hooks/exhaustive-deps */
import React, { useMemo, useEffect, useCallback, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import {
  getSupervisorsByUser,
  getRegionalManagersByUser,
  getAllUsers,
} from "../../../apis/userAPI";
import User from "../../../models/User";
import Role from "../../../models/Role";
import { SortField, SortOrder, ViewMode } from "../adminTypes";
import { t } from "i18next";
import { debounce } from "lodash";
import {
  onNotification,
  offNotification,
  isSocketConnected,
} from "../../../lib/socket";
import { getEntityEvents, NotificationEvent } from "../../../lib/notifEvents";
import "../AdminDashboard.css";
import { motion } from "framer-motion";

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
  roleFilter: string[];
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
  isTransitioning: boolean;
  setIsTransitioning: React.Dispatch<React.SetStateAction<boolean>>;
}

const MAX_RETRIES = 1;
const BASE_RETRY_DELAY = 300;
const CACHE_DURATION = 15 * 60 * 1000;
const SKELETON_ROWS = 10;

const cache = new Map<string, { data: User[]; timestamp: number }>();

const formatDate = (date: string | Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  return new Date(date).toLocaleString(undefined, options);
};

const isValidUser = (data: unknown): data is User => {
  return !!data && typeof data === "object" && "userID" in data && typeof data.userID === "string";
};

const UsersList: React.FC<UsersListProps> = React.memo(
  ({
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
    isTransitioning,
    setIsTransitioning,
  }) => {
    const { effectivePermissions } = useAuth();
    const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
    const [loading, setLoading] = useState(true);
    const [filterLoading, setFilterLoading] = useState(false);

    const isSuperAdmin = useMemo(
      () =>
        userRoles?.some(
          (r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN
        ),
      [userRoles]
    );

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

    const debouncedSetSearchQuery = useCallback(
      debounce((value: string) => setInternalSearchQuery(value), 300),
      []
    );

    const debouncedSetUsers = useCallback(
      debounce((updateFn: (prev: User[]) => User[]) => {
        setUsers(updateFn);
      }, 100),
      [setUsers]
    );

    // Sync search query
    useEffect(() => {
      debouncedSetSearchQuery(searchQuery);
      return () => debouncedSetSearchQuery.cancel();
    }, [searchQuery, debouncedSetSearchQuery]);

    // Manage loading state
    useEffect(() => {
      if (users.length > 0 && !isTransitioning) {
        setLoading(false);
      } else if (
        !users.length &&
        view === "users" &&
        userPermissions.canViewUsers
      ) {
        setLoading(true);
      }
    }, [users, isTransitioning, view, userPermissions.canViewUsers]);

    // Manage filter loading
    useEffect(() => {
      setFilterLoading(true);
      const timer = setTimeout(
        () => setFilterLoading(false),
        Math.min(300 + users.length * 2, 1000)
      );
      return () => clearTimeout(timer);
    }, [roleFilter, users.length]);

    // Clear cache on filter or search change
    useEffect(() => {
      cache.delete(`users_${isSuperAdmin ? "all" : "non_super_admin"}`);
    }, [searchQuery, roleFilter, isSuperAdmin]);

    const getCachedData = useCallback((key: string): User[] | null => {
      const cached = cache.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
      return null;
    }, []);

    const setCachedData = useCallback((key: string, data: User[]) => {
      cache.set(key, { data, timestamp: Date.now() });
    }, []);

    const fetchWithRetry = useCallback(
      async (
        fetchFn: () => Promise<User[]>,
        cacheKey: string,
        retries = MAX_RETRIES
      ): Promise<User[]> => {
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          return cachedData;
        }

        try {
          const data = await fetchFn();
          setCachedData(cacheKey, data);
          return data;
        } catch (err: unknown) {
          console.error(`[Error] ${cacheKey}:`, err);
          if (
            retries > 0 &&
            err instanceof Error &&
            err.message.includes("out of shared memory")
          ) {
            const delay = BASE_RETRY_DELAY * (MAX_RETRIES - retries + 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return fetchWithRetry(fetchFn, cacheKey, retries - 1);
          }
          setError(t("usersList.error.fetchFailed"));
          return [];
        }
      },
      [getCachedData, setCachedData, setError]
    );

    useEffect(() => {
      if (view !== "users" || !userPermissions.canViewUsers || !isSocketConnected()) {
        return;
      }

      const refreshUsers = async () => {
        setLoading(true);
        try {
          const cacheKey = `users_${isSuperAdmin ? "all" : "non_super_admin"}`;
          cache.delete(cacheKey); // Clear cache to force refresh
          const usersData = await fetchWithRetry(getAllUsers, cacheKey);
          debouncedSetUsers(() => usersData);
          setError(null);
        } catch (err) {
          console.error("Failed to refresh users on view change:", err);
          setError(t("usersList.error.refreshFailed"));
        } finally {
          setLoading(false);
        }
      };

      refreshUsers();
    }, [view, userPermissions.canViewUsers, isSuperAdmin, fetchWithRetry, debouncedSetUsers, setError, t]);

    // Real-time WebSocket updates
    useEffect(() => {
      if (!userPermissions.canViewUsers || !isSocketConnected()) {
        return;
      }

      let isMounted = true;

      const handleUserEvent = async (event: NotificationEvent, data: unknown) => {
        if (!isMounted || !isValidUser(data)) {
          console.warn(`Invalid WebSocket data for event ${event}:`, data);
          return;
        }

        try {
          const updatedUser: User = {
            ...data,
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
            Roles: Array.isArray(data.Roles) ? data.Roles : [],
            password: data.password || "",
            firstname: data.firstname || "Unknown",
            lastname: data.lastname || "User",
            email: data.email || "",
            phone: data.phone || "",
          };

          switch (event) {
            case "user:created": {
              const matchesSearch =
                !internalSearchQuery ||
                `${updatedUser.firstname} ${updatedUser.lastname}`
                  .toLowerCase()
                  .includes(internalSearchQuery.toLowerCase()) ||
                updatedUser.email
                  .toLowerCase()
                  .includes(internalSearchQuery.toLowerCase()) ||
                updatedUser.phone?.includes(internalSearchQuery);
              const matchesRole =
                roleFilter.length === 0 ||
                (roleFilter.includes("No Roles") &&
                  (!updatedUser.Roles || updatedUser.Roles.length === 0)) ||
                updatedUser.Roles?.some((r) => roleFilter.includes(r.name));
              if (matchesSearch && matchesRole) {
                debouncedSetUsers((prev) => {
                  if (prev.some((u) => u.userID === updatedUser.userID)) {
                    return prev;
                  }
                  return [...prev, updatedUser];
                });
              }
              break;
            }
            case "user:updated":
            case "user:profile_updated":
            case "user:supervisors_assigned":
            case "user:supervisors_revoked": {
              debouncedSetUsers((prev) => {
                const index = prev.findIndex((u) => u.userID === updatedUser.userID);
                if (index === -1) {
                  console.warn(`User ${updatedUser.userID} not found for update event ${event}`);
                  return prev;
                }
                const newUsers = [...prev];
                newUsers[index] = updatedUser;
                return newUsers;
              });
              break;
            }
            case "user:deleted": {
              debouncedSetUsers((prev) =>
                prev.filter((u) => u.userID !== data.userID)
              );
              break;
            }
            default:
              console.warn(`Unhandled user event: ${event}`);
              return;
          }
        } catch (err) {
          console.error("Failed to handle user event:", err);
          setError(t("usersList.error.realTimeUpdateFailed"));
          // Fallback to full refresh only on error
          cache.delete(`users_${isSuperAdmin ? "all" : "non_super_admin"}`);
          try {
            const usersData = await fetchWithRetry(
              getAllUsers,
              `users_${isSuperAdmin ? "all" : "non_super_admin"}`
            );
            if (isMounted) {
              debouncedSetUsers(() => usersData);
              setError(null);
            }
          } catch (refreshErr) {
            console.error("Failed to refresh user list:", refreshErr);
            setError(t("usersList.error.refreshFailed"));
          }
        }
      };

      const setupNotifications = async () => {
        setLoading(true);
        try {
          const userEvents = await getEntityEvents("user");
          if (!isMounted) return;

          userEvents.forEach((event) => {
            onNotification((ev: NotificationEvent, data: unknown) => {
              if (ev === event && isMounted) {
                handleUserEvent(ev, data);
              }
            });
          });
        } catch (err) {
          console.error("Failed to set up WebSocket notifications:", err);
          setError(t("usersList.error.websocketSetupFailed"));
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      setupNotifications();

      return () => {
        isMounted = false;
        offNotification();
      };
    }, [
      userPermissions.canViewUsers,
      internalSearchQuery,
      roleFilter,
      isSuperAdmin,
      setError,
      debouncedSetUsers,
      fetchWithRetry,
      t,
    ]);

    // Filtered and sorted users (unchanged)
    const filteredAndSortedUsers = useMemo(() => {
      let result = [...users].filter((user) => user && user.userID);

      if (!isSuperAdmin) {
        result = result.filter((user) =>
          user.Roles
            ? !user.Roles.some(
              (r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN
            )
            : true
        );
      }

      if (internalSearchQuery) {
        result = result.filter(
          (user) =>
            `${user.firstname || ""} ${user.lastname || ""}`
              .toLowerCase()
              .includes(internalSearchQuery.toLowerCase()) ||
            (user.email || "")
              .toLowerCase()
              .includes(internalSearchQuery.toLowerCase()) ||
            (user.phone && user.phone.includes(internalSearchQuery))
        );
      }

      if (roleFilter.length > 0) {
        result = result.filter((user) => {
          const userRoles = Array.isArray(user.Roles) ? user.Roles : [];
          const hasNoRoles = !userRoles || userRoles.length === 0;
          return (
            (roleFilter.includes("No Roles") && hasNoRoles) ||
            userRoles.some((role) => roleFilter.includes(role.name))
          );
        });
      }

      result.sort((a, b) => {
        const aIsSuperAdmin = a.Roles
          ? a.Roles.some(
            (r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN
          )
          : false;
        const bIsSuperAdmin = b.Roles
          ? b.Roles.some(
            (r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN
          )
          : false;

        if (aIsSuperAdmin && !bIsSuperAdmin) return -1;
        if (!aIsSuperAdmin && bIsSuperAdmin) return 1;

        let valueA: string, valueB: string;
        switch (sortField) {
          case "name":
            valueA = `${a.firstname || ""} ${a.lastname || ""}`.toLowerCase();
            valueB = `${b.firstname || ""} ${b.lastname || ""}`.toLowerCase();
            break;
          case "email":
            valueA = (a.email || "").toLowerCase();
            valueB = (b.email || "").toLowerCase();
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
    }, [users, isSuperAdmin, internalSearchQuery, roleFilter, sortField, sortOrder]);

    const totalItems = filteredAndSortedUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

    const paginatedUsers = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      return filteredAndSortedUsers.slice(start, end);
    }, [filteredAndSortedUsers, currentPage, itemsPerPage]);

    // Adjust current page if necessary
    useEffect(() => {
      if (currentPage > totalPages) {
        setCurrentPage(totalPages);
      }
    }, [totalPages, currentPage, setCurrentPage]);

    const handleUserSelect = useCallback(
      async (user: User) => {
        setIsTransitioning(true);
        setSelectedUser(user);
        setLoading(true);
        try {
          const [supervisors, managers] = await Promise.all([
            fetchWithRetry(
              () => getSupervisorsByUser(user.userID),
              `supervisors_${user.userID}`
            ),
            fetchWithRetry(
              async () => {
                const response = await getRegionalManagersByUser(user.userID);
                return response as User[];
              },
              `managers_${user.userID}`
            ),
          ]);
          const updatedUser = { ...user, supervisors, managers };
          setUsers((prev) =>
            prev.map((u) => (u.userID === user.userID ? updatedUser : u))
          );
          setSelectedUser(updatedUser);
          setView("user-details");
          setError(null);
        } catch (error) {
          console.error("Failed to fetch user details:", error);
          setError(t("usersList.error.fetchUserDetails"));
        } finally {
          setLoading(false);
          setIsTransitioning(false);
        }
      },
      [setUsers, setSelectedUser, setView, setError, fetchWithRetry, setIsTransitioning, t]
    );

    const formatPhoneDisplay = useCallback((rawValue: string): string => {
      const digits = rawValue.replace(/[^\d]/g, "");
      let formatted = "";
      if (digits.length > 0) formatted += digits.slice(0, 2);
      if (digits.length > 2) formatted += " " + digits.slice(2, 5);
      if (digits.length > 5) formatted += " " + digits.slice(5, 8);
      return formatted;
    }, []);

    const renderSkeleton = () => (
      <div className="users-list" aria-busy="true">
        <div className="table-card">
          <h2>{t("usersList.title")}</h2>
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
                  {t("usersList.tableHeaders.createdAt")}
                </div>
                <div className="table-cell">
                  {t("usersList.tableHeaders.roles")}
                </div>
              </div>
            </div>
            <div className="table-body">
              {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <div key={i} className="table-row" aria-hidden="true">
                  <div className="table-cell">
                    <div className="custom-skeleton" />
                  </div>
                  <div className="table-cell">
                    <div className="custom-skeleton" />
                  </div>
                  <div className="table-cell">
                    <div className="custom-skeleton" />
                  </div>
                  <div className="table-cell">
                    <div className="custom-skeleton" />
                  </div>
                  <div className="table-cell">
                    <div className="custom-skeleton" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

    if (view !== "users" || !userPermissions.canViewUsers) {
      return null;
    }

    return (
      <div className="users-list">
        {(loading || filterLoading) && renderSkeleton()}
        {!loading && !filterLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="table-card"
          >
            <h2>{t("usersList.title")}</h2>
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
                    {t("usersList.tableHeaders.createdAt")}
                  </div>
                  <div className="table-cell">
                    {t("usersList.tableHeaders.roles")}
                  </div>
                </div>
              </div>
              <div className="table-body">
                {paginatedUsers.length > 0 ? (
                  paginatedUsers
                    .filter((user) => user && user.userID)
                    .map((user) => (
                      <div
                        key={user.userID}
                        className="table-row user-row"
                        onClick={() => handleUserSelect(user)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            handleUserSelect(user);
                          }
                        }}
                      >
                        <div className="table-cell">{`${user.firstname || ""} ${user.lastname || ""}`}</div>
                        <div className="table-cell">{user.email || "--"}</div>
                        <div className="table-cell">{`+216 ${formatPhoneDisplay(user.phone || "-- --- ---")}`}</div>
                        <div className="table-cell">
                          {user.createdAt ? formatDate(user.createdAt) : "--/--/----"}
                        </div>
                        <div className="table-cell">
                          {user.Roles == null || user.Roles.length === 0 ? (
                            "No Roles"
                          ) : user.Roles.map((r) => r.name).join(", ").length > 16 ? (
                            <span title={user.Roles.map((r) => r.name).join(", ")}>
                              {`${user.Roles.map((r) => r.name).join(", ").slice(0, 16)}...`}
                            </span>
                          ) : (
                            user.Roles.map((r) => r.name).join(", ")
                          )}
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="table-row">
                    <div className="table-cell">
                      {t("usersList.noUsersFound")}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {totalItems > 0 && (
              <div className="pagination">
                <button
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                  }}
                  disabled={currentPage === 1}
                >
                  {t("userView.pagination.previous")}
                </button>
                <span>
                  {t("userView.pagination.pageInfo", {
                    currentPage,
                    totalPages,
                  })}
                </span>
                <button
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                  }}
                  disabled={currentPage === totalPages}
                >
                  {t("userView.pagination.next")}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    );
  }
);

export default UsersList;