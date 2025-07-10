/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { FaTimes, FaUpload, FaSave, FaEdit, FaPlus, FaExclamationTriangle } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { uploadReceiptBooks } from "../../apis/receiptBookAPI";
import { ReceiptBookBulkUploadResponse } from "../../apis/index";
import { getCsvHeaders, updateCsvHeaders, GetCsvHeadersResponse, CsvHeader } from "../../apis/csvHeaderAPI";
import "./ReceiptBooks.css";
import "../Admin/AdminDashboard.css";

const MANDATORY_HEADERS = [
    { csvHeader: "number", backend: "number" },
    { csvHeader: "type", backend: "type" },
];

const OPTIONAL_HEADERS = [
    { csvHeader: "status", backend: "status" },
];

const BACKEND_FIELDS = [
    "number",
    "type",
    "status",
];

interface ReceiptBookBulkUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadSuccess: () => void;
    setError: (error: string | null) => void;
}

const ReceiptBookBulkUploadModal: React.FC<ReceiptBookBulkUploadModalProps> = ({ isOpen, onClose, setError }) => {
    const { t } = useTranslation();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [uploadPercentage, setUploadPercentage] = useState<number>(0);
    const [uploadResult, setUploadResult] = useState<ReceiptBookBulkUploadResponse | null>(null);
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
                const response: GetCsvHeadersResponse = await getCsvHeaders("receipt_book");
                console.log("Fetched headerMappings:", response.headers);
                setHeaderMappings(response.headers);
                setError(null);
            } catch (error) {
                setError(error instanceof Error ? error.message : t("receiptBooks.errors.fetchHeadersFailed"));
            }
        };
        fetchHeaders();
    }, [isOpen, setError, t]);

    const validateHeaders = useCallback(
        (content: string): boolean => {
            try {
                const firstLine = content.split("\n")[0].trim();
                if (!firstLine) throw new Error(t("receiptBooks.errors.emptyCSV"));

                const headers = firstLine.split(",").map((h) => h.trim()).filter(Boolean);
                console.log("CSV Headers:", headers);
                setFileHeaders(headers);
                if (headers.length === 0) throw new Error(t("receiptBooks.errors.noHeaders"));

                const mappedHeaders = headerMappings.map((h) => h.mappedHeader).filter(Boolean);
                const mandatoryBackendHeaders = MANDATORY_HEADERS.map((h) => h.backend);
                const mappedBackendHeaders = headerMappings
                    .filter((h) => h.mappedHeader && headers.includes(h.mappedHeader))
                    .map((h) => h.expectedHeader);

                const unmappedMandatory = mandatoryBackendHeaders.filter((h) => !mappedBackendHeaders.includes(h));
                if (unmappedMandatory.length > 0) {
                    const missingHeaders = unmappedMandatory.map((backendHeader) => {
                        const mapping = headerMappings.find((h) => h.expectedHeader === backendHeader);
                        return mapping ? mapping.mappedHeader : backendHeader;
                    });
                    setError(
                        t("receiptBooks.errors.unmappedMandatoryBackendHeaders", {
                            headers: missingHeaders.join(", "),
                        })
                    );
                    setEditingHeaders(true);
                    return false;
                }

                const invalidMappedHeaders = mappedHeaders.filter((h) => !headers.includes(h));
                if (invalidMappedHeaders.length > 0) {
                    setError(t("receiptBooks.errors.invalidMappedHeaders", { headers: invalidMappedHeaders.join(", ") }));
                    setEditingHeaders(true);
                    return false;
                }

                setError(null);
                setEditingHeaders(false);
                return true;
            } catch (error) {
                console.error("Validation Error:", error);
                setError(error instanceof Error ? error.message : t("receiptBooks.errors.invalidCSVFormat"));
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
            setError(t("receiptBooks.errors.invalidFileType"));
            return;
        }
        if (selectedFile.size > 5 * 1024 * 1024) {
            setError(t("receiptBooks.errors.fileTooLarge"));
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
                setError(t("receiptBooks.errors.invalidCSVFormat"));
                setEditingHeaders(true);
            }
        };
        reader.onerror = () => {
            setError(t("receiptBooks.errors.fileReadError"));
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
            csvType: "receipt_book",
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
            setError(t("receiptBooks.errors.emptyHeaders"));
            return;
        }
        if (new Set(expectedHeaders).size !== expectedHeaders.length) {
            setError(t("receiptBooks.errors.duplicateExpectedHeaders"));
            return;
        }
        if (new Set(mappedHeaders).size !== mappedHeaders.length) {
            setError(t("receiptBooks.errors.duplicateHeaders"));
            return;
        }

        const mandatoryBackendHeaders = MANDATORY_HEADERS.map((h) => h.backend);
        const mappedBackendHeaders = headerMappings.map((h) => h.expectedHeader);
        const unmappedMandatory = mandatoryBackendHeaders.filter((h) => !mappedBackendHeaders.includes(h));
        if (unmappedMandatory.length > 0) {
            setError(
                t("receiptBooks.errors.unmappedMandatoryBackendHeaders", { headers: unmappedMandatory.join(", ") })
            );
            return;
        }

        const invalidMappedHeaders = mappedHeaders.filter((h) => !fileHeaders.includes(h));
        if (invalidMappedHeaders.length > 0) {
            setError(t("receiptBooks.errors.invalidMappedHeaders", { headers: invalidMappedHeaders.join(", ") }));
            return;
        }

        setSavingHeaders(true);
        try {
            const updateData = headerMappings.map(({ expectedHeader, mappedHeader }) => ({
                expectedHeader: expectedHeader.trim(),
                mappedHeader: mappedHeader.trim(),
            }));
            await updateCsvHeaders("receipt_book", updateData);
            const response: GetCsvHeadersResponse = await getCsvHeaders("receipt_book");
            console.log("Updated Header Mappings:", response.headers);
            setHeaderMappings(response.headers);
            if (fileContent && validateHeaders(fileContent)) {
                setError(null);
                setEditingHeaders(false);
            } else {
                setError(t("receiptBooks.errors.validationFailedAfterSave"));
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : t("receiptBooks.errors.saveHeadersFailed"));
        } finally {
            setSavingHeaders(false);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError(t("receiptBooks.errors.noFileSelected"));
            return;
        }
        if (!fileContent || !validateHeaders(fileContent)) {
            setError(t("receiptBooks.errors.invalidCSVBeforeUpload"));
            return;
        }

        setUploading(true);
        setProcessing(false);
        setUploadPercentage(0);

        try {
            const result = await uploadReceiptBooks(file, (percentage) => {
                setUploadPercentage(percentage);
                if (percentage === 100) {
                    setProcessing(true);
                }
            });
            setUploadResult(result);
            setError(null);
        } catch (error) {
            setError(error instanceof Error ? error.message : t("receiptBooks.errors.uploadFailed"));
        } finally {
            setUploading(false);
            setProcessing(false);
            setUploadPercentage(0);
        }
    };

    const handleClose = () => {
        setFile(null);
        setUploadResult(null);
        setUploading(false);
        setProcessing(false);
        setUploadPercentage(0);
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
                    <h2>{t("receiptBooks.bulkUpload.title")}</h2>
                    <button className="cancel-button" onClick={handleClose} aria-label={t("receiptBooks.actions.close")}>
                        <FaTimes aria-hidden="true" />
                    </button>
                </div>
                <div className="modal-body">
                    <div className="header-requirements">
                        <h3>{t("receiptBooks.bulkUpload.requiredHeaders")}</h3>
                        <p>{MANDATORY_HEADERS.map((h) => h.csvHeader).join(", ")}</p>
                        <h3>{t("receiptBooks.bulkUpload.optionalHeaders")}</h3>
                        <p>{OPTIONAL_HEADERS.map((h) => h.csvHeader).join(", ") || t("receiptBooks.bulkUpload.none")}</p>
                    </div>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="form-group input"
                        ref={fileInputRef}
                        style={{ display: "none" }}
                        aria-label={t("receiptBooks.bulkUpload.selectCSV")}
                    />
                    <button
                        className="action-button"
                        onClick={handleFileSelectClick}
                        disabled={uploading || processing || savingHeaders}
                        aria-label={t("receiptBooks.bulkUpload.selectCSV")}
                    >
                        <FaUpload aria-hidden="true" /> {t("receiptBooks.bulkUpload.selectCSV")}
                    </button>
                    {(uploading || processing) && (
                        <div className="upload-progress">
                            {uploading && !processing ? (
                                <>
                                    <p>{t("receiptBooks.bulkUpload.uploading")} {uploadPercentage}%</p>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-bar-fill"
                                            style={{ width: `${uploadPercentage}%` }}
                                        ></div>
                                    </div>
                                </>
                            ) : (
                                <p>{t("receiptBooks.bulkUpload.processing")}</p>
                            )}
                        </div>
                    )}
                    {file && (
                        <div className="file-info">
                            <p>{t("receiptBooks.bulkUpload.selectedFile", { fileName: file.name })}</p>
                            <button
                                className="action-button"
                                onClick={() => setEditingHeaders(true)}
                                disabled={uploading || processing || savingHeaders || !fileHeaders.length}
                                aria-label={t("receiptBooks.bulkUpload.editHeaders")}
                            >
                                <FaEdit aria-hidden="true" /> {t("receiptBooks.bulkUpload.editHeaders")}
                            </button>
                        </div>
                    )}
                    {editingHeaders && (
                        <div className="header-list">
                            <p className="warning">
                                <FaExclamationTriangle aria-hidden="true" /> {t("receiptBooks.bulkUpload.mismatchWarning")}
                            </p>
                            {fileHeaders.length > 0 && (
                                <p>{t("receiptBooks.bulkUpload.fileHeaders", { headers: fileHeaders.join(", ") })}</p>
                            )}
                            <h3>{t("receiptBooks.bulkUpload.mappingInstructions")}</h3>
                            <button
                                className="action-button"
                                onClick={handleAddHeader}
                                disabled={savingHeaders}
                                aria-label={t("receiptBooks.bulkUpload.addHeader")}
                            >
                                <FaPlus aria-hidden="true" /> {t("receiptBooks.bulkUpload.addHeader")}
                            </button>
                            <hr />
                            <table className="header-table">
                                <thead>
                                    <tr>
                                        <th>{t("receiptBooks.bulkUpload.systemHeader")}</th>
                                        <th>{t("receiptBooks.bulkUpload.csvHeader")}</th>
                                        <th>{t("receiptBooks.bulkUpload.actions")}</th>
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
                                                        aria-label={t("receiptBooks.bulkUpload.editSystemHeader", { header: header.expectedHeader })}
                                                        required={isMandatory}
                                                    >
                                                        <option value="">{t("receiptBooks.bulkUpload.selectSystemHeader")}</option>
                                                        {BACKEND_FIELDS.map((field) => (
                                                            <option key={field} value={field}>
                                                                {field}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {isMandatory && (
                                                        <span className="mandatory-indicator">{t("receiptBooks.bulkUpload.required")}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <select
                                                        value={header.mappedHeader}
                                                        onChange={(e) => handleHeaderChange(header.headerID, "mappedHeader", e.target.value)}
                                                        className="form-group input header-select"
                                                        disabled={savingHeaders}
                                                        aria-label={t("receiptBooks.bulkUpload.editHeader", { header: header.expectedHeader })}
                                                        required={isMandatory}
                                                    >
                                                        <option value="">{t("receiptBooks.bulkUpload.selectHeader")}</option>
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
                                                        aria-label={t("receiptBooks.bulkUpload.removeHeader")}
                                                    >
                                                        {t("receiptBooks.bulkUpload.remove")}
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
                                aria-label={savingHeaders ? t("receiptBooks.actions.saving") : t("receiptBooks.actions.save")}
                            >
                                <FaSave aria-hidden="true" /> {savingHeaders ? `${t("receiptBooks.actions.saving")}...` : t("receiptBooks.actions.save")}
                            </button>
                        </div>
                    )}
                    {uploadResult?.summary && (
                        <div className="upload-results">
                            <h3>{t("receiptBooks.bulkUpload.uploadResults")}</h3>
                            <p>{t("receiptBooks.bulkUpload.totalRecords", { count: uploadResult.summary.totalRecords })}</p>
                            <p>{t("receiptBooks.bulkUpload.created", { count: uploadResult.summary.booksCreated })}</p>
                            <p>{t("receiptBooks.bulkUpload.skipped", { count: uploadResult.summary.recordsSkipped })}</p>
                            {uploadResult.detailedLog.skipped?.length > 0 && (
                                <div className="skip-list">
                                    <h4>{t("receiptBooks.bulkUpload.skippedRecords")}</h4>
                                    <ul>
                                        {uploadResult.detailedLog.skipped.map((skip, index) => (
                                            <li key={index}>
                                                {skip.bookNumber} - {t("receiptBooks.bulkUpload.skipReason")}: {skip.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {uploadResult.detailedLog.errors?.length > 0 && (
                                <div className="error-list">
                                    <h4>{t("receiptBooks.bulkUpload.errors")}</h4>
                                    <ul>
                                        {uploadResult.detailedLog.errors.map((error, index) => (
                                            <li key={index}>
                                                {error.bookNumber} - {error.operation || t("receiptBooks.bulkUpload.unknownOperation")}: {error.reason}
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
                        disabled={uploading || processing || !file || editingHeaders || savingHeaders}
                        aria-label={uploading || processing ? t("receiptBooks.actions.uploading") : t("receiptBooks.bulkUpload.upload")}
                    >
                        <FaUpload aria-hidden="true" /> {uploading || processing ? `${t("receiptBooks.actions.uploading")}...` : t("receiptBooks.bulkUpload.upload")}
                    </button>
                    <button
                        className="cancel-button"
                        onClick={handleClose}
                        aria-label={t("receiptBooks.actions.cancel")}
                    >
                        {t("receiptBooks.actions.cancel")}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default ReceiptBookBulkUploadModal;