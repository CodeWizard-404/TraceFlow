import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaTimes, FaSave, FaPlus } from "react-icons/fa";
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

    const handleHeaderChange = (headerID: string, field: 'expectedHeader' | 'mappedHeader', value: string) => {
        setHeaders(prevHeaders =>
            prevHeaders.map(header =>
                header.headerID === headerID ? { ...header, [field]: value } : header
            )
        );
    };

    const handleAddHeader = () => {
        const newHeader: CsvHeader = {
            headerID: `temp-${Date.now()}-${Math.random()}`,
            csvType: 'agent',
            expectedHeader: '',
            mappedHeader: '',
        };
        setHeaders(prevHeaders => [...prevHeaders, newHeader]);
    };

    const handleSave = async () => {
        const expectedHeaders = headers.map(h => h.expectedHeader.trim());
        const mappedHeaders = headers.map(h => h.mappedHeader.trim());
        if (expectedHeaders.some(h => !h) || mappedHeaders.some(h => !h)) {
            setError(t("adminDashboard.error.emptyHeaders"));
            return;
        }
        if (new Set(expectedHeaders).size !== expectedHeaders.length) {
            setError(t("adminDashboard.error.duplicateExpectedHeaders"));
            return;
        }
        if (new Set(mappedHeaders).size !== mappedHeaders.length) {
            setError(t("adminDashboard.error.duplicateHeaders"));
            return;
        }

        setSaving(true);
        try {
            const updateData = headers.map(({ expectedHeader, mappedHeader }) => ({
                expectedHeader: expectedHeader.trim(),
                mappedHeader: mappedHeader.trim(),
            }));
            await updateCsvHeaders('agent', updateData);
            setError(null);
            onHeadersUpdated();
            const response: GetCsvHeadersResponse = await getCsvHeaders('agent');
            setHeaders(response.headers);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : t("adminDashboard.error.saveHeadersFailed");
            setError(errorMessage);
        } finally {
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
                    ) : headers.length === 0 && !saving ? (
                        <p>{t("adminDashboard.csvHeaders.noHeaders")}</p>
                    ) : (
                        <div className="header-list">
                            <p>{t("adminDashboard.csvHeaders.mismatchWarning")}</p>
                            {fileHeaders.length > 0 && (
                                <p>{t("adminDashboard.csvHeaders.fileHeaders", { headers: fileHeaders.join(', ') })}</p>
                            )}
                            <h3>{t("adminDashboard.csvHeaders.instructions")}</h3>
                            <button
                                className="action-button"
                                onClick={handleAddHeader}
                                disabled={saving}
                                aria-label={t("adminDashboard.csvHeaders.addHeader")}
                            >
                                <FaPlus aria-hidden="true" /> {t("adminDashboard.csvHeaders.addHeader")}
                            </button>
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
                                            <td>
                                                <input
                                                    type="text"
                                                    value={header.expectedHeader}
                                                    onChange={(e) => handleHeaderChange(header.headerID, 'expectedHeader', e.target.value)}
                                                    className="form-group input"
                                                    disabled={saving}
                                                    aria-label={t("adminDashboard.csvHeaders.editSystemHeader", { header: header.expectedHeader })}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={header.mappedHeader}
                                                    onChange={(e) => handleHeaderChange(header.headerID, 'mappedHeader', e.target.value)}
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
                    <button
                        className="action-button"
                        onClick={handleSave}
                        disabled={saving || loading || headers.length === 0}
                        aria-label={saving ? t("adminDashboard.actions.saving") : t("adminDashboard.actions.save")}
                    >
                        <FaSave aria-hidden="true" /> {saving ? t("adminDashboard.actions.saving") + "..." : t("adminDashboard.actions.save")}
                    </button>
                    <button
                        className="cancel-button"
                        onClick={handleClose}
                        aria-label={t("adminDashboard.actions.cancel")}
                    >
                        {t("adminDashboard.actions.cancel")}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default CsvHeaderManagementModal;