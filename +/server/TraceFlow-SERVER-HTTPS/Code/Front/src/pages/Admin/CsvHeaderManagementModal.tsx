import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaTimes, FaSave } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { getCsvHeaders, updateCsvHeaders, CsvHeader, GetCsvHeadersResponse } from "../../apis/csvHeaderAPI";
import "./AdminDashboard.css";

interface CsvHeaderManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    setError: (error: string | null) => void;
    fileHeaders: string[];
    onHeadersUpdated: () => void;
}

const CsvHeaderManagementModal: React.FC<CsvHeaderManagementModalProps> = ({
    isOpen,
    onClose,
    setError,
    fileHeaders,
    onHeadersUpdated,
}) => {
    const { t } = useTranslation();
    const [headers, setHeaders] = useState<CsvHeader[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Fetch headers on mount
    useEffect(() => {
        if (isOpen) {
            const fetchHeaders = async () => {
                setLoading(true);
                try {
                    const response: GetCsvHeadersResponse = await getCsvHeaders('agent');
                    setHeaders(response.headers);
                    setError(null);
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : t("adminDashboard.error.fetchHeadersFailed");
                    setError(errorMessage);
                } finally {
                    setLoading(false);
                }
            };
            fetchHeaders();
        }
    }, [isOpen, setError, t]);

    // Handle header change
    const handleHeaderChange = (headerID: string, newMappedHeader: string) => {
        setHeaders(prevHeaders =>
            prevHeaders.map(header =>
                header.headerID === headerID ? { ...header, mappedHeader: newMappedHeader } : header
            )
        );
    };

    // Save header changes
    const handleSave = async () => {
        // Validate that all mapped headers are non-empty and unique
        const mappedHeaders = headers.map(h => h.mappedHeader.trim());
        if (mappedHeaders.some(h => !h)) {
            setError(t("adminDashboard.error.emptyHeaders"));
            return;
        }
        if (new Set(mappedHeaders).size !== mappedHeaders.length) {
            setError(t("adminDashboard.error.duplicateHeaders"));
            return;
        }

        setSaving(true);
        try {
            const updateData = headers.map(({ expectedHeader, mappedHeader }) => ({
                expectedHeader,
                mappedHeader: mappedHeader.trim(),
            }));
            await updateCsvHeaders('agent', updateData);
            setError(null);
            onHeadersUpdated();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : t("adminDashboard.error.saveHeadersFailed");
            setError(errorMessage);
            setSaving(false);
        }
    };

    const handleClose = () => {
        setHeaders([]);
        setSaving(false);
        setLoading(true);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <motion.div
            className="role-info-popup-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="role-info-popup"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
            >
                <div className="card-header">
                    <h2>{t("adminDashboard.csvHeaders.title")}</h2>
                    <button
                        className="cancel-button"
                        onClick={handleClose}
                        aria-label={t("adminDashboard.actions.close")}
                    >
                        <FaTimes aria-hidden="true" />
                    </button>
                </div>
                <div className="modal-body">
                    {loading ? (
                        <p>{t("adminDashboard.actions.loading")}</p>
                    ) : headers.length === 0 ? (
                        <p>{t("adminDashboard.csvHeaders.noHeaders")}</p>
                    ) : (
                        <div className="header-list">
                            <p>{t("adminDashboard.csvHeaders.mismatchWarning")}</p>
                            {fileHeaders.length > 0 && (
                                <p>{t("adminDashboard.csvHeaders.fileHeaders", { headers: fileHeaders.join(', ') })}</p>
                            )}
                            <h3>{t("adminDashboard.csvHeaders.instructions")}</h3>
                            <table className="header-table">
                                <thead>
                                    <tr>
                                        <th>{t("adminDashboard.csvHeaders.systemHeader")}</th>
                                        <th>{t("adminDashboard.csvHeaders.csvHeader")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {headers.map(header => (
                                        <tr key={header.headerID}>
                                            <td>{header.expectedHeader}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={header.mappedHeader}
                                                    onChange={(e) => handleHeaderChange(header.headerID, e.target.value)}
                                                    className="form-group input"
                                                    disabled={saving}
                                                    aria-label={t("adminDashboard.csvHeaders.editHeader", { header: header.expectedHeader })}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <motion.button
                        className="action-button"
                        onClick={handleSave}
                        disabled={saving || loading || headers.length === 0}
                        whileHover={{ scale: saving || loading || headers.length === 0 ? 1 : 1.05 }}
                        whileTap={{ scale: saving || loading || headers.length === 0 ? 1 : 0.95 }}
                        aria-label={saving ? t("adminDashboard.actions.saving") : t("adminDashboard.actions.save")}
                    >
                        <FaSave aria-hidden="true" /> {saving ? t("adminDashboard.actions.saving") + "..." : t("adminDashboard.actions.save")}
                    </motion.button>
                    <motion.button
                        className="cancel-button"
                        onClick={handleClose}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label={t("adminDashboard.actions.cancel")}
                    >
                        {t("adminDashboard.actions.cancel")}
                    </motion.button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default CsvHeaderManagementModal;