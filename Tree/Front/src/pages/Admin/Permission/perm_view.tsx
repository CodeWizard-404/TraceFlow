/**
 * PermView.tsx
 * Component for viewing and editing a selected permission's details.
 * Optimized with memoization, skeleton loader, and efficient state management.
 * Includes validation and accessibility features.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaEdit } from "react-icons/fa";

// Context and APIs
import { useAuth } from "../../../context/AuthContext";
import { updatePermission } from "../../../apis/permissionAPI";

// Models
import Permission from "../../../models/Permission";
import PermissionsClass from "../../../models/Enum/PermissionsClass";

// Styles
import "../AdminDashboard.css";

// Props interface
interface PermViewProps {
    selectedPermission: Permission | null;
    setSelectedPermission: (permission: Permission | null) => void;
    permissionsList: Permission[];
    setPermissionsList: (permissions: Permission[]) => void;
    view: string;
    setError: (error: string | null) => void;
}

// Constants
const SKELETON_DELAY = 500; // Delay skeleton visibility for 0.5 seconds

// PermView component, memoized
const PermView: React.FC<PermViewProps> = React.memo(
    ({
        selectedPermission,
        setSelectedPermission,
        permissionsList,
        setPermissionsList,
        view,
        setError,
    }) => {
        // Auth context
        const { effectivePermissions } = useAuth();

        // State declarations
        const [editedPermission, setEditedPermission] = useState<Partial<Permission>>({});
        const [isEditingPermission, setIsEditingPermission] = useState(false);
        const [loading, setLoading] = useState(true);
        const [permissionFormErrors, setPermissionFormErrors] = useState({
            class: "",
            description: "",
        });
        const [permissionTouched, setPermissionTouched] = useState({
            class: false,
            description: false,
        });

        // Memoized permissions object
        const userPermissions = useMemo(
            () => ({
                canUpdatePermissions: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_PERMISSIONS
                ),
                canViewPermissionDetails: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSION_DETAILS
                ),
            }),
            [effectivePermissions]
        );

        // Simulate delayed loading for skeleton
        useEffect(() => {
            const timer = setTimeout(() => setLoading(false), SKELETON_DELAY);
            return () => clearTimeout(timer);
        }, []);

        // Validation functions
        const validatePermissionClass = useCallback((value: string): string => {
            const trimmed = value.trim();
            if (!trimmed) return "Permission class is required";
            if (trimmed.length < 3) return "Class must be at least 3 characters";
            if (trimmed.length > 20) return "Class must be 20 characters or less";
            if (!/^[A-Za-z]+$/.test(trimmed)) return "Class can only contain letters";
            return "";
        }, []);

        const validatePermissionDescription = useCallback((value: string): string => {
            const trimmed = value.trim();
            if (trimmed.length > 150) return "Description must be 150 characters or less";
            return "";
        }, []);

        // Handle edit permission
        const handleEditPermission = useCallback(
            (permission: Permission) => {
                if (!userPermissions.canUpdatePermissions) return;
                setIsEditingPermission(true);
                setEditedPermission({
                    name: permission.name,
                    class: permission.class,
                    description: permission.description,
                });
                setSelectedPermission(permission);
            },
            [userPermissions.canUpdatePermissions, setSelectedPermission]
        );

        // Handle save permission edit
        const handleSavePermissionEdit = useCallback(async () => {
            if (!selectedPermission || !userPermissions.canUpdatePermissions || !isEditingPermission)
                return;

            const errors = {
                class: validatePermissionClass(editedPermission.class || ""),
                description: validatePermissionDescription(editedPermission.description || ""),
            };

            setPermissionFormErrors(errors);
            if (Object.values(errors).some((error) => error)) {
                setError("Please correct the errors before saving.");
                return;
            }

            setLoading(true);
            try {
                const updatedPermission = await updatePermission(selectedPermission.permissionID, {
                    className: editedPermission.class!.trim(),
                    description: editedPermission.description?.trim(),
                });
                setPermissionsList(
                    permissionsList.map((p) =>
                        p.permissionID === selectedPermission.permissionID ? updatedPermission : p
                    )
                );
                setSelectedPermission(updatedPermission);
                setIsEditingPermission(false);
                setEditedPermission({});
                setPermissionFormErrors({ class: "", description: "" });
                setPermissionTouched({ class: false, description: false });
                setError(null);
            } catch (error: unknown) {
                console.error("Failed to update permission:", error);
                setError("Failed to update permission.");
            } finally {
                setLoading(false);
            }
        }, [
            selectedPermission,
            userPermissions.canUpdatePermissions,
            isEditingPermission,
            editedPermission,
            permissionsList,
            setPermissionsList,
            setSelectedPermission,
            setError,
            validatePermissionClass,
            validatePermissionDescription,
        ]);

        // Render skeleton loader
        const renderSkeleton = () => (
            <div aria-busy="true">
                <div className="card-header">
                    <div className="custom-skeleton" style={{ width: "200px", height: "24px" }} />
                    <div className="permission-actions">
                        <div className="custom-skeleton" style={{ width: "60px", height: "32px" }} />
                    </div>
                </div>
                <div className="custom-skeleton" style={{ width: "150px", height: "16px", marginTop: "10px" }} />
                <div className="custom-skeleton" style={{ width: "100%", height: "16px", marginTop: "10px" }} />
                <div className="custom-skeleton" style={{ width: "100%", height: "16px", marginTop: "8px" }} />
                <div className="custom-skeleton" style={{ width: "80%", height: "16px", marginTop: "8px" }} />

            </div>
        );

        // Return null if not in permission-details view or no permission
        if (view !== "permission-details" || !selectedPermission || !userPermissions.canViewPermissionDetails)
            return null;

        // Render UI
        return (
            <div className="details-card">
                {loading && renderSkeleton()}
                {!loading && (
                    <>
                        <div className="card-header">
                            {isEditingPermission && userPermissions.canUpdatePermissions ? (
                                <div className="permission-edit-form">
                                    <div className="permission-edit-header">
                                        <h2>Edit Permission</h2>
                                    </div>
                                    <div className="form-group">
                                        <label>Name</label>
                                        <input
                                            type="text"
                                            value={editedPermission.name || ""}
                                            disabled
                                            className="permission-edit-input disabled"
                                            aria-disabled="true"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Class *</label>
                                        <select
                                            value={editedPermission.class || ""}
                                            onChange={(e) => {
                                                setEditedPermission({ ...editedPermission, class: e.target.value as PermissionsClass });
                                                setPermissionFormErrors({
                                                    ...permissionFormErrors,
                                                    class: validatePermissionClass(e.target.value),
                                                });
                                            }}
                                            onBlur={() => setPermissionTouched({ ...permissionTouched, class: true })}
                                            className={`permission-edit-input ${permissionTouched.class && permissionFormErrors.class ? "invalid-vibrate" : ""
                                                }`}
                                            required
                                            aria-invalid={permissionTouched.class && !!permissionFormErrors.class}
                                        >
                                            <option value="">Select a class</option>
                                            {Object.values(PermissionsClass).map((className) => (
                                                <option key={className} value={className}>
                                                    {className}
                                                </option>
                                            ))}
                                        </select>
                                        {permissionFormErrors.class && permissionTouched.class && (
                                            <span className="error-text">{permissionFormErrors.class}</span>
                                        )}
                                    </div>
                                    <textarea
                                        value={editedPermission.description || ""}
                                        onChange={(e) => {
                                            setEditedPermission({ ...editedPermission, description: e.target.value });
                                            setPermissionFormErrors({
                                                ...permissionFormErrors,
                                                description: validatePermissionDescription(e.target.value),
                                            });
                                        }}
                                        onBlur={() => setPermissionTouched({ ...permissionTouched, description: true })}
                                        placeholder="Permission Description"
                                        className={`permission-edit-textarea ${permissionTouched.description && permissionFormErrors.description
                                            ? "invalid-vibrate"
                                            : ""
                                            }`}
                                        aria-invalid={
                                            permissionTouched.description && !!permissionFormErrors.description
                                        }
                                    />
                                    {permissionFormErrors.description && permissionTouched.description && (
                                        <span className="error-text">{permissionFormErrors.description}</span>
                                    )}
                                    <div className="permission-edit-actions">
                                        <button
                                            className="action-button"
                                            onClick={handleSavePermissionEdit}
                                            disabled={loading}
                                            aria-busy={loading ? "true" : "false"}
                                        >
                                            {loading ? "Saving..." : "Save"}
                                        </button>
                                        <button
                                            className="cancel-button"
                                            onClick={() => {
                                                setIsEditingPermission(false);
                                                setEditedPermission({});
                                            }}
                                            disabled={loading}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <h2>{selectedPermission.name}</h2>
                                    <div className="permission-actions">
                                        <button
                                            className="edit-button edit-button-0"
                                            onClick={() => handleEditPermission(selectedPermission)}
                                            disabled={loading || !userPermissions.canUpdatePermissions}
                                            aria-label="Edit permission"
                                        >
                                            <FaEdit /> Edit
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        {!isEditingPermission && userPermissions.canViewPermissionDetails && (
                            <>
                                <p>Class: {selectedPermission.class}</p>
                                <p>Description: {selectedPermission.description || "No description"}</p>
                            </>
                        )}
                    </>
                )}
            </div>
        );
    }
);

export default PermView;