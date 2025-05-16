import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { FaTimes, FaUpload, FaSave, FaEdit, FaPlus, FaExclamationTriangle } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { uploadAgents } from "../../../apis/agentAPI";
import { AgentBulkUploadResponse } from "../../../apis/index";
import { getCsvHeaders, updateCsvHeaders, GetCsvHeadersResponse, CsvHeader } from "../../../apis/csvHeaderAPI";
import "../AdminDashboard.css";

const MANDATORY_HEADERS = [
    { csvHeader: "firstname", backend: "name" },
    { csvHeader: "lastname", backend: "lastname" },
    { csvHeader: "phone", backend: "phone" },
    { csvHeader: "email", backend: "email" },
    { csvHeader: "delegation", backend: "delegation" },
    { csvHeader: "supervisor_phone", backend: "supervisor_phone" },
];

const OPTIONAL_HEADERS = [
    { csvHeader: "governorate", backend: "governorate" },
    { csvHeader: "adress", backend: "lat,lng" },
    { csvHeader: "latitude", backend: "lat" },
    { csvHeader: "longtitude", backend: "lng" },
];

const BACKEND_FIELDS = [
    "name",
    "lastname",
    "phone",
    "email",
    "delegation",
    "supervisor_phone",
    "governorate",
    "lat",
    "lng",
];

interface AgentBulkUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    setError: (error: string | null) => void;
}

