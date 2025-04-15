// src/components/Admin/Reason/reason_view.tsx
import React, { useState } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";

import "../../AdminDashboard.css";
import { updateReason, deleteReason } from "../../../../apis/reasonAPI";
import { useAuth } from "../../../../context/AuthContext";
import { Reason } from "../../../../models/Reason";

interface ReasonViewProps {
    selectedReason: Reason | null;
    setSelectedReason: React.Dispatch<React.SetStateAction<Reason | null>>;
    reasons: Reason[];
    setReasons: React.Dispatch<React.SetStateAction<Reason[]>>;
    view: string;
    token: string;
    setError: (error: string | null) => void;
}

const ReasonView: React.FC<ReasonViewProps> = ({
    selectedReason,
    setSelectedReason,
    reasons,
    setReasons,
    view,
    token,
    setError,
}) => {
    const { effectivePermissions } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editedItem, setEditedItem] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const userPermissions = {
        canUpdateReasons: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_REASON_ITEMS),
        canDeleteReasons: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_DELETE_REASON_ITEMS),
    };

    const handleEdit = () => {
        if (!userPermissions.canUpdateReasons || !selectedReason) return;
        setIsEditing(true);
        setEditedItem(selectedReason.item);
    };

    const handleSave = async () => {
        if (!selectedReason || !userPermissions.canUpdateReasons) return;
        setLoading(true);
        try {
            const updatedReason = await updateReason(selectedReason.reasonID, { text: editedItem }, token);
            setReasons(reasons.map(r => r.reasonID === selectedReason.reasonID ? updatedReason : r));
            setSelectedReason(updatedReason);
            setIsEditing(false);
            setError(null);
        } catch (error) {
            console.error("Failed to update reason:", error);
            setError("Failed to update reason.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedReason || !userPermissions.canDeleteReasons) return;
        setLoading(true);
        try {
            await deleteReason(selectedReason.reasonID, token);
            setReasons(reasons.filter(r => r.reasonID !== selectedReason.reasonID));
            setSelectedReason(null);
            setError(null);
        } catch (error) {
            console.error("Failed to delete reason:", error);
            setError("Failed to delete reason.");
        } finally {
            setLoading(false);
        }
    };

    if (view !== "reason-details" || !selectedReason) return null;

    return (
        <div className="details-card">
            <div className="card-header">
                {isEditing ? (
                    <div className="edit-form">
                        <input
                            type="text"
                            value={editedItem}
                            onChange={e => setEditedItem(e.target.value)}
                            className="edit-input"
                        />
                        <button className="action-button" onClick={handleSave} disabled={loading}>
                            {loading ? "Saving..." : "Save"}
                        </button>
                        <button className="cancel-button" onClick={() => setIsEditing(false)} disabled={loading}>
                            Cancel
                        </button>
                    </div>
                ) : (
                    <>
                        <h2>{selectedReason.item}</h2>
                        <div className="actions">
                            {userPermissions.canUpdateReasons && (
                                <button className="edit-button" onClick={handleEdit} disabled={loading}>
                                    <FaEdit /> Edit
                                </button>
                            )}
                            {userPermissions.canDeleteReasons && (
                                <button className="delete-button" onClick={handleDelete} disabled={loading}>
                                    <FaTrash /> Delete
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReasonView;