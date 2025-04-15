import React, { useState } from "react";
import { FaEdit, FaTrash, FaTimes } from "react-icons/fa";
import { useAuth } from "../../../context/AuthContext";
import { updatePermission, deletePermission } from "../../../apis/permissionAPI";
import "../AdminDashboard.css";
import PermissionsClass from "../../../models/Enum/PermissionsClass";
import Permission from "../../../models/Permission";

interface PermViewProps {
    selectedPermission: Permission | null;
    setSelectedPermission: (permission: Permission | null) => void;
    permissionsList: Permission[];
    setPermissionsList: (permissions: Permission[]) => void;
    view: string;
    setError: (error: string | null) => void;
}

const PermView: React.FC<PermViewProps> = ({
    selectedPermission,
    setSelectedPermission,
    permissionsList,
    setPermissionsList,
    view,
    setError,
}) => {
    const { token, effectivePermissions } = useAuth();
    const [isEditingPermission, setIsEditingPermission] = useState(false);
    const [editedPermission, setEditedPermission] = useState<Partial<Permission>>({});
    const [permissionFormErrors, setPermissionFormErrors] = useState({
        name: "",
        class: "",
        description: "",
    });
    const [permissionTouched, setPermissionTouched] = useState({
        name: false,
        class: false,
        description: false,
    });
    const [loading, setLoading] = useState(false);

    const userPermissions = {
        canViewPermissionDetails: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_PERMISSION_DETAILS),
        canUpdatePermissions: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_PERMISSIONS),
        canDeletePermissions: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_DELETE_PERMISSIONS),
    };

    const validatePermissionName = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return "Permission name is required";
        if (trimmed.length < 10) return "Permission name must be at least 10 characters";
        if (trimmed.length > 30) return "Permission name must be 30 characters or less";
        if (!/^[a-z_]+$/.test(trimmed)) return "Permission name must contain only lowercase letters and underscores (e.g., read_users)";
        return "";
    };

    const validatePermissionClass = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return "Permission class is required";
        if (trimmed.length < 3) return "Class must be at least 3 characters";
        if (trimmed.length > 20) return "Class must be 20 characters or less";
        if (!/^[A-Za-z]+$/.test(trimmed)) return "Class can only contain letters";
        return "";
    };

    const validatePermissionDescription = (value: string): string => {
        const trimmed = value.trim();
        if (trimmed.length > 150) return "Description must be 150 characters or less";
        return "";
    };

    const handleEditPermission = (permission: Permission) => {
        if (!userPermissions.canUpdatePermissions) return;
        setIsEditingPermission(true);
        setEditedPermission({ name: permission.name, class: permission.class, description: permission.description });
        setSelectedPermission(permission);
    };

    const handleSavePermissionEdit = async () => {
        if (!selectedPermission || !userPermissions.canUpdatePermissions || !isEditingPermission) return;

        const errors = {
            name: validatePermissionName(editedPermission.name || ""),
            class: validatePermissionClass(editedPermission.class || ""),
            description: validatePermissionDescription(editedPermission.description || ""),
        };

        setPermissionFormErrors(errors);
        if (Object.values(errors).some(error => error)) {
            setError("Please correct the errors before saving.");
            return;
        }

        setLoading(true);
        try {
            const updatedPermission = await updatePermission(selectedPermission.permissionID, {
                name: editedPermission.name!.trim(),
                className: editedPermission.class!.trim(),
                description: editedPermission.description?.trim(),
            }, token!);
            setPermissionsList(permissionsList.map(p => p.permissionID === selectedPermission.permissionID ? updatedPermission : p));
            setSelectedPermission(updatedPermission);
            setIsEditingPermission(false);
            setEditedPermission({});
            setPermissionFormErrors({ name: "", class: "", description: "" });
            setPermissionTouched({ name: false, class: false, description: false });
            setError(null);
        } catch (error) {
            console.error("Failed to update permission:", error);
            setError("Failed to update permission.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePermission = async (permission: Permission) => {
        if (!userPermissions.canDeletePermissions) return;
        setLoading(true);
        try {
            await deletePermission(permission.permissionID, token!);
            setPermissionsList(permissionsList.filter(p => p.permissionID !== permission.permissionID));
            setSelectedPermission(null);
            setError(null);
        } catch (error) {
            console.error("Failed to delete permission:", error);
            setError("Failed to delete permission.");
        } finally {
            setLoading(false);
        }
    };

    if (view !== "permissions" || !selectedPermission || !userPermissions.canViewPermissionDetails) return null;

    return (
        <div className="details-card">
            <div className="card-header">
                {isEditingPermission && userPermissions.canUpdatePermissions ? (
                    <div className="permission-edit-form">
                        <div className="permission-edit-header">
                            <h2>Edit Permission</h2>
                        </div>
                        <input
                            type="text"
                            value={editedPermission.name || ""}
                            onChange={e => {
                                setEditedPermission({ ...editedPermission, name: e.target.value });
                                setPermissionFormErrors({ ...permissionFormErrors, name: validatePermissionName(e.target.value) });
                            }}
                            onBlur={() => setPermissionTouched({ ...permissionTouched, name: true })}
                            placeholder="Permission Name"
                            className={`permission-edit-input ${permissionTouched.name && permissionFormErrors.name ? "invalid-vibrate" : ""}`}
                            required
                        />
                        {permissionFormErrors.name && permissionTouched.name && <span className="error-text">{permissionFormErrors.name}</span>}
                        <div className="form-group">
                            <label>Class *</label>
                            <select
                                value={editedPermission.class || ""}
                                onChange={e => {
                                    setEditedPermission({ ...editedPermission, class: e.target.value as PermissionsClass });
                                    setPermissionFormErrors({ ...permissionFormErrors, class: validatePermissionClass(e.target.value) });
                                }}
                                onBlur={() => setPermissionTouched({ ...permissionTouched, class: true })}
                                className={`permission-edit-input ${permissionTouched.class && permissionFormErrors.class ? "invalid-vibrate" : ""}`}
                                required
                            >
                                <option value="">Select a class</option>
                                {Object.values(PermissionsClass).map(className => (
                                    <option key={className} value={className}>
                                        {className}
                                    </option>
                                ))}
                            </select>
                            {permissionFormErrors.class && permissionTouched.class && <span className="error-text">{permissionFormErrors.class}</span>}
                        </div>
                        <textarea
                            value={editedPermission.description || ""}
                            onChange={e => {
                                setEditedPermission({ ...editedPermission, description: e.target.value });
                                setPermissionFormErrors({ ...permissionFormErrors, description: validatePermissionDescription(e.target.value) });
                            }}
                            onBlur={() => setPermissionTouched({ ...permissionTouched, description: true })}
                            placeholder="Permission Description"
                            className={`permission-edit-textarea ${permissionTouched.description && permissionFormErrors.description ? "invalid-vibrate" : ""}`}
                        />
                        {permissionFormErrors.description && permissionTouched.description && <span className="error-text">{permissionFormErrors.description}</span>}
                        <div className="permission-edit-actions">
                            <button className="action-button" onClick={handleSavePermissionEdit} disabled={loading}>
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
                                className="edit-button"
                                onClick={() => handleEditPermission(selectedPermission)}
                                disabled={loading || !userPermissions.canUpdatePermissions}
                            >
                                <FaEdit /> Edit
                            </button>
                            <button
                                className="delete-button"
                                onClick={() => handleDeletePermission(selectedPermission)}
                                disabled={loading || !userPermissions.canDeletePermissions}
                            >
                                <FaTrash /> Delete
                            </button>
                            <button
                                className="close-button"
                                onClick={() => {
                                    setIsEditingPermission(false);
                                    setEditedPermission({});
                                    setSelectedPermission(null);
                                }}
                                disabled={loading}
                            >
                                <FaTimes />
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
        </div>
    );
};

export default PermView;