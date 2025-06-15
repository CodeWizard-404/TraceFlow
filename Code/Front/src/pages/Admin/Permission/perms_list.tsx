import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaFilter, FaSearch } from "react-icons/fa";
import { AnimatePresence, motion } from "framer-motion";

// Context and Models
import { useAuth } from "../../../context/AuthContext";
import Permission from "../../../models/Permission";
import PermissionsClass from "../../../models/Enum/PermissionsClass";

// Components
import PermView from "./perm_view";

// Styles
import "../AdminDashboard.css";

// Props interface
interface PermsListProps {
    permissionsList: Permission[];
    view: string;
    setView: (view: string) => void;
    setSelectedPermission: (permission: Permission | null) => void;
    searchQuery: string;
    setError: (error: string) => void;
}

// Constants
const SKELETON_CATEGORIES = 2; // Number of permission categories
const SKELETON_PERMS_PER_CATEGORY = 4; // Number of permission cards per category

// Animation variants
const viewVariants = {
    hidden: { height: 0, opacity: 0, marginTop: 0 },
    visible: { height: "auto", opacity: 1, marginTop: 10 },
    exit: { height: 0, opacity: 0, marginTop: 0 },
};

// PermsList component, memoized
const PermsList: React.FC<PermsListProps> = React.memo(
    ({ permissionsList, view, setSelectedPermission, searchQuery, setError }) => {
        // Auth context
        const { effectivePermissions, userRoles } = useAuth();

        // State declarations
        const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
        const [loading, setLoading] = useState(true); // Initialize as true
        const [permissionSearch, setPermissionSearch] = useState("");
        const [selectedCategory, setSelectedCategory] = useState<string>("all");
        const [selectedPermissionId, setSelectedPermissionId] = useState<string | null>(null); // Track toggled permission

        // Memoized permissions object
        const userPermissions = useMemo(
            () => ({
                canUpdatePermissions: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_PERMISSIONS
                ),
                canViewPermissions: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS
                ),
            }),
            [effectivePermissions]
        );

        // Memoized super admin check
        const isSuperAdmin = useMemo(
            () => userRoles?.some((r) => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN),
            [userRoles]
        );

        // Sync global search query
        useEffect(() => {
            setInternalSearchQuery(searchQuery);
        }, [searchQuery]);

        // Dynamic loading state based on permissionsList prop
        useEffect(() => {
            if (permissionsList.length > 0) {
                setLoading(false); // Set loading to false when permissions are available
            }
        }, [permissionsList]);

        // Memoized filtered permissions
        const filteredPermissions = useMemo(() => {
            let result = permissionsList.filter(
                (perm) => isSuperAdmin || !["Permission"].includes(perm.class)
            );
            const searchTerm = permissionSearch || internalSearchQuery;
            if (searchTerm) {
                // Transform search term: replace spaces with underscores for matching
                const transformedSearchTerm = searchTerm.replace(/\s+/g, "_").toLowerCase();
                result = result.filter(
                    (perm) =>
                        perm.name.toLowerCase().includes(transformedSearchTerm) ||
                        perm.class.toLowerCase().includes(transformedSearchTerm)
                );
            }
            if (selectedCategory !== "all") {
                result = result.filter((perm) => perm.class === selectedCategory);
            }
            return result.reduce((acc: { [key: string]: Permission[] }, perm) => {
                const formattedName = perm.name
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (char) => char.toUpperCase());
                if (!acc[perm.class]) acc[perm.class] = [];
                acc[perm.class].push({ ...perm, name: formattedName });
                return acc;
            }, {} as { [key: string]: Permission[] });
        }, [permissionsList, permissionSearch, internalSearchQuery, selectedCategory, isSuperAdmin]);

        // Handle permission toggle
        const handlePermissionToggle = useCallback(
            (permission: Permission) => {
                if (!userPermissions.canUpdatePermissions) return;
                setSelectedPermission(permission);
                setSelectedPermissionId((prev) =>
                    prev === permission.permissionID ? null : permission.permissionID
                );
            },
            [userPermissions.canUpdatePermissions, setSelectedPermission]
        );

        // Render skeleton loader
        const renderSkeleton = () => (
            <div aria-busy="true">
                <div className="permissions-filter-section">
                    <div className="permissions-filter-header">
                        <FaFilter />
                        <div className="custom-skeleton" style={{ width: "100px" }} />
                    </div>
                    <div className="permissions-filter-controls">
                        <div className="permissions-search">
                            <FaSearch className="search-icon" />
                            <div className="custom-skeleton" style={{ width: "150px" }} />
                        </div>
                        <div className="permissions-category">
                            <div className="custom-skeleton" style={{ width: "100px" }} />
                        </div>
                    </div>
                </div>
                <div className="permissions-grid permissions-grid-0">
                    {Array.from({ length: SKELETON_CATEGORIES }).map((_, i) => (
                        <div key={i} className="permission-class-section">
                            <div className="custom-skeleton" style={{ width: "120px" }} />
                            <div className="permission-class-grid">
                                {Array.from({ length: SKELETON_PERMS_PER_CATEGORY }).map((_, j) => (
                                    <div key={j} className="permission-card">
                                        <div className="custom-skeleton" style={{ width: "80%" }} />
                                        <div className="custom-skeleton" style={{ width: "60%" }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );

        // Return null if not in permissions view or no permission
        if (view !== "permissions" || !userPermissions.canViewPermissions) return null;

        // Render UI
        return (
            <div className="permissions-management">
                {loading && renderSkeleton()}
                {!loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="permissions-filter-section">
                            <div className="permissions-filter-header">
                                <FaFilter />
                                <label>Filter Permissions</label>
                            </div>
                            <div className="permissions-filter-controls">
                                <div className="permissions-search">
                                    <FaSearch className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search permissions..."
                                        value={permissionSearch}
                                        onChange={(e) => setPermissionSearch(e.target.value)}
                                        className="search-input"
                                        aria-label="Search permissions"
                                    />
                                </div>
                                <div className="permissions-category">
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        aria-label="Filter by permission class"
                                    >
                                        <option value="all">All Classes</option>
                                        {Object.values(PermissionsClass)
                                            .sort()
                                            .map((className) => (
                                                <option key={className} value={className}>
                                                    {className}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="permissions-grid permissions-grid-0">
                            {Object.entries(filteredPermissions).length > 0 ? (
                                Object.entries(filteredPermissions)
                                    .sort(([classNameA], [classNameB]) => classNameA.localeCompare(classNameB))
                                    .map(([className, permissions]) => (
                                        <div key={className} className="permission-class-section">
                                            <h3 className="permission-class-title">{className}</h3>
                                            <div className="permission-class-grid">
                                                {Array.isArray(permissions) &&
                                                    permissions.map((permission) => (
                                                        <div key={permission.permissionID}>
                                                            <div
                                                                className="permission-card"
                                                                onClick={() => handlePermissionToggle(permission)}
                                                                aria-expanded={selectedPermissionId === permission.permissionID}
                                                                role="button"
                                                                tabIndex={0}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter" || e.key === " ") {
                                                                        handlePermissionToggle(permission);
                                                                    }
                                                                }}
                                                            >
                                                                <h4>{permission.name}</h4>
                                                                <p>{permission.description || "No description"}</p>
                                                            </div>
                                                            <AnimatePresence>
                                                                {selectedPermissionId === permission.permissionID && (
                                                                    <motion.div
                                                                        variants={viewVariants}
                                                                        initial="hidden"
                                                                        animate="visible"
                                                                        exit="exit"
                                                                        transition={{ duration: 0.3 }}
                                                                    >
                                                                        <PermView
                                                                            selectedPermission={permission}
                                                                            setSelectedPermission={setSelectedPermission}
                                                                            permissionsList={permissionsList}
                                                                            setPermissionsList={() => { }} // No-op for toggle mode
                                                                            view="permission-details"
                                                                            setError={(error) => setError(error || "")}
                                                                        />
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    ))
                            ) : (
                                renderSkeleton()
                            )}
                        </div>
                    </motion.div>
                )}
            </div>
        );
    }
);

export default PermsList;