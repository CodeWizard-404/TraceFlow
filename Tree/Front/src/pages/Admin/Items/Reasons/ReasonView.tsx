/**
 * ReasonView.tsx
 * Component for viewing and editing a selected reason item.
 * Optimized with memoization and skeleton loading for performance.
 * Uses existing AdminDashboard.css for styling.
 */

import React, { useState, useCallback, useMemo, lazy, Suspense } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import "../../AdminDashboard.css";
import { updateReason, deleteReason } from "../../../../apis/reasonAPI";
import { useAuth } from "../../../../context/AuthContext";
import { Reason } from "../../../../models/Reason";

// Lazy-loaded skeleton component
const SkeletonDetails = lazy(() => import("../SkeletonComponents").then((module) => ({ default: module.SkeletonDetails })));

// Props interface
interface ReasonViewProps {
    selectedReason: Reason | null;
    setSelectedReason: React.Dispatch<React.SetStateAction<Reason | null>>;
    reasons: Reason[];
    setReasons: React.Dispatch<React.SetStateAction<Reason[]>>;
    view: string;
    setError: (error: string | null) => void;
}

// Memoized component
const ReasonView: React.FC<ReasonViewProps> = React.memo(
    ({ selectedReason, setSelectedReason, setReasons, view, setError }) => {
        const { effectivePermissions } = useAuth();
        const [isEditing, setIsEditing] = useState(false);
        const [editedItem, setEditedItem] = useState<string>("");
        const [loading, setLoading] = useState(false);

        // Memoized permissions check
        const userPermissions = useMemo(
            () => ({
                canUpdateReasons: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_REASON_ITEMS
                ),
                canDeleteReasons: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_DELETE_REASON_ITEMS
                ),
            }),
            [effectivePermissions]
        );

        // Edit handler
        const handleEdit = useCallback(() => {
            if (!userPermissions.canUpdateReasons || !selectedReason) return;
            setIsEditing(true);
            setEditedItem(selectedReason.item);
        }, [userPermissions.canUpdateReasons, selectedReason]);

        // Save handler
        const handleSave = useCallback(async () => {
            if (!selectedReason || !userPermissions.canUpdateReasons) return;
            setLoading(true);
            try {
                const updatedReason = await updateReason(selectedReason.reasonID, {
                    text: editedItem,
                });
                setReasons((prev) =>
                    prev.map((r) => (r.reasonID === selectedReason.reasonID ? updatedReason : r))
                );
                setSelectedReason(updatedReason);
                setIsEditing(false);
                setError(null);
            } catch (error) {
                console.error("Failed to update reason:", error);
                setError("Failed to update reason.");
            } finally {
                setLoading(false);
            }
        }, [
            selectedReason,
            userPermissions.canUpdateReasons,
            editedItem,
            setReasons,
            setSelectedReason,
            setError,
        ]);

        // Delete handler
        const handleDelete = useCallback(async () => {
            if (!selectedReason || !userPermissions.canDeleteReasons) return;
            setLoading(true);
            try {
                await deleteReason(selectedReason.reasonID);
                setReasons((prev) => prev.filter((r) => r.reasonID !== selectedReason.reasonID));
                setSelectedReason(null);
                setError(null);
            } catch (error) {
                console.error("Failed to delete reason:", error);
                setError("Failed to delete reason.");
            } finally {
                setLoading(false);
            }
        }, [selectedReason, userPermissions.canDeleteReasons, setReasons, setSelectedReason, setError]);

        // Return null if view or reason is invalid
        if (view !== "reason-details" || !selectedReason) return null;

        return (
            <Suspense fallback={<SkeletonDetails />}>
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
                                <h2>{selectedReason.item}</h2>
                                <div className="actions">
                                    {userPermissions.canUpdateReasons && (
                                        <button
                                            className="edit-button"
                                            onClick={handleEdit}
                                            disabled={loading}
                                        >
                                            <FaEdit /> Edit
                                        </button>
                                    )}
                                    {userPermissions.canDeleteReasons && (
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
            </Suspense>
        );
    }
);

export default ReasonView;