/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch,
  FaSort,
  FaPlus,
  FaEdit,
  FaTrash,
  FaHistory,
  FaExchangeAlt,
  FaList,
  FaUpload,
  FaSyncAlt,
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import {
  getAllReceiptBooks,
  createReceiptBook,
  updateReceiptBook,
  deleteReceiptBook,
  getAllReceiptBookTypes,
  createReceiptBookType,
  updateReceiptBookType,
  deleteReceiptBookType,
} from "../../apis/receiptBookAPI";
import ReceiptBook from "../../models/ReceiptBook";
import ReceiptBookType from "../../models/ReceiptBookType";
import { useTranslation } from "react-i18next";
import { debounce } from "lodash";
import { t } from "i18next";
import ReceiptBookBulkUploadModal from "./ReceiptBookBulkUploadModal";
import { onNotification, offNotification } from "../../lib/socket";
import "./ReceiptBooks.css";
import "../Admin/AdminDashboard.css";

// Constants
const ITEMS_PER_PAGE = 10;
const CACHE_DURATION = 30 * 60 * 1000;
const SKELETON_ROWS = 10;
const SEARCH_DEBOUNCE_MS = 500;

// Permissions and Roles
const PERMISSIONS = {
  ACCESS_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS,
  ACCESS_RECEIPT_BOOK_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_DETAILS,
  ACCESS_RECEIPT_BOOK_HISTORY: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_HISTORY,
  CREATE_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_CREATE_RECEIPT_BOOKS,
  UPDATE_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_UPDATE_RECEIPT_BOOKS,
  DELETE_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_DELETE_RECEIPT_BOOKS,
  TRANSFER_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_TRANSFER_RECEIPT_BOOKS,
  ACCESS_RECEIPT_BOOK_TYPES: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_TYPES,
  MANAGE_RECEIPT_BOOK_TYPES: import.meta.env.VITE_PERMISSIONS_MANAGE_RECEIPT_BOOK_TYPES,
};

const ROLES = {
  SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
  STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
  REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
  PURCHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
  SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
};

// Interfaces
interface ReceiptBooksCache {
  data: ReceiptBook[];
  totalCount: number;
  totalPages: number;
  timestamp: number;
}

interface ReceiptBookTypesCache {
  data: ReceiptBookType[];
  timestamp: number;
}

// Utility function to pad numbers
const padNumber = (value: string): string => {
  const numericValue = value.replace(/\D/g, "");
  if (numericValue.length > 6) return numericValue.slice(0, 6);
  return numericValue.padStart(6, "0");
};

