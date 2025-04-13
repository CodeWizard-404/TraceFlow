import React, { useMemo, useState, useEffect } from "react";
import { FaTrash, FaEdit, FaSave } from "react-icons/fa";
import "../../AdminDashboard.css";
import { useAuth } from "../../../../context/AuthContext";
import { Reason } from "../../../../models/Reason";
import { deleteReason, updateReason } from "../../../../apis/reasonAPI";

interface ReasonsListProps {
    reasons: Reason[];
    setReasons: React.Dispatch<React.SetStateAction<Reason[]>>;
    view: string;
    setSelectedReason: React.Dispatch<React.SetStateAction<Reason | null>>;
    setError: (error: string | null) => void;
    searchQuery: string;
    currentPage: number;
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    itemsPerPage: number;
}

const ReasonsList: React.FC<ReasonsListProps> = ({
    reasons,
    setReasons,
    view,
    setSelectedReason,
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

    const userPermissions = useMemo(() => ({
        canViewReasons: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS),
        canUpdateReasons: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_UPDATE_REASON_ITEMS),
        canDeleteReasons: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_DELETE_REASON_ITEMS),
    }), [effectivePermissions]);

    const filteredReasons = useMemo(() => {
        return reasons.filter(reason =>
            reason.item.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [reasons, searchQuery]);

    // Pagination
    const totalItems = filteredReasons.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const paginatedReasons = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return filteredReasons.slice(start, end);
    }, [filteredReasons, currentPage, itemsPerPage]);

    // Adjust currentPage if it exceeds totalPages
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage, setCurrentPage]);

    const validateInput = (text: string, currentID?: string): string | null => {
        const trimmed = text.trim();
        if (!trimmed) return "Item cannot be empty.";
        if (trimmed.length < 5) return "Item must be at least 5 characters.";
        if (trimmed.length > 100) return "Item cannot exceed 100 characters.";
        const duplicate = reasons.some(
            r => r.item.toLowerCase() === trimmed.toLowerCase() && r.reasonID !== currentID
        );
        if (duplicate) return "Item already exists.";
        return null;
    };

    const handleEditStart = (reason: Reason) => {
        if (!userPermissions.canUpdateReasons) return;
        setEditingID(reason.reasonID);
        setEditedText(reason.item);
        setSelectedReason(reason);
        setValidationError(null);
    };

    const handleEditSave = async (reasonID: string) => {
        if (!userPermissions.canUpdateReasons) return;
        const error = validateInput(editedText, reasonID);
        if (error) {
            setValidationError(error);
            return;
        }
        try {
            const updatedReason = await updateReason(reasonID, { text: editedText.trim() });
            setReasons(reasons.map(r => r.reasonID === reasonID ? updatedReason : r));
            setEditingID(null);
            setError(null);
            setValidationError(null);
        } catch (error) {
            console.error("Failed to update reason:", error);
            setError("Failed to update reason.");
        }
    };

    const handleDelete = async (reasonID: string) => {
        if (!userPermissions.canDeleteReasons) return;
        try {
            await deleteReason(reasonID);
            setReasons(reasons.filter(r => r.reasonID !== reasonID));
            setError(null);
        } catch (error) {
            console.error("Failed to delete reason:", error);
            setError("Failed to delete reason.");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, reasonID: string) => {
        if (e.key === "Enter") {
            handleEditSave(reasonID);
        } else if (e.key === "Escape") {
            setEditingID(null);
            setValidationError(null);
        }
    };

    if (view !== "reasons" || !userPermissions.canViewReasons) return null;

    return (
        <div className="reasons-list">
            <div className="table-card">
                <h2 className="list-header">Reasons</h2>
                <div className="hover-reveal-list">
                    {paginatedReasons.length > 0 ? (
                        paginatedReasons.map(reason => (
                            <div key={reason.reasonID} className="list-item-wrapper">
                                {editingID === reason.reasonID ? (
                                    <div className="list-item editing">
                                        <input
                                            type="text"
                                            value={editedText}
                                            onChange={e => setEditedText(e.target.value)}
                                            onKeyDown={e => handleKeyDown(e, reason.reasonID)}
                                            className="edit-input"
                                            autoFocus
                                        />
                                        {validationError && (
                                            <span className="validation-error">{validationError}</span>
                                        )}
                                        <div className="item-actions">
                                            <button
                                                className="list-button save"
                                                onClick={() => handleEditSave(reason.reasonID)}
                                            >
                                                <FaSave />
                                            </button>
                                            <button
                                                className="list-button cancel"
                                                onClick={() => setEditingID(null)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="list-item">
                                        <span
                                            className="item-text"
                                            onDoubleClick={() => handleEditStart(reason)}
                                        >
                                            {reason.item}
                                        </span>
                                        <div className="item-actions">
                                            {userPermissions.canUpdateReasons && (
                                                <button
                                                    className="list-button edit"
                                                    onClick={() => handleEditStart(reason)}
                                                >
                                                    <FaEdit />
                                                </button>
                                            )}
                                            {userPermissions.canDeleteReasons && (
                                                <button
                                                    className="list-button delete"
                                                    onClick={() => handleDelete(reason.reasonID)}
                                                >
                                                    <FaTrash />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="no-items">No reasons found</div>
                    )}
                </div>
                <div className="pagination">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </button>
                    <span>Page {currentPage} of {totalPages}</span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReasonsList;