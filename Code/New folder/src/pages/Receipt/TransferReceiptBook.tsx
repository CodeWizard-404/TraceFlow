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
  getAllUsers,
  getUserByPhone,
  getSupervisorsByRegionalManager,
  getUsersByRegion,
  getUsersByGovernorate,
  getUsersByDelegation,
  getUserById,
} from "../../apis/userAPI";
import {
  getAgentsByDelegation,
  getAgentLocations,
  getAgentByPhone,
  getAgentById,
} from "../../apis/agentAPI";
import {
  getAllRegions,
  getGovernoratesByRegion,
  getDelegationsByGovernorate,
  getAllDelegations,
  getGovernoratesByDelegation,
  getRegionsByGovernorate,
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
  const isSuperAdmin = userRoleSet.has(ROLES.SUPER_ADMIN);
  const isSupervisor = userRoleSet.has(ROLES.SUPERVISOR);

  const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
  const [receiptBookTypes, setReceiptBookTypes] = useState<ReceiptBookType[]>([]);
  const [selectedBookIDs, setSelectedBookIDs] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>("");
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [selectedDelegation, setSelectedDelegation] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");
  const [regionalManagers, setRegionalManagers] = useState<User[]>([]);
  const [selectedRegionalManager, setSelectedRegionalManager] = useState<string>("");
  const [recipientType, setRecipientType] = useState<string>("");
  const [recipientID, setRecipientID] = useState<string>("");
  const [supplierEmail, setSupplierEmail] = useState<string>("");
  const [agentPhone, setAgentPhone] = useState<string>("");
  const [agentSearch, setAgentSearch] = useState<string>("");
  const [supervisorSearch, setSupervisorSearch] = useState<string>("");
  const [supervisorPhone, setSupervisorPhone] = useState<string>("");
  const [regionalManagerSearch, setRegionalManagerSearch] = useState<string>("");
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

  const getTypeName = useCallback(
    (typeID: string) => {
      const type = receiptBookTypes.find((t) => t.typeID === typeID);
      return type ? type.name : t("transferReceiptBook.types.unknown");
    },
    [receiptBookTypes, t]
  );

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), ERROR_DISPLAY_DURATION);
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
      return agent ? `${agent.name} ${agent.lastname} (${agent.phone})` : t("transferReceiptBook.form.loading");
    } else if (recipientType === "Stub Collection") {
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
      if (recipientType === "Supplier") {
        return book.status === t("common.receiptBookStatuses.inStock") && book.currentHolderID === currentUserID;
      }
      if (recipientType === "Collect from Supplier") {
        return book.status === t("common.receiptBookStatuses.sentToSupplier");
      }
      return Array.from(userRoleSet).some((role) => {
        const rule = ROLE_TRANSFER_RULES[role as unknown as keyof typeof ROLE_TRANSFER_RULES];
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
          const typeID = text.slice(typeStart + 2, typeStart + 2 + typeLength);
          return { number, typeID };
        };
        const { number, typeID } = parseTLV(decodedText);
        const matchingBook = receiptBooks.find((r) => r.number === number && r.typeID === typeID);
        if (!matchingBook) {
          setError(t("transferReceiptBook.errors.qrNotFound", { number }));
          return;
        }
        if (scannedQRRef.current.has(decodedText) || selectedBookIDs.includes(matchingBook.bookID)) {
          setError(t("transferReceiptBook.errors.qrAlreadyScanned", { number }));
          return;
        }
        if (!isTransferable(matchingBook)) {
          setError(
            t("transferReceiptBook.errors.bookNotTransferable", {
              number,
              status: t(`common.receiptBookStatuses.${matchingBook.status.toLowerCase()}`, { defaultValue: matchingBook.status }),
            })
          );
          return;
        }
        if (
          recipientType === "Stub Collection" &&
          matchingBook.status !== t("common.receiptBookStatuses.assignedToAgent")
        ) {
          setError(t("transferReceiptBook.errors.invalidStubCollectionStatus", { number }));
          return;
        }
        if (
          recipientType === "Stock Manager" &&
          matchingBook.ReceiptStub?.status !== t("common.receiptBookStatuses.collected")
        ) {
          setError(t("transferReceiptBook.errors.stubNotCollected", { number }));
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
        const [booksData, usersData, locationsData, regionsData, typesData] = await Promise.all([
          getAllReceiptBooks(),
          getAllUsers(),
          getAgentLocations(),
          isSuperAdmin ? getAllRegions() : Promise.resolve([]),
          getAllReceiptBookTypes(), // NEW: Fetch receipt book types
        ]);
        setReceiptBooks(booksData);
        setUsers(usersData);
        setLocations(locationsData);
        setRegions(regionsData);
        setReceiptBookTypes(typesData); // NEW: Set types state
      } catch (err) {
        setError(t("transferReceiptBook.errors.fetchDataFailed"));
        console.error("Fetch Data Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userPermissions.canTransferReceiptBooks, isSuperAdmin, t]);

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
    async (delegationID: string) => {
      try {
        const agentsData = await getAgentsByDelegation(delegationID);
        setAgents(agentsData.agents);
      } catch (err) {
        setError(t("transferReceiptBook.errors.fetchAgentsFailed"));
        console.error(err);
      }
    },
    [t]
  );

  // Fetch Governorates when Region is Selected
  useEffect(() => {
    const fetchGovernorates = async () => {
      if (!selectedRegion) {
        setGovernorates([]);
        setSelectedGovernorate("");
        setDelegations([]);
        setSelectedDelegation("");
        setAgents([]);
        setSelectedAgent("");
        return;
      }
      try {
        const governoratesData = await getGovernoratesByRegion(selectedRegion);
        setGovernorates(governoratesData);
        setSelectedGovernorate(governoratesData.length === 1 ? governoratesData[0].governorateID : "");
        setDelegations([]);
        setSelectedDelegation("");
        setAgents([]);
        setSelectedAgent("");
      } catch (err) {
        setError(t("transferReceiptBook.errors.loadGovernorates"));
        console.error("Fetch governorates error:", err);
      }
    };
    fetchGovernorates();
  }, [selectedRegion, t]);

  // Fetch Delegations when Governorate is Selected
  useEffect(() => {
    const fetchDelegations = async () => {
      if (!selectedGovernorate) {
        setDelegations([]);
        setSelectedDelegation("");
        setAgents([]);
        setSelectedAgent("");
        return;
      }
      try {
        const delegationsData = await getDelegationsByGovernorate(selectedGovernorate);
        setDelegations(delegationsData);
        setSelectedDelegation(delegationsData.length === 1 ? delegationsData[0].delegationID : "");
        setAgents([]);
        setSelectedAgent("");
      } catch (err) {
        setError(t("transferReceiptBook.errors.loadDelegations"));
        console.error("Fetch delegations error:", err);
      }
    };
    fetchDelegations();
  }, [selectedGovernorate, t]);

  // Fetch Supervisors when Regional Manager is Selected
  useEffect(() => {
    const fetchSupervisors = async () => {
      if (!selectedRegionalManager) {
        setSupervisors([]);
        setSelectedSupervisor("");
        return;
      }
      try {
        const supervisorsData = await getSupervisorsByRegionalManager(selectedRegionalManager);
        setSupervisors(supervisorsData);
        setSelectedSupervisor(supervisorsData.length === 1 ? supervisorsData[0].userID : "");
      } catch (err) {
        setError(t("transferReceiptBook.errors.loadSupervisors"));
        console.error("Fetch supervisors error:", err);
      }
    };
    fetchSupervisors();
  }, [selectedRegionalManager, t]);

  // Fetch Regional Managers when Region is Selected
  useEffect(() => {
    const fetchRegionalManagers = async () => {
      if (!selectedRegion) {
        setRegionalManagers([]);
        setSelectedRegionalManager("");
        return;
      }
      try {
        const regionalManagersData = await getUsersByRegion(selectedRegion);
        const filteredRegionalManagers = regionalManagersData.filter((u) =>
          u.Roles?.some((role) => role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase())
        );
        setRegionalManagers(filteredRegionalManagers);
        setSelectedRegionalManager(filteredRegionalManagers.length === 1 ? filteredRegionalManagers[0].userID : "");
      } catch (err) {
        setError(t("transferReceiptBook.errors.loadRegionalManagers"));
        console.error("Fetch regional managers error:", err);
      }
    };
    fetchRegionalManagers();
  }, [selectedRegion, t]);

  // Fetch Supervisors when Governorate is Selected
  useEffect(() => {
    const fetchSupervisorsByGovernorate = async () => {
      if (!selectedGovernorate || selectedRegionalManager) {
        return;
      }
      try {
        const supervisorsData = await getUsersByGovernorate(selectedGovernorate);
        const filteredSupervisors = supervisorsData.filter((u) =>
          u.Roles?.some((role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase())
        );
        setSupervisors(filteredSupervisors);
        setSelectedSupervisor(filteredSupervisors.length === 1 ? filteredSupervisors[0].userID : "");
      } catch (err) {
        setError(t("transferReceiptBook.errors.loadSupervisors"));
        console.error("Fetch supervisors by governorate error:", err);
      }
    };
    fetchSupervisorsByGovernorate();
  }, [selectedGovernorate, selectedRegionalManager, t]);

  // Fetch Agents when Delegation is Selected
  useEffect(() => {
    const fetchAgents = async () => {
      if (!selectedDelegation) {
        setAgents([]);
        setSelectedAgent("");
        return;
      }
      try {
        const agentsData = await getAgentsByDelegation(selectedDelegation);
        setAgents(agentsData.agents);
        setSelectedAgent(agentsData.agents.length === 1 ? agentsData.agents[0].agentID : "");
      } catch (err) {
        setError(t("transferReceiptBook.errors.loadAgents"));
        console.error("Fetch agents error:", err);
      }
    };
    fetchAgents();
  }, [selectedDelegation, t]);

  // Debounced Fetch Agent by Phone
  useEffect(() => {
    if (!agentPhone || recipientType !== "Agent") return;
    const timeout = setTimeout(async () => {
      try {
        const agentData = await getAgentByPhone(agentPhone);
        if (!agentData) throw new Error("Agent not found");
        if (!agentData.delegationID) throw new Error("Agent has no delegation assigned");

        // Fetch supervisor
        let supervisor: User | null = null;
        if (agentData.supervisorID) {
          supervisor = await getUserById(agentData.supervisorID);
        } else {
          throw new Error("Agent has no supervisor assigned");
        }

        // Fetch delegation and verify
        const allDelegations = await getAllDelegations();
        const agentDelegation = allDelegations.find((del) => del.delegationID === agentData.delegationID);
        if (!agentDelegation) throw new Error("Delegation not found");

        // Fetch governorate and verify
        const governoratesData = await getGovernoratesByDelegation(agentData.delegationID);
        if (governoratesData.length === 0) throw new Error("No governorate found for delegation");
        if (governoratesData.length > 1) throw new Error("Multiple governorates found for delegation");

        // Fetch region
        const regionsData = await getRegionsByGovernorate(governoratesData[0].governorateID);
        if (regionsData.length === 0) throw new Error("No region found for governorate");
        if (regionsData.length > 1) throw new Error("Multiple regions found for governorate");

        // Set all fields
        setRecipientID(agentData.agentID);
        setAgents([agentData]);
        setAgentSearch(`${agentData.name || ""} ${agentData.lastname || ""}`);
        setSelectedDelegation(agentData.delegationID);
        setDelegations([agentDelegation]);
        setSelectedGovernorate(governoratesData[0].governorateID);
        setGovernorates(governoratesData);
        setSelectedRegion(regionsData[0].regionID);
        setRegions(regionsData);
        setSelectedSupervisor(supervisor.userID);
        setSupervisors([supervisor]);

        // Fetch and set regional managers
        const regionalManagersData = await getUsersByRegion(regionsData[0].regionID);
        const filteredRegionalManagers = regionalManagersData.filter((u) =>
          u.Roles?.some((role) => role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase())
        );
        setRegionalManagers(filteredRegionalManagers);
        setSelectedRegionalManager(filteredRegionalManagers.length === 1 ? filteredRegionalManagers[0].userID : "");

        setError(null);
      } catch (err: any) {
        setRecipientID("");
        setError(
          t("transferReceiptBook.errors.noAgentFound", { phone: agentPhone }) + `: ${err.message}`
        );
        console.error(err);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [agentPhone, recipientType, t]);

  // Debounced Fetch Supervisor by Phone
  useEffect(() => {
    if (!supervisorPhone || recipientType !== "Supervisor" || !isSuperAdmin) return;
    const timeout = setTimeout(async () => {
      try {
        const supervisor = await getUserByPhone(supervisorPhone);
        if (!supervisor.Roles?.some((role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase())) {
          throw new Error("User is not a supervisor");
        }
        setRecipientID(supervisor.userID);
        setSupervisors((prev) => prev.some((s) => s.userID === supervisor.userID) ? prev : [...prev, supervisor]);
        setSupervisorSearch(`${supervisor.firstname || ""} ${supervisor.lastname || ""}`);
        setError(null);
      } catch (err) {
        setRecipientID("");
        setError(
          t("transferReceiptBook.errors.noUserFound", { phone: supervisorPhone })
        );
        console.error(err);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [supervisorPhone, recipientType, isSuperAdmin, t]);

  // Debounced Fetch Regional Manager by Phone
  useEffect(() => {
    if (!regionalManagerSearch || recipientType !== "Regional Manager" || !isSuperAdmin) return;
    const timeout = setTimeout(async () => {
      try {
        const regionalManager = await getUserByPhone(regionalManagerSearch);
        if (!regionalManager.Roles?.some((role) => role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase())) {
          throw new Error("User is not a regional manager");
        }
        setRecipientID(regionalManager.userID);
        setRegionalManagers((prev) => prev.some((rm) => rm.userID === regionalManager.userID) ? prev : [...prev, regionalManager]);
        setRegionalManagerSearch(`${regionalManager.firstname || ""} ${regionalManager.lastname || ""}`);
        setError(null);
      } catch (err) {
        setRecipientID("");
        setError(
          t("transferReceiptBook.errors.noUserFound", { phone: regionalManagerSearch })
        );
        console.error(err);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [regionalManagerSearch, recipientType, isSuperAdmin, t]);

  const filteredAgents = useCallback(() => {
    if (!selectedDelegation) return [];
    return agents.filter(
      (a) =>
        `${a.name || ""} ${a.lastname || ""} ${a.phone || ""}`
          .toLowerCase()
          .includes(agentSearch.toLowerCase())
    );
  }, [agents, selectedDelegation, agentSearch]);

  const filteredSupervisors = useCallback(() => {
    return supervisors.filter(
      (s) =>
        `${s.firstname || ""} ${s.lastname || ""} ${s.phone || ""}`
          .toLowerCase()
          .includes(supervisorSearch.toLowerCase())
    );
  }, [supervisors, supervisorSearch]);

  const filteredRegionalManagers = useCallback(() => {
    return regionalManagers.filter(
      (rm) =>
        `${rm.firstname || ""} ${rm.lastname || ""} ${rm.phone || ""}`
          .toLowerCase()
          .includes(regionalManagerSearch.toLowerCase())
    );
  }, [regionalManagers, regionalManagerSearch]);

  const filteredUsers = useCallback(() => {
    return users.filter(
      (u) =>
        `${u.firstname || ""} ${u.lastname || ""} ${u.phone || ""}`
          .toLowerCase()
          .includes(regionalManagerSearch.toLowerCase())
    );
  }, [users, regionalManagerSearch]);
  const filteredBooks = useMemo(() => {
    const transferableBooks = receiptBooks
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
  }, [receiptBooks, bookSearchQuery, isTransferable, currentPage, getTypeName]);

  const totalPages = useMemo(() => {
    const transferableBooks = receiptBooks
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
                    setIsScannerRunning(false);
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
                {recipientType === "Agent" && !forceAgent && (
                  <div className="form-group">
                    <label htmlFor="agentPhone">
                      {t("transferReceiptBook.form.agentSelection")}
                    </label>
                    <input
                      id="agentPhone"
                      type="tel"
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
                        {isSuperAdmin && (
                          <>
                            <label htmlFor="regionalManager">
                              {t("transferReceiptBook.form.regionalManager")}
                            </label>
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
                              <option value="">
                                {t("transferReceiptBook.form.placeholders.regionalManagerSelect")}
                              </option>
                              {filteredRegionalManagers().map((rm) => (
                                <option key={rm.userID} value={rm.userID}>
                                  {rm.firstname} {rm.lastname} ({rm.phone})
                                </option>
                              ))}
                            </select>
                            <label htmlFor="supervisor">
                              {t("transferReceiptBook.form.supervisor")}
                            </label>
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
                              <option value="">
                                {t("transferReceiptBook.form.placeholders.supervisorSelect")}
                              </option>
                              {filteredSupervisors().map((s) => (
                                <option key={s.userID} value={s.userID}>
                                  {s.firstname} {s.lastname} ({s.phone})
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                        <label htmlFor="region">
                          {t("transferReceiptBook.form.region")}
                        </label>
                        <select
                          id="region"
                          value={selectedRegion}
                          onChange={(e) => {
                            setSelectedRegion(e.target.value);
                            setSelectedGovernorate("");
                            setSelectedDelegation("");
                            setSelectedAgent("");
                          }}
                          aria-label={t(
                            "transferReceiptBook.form.placeholders.selectRegion"
                          )}
                        >
                          <option value="">
                            {t(
                              "transferReceiptBook.form.placeholders.selectRegion"
                            )}
                          </option>
                          {regions.map((region) => (
                            <option key={region.regionID} value={region.regionID}>
                              {region.name}
                            </option>
                          ))}
                        </select>
                        <label htmlFor="governorate">
                          {t("transferReceiptBook.form.governorate")}
                        </label>
                        <select
                          id="governorate"
                          value={selectedGovernorate}
                          onChange={(e) => {
                            setSelectedGovernorate(e.target.value);
                            setSelectedDelegation("");
                            setSelectedAgent("");
                          }}
                          aria-label={t(
                            "transferReceiptBook.form.placeholders.selectGovernorate"
                          )}
                        >
                          <option value="">
                            {t(
                              "transferReceiptBook.form.placeholders.selectGovernorate"
                            )}
                          </option>
                          {governorates.map((gov) => (
                            <option key={gov.governorateID} value={gov.governorateID}>
                              {gov.name}
                            </option>
                          ))}
                        </select>
                        <label htmlFor="delegation">
                          {t("transferReceiptBook.form.delegation")}
                        </label>
                        <select
                          id="delegation"
                          value={selectedDelegation}
                          onChange={(e) => {
                            setSelectedDelegation(e.target.value);
                            setSelectedAgent("");
                          }}
                          aria-label={t(
                            "transferReceiptBook.form.placeholders.selectDelegation"
                          )}
                        >
                          <option value="">
                            {t(
                              "transferReceiptBook.form.placeholders.selectDelegation"
                            )}
                          </option>
                          {delegations.map((del) => (
                            <option key={del.delegationID} value={del.delegationID}>
                              {del.name}
                            </option>
                          ))}
                        </select>
                        {selectedDelegation && (
                          <>
                            <label htmlFor="agentSearch">
                              {t("transferReceiptBook.form.searchAgents")}
                            </label>
                            <input
                              id="agentSearch"
                              type="text"
                              value={agentSearch}
                              onChange={(e) => setAgentSearch(e.target.value)}
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
                                  {a.name} {a.lastname} ({a.phone})
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
                      <ul className="book-list">
                        {filteredBooks.length > 0 ? (
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
                                  {book.number} - {getTypeName(book.typeID)} {/* MODIFIED: Use type name */}
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
                {recipientType === "Regional Manager" && isSuperAdmin && (
                  <div className="form-group">
                    <label htmlFor="regionalManagerSearch">
                      {t("transferReceiptBook.form.recipientSelection", {
                        type: recipientType,
                      })}
                    </label>
                    <input
                      id="regionalManagerSearch"
                      type="text"
                      value={regionalManagerSearch}
                      onChange={(e) => setRegionalManagerSearch(e.target.value)}
                      placeholder={t(
                        "transferReceiptBook.form.placeholders.searchRecipient"
                      )}
                      aria-label={t(
                        "transferReceiptBook.form.placeholders.searchRecipient"
                      )}
                    />
                    <label htmlFor="regionalManagerSelect">
                      {t("transferReceiptBook.form.selectRecipient", {
                        type: recipientType,
                      })}
                    </label>
                    <select
                      id="regionalManagerSelect"
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
                      {filteredRegionalManagers().map((rm) => (
                        <option key={rm.userID} value={rm.userID}>
                          {rm.firstname} {rm.lastname} ({rm.phone})
                        </option>
                      ))}
                    </select>
                    {recipientID && (
                      <p>
                        {t("transferReceiptBook.form.selectedUser")}:{" "}
                        {
                          regionalManagers.find((rm) => rm.userID === recipientID)
                            ?.firstname
                        }{" "}
                        {
                          regionalManagers.find((rm) => rm.userID === recipientID)
                            ?.lastname
                        }
                      </p>
                    )}
                  </div>
                )}
                {recipientType === "Supervisor" && isSuperAdmin && (
                  <div className="form-group">
                    <label htmlFor="supervisorSearch">
                      {t("transferReceiptBook.form.recipientSelection", {
                        type: recipientType,
                      })}
                    </label>
                    <input
                      id="supervisorSearch"
                      type="text"
                      value={supervisorSearch}
                      onChange={(e) => setSupervisorSearch(e.target.value)}
                      placeholder={t(
                        "transferReceiptBook.form.placeholders.searchRecipient"
                      )}
                      aria-label={t(
                        "transferReceiptBook.form.placeholders.searchRecipient"
                      )}
                    />
                    <input
                      id="supervisorPhone"
                      type="tel"
                      value={supervisorPhone}
                      onChange={(e) => setSupervisorPhone(e.target.value)}
                      placeholder={t(
                        "transferReceiptBook.form.placeholders.enterSupervisorPhone"
                      )}
                      aria-label={t(
                        "transferReceiptBook.form.placeholders.enterSupervisorPhone"
                      )}
                    />
                    <label htmlFor="supervisorSelect">
                      {t("transferReceiptBook.form.selectRecipient", {
                        type: recipientType,
                      })}
                    </label>
                    <select
                      id="supervisorSelect"
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
                      {filteredSupervisors().map((s) => (
                        <option key={s.userID} value={s.userID}>
                          {s.firstname} {s.lastname} ({s.phone})
                        </option>
                      ))}
                    </select>
                    {recipientID && (
                      <p>
                        {t("transferReceiptBook.form.selectedUser")}:{" "}
                        {
                          supervisors.find((s) => s.userID === recipientID)
                            ?.firstname
                        }{" "}
                        {
                          supervisors.find((s) => s.userID === recipientID)
                            ?.lastname
                        }
                      </p>
                    )}
                  </div>
                )}
                {recipientType !== "Agent" &&
                  recipientType !== "Supplier" &&
                  recipientType !== "Regional Manager" &&
                  recipientType !== "Supervisor" &&
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
                        value={regionalManagerSearch}
                        onChange={(e) => setRegionalManagerSearch(e.target.value)}
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
                {recipientType !== "Supplier" && recipientType && (recipientID || recipientType === "Archive" || recipientType === "Stub Collection" || recipientType === "Collect from Supplier") && (
                  <div className="form-group qr-section">
                    <label>
                      {recipientType === "Collect from Supplier"
                        ? t("transferReceiptBook.form.scanCollect")
                        : recipientType === "Stub Collection"
                          ? t("transferReceiptBook.form.scanStub")
                          : t("transferReceiptBook.form.scanQR")}
                    </label>
                    {error && <div className="error-above-camera">{error}</div>}
                    <div id="qr-reader" ref={qrReaderRef} className="qr-reader" />
                    <div className="scanned-list">
                      <h4>{t("transferReceiptBook.form.selectedBooks", { count: selectedBookIDs.length })}</h4>
                      <ul>
                        {selectedBookIDs.map((bookID) => {
                          const book = receiptBooks.find((r) => r.bookID === bookID);
                          return (
                            <li key={bookID}>
                              {book?.number} ({t(`common.receiptBookStatuses.${book?.status.toLowerCase()}`, { defaultValue: book?.status })} - {getTypeName(book?.typeID || "")}) {/* MODIFIED: Include type name */}
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
                )}
                <div className="form-actions">
                  <button type="button" className="back-btn" onClick={() => navigate(-1)} aria-label={t("transferReceiptBook.actions.aria.back")}>
                    <FaArrowLeft aria-hidden="true" /> {t("transferReceiptBook.actions.back")}
                  </button>
                  {recipientType && (recipientID || recipientType === "Supplier" || recipientType === "Archive" || recipientType === "Stub Collection" || recipientType === "Collect from Supplier") && (
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