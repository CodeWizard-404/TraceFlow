import React, { useState, useEffect, useMemo } from "react";
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

const PERMISSIONS = {
  ACCESS_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS,
  ACCESS_RECEIPT_BOOK_DETAILS: import.meta.env
    .VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_DETAILS,
  ACCESS_RECEIPT_BOOK_HISTORY: import.meta.env
    .VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_HISTORY,
  CREATE_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_CREATE_RECEIPT_BOOKS,
  UPDATE_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_UPDATE_RECEIPT_BOOKS,
  DELETE_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_DELETE_RECEIPT_BOOKS,
  TRANSFER_RECEIPT_BOOKS: import.meta.env
    .VITE_PERMISSIONS_TRANSFER_RECEIPT_BOOKS,
};

const ROLES = {
  SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
  STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
  REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
  PURCHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
  SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
};

const ITEMS_PER_PAGE = 10;

const padNumber = (value: string): string => {
  const numericValue = value.replace(/\D/g, "");
  if (numericValue.length > 6) return numericValue.slice(0, 6);
  return numericValue.padStart(6, "0");
};

const ReceiptBooks: React.FC = () => {
  const navigate = useNavigate();
  const { effectivePermissions, userRoles, permissionsLoaded, user } =
    useAuth();
  const { t } = useTranslation();

  if (!user) {
    return <div>{t("receiptBooks.errors.unknown")}</div>;
  }

  const currentUserID = user.userID;

  const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"number" | "type" | "status">(
    "number"
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [newReceiptBook, setNewReceiptBook] = useState<Partial<ReceiptBook>>(
    {}
  );
  const [editReceiptBook, setEditReceiptBook] = useState<ReceiptBook | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [holdersMap, setHoldersMap] = useState<Map<string, string>>(new Map());
  const [formError, setFormError] = useState<string | null>(null);

  const userPermissions = useMemo(
    () => ({
      canView: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOKS
      ),
      canViewDetails: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_DETAILS
      ),
      canViewHistory: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOK_HISTORY
      ),
      canCreate: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.CREATE_RECEIPT_BOOKS
      ),
      canUpdate: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.UPDATE_RECEIPT_BOOKS
      ),
      canDelete: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.DELETE_RECEIPT_BOOKS
      ),
      canTransfer: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.TRANSFER_RECEIPT_BOOKS
      ),
    }),
    [effectivePermissions]
  );

  const userCapabilities = useMemo(
    () => ({
      isSupervisorLike:
        userRoles?.some((role) => role.name === ROLES.SUPERVISOR) || false,
      isStockManagerLike:
        userRoles?.some((role) => role.name === ROLES.STOCK_MANAGER) || false,
      isRegionalManagerLike:
        userRoles?.some((role) => role.name === ROLES.REGIONAL_MANAGER) ||
        false,
      isPurchaseTeamLike:
        userRoles?.some((role) => role.name === ROLES.PURCHASE_TEAM) || false,
    }),
    [userRoles]
  );

  useEffect(() => {
    const fetchData = async () => {
      if (!userPermissions.canView || !permissionsLoaded) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const receiptsData = await getAllReceiptBooks();
        let filteredBooks = receiptsData.map((receipt) => ({
          ...receipt,
          qrCode: `data:image/png;base64,${receipt.qrCode}`,
        }));

        if (userCapabilities.isSupervisorLike) {
          filteredBooks = filteredBooks.filter(
            (r) => r.currentHolderID === currentUserID
          );
        }

        if (userCapabilities.isRegionalManagerLike) {
          filteredBooks = filteredBooks.filter(
            (r) => r.currentHolderID === currentUserID
          );
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
      } catch (error) {
        console.error("Failed to fetch receipt books:", error);
        setFormError(t("receiptBooks.errors.unknown"));
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
  ]);

  useEffect(() => {
    const fetchHolders = async () => {
      const uniqueUserIDs = Array.from(
        new Set(receiptBooks.map((r) => r.currentHolderID).filter((id) => id))
      );
      const uniqueAgentIDs = Array.from(
        new Set(receiptBooks.map((r) => r.agentID).filter((id) => id))
      );
      let hasChanges = false;
      const newHoldersMap = new Map<string, string>(holdersMap);

      for (const userID of uniqueUserIDs) {
        if (userID && !newHoldersMap.has(userID)) {
          try {
            const userData = await getUserById(userID);
            newHoldersMap.set(
              userID,
              `${userData.firstname} ${userData.lastname}`
            );
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
            newHoldersMap.set(
              agentID,
              `${agentData.name} ${agentData.lastname}`
            );
            hasChanges = true;
          } catch (error) {
            console.error(`Failed to fetch agent ${agentID}:`, error);
            newHoldersMap.set(agentID, t("receiptBooks.table.holderLoading"));
            hasChanges = true;
          }
        }
      }

      if (hasChanges) setHoldersMap(newHoldersMap);
    };

    if (receiptBooks.length > 0) fetchHolders();
  }, [receiptBooks, holdersMap, t]);

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
    if (filterType !== "all")
      result = result.filter((r) => r.type === filterType);
    if (filterStatus !== "all")
      result = result.filter((r) => r.status === filterStatus);
    result.sort((a, b) => {
      const fieldA =
        sortField === "number"
          ? a.number
          : sortField === "type"
          ? a.type
          : a.status;
      const fieldB =
        sortField === "number"
          ? b.number
          : sortField === "type"
          ? b.type
          : b.status;
      return sortOrder === "asc"
        ? fieldA > fieldB
          ? 1
          : -1
        : fieldA < fieldB
        ? 1
        : -1;
    });
    return result;
  }, [
    receiptBooks,
    searchQuery,
    sortField,
    sortOrder,
    filterType,
    filterStatus,
  ]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredReceiptBooks.length / ITEMS_PER_PAGE)),
    [filteredReceiptBooks]
  );

  const paginatedReceiptBooks = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredReceiptBooks.slice(start, end);
  }, [filteredReceiptBooks, currentPage]);

  const handleNumberChange = (value: string, isEdit: boolean) => {
    const numericValue = value.replace(/\D/g, "").slice(0, 6);
    if (isEdit && editReceiptBook) {
      setEditReceiptBook({ ...editReceiptBook, number: numericValue });
    } else {
      setNewReceiptBook({ ...newReceiptBook, number: numericValue });
    }
  };

  const handleNumberBlur = (value: string, isEdit: boolean) => {
    const paddedValue = padNumber(value);
    if (isEdit && editReceiptBook) {
      setEditReceiptBook({ ...editReceiptBook, number: paddedValue });
    } else {
      setNewReceiptBook({ ...newReceiptBook, number: paddedValue });
    }
  };

  const handleCreate = async () => {
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
      setReceiptBooks([...receiptBooks, transformedReceipt]);
      setNewReceiptBook({});
      setView("list");
    } catch (error) {
      setFormError(
        t("receiptBooks.errors.createFailed", {
          message:
            error instanceof Error
              ? error.message
              : t("receiptBooks.errors.unknown"),
        })
      );
    }
  };

  const handleUpdate = async () => {
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
      setReceiptBooks(
        receiptBooks.map((r) =>
          r.bookID === updatedReceipt.bookID ? transformedReceipt : r
        )
      );
      setEditReceiptBook(null);
      setView("list");
    } catch (error) {
      setFormError(
        t("receiptBooks.errors.updateFailed", {
          message:
            error instanceof Error
              ? error.message
              : t("receiptBooks.errors.unknown"),
        })
      );
    }
  };

  const handleDelete = async (bookID: string) => {
    if (!userPermissions.canDelete) return;
    if (!window.confirm(t("receiptBooks.actions.deleteConfirm"))) return;
    try {
      await deleteReceiptBook(bookID);
      setReceiptBooks(receiptBooks.filter((r) => r.bookID !== bookID));
    } catch (error) {
      setFormError(
        t("receiptBooks.errors.deleteFailed", {
          message:
            error instanceof Error
              ? error.message
              : t("receiptBooks.errors.unknown"),
        })
      );
    }
  };

  const handleTransfer = () => {
    if (userPermissions.canTransfer) {
      navigate("/transfer-receipt-books");
    }
  };

  if (!permissionsLoaded || loading) {
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
              <option value="number">
                {t("receiptBooks.sort.fields.number")}
              </option>
              <option value="type">{t("receiptBooks.sort.fields.type")}</option>
              <option value="status">
                {t("receiptBooks.sort.fields.status")}
              </option>
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
              <label htmlFor="filterType">
                {t("receiptBooks.filter.type.label")}
              </label>
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
              <label htmlFor="filterStatus">
                {t("receiptBooks.filter.status.label")}
              </label>
              <select
                id="filterStatus"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                aria-label={t("receiptBooks.filter.ariaLabel")}
              >
                <option value="all">
                  {t("receiptBooks.filter.status.all")}
                </option>
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
              <FaPlus aria-hidden="true" />{" "}
              {t("receiptBooks.actions.newReceipt")}
            </button>
          )}
          {userPermissions.canTransfer && (
            <button
              className="action-button-0"
              onClick={handleTransfer}
              aria-label={t("receiptBooks.actions.aria.transferBooks")}
            >
              <FaExchangeAlt aria-hidden="true" />{" "}
              {t("receiptBooks.actions.transferBooks")}
            </button>
          )}
        </aside>

        <main className="main-content">
          {view === "list" && (
            <div className="table-card">
              <h2>{t("receiptBooks.title.list")}</h2>
              <div className="table-container">
                <div className="table-head">
                  <div className="table-row table-row-1">
                    <div className="table-cell">
                      {t("receiptBooks.table.headers.number")}
                    </div>
                    <div className="table-cell">
                      {t("receiptBooks.table.headers.type")}
                    </div>
                    <div className="table-cell">
                      {t("receiptBooks.table.headers.bookStatus")}
                    </div>
                    <div className="table-cell">
                      {t("receiptBooks.table.headers.stubStatus")}
                    </div>
                    <div className="table-cell">
                      {t("receiptBooks.table.headers.holder")}
                    </div>
                    <div className="table-cell">
                      {t("receiptBooks.table.headers.qrCode")}
                    </div>
                    <div className="table-cell">
                      {t("receiptBooks.table.headers.actions")}
                    </div>
                  </div>
                </div>
                <div className="table-body">
                  {paginatedReceiptBooks.length > 0 ? (
                    paginatedReceiptBooks.map((receipt) => (
                      <div
                        key={receipt.bookID}
                        className="table-row table-row-1"
                      >
                        <div className="table-cell">{receipt.number}</div>
                        <div className="table-cell">
                          {t(
                            `receiptBooks.types.${receipt.type.toLowerCase()}`,
                            {
                              defaultValue: receipt.type,
                            }
                          )}
                        </div>
                        <div className="table-cell">
                          {t(
                            `common.receiptBookStatuses.${receipt.status.toLowerCase()}`,
                            { defaultValue: receipt.status }
                          )}
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
                            ? holdersMap.get(receipt.agentID) ||
                              t("receiptBooks.table.holderLoading")
                            : receipt.currentHolderID
                            ? holdersMap.get(receipt.currentHolderID) ||
                              t("receiptBooks.table.holderLoading")
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
                              onClick={() => {
                                setEditReceiptBook(receipt);
                                setView("edit");
                              }}
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
                              aria-label={t(
                                "receiptBooks.actions.aria.delete",
                                {
                                  number: receipt.number,
                                }
                              )}
                            >
                              <FaTrash aria-hidden="true" />
                            </button>
                          )}
                          {userPermissions.canViewHistory && (
                            <button
                              onClick={() =>
                                navigate(
                                  `/receipt-book/${receipt.bookID}/history`
                                )
                              }
                              aria-label={t(
                                "receiptBooks.actions.aria.history",
                                {
                                  number: receipt.number,
                                }
                              )}
                            >
                              <FaHistory aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="table-row table-row-1">
                      <div className="table-cell">
                        {t("receiptBooks.table.noData")}
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
            </div>
          )}

          {view === "create" && userPermissions.canCreate && (
            <div className="form-card form-card-0">
              <h3>{t("receiptBooks.form.createTitle")}</h3>
              {formError && <div className="error-message">{formError}</div>}
              <div className="form-group">
                <label htmlFor="newNumber">
                  {t("receiptBooks.form.labels.number")}
                </label>
                <input
                  id="newNumber"
                  type="text"
                  value={newReceiptBook.number || ""}
                  onChange={(e) => handleNumberChange(e.target.value, false)}
                  onBlur={(e) => handleNumberBlur(e.target.value, false)}
                  maxLength={6}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder={t("receiptBooks.form.placeholders.enterNumber")}
                  aria-label={t("receiptBooks.form.placeholders.enterNumber")}
                />
              </div>
              <div className="form-group">
                <label htmlFor="newType">
                  {t("receiptBooks.form.labels.type")}
                </label>
                <select
                  id="newType"
                  value={newReceiptBook.type || ""}
                  onChange={(e) =>
                    setNewReceiptBook({
                      ...newReceiptBook,
                      type: e.target.value,
                    })
                  }
                  aria-label={t("receiptBooks.form.placeholders.selectType")}
                >
                  <option value="" disabled>
                    {t("receiptBooks.form.placeholders.selectType")}
                  </option>
                  {Object.keys(
                    t("receiptBooks.types", { returnObjects: true })
                  ).map((key) => (
                    <option key={key} value={key}>
                      {t(`receiptBooks.types.${key}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button
                  className="action-button-0"
                  onClick={handleCreate}
                  aria-label={t("receiptBooks.actions.aria.create")}
                >
                  {t("receiptBooks.actions.create")}
                </button>
                <button
                  className="back-button"
                  onClick={() => setView("list")}
                  aria-label={t("receiptBooks.actions.aria.cancel")}
                >
                  {t("receiptBooks.actions.cancel")}
                </button>
              </div>
            </div>
          )}

          {view === "edit" && editReceiptBook && userPermissions.canUpdate && (
            <div className="form-card form-card-0">
              <h3>
                {t("receiptBooks.form.editTitle", {
                  number: editReceiptBook.number,
                })}
              </h3>
              {formError && <div className="error-message">{formError}</div>}
              <div className="form-group">
                <label htmlFor="editNumber">
                  {t("receiptBooks.form.labels.number")}
                </label>
                <input
                  id="editNumber"
                  type="text"
                  value={editReceiptBook.number}
                  onChange={(e) => handleNumberChange(e.target.value, true)}
                  onBlur={(e) => handleNumberBlur(e.target.value, true)}
                  maxLength={6}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder={t("receiptBooks.form.placeholders.enterNumber")}
                  aria-label={t("receiptBooks.form.placeholders.enterNumber")}
                />
              </div>
              <div className="form-group">
                <label htmlFor="editType">
                  {t("receiptBooks.form.labels.type")}
                </label>
                <select
                  id="editType"
                  value={editReceiptBook.type}
                  onChange={(e) =>
                    setEditReceiptBook({
                      ...editReceiptBook,
                      type: e.target.value,
                    })
                  }
                  aria-label={t("receiptBooks.form.placeholders.selectType")}
                >
                  {Object.keys(
                    t("receiptBooks.types", { returnObjects: true })
                  ).map((key) => (
                    <option key={key} value={key}>
                      {t(`receiptBooks.types.${key}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button
                  className="action-button-0"
                  onClick={handleUpdate}
                  aria-label={t("receiptBooks.actions.aria.save")}
                >
                  {t("receiptBooks.actions.save")}
                </button>
                <button
                  className="back-button"
                  onClick={() => setView("list")}
                  aria-label={t("receiptBooks.actions.aria.cancel")}
                >
                  {t("receiptBooks.actions.cancel")}
                </button>
              </div>
            </div>
          )}
        </main>
      </section>
    </div>
  );
};

export default ReceiptBooks;