// Memoized ReceiptBooksList Component
const ReceiptBooksList: React.FC<{
  receiptBooks: ReceiptBook[];
  receiptBookTypes: ReceiptBookType[];
  userPermissions: Record<string, boolean>;
  t: (key: string, options?: Record<string, unknown>) => string;
  handleEdit: (receipt: ReceiptBook) => void;
  handleDelete: (bookID: string) => void;
  navigate: (path: string) => void;
}> = memo(
  ({ receiptBooks, receiptBookTypes, userPermissions, t, handleEdit, handleDelete, navigate }) => (
    <div className="table-card">
      <h2>{t("receiptBooks.title.list")}</h2>
      <div className="table-container">
        <div className="table-head">
          <div className="table-row-0 table-row-1">
            <div className="table-cell">{t("receiptBooks.table.headers.number")}</div>
            <div className="table-cell">{t("receiptBooks.table.headers.type")}</div>
            <div className="table-cell">{t("receiptBooks.table.headers.bookStatus")}</div>
            <div className="table-cell">{t("receiptBooks.table.headers.stubStatus")}</div>
            <div className="table-cell">{t("receiptBooks.table.headers.holder")}</div>
            <div className="table-cell">{t("receiptBooks.table.headers.qrCode")}</div>
            <div className="table-cell">{t("receiptBooks.table.headers.actions")}</div>
          </div>
        </div>
        <div className="table-body">
          {receiptBooks.length > 0 ? (
            receiptBooks.map((receipt) => {
              const type = receiptBookTypes.find((t) => t.typeID === receipt.typeID);
              const holderName = receipt.holder && 'firstname' in receipt.holder && 'lastname' in receipt.holder
                ? `${receipt.holder.firstname} ${receipt.holder.lastname}`
                : t("receiptBooks.table.na");
              return (
                <div key={receipt.bookID} className="table-row-0 table-row-1">
                  <div className="table-cell">{receipt.number}</div>
                  <div className="table-cell">{type ? type.name : t("receiptBooks.table.na")}</div>
                  <div className="table-cell">
                    {t(`common.receiptBookStatuses.${receipt.status.toLowerCase()}`, {
                      defaultValue: receipt.status,
                    })}
                  </div>
                  <div className="table-cell">
                    {receipt.ReceiptStub?.status
                      ? t(`common.receiptBookStatuses.${receipt.ReceiptStub.status.toLowerCase()}`, {
                        defaultValue: receipt.ReceiptStub.status,
                      })
                      : t("receiptBooks.table.na")}
                  </div>
                  <div className="table-cell">{holderName}</div>
                  <div className="table-cell">
                    <img
                      src={receipt.qrCode}
                      alt={t("receiptBooks.table.headers.qrCode")}
                      style={{ width: "50px" }}
                      loading="lazy"
                    />
                  </div>
                  <div className="table-cell actions">
                    {userPermissions.canUpdate && (
                      <button
                        onClick={() => handleEdit(receipt)}
                        aria-label={t("receiptBooks.actions.aria.edit", { number: receipt.number })}
                      >
                        <FaEdit aria-hidden="true" />
                      </button>
                    )}
                    {userPermissions.canDelete && (
                      <button
                        onClick={() => handleDelete(receipt.bookID)}
                        aria-label={t("receiptBooks.actions.aria.delete", { number: receipt.number })}
                      >
                        <FaTrash aria-hidden="true" />
                      </button>
                    )}
                    {userPermissions.canViewHistory && (
                      <button
                        onClick={() => navigate(`/receipt-book/${receipt.bookID}/history`)}
                        aria-label={t("receiptBooks.actions.aria.history", { number: receipt.number })}
                      >
                        <FaHistory aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div>
              <div className="table-cell">{t("receiptBooks.table.noData")}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  ),
  (prevProps, nextProps) =>
    prevProps.receiptBooks === nextProps.receiptBooks &&
    prevProps.receiptBookTypes === nextProps.receiptBookTypes &&
    prevProps.userPermissions === nextProps.userPermissions &&
    prevProps.handleEdit === nextProps.handleEdit &&
    prevProps.handleDelete === nextProps.handleDelete &&
    prevProps.navigate === nextProps.navigate
);

// Memoized ReceiptBookForm Component
const ReceiptBookForm: React.FC<{
  isEdit: boolean;
  receiptBook: Partial<ReceiptBook>;
  receiptBookTypes: ReceiptBookType[];
  setReceiptBook: (book: Partial<ReceiptBook>) => void;
  formError: string | null;
  t: (key: string, options?: Record<string, unknown>) => string;
  handleSubmit: () => void;
  handleCancel: () => void;
  handleNumberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleNumberBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
}> = memo(
  ({
    isEdit,
    receiptBook,
    receiptBookTypes,
    setReceiptBook,
    formError,
    t,
    handleSubmit,
    handleCancel,
    handleNumberChange,
    handleNumberBlur,
  }) => (
    <div className="form-card form-card-0">
      <h3>
        {isEdit
          ? t("receiptBooks.form.editTitle", { number: receiptBook.number })
          : t("receiptBooks.form.createTitle")}
      </h3>
      {formError && <div className="error-message">{formError}</div>}
      <div className="form-group">
        <label htmlFor={isEdit ? "editNumber" : "newNumber"}>
          {t("receiptBooks.form.labels.number")}
        </label>
        <input
          id={isEdit ? "editNumber" : "newNumber"}
          type="text"
          value={receiptBook.number || ""}
          onChange={handleNumberChange}
          onBlur={handleNumberBlur}
          maxLength={6}
          pattern="[0-9]*"
          inputMode="numeric"
          placeholder={t("receiptBooks.form.placeholders.number")}
          aria-label={t("receiptBooks.form.placeholders.number")}
        />
      </div>
      <div className="form-group">
        <label htmlFor={isEdit ? "editType" : "newType"}>{t("receiptBooks.form.labels.type")}</label>
        <select
          id={isEdit ? "editType" : "newType"}
          value={receiptBook.typeID || ""}
          onChange={(e) => setReceiptBook({ ...receiptBook, typeID: e.target.value })}
          aria-label={t("receiptBooks.form.placeholders.type")}
        >
          {!isEdit && (
            <option value="" disabled>
              {t("receiptBooks.form.placeholders.type")}
            </option>
          )}
          {receiptBookTypes.map((type) => (
            <option key={type.typeID} value={type.typeID}>
              {type.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-actions">
        <button
          className="action-button"
          onClick={handleSubmit}
          aria-label={t(isEdit ? "receiptBooks.actions.aria.save" : "receiptBooks.actions.aria.create")}
        >
          {t(isEdit ? "receiptBooks.actions.save" : "receiptBooks.actions.create")}
        </button>
        <button
          className="back-button"
          onClick={handleCancel}
          aria-label={t("receiptBooks.actions.aria.cancel")}
        >
          {t("receiptBooks.actions.cancel")}
        </button>
      </div>
    </div>
  ),
  (prevProps, nextProps) =>
    prevProps.isEdit === nextProps.isEdit &&
    prevProps.receiptBook === nextProps.receiptBook &&
    prevProps.receiptBookTypes === nextProps.receiptBookTypes &&
    prevProps.formError === nextProps.formError &&
    prevProps.handleSubmit === nextProps.handleSubmit &&
    prevProps.handleCancel === nextProps.handleCancel &&
    prevProps.handleNumberChange === nextProps.handleNumberChange &&
    prevProps.handleNumberBlur === nextProps.handleNumberBlur
);

// Memoized ReceiptBookTypesList Component
const ReceiptBookTypesList: React.FC<{
  receiptBookTypes: ReceiptBookType[];
  userPermissions: Record<string, boolean>;
  t: (key: string, options?: Record<string, unknown>) => string;
  handleEditType: (type: ReceiptBookType) => void;
  handleDeleteType: (typeID: string) => void;
}> = memo(
  ({ receiptBookTypes, userPermissions, t, handleEditType, handleDeleteType }) => (
    <div className="table-card">
      <h2>{t("receiptBooks.types.title.list")}</h2>
      <div className="table-container">
        <div className="table-head">
          <div className="table-row-0 table-row-1 table-row-3">
            <div className="table-cell">{t("receiptBooks.types.table.headers.name")}</div>
            <div className="table-cell">{t("receiptBooks.types.table.headers.actions")}</div>
          </div>
        </div>
        <div className="table-body">
          {receiptBookTypes.length > 0 ? (
            receiptBookTypes.map((type) => (
              <div key={type.typeID} className="table-row-0 table-row-1 table-row-3">
                <div className="table-cell">{type.name}</div>
                <div className="table-cell actions">
                  {userPermissions.canManageTypes && (
                    <>
                      <button
                        onClick={() => handleEditType(type)}
                        aria-label={t("receiptBooks.types.actions.aria.edit", { name: type.name })}
                      >
                        <FaEdit aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDeleteType(type.typeID)}
                        aria-label={t("receiptBooks.types.actions.aria.delete", { name: type.name })}
                      >
                        <FaTrash aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div>
              <div className="table-cell">{t("receiptBooks.types.table.noData")}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  ),
  (prevProps, nextProps) =>
    prevProps.receiptBookTypes === nextProps.receiptBookTypes &&
    prevProps.userPermissions === nextProps.userPermissions &&
    prevProps.handleEditType === nextProps.handleEditType &&
    prevProps.handleDeleteType === nextProps.handleDeleteType
);

// Memoized ReceiptBookTypeForm Component
const ReceiptBookTypeForm: React.FC<{
  isEdit: boolean;
  receiptBookType: Partial<ReceiptBookType>;
  setReceiptBookType: (type: Partial<ReceiptBookType>) => void;
  formError: string | null;
  t: (key: string, options?: Record<string, unknown>) => string;
  handleSubmit: () => void;
  handleCancel: () => void;
}> = memo(
  ({ isEdit, receiptBookType, setReceiptBookType, formError, t, handleSubmit, handleCancel }) => (
    <div className="form-card form-card-0">
      <h3>
        {isEdit
          ? t("receiptBooks.types.form.editTitle", { name: receiptBookType.name })
          : t("receiptBooks.types.form.createTitle")}
      </h3>
      {formError && <div className="error-message">{formError}</div>}
      <div className="form-group">
        <label htmlFor={isEdit ? "editTypeName" : "newTypeName"}>
          {t("receiptBooks.types.form.labels.name")}
        </label>
        <input
          id={isEdit ? "editTypeName" : "newTypeName"}
          type="text"
          value={receiptBookType.name || ""}
          onChange={(e) => setReceiptBookType({ ...receiptBookType, name: e.target.value })}
          placeholder={t("receiptBooks.types.form.placeholders.name")}
          aria-label={t("receiptBooks.types.form.placeholders.name")}
        />
      </div>
      <div className="form-actions">
        <button
          className="action-button"
          onClick={handleSubmit}
          aria-label={t(isEdit ? "receiptBooks.types.actions.aria.save" : "receiptBooks.types.actions.aria.create")}
        >
          {t(isEdit ? "receiptBooks.types.actions.save" : "receiptBooks.types.actions.create")}
        </button>
        <button
          className="back-button"
          onClick={handleCancel}
          aria-label={t("receiptBooks.types.actions.aria.cancel")}
        >
          {t("receiptBooks.types.actions.cancel")}
        </button>
      </div>
    </div>
  ),
  (prevProps, nextProps) =>
    prevProps.isEdit === nextProps.isEdit &&
    prevProps.receiptBookType === nextProps.receiptBookType &&
    prevProps.formError === nextProps.formError &&
    prevProps.handleSubmit === nextProps.handleSubmit &&
    prevProps.handleCancel === nextProps.handleCancel
);

// Skeleton Component for loading state
const ReceiptBooksSkeleton: React.FC = () => (
  <div className="table-card" aria-busy="true">
    <h2>{t("receiptBooks.title.list")}</h2>
    <div className="table-container">
      <div className="table-head">
        <div className="table-row-0 table-row-1">
          <div className="table-cell">{t("receiptBooks.table.headers.number")}</div>
          <div className="table-cell">{t("receiptBooks.table.headers.type")}</div>
          <div className="table-cell">{t("receiptBooks.table.headers.bookStatus")}</div>
          <div className="table-cell">{t("receiptBooks.table.headers.stubStatus")}</div>
          <div className="table-cell">{t("receiptBooks.table.headers.holder")}</div>
          <div className="table-cell">{t("receiptBooks.table.headers.qrCode")}</div>
          <div className="table-cell">{t("receiptBooks.table.headers.actions")}</div>
        </div>
      </div>
      <div className="table-body">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className="table-row-0 table-row-1">
            <div className="table-cell">
              <div className="custom-skeleton" />
            </div>
            <div className="table-cell">
              <div className="custom-skeleton" />
            </div>
            <div className="table-cell">
              <div className="custom-skeleton" />
            </div>
            <div className="table-cell">
              <div className="custom-skeleton" />
            </div>
            <div className="table-cell">
              <div className="custom-skeleton" />
            </div>
            <div className="table-cell">
              <div className="custom-skeleton" />
            </div>
            <div className="table-cell">
              <div className="custom-skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Skeleton Component for Types loading state
const ReceiptBookTypesSkeleton: React.FC = () => (
  <div className="table-card" aria-busy="true">
    <h2>{t("receiptBooks.types.title.list")}</h2>
    <div className="table-container">
      <div className="table-head">
        <div className="table-row-0 table-row-1 table-row-3">
          <div className="table-cell">{t("receiptBooks.types.table.headers.name")}</div>
          <div className="table-cell">{t("receiptBooks.types.table.headers.actions")}</div>
        </div>
      </div>
      <div className="table-body">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className="table-row-0 table-row-1 table-row-3">
            <div className="table-cell">
              <div className="custom-skeleton" />
            </div>
            <div className="table-cell">
              <div className="custom-skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Main Component
const ReceiptBooks: React.FC = memo(() => {
  const navigate = useNavigate();
  const { effectivePermissions, userRoles, permissionsLoaded, user } = useAuth();
  const { t } = useTranslation();

  // State
  const [receiptBooksCache, setReceiptBooksCache] = useState<ReceiptBooksCache>({
    data: [],
    totalCount: 0,
    totalPages: 0,
    timestamp: 0,
  });
  const [receiptBookTypesCache, setReceiptBookTypesCache] = useState<ReceiptBookTypesCache>({
    data: [],
    timestamp: 0,
  });
  const [view, setView] = useState<"list" | "create" | "edit" | "types" | "createType" | "editType" | "bulkUpload">(
    "list"
  );
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"number" | "holder" | "bookStatus" | "stubStatus" | "type">("number");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [newReceiptBook, setNewReceiptBook] = useState<Partial<ReceiptBook>>({});
  const [editReceiptBook, setEditReceiptBook] = useState<ReceiptBook | null>(null);
  const [newReceiptBookType, setNewReceiptBookType] = useState<Partial<ReceiptBookType>>({});
  const [editReceiptBookType, setEditReceiptBookType] = useState<ReceiptBookType | null>(null);
  const [loading, setLoading] = useState(false);
  const [typesLoading, setTypesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);

  const currentUserID = user?.userID;

  // Permissions and Capabilities
  const userPermissions = useMemo(
    () => ({
      canView: effectivePermissions?.some((p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOKS) || false,
      canViewDetails: effectivePermissions?.some((p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_DETAILS) || false,
      canViewHistory: effectivePermissions?.some((p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_HISTORY) || false,
      canCreate: effectivePermissions?.some((p) => p.name === PERMISSIONS.CREATE_RECEIPT_BOOKS) || false,
      canUpdate: effectivePermissions?.some((p) => p.name === PERMISSIONS.UPDATE_RECEIPT_BOOKS) || false,
      canDelete: effectivePermissions?.some((p) => p.name === PERMISSIONS.DELETE_RECEIPT_BOOKS) || false,
      canTransfer: effectivePermissions?.some((p) => p.name === PERMISSIONS.TRANSFER_RECEIPT_BOOKS) || false,
      canViewTypes: effectivePermissions?.some((p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_TYPES) || false,
      canManageTypes: effectivePermissions?.some((p) => p.name === PERMISSIONS.MANAGE_RECEIPT_BOOK_TYPES) || false,
    }),
    [effectivePermissions]
  );

  const userCapabilities = useMemo(
    () => ({
      isSupervisorLike: userRoles?.some((role) => role.name === ROLES.SUPERVISOR) || false,
      isStockManagerLike: userRoles?.some((role) => role.name === ROLES.STOCK_MANAGER) || false,
      isRegionalManagerLike: userRoles?.some((role) => role.name === ROLES.REGIONAL_MANAGER) || false,
      isPurchaseTeamLike: userRoles?.some((role) => role.name === ROLES.PURCHASE_TEAM) || false,
    }),
    [userRoles]
  );

  // Debounced search handler
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        setSearchQuery(query);
        setCurrentPage(1);
      }, SEARCH_DEBOUNCE_MS),
    []
  );

  // Handle input change
  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchInput(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Fetch Receipt Books
  const fetchReceiptBooks = useCallback(async () => {
    if (!userPermissions.canView || !permissionsLoaded || !user) {
      return;
    }
    setLoading(true);
    try {
      const response = await getAllReceiptBooks(
        currentPage,
        ITEMS_PER_PAGE,
        sortField,
        sortOrder.toUpperCase() as 'ASC' | 'DESC',
        searchQuery,
        filterType,
        filterStatus
      );
      let filteredBooks = response.books.map((receipt: ReceiptBook) => ({
        ...receipt,
        qrCode: `data:image/png;base64,${receipt.qrCode}`,
      }));

      // Apply role-based filtering
      if (userCapabilities.isSupervisorLike) {
        filteredBooks = filteredBooks.filter((r: { currentHolderID: string | undefined; }) => r.currentHolderID === currentUserID);
      }
      if (userCapabilities.isRegionalManagerLike) {
        filteredBooks = filteredBooks.filter((r: { currentHolderID: string | undefined; }) => r.currentHolderID === currentUserID);
      }
      if (userCapabilities.isStockManagerLike) {
        filteredBooks = filteredBooks.filter((r: { status: string; }) =>
          ["In Stock", "With Stock Manager", "Archived"].includes(r.status)
        );
      }
      if (userCapabilities.isPurchaseTeamLike) {
        filteredBooks = filteredBooks.filter((r: { status: string; }) => r.status !== "Archived");
      }

      setReceiptBooksCache({
        data: filteredBooks,
        totalCount: response.totalCount,
        totalPages: response.totalPages,
        timestamp: Date.now(),
      });
      setError(null);
    } catch {
      setError(t("receiptBooks.errors.fetchFailed"));
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    sortField,
    sortOrder,
    searchQuery,
    filterType,
    filterStatus,
    userPermissions.canView,
    permissionsLoaded,
    user,
    userCapabilities,
    t,
  ]);

  // Fetch Receipt Book Types
  const fetchReceiptBookTypes = useCallback(async (force = false) => {
    if (!userPermissions.canViewTypes || !permissionsLoaded || !user) {
      return;
    }
    if (!force && receiptBookTypesCache.timestamp > 0 && Date.now() - receiptBookTypesCache.timestamp < CACHE_DURATION) {
      setTypesLoading(false);
      return;
    }
    setTypesLoading(true);
    try {
      const typesData = await getAllReceiptBookTypes();
      setReceiptBookTypesCache({ data: typesData, timestamp: Date.now() });
      setError(null);
    } catch {
      setReceiptBookTypesCache((prev) => ({ ...prev, timestamp: Date.now() }));
      setError(t("receiptBooks.types.errors.fetchFailed"));
    } finally {
      setTypesLoading(false);
    }
  }, [userPermissions.canViewTypes, permissionsLoaded, user, receiptBookTypesCache.timestamp, t]);

  // Initial fetches
  useEffect(() => {
    fetchReceiptBooks();
  }, [fetchReceiptBooks]);

  useEffect(() => {
    fetchReceiptBookTypes(false);
  }, [fetchReceiptBookTypes]);

  // Real-Time Updates
  useEffect(() => {
    const handleReceiptBookEvent = async (event: string) => {
      if (event.startsWith("receipt_book:")) {
        await fetchReceiptBooks();
      }
    };

    onNotification(handleReceiptBookEvent);
    return () => offNotification();
  }, [fetchReceiptBooks]);

  // Handlers
  const handleCreate = useCallback(async () => {
    if (!userPermissions.canCreate) return;
    const paddedNumber = padNumber(newReceiptBook.number || "");
    try {
      if (!paddedNumber || !newReceiptBook.typeID || paddedNumber.length !== 6) {
        setFormError(t("receiptBooks.errors.requiredFields"));
        return;
      }
      const createdReceipt = await createReceiptBook({ number: paddedNumber, typeID: newReceiptBook.typeID });
      setReceiptBooksCache((prev) => ({
        ...prev,
        data: [...prev.data, { ...createdReceipt, qrCode: `data:image/png;base64,${createdReceipt.qrCode}` }],
      }));
      setNewReceiptBook({});
      setView("list");
    } catch (error) {
      setFormError(t("receiptBooks.errors.createFailed", { message: error }));
    }
  }, [newReceiptBook, userPermissions.canCreate, t]);

  const handleUpdate = useCallback(async () => {
    if (!userPermissions.canUpdate || !editReceiptBook) return;
    const paddedNumber = padNumber(editReceiptBook.number);
    try {
      if (!paddedNumber || !editReceiptBook.typeID || paddedNumber.length !== 6) {
        setFormError(t("receiptBooks.errors.requiredFields"));
        return;
      }
      const updatedReceipt = await updateReceiptBook(editReceiptBook.bookID, {
        ...editReceiptBook,
        number: paddedNumber,
      });
      setReceiptBooksCache((prev) => ({
        ...prev,
        data: prev.data.map((r) =>
          r.bookID === updatedReceipt.bookID
            ? { ...updatedReceipt, qrCode: `data:image/png;base64,${updatedReceipt.qrCode}` }
            : r
        ),
      }));
      setEditReceiptBook(null);
      setView("list");
    } catch (error) {
      setFormError(t("receiptBooks.errors.updateFailed", { message: error }));
    }
  }, [editReceiptBook, userPermissions.canUpdate, t]);

  const handleDelete = useCallback(
    async (bookID: string) => {
      if (!userPermissions.canDelete || !window.confirm(t("receiptBooks.actions.deleteConfirm"))) return;
      try {
        await deleteReceiptBook(bookID);
        setReceiptBooksCache((prev) => ({
          ...prev,
          data: prev.data.filter((r) => r.bookID !== bookID),
        }));
      } catch (error) {
        setFormError(t("receiptBooks.errors.deleteFailed", { message: error }));
      }
    },
    [userPermissions.canDelete, t]
  );

  const handleTransfer = useCallback(() => {
    if (userPermissions.canTransfer) {
      navigate("/transfer-receipt-books");
    }
  }, [userPermissions.canTransfer, navigate]);

  const handleEdit = useCallback((receipt: ReceiptBook) => {
    setEditReceiptBook(receipt);
    setView("edit");
  }, []);

  const handleCreateType = useCallback(async () => {
    if (!userPermissions.canManageTypes) return;
    try {
      if (!newReceiptBookType.name) {
        setFormError(t("receiptBooks.types.errors.requiredFields"));
        return;
      }
      const createdType = await createReceiptBookType({ name: newReceiptBookType.name });
      setReceiptBookTypesCache((prev) => ({
        data: [...prev.data, createdType],
        timestamp: prev.timestamp,
      }));
      setNewReceiptBookType({});
      setView("types");
    } catch (error) {
      setFormError(t("receiptBooks.types.errors.createFailed", { message: error }));
    }
  }, [newReceiptBookType, userPermissions.canManageTypes, t]);

  const handleUpdateType = useCallback(async () => {
    if (!userPermissions.canManageTypes || !editReceiptBookType) return;
    try {
      if (!editReceiptBookType.name) {
        setFormError(t("receiptBooks.types.errors.requiredFields"));
        return;
      }
      const updatedType = await updateReceiptBookType(editReceiptBookType.typeID, {
        name: editReceiptBookType.name,
      });
      setReceiptBookTypesCache((prev) => ({
        data: prev.data.map((t) => (t.typeID === updatedType.typeID ? updatedType : t)),
        timestamp: prev.timestamp,
      }));
      setEditReceiptBookType(null);
      setView("types");
    } catch (error) {
      setFormError(t("receiptBooks.types.errors.updateFailed", { message: error }));
    }
  }, [editReceiptBookType, userPermissions.canManageTypes, t]);

  const handleDeleteType = useCallback(
    async (typeID: string) => {
      if (!userPermissions.canManageTypes || !window.confirm(t("receiptBooks.types.actions.deleteConfirm"))) return;
      try {
        await deleteReceiptBookType(typeID);
        setReceiptBookTypesCache((prev) => ({
          data: prev.data.filter((t) => t.typeID !== typeID),
          timestamp: prev.timestamp,
        }));
      } catch (error) {
        setFormError(t("receiptBooks.types.errors.deleteFailed", { message: error }));
      }
    },
    [userPermissions.canManageTypes, t]
  );

  const handleEditType = useCallback((type: ReceiptBookType) => {
    setEditReceiptBookType(type);
    setView("editType");
  }, []);

  // Early Returns
  if (!user || !permissionsLoaded) return <ReceiptBooksSkeleton />;
  if (!userPermissions.canView && !userPermissions.canViewTypes) {
    navigate("/access-denied");
    return null;
  }

  // Render
  return (
    <div className="receipt-books" role="main">
      {isBulkUploadModalOpen && (
        <ReceiptBookBulkUploadModal
          isOpen={isBulkUploadModalOpen}
          onClose={() => setIsBulkUploadModalOpen(false)}
          onUploadSuccess={() => {
            fetchReceiptBooks();
            fetchReceiptBookTypes(true);
          }}
          setError={setError}
        />
      )}
      <header className="dashboard-header">
        <h1>
          {view === "list"
            ? t("receiptBooks.title.list")
            : view === "create"
              ? t("receiptBooks.title.create")
              : view === "edit"
                ? t("receiptBooks.title.edit")
                : view === "types"
                  ? t("receiptBooks.types.title.list")
                  : view === "createType"
                    ? t("receiptBooks.types.title.create")
                    : view === "editType"
                      ? t("receiptBooks.types.title.edit")
                      : t("receiptBooks.bulkUpload.title")}
        </h1>
        {(view === "list" || view === "types") && (
          <div className="search-container">
            <FaSearch className="search-icon" aria-hidden="true" />
            <input
              id="searchInput"
              type="text"
              placeholder={t("receiptBooks.search.placeholder")}
              value={searchInput}
              onChange={handleSearchInputChange}
              className="search-input input-0"
              aria-label={t("receiptBooks.search.ariaLabel")}
            />
          </div>
        )}
      </header>
      <section className="dashboard-content">
        <aside className="sidebar">
          <div className="filter-card">
            <h3>{t("receiptBooks.sidebar.manager")}</h3>
            {userPermissions.canCreate && (
              <>
                <button
                  className="action-button-0"
                  onClick={() => setView("create")}
                  aria-label={t("receiptBooks.actions.aria.newReceipt")}
                >
                  <FaPlus aria-hidden="true" /> {t("receiptBooks.actions.newReceipt")}
                </button>
                <button
                  className="action-button-0"
                  onClick={() => setIsBulkUploadModalOpen(true)}
                  aria-label={t("receiptBooks.actions.aria.importBooks")}
                >
                  <FaUpload aria-hidden="true" /> {t("receiptBooks.actions.importBooks")}
                </button>
              </>
            )}
            {userPermissions.canTransfer && (
              <button
                className="action-button-0"
                onClick={handleTransfer}
                aria-label={t("receiptBooks.actions.aria.transferBooks")}
              >
                <FaExchangeAlt aria-hidden="true" /> {t("receiptBooks.actions.transferBooks")}
              </button>
            )}
            {userPermissions.canManageTypes && view === "types" && (
              <button
                className="action-button-0"
                onClick={() => setView("createType")}
                aria-label={t("receiptBooks.types.actions.aria.newType")}
              >
                <FaPlus aria-hidden="true" /> {t("receiptBooks.types.actions.newType")}
              </button>
            )}
          </div>
          {(view === "list" || view === "create" || view === "edit") && (
            <>
              <div className="sort-card">
                <h3>{t("receiptBooks.sort.title")}</h3>
                <div className="form-group">
                  <select
                    id="sortField"
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as "number" | "holder" | "bookStatus" | "stubStatus" | "type")}
                    aria-label={t("receiptBooks.sort.ariaLabel")}
                  >
                    <option value="number">{t("receiptBooks.sort.field.number")}</option>
                    <option value="holder">{t("receiptBooks.sort.field.holder")}</option>
                    <option value="bookStatus">{t("receiptBooks.sort.field.bookStatus")}</option>
                    <option value="stubStatus">{t("receiptBooks.sort.field.stubStatus")}</option>
                    <option value="type">{t("receiptBooks.sort.field.type")}</option>
                  </select>
                </div>
                <button
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  aria-label={t("receiptBooks.sort.ariaLabel")}
                >
                  <FaSort aria-hidden="true" />{" "}
                  {sortOrder === "asc" ? t("receiptBooks.sort.order.asc") : t("receiptBooks.sort.order.desc")}
                </button>
              </div>
              <div className="filter-card">
                <h3>{t("receiptBooks.filter.title")}</h3>
                <div className="form-group">
                  <label htmlFor="filterType">{t("receiptBooks.filter.type.label")}</label>
                  <select
                    id="filterType"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    aria-label={t("receiptBooks.filter.ariaLabel")}
                  >
                    <option value="all">{t("receiptBooks.filter.type.all")}</option>
                    {receiptBookTypesCache.data.map((type) => (
                      <option key={type.typeID} value={type.typeID}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="filterStatus">{t("receiptBooks.filter.status.label")}</label>
                  <select
                    id="filterStatus"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    aria-label={t("receiptBooks.filter.ariaLabel")}
                  >
                    <option value="all">{t("receiptBooks.filter.status.all")}</option>
                    {[
                      "In Stock",
                      "Sent to Supplier",
                      "Collect from Supplier",
                      "With Regional Manager",
                      "With Supervisor",
                      "Stub Collected",
                      "With Stock Manager",
                      "Assigned to Agent",
                      "Archived",
                    ].map((status) => (
                      <option key={status} value={status}>
                        {t(`common.receiptBookStatuses.${status.toLowerCase()}`, { defaultValue: status })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
          <div>
            <button
              className="action-button-0"
              onClick={() => {
                fetchReceiptBooks();
                fetchReceiptBookTypes(true);
              }}
              aria-label={t("receiptBooks.actions.aria.refresh")}
            >
              <FaSyncAlt aria-hidden="true" /> {t("receiptBooks.actions.refresh")}
            </button>
            {userPermissions.canViewTypes && (
              <button
                className="action-button-0"
                onClick={() => setView(view === "types" ? "list" : "types")}
                aria-label={t(
                  view === "types" ? "receiptBooks.actions.aria.viewBooks" : "receiptBooks.actions.aria.viewTypes"
                )}
              >
                <FaList aria-hidden="true" />{" "}
                {t(view === "types" ? "receiptBooks.actions.viewBooks" : "receiptBooks.actions.viewTypes")}
              </button>
            )}
          </div>
        </aside>
        <main className="main-content">
          {view === "list" && (
            <>
              {loading && receiptBooksCache.timestamp === 0 ? (
                <ReceiptBooksSkeleton />
              ) : error ? (
                <div className="error-message" role="alert">
                  {error}
                  <button
                    onClick={fetchReceiptBooks}
                    className="action-button-2"
                    aria-label={t("receiptBooks.actions.aria.retry")}
                  >
                    {t("receiptBooks.actions.retry")}
                  </button>
                </div>
              ) : (
                <>
                  <ReceiptBooksList
                    receiptBooks={receiptBooksCache.data}
                    receiptBookTypes={receiptBookTypesCache.data}
                    userPermissions={userPermissions}
                    t={t}
                    handleEdit={handleEdit}
                    handleDelete={handleDelete}
                    navigate={navigate}
                  />
                  {receiptBooksCache.totalPages > 1 && (
                    <div className="pagination">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        aria-label={t("receiptBooks.pagination.aria.previous")}
                      >
                        {t("receiptBooks.pagination.previous")}
                      </button>
                      <span>
                        {t("receiptBooks.pagination.pageInfo", {
                          currentPage,
                          totalPages: receiptBooksCache.totalPages,
                        })}
                      </span>
                      <button
                        onClick={() => setCurrentPage((p) => p + 1)}
                        disabled={currentPage >= receiptBooksCache.totalPages}
                        aria-label={t("receiptBooks.pagination.aria.next")}
                      >
                        {t("receiptBooks.pagination.next")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {view === "create" && userPermissions.canCreate && (
            <ReceiptBookForm
              isEdit={false}
              receiptBook={newReceiptBook}
              receiptBookTypes={receiptBookTypesCache.data}
              setReceiptBook={setNewReceiptBook}
              formError={formError}
              t={t}
              handleSubmit={handleCreate}
              handleCancel={() => setView("list")}
              handleNumberChange={(e) =>
                setNewReceiptBook({ ...newReceiptBook, number: e.target.value.replace(/\D/g, "").slice(0, 6) })
              }
              handleNumberBlur={(e) => setNewReceiptBook({ ...newReceiptBook, number: padNumber(e.target.value) })}
            />
          )}
          {view === "edit" && editReceiptBook && userPermissions.canUpdate && (
            <ReceiptBookForm
              isEdit={true}
              receiptBook={editReceiptBook}
              receiptBookTypes={receiptBookTypesCache.data}
              setReceiptBook={(book) => setEditReceiptBook(book as ReceiptBook)}
              formError={formError}
              t={t}
              handleSubmit={handleUpdate}
              handleCancel={() => setView("list")}
              handleNumberChange={(e) =>
                setEditReceiptBook({ ...editReceiptBook, number: e.target.value.replace(/\D/g, "").slice(0, 6) })
              }
              handleNumberBlur={(e) => setEditReceiptBook({ ...editReceiptBook, number: padNumber(e.target.value) })}
            />
          )}
          {view === "types" && userPermissions.canViewTypes && (
            <>
              {typesLoading && receiptBookTypesCache.timestamp === 0 ? (
                <ReceiptBookTypesSkeleton />
              ) : error ? (
                <div className="error-message" role="alert">
                  {error}
                  <button
                    onClick={() => fetchReceiptBookTypes(true)}
                    className="action-button-2"
                    aria-label={t("receiptBooks.types.actions.aria.retry")}
                  >
                    {t("receiptBooks.types.actions.retry")}
                  </button>
                </div>
              ) : (
                <ReceiptBookTypesList
                  receiptBookTypes={receiptBookTypesCache.data}
                  userPermissions={userPermissions}
                  t={t}
                  handleEditType={handleEditType}
                  handleDeleteType={handleDeleteType}
                />
              )}
            </>
          )}
          {view === "createType" && userPermissions.canManageTypes && (
            <ReceiptBookTypeForm
              isEdit={false}
              receiptBookType={newReceiptBookType}
              setReceiptBookType={setNewReceiptBookType}
              formError={formError}
              t={t}
              handleSubmit={handleCreateType}
              handleCancel={() => setView("types")}
            />
          )}
          {view === "editType" && editReceiptBookType && userPermissions.canManageTypes && (
            <ReceiptBookTypeForm
              isEdit={true}
              receiptBookType={editReceiptBookType}
              setReceiptBookType={(type) => setEditReceiptBookType(type as ReceiptBookType)}
              formError={formError}
              t={t}
              handleSubmit={handleUpdateType}
              handleCancel={() => setView("types")}
            />
          )}
        </main>
      </section>
    </div>
  );
});

ReceiptBooks.displayName = "ReceiptBooks";
export default ReceiptBooks;