import React, { useState } from "react";
import "../../AdminDashboard.css";
import { createReason } from "../../../../apis/reasonAPI";
import { useAuth } from "../../../../context/AuthContext";
import { Reason } from "../../../../models/Reason";
import { ViewMode } from "pages/Admin/adminTypes";

interface ReasonAddProps {
    reasons: Reason[];
    setReasons: React.Dispatch<React.SetStateAction<Reason[]>>;
    view: string;
    token: string;
    setView: (view: ViewMode) => void;
    setError: (error: string | null) => void;
}

const ReasonAdd: React.FC<ReasonAddProps> = ({
    reasons,
    setReasons,
    view,
    token,
    setView,
    setError,
}) => {
    const { effectivePermissions } = useAuth();
    const [newItem, setNewItem] = useState("");
    const [loading, setLoading] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    const userPermissions = {
        canCreateReasons: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_REASON_ITEMS),
    };

    const validateInput = (text: string): string | null => {
        const trimmed = text.trim();
        if (!trimmed) return "Item cannot be empty.";
        if (trimmed.length < 5) return "Item must be at least 5 characters.";
        if (trimmed.length > 100) return "Item cannot exceed 100 characters.";
        const duplicate = reasons.some(r => r.item.toLowerCase() === trimmed.toLowerCase());
        if (duplicate) return "Item already exists.";
        return null;
    };

    const handleCreate = async () => {
        if (!userPermissions.canCreateReasons) return;
        const error = validateInput(newItem);
        if (error) {
            setValidationError(error);
            return;
        }
        setLoading(true);
        try {
            const createdReason = await createReason({ text: newItem.trim() }, token);
            setReasons([...reasons, createdReason]);
            setNewItem("");
            setView("reasons");
            setError(null);
            setValidationError(null);
        } catch (error) {
            console.error("Failed to create reason:", error);
            setError("Failed to create reason.");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !loading) {
            handleCreate();
        }
    };

    if (view !== "add-reason" || !userPermissions.canCreateReasons) return null;

    return (
        <div className="form-card add-form">
            <div className="form-section">
                <h3 className="form-header">Add New Reason</h3>
                <div className="form-content">
                    <div className="form-group">
                        <label className="form-label">Item <span className="required">*</span></label>
                        <input
                            type="text"
                            value={newItem}
                            onChange={e => setNewItem(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="form-input"
                            placeholder="Enter reason item (5-100 chars)"
                            required
                        />
                        {validationError && <span className="validation-error">{validationError}</span>}
                    </div>
                    <button
                        className="action-button create"
                        onClick={handleCreate}
                        disabled={loading || !!validateInput(newItem)}
                    >
                        {loading ? "Creating..." : "Create Reason"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReasonAdd;