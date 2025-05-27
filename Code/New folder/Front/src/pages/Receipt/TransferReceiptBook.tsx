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
  getAllReceiptBookTypes,
} from "../../apis/receiptBookAPI";
import {
  collectStub,
  validateStubCollection,
  archiveStub,
} from "../../apis/receiptStubAPI";
import {
  getSupervisorsByRegionalManager,
  getRegionalManagerBySupervisor,
  getUsersByRegion,
  getUsersByGovernorate,
  getUsersByDelegation,
  getUsersByRole,
} from "../../apis/userAPI";
import {
  getAgentsByDelegation,
  getAgentByPhone,
  getAgentById,
  getAgentsByUser,
} from "../../apis/agentAPI";
import {
  getAllRegions,
  getGovernoratesByRegion,
  getDelegationsByGovernorate,
  getRegionsByUser,
  getGovernoratesByUser,
  getDelegationsByUser,
} from "../../apis/locationApi";
import "./TransferReceiptBook.css";
import ReceiptBook from "../../models/ReceiptBook";
import ReceiptBookType from "../../models/ReceiptBookType";
import User from "../../models/User";
import Agent from "../../models/Agent";
import Region from "../../models/Region";
import Governorate from "../../models/Governorate";
import Delegation from "../../models/Delegation";
import { useTranslation } from "react-i18next";
import { t } from "i18next";
import { debounce } from "lodash";

const PERMISSIONS = {
  ACCESS_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS,
  SEND_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_SEND_RECEIPT_BOOKS,
  COLLECT_SUPPLIER_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_COLLECT_SUPPLIER_RECEIPT_BOOKS,
  TRANSFER_RECEIPT_BOOKS: import.meta.env.VITE_PERMISSIONS_TRANSFER_RECEIPT_BOOKS,
  VALIDATE_RECEIPT_BOOKS_TRANSFER: import.meta.env.VITE_PERMISSIONS_VALIDATE_RECEIPT_BOOKS_TRANSFER,
  COLLECT_RECEIPT_STUBS: import.meta.env.VITE_PERMISSIONS_COLLECT_RECEIPT_STUBS,
  VALIDATE_RECEIPT_STUBS: import.meta.env.VITE_PERMISSIONS_VALIDATE_RECEIPT_STUBS,
  ARCHIVE_RECEIPT_STUBS: import.meta.env.VITE_PERMISSIONS_ARCHIVE_RECEIPT_STUBS,
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
    transferable: (book: ReceiptBook, userID: string, recipientType: string) =>
      (book.status === t("common.receiptBookStatuses.inStock") &&
        book.currentHolderID === userID &&
        recipientType === "ToSupplier") ||
      (book.status === t("common.receiptBookStatuses.collectFromSupplier") &&
        book.currentHolderID === userID &&
        recipientType === "ToRegionalManager"),
    recipientOptions: ["ToSupplier", "FromSupplier", "ToRegionalManager"],
  },
  [ROLES.REGIONAL_MANAGER]: {
    transferable: (book: ReceiptBook, userID: string, recipientType: string) => {
      const isValidStatus = [
        t("common.receiptBookStatuses.withRegionalManager"),
        t("common.receiptBookStatuses.stubCollected"),
      ].includes(book.status);
      const isHolderMatch = book.currentHolderID === userID;
      // Fallback to "pending" if translation fails
      const pendingStubStatus = t("common.receiptStubStatuses.pending").toLowerCase() === "common.receiptstubstatuses.pending"
        ? "pending"
        : t("common.receiptStubStatuses.pending").toLowerCase();
      const bookStubStatus = book.ReceiptStub?.status?.toLowerCase();
      const isPendingStub = bookStubStatus === pendingStubStatus;
      console.log(
        `REGIONAL_MANAGER transferable check for book ${book.number}: ` +
        `isValidStatus=${isValidStatus}, isHolderMatch=${isHolderMatch}, ` +
        `recipientType=${recipientType}, isPendingStub=${isPendingStub}, ` +
        `bookStubStatus=${bookStubStatus}, pendingStubStatus=${pendingStubStatus}, ` +
        `rawTranslatedPending=${t("common.receiptStubStatuses.pending")}`
      );
      return (
        isValidStatus &&
        isHolderMatch &&
        (recipientType !== "ToStockManager" || !isPendingStub)
      );
    },
    recipientOptions: ["ToRegionalManager", "ToSupervisor", "ToStockManager"],
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
      "ToAgent",
      "StubToSupervisor",
      "ToRegionalManager",
      "ToRegionalManagerFromSupervisor",
      "ToSupervisor",
      "ToStockManager",
    ],
  },
  [ROLES.STOCK_MANAGER]: {
    transferable: (book: ReceiptBook, userID: string, recipientType: string) => {
      // Fallback to "pending" if translation fails
      const pendingStubStatus = t("common.receiptStubStatuses.pending").toLowerCase() === "common.receiptstubstatuses.pending"
        ? "pending"
        : t("common.receiptStubStatuses.pending").toLowerCase();
      const bookStubStatus = book.ReceiptStub?.status?.toLowerCase();
      const isPendingStub = bookStubStatus === pendingStubStatus;
      const isValid = (
        book.status === t("common.receiptBookStatuses.withStockManager") &&
        book.currentHolderID === userID &&
        (recipientType === "Archived" ||
          (recipientType === "ToStockManager" && !isPendingStub))
      );
      console.log(
        `STOCK_MANAGER transferable check for book ${book.number}: ` +
        `isValid=${isValid}, recipientType=${recipientType}, ` +
        `isPendingStub=${isPendingStub}, bookStubStatus=${bookStubStatus}, ` +
        `pendingStubStatus=${pendingStubStatus}, ` +
        `rawTranslatedPending=${t("common.receiptStubStatuses.pending")}`
      );
      return isValid;
    },
    recipientOptions: ["ToStockManager", "Archived"],
  },
  [ROLES.SUPER_ADMIN]: {
    transferable: () => true,
    recipientOptions: [
      "ToSupplier",
      "FromSupplier",
      "ToRegionalManager",
      "ToSupervisor",
      "ToAgent",
      "StubToSupervisor",
      "ToRegionalManagerFromSupervisor",
      "ToStockManager",
      "Archived",
    ],
  },
};

const ITEMS_PER_PAGE = 6;
const OTP_EXPIRY_SECONDS = 600;

const TransferReceiptBook: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRoles, effectivePermissions, user } = useAuth();
  const { t } = useTranslation();

  if (!user) {
    return <div>{t("transferReceiptBook.errors.unknown")}</div>;
  }

  const { agentID: preSelectedAgentID, forceAgent, transferType } = (location.state as {
    agentID?: string;
    forceAgent?: boolean;
    transferType?: string;
  }) || {};
  const userRoleSet = new Set(userRoles?.map((role) => role.name) || []);
  const currentUserID = user.userID;
  const isSuperAdmin = userRoleSet.has(ROLES.SUPER_ADMIN);
  const isSupervisor = userRoleSet.has(ROLES.SUPERVISOR);
  const isRegionalManager = userRoleSet.has(ROLES.REGIONAL_MANAGER);

  const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
  const [booksLoading, setBooksLoading] = useState<boolean>(false);
  const [receiptBookTypes, setReceiptBookTypes] = useState<ReceiptBookType[]>([]);
  const [selectedBookIDs, setSelectedBookIDs] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState<boolean>(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("");
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [selectedDelegation, setSelectedDelegation] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");
  const [supervisorSearch, setSupervisorSearch] = useState<string>("");
  const [supervisorPhone, setSupervisorPhone] = useState<string>("");
  const [regionalManagers, setRegionalManagers] = useState<User[]>([]);
  const [selectedRegionalManager, setSelectedRegionalManager] = useState<string>("");
  const [regionalManagerSearch, setRegionalManagerSearch] = useState<string>("");
  const [recipientType, setRecipientType] = useState<string>("");
  const [recipientID, setRecipientID] = useState<string>("");
  const [supplierEmail, setSupplierEmail] = useState<string>("");
  const [agentPhone, setAgentPhone] = useState<string>("");
  const [agentSearch, setAgentSearch] = useState<string>("");
  const [bookSearchQuery, setBookSearchQuery] = useState<string>("");
  const [scannedQR, setScannedQR] = useState<string[]>([]);
  const [otp, setOtp] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [transferring, setTransferring] = useState<boolean>(false);
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
  const bookListRef = useRef<HTMLUListElement>(null);

  const userPermissions = useMemo(
    () => ({
      canAccessReceiptBooks: effectivePermissions?.some((p) => p.name === PERMISSIONS.ACCESS_RECEIPT_BOOKS),
      canSendReceiptBooks: effectivePermissions?.some((p) => p.name === PERMISSIONS.SEND_RECEIPT_BOOKS),
      canCollectSupplierReceiptBooks: effectivePermissions?.some((p) => p.name === PERMISSIONS.COLLECT_SUPPLIER_RECEIPT_BOOKS),
      canTransferReceiptBooks: effectivePermissions?.some((p) => p.name === PERMISSIONS.TRANSFER_RECEIPT_BOOKS),
      canValidateReceiptBooksTransfer: effectivePermissions?.some((p) => p.name === PERMISSIONS.VALIDATE_RECEIPT_BOOKS_TRANSFER),
      canCollectReceiptStubs: effectivePermissions?.some((p) => p.name === PERMISSIONS.COLLECT_RECEIPT_STUBS),
      canValidateReceiptStubs: effectivePermissions?.some((p) => p.name === PERMISSIONS.VALIDATE_RECEIPT_STUBS),
      canArchiveReceiptStubs: effectivePermissions?.some((p) => p.name === PERMISSIONS.ARCHIVE_RECEIPT_STUBS),
    }),
    [effectivePermissions]
  );

  const getTypeName = useCallback(
    (typeID: string) => {
      const type = receiptBookTypes.find((t) => t.typeID === typeID);
      return type ? type.name : t("transferReceiptBook.types.unknown");
    },
    [receiptBookTypes, t]
  );

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
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [error]);

  const recipientDetails = useMemo(() => {
    if (recipientType === "ToAgent") {
      const agent = agents.find((a) => a.agentID === recipientID);
      return agent ? `${agent.name} ${agent.lastname} (${agent.phone})` : t("transferReceiptBook.form.loading");
    } else if (recipientType === "StubToSupervisor") {
      const books = receiptBooks.filter((b) => selectedBookIDs.includes(b.bookID));
      const agentIDs = [...new Set(books.map((b) => b.agentID).filter((id) => id))];
      if (agentIDs.length !== 1) {
        return t("transferReceiptBook.form.multipleAgents");
      }
      const agent = agents.find((a) => a.agentID === agentIDs[0]);
      return agent ? `${agent.name} ${agent.lastname} (${agent.phone})` : t("transferReceiptBook.form.loading");
    } else {
      const user = users.find((u) => u.userID === recipientID);
      return user ? `${user.firstname} ${user.lastname} (${user.phone})` : t("transferReceiptBook.form.loading");
    }
  }, [recipientType, recipientID, users, agents, selectedBookIDs, receiptBooks, t]);

  const isTransferable = useCallback(
    (book: ReceiptBook) => {
      if (recipientType === "ToSupplier") {
        const isInStock = book.status.toLowerCase() === t("common.receiptBookStatuses.inStock").toLowerCase();
        const isHolderMatch = book.currentHolderID === currentUserID;
        console.log(`ToSupplier check for book ${book.number}: isInStock=${isInStock}, isHolderMatch=${isHolderMatch}, isSuperAdmin=${isSuperAdmin}`);
        return isInStock && (isSuperAdmin || isHolderMatch);
      }
      if (recipientType === "FromSupplier") {
        const isSentToSupplier = book.status.toLowerCase() === t("common.receiptBookStatuses.sentToSupplier").toLowerCase();
        console.log(`FromSupplier check for book ${book.number}: isSentToSupplier=${isSentToSupplier}`);
        return isSentToSupplier && (isSuperAdmin || userRoleSet.has(ROLES.PURCHASE_TEAM));
      }
      if (recipientType === "ToStockManager") {
        // Fallback to "pending" if translation fails
        const pendingStubStatus = t("common.receiptStubStatuses.pending").toLowerCase() === "common.receiptstubstatuses.pending"
          ? "pending"
          : t("common.receiptStubStatuses.pending").toLowerCase();
        const bookStubStatus = book.ReceiptStub?.status?.toLowerCase();
        const isPendingStub = bookStubStatus === pendingStubStatus;
        console.log(
          `ToStockManager check for book ${book.number}: ` +
          `isPendingStub=${isPendingStub}, bookStubStatus=${bookStubStatus}, ` +
          `pendingStubStatus=${pendingStubStatus}, ` +
          `rawTranslatedPending=${t("common.receiptStubStatuses.pending")}`
        );
        if (isPendingStub) {
          return false;
        }
      }
      return Array.from(userRoleSet).some((role) => {
        const rule = ROLE_TRANSFER_RULES[role as unknown as keyof typeof ROLE_TRANSFER_RULES];
        const isTransferable = rule && rule.transferable(book, currentUserID, recipientType);
        console.log(`Checking role ${role} for book ${book.number}: transferable=${isTransferable}, recipientType=${recipientType}, stubStatus=${book.ReceiptStub?.status}`);
        return isTransferable;
      });
    },
    [userRoleSet, currentUserID, recipientType, t, isSuperAdmin]
  );

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      try {
        console.log("Starting QR scan processing for:", decodedText);
        const parseTLV = (text: string) => {
          try {
            const numberLength = parseInt(text.slice(2, 4), 10);
            if (isNaN(numberLength) || numberLength < 0) {
              throw new Error("Invalid number length");
            }
            const number = text.slice(4, 4 + numberLength);
            const typeStart = 4 + numberLength + 2;
            const typeLength = parseInt(text.slice(typeStart, typeStart + 2), 10);
            if (isNaN(typeLength) || typeLength < 0) {
              throw new Error("Invalid type length");
            }
            const typeName = text.slice(typeStart + 2, typeStart + 2 + typeLength);
            if (typeName.length !== typeLength) {
              throw new Error(`Type length mismatch: expected ${typeLength}, got ${typeName.length}`);
            }
            console.log(`Parsed TLV: number=${number}, typeName=${typeName}`);
            return { number, typeName };
          } catch (error) {
            throw new Error(
              `Invalid QR code format: ${typeof error === "object" && error !== null && "message" in error
                ? (error as { message?: string }).message
                : String(error)
              }`
            );
          }
        };
        const { number, typeName } = parseTLV(decodedText);
        const typeObj = receiptBookTypes.find(
          (t) => t.name.trim().toLowerCase() === typeName.trim().toLowerCase()
        );
        console.log(`Found typeID: ${typeObj?.typeID}`);
        if (!typeObj) {
          console.log("Error: Type not found for typeName:", typeName);
          setError(t("transferReceiptBook.errors.typeNotFound", { typeName }));
          return;
        }
        const matchingBook = receiptBooks.find(
          (r) => r.number === number && r.typeID === typeObj.typeID
        );
        if (!matchingBook) {
          console.log("Error: Book not found for number:", number);
          setError(t("transferReceiptBook.errors.qrNotFound", { number }));
          return;
        }
        if (!isTransferable(matchingBook)) {
          console.log("Error: Book not transferable:", matchingBook.number);
          setError(t("transferReceiptBook.errors.bookNotTransferable", { number }));
          return;
        }
        if (recipientType === "Archived") {
          const stubStatus = matchingBook.ReceiptStub?.status?.toLowerCase();
          const notAllowedStatuses = ["pending", "archived"];
          if (stubStatus && notAllowedStatuses.includes(stubStatus)) {
            console.log("Error: Invalid stub status for archive:", stubStatus);
            setError(t("transferReceiptBook.errors.invalidStubStatusForArchive", { number: matchingBook.number }));
            return;
          }
        }
        if (recipientType === "ToAgent" && userRoleSet.has("Supervisor") && selectedBookIDs.length >= 1) {
          console.log("Error: Supervisor book limit reached");
          setError(t("transferReceiptBook.errors.supervisorLimit"));
          return;
        }
        setSelectedBookIDs((prev) => {
          if (prev.includes(matchingBook.bookID)) {
            console.log(`Book ${matchingBook.number} already selected`);
            return prev;
          }
          const newSelected = [...prev, matchingBook.bookID];
          console.log("Updated selectedBookIDs:", newSelected);
          return newSelected;
        });
        if (matchingBook.qrCode) {
          scannedQRRef.current.add(matchingBook.qrCode);
          setScannedQR((prev) => {
            if (prev.includes(matchingBook.qrCode)) {
              console.log(`QR code ${matchingBook.qrCode} already scanned`);
              return prev;
            }
            const newScanned = [...prev, matchingBook.qrCode];
            console.log("Updated scannedQR:", newScanned);
            return newScanned;
          });
        }
        console.log("Scan successful, resetting error");
        setError(null); // Clear any previous error on successful scan
      } catch (err) {
        console.error("QR Parse Error:", err);
        setError(t("transferReceiptBook.errors.invalidQR"));
      } finally {
        scanLockRef.current = false;
        console.log("Scan lock released");
      }
    },
    [isTransferable, recipientType, selectedBookIDs, receiptBooks, receiptBookTypes, t, userRoleSet]
  );

  useEffect(() => {
    if (preSelectedAgentID && forceAgent && !recipientType) {
      const initialRecipientType = transferType || "ToAgent";
      setRecipientType(initialRecipientType);
      setRecipientID(preSelectedAgentID);
      setAgentPhone("");
      const fetchAgent = async () => {
        try {
          const agent = await getAgentById(preSelectedAgentID);
          setAgents([agent!]);
        } catch (err) {
          setError(t("transferReceiptBook.errors.fetchAgentFailed"));
          console.error(err);
        }
      };
      fetchAgent();
    }
  }, [preSelectedAgentID, forceAgent, recipientType, transferType, t]);

  const stopScanner = useCallback(async () => {
    if (stopLockRef.current || !qrScannerRef.current || !isScannerRunning) return;
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
    if (stopLockRef.current || !qrReaderRef.current || isScannerRunning || isScannerStarting) return;
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
      !(recipientID || recipientType === "ToSupplier" || recipientType === "Archived" || recipientType === "StubToSupervisor" || recipientType === "FromSupplier") ||
      transferInitiated ||
      receiptBookTypes.length === 0 ||
      error
    ) {
      return;
    }
    startScanner();
    return () => {
      stopScanner();
    };
  }, [recipientType, recipientID, transferInitiated, startScanner, stopScanner, receiptBookTypes, error]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopScanner();
      } else if (
        recipientType &&
        recipientType !== "ToSupplier" &&
        (recipientID || recipientType === "Archived" || recipientType === "StubToSupervisor" || recipientType === "FromSupplier") &&
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
  }, [recipientType, recipientID, transferInitiated, startScanner, stopScanner]);

  useEffect(() => {
    if (transferInitiated && isScannerRunning) {
      stopScanner();
    }
  }, [transferInitiated, isScannerRunning, stopScanner]);

  useEffect(() => {
    if (!recipientType) return;

    const fetchBooks = async () => {
      setBooksLoading(true);
      try {
        const [booksResponse, typesData] = await Promise.all([
          getAllReceiptBooks(),
          getAllReceiptBookTypes(),
        ]);
        console.log("Fetched receiptBookTypes:", typesData);
        setReceiptBooks(Array.isArray(booksResponse) ? booksResponse : booksResponse.books || []);
        setReceiptBookTypes(typesData);
        if (typesData.length === 0) {
          setError(t("transferReceiptBook.errors.noTypesAvailable"));
        }
      } catch (err) {
        setError(t("transferReceiptBook.errors.fetchDataFailed"));
        console.error("Fetch Books Error:", err);
      } finally {
        setBooksLoading(false);
      }
    };

    fetchBooks();

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && receiptBooks.length === 0) {
          fetchBooks();
        }
      },
      { threshold: 0.1 }
    );
    if (bookListRef.current) {
      observer.observe(bookListRef.current);
    }
    return () => {
      if (bookListRef.current) {
        observer.unobserve(bookListRef.current);
      }
    };
  }, [recipientType, t]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!userPermissions.canAccessReceiptBooks && !userPermissions.canTransferReceiptBooks && !userPermissions.canArchiveReceiptStubs) {
        setError(t("transferReceiptBook.errors.accessDenied"));
        setLoading(false);
        return;
      }
      try {
        let regionsData: Region[] = [];
        if (isSupervisor && (recipientType === "ToAgent" || recipientType === "StubToSupervisor")) {
          const regionalManagers = await getRegionalManagerBySupervisor(currentUserID);
          const regionPromises = regionalManagers.map(rm => getRegionsByUser(rm.userID));
          const regionArrays = await Promise.all(regionPromises);
          regionsData = [...new Set(regionArrays.flat().map(r => JSON.stringify(r)))].map(r => JSON.parse(r));
        } else {
          regionsData = await getAllRegions();
        }
        setRegions(regionsData);
      } catch (err) {
        setError(t("transferReceiptBook.errors.fetchDataFailed"));
        console.error("Fetch Initial Data Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [userPermissions, isSupervisor, recipientType, currentUserID, t]);

  const getRecipientOptions = useCallback(() => {
    const options = new Set<string>();
    Array.from(userRoleSet).forEach((role) => {
      const rule = ROLE_TRANSFER_RULES[role as unknown as keyof typeof ROLE_TRANSFER_RULES];
      if (rule) {
        rule.recipientOptions.forEach((opt) => {
          if (
            (opt === "ToSupplier" && userPermissions.canSendReceiptBooks && userPermissions.canAccessReceiptBooks) ||
            (opt === "FromSupplier" && userPermissions.canCollectSupplierReceiptBooks && userPermissions.canAccessReceiptBooks) ||
            (opt === "Archived" && userPermissions.canArchiveReceiptStubs) ||
            (["ToAgent", "StubToSupervisor"].includes(opt) &&
              (isSupervisor || isSuperAdmin) &&
              userPermissions.canTransferReceiptBooks &&
              userPermissions.canValidateReceiptBooksTransfer &&
              userPermissions.canCollectReceiptStubs &&
              userPermissions.canValidateReceiptStubs) ||
            (["ToRegionalManager", "ToSupervisor", "ToStockManager"].includes(opt) &&
              (isRegionalManager || isSupervisor || isSuperAdmin || userRoleSet.has(ROLES.PURCHASE_TEAM)) &&
              userPermissions.canTransferReceiptBooks &&
              userPermissions.canValidateReceiptBooksTransfer) ||
            (opt === "ToRegionalManagerFromSupervisor" &&
              (isSupervisor || isSuperAdmin) &&
              userPermissions.canTransferReceiptBooks &&
              userPermissions.canValidateReceiptBooksTransfer)
          ) {
            options.add(opt);
          }
        });
      }
    });
    return Array.from(options);
  }, [userRoleSet, userPermissions, isSupervisor, isSuperAdmin, isRegionalManager]);

  useEffect(() => {
    const fetchUsers = async () => {
      const roleMap = {
        ToRegionalManager: ROLES.REGIONAL_MANAGER,
        ToSupervisor: ROLES.SUPERVISOR,
        ToStockManager: ROLES.STOCK_MANAGER,
        ToRegionalManagerFromSupervisor: ROLES.REGIONAL_MANAGER,
      };
      const role = roleMap[recipientType as keyof typeof roleMap];
      if (role) {
        setUsersLoading(true);
        try {
          let userList: User[] = [];
          if (isSupervisor) {
            if (recipientType === "ToRegionalManager" || recipientType === "ToRegionalManagerFromSupervisor") {
              userList = await getRegionalManagerBySupervisor(currentUserID);
            } else if (recipientType === "ToSupervisor") {
              userList = (await getUsersByRole(ROLES.SUPERVISOR)).filter(u => u.userID !== currentUserID);
            } else if (recipientType === "ToStockManager") {
              userList = await getUsersByRole(ROLES.STOCK_MANAGER);
            }
          } else if (isRegionalManager) {
            if (recipientType === "ToSupervisor") {
              userList = await getSupervisorsByRegionalManager(currentUserID);
            } else if (recipientType === "ToRegionalManager") {
              userList = (await getUsersByRole(ROLES.REGIONAL_MANAGER)).filter(u => u.userID !== currentUserID);
            } else if (recipientType === "ToStockManager") {
              userList = await getUsersByRole(ROLES.STOCK_MANAGER);
            }
          } else if (isSuperAdmin || userRoleSet.has(ROLES.PURCHASE_TEAM)) {
            userList = await getUsersByRole(role);
          }
          if (regionalManagerSearch) {
            userList = userList.filter(u =>
              u.userID !== currentUserID &&
              `${u.firstname} ${u.lastname} ${u.phone}`.toLowerCase().includes(regionalManagerSearch.toLowerCase())
            );
          }
          setUsers(userList);
          if (userList.length === 1) {
            setRecipientID(userList[0].userID);
          }
        } catch (err) {
          setError(t("transferReceiptBook.errors.fetchUsersFailed"));
        } finally {
          setUsersLoading(false);
        }
      }
    };
    fetchUsers();
  }, [recipientType, isSupervisor, isRegionalManager, isSuperAdmin, currentUserID, regionalManagerSearch, t]);

  useEffect(() => {
    const fetchRegionalManagers = async () => {
      if (!isSuperAdmin || !["ToAgent", "StubToSupervisor"].includes(recipientType)) return;
      setUsersLoading(true);
      let rmList: User[] = [];
      try {
        if (selectedSupervisor && selectedRegion) {
          const [supervisorRM, regionRM] = await Promise.all([
            getRegionalManagerBySupervisor(selectedSupervisor),
            getUsersByRegion(selectedRegion).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.REGIONAL_MANAGER))),
          ]);
          rmList = supervisorRM.filter(rm => regionRM.some(rrm => rrm.userID === rm.userID));
        } else if (selectedSupervisor) {
          rmList = await getRegionalManagerBySupervisor(selectedSupervisor);
        } else if (selectedRegion) {
          rmList = await getUsersByRegion(selectedRegion).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.REGIONAL_MANAGER)));
        } else {
          rmList = await getUsersByRole(ROLES.REGIONAL_MANAGER);
          rmList = rmList.filter(u => u.userID !== currentUserID);
        }
        if (regionalManagerSearch) {
          rmList = rmList.filter(rm => `${rm.firstname} ${rm.lastname} ${rm.phone}`.toLowerCase().includes(regionalManagerSearch.toLowerCase()));
        }
        setRegionalManagers(rmList);
        if (rmList.length === 1) {
          setSelectedRegionalManager(rmList[0].userID);
        }
      } catch (err) {
        setError(t("transferReceiptBook.errors.loadRegionalManagers"));
      } finally {
        setUsersLoading(false);
      }
    };
    fetchRegionalManagers();
  }, [recipientType, isSuperAdmin, selectedSupervisor, selectedRegion, regionalManagerSearch, t, currentUserID]);

  useEffect(() => {
    const fetchSupervisors = async () => {
      if (!isSuperAdmin || !["ToAgent", "StubToSupervisor"].includes(recipientType)) return;
      setUsersLoading(true);
      let supList: User[] = [];
      try {
        if (selectedRegionalManager || selectedGovernorate || selectedDelegation || selectedAgent) {
          const promises: Promise<User[]>[] = [];
          if (selectedRegionalManager) promises.push(getSupervisorsByRegionalManager(selectedRegionalManager));
          if (selectedGovernorate) promises.push(getUsersByGovernorate(selectedGovernorate).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.SUPERVISOR))));
          if (selectedDelegation) promises.push(getUsersByDelegation(selectedDelegation).then(users => users.filter(u => u.Roles?.some(r => r.name === ROLES.SUPERVISOR))));
          if (selectedAgent) promises.push(getAgentById(selectedAgent).then(agent => getUsersByRole(ROLES.SUPERVISOR).then(users => users.filter(u => u.userID === agent?.supervisorID))));
          const results = await Promise.all(promises);
          supList = results.reduce((acc, curr) => acc.filter(a => curr.some(c => c.userID === a.userID)), results[0] || []);
          supList = supList.filter(u => u.userID !== currentUserID);
        } else {
          supList = await getUsersByRole(ROLES.SUPERVISOR);
          supList = supList.filter(u => u.userID !== currentUserID);
        }
        if (supervisorSearch) {
          supList = supList.filter(s => `${s.firstname} ${s.lastname}`.toLowerCase().includes(supervisorSearch.toLowerCase()));
        }
        if (supervisorPhone && supervisorPhone.length === 8) {
          supList = supList.filter(s => s.phone === supervisorPhone);
        }
        setSupervisors(supList);
        if (supList.length === 1) {
          setSelectedSupervisor(supList[0].userID);
        }
      } catch (err) {
        setError(t("transferReceiptBook.errors.loadSupervisors"));
      } finally {
        setUsersLoading(false);
      }
    };
    fetchSupervisors();
  }, [recipientType, isSuperAdmin, selectedRegionalManager, selectedGovernorate, selectedDelegation, selectedAgent, supervisorSearch, supervisorPhone, t, currentUserID]);

  useEffect(() => {
    const fetchRegions = async () => {
      if (!["ToAgent", "StubToSupervisor"].includes(recipientType)) {
        setRegions([]);
        setSelectedRegion("");
        return;
      }
      try {
        let regionsData: Region[] = [];
        if (isSupervisor) {
          const regionalManagers = await getRegionalManagerBySupervisor(currentUserID);
          const regionPromises = regionalManagers.map(rm => getRegionsByUser(rm.userID));
          const regionArrays = await Promise.all(regionPromises);
          regionsData = [...new Set(regionArrays.flat().map(r => JSON.stringify(r)))].map(r => JSON.parse(r));
        } else if (isSuperAdmin && selectedRegionalManager) {
          regionsData = await getRegionsByUser(selectedRegionalManager);
        } else {
          regionsData = await getAllRegions();
        }
        setRegions(regionsData);
        if (regionsData.length === 1) {
          setSelectedRegion(regionsData[0].regionID);
        }
      } catch (err) {
        setError(t("transferReceiptBook.errors.loadRegions"));
      }
    };
    fetchRegions();
  }, [recipientType, isSupervisor, isSuperAdmin, selectedRegionalManager, currentUserID, t]);

  useEffect(() => {
    const fetchGovernorates = async () => {
      if (!selectedRegion || !["ToAgent", "StubToSupervisor"].includes(recipientType)) {
        setGovernorates([]);
        setSelectedGovernorate("");
        setDelegations([]);
        setSelectedDelegation("");
        return;
      }
      try {
        let govList: Governorate[] = await getGovernoratesByRegion(selectedRegion);
        if (isSupervisor || (isSuperAdmin && selectedSupervisor)) {
          const userID = isSupervisor ? currentUserID : selectedSupervisor;
          const userGovs = await getGovernoratesByUser(userID);
          govList = govList.filter(g => userGovs.some(ug => ug.governorateID === g.governorateID));
        }
        setGovernorates(govList);
        if (govList.length === 1) {
          setSelectedGovernorate(govList[0].governorateID);
        } else {
          setSelectedGovernorate("");
        }
        setDelegations([]);
        setSelectedDelegation("");
      } catch (err) {
        setError(t("transferReceiptBook.errors.loadGovernorates"));
      }
    };
    fetchGovernorates();
  }, [recipientType, selectedRegion, isSupervisor, isSuperAdmin, selectedSupervisor, currentUserID, t]);

  useEffect(() => {
    const fetchDelegations = async () => {
      if (!selectedGovernorate || !["ToAgent", "StubToSupervisor"].includes(recipientType)) {
        setDelegations([]);
        setSelectedDelegation("");
        setAgents([]);
        setSelectedAgent("");
        return;
      }
      try {
        let delList: Delegation[] = await getDelegationsByGovernorate(selectedGovernorate);
        if (isSupervisor || (isSuperAdmin && selectedSupervisor)) {
          const userID = isSupervisor ? currentUserID : selectedSupervisor;
          const userDels = await getDelegationsByUser(userID);
          delList = delList.filter(d => userDels.some(ud => ud.delegationID === d.delegationID));
        }
        setDelegations(delList);
        if (delList.length === 1) {
          setSelectedDelegation(delList[0].delegationID);
        } else {
          setSelectedDelegation("");
        }
      } catch (err) {
        setError(t("transferReceiptBook.errors.loadDelegations"));
      }
    };
    fetchDelegations();
  }, [recipientType, selectedGovernorate, isSupervisor, isSuperAdmin, selectedSupervisor, currentUserID, t]);

  useEffect(() => {
    const fetchAgents = async () => {
      if (recipientType !== "ToAgent" || !(agentPhone || selectedDelegation)) {
        setAgents([]);
        setSelectedAgent("");
        return;
      }
      setAgentsLoading(true);
      try {
        let agentList: Agent[] = [];
        if (selectedDelegation && (isSupervisor || selectedSupervisor)) {
          const userID = isSupervisor ? currentUserID : selectedSupervisor;
          const [delAgents, userAgents] = await Promise.all([
            getAgentsByDelegation(selectedDelegation),
            getAgentsByUser(userID),
          ]);
          agentList = delAgents.agents.filter(a => userAgents.agents.some(ua => ua.agentID === a.agentID));
        } else if (selectedDelegation) {
          agentList = (await getAgentsByDelegation(selectedDelegation)).agents;
        }
        setAgents(agentList);
        if (agentList.length === 1) {
          setSelectedAgent(agentList[0].agentID);
          setRecipientID(agentList[0].agentID);
        }
      } catch (err) {
        setError(t("transferReceiptBook.errors.loadAgents"));
      } finally {
        setAgentsLoading(false);
      }
    };
    if (!agentPhone) fetchAgents();
  }, [recipientType, selectedDelegation, selectedSupervisor, isSupervisor, currentUserID, t]);

  const fetchAgentByPhone = useCallback(
    debounce(async (phone: string) => {
      if (!phone || recipientType !== "ToAgent") return;
      setAgentsLoading(true);
      try {
        const agentData = await getAgentByPhone(phone);
        if (!agentData) throw new Error("Agent not found");
        if (isSupervisor || (isSuperAdmin && selectedSupervisor)) {
          const userID = isSupervisor ? currentUserID : selectedSupervisor;
          const supervisorAgents = await getAgentsByUser(userID);
          if (!supervisorAgents.agents.some(a => a.agentID === agentData.agentID)) {
            throw new Error("Agent not under selected supervisor");
          }
        }
        setAgents([agentData]);
        setSelectedAgent(agentData.agentID);
        setRecipientID(agentData.agentID);
        setAgentSearch(`${agentData.name || ""} ${agentData.lastname || ""}`);
      } catch (err) {
        setRecipientID("");
        setSelectedAgent("");
        setError(t("transferReceiptBook.errors.noAgentFound", { phone }));
        console.error(err);
      } finally {
        setAgentsLoading(false);
      }
    }, 500),
    [recipientType, isSupervisor, isSuperAdmin, selectedSupervisor, currentUserID, t]
  );

  useEffect(() => {
    fetchAgentByPhone(agentPhone);
  }, [agentPhone, fetchAgentByPhone]);

  const filteredAgents = useCallback(() => {
    if (!selectedDelegation) return [];
    return agents.filter((a) =>
      `${a.name || ""} ${a.lastname || ""} ${a.phone || ""}`.toLowerCase().includes(agentSearch.toLowerCase())
    );
  }, [agents, selectedDelegation, agentSearch]);

  const filteredSupervisors = useCallback(() => {
    return supervisors.filter((s) =>
      `${s.firstname || ""} ${s.lastname || ""} ${s.phone || ""}`.toLowerCase().includes(supervisorSearch.toLowerCase())
    );
  }, [supervisors, supervisorSearch]);

  const filteredRegionalManagers = useCallback(() => {
    return regionalManagers.filter((rm) =>
      `${rm.firstname || ""} ${rm.lastname || ""} ${rm.phone || ""}`.toLowerCase().includes(regionalManagerSearch.toLowerCase())
    );
  }, [regionalManagers, regionalManagerSearch]);

  const filteredUsers = useCallback(() => {
    return users.filter((u) =>
      `${u.firstname || ""} ${u.lastname || ""} ${u.phone || ""}`.toLowerCase().includes(regionalManagerSearch.toLowerCase())
    );
  }, [users, regionalManagerSearch]);

  const filteredBooks = useMemo(() => {
    console.log("Computing filteredBooks, selectedBookIDs:", selectedBookIDs);
    const booksArray = Array.isArray(receiptBooks)
      ? receiptBooks
      : receiptBooks && typeof receiptBooks === 'object' && 'books' in receiptBooks
        ? (receiptBooks as { books: ReceiptBook[] }).books
        : [];
    const transferableBooks = booksArray
      .filter((book) => isTransferable(book))
      .filter((book) => {
        const typeName = getTypeName(book.typeID).toLowerCase();
        return (
          book.number.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
          typeName.includes(bookSearchQuery.toLowerCase())
        );
      });
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return transferableBooks.slice(startIndex, endIndex);
  }, [receiptBooks, bookSearchQuery, isTransferable, currentPage, getTypeName, currentUserID, selectedBookIDs]);

  const totalPages = useMemo(() => {
    // Extract books array from receiptBooks, handling both array and object cases
    const booksArray = Array.isArray(receiptBooks)
      ? receiptBooks
      : receiptBooks && typeof receiptBooks === 'object' && 'books' in receiptBooks
        ? (receiptBooks as { books: ReceiptBook[] }).books
        : [];

    const transferableBooks = booksArray
      .filter((book) => isTransferable(book))
      .filter((book) => {
        const typeName = getTypeName(book.typeID).toLowerCase();
        return (
          book.number.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
          typeName.includes(bookSearchQuery.toLowerCase())
        );
      });
    return Math.max(1, Math.ceil(transferableBooks.length / ITEMS_PER_PAGE));
  }, [receiptBooks, bookSearchQuery, isTransferable, getTypeName]);

  const handleBookSelection = (bookID: string) => {
    setSelectedBookIDs((prev) => {
      const newSelected = prev.includes(bookID) ? prev.filter((id) => id !== bookID) : [...prev, bookID];
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

  const handleInitiateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBookIDs.length === 0) {
      setError(t("transferReceiptBook.errors.noBooksSelected"));
      return;
    }
    if (recipientType === "ToAgent" && userRoleSet.has("Supervisor") && selectedBookIDs.length > 1) {
      setError(t("transferReceiptBook.errors.supervisorLimit"));
      return;
    }
    if (!recipientType) {
      setError(t("transferReceiptBook.errors.noRecipientType"));
      return;
    }
    if (recipientType === "ToSupplier" && !supplierEmail) {
      setError(t("transferReceiptBook.errors.noSupplierEmail"));
      return;
    }
    if (recipientType === "ToAgent" && !recipientID) {
      setError(t("transferReceiptBook.errors.noAgentSelected"));
      return;
    }
    if (
      !["ToSupplier", "Archived", "StubToSupervisor", "FromSupplier"].includes(recipientType) &&
      !recipientID
    ) {
      setError(t("transferReceiptBook.errors.noRecipientSelected"));
      return;
    }
    setTransferring(true);
    try {
      if (recipientType === "ToSupplier") {
        await sendToSupplier(selectedBookIDs, supplierEmail);
        navigate(-1);
      } else if (recipientType === "StubToSupervisor") {
        await collectStub(selectedBookIDs);
        setTransferInitiated(true);
        setError(null);
      } else if (recipientType === "Archived") {
        await archiveStub(selectedBookIDs);
        navigate(-1);
      } else if (recipientType === "FromSupplier") {
        await collectFromSupplier(selectedBookIDs, currentUserID);
        navigate(-1);
      } else {
        const recipientTypeForAPI = recipientType === "ToAgent" ? "agent" : "user";
        await transfer(selectedBookIDs, recipientID, recipientTypeForAPI);
        setTransferInitiated(true);
        setError(null);
      }
    } catch (err) {
      setError(
        t("transferReceiptBook.errors.initiateFailed", {
          message: err instanceof Error ? err.message : t("transferReceiptBook.errors.unknown"),
        })
      );
      console.error(err);
    } finally {
      setTransferring(false);
    }
  };

  const handleValidateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipientType === "Archived" || recipientType === "FromSupplier") {
      navigate(-1);
      return;
    }
    if (!otp) {
      setError(t("transferReceiptBook.errors.noOTP"));
      return;
    }
    setTransferring(true);
    try {
      if (recipientType === "StubToSupervisor") {
        await validateStubCollection(selectedBookIDs, otp);
        navigate(-1);
      } else {
        const recipientTypeForAPI = recipientType === "ToAgent" ? "agent" : "user";
        await validateTransfer(selectedBookIDs, recipientID, otp, recipientTypeForAPI);
        navigate(-1);
      }
    } catch (err) {
      setError(
        t("transferReceiptBook.errors.validateFailed", {
          message: err instanceof Error ? err.message : t("transferReceiptBook.errors.unknown"),
        })
      );
      console.error(err);
    } finally {
      setTransferring(false);
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
        <button type="button" className="back-btn" onClick={() => navigate(-1)} aria-label={t("transferReceiptBook.actions.aria.back")}>
          <FaArrowLeft aria-hidden="true" /> {t("transferReceiptBook.actions.back")}
        </button>
      </div>
    );

  return (
    <div className="transfer-receipt-book-container" role="main">
      <header className="transfer-header">
        <h1>{t("transferReceiptBook.title", { roles: Array.from(userRoleSet).join(", ") })}</h1>
      </header>
      <div className="transfer-card">
        {!transferInitiated ? (
          <form onSubmit={handleInitiateTransfer}>
            {!forceAgent && (
              <div className="form-group">
                <label htmlFor="recipientType">{t("transferReceiptBook.form.recipientType")}</label>
                <select
                  id="recipientType"
                  value={recipientType}
                  onChange={(e) => {
                    stopScanner();
                    setIsScannerRunning(false);
                    setIsScannerStarting(false);
                    setRecipientType(e.target.value);
                    setRecipientID("");
                    setSupplierEmail("");
                    setAgentPhone("");
                    setAgentSearch("");
                    setSelectedRegion("");
                    setSelectedGovernorate("");
                    setSelectedDelegation("");
                    setSelectedSupervisor("");
                    setSupervisorSearch("");
                    setSupervisorPhone("");
                    setSelectedRegionalManager("");
                    setRegionalManagerSearch("");
                    setBookSearchQuery("");
                    setSelectedBookIDs([]);
                    setScannedQR([]);
                    scannedQRRef.current.clear();
                    setAgents([]);
                    setSupervisors([]);
                    setRegionalManagers([]);
                    setUsers([]);
                    setCurrentPage(1);
                  }}
                  required
                  aria-label={t("transferReceiptBook.form.placeholders.selectRecipientType")}
                >
                  <option value="">{t("transferReceiptBook.form.placeholders.selectRecipientType")}</option>
                  {getRecipientOptions().map((type) => (
                    <option key={type} value={type}>
                      {t(`transferReceiptBook.recipientTypes.${type.toLowerCase()}`, { defaultValue: type })}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {recipientType && (
              <>
                {recipientType === "ToAgent" && !forceAgent && (
                  <div className="form-group">
                    <label htmlFor="agentPhone">{t("transferReceiptBook.form.agentSelection")}</label>
                    <input
                      id="agentPhone"
                      type="tel"
                      value={agentPhone}
                      onChange={(e) => setAgentPhone(e.target.value)}
                      placeholder={t("transferReceiptBook.form.placeholders.enterAgentPhone")}
                      aria-label={t("transferReceiptBook.form.placeholders.enterAgentPhone")}
                    />
                    {!recipientID && (
                      <>
                        <p>{t("transferReceiptBook.form.or")}</p>
                        {isSuperAdmin && (
                          <>
                            <label htmlFor="regionalManager">{t("transferReceiptBook.form.regionalManager")}</label>
                            <input
                              type="text"
                              id="regional-manager-search"
                              placeholder={t("transferReceiptBook.form.placeholders.regionalManagerSearch")}
                              value={regionalManagerSearch}
                              onChange={(e) => setRegionalManagerSearch(e.target.value)}
                              className="search-input"
                              aria-label={t("transferReceiptBook.form.placeholders.regionalManagerSearch")}
                            />
                            <select
                              id="regionalManager"
                              value={selectedRegionalManager}
                              onChange={(e) => {
                                setSelectedRegionalManager(e.target.value);
                                setSelectedSupervisor("");
                                setSelectedRegion("");
                                setSelectedGovernorate("");
                                setSelectedDelegation("");
                                setSelectedAgent("");
                              }}
                              aria-label={t("transferReceiptBook.form.placeholders.regionalManagerSelect")}
                            >
                              <option value="">{t("transferReceiptBook.form.placeholders.regionalManagerSelect")}</option>
                              {filteredRegionalManagers().map((rm) => (
                                <option key={rm.userID} value={rm.userID}>
                                  {rm.firstname} {rm.lastname} ({rm.phone})
                                </option>
                              ))}
                            </select>
                            <label htmlFor="supervisor">{t("transferReceiptBook.form.supervisor")}</label>
                            <input
                              type="text"
                              id="supervisor-search"
                              placeholder={t("transferReceiptBook.form.placeholders.supervisorSearch")}
                              value={supervisorSearch}
                              onChange={(e) => setSupervisorSearch(e.target.value)}
                              className="search-input"
                              aria-label={t("transferReceiptBook.form.placeholders.supervisorSearch")}
                            />
                            <input
                              type="tel"
                              id="supervisor-phone"
                              placeholder={t("transferReceiptBook.form.placeholders.supervisorPhone")}
                              value={supervisorPhone}
                              onChange={(e) => setSupervisorPhone(e.target.value)}
                              className="search-input"
                              aria-label={t("transferReceiptBook.form.placeholders.supervisorPhone")}
                            />
                            <select
                              id="supervisor"
                              value={selectedSupervisor}
                              onChange={(e) => {
                                setSelectedSupervisor(e.target.value);
                                setSelectedRegion("");
                                setSelectedGovernorate("");
                                setSelectedDelegation("");
                                setSelectedAgent("");
                              }}
                              aria-label={t("transferReceiptBook.form.placeholders.supervisorSelect")}
                            >
                              <option value="">{t("transferReceiptBook.form.placeholders.supervisorSelect")}</option>
                              {filteredSupervisors().map((s) => (
                                <option key={s.userID} value={s.userID}>
                                  {s.firstname} {s.lastname} ({s.phone})
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                        <label htmlFor="region">{t("transferReceiptBook.form.region")}</label>
                        <select
                          id="region"
                          value={selectedRegion}
                          onChange={(e) => {
                            setSelectedRegion(e.target.value);
                            setSelectedGovernorate("");
                            setSelectedDelegation("");
                            setSelectedAgent("");
                          }}
                          aria-label={t("transferReceiptBook.form.placeholders.selectRegion")}
                        >
                          <option value="">{t("transferReceiptBook.form.placeholders.selectRegion")}</option>
                          {regions.map((region) => (
                            <option key={region.regionID} value={region.regionID}>
                              {region.name}
                            </option>
                          ))}
                        </select>
                        <label htmlFor="governorate">{t("transferReceiptBook.form.governorate")}</label>
                        <select
                          id="governorate"
                          value={selectedGovernorate}
                          onChange={(e) => {
                            setSelectedGovernorate(e.target.value);
                            setSelectedDelegation("");
                            setSelectedAgent("");
                          }}
                          aria-label={t("transferReceiptBook.form.placeholders.selectGovernorate")}
                          disabled={!selectedRegion}
                        >
                          <option value="">{t("transferReceiptBook.form.placeholders.selectGovernorate")}</option>
                          {governorates.map((gov) => (
                            <option key={gov.governorateID} value={gov.governorateID}>
                              {gov.name}
                            </option>
                          ))}
                        </select>
                        <label htmlFor="delegation">{t("transferReceiptBook.form.delegation")}</label>
                        <select
                          id="delegation"
                          value={selectedDelegation}
                          onChange={(e) => {
                            setSelectedDelegation(e.target.value);
                            setSelectedAgent("");
                          }}
                          aria-label={t("transferReceiptBook.form.placeholders.selectDelegation")}
                          disabled={!selectedGovernorate}
                        >
                          <option value="">{t("transferReceiptBook.form.placeholders.selectDelegation")}</option>
                          {delegations.map((del) => (
                            <option key={del.delegationID} value={del.delegationID}>
                              {del.name}
                            </option>
                          ))}
                        </select>
                        {selectedDelegation && (
                          <>
                            <label htmlFor="agentSearch">{t("transferReceiptBook.form.searchAgents")}</label>
                            <input
                              id="agentSearch"
                              type="text"
                              value={agentSearch}
                              onChange={(e) => setAgentSearch(e.target.value)}
                              placeholder={t("transferReceiptBook.form.placeholders.searchAgents")}
                              aria-label={t("transferReceiptBook.form.placeholders.searchAgents")}
                            />
                            <label htmlFor="agentSelect">{t("transferReceiptBook.form.selectAgent")}</label>
                            {agentsLoading ? (
                              <div className="skeleton-select">Loading...</div>
                            ) : (
                              <select
                                id="agentSelect"
                                value={recipientID}
                                onChange={(e) => {
                                  setSelectedAgent(e.target.value);
                                  setRecipientID(e.target.value);
                                }}
                                aria-label={t("transferReceiptBook.form.placeholders.selectAgent")}
                              >
                                <option value="">{t("transferReceiptBook.form.placeholders.selectAgent")}</option>
                                {filteredAgents().map((a) => (
                                  <option key={a.agentID} value={a.agentID}>
                                    {a.name} {a.lastname} ({a.phone})
                                  </option>
                                ))}
                              </select>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
                {recipientType === "ToSupplier" && (
                  <>
                    <div className="form-group">
                      <label htmlFor="supplierEmail">{t("transferReceiptBook.form.supplierEmail")}</label>
                      <input
                        id="supplierEmail"
                        type="email"
                        value={supplierEmail}
                        onChange={(e) => setSupplierEmail(e.target.value)}
                        placeholder={t("transferReceiptBook.form.placeholders.enterSupplierEmail")}
                        required
                        aria-label={t("transferReceiptBook.form.placeholders.enterSupplierEmail")}
                      />
                    </div>
                    <div className="form-group book-selection-section">
                      <label htmlFor="bookSearch">{t("transferReceiptBook.form.selectBooks")}</label>
                      <input
                        id="bookSearch"
                        type="text"
                        value={bookSearchQuery}
                        onChange={(e) => {
                          setBookSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder={t("transferReceiptBook.form.placeholders.searchBooks")}
                        aria-label={t("transferReceiptBook.form.placeholders.searchBooks")}
                      />
                      <div className="selection-controls">
                        <button
                          type="button"
                          className="select-all-btn"
                          onClick={() => {
                            const allBookIDs = receiptBooks
                              .filter((book) => isTransferable(book))
                              .filter((book) => {
                                const typeName = getTypeName(book.typeID).toLowerCase();
                                return (
                                  book.number.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
                                  typeName.includes(bookSearchQuery.toLowerCase())
                                );
                              })
                              .map((book) => book.bookID);
                            setSelectedBookIDs(allBookIDs);
                            const qrCodes = receiptBooks
                              .filter((book) => allBookIDs.includes(book.bookID))
                              .map((book) => book.qrCode)
                              .filter((qr): qr is string => !!qr);
                            setScannedQR(qrCodes);
                            qrCodes.forEach((qr) => scannedQRRef.current.add(qr));
                          }}
                          aria-label={t("transferReceiptBook.actions.aria.selectAll")}
                        >
                          {t("transferReceiptBook.actions.selectAll")}
                        </button>
                        <button
                          type="button"
                          className="deselect-all-btn"
                          onClick={() => {
                            setSelectedBookIDs([]);
                            setScannedQR([]);
                            scannedQRRef.current.clear();
                          }}
                          aria-label={t("transferReceiptBook.actions.aria.deselectAll")}
                          disabled={selectedBookIDs.length === 0}
                        >
                          {t("transferReceiptBook.actions.deselectAll")}
                        </button>
                      </div>
                      <ul className="book-list" ref={bookListRef}>
                        {booksLoading ? (
                          Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
                            <li key={index} className="skeleton-book-item">Loading...</li>
                          ))
                        ) : filteredBooks.length > 0 ? (
                          filteredBooks.map((book) => (
                            <li key={book.bookID} className={selectedBookIDs.includes(book.bookID) ? "checked" : ""}>
                              <label className="custom-checkbox-label">
                                <input
                                  type="checkbox"
                                  className="custom-checkbox-input"
                                  checked={selectedBookIDs.includes(book.bookID)}
                                  onChange={() => handleBookSelection(book.bookID)}
                                />
                                <span className="custom-checkbox">
                                  <FaCheck className="check-icon" aria-hidden="true" />
                                </span>
                                <span className="checklist-text">
                                  {book.number} - {getTypeName(book.typeID)} (Status: {t(`common.receiptBookStatuses.${book.status.toLowerCase()}`, { defaultValue: book.status })})
                                </span>
                              </label>
                            </li>
                          ))
                        ) : (
                          <li className="no-data">{t("transferReceiptBook.form.noBooksAvailable")}</li>
                        )}
                      </ul>
                      {totalPages > 1 && (
                        <div className="pagination">
                          <button
                            type="button"
                            className="page-btn"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            aria-label={t("transferReceiptBook.pagination.aria.previous")}
                          >
                            <FaChevronLeft aria-hidden="true" />
                          </button>
                          <span className="page-info">
                            {t("transferReceiptBook.pagination.pageInfo", { currentPage, totalPages })}
                          </span>
                          <button
                            type="button"
                            className="page-btn"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            aria-label={t("transferReceiptBook.pagination.aria.next")}
                          >
                            <FaChevronRight aria-hidden="true" />
                          </button>
                        </div>
                      )}
                      <p>{t("transferReceiptBook.form.selectedBooks", { count: selectedBookIDs.length })}</p>
                    </div>
                  </>
                )}
                {["ToRegionalManager", "ToSupervisor", "ToStockManager", "ToRegionalManagerFromSupervisor"].includes(recipientType) && (
                  <div className="form-group">
                    <label htmlFor="recipientSearch">
                      {t("transferReceiptBook.form.recipientSelection", { type: recipientType })}
                    </label>
                    <input
                      id="recipientSearch"
                      type="text"
                      value={regionalManagerSearch}
                      onChange={(e) => setRegionalManagerSearch(e.target.value)}
                      placeholder={t("transferReceiptBook.form.placeholders.searchRecipient")}
                      aria-label={t("transferReceiptBook.form.placeholders.searchRecipient")}
                    />
                    <label htmlFor="recipientSelect">
                      {t("transferReceiptBook.form.selectRecipient", { type: recipientType })}
                    </label>
                    {usersLoading ? (
                      <div className="skeleton-select">Loading...</div>
                    ) : (
                      <select
                        id="recipientSelect"
                        value={recipientID}
                        onChange={(e) => setRecipientID(e.target.value)}
                        aria-label={t("transferReceiptBook.form.placeholders.selectRecipient", { type: recipientType })}
                      >
                        <option value="">{t("transferReceiptBook.form.placeholders.selectRecipient", { type: recipientType })}</option>
                        {filteredUsers().map((u) => (
                          <option key={u.userID} value={u.userID}>
                            {u.firstname} {u.lastname} ({u.phone})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                {(recipientType === "ToAgent" || recipientType === "StubToSupervisor") && forceAgent && (
                  <div className="form-group">
                    <label>{t("transferReceiptBook.form.selectedAgent")}</label>
                    <p>
                      {agents.find((a) => a.agentID === recipientID)?.name +
                        " " +
                        agents.find((a) => a.agentID === recipientID)?.lastname || t("transferReceiptBook.form.loading")}
                    </p>
                  </div>
                )}
                {recipientType !== "ToSupplier" && recipientType && (recipientID || recipientType === "Archived" || recipientType === "StubToSupervisor" || recipientType === "FromSupplier") && (
                  <>
                    {error && (
                      <div className="error-above-camera">
                        {error}
                        <button
                          type="button"
                          className="dismiss-error-btn"
                          onClick={() => setError(null)}
                          aria-label={t("transferReceiptBook.actions.aria.dismissError")}
                        >
                          {t("transferReceiptBook.actions.dismissError")}
                        </button>
                      </div>
                    )}
                    <div className="form-group qr-section">
                      <label>
                        {recipientType === "FromSupplier"
                          ? t("transferReceiptBook.form.scanCollect")
                          : recipientType === "StubToSupervisor"
                            ? t("transferReceiptBook.form.scanStub")
                            : t("transferReceiptBook.form.scanQR")}
                      </label>
                      <div id="qr-reader" ref={qrReaderRef} className="qr-reader" />
                      <div className="scanned-list">
                        <h4>{t("transferReceiptBook.form.selectedBooks", { count: selectedBookIDs.length })}</h4>
                        <ul>
                          {selectedBookIDs.map((bookID) => {
                            const book = receiptBooks.find((r) => r.bookID === bookID);
                            return (
                              <li key={bookID}>
                                {book?.number} ({t(`common.receiptBookStatuses.${book?.status.toLowerCase()}`, { defaultValue: book?.status })} - {getTypeName(book?.typeID || "")})
                                <button
                                  onClick={() => {
                                    setSelectedBookIDs((prev) => prev.filter((id) => id !== bookID));
                                    setScannedQR((prev) => prev.filter((qr) => qr !== book?.qrCode));
                                    scannedQRRef.current.delete(book?.qrCode || "");
                                  }}
                                  aria-label={t("transferReceiptBook.actions.aria.removeBook", { number: book?.number })}
                                >
                                  X
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                        {scannedQR.length > 0 && (
                          <p>{t("transferReceiptBook.list.scannedQRs", { count: scannedQR.length })}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <div className="form-actions">
                  <button type="button" className="back-btn" onClick={() => navigate(-1)} aria-label={t("transferReceiptBook.actions.aria.back")}>
                    <FaArrowLeft aria-hidden="true" /> {t("transferReceiptBook.actions.back")}
                  </button>
                  {recipientType && (recipientID || recipientType === "ToSupplier" || recipientType === "Archived" || recipientType === "StubToSupervisor" || recipientType === "FromSupplier") && (
                    <button
                      type="submit"
                      className="transfer-btn"
                      disabled={transferring || selectedBookIDs.length === 0}
                      aria-label={
                        recipientType === "StubToSupervisor"
                          ? t("transferReceiptBook.actions.aria.initiateStub")
                          : recipientType === "FromSupplier"
                            ? t("transferReceiptBook.actions.aria.collect")
                            : t("transferReceiptBook.actions.aria.initiate")
                      }
                    >
                      {transferring ? (
                        <span className="spinner"></span>
                      ) : (
                        <FaExchangeAlt aria-hidden="true" />
                      )}{" "}
                      {recipientType === "StubToSupervisor"
                        ? t("transferReceiptBook.actions.initiateStub")
                        : recipientType === "FromSupplier"
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
            {recipientType !== "Archived" && recipientType !== "FromSupplier" && (
              <div className="form-group">
                <div className="otp-timer">
                  {t("transferReceiptBook.otpTimer")}:{" "}
                  <span className={otpTimer <= 30 ? "timer-warning" : ""}>
                    {formatTime(otpTimer)}
                  </span>
                </div>
                <label htmlFor="otpInput">
                  {t("transferReceiptBook.form.otp", { type: recipientType, details: recipientDetails })}
                </label>
                <input
                  id="otpInput"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder={t("transferReceiptBook.form.placeholders.enterOTP")}
                  required
                  aria-label={t("transferReceiptBook.form.placeholders.enterOTP")}
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
                <FaArrowLeft aria-hidden="true" /> {t("transferReceiptBook.actions.back")}
              </button>
              <button
                type="submit"
                className="validate-btn"
                disabled={transferring}
                aria-label={
                  recipientType === "StubToSupervisor"
                    ? t("transferReceiptBook.actions.aria.validateStubCollection")
                    : t("transferReceiptBook.actions.aria.validateTransfer")
                }
              >
                {transferring ? (
                  <span className="spinner"></span>
                ) : (
                  <FaCheck aria-hidden="true" />
                )}{" "}
                {recipientType === "StubToSupervisor"
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