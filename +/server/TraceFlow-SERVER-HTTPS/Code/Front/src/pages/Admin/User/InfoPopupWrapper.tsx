/**
 * InfoPopupWrapper.tsx
 * Wraps the lazy-loaded InfoPopup for role and permission details.
 */

import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { FaAngleDown } from "react-icons/fa";
import { useError } from "../../../context/ErrorContext";
import { getPermissionsByRole } from "../../../apis/permissionAPI";
import Role from "../../../models/Role";
import Permission from "../../../models/Permission";
import "../AdminDashboard.css";

const InfoPopup = lazy(() => import("../InfoPopup"));

interface InfoPopupWrapperProps {
    roles: Role[];
    permissionsList: Permission[];
    activeRolePopup: string | null;
    activeOverridePopup: string | null;
    setActiveRolePopup: React.Dispatch<React.SetStateAction<string | null>>;
    setActiveOverridePopup: React.Dispatch<React.SetStateAction<string | null>>;
    isSuperAdmin: boolean;
}

const InfoPopupWrapper: React.FC<InfoPopupWrapperProps> = ({
    roles,
    permissionsList,
    activeRolePopup,
    activeOverridePopup,
    setActiveRolePopup,
    setActiveOverridePopup,
    isSuperAdmin,
}) => {
    const { setError: setGlobalError } = useError();
    const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);
    const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!activeRolePopup) {
            setRolePermissions([]);
            return;
        }
        const fetchRolePermissions = async () => {
            try {
                const permissions = await getPermissionsByRole(activeRolePopup);
                setRolePermissions(permissions || []);
            } catch (error) {
                setGlobalError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load role permissions."
                );
            }
        };
        fetchRolePermissions();
    }, [activeRolePopup, setGlobalError]);

    const toggleClassExpansion = useCallback((className: string) => {
        setExpandedClasses((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(className)) newSet.delete(className);
            else newSet.add(className);
            return newSet;
        });
    }, []);

    const renderRolePopupContent = useCallback(
        (roleID: string) => {
            const role = roles.find((r) => r.roleID === roleID);
            if (!role) return <p>Role not found.</p>;
            return (
                <>
                    <h4>{role.name}</h4>
                    <p>{role.description || "No description available."}</p>
                    <h5>Permissions by Class:</h5>
                    {rolePermissions.length > 0 ? (
                        Object.entries(
                            rolePermissions
                                .filter(
                                    (perm) =>
                                        isSuperAdmin || !["Role", "Permission"].includes(perm.class)
                                )
                                .reduce((acc: { [key: string]: Permission[] }, perm) => {
                                    const formattedName = perm.name
                                        .replace(/_/g, " ")
                                        .replace(/\b\w/g, (char) => char.toUpperCase());
                                    acc[perm.class] = acc[perm.class] || [];
                                    acc[perm.class].push({ ...perm, name: formattedName });
                                    return acc;
                                }, {})
                        ).map(([className, perms]) => (
                            <div key={className} className="permission-class-item">
                                <button
                                    className="class-toggle"
                                    onClick={() => toggleClassExpansion(className)}
                                >
                                    {className} ({perms.length})
                                    <FaAngleDown
                                        className={`toggle-icon ${expandedClasses.has(className) ? "expanded" : ""
                                            }`}
                                    />
                                </button>
                                <ul
                                    className={`permission-list ${expandedClasses.has(className) ? "expanded" : ""
                                        }`}
                                >
                                    {perms.map((perm) => (
                                        <li key={perm.permissionID}>{perm.name}</li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    ) : (
                        <p>No permissions assigned.</p>
                    )}
                </>
            );
        },
        [roles, rolePermissions, isSuperAdmin, expandedClasses, toggleClassExpansion]
    );

    const renderOverridePopupContent = useCallback(
        (permissionID: string) => {
            const permission = permissionsList.find(
                (perm) => perm.permissionID === permissionID
            );
            if (!permission) return <p>Permission not found.</p>;
            return (
                <>
                    <h4>{permission.name}</h4>
                    <p>{permission.description || "No description available."}</p>
                    <p>
                        <strong>Class:</strong> {permission.class}
                    </p>
                </>
            );
        },
        [permissionsList]
    );

    return (
        <Suspense fallback={<div>Loading popup...</div>}>
            <InfoPopup
                isOpen={!!activeRolePopup}
                onClose={() => setActiveRolePopup(null)}
                contentRenderer={() => renderRolePopupContent(activeRolePopup!)}
            />
            <InfoPopup
                isOpen={!!activeOverridePopup}
                onClose={() => setActiveOverridePopup(null)}
                contentRenderer={() =>
                    renderOverridePopupContent(activeOverridePopup!)
                }
            />
        </Suspense>
    );
};

export default React.memo(InfoPopupWrapper);