const AgentBulkUploadModal: React.FC<AgentBulkUploadModalProps> = ({ isOpen, onClose, setError }) => {
    const { t } = useTranslation();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<AgentBulkUploadResponse | null>(null);
    const [fileHeaders, setFileHeaders] = useState<string[]>([]);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [headerMappings, setHeaderMappings] = useState<CsvHeader[]>([]);
    const [editingHeaders, setEditingHeaders] = useState(false);
    const [savingHeaders, setSavingHeaders] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const fetchHeaders = async () => {
            try {
                const response: GetCsvHeadersResponse = await getCsvHeaders("agent");
                setHeaderMappings(response.headers);
                setError(null);
            } catch (error) {
                setError(error instanceof Error ? error.message : t("adminDashboard.error.fetchHeadersFailed"));
            }
        };

        fetchHeaders();
    }, [isOpen, setError, t]);

    const validateHeaders = useCallback(
        (content: string): boolean => {
            try {
                const firstLine = content.split("\n")[0].trim();
                if (!firstLine) throw new Error(t("adminDashboard.error.emptyCSV"));

                const headers = firstLine.split(",").map((h) => h.trim()).filter(Boolean);
                console.log("CSV Headers:", headers);
                setFileHeaders(headers);
                if (headers.length === 0) throw new Error(t("adminDashboard.error.noHeaders"));

                const mappedHeaders = headerMappings.map((h) => h.mappedHeader).filter(Boolean);
                const mandatoryBackendHeaders = MANDATORY_HEADERS.map((h) => h.backend);
                const mappedBackendHeaders = headerMappings
                    .filter((h) => h.mappedHeader && headers.includes(h.mappedHeader))
                    .map((h) => h.expectedHeader);

                const unmappedMandatory = mandatoryBackendHeaders.filter((h) => !mappedBackendHeaders.includes(h));
                if (unmappedMandatory.length > 0) {
                    // Provide detailed error with expected mapped headers
                    const missingHeaders = unmappedMandatory.map((backendHeader) => {
                        const mapping = headerMappings.find((h) => h.expectedHeader === backendHeader);
                        return mapping ? mapping.mappedHeader : backendHeader;
                    });
                    setError(
                        t("adminDashboard.error.unmappedMandatoryBackendHeaders", {
                            headers: missingHeaders.join(", "),
                        })
                    );
                    setEditingHeaders(true);
                    return false;
                }

                const invalidMappedHeaders = mappedHeaders.filter((h) => !headers.includes(h));
                if (invalidMappedHeaders.length > 0) {
                    setError(t("adminDashboard.error.invalidMappedHeaders", { headers: invalidMappedHeaders.join(", ") }));
                    setEditingHeaders(true);
                    return false;
                }

                setError(null);
                setEditingHeaders(false);
                return true;
            } catch (error) {
                console.error("Validation Error:", error);
                setError(error instanceof Error ? error.message : t("adminDashboard.error.invalidCSVFormat"));
                setEditingHeaders(true);
                return false;
            }
        },
        [headerMappings, setError, t]
    );

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        if (!selectedFile.name.endsWith(".csv")) {
            setError(t("adminDashboard.error.invalidFileType"));
            return;
        }
        if (selectedFile.size > 5 * 1024 * 1024) {
            setError(t("adminDashboard.error.fileTooLarge"));
            return;
        }

        setFile(selectedFile);
        setUploadResult(null);
        setFileHeaders([]);
        setFileContent(null);

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result?.toString();
            if (content) {
                setFileContent(content);
                validateHeaders(content);
            } else {
                setError(t("adminDashboard.error.invalidCSVFormat"));
                setEditingHeaders(true);
            }
        };
        reader.onerror = () => {
            setError(t("adminDashboard.error.fileReadError"));
            setEditingHeaders(true);
        };
        reader.readAsText(selectedFile, "UTF-8");
    };

    const handleFileSelectClick = () => {
        fileInputRef.current?.click();
    };

    const handleHeaderChange = (headerID: string, field: "expectedHeader" | "mappedHeader", value: string) => {
        setHeaderMappings((prev) =>
            prev.map((header) => (header.headerID === headerID ? { ...header, [field]: value } : header))
        );
    };

    const handleAddHeader = () => {
        const newHeader: CsvHeader = {
            headerID: `temp-${Date.now()}-${Math.random()}`,
            csvType: "agent",
            expectedHeader: "",
            mappedHeader: "",
        };
        setHeaderMappings((prev) => [...prev, newHeader]);
    };

    const handleRemoveHeader = (headerID: string) => {
        setHeaderMappings((prev) => prev.filter((header) => header.headerID !== headerID));
    };

    const getAvailableHeaders = (currentHeaderID: string) => {
        const selectedHeaders = headerMappings
            .filter((header) => header.headerID !== currentHeaderID && header.mappedHeader)
            .map((header) => header.mappedHeader);
        return fileHeaders.filter((header) => !selectedHeaders.includes(header));
    };

    const handleSaveHeaders = async () => {
        const expectedHeaders = headerMappings.map((h) => h.expectedHeader.trim());
        const mappedHeaders = headerMappings.map((h) => h.mappedHeader.trim());

        if (expectedHeaders.some((h) => !h) || mappedHeaders.some((h) => !h)) {
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

        const mandatoryBackendHeaders = MANDATORY_HEADERS.map((h) => h.backend);
        const mappedBackendHeaders = headerMappings.map((h) => h.expectedHeader);
        const unmappedMandatory = mandatoryBackendHeaders.filter((h) => !mappedBackendHeaders.includes(h));
        if (unmappedMandatory.length > 0) {
            setError(
                t("adminDashboard.error.unmappedMandatoryBackendHeaders", { headers: unmappedMandatory.join(", ") })
            );
            return;
        }

        const invalidMappedHeaders = mappedHeaders.filter((h) => !fileHeaders.includes(h));
        if (invalidMappedHeaders.length > 0) {
            setError(t("adminDashboard.error.invalidMappedHeaders", { headers: invalidMappedHeaders.join(", ") }));
            return;
        }

        setSavingHeaders(true);
        try {
            const updateData = headerMappings.map(({ expectedHeader, mappedHeader }) => ({
                expectedHeader: expectedHeader.trim(),
                mappedHeader: mappedHeader.trim(),
            }));
            await updateCsvHeaders("agent", updateData);
            const response: GetCsvHeadersResponse = await getCsvHeaders("agent");
            console.log("Updated Header Mappings:", response.headers);
            setHeaderMappings(response.headers);
            if (fileContent && validateHeaders(fileContent)) {
                setError(null);
                setEditingHeaders(false);
            } else {
                setError(t("adminDashboard.error.validationFailedAfterSave"));
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : t("adminDashboard.error.saveHeadersFailed"));
        } finally {
            setSavingHeaders(false);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError(t("adminDashboard.error.noFileSelected"));
            return;
        }
        if (!fileContent || !validateHeaders(fileContent)) {
            setError(t("adminDashboard.error.invalidCSVBeforeUpload"));
            return;
        }

        setUploading(true);
        try {
            const result = await uploadAgents(file);
            setUploadResult(result);
            setError(null);
        } catch (error) {
            setError(error instanceof Error ? error.message : t("adminDashboard.error.uploadFailed"));
        } finally {
            setUploading(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setUploadResult(null);
        setUploading(false);
        setFileHeaders([]);
        setFileContent(null);
        setHeaderMappings([]);
        setEditingHeaders(false);
        setSavingHeaders(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <motion.div className="role-info-popup-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="role-info-popup role-info-popup-5" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
                <div className="card-header">
                    <h2>{t("adminDashboard.agents.bulkUpload")}</h2>
                    <button className="cancel-button" onClick={handleClose} aria-label={t("adminDashboard.actions.close")}>
                        <FaTimes aria-hidden="true" />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="header-requirements">
                        <h3>{t("adminDashboard.agents.requiredHeaders")}</h3>
                        <p>{MANDATORY_HEADERS.map((h) => h.csvHeader).join(", ")}</p>
                        <h3>{t("adminDashboard.agents.optionalHeaders")}</h3>
                        <p>{OPTIONAL_HEADERS.map((h) => h.csvHeader).join(", ") || t("adminDashboard.agents.none")}</p>
                    </div>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="form-group input"
                        ref={fileInputRef}
                        style={{ display: "none" }}
                        aria-label={t("adminDashboard.agents.selectCSV")}
                    />
                    <button
                        className="action-button"
                        onClick={handleFileSelectClick}
                        disabled={uploading || savingHeaders}
                        aria-label={t("adminDashboard.agents.selectCSV")}
                    >
                        <FaUpload aria-hidden="true" /> {t("adminDashboard.agents.selectCSV")}
                    </button>
                    {file && (
                        <div className="file-info">
                            <p>{t("adminDashboard.agents.selectedFile", { fileName: file.name })}</p>
                            <button
                                className="action-button"
                                onClick={() => setEditingHeaders(true)}
                                disabled={uploading || savingHeaders || !fileHeaders.length}
                                aria-label={t("adminDashboard.csvHeaders.editHeaders")}
                            >
                                <FaEdit aria-hidden="true" /> {t("adminDashboard.csvHeaders.editHeaders")}
                            </button>
                        </div>
                    )}
                    {editingHeaders && (
                        <div className="header-list">
                            <p className="warning">
                                <FaExclamationTriangle aria-hidden="true" /> {t("adminDashboard.csvHeaders.mismatchWarning")}
                            </p>
                            {fileHeaders.length > 0 && (
                                <p>{t("adminDashboard.csvHeaders.fileHeaders", { headers: fileHeaders.join(", ") })}</p>
                            )}
                            <h3>{t("adminDashboard.csvHeaders.mappingInstructions")}</h3>
                            <button
                                className="action-button"
                                onClick={handleAddHeader}
                                disabled={savingHeaders}
                                aria-label={t("adminDashboard.csvHeaders.addHeader")}
                            >
                                <FaPlus aria-hidden="true" /> {t("adminDashboard.csvHeaders.addHeader")}
                            </button>
                            <hr />
                            <table className="header-table">
                                <thead>
                                    <tr>
                                        <th>{t("adminDashboard.csvHeaders.systemHeader")}</th>
                                        <th>{t("adminDashboard.csvHeaders.csvHeader")}</th>
                                        <th>{t("adminDashboard.csvHeaders.actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {headerMappings.map((header) => {
                                        const isMandatory = MANDATORY_HEADERS.some((h) => h.backend === header.expectedHeader);
                                        return (
                                            <tr key={header.headerID}>
                                                <td>
                                                    <select
                                                        value={header.expectedHeader}
                                                        onChange={(e) => handleHeaderChange(header.headerID, "expectedHeader", e.target.value)}
                                                        className="form-group input header-select"
                                                        disabled={savingHeaders}
                                                        aria-label={t("adminDashboard.csvHeaders.editSystemHeader", { header: header.expectedHeader })}
                                                        required={isMandatory}
                                                    >
                                                        <option value="">{t("adminDashboard.csvHeaders.selectSystemHeader")}</option>
                                                        {BACKEND_FIELDS.map((field) => (
                                                            <option key={field} value={field}>
                                                                {field}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {isMandatory && (
                                                        <span className="mandatory-indicator">{t("adminDashboard.csvHeaders.required")}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <select
                                                        value={header.mappedHeader}
                                                        onChange={(e) => handleHeaderChange(header.headerID, "mappedHeader", e.target.value)}
                                                        className="form-group input header-select"
                                                        disabled={savingHeaders}
                                                        aria-label={t("adminDashboard.csvHeaders.editHeader", { header: header.expectedHeader })}
                                                        required={isMandatory}
                                                    >
                                                        <option value="">{t("adminDashboard.csvHeaders.selectHeader")}</option>
                                                        {getAvailableHeaders(header.headerID).map((csvHeader) => (
                                                            <option key={csvHeader} value={csvHeader}>
                                                                {csvHeader}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <button
                                                        className="delete-button"
                                                        onClick={() => handleRemoveHeader(header.headerID)}
                                                        disabled={savingHeaders || isMandatory}
                                                        aria-label={t("adminDashboard.csvHeaders.removeHeader")}
                                                    >
                                                        {t("adminDashboard.csvHeaders.remove")}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <hr />
                            <button
                                className="action-button"
                                onClick={handleSaveHeaders}
                                disabled={savingHeaders || !fileHeaders.length}
                                aria-label={savingHeaders ? t("adminDashboard.actions.saving") : t("adminDashboard.actions.save")}
                            >
                                <FaSave aria-hidden="true" /> {savingHeaders ? `${t("adminDashboard.actions.saving")}...` : t("adminDashboard.actions.save")}
                            </button>
                        </div>
                    )}
                    {uploadResult?.summary && (
                        <div className="upload-results">
                            <h3>{t("adminDashboard.agents.uploadResults")}</h3>
                            <p>{t("adminDashboard.agents.totalRecords", { count: uploadResult.summary.totalRecords })}</p>
                            <p>{t("adminDashboard.agents.created", { count: uploadResult.summary.agentsCreated })}</p>
                            <p>{t("adminDashboard.agents.updated", { count: uploadResult.summary.agentsUpdated })}</p>
                            <p>{t("adminDashboard.agents.skipped", { count: uploadResult.summary.recordsSkipped })}</p>
                            {uploadResult.detailedLog.skipped?.length > 0 && (
                                <div className="skip-list">
                                    <h4>{t("adminDashboard.agents.skippedRecords")}</h4>
                                    <ul>
                                        {uploadResult.detailedLog.skipped.map((skip, index) => (
                                            <li key={index}>
                                                {skip.agentName} ({skip.agentPhone}) - {t("adminDashboard.agents.skipReason")}: {skip.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {uploadResult.detailedLog.errors?.length > 0 && (
                                <div className="error-list">
                                    <h4>{t("adminDashboard.agents.errors")}</h4>
                                    <ul>
                                        {uploadResult.detailedLog.errors.map((error, index) => (
                                            <li key={index}>
                                                {error.agentName} ({error.agentPhone}) - {error.operation || t("adminDashboard.agents.unknownOperation")}: {error.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button
                        className="action-button"
                        onClick={handleUpload}
                        disabled={uploading || !file || editingHeaders || savingHeaders}
                        aria-label={uploading ? t("adminDashboard.actions.uploading") : t("adminDashboard.agents.upload")}
                    >
                        <FaUpload aria-hidden="true" /> {uploading ? `${t("adminDashboard.actions.uploading")}...` : t("adminDashboard.agents.upload")}
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

export default AgentBulkUploadModal;