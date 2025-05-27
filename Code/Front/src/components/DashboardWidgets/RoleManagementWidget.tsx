import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllRoles } from '../../apis/roleAPI';
import Role from '../../models/Role';

const RoleManagementWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_MANAGE_ROLES
    );

    useEffect(() => {
        const fetchRoles = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }
            try {
                const response = await getAllRoles();
                setRoles(response || []);
            } catch (err) {
                setError('Failed to fetch roles');
            } finally {
                setLoading(false);
            }
        };
        fetchRoles();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading roles...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Role Management</h2>
            {roles.length === 0 ? (
                <p className="text-gray-600">No roles defined.</p>
            ) : (
                <ul className="list-disc pl-5">
                    {roles.map((role) => (
                        <li key={role.roleID} className="mb-2">
                            {role.name} {role.description ? `(${role.description})` : ''}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default RoleManagementWidget;