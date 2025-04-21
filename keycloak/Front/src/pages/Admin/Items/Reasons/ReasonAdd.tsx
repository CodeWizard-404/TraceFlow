/**
 * ReasonAdd.tsx
 * Component for adding a new reason item with validation and permission checks.
 * Optimized with memoization, debouncing, and skeleton loading for performance.
 * Uses existing AdminDashboard.css for styling.
 */

import React, { useState, useCallback, useMemo, lazy, Suspense } from "react";
import { debounce } from "lodash";
import "../../AdminDashboard.css";
import { createReason } from "../../../../apis/reasonAPI";
import { useAuth } from "../../../../context/AuthContext";
import { Reason } from "../../../models/Reason";
import { ViewMode } from "pages/Admin/adminTypes";

// Lazy-loaded skeleton component
const SkeletonForm = lazy(() => import("../SkeletonComponents").then(module => ({ default: module.SkeletonForm })));

// Props interface
interface ReasonAddProps {
    reasons: Reason[];
    setReasons: React.Dispatch<React.SetStateAction<Reason[]>>;
    view: string;
    setView: (view: ViewMode) => void;
    setError: (error: string | null) => void;
}

// Memoized component
const ReasonAdd: React.FC<ReasonAddProps> = React.memo(
    ({ reasons, setReasons, view, setView, setError }) => {
        const { effectivePermissions } = useAuth();
        const [newItem, setNewItem] = useState("");
        const [loading, setLoading] = useState(false);
        const [validationError, setValidationError] = useState<string | null>(null);

        // Memoized permissions check
        const userPermissions = useMemo(
            () => ({
                canCreateReasons: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_REASON_ITEMS
                ),
            }),
            [effectivePermissions]
        );

        // Input validation function
        const validateInput = useCallback((text: string): string | null => {
            const trimmed = text.trim();
            if (!trimmed) return "Item cannot be empty.";
            if (trimmed.length < 5) return "Item must be at least 5 characters.";
            if (trimmed.length > 100) return "Item cannot exceed 100 characters.";
            const duplicate = reasons.some(
                (r) => r.item.toLowerCase() === trimmed.toLowerCase()
            );
            if (duplicate) return "Item already exists.";
            return null;
        }, [reasons]);

        // Debounced input change handler
        const debouncedSetNewItem = useCallback(
            debounce((value: string) => setNewItem(value), 300),
            []
        );

        // Create reason handler
        const handleCreate = useCallback(async () => {
            if (!userPermissions.canCreateReasons) return;
            const error = validateInput(newItem);
            if (error) {
                setValidationError(error);
                return;
            }
            setLoading(true);
            try {
                const createdReason = await createReason({ text: newItem.trim() });
                setReasons((prev) => [...prev, createdReason]);
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
        }, [
            newItem,
            userPermissions.canCreateReasons,
            validateInput,
            setReasons,
            setView,
            setError,
        ]);

        // Keydown handler for Enter key
        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter" && !loading) {
                    handleCreate();
                }
            },
            [handleCreate, loading]
        );

        // Return null if view or permissions are invalid
        if (view !== "add-reason" || !userPermissions.canCreateReasons) return null;

        return (
            <Suspense fallback={<SkeletonForm />}>
                <div className="form-card add-form">
                    <div className="form-section">
                        <h3 className="form-header">Add New Reason</h3>
                        <div className="form-content">
                            <div className="form-group">
                                <label className="form-label">
                                    Item <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newItem}
                                    onChange={(e) => debouncedSetNewItem(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="form-input"
                                    placeholder="Enter reason item (5-100 chars)"
                                    required
                                    disabled={loading}
                                />
                                {validationError && (
                                    <span className="validation-error">{validationError}</span>
                                )}
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
            </Suspense>
        );
    }
);

export default ReasonAdd;