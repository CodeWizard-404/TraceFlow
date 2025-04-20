import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import "./ReceiptBooks.css";
import ReceiptBook from "../../models/ReceiptBook";
import { getUserById } from "../../apis/userAPI";
import { getAgentById } from "../../apis/agentAPI";
import { useTranslation } from "react-i18next";
import { debounce } from "lodash";

// Constants
const PERMISSIONS = {
  ACCESS_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS,
  ACCESS_RECEIPT_BOOK_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_DETAILS,
  ACCESS_RECEIPT_BOOK_HISTORY: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_HISTORY,
  CREATE_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_CREATE_RECEIPT_BOOKS,
  UPDATE_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_UPDATE_RECEIPT_BOOKS,
  DELETE_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_DELETE_RECEIPT_BOOKS,
  TRANSFER_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_TRANSFER_RECEIPT_BOOKS,
};

const ROLES = {
  SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
  STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
  REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
  PURCHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
  SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
};

const ITEMS_PER_PAGE = 10;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const SKELETON_ROWS = 10;

// Interfaces
interface HolderCache {
  data: Map<string, string>;
  timestamp: number;
}

// Utility Functions
const padNumber = (value: string): string => {
  const numericValue = value.replace(/\D/g, "");
  if (numericValue.length > 6) return numericValue.slice(0, 6);
  return numericValue.padStart(6, "0");
};

