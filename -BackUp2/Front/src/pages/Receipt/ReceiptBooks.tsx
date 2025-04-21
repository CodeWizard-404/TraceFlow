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
} from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import {
  getAllReceiptBooks,
  createReceiptBook,
  updateReceiptBook,
  deleteReceiptBook,
} from "../../apis/receiptBookAPI";
import ReceiptBook from "../../models/ReceiptBook";
import { getUserById } from "../../apis/userAPI";
import { getAgentById } from "../../apis/agentAPI";
import { useTranslation } from "react-i18next";
import { debounce } from "lodash";
import { t } from "i18next";
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

// Utility function to pad numbers to 6 digits
const padNumber = (value: string): string => {
  const numericValue = value.replace(/\D/g, "");
  if (numericValue.length > 6) return numericValue.slice(0, 6);
  return numericValue.padStart(6, "0");
};

// Memoized List Component to prevent unnecessary re-renders
const ReceiptBooksList: React.FC<{
  paginatedReceiptBooks: ReceiptBook[];
  userPermissions: Record<string, boolean>;
  holdersMap: Map<string, string>;
  t: (key: string, options?: Record<string, unknown>) => string;
  handleEdit: (receipt: ReceiptBook) => void;
  handleDelete: (bookID: string) => void;
  navigate: (path: string) => void;
}> = memo(
  ({
    paginatedReceiptBooks,
    userPermissions,
    holdersMap,
    t,
    handleEdit,
    handleDelete,
    navigate,
  }) => (
    // Table card for displaying receipt books
    <div className="table-card">
      <h2>{t("receiptBooks.title.list")}</h2>
      <div className="table-container">
        {/* Table header */}
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
        {/* Table body */}
        <div className="table-body">
          {paginatedReceiptBooks.length > 0 ? (
            paginatedReceiptBooks.map((receipt) => (
              // Table row for each receipt book
              <div key={receipt.bookID} className="table-row-0 table-row-1">
                <div className="table-cell">{receipt.number}</div>
                <div className="table-cell">
                  {t(`receiptBooks.types.${receipt.type.toLowerCase()}`, {
                    defaultValue: receipt.type,
                  })}
                </div>
                <div className="table-cell">
                  {t(`common.receiptBookStatuses.${receipt.status.toLowerCase()}`, {
                    defaultValue: receipt.status,
                  })}
                </div>
                <div className="table-cell">
                  {receipt.ReceiptStub?.status
                    ? t(
                      `common.receiptBookStatuses.${receipt.ReceiptStub.status.toLowerCase()}`,
                      { defaultValue: receipt.ReceiptStub.status }
                    )
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
                  {/* QR code image */}
                  <img
                    src={receipt.qrCode}
                    alt={t("receiptBooks.table.headers.qrCode")}
                    style={{ width: "50px" }}
                    loading="lazy" // Lazy load images for performance
                  />
                </div>
                <div className="table-cell actions">
                  {/* Edit button */}
                  {userPermissions.canUpdate && (
                    <button
                      onClick={() => handleEdit(receipt)}
                      aria-label={t("receiptBooks.actions.aria.edit", {
                        number: receipt.number,
                      })}
                    >
                      <FaEdit aria-hidden="true" />
                    </button>
                  )}
                  {/* Delete button */}
                  {userPermissions.canDelete && (
                    <button
                      onClick={() => handleDelete(receipt.bookID)}
                      aria-label={t("receiptBooks.actions.aria.delete", {
                        number: receipt.number,
                      })}
                    >
                      <FaTrash aria-hidden="true" />
                    </button>
                  )}
                  {/* History button */}
                  {userPermissions.canViewHistory && (
                    <button
                      onClick={() => navigate(`/receipt-book/${receipt.bookID}/history`)}
                      aria-label={t("receiptBooks.actions.aria.history", {
                        number: receipt.number,
                      })}
                    >
                      <FaHistory aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            // No data message
            <div className="table-row-0 table-row-1">
              <div className="table-cell">{t("receiptBooks.table.noData")}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  ),
  // Custom comparison to prevent re-renders
  (prevProps, nextProps) =>
    prevProps.paginatedReceiptBooks === nextProps.paginatedReceiptBooks &&
    prevProps.userPermissions === nextProps.userPermissions &&
    prevProps.holdersMap === nextProps.holdersMap &&
    prevProps.handleEdit === nextProps.handleEdit &&
    prevProps.handleDelete === nextProps.handleDelete &&
    prevProps.navigate === nextProps.navigate
);

// Memoized Form Component to prevent unnecessary re-renders
const ReceiptBookForm: React.FC<{
  isEdit: boolean;
  receiptBook: Partial<ReceiptBook>;
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
    setReceiptBook,
    formError,
    t,
    handleSubmit,
    handleCancel,
    handleNumberChange,
    handleNumberBlur,
  }) => (
    // Form card for creating or editing receipt books
    <div className="form-card form-card-0">
      <h3>
        {isEdit
          ? t("receiptBooks.form.editTitle", { number: receiptBook.number })
          : t("receiptBooks.form.createTitle")}
      </h3>
      {/* Error message display */}
      {formError && <div className="error-message">{formError}</div>}
      <div className="form-group">
        <label htmlFor={isEdit ? "editNumber" : "newNumber"}>
          {t("receiptBooks.form.labels.number")}
        </label>
        {/* Number input */}
        <input
          id={isEdit ? "editNumber" : "newNumber"}
          type="text"
          value={receiptBook.number || ""}
          onChange={handleNumberChange}
          onBlur={handleNumberBlur}
          maxLength={6}
          pattern="[0-9]*"
          inputMode="numeric"
          placeholder={t("receiptBooks.form.placeholders.enterNumber")}
          aria-label={t("receiptBooks.form.placeholders.enterNumber")}
        />
      </div>
      <div className="form-group">
        <label htmlFor={isEdit ? "editType" : "newType"}>
          {t("receiptBooks.form.labels.type")}
        </label>
        {/* Type select */}
        <select
          id={isEdit ? "editType" : "newType"}
          value={receiptBook.type || ""}
          onChange={(e) => setReceiptBook({ ...receiptBook, type: e.target.value })}
          aria-label={t("receiptBooks.form.placeholders.selectType")}
        >
          {!isEdit && (
            <option value="" disabled>
              {t("receiptBooks.form.placeholders.selectType")}
            </option>
          )}
          {Object.keys(t("receiptBooks.types", { returnObjects: true })).map((key) => (
            <option key={key} value={key}>
              {t(`receiptBooks.types.${key}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="form-actions">
        {/* Submit button */}
        <button
          className="action-button-0"
          onClick={handleSubmit}
          aria-label={t(isEdit ? "receiptBooks.actions.aria.save" : "receiptBooks.actions.aria.create")}
        >
          {t(isEdit ? "receiptBooks.actions.save" : "receiptBooks.actions.create")}
        </button>
        {/* Cancel button */}
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
  // Custom comparison to prevent re-renders
  (prevProps, nextProps) =>
    prevProps.isEdit === nextProps.isEdit &&
    prevProps.receiptBook === nextProps.receiptBook &&
    prevProps.formError === nextProps.formError &&
    prevProps.handleSubmit === nextProps.handleSubmit &&
    prevProps.handleCancel === nextProps.handleCancel &&
    prevProps.handleNumberChange === nextProps.handleNumberChange &&
    prevProps.handleNumberBlur === nextProps.handleNumberBlur
);

// Skeleton Component for loading state
const ReceiptBooksSkeleton: React.FC = () => (
  // Skeleton table for loading state
  <div className="table-card" aria-busy="true">
    <h2>{t("receiptBooks.title.list")}</h2>
    <div className="table-container">
      {/* Skeleton header */}
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
      {/* Skeleton rows */}
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

// Main Component
const ReceiptBooks: React.FC = memo(() => {
  // Navigation hook
  const navigate = useNavigate();
  // Authentication context
  const { effectivePermissions, userRoles, permissionsLoaded, user } = useAuth();
  // Translation hook
  const { t } = useTranslation();

  // State declarations
  const [receiptBooksCache, setReceiptBooksCache] = useState<ReceiptBooksCache>({
    data: [],
    timestamp: 0,
  });
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"number" | "type" | "status">("number");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [newReceiptBook, setNewReceiptBook] = useState<Partial<ReceiptBook>>({});
  const [editReceiptBook, setEditReceiptBook] = useState<ReceiptBook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [holdersCache, setHoldersCache] = useState<HolderCache>({
    data: new Map(),
    timestamp: 0,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Current user ID
  const currentUserID = user?.userID;

  // Memoized permissions to prevent recalculations
  const userPermissions = useMemo(
    () => ({
      canView: effectivePermissions?.some((p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOKS) || false,
      canViewDetails: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_DETAILS
      ) || false,
      canViewHistory: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_HISTORY
      ) || false,
      canCreate: effectivePermissions?.some((p) => p.name === PERMISSIONS.CREATE_RECEIPT_BOOKS) || false,
      canUpdate: effectivePermissions?.some((p) => p.name === PERMISSIONS.UPDATE_RECEIPT_BOOKS) || false,
      canDelete: effectivePermissions?.some((p) => p.name === PERMISSIONS.DELETE_RECEIPT_BOOKS) || false,
      canTransfer: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.TRANSFER_RECEIPT_BOOKS
      ) || false,
    }),
    [effectivePermissions]
  );

  // Memoized user roles to prevent recalculations
  const userCapabilities = useMemo(
    () => ({
      isSupervisorLike: userRoles?.some((role) => role.name === ROLES.SUPERVISOR) || false,
      isStockManagerLike: userRoles?.some((role) => role.name === ROLES.STOCK_MANAGER) || false,
      isRegionalManagerLike:
        userRoles?.some((role) => role.name === ROLES.REGIONAL_MANAGER) || false,
      isPurchaseTeamLike: userRoles?.some((role) => role.name === ROLES.PURCHASE_TEAM) || false,
    }),
    [userRoles]
  );

  // Debounced search query to prevent excessive updates
  const debouncedSetSearchQuery = useCallback(
    debounce((value: string) => setSearchQuery(value), 300),
    []
  );

  // Effect to fetch receipt books with caching
  useEffect(() => {
    let isMounted = true; // Track component mount state
    const fetchData = async () => {
      // Skip if user lacks permissions or data is cached
      if (
        !userPermissions.canView ||
        !permissionsLoaded ||
        !user ||
        (receiptBooksCache.data.length > 0 &&
          Date.now() - receiptBooksCache.timestamp < CACHE_DURATION)
      ) {
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // Fetch receipt books
        const receiptsData = await getAllReceiptBooks();
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
          filteredBooks = filteredBooks.filter(
            (r) => r.status !== t("common.receiptBookStatuses.archived")
          );
        }

        // Update cache if component is still mounted
        if (isMounted) {
          setReceiptBooksCache({
            data: filteredBooks,
            timestamp: Date.now(),
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

    // Cleanup on unmount
    return () => {
      isMounted = false;
    };
  }, [userPermissions.canView, userCapabilities.isSupervisorLike, userCapabilities.isStockManagerLike, userCapabilities.isRegionalManagerLike, userCapabilities.isPurchaseTeamLike, currentUserID, permissionsLoaded, t, user, receiptBooksCache.timestamp, receiptBooksCache.data.length]);

  // Effect to fetch holders sequentially for current page
  useEffect(() => {
    let isMounted = true; // Track component mount state
    const fetchHolders = async () => {
      // Skip if cache is fresh
      if (Date.now() - holdersCache.timestamp < CACHE_DURATION) {
        return;
      }

      // Get receipt books for current page
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      const currentReceipts = receiptBooksCache.data.slice(start, end);

      // Collect unique IDs
      const uniqueUserIDs = Array.from(
        new Set(currentReceipts.map((r) => r.currentHolderID).filter((id) => id))
      );
      const uniqueAgentIDs = Array.from(
        new Set(currentReceipts.map((r) => r.agentID).filter((id) => id))
      );

      const newHoldersMap = new Map<string, string>(holdersCache.data);
      let hasChanges = false;

      // Fetch users sequentially
      for (const userID of uniqueUserIDs) {
        if (userID && !newHoldersMap.has(userID)) {
          try {
            const userData = await getUserById(userID);
            newHoldersMap.set(userID, `${userData.firstname} ${userData.lastname}`);
            hasChanges = true;
          } catch (error) {
            console.error(`Failed to fetch user ${userID}:`, error);
            newHoldersMap.set(userID, ""); // Set empty to avoid repeated fetches
            hasChanges = true;
          }
        }
      }

      // Fetch agents sequentially
      for (const agentID of uniqueAgentIDs) {
        if (agentID && !newHoldersMap.has(agentID)) {
          try {
            const agentData = await getAgentById(agentID);
            newHoldersMap.set(agentID, `${agentData.name} ${agentData.lastname}`);
            hasChanges = true;
          } catch (error) {
            console.error(`Failed to fetch agent ${agentID}:`, error);
            newHoldersMap.set(agentID, ""); // Set empty to avoid repeated fetches
            hasChanges = true;
          }
        }
      }

      // Update cache if changes occurred and component is mounted
      if (hasChanges && isMounted) {
        setHoldersCache({
          data: newHoldersMap,
          timestamp: Date.now(),
        });
      }
    };

    if (receiptBooksCache.data.length > 0) {
      fetchHolders();
    }

    // Cleanup on unmount
    return () => {
      isMounted = false;
    };
  }, [receiptBooksCache.data, currentPage, holdersCache.timestamp, t, holdersCache.data]);

  // Memoized unique types for filters
  const uniqueTypes = useMemo(
    () => Array.from(new Set(receiptBooksCache.data.map((r) => r.type))),
    [receiptBooksCache.data]
  );

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
        r.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.status.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filterType !== "all") result = result.filter((r) => r.type === filterType);
    if (filterStatus !== "all") result = result.filter((r) => r.status === filterStatus);
    result.sort((a, b) => {
      const fieldA =
        sortField === "number" ? a.number : sortField === "type" ? a.type : a.status;
      const fieldB =
        sortField === "number" ? b.number : sortField === "type" ? b.type : b.status;
      return sortOrder === "asc"
        ? fieldA > fieldB
          ? 1
          : -1
        : fieldA < fieldB
          ? 1
          : -1;
    });
    return result;
  }, [receiptBooksCache.data, searchQuery, sortField, sortOrder, filterType, filterStatus]);

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

  // Handler for number input changes
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

  // Handler for number input blur
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

  // Handler for creating a new receipt book
  const handleCreate = useCallback(async () => {
    if (!userPermissions.canCreate) return;
    setFormError(null);
    const paddedNumber = padNumber(newReceiptBook.number || "");
    try {
      if (!paddedNumber || !newReceiptBook.type) {
        setFormError(t("receiptBooks.errors.requiredFields"));
        return;
      }
      if (paddedNumber.length !== 6) {
        setFormError(t("receiptBooks.errors.invalidNumber"));
        return;
      }
      const createdReceipt = await createReceiptBook({
        number: paddedNumber,
        type: newReceiptBook.type,
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
          message:
            error instanceof Error ? error.message : t("receiptBooks.errors.unknown"),
        })
      );
    }
  }, [newReceiptBook, userPermissions.canCreate, t]);

  // Handler for updating a receipt book
  const handleUpdate = useCallback(async () => {
    if (!userPermissions.canUpdate || !editReceiptBook) return;
    setFormError(null);
    const paddedNumber = padNumber(editReceiptBook.number);
    try {
      if (!paddedNumber || !editReceiptBook.type) {
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
        data: prev.data.map((r) =>
          r.bookID === updatedReceipt.bookID ? transformedReceipt : r
        ),
        timestamp: prev.timestamp,
      }));
      setEditReceiptBook(null);
      setView("list");
    } catch (error) {
      setFormError(
        t("receiptBooks.errors.updateFailed", {
          message:
            error instanceof Error ? error.message : t("receiptBooks.errors.unknown"),
        })
      );
    }
  }, [editReceiptBook, userPermissions.canUpdate, t]);

  // Handler for deleting a receipt book
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
            message:
              error instanceof Error ? error.message : t("receiptBooks.errors.unknown"),
          })
        );
      }
    },
    [userPermissions.canDelete, t]
  );

  // Handler for transferring receipt books
  const handleTransfer = useCallback(() => {
    if (userPermissions.canTransfer) {
      navigate("/transfer-receipt-books");
    }
  }, [userPermissions.canTransfer, navigate]);

  // Handler for editing a receipt book
  const handleEdit = useCallback((receipt: ReceiptBook) => {
    setEditReceiptBook(receipt);
    setView("edit");
  }, []);

  // Early return for unauthenticated users
  if (!user) {
    return <div>{t("receiptBooks.errors.unknown")}</div>;
  }

  // Early return for loading permissions
  if (!permissionsLoaded) {
    return <ReceiptBooksSkeleton />;
  }

  // Redirect if user lacks view permission
  if (!userPermissions.canView) {
    navigate("/access-denied");
    return null;
  }

  // Main render
  return (
    // Main container for receipt books
    <div className="receipt-books" role="main">
      {/* Header section */}
      <header className="dashboard-header">
        <h1>
          {view === "list"
            ? t("receiptBooks.title.list")
            : view === "create"
              ? t("receiptBooks.title.create")
              : t("receiptBooks.title.edit")}
        </h1>
        {view === "list" && (
          // Search container
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

      {/* Main content section */}
      <section className="dashboard-content">
        {/* Sidebar with sort and filter controls */}
        <aside className="sidebar">
          <div className="sort-card">
            <h3>{t("receiptBooks.sort.title")}</h3>
            {/* Sort field select */}
            <select
              id="sortField"
              value={sortField}
              onChange={(e) =>
                setSortField(e.target.value as "number" | "type" | "status")
              }
              aria-label={t("receiptBooks.sort.ariaLabel")}
            >
              <option value="number">{t("receiptBooks.sort.fields.number")}</option>
              <option value="type">{t("receiptBooks.sort.fields.type")}</option>
              <option value="status">{t("receiptBooks.sort.fields.status")}</option>
            </select>
            {/* Sort order button */}
            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              aria-label={t("receiptBooks.sort.ariaLabel")}
            >
              <FaSort aria-hidden="true" />{" "}
              {sortOrder === "asc"
                ? t("receiptBooks.sort.order.asc")
                : t("receiptBooks.sort.order.desc")}
            </button>
          </div>
          <div className="filter-card">
            <h3>{t("receiptBooks.filter.title")}</h3>
            <div className="form-group">
              <label htmlFor="filterType">{t("receiptBooks.filter.type.label")}</label>
              {/* Filter type select */}
              <select
                id="filterType"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                aria-label={t("receiptBooks.filter.ariaLabel")}
              >
                <option value="all">{t("receiptBooks.filter.type.all")}</option>
                {uniqueTypes.map((type) => (
                  <option key={type} value={type}>
                    {t(`receiptBooks.types.${type.toLowerCase()}`, {
                      defaultValue: type,
                    })}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="filterStatus">{t("receiptBooks.filter.status.label")}</label>
              {/* Filter status select */}
              <select
                id="filterStatus"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                aria-label={t("receiptBooks.filter.ariaLabel")}
              >
                <option value="all">{t("receiptBooks.filter.status.all")}</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {t(`common.receiptBookStatuses.${status.toLowerCase()}`, {
                      defaultValue: status,
                    })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Create button */}
          {userPermissions.canCreate && (
            <button
              className="action-button-0"
              onClick={() => setView("create")}
              aria-label={t("receiptBooks.actions.aria.newReceipt")}
            >
              <FaPlus aria-hidden="true" /> {t("receiptBooks.actions.newReceipt")}
            </button>
          )}
          {/* Transfer button */}
          {userPermissions.canTransfer && (
            <button
              className="action-button-0"
              onClick={handleTransfer}
              aria-label={t("receiptBooks.actions.aria.transferBooks")}
            >
              <FaExchangeAlt aria-hidden="true" /> {t("receiptBooks.actions.transferBooks")}
            </button>
          )}
        </aside>

        {/* Main content area */}
        <main className="main-content">
          {view === "list" && (
            <>
              {loading ? (
                // Show skeleton during loading
                <ReceiptBooksSkeleton />
              ) : error ? (
                // Show error message
                <div className="error-message" role="alert">
                  {error}
                  <button
                    onClick={() => {
                      setError(null);
                      setLoading(true);
                    }}
                    className="action-button-0"
                    aria-label={t("receiptBooks.actions.aria.retry")}
                  >
                    {t("receiptBooks.actions.retry")}
                  </button>
                </div>
              ) : (
                <>
                  {/* Render receipt books list */}
                  <ReceiptBooksList
                    paginatedReceiptBooks={paginatedReceiptBooks}
                    userPermissions={userPermissions}
                    holdersMap={holdersCache.data}
                    t={t}
                    handleEdit={handleEdit}
                    handleDelete={handleDelete}
                    navigate={navigate}
                  />
                  {totalPages > 1 && (
                    // Pagination controls
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
                          totalPages,
                        })}
                      </span>
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
            // Create form
            <ReceiptBookForm
              isEdit={false}
              receiptBook={newReceiptBook}
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
            // Edit form
            <ReceiptBookForm
              isEdit={true}
              receiptBook={editReceiptBook}
              setReceiptBook={(book) => setEditReceiptBook(book as ReceiptBook)}
              formError={formError}
              t={t}
              handleSubmit={handleUpdate}
              handleCancel={() => setView("list")}
              handleNumberChange={(e) => handleNumberChange(e, true)}
              handleNumberBlur={(e) => handleNumberBlur(e, true)}
            />
          )}
        </main>
      </section>
    </div>
  );
});

// Display name for debugging
ReceiptBooks.displayName = "ReceiptBooks";

export default ReceiptBooks;