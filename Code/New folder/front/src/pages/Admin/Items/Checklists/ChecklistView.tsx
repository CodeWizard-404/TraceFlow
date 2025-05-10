/**
 * ChecklistView.tsx
 * Component for viewing and editing a selected checklist item.
 * Optimized with memoization, dynamic loading state, and fade-in animation for performance.
 * Uses existing AdminDashboard.css for styling.
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import { motion } from "framer-motion"; // Added Framer Motion import
import "../../AdminDashboard.css";
import { updateChecklist, deleteChecklist } from "../../../../apis/checklistAPI";
import { useAuth } from "../../../../context/AuthContext";
import { Checklist } from "../../../../models/Checklist";

// Props interface
interface ChecklistViewProps {
    selectedChecklist: Checklist | null;
    setSelectedChecklist: React.Dispatch<React.SetStateAction<Checklist | null>>;
    checklists: Checklist[];
    setChecklists: React.Dispatch<React.SetStateAction<Checklist[]>>;
    view: string;
    setError: (error: string | null) => void;
}

// Memoized component
const ChecklistView: React.FC<ChecklistViewProps> = React.memo(
    ({ selectedChecklist, setSelectedChecklist, setChecklists, view, setError }) => {
        const { effectivePermissions } = useAuth();
        const [isEditing, setIsEditing] = useState(false);
        const [editedItem, setEditedItem] = useState<string>("");
        const [loading, setLoading] = useState(true);

        // Memoized permissions check
        const userPermissions = useMemo(
            () => ({
                canUpdateChecklists: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_CHECKLISTS_ITEMS
                ),
                canDeleteChecklists: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_DELETE_CHECKLISTS_ITEMS
                ),
            }),
            [effectivePermissions]
        );

        // Dynamic loading state
        useEffect(() => {
            setLoading(true);
            if (selectedChecklist) {
                setLoading(false);
            }
        }, [selectedChecklist]);

        // Edit handler
        const handleEdit = useCallback(() => {
            if (!userPermissions.canUpdateChecklists || !selectedChecklist) return;
            setIsEditing(true);
            setEditedItem(selectedChecklist.item);
        }, [userPermissions.canUpdateChecklists, selectedChecklist]);

        // Save handler
        const handleSave = useCallback(async () => {
            if (!selectedChecklist || !userPermissions.canUpdateChecklists) return;
            setLoading(true);
            try {
                const updatedChecklist = await updateChecklist(selectedChecklist.checklistID, {
                    text: editedItem,
                });
                setChecklists((prev) =>
                    prev.map((c) => (c.checklistID === selectedChecklist.checklistID ? updatedChecklist : c))
                );
                setSelectedChecklist(updatedChecklist);
                setIsEditing(false);
                setError(null);
            } catch (error) {
                console.error("Failed to update checklist:", error);
                setError("Failed to update checklist.");
            } finally {
                setLoading(false);
            }
        }, [
            selectedChecklist,
            userPermissions.canUpdateChecklists,
            editedItem,
            setChecklists,
            setSelectedChecklist,
            setError,
        ]);

        // Delete handler
        const handleDelete = useCallback(async () => {
            if (!selectedChecklist || !userPermissions.canDeleteChecklists) return;
            setLoading(true);
            try {
                await deleteChecklist(selectedChecklist.checklistID);
                setChecklists((prev) =>
                    prev.filter((c) => c.checklistID !== selectedChecklist.checklistID)
                );
                setSelectedChecklist(null);
                setError(null);
            } catch (error) {
                console.error("Failed to delete checklist:", error);
                setError("Failed to delete checklist.");
            } finally {
                setLoading(false);
            }
        }, [selectedChecklist, userPermissions.canDeleteChecklists, setChecklists, setSelectedChecklist, setError]);

        // Return null if view or checklist is invalid
        if (view !== "checklist-details" || !selectedChecklist) return null;

        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="details-card">
                    <div className="card-header">
                        {isEditing ? (
                            <div className="edit-form">
                                <input
                                    type="text"
                                    value={editedItem}
                                    onChange={(e) => setEditedItem(e.target.value)}
                                    className="edit-input"
                                    disabled={loading}
                                />
                                <button
                                    className="action-button"
                                    onClick={handleSave}
                                    disabled={loading}
                                >
                                    {loading ? "Saving..." : "Save"}
                                </button>
                                <button
                                    className="cancel-button"
                                    onClick={() => setIsEditing(false)}
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <>
                                <h2>{selectedChecklist.item}</h2>
                                <div className="actions">
                                    {userPermissions.canUpdateChecklists && (
                                        <button
                                            className="edit-button"
                                            onClick={handleEdit}
                                            disabled={loading}
                                        >
                                            <FaEdit /> Edit
                                        </button>
                                    )}
                                    {userPermissions.canDeleteChecklists && (
                                        <button
                                            className="delete-button"
                                            onClick={handleDelete}
                                            disabled={loading}
                                        >
                                            <FaTrash /> Delete
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    }
);

export default ChecklistView;