import React, { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import "../../AdminDashboard.css";
import { createChecklist } from "../../../../apis/checklistAPI";
import { useAuth } from "../../../../context/AuthContext";
import { Checklist } from "../../../../models/Checklist";
import { ViewMode } from "pages/Admin/adminTypes";

// Props interface
interface ChecklistAddProps {
    checklists: Checklist[];
    setChecklists: React.Dispatch<React.SetStateAction<Checklist[]>>;
    view: string;
    setView: (view: ViewMode) => void;
    setError: (error: string | null) => void;
}

// Fixed checklists from environment variables
const FIXED_CHECKLISTS = [
    { checklistID: "fixed-1", item: import.meta.env.VITE_CHECKLIST_TRANSFER_A_RECEIPT_BOOK },
    { checklistID: "fixed-2", item: import.meta.env.VITE_CHECKLIST_COLLECT_RECEIPT_STUB },
];

// Memoized component to prevent unnecessary re-renders
const ChecklistAdd: React.FC<ChecklistAddProps> = React.memo(
    ({ checklists, setChecklists, view, setView, setError }) => {
        const { effectivePermissions } = useAuth();
        const [newItem, setNewItem] = useState("");
        const [loading, setLoading] = useState(false);
        const [validationError, setValidationError] = useState<string | null>(null);

        // Memoized permissions check
        const userPermissions = useMemo(
            () => ({
                canCreateChecklists: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_CREATE_CHECKLISTS_ITEMS
                ),
            }),
            [effectivePermissions]
        );

        // Memoized checklist aggregation
        const allChecklists = useMemo(
            () => [
                ...FIXED_CHECKLISTS,
                ...checklists.filter(
                    (c) => !FIXED_CHECKLISTS.some((fc) => fc.checklistID === c.checklistID)
                ),
            ],
            [checklists]
        );

        // Input validation function
        const validateInput = useCallback((text: string): string | null => {
            const trimmed = text.trim();
            if (!trimmed) return "Item cannot be empty.";
            if (trimmed.length < 5) return "Item must be at least 5 characters.";
            if (trimmed.length > 100) return "Item cannot exceed 100 characters.";
            const duplicate = allChecklists.some(
                (c) => c.item.toLowerCase() === trimmed.toLowerCase()
            );
            if (duplicate) return "Item already exists.";
            return null;
        }, [allChecklists]);

        // Create checklist handler
        const handleCreate = useCallback(async () => {
            if (!userPermissions.canCreateChecklists) return;
            const error = validateInput(newItem);
            if (error) {
                setValidationError(error);
                return;
            }
            setLoading(true);
            try {
                const createdChecklist = await createChecklist({ text: newItem.trim() });
                setChecklists((prev) => [...prev, createdChecklist]);
                setNewItem("");
                setView("checklists");
                setError(null);
                setValidationError(null);
            } catch (error) {
                console.error("Failed to create checklist:", error);
                setError("Failed to create checklist.");
            } finally {
                setLoading(false);
            }
        }, [
            newItem,
            userPermissions.canCreateChecklists,
            validateInput,
            setChecklists,
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
        if (view !== "add-checklist" || !userPermissions.canCreateChecklists) return null;

        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="form-card add-form">
                    <div className="form-section">
                        <h3 className="form-header">Add New Checklist</h3>
                        <div className="form-content">
                            <div className="form-group">
                                <label className="form-label">
                                    Item <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newItem}
                                    onChange={(e) => setNewItem(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="form-input"
                                    placeholder="Enter checklist item (5-100 chars)"
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
                                {loading ? "Creating..." : "Create Checklist"}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }
);

export default ChecklistAdd;