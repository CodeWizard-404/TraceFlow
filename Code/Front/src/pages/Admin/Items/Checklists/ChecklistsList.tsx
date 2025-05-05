/**
 * ChecklistsList.tsx
 * Component for displaying a paginated list of checklists with editing and deletion.
 * Optimized with list virtualization, memoization, debouncing, and skeleton loading.
 * Uses existing AdminDashboard.css for styling.
 */

import React, { useMemo, useState, useEffect, useCallback, lazy, Suspense } from "react";
import { FaTrash, FaEdit, FaSave } from "react-icons/fa";
import { Virtuoso } from "react-virtuoso";
import { debounce } from "lodash";
import { motion } from "framer-motion";
import "../../AdminDashboard.css";
import { useAuth } from "../../../../context/AuthContext";
import { Checklist } from "../../../../models/Checklist";
import { deleteChecklist, updateChecklist } from "../../../../apis/checklistAPI";

// Lazy-loaded skeleton component
const SkeletonList = lazy(() => import("../SkeletonComponents").then((module) => ({ default: module.SkeletonList })));

// Props interface
interface ChecklistsListProps {
    checklists: Checklist[];
    setChecklists: React.Dispatch<React.SetStateAction<Checklist[]>>;
    view: string;
    setSelectedChecklist: React.Dispatch<React.SetStateAction<Checklist | null>>;
    setError: (error: string | null) => void;
    searchQuery: string;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    itemsPerPage: number;
}

// Fixed checklists
const FIXED_CHECKLISTS = [
    { checklistID: "fixed-1", item: import.meta.env.VITE_CHECKLIST_TRANSFER_A_RECEIPT_BOOK },
    { checklistID: "fixed-2", item: import.meta.env.VITE_CHECKLIST_COLLECT_RECEIPT_STUB },
];

// Constants
const SKELETON_ROWS = 10;

