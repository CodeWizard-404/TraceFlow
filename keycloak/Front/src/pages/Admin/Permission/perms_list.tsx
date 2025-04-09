import React, { useMemo, useState } from "react";
import { FaSearch, FaFilter } from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import "../AdminDashboard.css";
import PermissionsClass from "../../../models/Enum/PermissionsClass";
import Permission from "../../../models/Permission";

interface PermsListProps {
    permissionsList: Permission[];
    view: string;
    setSelectedPermission: (permission: Permission | null) => void;
    searchQuery: string;
}

const PermsList: React.FC<PermsListProps> = ({
    permissionsList,
    view,
    setSelectedPermission,
    searchQuery,
}) => {
    const { effectivePermissions, userRoles } = useAuth();
    const [permissionSearch, setPermissionSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");

    const userPermissions = {
        canViewPermissions: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSIONS),
        canUpdatePermissions: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_PERMISSIONS),
    };

    const isSuperAdmin = userRoles?.some(r => r.name === import.meta.env.VITE_ROLES_SUPER_ADMIN);

    const filteredPermissions = useMemo(() => {
        let result = permissionsList.filter(perm => isSuperAdmin || !["Permission"].includes(perm.class));
        const searchTerm = permissionSearch || searchQuery;
        if (searchTerm) {
            result = result.filter(perm =>
                perm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                perm.class.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (selectedCategory !== "all") result = result.filter(perm => perm.class === selectedCategory);
        return result.reduce((acc: { [key: string]: Permission[] }, perm) => {
            const formattedName = perm.name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
            if (!acc[perm.class]) acc[perm.class] = [];
            acc[perm.class].push({ ...perm, name: formattedName });
            return acc;
        }, {} as { [key: string]: Permission[] });
    }, [permissionsList, permissionSearch, searchQuery, selectedCategory, isSuperAdmin]);

    const handlePermissionSelect = async (permission: Permission) => {
        if (!userPermissions.canUpdatePermissions) return;
        setSelectedPermission(permission);
    };

    if (view !== "permissions" || !userPermissions.canViewPermissions) return null;

    return (
        <div className="permissions-management">
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
                            onChange={e => setPermissionSearch(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    <div className="permissions-category">
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                        >
                            <option value="all">All Classes</option>
                            {Object.values(PermissionsClass).map(className => (
                                <option key={className} value={className}>
                                    {className}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="permissions-grid permissions-grid-0">
                {Object.entries(filteredPermissions).map(([className, permissions]) => (
                    <div key={className} className="permission-class-section">
                        <h3 className="permission-class-title">{className}</h3>
                        <div className="permission-class-grid">
                            {Array.isArray(permissions) && permissions.map(permission => (
                                <div
                                    key={permission.permissionID}
                                    className={`permission-card`}
                                    onClick={() => handlePermissionSelect(permission)}
                                >
                                    <h4>{permission.name}</h4>
                                    <p>{permission.description || "No description"}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PermsList;