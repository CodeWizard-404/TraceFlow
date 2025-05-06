import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { FaTimes, FaUpload, FaSave, FaEdit } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { uploadAgents, AgentBulkUploadResponse } from "../../../apis/agentAPI";
import { getCsvHeaders, updateCsvHeaders, GetCsvHeadersResponse, CsvHeader } from "../../../apis/csvHeaderAPI";
import "../AdminDashboard.css";

interface AgentBulkUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    setError: (error: string | null) => void;
}

const AgentBulkUploadModal: React.FC<AgentBulkUploadModalProps> = ({
    isOpen,
    onClose,
    setError,
}) => {
    const { t } = useTranslation();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<AgentBulkUploadResponse | null>(null);
    const [expectedHeaders, setExpectedHeaders] = useState<string[]>([]);
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [headerMappings, setHeaderMappings] = useState<CsvHeader[]>([]);
    const [editingHeaders, setEditingHeaders] = useState(false);
    const [savingHeaders, setSavingHeaders] = useState(false);

    // Fetch CSV headers on mount
    useEffect(() => {
        if (isOpen) {
            const fetchHeaders = async () => {
                try {
                    const response: GetCsvHeadersResponse = await getCsvHeaders('agent');
                    const headers = response.headers.map(h => h.mappedHeader);
                    setExpectedHeaders(headers);
                    setHeaderMappings(response.headers);
                    setError(null);
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : t("adminDashboard.error.fetchHeadersFailed");
                    setError(errorMessage);
                }
            };
            fetchHeaders();
        }
    }, [isOpen, setError, t]);

    // Validate CSV headers (check presence, not order)
    const validateHeaders = useCallback(
        (content: string) => {
            try {
                const firstLine = content.split('\n')[0].trim();
                if (!firstLine) {
                    throw new Error("CSV file is empty or has no headers.");
                }
                const headers = firstLine.split(',').map(h => h.trim()).filter(h => h);
                setFileHeaders(headers);
                if (headers.length === 0) {
                    throw new Error("No valid headers found in CSV.");
                }
                const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
                if (missingHeaders.length > 0 || headers.length !== expectedHeaders.length) {
                    setError(t("adminDashboard.error.invalidCSVHeaders", { headers: missingHeaders.join(', ') }));
                    setEditingHeaders(true);
                    return false;
                }
                setEditingHeaders(false);
                return true;
            } catch (error) {
                setError(t("adminDashboard.error.invalidCSVFormat"));
                setEditingHeaders(true);
                return false;
            }
        },
        [expectedHeaders, setError, t]
    );

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setUploadResult(null);
            setFileHeaders([]);
            setFileContent(null);
            // Do not reset editingHeaders to allow manual editing

            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result?.toString();
                if (content) {
                    console.log('Frontend file content (first 200 chars):', content.slice(0, 200));
                    setFileContent(content);
                    const isValid = validateHeaders(content);
                    if (isValid) {
                        setError(null);
                    }
                } else {
                    setError(t("adminDashboard.error.invalidCSVFormat"));
                    setEditingHeaders(true);
                }
            };
            reader.onerror = () => {
                setError(t("adminDashboard.error.invalidCSVFormat"));
                setEditingHeaders(true);
            };
            reader.readAsText(selectedFile, 'UTF-8');
        }
    };

    // Toggle header editing
    const handleEditHeaders = () => {
        setEditingHeaders(true);
    };

    // Handle header mapping change
    const handleHeaderChange = (headerID: string, newMappedHeader: string) => {
        setHeaderMappings(prevHeaders =>
            prevHeaders.map(header =>
                header.headerID === headerID ? { ...header, mappedHeader: newMappedHeader } : header
            )
        );
    };

    // Save header mappings
    const handleSaveHeaders = async () => {
        // Validate that all mapped headers are non-empty, unique, and valid CSV headers
        const mappedHeaders = headerMappings.map(h => h.mappedHeader.trim());
        if (mappedHeaders.some(h => !h)) {
            setError(t("adminDashboard.error.emptyHeaders"));
            return;
        }
        if (new Set(mappedHeaders).size !== mappedHeaders.length) {
            setError(t("adminDashboard.error.duplicateHeaders"));
            return;
        }
        if (mappedHeaders.some(h => !fileHeaders.includes(h))) {
            setError(t("adminDashboard.error.invalidHeaderMapping"));
            return;
        }

        setSavingHeaders(true);
        try {
            const updateData = headerMappings.map(({ expectedHeader, mappedHeader }) => ({
                expectedHeader,
                mappedHeader: mappedHeader.trim(),
            }));
            await updateCsvHeaders('agent', updateData);
            const response: GetCsvHeadersResponse = await getCsvHeaders('agent');
            const headers = response.headers.map(h => h.mappedHeader);
            setExpectedHeaders(headers);
            setHeaderMappings(response.headers);
            if (fileContent) {
                const isValid = validateHeaders(fileContent);
                if (isValid) {
                    setError(null);
                    setEditingHeaders(false);
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : t("adminDashboard.error.saveHeadersFailed");
            setError(errorMessage);
        } finally {
            setSavingHeaders(false);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError(t("adminDashboard.error.noFileSelected"));
            return;
        }

        setUploading(true);
        try {
            const result = await uploadAgents(file);
            setUploadResult(result);
            setError(null);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : t("adminDashboard.error.uploadFailed");
            setError(errorMessage);
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setUploadResult(null);
        setUploading(false);
        setExpectedHeaders([]);
        setFileHeaders([]);
        setFileContent(null);
        setHeaderMappings([]);
        setEditingHeaders(false);
        setSavingHeaders(false);
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
                className="role-info-popup role-info-popup-5"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
            >
                <div className="card-header">
                    <h2>{t("adminDashboard.agents.bulkUpload")}</h2>
                    <button
                        className="cancel-button"
                        onClick={handleClose}
                        aria-label={t("adminDashboard.actions.close")}
                    >
                        <FaTimes aria-hidden="true" />
                    </button>
                </div>
                <div className="modal-body">
                    <p>{t("adminDashboard.agents.uploadInstructions")}</p>
                    <p>{t("adminDashboard.agents.csvFormat")}</p>
                    {expectedHeaders.length > 0 && (
                        <p>{t("adminDashboard.agents.expectedHeaders", { headers: expectedHeaders.join(', ') })}</p>
                    )}
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="form-group input"
                        disabled={uploading || expectedHeaders.length === 0 || savingHeaders}
                        aria-label={t("adminDashboard.agents.selectCSV")}
                    />
                    {file && (
                        <>
                            <p>{t("adminDashboard.agents.selectedFile", { fileName: file.name })}</p>
                            <motion.button
                                className="action-button"
                                onClick={handleEditHeaders}
                                disabled={uploading || savingHeaders || !fileHeaders.length}
                                aria-label={t("adminDashboard.csvHeaders.editHeaders")}
                                style={{ marginBottom: '10px' }}
                            >
                                <FaEdit aria-hidden="true" /> {t("adminDashboard.csvHeaders.editHeaders")}
                            </motion.button>
                        </>
                    )}
                    {editingHeaders && headerMappings.length > 0 && (
                        <div className="header-list">
                            <p>{t("adminDashboard.csvHeaders.mismatchWarning")}</p>
                            {fileHeaders.length > 0 && (
                                <p>{t("adminDashboard.csvHeaders.fileHeaders", { headers: fileHeaders.join(', ') })}</p>
                            )}
                            <h3>{t("adminDashboard.csvHeaders.mappingInstructions")}</h3>
                            <table className="header-table">
                                <thead>
                                    <tr>
                                        <th>{t("adminDashboard.csvHeaders.systemHeader")}</th>
                                        <th>{t("adminDashboard.csvHeaders.csvHeader")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {headerMappings.map(header => (
                                        <tr key={header.headerID}>
                                            <td>{header.expectedHeader}</td>
                                            <td>
                                                <select
                                                    value={header.mappedHeader}
                                                    onChange={(e) => handleHeaderChange(header.headerID, e.target.value)}
                                                    className="form-group input header-select"
                                                    disabled={savingHeaders}
                                                    aria-label={t("adminDashboard.csvHeaders.editHeader", { header: header.expectedHeader })}
                                                >
                                                    <option value="">{t("adminDashboard.csvHeaders.selectHeader")}</option>
                                                    {fileHeaders.map((csvHeader, index) => (
                                                        <option key={index} value={csvHeader}>
                                                            {csvHeader}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <motion.button
                                className="action-button"
                                onClick={handleSaveHeaders}
                                disabled={savingHeaders || !fileHeaders.length}
                                aria-label={savingHeaders ? t("adminDashboard.actions.saving") : t("adminDashboard.actions.save")}
                                style={{ marginTop: '10px' }}
                            >
                                <FaSave aria-hidden="true" /> {savingHeaders ? t("adminDashboard.actions.saving") + "..." : t("adminDashboard.actions.save")}
                            </motion.button>
                        </div>
                    )}
                    {uploadResult && uploadResult.summary ? (
                        <div className="upload-results">
                            <h3>{t("adminDashboard.agents.uploadResults")}</h3>
                            <p>{t("adminDashboard.agents.created", { count: uploadResult.summary.agentsCreated })}</p>
                            <p>{t("adminDashboard.agents.updated", { count: uploadResult.summary.agentsUpdated })}</p>
                            <p>{t("adminDashboard.agents.skipped", { count: uploadResult.summary.recordsSkipped })}</p>
                            {uploadResult.detailedLog.errors &&
                                Array.isArray(uploadResult.detailedLog.errors) &&
                                uploadResult.detailedLog.errors.length > 0 && (
                                    <div className="error-list">
                                        <h4>{t("adminDashboard.agents.errors")}</h4>
                                        <ul>
                                            {uploadResult.detailedLog.errors.map((error, index) => (
                                                <li key={index}>
                                                    {error.agentName} ({error.agentPhone}) - {error.operation || 'Unknown operation'}: {error.reason}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                        </div>
                    ) : uploadResult && (
                        <p>{t("adminDashboard.error.invalidResponse")}</p>
                    )}
                </div>
                <div className="modal-footer">
                    <motion.button
                        className="action-button"
                        onClick={handleUpload}
                        disabled={uploading || !file || expectedHeaders.length === 0 || editingHeaders || savingHeaders}
                        aria-label={uploading ? t("adminDashboard.actions.uploading") : t("adminDashboard.agents.upload")}
                    >
                        <FaUpload aria-hidden="true" /> {uploading ? t("adminDashboard.actions.uploading") + "..." : t("adminDashboard.agents.upload")}
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

export default AgentBulkUploadModal;