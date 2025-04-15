// src/components/Admin/Checklist/checklist_view.tsx
import React, { useState } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";

import "../../AdminDashboard.css";
import { updateChecklist, deleteChecklist } from "../../../../apis/checklistAPI";
import { useAuth } from "../../../../context/AuthContext";
import { Checklist } from "../../../../models/Checklist";

interface ChecklistViewProps {
    selectedChecklist: Checklist | null;
    setSelectedChecklist: React.Dispatch<React.SetStateAction<Checklist | null>>;
    checklists: Checklist[];
    setChecklists: React.Dispatch<React.SetStateAction<Checklist[]>>;
    view: string;
    token: string;
    setError: (error: string | null) => void;
}

const ChecklistView: React.FC<ChecklistViewProps> = ({
    selectedChecklist,
    setSelectedChecklist,
    checklists,
    setChecklists,
    view,
    token,
    setError,
}) => {
    const { effectivePermissions } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editedItem, setEditedItem] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const userPermissions = {
        canUpdateChecklists: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_CHECKLISTS_ITEMS),
        canDeleteChecklists: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_DELETE_CHECKLISTS_ITEMS),
    };

    const handleEdit = () => {
        if (!userPermissions.canUpdateChecklists || !selectedChecklist) return;
        setIsEditing(true);
        setEditedItem(selectedChecklist.item);
    };

    const handleSave = async () => {
        if (!selectedChecklist || !userPermissions.canUpdateChecklists) return;
        setLoading(true);
        try {
            const updatedChecklist = await updateChecklist(selectedChecklist.checklistID, { text: editedItem }, token);
            setChecklists(checklists.map(c => c.checklistID === selectedChecklist.checklistID ? updatedChecklist : c));
            setSelectedChecklist(updatedChecklist);
            setIsEditing(false);
            setError(null);
        } catch (error) {
            console.error("Failed to update checklist:", error);
            setError("Failed to update checklist.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedChecklist || !userPermissions.canDeleteChecklists) return;
        setLoading(true);
        try {
            await deleteChecklist(selectedChecklist.checklistID, token);
            setChecklists(checklists.filter(c => c.checklistID !== selectedChecklist.checklistID));
            setSelectedChecklist(null);
            setError(null);
        } catch (error) {
            console.error("Failed to delete checklist:", error);
            setError("Failed to delete checklist.");
        } finally {
            setLoading(false);
        }
    };

    if (view !== "checklist-details" || !selectedChecklist) return null;

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
                        <h2>{selectedChecklist.item}</h2>
                        <div className="actions">
                            {userPermissions.canUpdateChecklists && (
                                <button className="edit-button" onClick={handleEdit} disabled={loading}>
                                    <FaEdit /> Edit
                                </button>
                            )}
                            {userPermissions.canDeleteChecklists && (
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

export default ChecklistView;