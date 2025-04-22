import React, { useMemo, useEffect, useCallback, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getSupervisorsByUser, getManagersByUser, getAllUsers } from '../../../apis/userAPI';
import User from '../../../models/User';
import Role from '../../../models/Role';
import { SortField, SortOrder, ViewMode } from '../adminTypes';
import { t } from 'i18next';
import { debounce } from 'lodash';
import { onNotification, offNotification, isSocketConnected } from '../../../lib/socket';
import { getEntityEvents, NotificationEvent } from '../../../lib/notifEvents';
import '../AdminDashboard.css';

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
  roles: Role[];
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
  setIsTransitioning: React.Dispatch<React.SetStateAction<boolean>>;
}

const MAX_RETRIES = 1;
const BASE_RETRY_DELAY = 300;
const CACHE_DURATION = 15 * 60 * 1000;
const SKELETON_ROWS = 10;

const cache = new Map<string, { data: User[]; timestamp: number }>();

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
    roles,
    currentPage,
    setCurrentPage,
    itemsPerPage,
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

    useEffect(() => {
      debouncedSetSearchQuery(searchQuery);
      return () => debouncedSetSearchQuery.cancel();
    }, [searchQuery, debouncedSetSearchQuery]);

    useEffect(() => {
      if (users.length === 0) {
        setLoading(true);
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
      } else {
        setLoading(false);
      }
    }, [users]);

    useEffect(() => {
      setFilterLoading(true);
      const timer = setTimeout(() => setFilterLoading(false), 300);
      return () => clearTimeout(timer);
    }, [roleFilter]);

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
            err.message.includes('out of shared memory')
          ) {
            const delay = BASE_RETRY_DELAY * (MAX_RETRIES - retries + 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
            return fetchWithRetry(fetchFn, cacheKey, retries - 1);
          }
          return [];
        }
      },
      [getCachedData, setCachedData]
    );

    // WebSocket listener for user events
    useEffect(() => {
      if (view !== 'users' || !userPermissions.canViewUsers || !isSocketConnected()) return;

      let isMounted = true;

      const setupNotifications = async () => {
        try {
          const userEvents = await getEntityEvents('user');
          if (!isMounted) return;

          const handleUserEvent = async (event: NotificationEvent, data: User) => {
            console.log(`Received WebSocket event: ${event}`, data);
            cache.delete('all_users'); // Clear cache to ensure fresh data
            try {
              switch (event) {
                case 'user:created': {
                  const newUser: User = {
                    userID: data.userID,
                    firstname: data.firstname || 'Unknown',
                    lastname: data.lastname || 'User',
                    email: data.email,
                    phone: data.phone,
                    Roles: data.Roles || [],
                    password: '',
                    wallet: data.wallet,
                  };
                  // Check if user matches filters
                  const matchesSearch =
                    !internalSearchQuery ||
                    `${newUser.firstname} ${newUser.lastname}`
                      .toLowerCase()
                      .includes(internalSearchQuery.toLowerCase()) ||
                    newUser.email.toLowerCase().includes(internalSearchQuery.toLowerCase()) ||
                    (newUser.phone && newUser.phone.includes(internalSearchQuery));
                  const matchesRole =
                    roleFilter === 'all' ||
                    newUser.Roles?.some((r) => String(r.roleID) === roleFilter);
                  if (matchesSearch && matchesRole) {
                    setUsers((prev) => [...prev, newUser]);
                  }
                  break;
                }
                case 'user:updated':
                case 'user:profile_updated':
                case 'user:supervisors_assigned':
                case 'user:supervisors_revoked':
                case 'user:google_account_assigned': {
                  setUsers((prev) =>
                    prev.map((u) =>
                      u.userID === data.userID
                        ? { ...u, ...data, updatedAt: new Date() }
                        : u
                    )
                  );
                  break;
                }
                case 'user:deleted': {
                  setUsers((prev) => prev.filter((u) => u.userID !== data.userID));
                  break;
                }
                default:
                  // Handle custom user events defined by admin
                  if (event.startsWith('user:')) {
                    // Refresh user list for unrecognized user events
                    const usersData = await getAllUsers();
                    setCachedData('all_users', usersData);
                    setUsers(usersData);
                  }
              }
              // Update cache
              const usersData = await getAllUsers();
              setCachedData('all_users', usersData);
            } catch (err) {
              console.error('Failed to handle user event:', err);
              setError('Failed to update user list in real-time.');
            }
          };

          userEvents.forEach((event) => {
            onNotification((ev: NotificationEvent, data: unknown) => {
              if (ev === event && isMounted) {
                handleUserEvent(ev, data as User);
              }
            });
          });
        } catch (err) {
          console.error('Failed to set up WebSocket notifications:', err);
          setError('Failed to initialize real-time updates.');
        }
      };

      setupNotifications();

      return () => {
        isMounted = false;
        offNotification();
      };
    }, [
      view,
      userPermissions.canViewUsers,
      internalSearchQuery,
      roleFilter,
      setUsers,
      setError,
      setCachedData,
    ]);

    const filteredAndSortedUsers = useMemo(() => {
      let result = [...users];

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
            `${user.firstname} ${user.lastname}`
              .toLowerCase()
              .includes(internalSearchQuery.toLowerCase()) ||
            user.email
              .toLowerCase()
              .includes(internalSearchQuery.toLowerCase()) ||
            (user.phone && user.phone.includes(internalSearchQuery))
        );
      }

<<<<<<< HEAD
      if (roleFilter !== 'all') {
        const selectedRole = roles.find((r) => String(r.roleID).trim() === String(roleFilter).trim());
=======
      if (roleFilter !== "all") {
        // Map roleFilter ID to roleName using roles array
        const selectedRole = roles.find(
          (r) => String(r.roleID).trim() === String(roleFilter).trim()
        );
>>>>>>> c248aa766c4052a29162b37618caa6f5c33df62d
        const roleNameFilter = selectedRole?.name;

        result = result.filter((user) => {
          const userRoles = Array.isArray(user.Roles) ? user.Roles : [];
          return userRoles.some((role) => {
            const roleIdMatch =
<<<<<<< HEAD
              role.roleID && String(role.roleID).trim() === String(roleFilter).trim();
=======
              role.roleID &&
              String(role.roleID).trim() === String(roleFilter).trim();

            // Fallback to roleName if ID fields are unavailable
>>>>>>> c248aa766c4052a29162b37618caa6f5c33df62d
            const roleNameMatch =
              roleNameFilter &&
              role.name &&
              String(role.name).trim() === String(roleNameFilter).trim();
<<<<<<< HEAD
=======

>>>>>>> c248aa766c4052a29162b37618caa6f5c33df62d
            return roleIdMatch || roleNameMatch;
          });
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
          case 'name':
            valueA = `${a.firstname} ${a.lastname}`.toLowerCase();
            valueB = `${b.firstname} ${b.lastname}`.toLowerCase();
            break;
          case 'email':
            valueA = a.email.toLowerCase();
            valueB = b.email.toLowerCase();
            break;
          case 'role':
            valueA = a.Roles?.[0]?.name?.toLowerCase() || 'no role';
            valueB = b.Roles?.[0]?.name?.toLowerCase() || 'no role';
            break;
          default:
            valueA = '';
            valueB = '';
        }
        return sortOrder === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      });

      return result;
    }, [
      users,
      isSuperAdmin,
      internalSearchQuery,
      roleFilter,
      sortField,
      sortOrder,
      roles,
    ]);

    const totalItems = filteredAndSortedUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const paginatedUsers = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      return filteredAndSortedUsers.slice(start, end);
    }, [filteredAndSortedUsers, currentPage, itemsPerPage]);

    useEffect(() => {
      if (currentPage > totalPages) {
        setCurrentPage(totalPages);
      }
    }, [totalPages, currentPage, setCurrentPage]);

    const handleUserSelect = useCallback(
      async (user: User) => {
        setIsTransitioning(true);
        setSelectedUser(user);
        try {
          setLoading(true);
          const [supervisors, managers] = await Promise.all([
            fetchWithRetry(
              () => getSupervisorsByUser(user.userID),
              `supervisors_${user.userID}`
            ),
            fetchWithRetry(
              () => getManagersByUser(user.userID),
              `managers_${user.userID}`
            ),
          ]);
          const updatedUser = { ...user, supervisors, managers };
          setUsers((prev) =>
            prev.map((u) => (u.userID === user.userID ? updatedUser : u))
          );
          setSelectedUser(updatedUser);
          setView('user-details');
          setError(null);
        } catch (error) {
          console.error('Failed to fetch user details:', error);
          setError('Failed to load user details.');
        } finally {
          setLoading(false);
          setIsTransitioning(false);
        }
      },
      [
        setUsers,
        setSelectedUser,
        setView,
        setError,
        fetchWithRetry,
        setIsTransitioning,
      ]
    );

    const formatPhoneDisplay = useCallback((rawValue: string): string => {
      const digits = rawValue.replace(/[^\d]/g, '');
      let formatted = '';
      if (digits.length > 0) formatted += digits.slice(0, 2);
      if (digits.length > 2) formatted += ' ' + digits.slice(2, 5);
      if (digits.length > 5) formatted += ' ' + digits.slice(5, 8);
      return formatted;
    }, []);

    const renderSkeleton = () => (
      <div className="users-list" aria-busy="true">
        <div className="table-card">
          <h2>{t('usersList.title')}</h2>
          <div className="table-container">
            <div className="table-head">
              <div className="table-row">
<<<<<<< HEAD
                <div className="table-cell">{t('usersList.tableHeaders.name')}</div>
                <div className="table-cell">{t('usersList.tableHeaders.email')}</div>
                <div className="table-cell">{t('usersList.tableHeaders.phone')}</div>
                <div className="table-cell">{t('usersList.tableHeaders.roles')}</div>
=======
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
>>>>>>> c248aa766c4052a29162b37618caa6f5c33df62d
              </div>
            </div>
            <div className="table-body">
              {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <div key={i} className="table-row">
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

    if (view !== 'users' || !userPermissions.canViewUsers) {
      return null;
    }

    return (
      <div className="users-list">
        {(loading || filterLoading) && renderSkeleton()}
        {!loading && !filterLoading && (
          <div className="table-card">
            <h2>{t('usersList.title')}</h2>
            <div className="table-container">
              <div className="table-head">
                <div className="table-row">
<<<<<<< HEAD
                  <div className="table-cell">{t('usersList.tableHeaders.name')}</div>
                  <div className="table-cell">{t('usersList.tableHeaders.email')}</div>
                  <div className="table-cell">{t('usersList.tableHeaders.phone')}</div>
                  <div className="table-cell">{t('usersList.tableHeaders.roles')}</div>
=======
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
>>>>>>> c248aa766c4052a29162b37618caa6f5c33df62d
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
                        user.phone || '-- --- ---'
                      )}`}</div>
                      <div className="table-cell">
                        {user.Roles == null || user.Roles.length === 0 ? (
<<<<<<< HEAD
                          'No Roles'
                        ) : user.Roles.map((r) => r.name).join(', ').length > 16 ? (
                          <span title={user.Roles.map((r) => r.name).join(', ')}>
                            {`${user.Roles.map((r) => r.name).join(', ').slice(0, 16)}...`}
=======
                          "No Roles"
                        ) : user.Roles.map((r) => r.name).join(", ").length >
                          16 ? (
                          <span
                            title={user.Roles.map((r) => r.name).join(", ")}
                          >
                            {`${user.Roles.map((r) => r.name)
                              .join(", ")
                              .slice(0, 16)}...`}
>>>>>>> c248aa766c4052a29162b37618caa6f5c33df62d
                          </span>
                        ) : (
                          user.Roles.map((r) => r.name).join(', ')
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="table-row">
                    <div className="table-cell">
                      {t('usersList.noUsersFound')}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {totalItems > 0 && (
              <div className="pagination">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  {t('userView.pagination.previous')}
                </button>
                <span>
                  {t('userView.pagination.pageInfo', {
                    currentPage,
                    totalPages,
                  })}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  {t('userView.pagination.next')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

export default UsersList;
