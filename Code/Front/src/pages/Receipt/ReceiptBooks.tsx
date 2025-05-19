/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
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
  FaSyncAlt
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
import { getUserById } from "../../apis/userAPI";
import { getAgentById } from "../../apis/agentAPI";
import { useTranslation } from "react-i18next";
import { debounce } from "lodash";
import { t } from "i18next";
import ReceiptBookBulkUploadModal from "./ReceiptBookBulkUploadModal";
import "./ReceiptBooks.css";
import "../Admin/AdminDashboard.css";

// Constants for permissions and roles
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

// Roles for user capabilities
const ROLES = {
  SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
  STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
  REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
  PURCHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
  SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
};

// Pagination and caching constants
const ITEMS_PER_PAGE = 10;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache duration
const SKELETON_ROWS = 10;

// Interfaces for TypeScript
interface HolderCache {
  data: Map<string, string>;
  timestamp: number;
}

interface ReceiptBooksCache {
  data: ReceiptBook[];
  timestamp: number;
}

interface ReceiptBookTypesCache {
  data: ReceiptBookType[];
  timestamp: number;
}

// Utility function to pad numbers to 6 digits
const padNumber = (value: string): string => {
  const numericValue = value.replace(/\D/g, "");
  if (numericValue.length > 6) return numericValue.slice(0, 6);
  return numericValue.padStart(6, "0");
};