// Memoized List Component
const ReceiptBooksList: React.FC<{
  paginatedReceiptBooks: ReceiptBook[];
  userPermissions: Record<string, boolean>;
  holdersMap: Map<string, string>;
  t: (key: string, options?: Record<string, unknown>) => string;
  handleEdit: (receipt: ReceiptBook) => void;
  handleDelete: (bookID: string) => void;
  navigate: (path: string) => void;
}> = React.memo(
  ({
    paginatedReceiptBooks,
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
          <div className="table-row table-row-1">
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
            paginatedReceiptBooks.map((receipt) => (
              <div key={receipt.bookID} className="table-row table-row-1">
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
                  {receipt.agentID
                    ? holdersMap.get(receipt.agentID) || t("receiptBooks.table.holderLoading")
                    : receipt.currentHolderID
                      ? holdersMap.get(receipt.currentHolderID) || t("receiptBooks.table.holderLoading")
                      : t("receiptBooks.table.na")}
                </div>
                <div className="table-cell">
                  <img
                    src={receipt.qrCode}
                    alt={t("receiptBooks.table.headers.qrCode")}
                    style={{ width: "50px" }}
                  />
                </div>
                <div className="table-cell actions">
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
            <div className="table-row table-row-1">
              <div className="table-cell">{t("receiptBooks.table.noData")}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
);

// Memoized Form Component
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
}> = React.memo(
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
          placeholder={t("receiptBooks.form.placeholders.enterNumber")}
          aria-label={t("receiptBooks.form.placeholders.enterNumber")}
        />
      </div>
      <div className="form-group">
        <label htmlFor={isEdit ? "editType" : "newType"}>
          {t("receiptBooks.form.labels.type")}
        </label>
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
  )
);

// Skeleton Component
const ReceiptBooksSkeleton: React.FC = () => (
  <div className="table-card" aria-busy="true">
    <h2 className="skeleton skeleton-text skeleton-title"></h2>
    <div className="table-container">
      <div className="table-head">
        <div className="table-row table-row-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="table-cell">
              <div className="skeleton skeleton-text"></div>
            </div>
          ))}
        </div>
      </div>
      <div className="table-body">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className="table-row table-row-1">
            {Array.from({ length: 7 }).map((__, j) => (
              <div key={j} className="table-cell">
                <div className="skeleton skeleton-text"></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Main Component
const ReceiptBooks: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { effectivePermissions, userRoles, permissionsLoaded, user } = useAuth();
  const { t } = useTranslation();

  // State
  const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
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

  // Derived State
  const currentUserID = user?.userID;

  // Permissions
  const userPermissions = useMemo(
    () => ({
      canView: effectivePermissions?.some((p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOKS) ?? false,
      canViewDetails: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_DETAILS
      ) ?? false,
      canViewHistory: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_HISTORY
      ) ?? false,
      canCreate: effectivePermissions?.some((p) => p.name === PERMISSIONS.CREATE_RECEIPT_BOOKS) ?? false,
      canUpdate: effectivePermissions?.some((p) => p.name === PERMISSIONS.UPDATE_RECEIPT_BOOKS) ?? false,
      canDelete: effectivePermissions?.some((p) => p.name === PERMISSIONS.DELETE_RECEIPT_BOOKS) ?? false,
      canTransfer: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.TRANSFER_RECEIPT_BOOKS
      ) ?? false,
    }),
    [effectivePermissions]
  );

  // Roles
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

  // Debounced Search
  const debouncedSetSearchQuery = useCallback(
    debounce((value: string) => setSearchQuery(value), 300),
    []
  );

  // Fetch Receipt Books
  useEffect(() => {
    const fetchData = async () => {
      if (!userPermissions.canView || !permissionsLoaded || !user) {
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const receiptsData = await getAllReceiptBooks();
        let filteredBooks = receiptsData.map((receipt) => ({
          ...receipt,
          qrCode: `data:image/png;base64,${receipt.qrCode}`,
        }));

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

        setReceiptBooks(filteredBooks);
        setFormError(null);
      } catch (error) {
        console.error("Failed to fetch receipt books:", error);
        setError(t("receiptBooks.errors.fetchFailed"));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
  ]);

  // Fetch Holders
  useEffect(() => {
    const fetchHolders = async () => {
      const uniqueUserIDs = Array.from(
        new Set(receiptBooks.map((r) => r.currentHolderID).filter((id) => id))
      );
      const uniqueAgentIDs = Array.from(
        new Set(receiptBooks.map((r) => r.agentID).filter((id) => id))
      );
      let hasChanges = false;
      const newHoldersMap = new Map<string, string>(holdersCache.data);

      for (const userID of uniqueUserIDs) {
        if (userID && !newHoldersMap.has(userID)) {
          try {
            const userData = await getUserById(userID);
            newHoldersMap.set(userID, `${userData.firstname} ${userData.lastname}`);
            hasChanges = true;
          } catch (error) {
            console.error(`Failed to fetch user ${userID}:`, error);
            newHoldersMap.set(userID, t("receiptBooks.table.holderLoading"));
            hasChanges = true;
          }
        }
      }

      for (const agentID of uniqueAgentIDs) {
        if (agentID && !newHoldersMap.has(agentID)) {
          try {
            const agentData = await getAgentById(agentID);
            newHoldersMap.set(agentID, `${agentData.name} ${agentData.lastname}`);
            hasChanges = true;
          } catch (error) {
            console.error(`Failed to fetch agent ${agentID}:`, error);
            newHoldersMap.set(agentID, t("receiptBooks.table.holderLoading"));
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        setHoldersCache({
          data: newHoldersMap,
          timestamp: Date.now(),
        });
      }
    };

    if (
      receiptBooks.length > 0 &&
      Date.now() - holdersCache.timestamp > CACHE_DURATION
    ) {
      fetchHolders();
    }
  }, [receiptBooks, holdersCache, t]);

  // Computed Values
  const uniqueTypes = useMemo(
    () => Array.from(new Set(receiptBooks.map((r) => r.type))),
    [receiptBooks]
  );
  const uniqueStatuses = useMemo(
    () => Array.from(new Set(receiptBooks.map((r) => r.status))),
    [receiptBooks]
  );

  const filteredReceiptBooks = useMemo(() => {
    let result = receiptBooks.filter(
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
  }, [receiptBooks, searchQuery, sortField, sortOrder, filterType, filterStatus]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredReceiptBooks.length / ITEMS_PER_PAGE)),
    [filteredReceiptBooks]
  );

  const paginatedReceiptBooks = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredReceiptBooks.slice(start, end);
  }, [filteredReceiptBooks, currentPage]);

  // Handlers
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
      setReceiptBooks((prev) => [...prev, transformedReceipt]);
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
      setReceiptBooks((prev) =>
        prev.map((r) => (r.bookID === updatedReceipt.bookID ? transformedReceipt : r))
      );
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

  const handleDelete = useCallback(
    async (bookID: string) => {
      if (!userPermissions.canDelete) return;
      if (!window.confirm(t("receiptBooks.actions.deleteConfirm"))) return;
      try {
        await deleteReceiptBook(bookID);
        setReceiptBooks((prev) => prev.filter((r) => r.bookID !== bookID));
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

  const handleTransfer = useCallback(() => {
    if (userPermissions.canTransfer) {
      navigate("/transfer-receipt-books");
    }
  }, [userPermissions.canTransfer, navigate]);

  const handleEdit = useCallback((receipt: ReceiptBook) => {
    setEditReceiptBook(receipt);
    setView("edit");
  }, []);

  // Early Returns
  if (!user) {
    return <div>{t("receiptBooks.errors.unknown")}</div>;
  }

  if (!permissionsLoaded) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>{t("receiptBooks.loading")}</p>
      </div>
    );
  }

  if (!userPermissions.canView) {
    navigate("/access-denied");
    return null;
  }

  // Render
  return (
    <div className="receipt-books" role="main">
      <header className="dashboard-header">
        <h1>
          {view === "list"
            ? t("receiptBooks.title.list")
            : view === "create"
              ? t("receiptBooks.title.create")
              : t("receiptBooks.title.edit")}
        </h1>
        {view === "list" && (
          <div className="search-container">
            <FaSearch className="search-icon" aria-hidden="true" />
            <input
              id="searchInput"
              type="text"
              placeholder={t("receiptBooks.search.placeholder")}
              value={searchQuery}
              onChange={(e) => debouncedSetSearchQuery(e.target.value)}
              className="search-input"
              aria-label={t("receiptBooks.search.ariaLabel")}
            />
          </div>
        )}
      </header>

      <section className="dashboard-content">
        <aside className="sidebar">
          <div className="sort-card">
            <h3>{t("receiptBooks.sort.title")}</h3>
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
          {userPermissions.canCreate && (
            <button
              className="action-button-0"
              onClick={() => setView("create")}
              aria-label={t("receiptBooks.actions.aria.newReceipt")}
            >
              <FaPlus aria-hidden="true" /> {t("receiptBooks.actions.newReceipt")}
            </button>
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
        </aside>

        <main className="main-content">
          {view === "list" && (
            <>
              {loading ? (
                <ReceiptBooksSkeleton />
              ) : error ? (
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

export default ReceiptBooks;