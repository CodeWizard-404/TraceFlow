/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaExchangeAlt,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../../context/AuthContext";
import {
  getAllReceiptBooks,
  transfer,
  validateTransfer,
  sendToSupplier,
  collectFromSupplier,
} from "../../apis/receiptBookAPI";
import {
  collectStub,
  validateStubCollection,
  archiveStub,
} from "../../apis/receiptStubAPI";
import { getAllUsers, getUserByPhone } from "../../apis/userAPI";
import {
  getAgentsByLocation,
  getAgentLocations,
  getAgentByPhone,
  getAgentById,
} from "../../apis/agentAPI";
import "./TransferReceiptBook.css";
import ReceiptBook from "../../models/ReceiptBook";
import User from "../../models/User";
import Agent from "../../models/Agent";
import { useTranslation } from "react-i18next";
import { t } from "i18next";

const PERMISSIONS = {
  TRANSFER_RECEIPT_BOOKS: import.meta.env
    .VITE_PERMISSIONS_TRANSFER_RECEIPT_BOOKS,
};

const ROLES = {
  PURCHASE_TEAM: import.meta.env.VITE_ROLES_PURCHASE_TEAM,
  REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
  SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
  STOCK_MANAGER: import.meta.env.VITE_ROLES_STOCK_MANAGER,
  SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
};

const ROLE_TRANSFER_RULES = {
  [ROLES.PURCHASE_TEAM]: {
    transferable: (book: ReceiptBook, userID: string) =>
      (book.status === t("common.receiptBookStatuses.inStock") &&
        book.currentHolderID === userID) ||
      book.status === t("common.receiptBookStatuses.sentToSupplier") ||
      (book.status === t("common.receiptBookStatuses.collectFromSupplier") &&
        book.currentHolderID === userID),
    recipientOptions: ["Supplier", "Regional Manager", "Collect from Supplier"],
  },
  [ROLES.REGIONAL_MANAGER]: {
    transferable: (book: ReceiptBook, userID: string) =>
      [
        t("common.receiptBookStatuses.withRegionalManager"),
        t("common.receiptBookStatuses.stubCollected"),
      ].includes(book.status) && book.currentHolderID === userID,
    recipientOptions: ["Regional Manager", "Supervisor", "Stock Manager"],
  },
  [ROLES.SUPERVISOR]: {
    transferable: (book: ReceiptBook, userID: string) =>
      [
        t("common.receiptBookStatuses.withSupervisor"),
        t("common.receiptBookStatuses.stubCollected"),
        t("common.receiptBookStatuses.assignedToAgent"),
      ].includes(book.status) &&
      (book.currentHolderID === userID || book.agentID),
    recipientOptions: [
      "Supervisor",
      "Regional Manager",
      "Agent",
      "Stock Manager",
      "Stub Collection",
    ],
  },
  [ROLES.STOCK_MANAGER]: {
    transferable: (book: ReceiptBook, userID: string) =>
      book.status === t("common.receiptBookStatuses.withStockManager") &&
      book.currentHolderID === userID,
    recipientOptions: ["Stock Manager", "Archive"],
  },
  [ROLES.SUPER_ADMIN]: {
    transferable: () => true,
    recipientOptions: [
      "Supplier",
      "Regional Manager",
      "Supervisor",
      "Agent",
      "Stock Manager",
      "Stub Collection",
      "Archive",
      "Collect from Supplier",
    ],
  },
} as const;

const ITEMS_PER_PAGE = 6;
const OTP_EXPIRY_SECONDS = 600;
const ERROR_DISPLAY_DURATION = 5000;

const TransferReceiptBook: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRoles, effectivePermissions, user } = useAuth();
  const { t } = useTranslation();

  if (!user) {
    return <div>{t("transferReceiptBook.errors.unknown")}</div>;
  }

  const {
    agentID: preSelectedAgentID,
    forceAgent,
    transferType,
  } = (location.state as {
    agentID?: string;
    forceAgent?: boolean;
    transferType?: string;
  }) || {};
  const userRoleSet = new Set(userRoles?.map((role) => role.name) || []);
  const currentUserID = user.userID;

  const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
  const [selectedBookIDs, setSelectedBookIDs] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recipientType, setRecipientType] = useState<string>("");
  const [recipientID, setRecipientID] = useState<string>("");
  const [supplierEmail, setSupplierEmail] = useState<string>("");
  const [agentPhone, setAgentPhone] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [bookSearchQuery, setBookSearchQuery] = useState<string>("");
  const [scannedQR, setScannedQR] = useState<string[]>([]);
  const [otp, setOtp] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [transferInitiated, setTransferInitiated] = useState<boolean>(false);
  const [isScannerRunning, setIsScannerRunning] = useState<boolean>(false);
  const [isScannerStarting, setIsScannerStarting] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [otpTimer, setOtpTimer] = useState<number>(OTP_EXPIRY_SECONDS);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const qrReaderRef = useRef<HTMLDivElement>(null);
  const scannedQRRef = useRef<Set<string>>(new Set());
  const stopLockRef = useRef<boolean>(false);
  const scanLockRef = useRef<boolean>(false);

  const userPermissions = useMemo(
    () => ({
      canTransferReceiptBooks: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.TRANSFER_RECEIPT_BOOKS
      ),
    }),
    [effectivePermissions]
  );

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(null);
    }, ERROR_DISPLAY_DURATION);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!transferInitiated) {
      setOtpTimer(OTP_EXPIRY_SECONDS);
      return;
    }
    const interval = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 0) {
          clearInterval(interval);
          setError(t("transferReceiptBook.errors.otpExpired"));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [transferInitiated, t]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const recipientDetails = useMemo(() => {
    if (recipientType === "Agent") {
      const agent = agents.find((a) => a.agentID === recipientID);
      return agent
        ? `${agent.name} ${agent.lastname} (${agent.phone})`
        : t("transferReceiptBook.form.loading");
    } else if (recipientType === "Stub Collection") {
      const books = receiptBooks.filter((b) =>
        selectedBookIDs.includes(b.bookID)
      );
      const agentIDs = [
        ...new Set(books.map((b) => b.agentID).filter((id) => id)),
      ];
      if (agentIDs.length !== 1) {
        return t("transferReceiptBook.form.multipleAgents");
      }
      const agent = agents.find((a) => a.agentID === agentIDs[0]);
      return agent
        ? `${agent.name} ${agent.lastname} (${agent.phone})`
        : t("transferReceiptBook.form.loading");
    } else {
      const user = users.find((u) => u.userID === recipientID);
      return user
        ? `${user.firstname} ${user.lastname} (${user.phone})`
        : t("transferReceiptBook.form.loading");
    }
  }, [
    recipientType,
    recipientID,
    users,
    agents,
    selectedBookIDs,
    receiptBooks,
    t,
  ]);

  const isTransferable = useCallback(
    (book: ReceiptBook) => {
      if (recipientType === "Supplier") {
        return (
          book.status === t("common.receiptBookStatuses.inStock") &&
          book.currentHolderID === currentUserID
        );
      }
      if (recipientType === "Collect from Supplier") {
        return book.status === t("common.receiptBookStatuses.sentToSupplier");
      }
      return Array.from(userRoleSet).some((role) => {
        const rule =
          ROLE_TRANSFER_RULES[
            role as unknown as keyof typeof ROLE_TRANSFER_RULES
          ];
        return rule && rule.transferable(book, currentUserID);
      });
    },
    [userRoleSet, currentUserID, recipientType, t]
  );

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      try {
        const parseTLV = (text: string) => {
          const numberLength = parseInt(text.slice(2, 4), 10);
          const number = text.slice(4, 4 + numberLength);
          const typeStart = 4 + numberLength + 2;
          const typeLength = parseInt(text.slice(typeStart, typeStart + 2), 10);
          const type = text.slice(typeStart + 2, typeStart + 2 + typeLength);
          return { number, type };
        };
        const { number, type } = parseTLV(decodedText);
        const matchingBook = receiptBooks.find(
          (r) => r.number === number && r.type === type
        );
        if (!matchingBook) {
          setError(t("transferReceiptBook.errors.qrNotFound", { number }));
          return;
        }
        if (
          scannedQRRef.current.has(decodedText) ||
          selectedBookIDs.includes(matchingBook.bookID)
        ) {
          setError(
            t("transferReceiptBook.errors.qrAlreadyScanned", { number })
          );
          return;
        }
        if (!isTransferable(matchingBook)) {
          setError(
            t("transferReceiptBook.errors.bookNotTransferable", {
              number,
              status: t(
                `common.receiptBookStatuses.${matchingBook.status.toLowerCase()}`,
                { defaultValue: matchingBook.status }
              ),
            })
          );
          return;
        }
        if (
          recipientType === "Stub Collection" &&
          matchingBook.status !==
            t("common.receiptBookStatuses.assignedToAgent")
        ) {
          setError(
            t("transferReceiptBook.errors.invalidStubCollectionStatus", {
              number,
            })
          );
          return;
        }
        if (
          recipientType === "Stock Manager" &&
          matchingBook.ReceiptStub?.status !==
            t("common.receiptBookStatuses.collected")
        ) {
          setError(
            t("transferReceiptBook.errors.stubNotCollected", { number })
          );
          return;
        }
        setScannedQR((prev) => [...prev, decodedText]);
        setSelectedBookIDs((prev) => [...prev, matchingBook.bookID]);
        scannedQRRef.current.add(decodedText);
        setError(null);
      } catch (err) {
        setError(t("transferReceiptBook.errors.invalidQR"));
        console.error("QR Parse Error:", err);
      } finally {
        scanLockRef.current = false;
      }
    },
    [isTransferable, recipientType, selectedBookIDs, receiptBooks, t]
  );

  useEffect(() => {
    if (preSelectedAgentID && forceAgent && !recipientType) {
      const initialRecipientType = transferType || "Agent";
      setRecipientType(initialRecipientType);
      setRecipientID(preSelectedAgentID);
      setAgentPhone("");
      const fetchAgent = async () => {
        try {
          const agent = await getAgentById(preSelectedAgentID);
          setAgents([agent]);
        } catch (err) {
          setError(t("transferReceiptBook.errors.fetchAgentFailed"));
          console.error(err);
        }
      };
      fetchAgent();
    }
  }, [preSelectedAgentID, forceAgent, recipientType, transferType, t]);

  const stopScanner = useCallback(async () => {
    if (stopLockRef.current || !qrScannerRef.current || !isScannerRunning)
      return;
    stopLockRef.current = true;
    try {
      await qrScannerRef.current.stop();
      qrScannerRef.current.clear();
      qrScannerRef.current = null;
      setIsScannerRunning(false);
      scannedQRRef.current.clear();
    } catch (err) {
      console.error("Stop Scanner Error:", err);
    } finally {
      stopLockRef.current = false;
    }
  }, [isScannerRunning]);

  const startScanner = useCallback(async () => {
    if (
      stopLockRef.current ||
      !qrReaderRef.current ||
      isScannerRunning ||
      isScannerStarting
    )
      return;
    setIsScannerStarting(true);
    const html5QrCode = qrScannerRef.current || new Html5Qrcode("qr-reader");
    qrScannerRef.current = html5QrCode;
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        handleScanSuccess,
        (err) => console.warn("Scan error:", err)
      );
      setIsScannerRunning(true);
      setError(null);
    } catch (err) {
      setError(t("transferReceiptBook.errors.cameraAccessDenied"));
      console.error("Scanner Start Error:", err);
    } finally {
      setIsScannerStarting(false);
    }
  }, [handleScanSuccess, isScannerRunning, isScannerStarting, t]);

  useEffect(() => {
    if (
      !qrReaderRef.current ||
      !recipientType ||
      !(
        recipientID ||
        recipientType === "Supplier" ||
        recipientType === "Archive" ||
        recipientType === "Stub Collection" ||
        recipientType === "Collect from Supplier"
      ) ||
      transferInitiated ||
      recipientType === "Supplier"
    ) {
      return;
    }
    startScanner();
    return () => {
      stopScanner();
    };
  }, [
    recipientType,
    recipientID,
    transferInitiated,
    startScanner,
    stopScanner,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopScanner();
      } else if (
        recipientType &&
        recipientType !== "Supplier" &&
        (recipientID ||
          recipientType === "Archive" ||
          recipientType === "Stub Collection" ||
          recipientType === "Collect from Supplier") &&
        !transferInitiated
      ) {
        startScanner();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopScanner();
    };
  }, [
    recipientType,
    recipientID,
    transferInitiated,
    startScanner,
    stopScanner,
  ]);

  useEffect(() => {
    if (transferInitiated && isScannerRunning) {
      stopScanner();
    }
  }, [transferInitiated, isScannerRunning, stopScanner]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userPermissions.canTransferReceiptBooks) {
        setError(t("transferReceiptBook.errors.accessDenied"));
        setLoading(false);
        return;
      }
      try {
        const [booksData, usersData, locationsData] = await Promise.all([
          getAllReceiptBooks(),
          getAllUsers(),
          getAgentLocations(),
        ]);
        setReceiptBooks(booksData);
        setUsers(usersData);
        setLocations(locationsData);
      } catch (err) {
        setError(t("transferReceiptBook.errors.fetchDataFailed"));
        console.error("Fetch Data Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userPermissions.canTransferReceiptBooks, t]);

  const getRecipientOptions = useCallback(() => {
    const options = new Set<string>();
    Array.from(userRoleSet).forEach((role) => {
      const rule =
        ROLE_TRANSFER_RULES[
          role as unknown as keyof typeof ROLE_TRANSFER_RULES
        ];
      if (rule) {
        rule.recipientOptions.forEach((opt) => options.add(opt));
      }
    });
    return Array.from(options);
  }, [userRoleSet]);

  const fetchAgentsByLocation = useCallback(
    async (location: string) => {
      try {
        const agentsData = await getAgentsByLocation(location);
        setAgents(agentsData);
      } catch (err) {
        setError(t("transferReceiptBook.errors.fetchAgentsFailed"));
        console.error(err);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!agentPhone || recipientType !== "Agent") return;
    const timeout = setTimeout(async () => {
      try {
        const agent = await getAgentByPhone(agentPhone);
        setRecipientID(agent.agentID);
        setAgents([agent]);
        setSelectedLocation("");
        setError(null);
      } catch (err) {
        setRecipientID("");
        setError(
          t("transferReceiptBook.errors.noAgentFound", { phone: agentPhone })
        );
        console.error(err);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [agentPhone, recipientType, t]);

  useEffect(() => {
    if (
      !searchQuery ||
      recipientType === "Agent" ||
      recipientType === "Supplier" ||
      recipientType === "Archive" ||
      recipientType === "Stub Collection" ||
      recipientType === "Collect from Supplier"
    )
      return;
    const timeout = setTimeout(async () => {
      try {
        const user = await getUserByPhone(searchQuery);
        if (
          user.Roles?.some(
            (r) => r.name.toLowerCase() === recipientType.toLowerCase()
          )
        ) {
          setRecipientID(user.userID);
          setError(null);
        } else {
          setRecipientID("");
          setError(
            t("transferReceiptBook.errors.invalidUserRole", {
              phone: searchQuery,
              role: recipientType,
            })
          );
        }
      } catch (err) {
        setRecipientID("");
        setError(
          t("transferReceiptBook.errors.noUserFound", { phone: searchQuery })
        );
        console.error(err);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery, recipientType, t]);

  const filteredAgents = useCallback(() => {
    if (!selectedLocation) return [];
    return agents.filter(
      (a) =>
        a.name!.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.phone!.includes(searchQuery)
    );
  }, [agents, selectedLocation, searchQuery]);

  const filteredUsers = useCallback(() => {
    return users.filter(
      (u) =>
        u.Roles?.some(
          (r) => r.name.toLowerCase() === recipientType.toLowerCase()
        ) &&
        (u.firstname.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.lastname.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.phone.includes(searchQuery))
    );
  }, [users, recipientType, searchQuery]);

  const filteredBooks = useMemo(() => {
    const transferableBooks = receiptBooks
      .filter((book) => isTransferable(book))
      .filter(
        (book) =>
          book.number.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
          book.type.toLowerCase().includes(bookSearchQuery.toLowerCase())
      );
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return transferableBooks.slice(startIndex, endIndex);
  }, [receiptBooks, bookSearchQuery, isTransferable, currentPage]);

  const totalPages = useMemo(() => {
    const transferableBooks = receiptBooks
      .filter((book) => isTransferable(book))
      .filter(
        (book) =>
          book.number.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
          book.type.toLowerCase().includes(bookSearchQuery.toLowerCase())
      );
    return Math.max(1, Math.ceil(transferableBooks.length / ITEMS_PER_PAGE));
  }, [receiptBooks, bookSearchQuery, isTransferable]);

  const handleBookSelection = (bookID: string) => {
    setSelectedBookIDs((prev) => {
      const newSelected = prev.includes(bookID)
        ? prev.filter((id) => id !== bookID)
        : [...prev, bookID];
      const book = receiptBooks.find((b) => b.bookID === bookID);
      if (book?.qrCode) {
        if (newSelected.includes(bookID)) {
          scannedQRRef.current.add(book.qrCode);
          setScannedQR((prev) => [...prev, book.qrCode]);
        } else {
          scannedQRRef.current.delete(book.qrCode);
          setScannedQR((prev) => prev.filter((qr) => qr !== book.qrCode));
        }
      }
      return newSelected;
    });
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  useEffect(() => {
    if (recipientType === "Agent" && selectedLocation) {
      fetchAgentsByLocation(selectedLocation);
    }
  }, [recipientType, selectedLocation, fetchAgentsByLocation]);

  const handleInitiateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBookIDs.length === 0) {
      setError(t("transferReceiptBook.errors.noBooksSelected"));
      return;
    }
    if (
      recipientType === "Agent" &&
      userRoleSet.has("Supervisor") &&
      selectedBookIDs.length > 1
    ) {
      setError(t("transferReceiptBook.errors.supervisorLimit"));
      return;
    }
    if (!recipientType) {
      setError(t("transferReceiptBook.errors.noRecipientType"));
      return;
    }
    if (recipientType === "Supplier" && !supplierEmail) {
      setError(t("transferReceiptBook.errors.noSupplierEmail"));
      return;
    }
    if (recipientType === "Agent" && !recipientID) {
      setError(t("transferReceiptBook.errors.noAgentSelected"));
      return;
    }
    if (
      recipientType !== "Supplier" &&
      recipientType !== "Archive" &&
      recipientType !== "Stub Collection" &&
      recipientType !== "Collect from Supplier" &&
      !recipientID
    ) {
      setError(t("transferReceiptBook.errors.noRecipientSelected"));
      return;
    }
    try {
      if (recipientType === "Supplier") {
        await sendToSupplier(selectedBookIDs, supplierEmail);
        navigate(-1);
      } else if (recipientType === "Stub Collection") {
        await collectStub(selectedBookIDs);
        setTransferInitiated(true);
        setError(null);
      } else if (recipientType === "Archive") {
        await Promise.all(selectedBookIDs.map((bookID) => archiveStub(bookID)));
        navigate(-1);
      } else if (recipientType === "Collect from Supplier") {
        await collectFromSupplier(selectedBookIDs, currentUserID);
        navigate(-1);
      } else {
        const recipientTypeForAPI =
          recipientType === "Agent" ? "agent" : "user";
        await transfer(selectedBookIDs, recipientID, recipientTypeForAPI);
        setTransferInitiated(true);
        setError(null);
      }
    } catch (err) {
      setError(
        t("transferReceiptBook.errors.initiateFailed", {
          message:
            err instanceof Error
              ? err.message
              : t("transferReceiptBook.errors.unknown"),
        })
      );
      console.error(err);
    }
  };

  const handleValidateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      recipientType === "Archive" ||
      recipientType === "Collect from Supplier"
    ) {
      navigate(-1);
      return;
    }
    if (!otp) {
      setError(t("transferReceiptBook.errors.noOTP"));
      return;
    }
    try {
      if (recipientType === "Stub Collection") {
        await validateStubCollection(selectedBookIDs, otp);
        navigate(-1);
      } else {
        const recipientTypeForAPI =
          recipientType === "Agent" ? "agent" : "user";
        await validateTransfer(
          selectedBookIDs,
          recipientID,
          otp,
          recipientTypeForAPI
        );
        navigate(-1);
      }
    } catch (err) {
      setError(
        t("transferReceiptBook.errors.validateFailed", {
          message:
            err instanceof Error
              ? err.message
              : t("transferReceiptBook.errors.unknown"),
        })
      );
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>{t("transferReceiptBook.loading")}</p>
      </div>
    );
  }
  if (error && !recipientType)
    return (
      <div className="error">
        {error}
        <button
          type="button"
          className="back-btn"
          onClick={() => navigate(-1)}
          aria-label={t("transferReceiptBook.actions.aria.back")}
        >
          <FaArrowLeft aria-hidden="true" />{" "}
          {t("transferReceiptBook.actions.back")}
        </button>
      </div>
    );

  return (
    <div className="transfer-receipt-book-container" role="main">
      <header className="transfer-header">
        <h1>
          {t("transferReceiptBook.title", {
            roles: Array.from(userRoleSet).join(", "),
          })}
        </h1>
      </header>
      <div className="transfer-card">
        {!transferInitiated ? (
          <form onSubmit={handleInitiateTransfer}>
            {!forceAgent && (
              <div className="form-group">
                <label htmlFor="recipientType">
                  {t("transferReceiptBook.form.recipientType")}
                </label>
                <select
                  id="recipientType"
                  value={recipientType}
                  onChange={(e) => {
                    setRecipientType(e.target.value);
                    setRecipientID("");
                    setSupplierEmail("");
                    setAgentPhone("");
                    setSelectedLocation("");
                    setSearchQuery("");
                    setBookSearchQuery("");
                    setSelectedBookIDs([]);
                    setScannedQR([]);
                    scannedQRRef.current.clear();
                    setAgents([]);
                    setIsScannerRunning(false);
                    setCurrentPage(1);
                  }}
                  required
                  aria-label={t(
                    "transferReceiptBook.form.placeholders.selectRecipientType"
                  )}
                >
                  <option value="">
                    {t(
                      "transferReceiptBook.form.placeholders.selectRecipientType"
                    )}
                  </option>
                  {getRecipientOptions().map((type) => (
                    <option key={type} value={type}>
                      {t(
                        `transferReceiptBook.recipientTypes.${type.toLowerCase()}`,
                        {
                          defaultValue: type,
                        }
                      )}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {recipientType && (
              <>
                {recipientType === "Agent" && !forceAgent && (
                  <div className="form-group">
                    <label htmlFor="agentPhone">
                      {t("transferReceiptBook.form.agentSelection")}
                    </label>
                    <input
                      id="agentPhone"
                      type="text"
                      value={agentPhone}
                      onChange={(e) => setAgentPhone(e.target.value)}
                      placeholder={t(
                        "transferReceiptBook.form.placeholders.enterAgentPhone"
                      )}
                      aria-label={t(
                        "transferReceiptBook.form.placeholders.enterAgentPhone"
                      )}
                    />
                    {!recipientID && (
                      <>
                        <p>{t("transferReceiptBook.form.or")}</p>
                        <label htmlFor="agentLocation">
                          {t("transferReceiptBook.form.location")}
                        </label>
                        <select
                          id="agentLocation"
                          value={selectedLocation}
                          onChange={(e) => setSelectedLocation(e.target.value)}
                          aria-label={t(
                            "transferReceiptBook.form.placeholders.selectLocation"
                          )}
                        >
                          <option value="">
                            {t(
                              "transferReceiptBook.form.placeholders.selectLocation"
                            )}
                          </option>
                          {locations.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                        {selectedLocation && (
                          <>
                            <label htmlFor="agentSearch">
                              {t("transferReceiptBook.form.searchAgents")}
                            </label>
                            <input
                              id="agentSearch"
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder={t(
                                "transferReceiptBook.form.placeholders.searchAgents"
                              )}
                              aria-label={t(
                                "transferReceiptBook.form.placeholders.searchAgents"
                              )}
                            />
                            <label htmlFor="agentSelect">
                              {t("transferReceiptBook.form.selectAgent")}
                            </label>
                            <select
                              id="agentSelect"
                              value={recipientID}
                              onChange={(e) => setRecipientID(e.target.value)}
                              aria-label={t(
                                "transferReceiptBook.form.placeholders.selectAgent"
                              )}
                            >
                              <option value="">
                                {t(
                                  "transferReceiptBook.form.placeholders.selectAgent"
                                )}
                              </option>
                              {filteredAgents().map((a) => (
                                <option key={a.agentID} value={a.agentID}>
                                  {a.name} ({a.phone})
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                      </>
                    )}
                    {recipientID && (
                      <p>
                        {t("transferReceiptBook.form.selectedAgent")}:{" "}
                        {agents.find((a) => a.agentID === recipientID)?.name +
                          " " +
                          agents.find((a) => a.agentID === recipientID)
                            ?.lastname || t("transferReceiptBook.loading")}
                      </p>
                    )}
                  </div>
                )}
                {recipientType === "Supplier" && (
                  <>
                    <div className="form-group">
                      <label htmlFor="supplierEmail">
                        {t("transferReceiptBook.form.supplierEmail")}
                      </label>
                      <input
                        id="supplierEmail"
                        type="email"
                        value={supplierEmail}
                        onChange={(e) => setSupplierEmail(e.target.value)}
                        placeholder={t(
                          "transferReceiptBook.form.placeholders.enterSupplierEmail"
                        )}
                        required
                        aria-label={t(
                          "transferReceiptBook.form.placeholders.enterSupplierEmail"
                        )}
                      />
                    </div>
                    <div className="form-group book-selection-section">
                      <label htmlFor="bookSearch">
                        {t("transferReceiptBook.form.selectBooks")}
                      </label>
                      <input
                        id="bookSearch"
                        type="text"
                        value={bookSearchQuery}
                        onChange={(e) => {
                          setBookSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder={t(
                          "transferReceiptBook.form.placeholders.searchBooks"
                        )}
                        aria-label={t(
                          "transferReceiptBook.form.placeholders.searchBooks"
                        )}
                      />
                      <ul className="book-list">
                        {filteredBooks.length > 0 ? (
                          filteredBooks.map((book) => (
                            <li
                              key={book.bookID}
                              className={
                                selectedBookIDs.includes(book.bookID)
                                  ? "checked"
                                  : ""
                              }
                            >
                              <label className="custom-checkbox-label">
                                <input
                                  type="checkbox"
                                  className="custom-checkbox-input"
                                  checked={selectedBookIDs.includes(
                                    book.bookID
                                  )}
                                  onChange={() =>
                                    handleBookSelection(book.bookID)
                                  }
                                />
                                <span className="custom-checkbox">
                                  <FaCheck
                                    className="check-icon"
                                    aria-hidden="true"
                                  />
                                </span>
                                <span className="checklist-text">
                                  {book.number} -{" "}
                                  {t(
                                    `transferReceiptBook.types.${book.type.toLowerCase()}`,
                                    { defaultValue: book.type }
                                  )}
                                </span>
                              </label>
                            </li>
                          ))
                        ) : (
                          <li className="no-data">
                            {t("transferReceiptBook.form.noBooksAvailable")}
                          </li>
                        )}
                      </ul>
                      {totalPages > 1 && (
                        <div className="pagination">
                          <button
                            type="button"
                            className="page-btn"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            aria-label={t(
                              "transferReceiptBook.pagination.aria.previous"
                            )}
                          >
                            <FaChevronLeft aria-hidden="true" />
                          </button>
                          <span className="page-info">
                            {t("transferReceiptBook.pagination.pageInfo", {
                              currentPage,
                              totalPages,
                            })}
                          </span>
                          <button
                            type="button"
                            className="page-btn"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            aria-label={t(
                              "transferReceiptBook.pagination.aria.next"
                            )}
                          >
                            <FaChevronRight aria-hidden="true" />
                          </button>
                        </div>
                      )}
                      <p>
                        {t("transferReceiptBook.form.selectedBooks", {
                          count: selectedBookIDs.length,
                        })}
                      </p>
                    </div>
                  </>
                )}
                {recipientType !== "Agent" &&
                  recipientType !== "Supplier" &&
                  recipientType !== "Archive" &&
                  recipientType !== "Stub Collection" &&
                  recipientType !== "Collect from Supplier" && (
                    <div className="form-group">
                      <label htmlFor="recipientSearch">
                        {t("transferReceiptBook.form.recipientSelection", {
                          type: recipientType,
                        })}
                      </label>
                      <input
                        id="recipientSearch"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t(
                          "transferReceiptBook.form.placeholders.searchRecipient"
                        )}
                        aria-label={t(
                          "transferReceiptBook.form.placeholders.searchRecipient"
                        )}
                      />
                      <label htmlFor="recipientSelect">
                        {t("transferReceiptBook.form.selectRecipient", {
                          type: recipientType,
                        })}
                      </label>
                      <select
                        id="recipientSelect"
                        value={recipientID}
                        onChange={(e) => setRecipientID(e.target.value)}
                        aria-label={t(
                          "transferReceiptBook.form.placeholders.selectRecipient",
                          {
                            type: recipientType,
                          }
                        )}
                      >
                        <option value="">
                          {t(
                            "transferReceiptBook.form.placeholders.selectRecipient",
                            {
                              type: recipientType,
                            }
                          )}
                        </option>
                        {filteredUsers().map((u) => (
                          <option key={u.userID} value={u.userID}>
                            {u.firstname} {u.lastname} ({u.phone})
                          </option>
                        ))}
                      </select>
                      {recipientID && (
                        <p>
                          {t("transferReceiptBook.form.selectedUser")}:{" "}
                          {
                            users.find((u) => u.userID === recipientID)
                              ?.firstname
                          }{" "}
                          {
                            users.find((u) => u.userID === recipientID)
                              ?.lastname
                          }
                        </p>
                      )}
                    </div>
                  )}
                {(recipientType === "Agent" ||
                  recipientType === "Stub Collection") &&
                  forceAgent && (
                    <div className="form-group">
                      <label>
                        {t("transferReceiptBook.form.selectedAgent")}
                      </label>
                      <p>
                        {agents.find((a) => a.agentID === recipientID)?.name +
                          " " +
                          agents.find((a) => a.agentID === recipientID)
                            ?.lastname || t("transferReceiptBook.loading")}
                      </p>
                    </div>
                  )}
                {recipientType !== "Supplier" &&
                  recipientType &&
                  (recipientID ||
                    recipientType === "Archive" ||
                    recipientType === "Stub Collection" ||
                    recipientType === "Collect from Supplier") && (
                    <div className="form-group qr-section">
                      <label>
                        {recipientType === "Collect from Supplier"
                          ? t("transferReceiptBook.form.scanCollect")
                          : recipientType === "Stub Collection"
                          ? t("transferReceiptBook.form.scanStub")
                          : t("transferReceiptBook.form.scanQR")}
                      </label>
                      {error && (
                        <div className="error-above-camera">{error}</div>
                      )}
                      <div
                        id="qr-reader"
                        ref={qrReaderRef}
                        className="qr-reader"
                      />
                      <div className="scanned-list">
                        <h4>
                          {t("transferReceiptBook.form.selectedBooks", {
                            count: selectedBookIDs.length,
                          })}
                        </h4>
                        <ul>
                          {selectedBookIDs.map((bookID) => {
                            const book = receiptBooks.find(
                              (r) => r.bookID === bookID
                            );
                            return (
                              <li key={bookID}>
                                {book?.number} (
                                {t(
                                  `common.receiptBookStatuses.${book?.status.toLowerCase()}`,
                                  { defaultValue: book?.status }
                                )}
                                )
                                <button
                                  onClick={() => {
                                    setSelectedBookIDs((prev) =>
                                      prev.filter((id) => id !== bookID)
                                    );
                                    setScannedQR((prev) =>
                                      prev.filter((qr) => qr !== book?.qrCode)
                                    );
                                    scannedQRRef.current.delete(
                                      book?.qrCode || ""
                                    );
                                  }}
                                  aria-label={t(
                                    "transferReceiptBook.actions.aria.removeBook",
                                    {
                                      number: book?.number,
                                    }
                                  )}
                                >
                                  X
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                        {scannedQR.length > 0 && (
                          <p>
                            {t("transferReceiptBook.list.scannedQRs", {
                              count: scannedQR.length,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                <div className="form-actions">
                  <button
                    type="button"
                    className="back-btn"
                    onClick={() => navigate(-1)}
                    aria-label={t("transferReceiptBook.actions.aria.back")}
                  >
                    <FaArrowLeft aria-hidden="true" />{" "}
                    {t("transferReceiptBook.actions.back")}
                  </button>
                  {recipientType &&
                    (recipientID ||
                      recipientType === "Supplier" ||
                      recipientType === "Archive" ||
                      recipientType === "Stub Collection" ||
                      recipientType === "Collect from Supplier") && (
                      <button
                        type="submit"
                        className="transfer-btn"
                        aria-label={
                          recipientType === "Stub Collection"
                            ? t("transferReceiptBook.actions.aria.initiateStub")
                            : recipientType === "Collect from Supplier"
                            ? t("transferReceiptBook.actions.aria.collect")
                            : t("transferReceiptBook.actions.aria.initiate")
                        }
                      >
                        <FaExchangeAlt aria-hidden="true" />{" "}
                        {recipientType === "Stub Collection"
                          ? t("transferReceiptBook.actions.initiateStub")
                          : recipientType === "Collect from Supplier"
                          ? t("transferReceiptBook.actions.collect")
                          : t("transferReceiptBook.actions.initiate")}
                      </button>
                    )}
                </div>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={handleValidateTransfer}>
            {recipientType !== "Archive" &&
              recipientType !== "Collect from Supplier" && (
                <div className="form-group">
                  <div className="otp-timer">
                    {t("transferReceiptBook.otpTimer")}:{" "}
                    <span className={otpTimer <= 30 ? "timer-warning" : ""}>
                      {formatTime(otpTimer)}
                    </span>
                  </div>
                  <label htmlFor="otpInput">
                    {t("transferReceiptBook.form.otp", {
                      type: recipientType,
                      details: recipientDetails,
                    })}
                  </label>
                  <input
                    id="otpInput"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder={t(
                      "transferReceiptBook.form.placeholders.enterOTP"
                    )}
                    required
                    aria-label={t(
                      "transferReceiptBook.form.placeholders.enterOTP"
                    )}
                  />
                </div>
              )}
            {error && <div className="error">{error}</div>}
            <div className="form-actions">
              <button
                type="button"
                className="back-btn"
                onClick={() => setTransferInitiated(false)}
                aria-label={t("transferReceiptBook.actions.aria.back")}
              >
                <FaArrowLeft aria-hidden="true" />{" "}
                {t("transferReceiptBook.actions.back")}
              </button>
              <button
                type="submit"
                className="validate-btn"
                aria-label={
                  recipientType === "Stub Collection"
                    ? t(
                        "transferReceiptBook.actions.aria.validateStubCollection"
                      )
                    : t("transferReceiptBook.actions.aria.validateTransfer")
                }
              >
                <FaCheck aria-hidden="true" />{" "}
                {recipientType === "Stub Collection"
                  ? t("transferReceiptBook.actions.validateStubCollection")
                  : t("transferReceiptBook.actions.validateTransfer")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TransferReceiptBook;