// Memoized Receipt Books List Component
const ReceiptBooksList: React.FC<{
  paginatedReceiptBooks: ReceiptBook[];
  receiptBookTypes: ReceiptBookType[];
  userPermissions: Record<string, boolean>;
  holdersMap: Map<string, string>;
  t: (key: string, options?: Record<string, unknown>) => string;
  handleEdit: (receipt: ReceiptBook) => void;
  handleDelete: (bookID: string) => void;
  navigate: (path: string) => void;
}> = memo(
  ({
    paginatedReceiptBooks,
    receiptBookTypes,
    userPermissions,
    holdersMap,
    t,
    handleEdit,
    handleDelete,
    navigate,
  }) => (
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
          {paginatedReceiptBooks.length > 0 ? (
            paginatedReceiptBooks.map((receipt) => {
              const type = receiptBookTypes.find((t) => t.typeID === receipt.typeID);
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
                  <div className="table-cell">
                    {receipt.agentID ? (
                      holdersMap.has(receipt.agentID) ? (
                        holdersMap.get(receipt.agentID)
                      ) : (
                        <div className="custom-skeleton" style={{ width: "100px" }} />
                      )
                    ) : receipt.currentHolderID ? (
                      holdersMap.has(receipt.currentHolderID) ? (
                        holdersMap.get(receipt.currentHolderID)
                      ) : (
                        <div className="custom-skeleton" style={{ width: "100px" }} />
                      )
                    ) : (
                      t("receiptBooks.table.na")
                    )}
                  </div>
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
    prevProps.paginatedReceiptBooks === nextProps.paginatedReceiptBooks &&
    prevProps.receiptBookTypes === nextProps.receiptBookTypes &&
    prevProps.userPermissions === nextProps.userPermissions &&
    prevProps.holdersMap === nextProps.holdersMap &&
    prevProps.handleEdit === nextProps.handleEdit &&
    prevProps.handleDelete === nextProps.handleDelete &&
    prevProps.navigate === nextProps.navigate
);

// Memoized Receipt Book Form Component
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
        <label htmlFor={isEdit ? "editType" : "newType"}>
          {t("receiptBooks.form.labels.type")}
        </label>
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
          className="action-button-0"
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

// Memoized Receipt Book Types List Component
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

// Memoized Receipt Book Type Form Component
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
          className="action-button-0"
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

  // State declarations
  const [receiptBooksCache, setReceiptBooksCache] = useState<ReceiptBooksCache>({
    data: [],
    timestamp: 0,
  });
  const [receiptBookTypesCache, setReceiptBookTypesCache] = useState<ReceiptBookTypesCache>({
    data: [],
    timestamp: 0,
  });
  const [view, setView] = useState<"list" | "create" | "edit" | "types" | "createType" | "editType" | "bulkUpload">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"number" | "typeID" | "status">("number");
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
  const [holdersCache, setHoldersCache] = useState<HolderCache>({
    data: new Map(),
    timestamp: 0,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);

  const currentUserID = user?.userID;

  // Memoized permissions
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

  // Memoized user roles
  const userCapabilities = useMemo(
    () => ({
      isSupervisorLike: userRoles?.some((role) => role.name === ROLES.SUPERVISOR) || false,
      isStockManagerLike: userRoles?.some((role) => role.name === ROLES.STOCK_MANAGER) || false,
      isRegionalManagerLike: userRoles?.some((role) => role.name === ROLES.REGIONAL_MANAGER) || false,
      isPurchaseTeamLike: userRoles?.some((role) => role.name === ROLES.PURCHASE_TEAM) || false,
    }),
    [userRoles]
  );

  // Debounced search query
  const debouncedSetSearchQuery = useCallback(debounce((value: string) => setSearchQuery(value), 300), []);

  // Effect to fetch receipt books
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      // Skip fetching if conditions aren't met
      if (
        !userPermissions.canView ||
        !permissionsLoaded ||
        !user ||
        (receiptBooksCache.data.length >= 0 && Date.now() - receiptBooksCache.timestamp < CACHE_DURATION) // Allow empty cache to be valid
      ) {
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const receiptsData = (await getAllReceiptBooks()) || []; // Fallback to empty array
        let filteredBooks = receiptsData.map((receipt) => ({
          ...receipt,
          qrCode: `data:image/png;base64,${receipt.qrCode}`,
        }));

        // Apply role-based filtering
        if (userCapabilities.isSupervisorLike) {
          filteredBooks = filteredBooks.filter((r) => r.currentHolderID === currentUserID);
        }
        if (userCapabilities.isRegionalManagerLike) {
          filteredBooks = filteredBooks.filter((r) => r.currentHolderID === currentUserID);
        }
        if (userCapabilities.isStockManagerLike) {
          filteredBooks = filteredBooks.filter((r) =>
            [
              t("common.receiptBookStatuses.inStock"),
              t("common.receiptBookStatuses.withStockManager"),
              t("common.receiptBookStatuses.archived"),
            ].includes(r.status)
          );
        }
        if (userCapabilities.isPurchaseTeamLike) {
          filteredBooks = filteredBooks.filter((r) => r.status !== t("common.receiptBookStatuses.archived"));
        }

        if (isMounted) {
          setReceiptBooksCache({
            data: filteredBooks,
            timestamp: filteredBooks.length > 0 ? Date.now() : receiptBooksCache.timestamp, // Only update timestamp if data is non-empty
          });
          setFormError(null);
        }
      } catch (error) {
        console.error("Failed to fetch receipt books:", error);
        if (isMounted) {
          setError(t("receiptBooks.errors.fetchFailed"));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [
    userPermissions.canView,
    userCapabilities.isSupervisorLike,
    userCapabilities.isStockManagerLike,
    userCapabilities.isRegionalManagerLike,
    userCapabilities.isPurchaseTeamLike,
    currentUserID,
    permissionsLoaded,
    t,
    user,
    receiptBooksCache.timestamp,
  ]);

  // Effect to fetch receipt book types
  useEffect(() => {
    let isMounted = true;
    const fetchTypes = async () => {
      // Skip fetching if conditions aren't met
      if (
        !userPermissions.canViewTypes ||
        !permissionsLoaded ||
        !user ||
        (receiptBookTypesCache.data.length >= 0 && Date.now() - receiptBookTypesCache.timestamp < CACHE_DURATION) // Allow empty cache to be valid
      ) {
        setTypesLoading(false);
        setError(null);
        return;
      }

      setTypesLoading(true);
      setError(null);
      try {
        const typesData = (await getAllReceiptBookTypes()) || []; // Fallback to empty array
        if (isMounted) {
          setReceiptBookTypesCache({
            data: typesData,
            timestamp: typesData.length > 0 ? Date.now() : receiptBookTypesCache.timestamp, // Only update timestamp if data is non-empty
          });
          setFormError(null);
        }
      } catch (error) {
        console.error("Failed to fetch receipt book types:", error);
        if (isMounted) {
          setError(t("receiptBooks.types.errors.fetchFailed"));
        }
      } finally {
        if (isMounted) {
          setTypesLoading(false);
        }
      }
    };
    fetchTypes();
    return () => {
      isMounted = false;
    };
  }, [
    userPermissions.canViewTypes,
    permissionsLoaded,
    user,
    receiptBookTypesCache.timestamp,
    t,
  ]);

  // Effect to fetch holders
  useEffect(() => {
    let isMounted = true;
    const fetchHolders = async () => {
      if (Date.now() - holdersCache.timestamp < CACHE_DURATION || receiptBooksCache.data.length === 0) {
        return; // Skip if cache is fresh or no receipt books
      }

      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      const currentReceipts = receiptBooksCache.data.slice(start, end);

      const uniqueUserIDs = Array.from(new Set(currentReceipts.map((r) => r.currentHolderID).filter((id) => id)));
      const uniqueAgentIDs = Array.from(new Set(currentReceipts.map((r) => r.agentID).filter((id) => id)));

      const newHoldersMap = new Map<string, string>(holdersCache.data);
      let hasChanges = false;

      for (const userID of uniqueUserIDs) {
        if (userID && !newHoldersMap.has(userID)) {
          try {
            const userData = await getUserById(userID);
            newHoldersMap.set(userID, `${userData.firstname} ${userData.lastname}`);
            hasChanges = true;
          } catch (error) {
            console.error(`Failed to fetch user ${userID}:`, error);
            newHoldersMap.set(userID, "");
            hasChanges = true;
          }
        }
      }

      for (const agentID of uniqueAgentIDs) {
        if (agentID && !newHoldersMap.has(agentID)) {
          try {
            const agentData = await getAgentById(agentID);
            newHoldersMap.set(agentID, `${agentData!.name} ${agentData!.lastname}`);
            hasChanges = true;
          } catch (error) {
            console.error(`Failed to fetch agent ${agentID}:`, error);
            newHoldersMap.set(agentID, "");
            hasChanges = true;
          }
        }
      }

      if (hasChanges && isMounted) {
        setHoldersCache({
          data: newHoldersMap,
          timestamp: Date.now(),
        });
      }
    };

    fetchHolders();
    return () => {
      isMounted = false;
    };
  }, [receiptBooksCache.data, currentPage, holdersCache.timestamp, t]);

  // Memoized unique types for filters
  useMemo(() => Array.from(new Set(receiptBooksCache.data.map((r) => r.typeID))), [receiptBooksCache.data]);

  // Memoized unique statuses for filters
  const uniqueStatuses = useMemo(
    () => Array.from(new Set(receiptBooksCache.data.map((r) => r.status))),
    [receiptBooksCache.data]
  );

  // Memoized filtered receipt books
  const filteredReceiptBooks = useMemo(() => {
    let result = receiptBooksCache.data.filter(
      (r) =>
        r.number.toString().includes(searchQuery) ||
        receiptBookTypesCache.data.some(
          (t) => t.typeID === r.typeID && t.name.toLowerCase().includes(searchQuery.toLowerCase())
        ) ||
        r.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filterType !== "all") result = result.filter((r) => r.typeID === filterType);
    if (filterStatus !== "all") result = result.filter((r) => r.status === filterStatus);
    result.sort((a, b) => {
      const fieldA =
        sortField === "number"
          ? a.number
          : sortField === "typeID"
            ? receiptBookTypesCache.data.find((t) => t.typeID === a.typeID)?.name || ""
            : a.status;
      const fieldB =
        sortField === "number"
          ? b.number
          : sortField === "typeID"
            ? receiptBookTypesCache.data.find((t) => t.typeID === b.typeID)?.name || ""
            : b.status;
      return sortOrder === "asc" ? (fieldA > fieldB ? 1 : -1) : fieldA < fieldB ? 1 : -1;
    });
    return result;
  }, [
    receiptBooksCache.data,
    receiptBookTypesCache.data,
    searchQuery,
    sortField,
    sortOrder,
    filterType,
    filterStatus,
  ]);

  // Memoized total pages for pagination
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredReceiptBooks.length / ITEMS_PER_PAGE)),
    [filteredReceiptBooks.length]
  );

  // Memoized paginated receipt books
  const paginatedReceiptBooks = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredReceiptBooks.slice(start, end);
  }, [filteredReceiptBooks, currentPage]);

  // Handlers for receipt books
  const handleNumberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
      const numericValue = e.target.value.replace(/\D/g, "").slice(0, 6);
      if (isEdit && editReceiptBook) {
        setEditReceiptBook({ ...editReceiptBook, number: numericValue });
      } else {
        setNewReceiptBook((prev) => ({ ...prev, number: numericValue }));
      }
    },
    [editReceiptBook]
  );

  const handleNumberBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>, isEdit: boolean) => {
      const paddedValue = padNumber(e.target.value);
      if (isEdit && editReceiptBook) {
        setEditReceiptBook({ ...editReceiptBook, number: paddedValue });
      } else {
        setNewReceiptBook((prev) => ({ ...prev, number: paddedValue }));
      }
    },
    [editReceiptBook]
  );

  const handleCreate = useCallback(async () => {
    if (!userPermissions.canCreate) return;
    setFormError(null);
    const paddedNumber = padNumber(newReceiptBook.number || "");
    try {
      if (!paddedNumber || !newReceiptBook.typeID) {
        setFormError(t("receiptBooks.errors.requiredFields"));
        return;
      }
      if (paddedNumber.length !== 6) {
        setFormError(t("receiptBooks.errors.invalidNumber"));
        return;
      }
      const createdReceipt = await createReceiptBook({
        number: paddedNumber,
        typeID: newReceiptBook.typeID,
      });
      const transformedReceipt = {
        ...createdReceipt,
        qrCode: `data:image/png;base64,${createdReceipt.qrCode}`,
      };
      setReceiptBooksCache((prev) => ({
        data: [...prev.data, transformedReceipt],
        timestamp: prev.timestamp,
      }));
      setNewReceiptBook({});
      setView("list");
    } catch (error) {
      setFormError(
        t("receiptBooks.errors.createFailed", {
          message: error instanceof Error ? error.message : t("receiptBooks.errors.unknown"),
        })
      );
    }
  }, [newReceiptBook, userPermissions.canCreate, t]);

  const handleUpdate = useCallback(async () => {
    if (!userPermissions.canUpdate || !editReceiptBook) return;
    setFormError(null);
    const paddedNumber = padNumber(editReceiptBook.number);
    try {
      if (!paddedNumber || !editReceiptBook.typeID) {
        setFormError(t("receiptBooks.errors.requiredFields"));
        return;
      }
      if (paddedNumber.length !== 6) {
        setFormError(t("receiptBooks.errors.invalidNumber"));
        return;
      }
      const updatedReceipt = await updateReceiptBook(editReceiptBook.bookID, {
        ...editReceiptBook,
        number: paddedNumber,
      });
      const transformedReceipt = {
        ...updatedReceipt,
        qrCode: `data:image/png;base64,${updatedReceipt.qrCode}`,
      };
      setReceiptBooksCache((prev) => ({
        data: prev.data.map((r) => (r.bookID === updatedReceipt.bookID ? transformedReceipt : r)),
        timestamp: prev.timestamp,
      }));
      setEditReceiptBook(null);
      setView("list");
    } catch (error) {
      setFormError(
        t("receiptBooks.errors.updateFailed", {
          message: error instanceof Error ? error.message : t("receiptBooks.errors.unknown"),
        })
      );
    }
  }, [editReceiptBook, userPermissions.canUpdate, t]);

  const handleDelete = useCallback(
    async (bookID: string) => {
      if (!userPermissions.canDelete) return;
      if (!window.confirm(t("receiptBooks.actions.deleteConfirm"))) return;
      try {
        await deleteReceiptBook(bookID);
        setReceiptBooksCache((prev) => ({
          data: prev.data.filter((r) => r.bookID !== bookID),
          timestamp: prev.timestamp,
        }));
        setFormError(null);
      } catch (error) {
        setFormError(
          t("receiptBooks.errors.deleteFailed", {
            message: error instanceof Error ? error.message : t("receiptBooks.errors.unknown"),
          })
        );
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

  // Handlers for receipt book types
  const handleCreateType = useCallback(async () => {
    if (!userPermissions.canManageTypes) return;
    setFormError(null);
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
      setFormError(
        t("receiptBooks.types.errors.createFailed", {
          message: error instanceof Error ? error.message : t("receiptBooks.types.errors.unknown"),
        })
      );
    }
  }, [newReceiptBookType, userPermissions.canManageTypes, t]);

  const handleUpdateType = useCallback(async () => {
    if (!userPermissions.canManageTypes || !editReceiptBookType) return;
    setFormError(null);
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
      setFormError(
        t("receiptBooks.types.errors.updateFailed", {
          message: error instanceof Error ? error.message : t("receiptBooks.types.errors.unknown"),
        })
      );
    }
  }, [editReceiptBookType, userPermissions.canManageTypes, t]);

  const handleDeleteType = useCallback(
    async (typeID: string) => {
      if (!userPermissions.canManageTypes) return;
      if (!window.confirm(t("receiptBooks.types.actions.deleteConfirm"))) return;
      try {
        await deleteReceiptBookType(typeID);
        setReceiptBookTypesCache((prev) => ({
          data: prev.data.filter((t) => t.typeID !== typeID),
          timestamp: prev.timestamp,
        }));
        setFormError(null);
      } catch (error) {
        setFormError(
          t("receiptBooks.types.errors.deleteFailed", {
            message: error instanceof Error ? error.message : t("receiptBooks.types.errors.unknown"),
          })
        );
      }
    },
    [userPermissions.canManageTypes, t]
  );

  const handleEditType = useCallback((type: ReceiptBookType) => {
    setEditReceiptBookType(type);
    setView("editType");
  }, []);

  // Early returns
  if (!user) {
    return <div>{t("receiptBooks.errors.unknown")}</div>;
  }

  if (!permissionsLoaded) {
    return view === "types" || view === "createType" || view === "editType" ? (
      <ReceiptBookTypesSkeleton />
    ) : (
      <ReceiptBooksSkeleton />
    );
  }

  if (!userPermissions.canView && !userPermissions.canViewTypes) {
    navigate("/access-denied");
    return null;
  }

  // Main render
  return (
    <div className="receipt-books" role="main">
      {isBulkUploadModalOpen && (
        <ReceiptBookBulkUploadModal
          isOpen={isBulkUploadModalOpen}
          onClose={() => setIsBulkUploadModalOpen(false)}
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
              value={searchQuery}
              onChange={(e) => debouncedSetSearchQuery(e.target.value)}
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
          {(view === "list" || view === "create" || view === "edit" || view === "bulkUpload") && (
            <>
              <div className="sort-card">
                <h3>{t("receiptBooks.sort.title")}</h3>
                <select
                  id="sortField"
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as "number" | "typeID" | "status")}
                  aria-label={t("receiptBooks.sort.ariaLabel")}
                >
                  <option value="number">{t("receiptBooks.sort.fields.number")}</option>
                  <option value="typeID">{t("receiptBooks.sort.fields.type")}</option>
                  <option value="status">{t("receiptBooks.sort.fields.status")}</option>
                </select>
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
                    {uniqueStatuses.map((status) => (
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
                setError(null);
                setLoading(true);
                setReceiptBooksCache({ data: [], timestamp: 0 }); // Reset cache to force refetch
                setReceiptBookTypesCache({ data: [], timestamp: 0 }); // Reset types cache
                setHoldersCache({ data: new Map(), timestamp: 0 }); // Reset holders cache
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
              {loading && receiptBooksCache.timestamp === 0 ? ( // Only show skeleton on initial load
                <ReceiptBooksSkeleton />
              ) : error ? (
                <div className="error-message" role="alert">
                  {error}
                  <button
                    onClick={() => {
                      setError(null);
                      setLoading(true);
                      setReceiptBooksCache({ data: [], timestamp: 0 }); // Reset cache to force refetch
                    }}
                    className="action-button-2"
                    aria-label={t("receiptBooks.actions.aria.retry")}
                  >
                    {t("receiptBooks.actions.retry")}
                  </button>
                </div>
              ) : (
                <>
                  <ReceiptBooksList
                    paginatedReceiptBooks={paginatedReceiptBooks}
                    receiptBookTypes={receiptBookTypesCache.data}
                    userPermissions={userPermissions}
                    holdersMap={holdersCache.data}
                    t={t}
                    handleEdit={handleEdit}
                    handleDelete={handleDelete}
                    navigate={navigate}
                  />
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        aria-label={t("receiptBooks.pagination.aria.previous")}
                      >
                        {t("receiptBooks.pagination.previous")}
                      </button>
                      <span>{t("receiptBooks.pagination.pageInfo", { currentPage, totalPages })}</span>
                      <button
                        onClick={() => setCurrentPage((p) => p + 1)}
                        disabled={currentPage >= totalPages}
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
              handleNumberChange={(e) => handleNumberChange(e, false)}
              handleNumberBlur={(e) => handleNumberBlur(e, false)}
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
              handleNumberChange={(e) => handleNumberChange(e, true)}
              handleNumberBlur={(e) => handleNumberBlur(e, true)}
            />
          )}

          {view === "types" && userPermissions.canViewTypes && (
            <>
              {typesLoading && receiptBookTypesCache.timestamp === 0 ? ( // Only show skeleton on initial load
                <ReceiptBookTypesSkeleton />
              ) : error ? (
                <div className="error-message" role="alert">
                  {error}
                  <button
                    onClick={() => {
                      setError(null);
                      setTypesLoading(true);
                      setReceiptBookTypesCache({ data: [], timestamp: 0 }); // Reset cache to force refetch
                    }}
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