// Memoized component
const ChecklistsList: React.FC<ChecklistsListProps> = React.memo(
    ({
        checklists,
        setChecklists,
        view,
        setSelectedChecklist,
        setError,
        searchQuery,
        currentPage,
        setCurrentPage,
        itemsPerPage,
    }) => {
        const { effectivePermissions } = useAuth();
        const [editingID, setEditingID] = useState<string | null>(null);
        const [editedText, setEditedText] = useState("");
        const [validationError, setValidationError] = useState<string | null>(null);
        const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
        const [loading, setLoading] = useState(true);

        // Memoized permissions
        const userPermissions = useMemo(
            () => ({
                canViewChecklists: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS
                ),
                canUpdateChecklists: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_CHECKLISTS_ITEMS
                ),
                canDeleteChecklists: effectivePermissions?.some(
                    (p) => p.name === import.meta.env.VITE_PERMISSIONS_DELETE_CHECKLISTS_ITEMS
                ),
            }),
            [effectivePermissions]
        );

        // Debounced search query setter
        const debouncedSetSearchQuery = useCallback(
            debounce((value: string) => setInternalSearchQuery(value), 300),
            []
        );

        // Sync search query
        useEffect(() => {
            debouncedSetSearchQuery(searchQuery);
            return () => debouncedSetSearchQuery.cancel();
        }, [searchQuery, debouncedSetSearchQuery]);

        // Dynamic loading state based on checklists prop
        useEffect(() => {
            // Set loading to false when checklists is defined, even if empty
            if (checklists !== undefined) {
                setLoading(false);
            }
        }, [checklists]);

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

        // Memoized filtered checklists
        const filteredChecklists = useMemo(
            () =>
                allChecklists.filter((checklist) =>
                    checklist.item.toLowerCase().includes(internalSearchQuery.toLowerCase())
                ),
            [allChecklists, internalSearchQuery]
        );

        // Pagination
        const totalItems = filteredChecklists.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
        const paginatedChecklists = useMemo(() => {
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            return filteredChecklists.slice(start, end);
        }, [filteredChecklists, currentPage, itemsPerPage]);

        // Adjust currentPage
        useEffect(() => {
            if (currentPage > totalPages) {
                setCurrentPage(totalPages);
            }
        }, [totalPages, currentPage, setCurrentPage]);

        // Check if checklist is fixed
        const isFixedChecklist = useCallback(
            (ChecklistID: string) => FIXED_CHECKLISTS.some((fc) => fc.checklistID === ChecklistID),
            []
        );

        // Input validation
        const validateInput = useCallback(
            (text: string, currentID?: string): string | null => {
                const trimmed = text.trim();
                if (!trimmed) return "Item cannot be empty.";
                if (trimmed.length < 5) return "Item must be at least 5 characters.";
                if (trimmed.length > 100) return "Item cannot exceed 100 characters.";
                const duplicate = allChecklists.some(
                    (c) => c.item.toLowerCase() === trimmed.toLowerCase() && c.checklistID !== currentID
                );
                if (duplicate) return "Item already exists.";
                return null;
            },
            [allChecklists]
        );

        // Edit start handler
        const handleEditStart = useCallback(
            (checklist: Checklist) => {
                if (!userPermissions.canUpdateChecklists || isFixedChecklist(checklist.checklistID)) return;
                setEditingID(checklist.checklistID);
                setEditedText(checklist.item);
                setSelectedChecklist(checklist);
                setValidationError(null);
            },
            [userPermissions.canUpdateChecklists, isFixedChecklist, setSelectedChecklist]
        );

        // Edit save handler
        const handleEditSave = useCallback(
            async (checklistID: string) => {
                if (!userPermissions.canUpdateChecklists || isFixedChecklist(checklistID)) return;
                const error = validateInput(editedText, checklistID);
                if (error) {
                    setValidationError(error);
                    return;
                }
                try {
                    const updatedChecklist = await updateChecklist(checklistID, { text: editedText.trim() });
                    setChecklists((prev) =>
                        prev.map((c) => (c.checklistID === checklistID ? updatedChecklist : c))
                    );
                    setEditingID(null);
                    setError(null);
                    setValidationError(null);
                } catch (error) {
                    console.error("Failed to update checklist:", error);
                    setError("Failed to update checklist.");
                }
            },
            [
                userPermissions.canUpdateChecklists,
                isFixedChecklist,
                editedText,
                validateInput,
                setChecklists,
                setError,
            ]
        );

        // Delete handler
        const handleDelete = useCallback(
            async (checklistID: string) => {
                if (!userPermissions.canDeleteChecklists || isFixedChecklist(checklistID)) return;
                try {
                    await deleteChecklist(checklistID);
                    setChecklists((prev) => prev.filter((c) => c.checklistID !== checklistID));
                    setError(null);
                } catch (error) {
                    console.error("Failed to delete checklist:", error);
                    setError("Failed to delete checklist.");
                }
            },
            [userPermissions.canDeleteChecklists, isFixedChecklist, setChecklists, setError]
        );

        // Keydown handler
        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLInputElement>, checklistID: string) => {
                if (e.key === "Enter") {
                    handleEditSave(checklistID);
                } else if (e.key === "Escape") {
                    setEditingID(null);
                    setValidationError(null);
                }
            },
            [handleEditSave]
        );

        // Render checklist item
        const renderChecklistItem = useCallback(
            (index: number, checklist: Checklist) => (
                <div key={checklist.checklistID} className="list-item-wrapper">
                    {editingID === checklist.checklistID ? (
                        <div className="list-item editing">
                            <input
                                type="text"
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, checklist.checklistID)}
                                className="edit-input"
                                autoFocus
                            />
                            {validationError && <span className="validation-error">{validationError}</span>}
                            <div className="item-actions">
                                <button
                                    className="list-button save"
                                    onClick={() => handleEditSave(checklist.checklistID)}
                                >
                                    <FaSave />
                                </button>
                                <button className="list-button cancel" onClick={() => setEditingID(null)}>
                                    ✕
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="list-item">
                            <span className="item-text" onDoubleClick={() => handleEditStart(checklist)}>
                                {checklist.item}
                            </span>
                            <div className="item-actions">
                                {userPermissions.canUpdateChecklists &&
                                    !isFixedChecklist(checklist.checklistID) && (
                                        <button
                                            className="list-button edit"
                                            onClick={() => handleEditStart(checklist)}
                                        >
                                            <FaEdit />
                                        </button>
                                    )}
                                {userPermissions.canDeleteChecklists &&
                                    !isFixedChecklist(checklist.checklistID) && (
                                        <button
                                            className="list-button delete"
                                            onClick={() => handleDelete(checklist.checklistID)}
                                        >
                                            <FaTrash />
                                        </button>
                                    )}
                            </div>
                        </div>
                    )}
                </div>
            ),
            [
                editingID,
                editedText,
                validationError,
                userPermissions,
                isFixedChecklist,
                handleEditStart,
                handleEditSave,
                handleDelete,
                handleKeyDown,
            ]
        );

        // Return null if view or permissions are invalid
        if (view !== "checklists" || !userPermissions.canViewChecklists) return null;

        return (
            <Suspense fallback={<SkeletonList rows={SKELETON_ROWS} />}>
                <div className="checklists-list">
                    <div className="table-card">
                        <h2 className="list-header">Checklists</h2>
                        {loading ? (
                            <SkeletonList rows={SKELETON_ROWS} />
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="hover-reveal-list">
                                    {paginatedChecklists.length > 0 ? (
                                        <Virtuoso
                                            style={{ height: "500px" }}
                                            totalCount={paginatedChecklists.length}
                                            data={paginatedChecklists}
                                            itemContent={renderChecklistItem}
                                        />
                                    ) : (
                                        <div className="no-items">No checklists found</div>
                                    )}
                                </div>
                                <div className="pagination">
                                    <button
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        Previous
                                    </button>
                                    <span>
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Next
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </Suspense>
        );
    }
);

export default ChecklistsList;