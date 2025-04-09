import React, { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { createPermission } from "../../../apis/permissionAPI";
import "../AdminDashboard.css";
import PermissionsClass from "../../../models/Enum/PermissionsClass";
import Permission from "../../../models/Permission";
import { ViewMode } from "../adminTypes";

interface PermAddProps {
    permissionsList: Permission[];
    setPermissionsList: (permissions: Permission[]) => void;
    view: string;
    token: string;
    setView: (view: ViewMode) => void;
    setError: (error: string | null) => void;
}

const PermAdd: React.FC<PermAddProps> = ({
    permissionsList,
    setPermissionsList,
    view,
    token,
    setView,
    setError,
}) => {
    const { effectivePermissions } = useAuth();
    const [newPermission, setNewPermission] = useState<Partial<Permission>>({});
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
        canCreatePermissions: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_PERMISSIONS),
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

    const handleCreatePermission = async () => {
        if (!userPermissions.canCreatePermissions) return;

        const errors = {
            name: validatePermissionName(newPermission.name || ""),
            class: validatePermissionClass(newPermission.class || ""),
            description: validatePermissionDescription(newPermission.description || ""),
        };

        setPermissionFormErrors(errors);
        if (Object.values(errors).some(error => error)) {
            setError("Please correct the errors before submitting.");
            return;
        }

        setLoading(true);
        try {
            const createdPermission = await createPermission({
                name: newPermission.name!.trim(),
                className: newPermission.class!.trim(),
                description: newPermission.description?.trim(),
            }, token);
            setPermissionsList([...permissionsList, createdPermission]);
            setNewPermission({});
            setPermissionFormErrors({ name: "", class: "", description: "" });
            setPermissionTouched({ name: false, class: false, description: false });
            setView("permissions");
            setError(null);
        } catch (error) {
            console.error("Failed to create permission:", error);
            setError("Failed to create permission.");
        } finally {
            setLoading(false);
        }
    };

    if (view !== "add-permission" || !userPermissions.canCreatePermissions) return null;

    return (
        <div className="form-card form-card-0">
            <div className="form-section">
                <h3>Create New Permission</h3>
                <div className="form-group">
                    <label>Name *</label>
                    <input
                        type="text"
                        value={newPermission.name || ""}
                        onChange={e => {
                            setNewPermission({ ...newPermission, name: e.target.value });
                            setPermissionFormErrors({ ...permissionFormErrors, name: validatePermissionName(e.target.value) });
                        }}
                        onBlur={() => setPermissionTouched({ ...permissionTouched, name: true })}
                        className={`user-edit-input ${permissionTouched.name && permissionFormErrors.name ? "invalid-vibrate" : ""}`}
                        required
                    />
                    {permissionFormErrors.name && permissionTouched.name && <span className="error-text">{permissionFormErrors.name}</span>}
                </div>
                <div className="form-group">
                    <label>Class *</label>
                    <select
                        value={newPermission.class || ""}
                        onChange={e => {
                            setNewPermission({ ...newPermission, class: e.target.value as PermissionsClass });
                            setPermissionFormErrors({ ...permissionFormErrors, class: validatePermissionClass(e.target.value) });
                        }}
                        onBlur={() => setPermissionTouched({ ...permissionTouched, class: true })}
                        className={`user-edit-input ${permissionTouched.class && permissionFormErrors.class ? "invalid-vibrate" : ""}`}
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
                <div className="form-group">
                    <label>Description</label>
                    <textarea
                        value={newPermission.description || ""}
                        onChange={e => {
                            setNewPermission({ ...newPermission, description: e.target.value });
                            setPermissionFormErrors({ ...permissionFormErrors, description: validatePermissionDescription(e.target.value) });
                        }}
                        onBlur={() => setPermissionTouched({ ...permissionTouched, description: true })}
                        className={`user-edit-input ${permissionTouched.description && permissionFormErrors.description ? "invalid-vibrate" : ""}`}
                    />
                    {permissionFormErrors.description && permissionTouched.description && <span className="error-text">{permissionFormErrors.description}</span>}
                </div>
                <button className="action-button" onClick={handleCreatePermission} disabled={loading}>
                    Create Permission
                </button>
            </div>
        </div>
    );
};

export default PermAdd;