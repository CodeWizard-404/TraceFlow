import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FaDownload, FaTrash, FaFilter, FaList, FaPlus, FaClock, FaChevronDown, FaSync, FaSort } from "react-icons/fa";
import Select from "react-select";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  ReportSchedule,
  GeneratedReport,
} from "../../models/Report";
import {
  generateReport,
  scheduleReport,
  downloadReport,
  listSchedules,
  listGeneratedReports,
  deleteSchedule,
  deleteGeneratedReport,
} from "../../apis/reportAPI";
import {
  getUsersByRole,
  getAllUsers,
} from "../../apis/userAPI";
import {
  getAllRegions,
  getAllGovernorates,
  getGovernoratesByRegion,
  getAllDelegations,
  getDelegationsByGovernorate,
} from "../../apis/locationApi";
import {
  getAllAgents,
  getAgentsByDelegation,
  getAgentsByUser,
} from "../../apis/agentAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { getAllReceiptBooks, getAllReceiptBookTypes, getReceiptBookHolders } from "../../apis/receiptBookAPI";
import { getUniqueValues } from "../../apis/logAPI";
import "../Receipt/ReceiptBooks.css";
import "../Admin/AdminDashboard.css";
import "./Reports.css";
import Agent from "../../models/Agent";
import Region from "../../models/Region";
import User from "../../models/User";
import Governorate from "../../models/Governorate";
import Delegation from "../../models/Delegation";
import { Reason } from "../../models/Reason";
import ReceiptBook from "../../models/ReceiptBook";
import ReceiptBookType from "../../models/ReceiptBookType";
import { useTranslation } from "react-i18next";
import { getAllRoles } from "../../apis/roleAPI";
import Role from "../../models/Role";

// Constants for report types and formats
const reportTypes = [
  "VisitSummary", "Timesheet", "ReceiptBookInventory", "StubCollection",
  "UserActivity", "Anomaly", "AgentPerformance", "RegionPerformance", "Full"
];
const formats = ["pdf", "excel"];
const visitStatusOptions = ["Pending", "Visited", "Validated", "Rejected"];

const reportStatusOptions: { [key: string]: string[] } = {
  VisitSummary: ["Pending", "Visited", "Validated", "Rejected"],
  Timesheet: ["Pending", "Visited", "Validated", "Rejected"],
  ReceiptBookInventory: [
    "In Stock",
    "Sent to Supplier",
    "Collect from Supplier",
    "With Regional Manager",
    "With Supervisor",
    "Assigned to Agent",
    "Stub Collected",
    "With Stock Manager",
    "Archived",
  ],
  StubCollection: ["pending", "collected", "archived"],
};

// Allowed filters for each report type
const allowedFilters: Record<string, string[]> = {
  VisitSummary: [
    "supervisorID", "agentID", "dateRange", "regionID", "governorateID",
    "delegationID", "visitType", "status", "visitReasons", "checklistCompleted",
    "visitDuration", "Anomalies"
  ],
  Timesheet: [
    "supervisorID", "regionalManagerID", "directorID", "dateRange", "status",
    "numberOfVisits", "totalHours", "aiSuggestions", "anomaliesDetected",
    "visitStatus", "weekNumber", "checklistCompleted"
  ],
  ReceiptBookInventory: [
    "dateRange", "regionID", "governorateID", "delegationID", "bookType",
    "status", "currentHolderName", "agentName", "assignmentStatus"
  ],
  StubCollection: [
    "agentID", "supervisorID", "dateRange", "status", "currentHolderName"
  ],
  UserActivity: [
    "roleID", "dateRange", "activityType", "userID", "status",
    "suspiciousActivity", "ipAddress"
  ],
  Anomaly: [
    "dateRange", "roleID", "userID", "affectedEntity",
    "severity", "route"
  ],
  AgentPerformance: [
    "supervisorID", "regionalManagerID", "agentID", "dateRange", "regionID",
    "governorateID", "delegationID", "numberOfVisits",
    "stubsCollected", "receiptBooksAssigned",
    "locationUpdated"
  ],
  RegionPerformance: [
    "regionalManagerID", "dateRange", "regionID", "governorateID",
    "delegationID", "numberOfVisits", "stubsCollected"
  ],
  Full: [
    "supervisorID", "regionalManagerID", "dateRange", "regionID", "agentID",
    "status", "visitReasons"
  ],
};

interface FilterValues {
  [key: string]: string | boolean | string[] | DateRangeFilter | number[] | RangeFilter | number;
}

interface DateRangeFilter {
  start: string;
  end: string;
}

interface RangeFilter {
  min: number;
  max: number;
}

// Accordion Component for collapsible sections
const Accordion: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="dropdown-unit dropdown-unit">
      <div className="dropdown-bar" onClick={() => setIsOpen(!isOpen)}>
        <h3>{t(`reports.accordion.${title.toLowerCase().replace(/\s/g, '')}`)}</h3>
        <FaChevronDown className={`chevron ${isOpen ? 'open' : ''}`} />
      </div>
      {isOpen && (
        <motion.div
          className="dropdown-body"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
};

const ReportingPage: React.FC = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<"scheduled" | "generated" | "generate" | "schedule">("scheduled");
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filter states for list view
  const [reportTypeFilter, setReportTypeFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");


  // Generate and Schedule view states
  const [selectedReportType, setSelectedReportType] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<"pdf" | "excel">("pdf");
  const [filterValues, setFilterValues] = useState<FilterValues>({});

  // Data for filters
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [regionalManagers, setRegionalManagers] = useState<User[]>([]);
  const [directors, setDirectors] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [holders, setHolders] = useState<User[]>([]);
  const [, setReceiptBooks] = useState<ReceiptBook[]>([]);
  const [receiptBookTypes, setReceiptBookTypes] = useState<ReceiptBookType[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const [logStatuses, setLogStatuses] = useState<string[]>([]);
  const [affectedEntities, setAffectedEntities] = useState<string[]>([]);
  const [severities, setSeverities] = useState<string[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalReport, setModalReport] = useState<GeneratedReport | null>(null);

  const [scheduledPage, setScheduledPage] = useState<number>(1);
  const [generatedPage, setGeneratedPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(20);

  // Track which selectors have been opened
  const [openedSelectors, setOpenedSelectors] = useState<Set<string>>(new Set());

  // State for schedule period
  const [schedulePeriod, setSchedulePeriod] = useState<"daily" | "weekly" | "monthly" | "yearly" | "custom" | "">("");
  const [customPeriodValue, setCustomPeriodValue] = useState("");
  const [customPeriodUnit, setCustomPeriodUnit] = useState<"minutes" | "hours" | "days" | "">("");


  interface ReportCardProps {
    type: "scheduled" | "generated";
    data: ReportSchedule | GeneratedReport;
    onDownload: (filePath: string) => void;
    onDelete: (id: string) => void;
  }

  interface ReportCardProps {
    type: "scheduled" | "generated";
    data: ReportSchedule | GeneratedReport;
    onDownload: (filePath: string) => void;
    onDelete: (id: string) => void;
  }

  const ReportCard = ({ type, data, onDownload, onDelete }: ReportCardProps) => {
    const { t } = useTranslation();
    let id: string, date: string, creatorName: string, additional: React.ReactNode | null;

    if (type === "scheduled") {
      const schedule = data as ReportSchedule;
      id = schedule.scheduleID;
      date = new Date(schedule.createdAt).toLocaleString();
      creatorName = schedule.Creator
        ? `${schedule.Creator.firstname} ${schedule.Creator.lastname}`
        : t("reports.unknownCreator");
      additional = <p>{t("reports.table.headers.cronExpression")}: {cronToReadable(schedule.cronExpression, t)}</p>;
    } else {
      const report = data as GeneratedReport;
      id = report.generatedReportID;
      date = new Date(report.generatedAt).toLocaleString();
      creatorName = report.Generator
        ? `${report.Generator.firstname} ${report.Generator.lastname}`
        : t("reports.unknownCreator");
      additional = null;
    }

    return (
      <div className="report-card">
        <div className="card-header">
          <h3>{t(`reports.types.${data.reportType.toLowerCase()}`)}</h3>
          <span>{t(`reports.formats.${data.format}`)}</span>
        </div>
        <div className="card-body">
          <p>{t("reports.table.headers.creator")}: {creatorName}</p>
          <p>
            {type === "scheduled" ? t("reports.table.headers.createdAt") : t("reports.table.headers.generatedAt")}: {date}
          </p>
          {additional}
        </div>
        <div className="card-footer">
          {type === "generated" && (
            <button
              onClick={() => onDownload((data as GeneratedReport).filePath)}
              className="action-btn download"
            >
              <FaDownload />
            </button>
          )}
          <button onClick={() => onDelete(id)} className="action-btn delete">
            <FaTrash />
          </button>
        </div>
      </div>
    );
  };

  interface PaginationProps {
    totalPages: number;
    currentPage: number;
    onPageChange: (page: number) => void;
  }

  const Pagination = ({ totalPages, currentPage, onPageChange }: PaginationProps) => {
    if (totalPages <= 1) return null;
    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
    return (
      <div className="pagination">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
          &lt;
        </button>
        {pageNumbers.map(number => (
          <button
            key={number}
            onClick={() => onPageChange(number)}
            className={number === currentPage ? "active" : ""}
          >
            {number}
          </button>
        ))}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          &gt;
        </button>
      </div>
    );
  };

  // Convert period to cron expression
  const getCronExpression = () => {
    switch (schedulePeriod) {
      case "daily":
        return "0 0 * * *";
      case "weekly":
        return "0 0 * * 0";
      case "monthly":
        return "0 0 1 * *";
      case "yearly":
        return "0 0 1 1 *";
      case "custom":
        if (!customPeriodValue || !customPeriodUnit) return "";
        const value = parseInt(customPeriodValue);
        if (isNaN(value) || value <= 0) return "";
        switch (customPeriodUnit) {
          case "minutes":
            return `*/${value} * * * *`;
          case "hours":
            return `0 */${value} * * *`;
          case "days":
            return `0 0 */${value} * *`;
          default:
            return "";
        }
      default:
        return "";
    }
  };

  const cronToReadable = (cron: string, t: Function): string => {
    const parts = cron.split(" ");
    if (parts.length !== 5) return "Invalid cron";
    if (parts[0] === "0" && parts[1] === "0" && parts[2] === "*" && parts[3] === "*" && parts[4] === "*") {
      return t("reports.schedule.daily");
    } else if (parts[0] === "0" && parts[1] === "0" && parts[2] === "*" && parts[3] === "*" && parts[4] === "0") {
      return t("reports.schedule.weekly");
    } else if (parts[0] === "0" && parts[1] === "0" && parts[2] === "1" && parts[3] === "*" && parts[4] === "*") {
      return t("reports.schedule.monthly");
    } else if (parts[0] === "0" && parts[1] === "0" && parts[2] === "1" && parts[3] === "1" && parts[4] === "*") {
      return t("reports.schedule.yearly");
    } else if (parts[0].startsWith("*/")) {
      const X = parts[0].slice(2);
      return `${X} ${t("reports.schedule.minutes")}`;
    } else if (parts[0] === "0" && parts[1].startsWith("*/")) {
      const X = parts[1].slice(2);
      return `${X} ${t("reports.schedule.hours")}`;
    } else if (parts[0] === "0" && parts[1] === "0" && parts[2].startsWith("*/")) {
      const X = parts[2].slice(2);
      return `${X} ${t("reports.schedule.days")}`;
    } else {
      return t("reports.schedule.custom");
    }
  };



  const ReportActionModal: React.FC<{
    report: GeneratedReport;
    onDownload: () => void;
    onDelete: () => void;
    onKeep: () => void;
  }> = ({ report, onDownload, onDelete, onKeep }) => {
    return (
      <div className="modal-overlay">
        <div className="rep-modal-content">
          <h3>{t("reports.modal.title")}</h3>
          <p>{t("reports.modal.message", { reportType: t(`reports.types.${report.reportType.toLowerCase()}`) })}</p>
          <div className="modal-actions">
            <button className="modal-btn download" onClick={onDownload}>
              <FaDownload /> {t("reports.modal.download")}
            </button>
            <button className="modal-btn delete" onClick={onDelete}>
              <FaTrash /> {t("reports.modal.delete")}
            </button>
            <button className="modal-btn keep" onClick={onKeep}>
              {t("reports.modal.keep")}
            </button>

          </div>
        </div>
      </div>
    );
  };



  // Handle selector click to fetch data lazily
  const handleSelectorClick = (filter: string) => {
    if (!openedSelectors.has(filter)) {
      setOpenedSelectors(prev => new Set(prev).add(filter));
    }
  };

  // Fetch filter data only when selector is opened
  const fetchFilterData = async (reportType: string) => {
    try {
      setLoading(true);
      const promises: Promise<any>[] = [];

      if (allowedFilters[reportType]?.includes("currentHolderName") && openedSelectors.has("currentHolderName")) {
        promises.push(
          getReceiptBookHolders().then((data) => {
            if (Array.isArray(data)) {
              setHolders(data);
            } else {
              console.error("Expected array for holders, got:", data);
              setHolders([]);
            }
          }).catch((err) => {
            console.error("Failed to fetch holders:", err);
            setHolders([]);
          })
        );
      }

      // Keep this if receiptBooks is needed for other filters (e.g., bookType)
      if (allowedFilters[reportType]?.includes("bookType") && openedSelectors.has("bookType")) {
        promises.push(
          getAllReceiptBooks().then((data) => {
            if (data.books && Array.isArray(data.books)) {
              setReceiptBooks(data.books); // Extract the books array
            } else {
              console.error("Expected object with books array for receiptBooks, got:", data);
              setReceiptBooks([]);
            }
          }).catch((err) => {
            console.error("Failed to fetch receiptBooks:", err);
            setReceiptBooks([]);
          })
        );
      }

      if (allowedFilters[reportType]?.includes("supervisorID") && openedSelectors.has("supervisorID")) {
        promises.push(getUsersByRole(import.meta.env.VITE_ROLES_SUPERVISOR).then(setSupervisors));
      }
      if (allowedFilters[reportType]?.includes("regionalManagerID") && openedSelectors.has("regionalManagerID")) {
        promises.push(getUsersByRole(import.meta.env.VITE_ROLES_REGIONAL_MANAGER).then(setRegionalManagers));
      }
      if (allowedFilters[reportType]?.includes("directorID") && openedSelectors.has("directorID")) {
        promises.push(getUsersByRole(import.meta.env.VITE_ROLES_DIRECTOR).then(setDirectors));
      }
      if ((allowedFilters[reportType]?.includes("agentID") || allowedFilters[reportType]?.includes("agentName")) && openedSelectors.has("agentID")) {
        promises.push(getAllAgents().then(data => setAgents(data.agents)));
      }
      if (allowedFilters[reportType]?.includes("regionID") && openedSelectors.has("regionID")) {
        promises.push(getAllRegions().then(setRegions));
      }
      if (allowedFilters[reportType]?.includes("governorateID") && openedSelectors.has("governorateID")) {
        promises.push(getAllGovernorates().then(setGovernorates));
      }
      if (allowedFilters[reportType]?.includes("delegationID") && openedSelectors.has("delegationID")) {
        promises.push(getAllDelegations().then(setDelegations));
      }
      if (allowedFilters[reportType]?.includes("visitReasons") && openedSelectors.has("visitReasons")) {
        promises.push(getAllReasons().then(setReasons));
      }
      if (allowedFilters[reportType]?.includes("bookType") && openedSelectors.has("bookType")) {
        promises.push(getAllReceiptBookTypes().then(setReceiptBookTypes));
      }
      if (allowedFilters[reportType]?.includes("currentHolderName") && openedSelectors.has("currentHolderName")) {
        promises.push(getAllReceiptBooks().then(setReceiptBooks));
      }
      if (allowedFilters[reportType]?.includes("roleID") && openedSelectors.has("roleID")) {
        promises.push(getAllRoles().then(setRoles));
      }
      if (allowedFilters[reportType]?.includes("activityType") && openedSelectors.has("activityType")) {
        promises.push(getUniqueValues("route").then(setActivityTypes));
      }
      if (allowedFilters[reportType]?.includes("status") && reportType === "UserActivity" && openedSelectors.has("status")) {
        promises.push(getUniqueValues("status").then(setLogStatuses));
      }
      if (allowedFilters[reportType]?.includes("affectedEntity") && openedSelectors.has("affectedEntity")) {
        promises.push(getUniqueValues("service").then(setAffectedEntities));
      }
      if (allowedFilters[reportType]?.includes("severity") && openedSelectors.has("severity")) {
        promises.push(getUniqueValues("level").then(setSeverities));
      }
      if (allowedFilters[reportType]?.includes("route") && openedSelectors.has("route")) {
        promises.push(getUniqueValues("route").then(setRoutes));
      }
      if (allowedFilters[reportType]?.includes("userID") && openedSelectors.has("userID")) {
        promises.push(getAllUsers().then(setUsers));
      }

      await Promise.all(promises);
    } catch (err) {
      setError(t("reports.errors.fetchFilterData"));
    } finally {
      setLoading(false);
    }
  };

  // Fetch schedules and reports
  const fetchData = async () => {
    setLoading(true);
    try {
      const [schedulesData, reportsData] = await Promise.all([
        listSchedules(),
        listGeneratedReports(),
      ]);
      setSchedules(schedulesData);
      setGeneratedReports(reportsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || t("reports.errors.fetchData"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [t]);

  // Fetch filter data when report type changes or selector is opened
  useEffect(() => {
    if (selectedReportType && openedSelectors.size > 0) {
      fetchFilterData(selectedReportType);
    }
    setFilterValues(prev => {
      const allowed = allowedFilters[selectedReportType] || [];
      const cleanedFilters: FilterValues = {};
      Object.keys(prev).forEach(key => {
        if (allowed.includes(key)) {
          cleanedFilters[key] = prev[key];
        }
      });
      return cleanedFilters;
    });
  }, [selectedReportType, openedSelectors]);

  // Fetch filtered agents when supervisor or delegation changes
  useEffect(() => {
    if (["VisitSummary", "AgentPerformance", "StubCollection"].includes(selectedReportType) && openedSelectors.has("agentID")) {
      const fetchFilteredAgents = async () => {
        try {
          setLoading(true);
          let filteredAgents: Agent[] = [];
          const supervisorID = filterValues.supervisorID as string;
          const delegationID = filterValues.delegationID as string;

          if (supervisorID && delegationID) {
            const [bySupervisor, byDelegation] = await Promise.all([
              getAgentsByUser(supervisorID),
              getAgentsByDelegation(delegationID),
            ]);
            filteredAgents = bySupervisor.agents.filter(agent =>
              byDelegation.agents.some(d => d.agentID === agent.agentID)
            );
          } else if (supervisorID) {
            const data = await getAgentsByUser(supervisorID);
            filteredAgents = data.agents;
          } else if (delegationID) {
            const data = await getAgentsByDelegation(delegationID);
            filteredAgents = data.agents;
          } else {
            const data = await getAllAgents();
            filteredAgents = data.agents;
          }
          setAgents(filteredAgents);
        } catch (err) {
          setError(t("reports.errors.fetchAgents"));
        } finally {
          setLoading(false);
        }
      };
      fetchFilteredAgents();
    }
  }, [filterValues.supervisorID, filterValues.delegationID, selectedReportType, openedSelectors, t]);

  // Fetch filtered governorates when region changes
  useEffect(() => {
    if (["VisitSummary", "AgentPerformance", "ReceiptBookInventory", "RegionPerformance"].includes(selectedReportType) && filterValues.regionID && openedSelectors.has("governorateID")) {
      const fetchFilteredGovernorates = async () => {
        try {
          setLoading(true);
          const data = await getGovernoratesByRegion(filterValues.regionID as string);
          setGovernorates(data);
        } catch (err) {
          setError(t("reports.errors.fetchGovernorates"));
        } finally {
          setLoading(false);
        }
      };
      fetchFilteredGovernorates();
    }
  }, [filterValues.regionID, selectedReportType, openedSelectors, t]);

  // Fetch filtered delegations when governorate changes
  useEffect(() => {
    if (["VisitSummary", "AgentPerformance", "ReceiptBookInventory", "RegionPerformance"].includes(selectedReportType) && filterValues.governorateID && openedSelectors.has("delegationID")) {
      const fetchFilteredDelegations = async () => {
        try {
          setLoading(true);
          const data = await getDelegationsByGovernorate(filterValues.governorateID as string);
          setDelegations(data);
        } catch (err) {
          setError(t("reports.errors.fetchDelegations"));
        } finally {
          setLoading(false);
        }
      };
      fetchFilteredDelegations();
    }
  }, [filterValues.governorateID, selectedReportType, openedSelectors, t]);

  // Add sort state for schedules and generated reports
  const [scheduleSort, setScheduleSort] = useState<keyof ReportSchedule>("createdAt");
  const [scheduleSortOrder, setScheduleSortOrder] = useState<"asc" | "desc">("desc");
  const [reportSort, setReportSort] = useState<keyof GeneratedReport>("generatedAt");
  const [reportSortOrder, setReportSortOrder] = useState<"asc" | "desc">("desc");

  const filteredSchedules = useMemo(() => {
    let result = [...schedules];
    if (reportTypeFilter) result = result.filter(s => s.reportType === reportTypeFilter);
    if (formatFilter) result = result.filter(s => s.format === formatFilter);
    if (dateStart && dateEnd) {
      result = result.filter(s => {
        const createdAt = new Date(s.createdAt).toISOString().split("T")[0];
        return createdAt >= dateStart && createdAt <= dateEnd;
      });
    }
    return result.sort((a, b) => {
      const key: keyof ReportSchedule = scheduleSort;
      const order = scheduleSortOrder === "asc" ? 1 : -1;
      // Use type assertion for dynamic property access
      if (a[key] === undefined || b[key] === undefined) return 0;
      if (a[key]! > b[key]!) return 1 * order;
      if (a[key]! < b[key]!) return -1 * order;
      return 0;
    });
  }, [schedules, reportTypeFilter, formatFilter, dateStart, dateEnd, scheduleSort, scheduleSortOrder]);

  const filteredGeneratedReports = useMemo(() => {
    let result = [...generatedReports];
    if (reportTypeFilter) result = result.filter(r => r.reportType === reportTypeFilter);
    if (formatFilter) result = result.filter(r => r.format === formatFilter);
    if (dateStart && dateEnd) {
      result = result.filter(r => {
        const generatedAt = new Date(r.generatedAt).toISOString().split("T")[0];
        return generatedAt >= dateStart && generatedAt <= dateEnd;
      });
    }
    return result.sort((a, b) => {
      const key: keyof GeneratedReport = reportSort;
      const order = reportSortOrder === "asc" ? 1 : -1;
      if (a[key] === undefined || b[key] === undefined) return 0;
      if (a[key]! > b[key]!) return 1 * order;
      if (a[key]! < b[key]!) return -1 * order;
      return 0;
    });
  }, [generatedReports, reportTypeFilter, formatFilter, dateStart, dateEnd, reportSort, reportSortOrder]);



  const SortCard: React.FC = () => {
    const { t } = useTranslation();

    const handleSortChange = (sortKey: keyof ReportSchedule | keyof GeneratedReport) => {
      if (view === "scheduled") {
        if (scheduleSort === sortKey) {
          setScheduleSortOrder(scheduleSortOrder === "asc" ? "desc" : "asc");
        } else {
          setScheduleSort(sortKey as keyof ReportSchedule);
          setScheduleSortOrder("asc");
        }
      } else {
        if (reportSort === sortKey) {
          setReportSortOrder(reportSortOrder === "asc" ? "desc" : "asc");
        } else {
          setReportSort(sortKey as keyof GeneratedReport);
          setReportSortOrder("asc");
        }
      }
    };

    return (
      <div className="filter-card">
        <h3>{t("reports.sort.title")}</h3>
        <div className="form-group">
          <label className="filter-label">{t("reports.sort.by")}</label>
          <Select
            options={[
              { value: view === "scheduled" ? "createdAt" : "generatedAt", label: t("reports.sort.date") },
              { value: "reportType", label: t("reports.sort.type") },
              { value: "format", label: t("reports.sort.format") },
            ]}
            value={{
              value: view === "scheduled" ? scheduleSort : reportSort,
              label: t(`reports.sort.${view === "scheduled" ? (scheduleSort === "createdAt" ? "date" : scheduleSort) : (reportSort === "generatedAt" ? "date" : reportSort)}`),
            }}
            onChange={(option) => option && handleSortChange(option.value as keyof ReportSchedule | keyof GeneratedReport)}
            className="react-select-container"
            classNamePrefix="react-select"
            isSearchable={false}
          />
        </div>
        <div className="form-group">
          <label className="filter-label">{t("reports.sort.order")}</label>
          <button
            onClick={() => handleSortChange(view === "scheduled" ? scheduleSort : reportSort)}
            className="action-btn sort"
            title={t(`reports.sort.${(view === "scheduled" ? scheduleSortOrder : reportSortOrder) === "asc" ? "descending" : "ascending"}`)}
          >
            <FaSort /> {t(`reports.sort.${(view === "scheduled" ? scheduleSortOrder : reportSortOrder) === "asc" ? "ascending" : "descending"}`)}
          </button>
        </div>
      </div>
    );
  };


  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const validatedFilters: FilterValues = { ...filterValues };
      if (selectedReportType === "VisitSummary" && filterValues.visitType === false) {
        validatedFilters.visitType = "recrutementVisits";
      }

      // Generate the report
      const response = await generateReport({
        reportType: selectedReportType,
        filters: validatedFilters,
        format: selectedFormat,
      });

      // Refresh the generated reports list
      const reports = await listGeneratedReports();
      setGeneratedReports(reports);

      // Log response and reports for debugging
      console.log("Generate report response:", response);
      console.log("Fetched reports:", reports);

      // Find the newest report (assuming reports are sorted by generatedAt descending)
      const newReport = reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0];

      if (newReport) {
        console.log("New report found:", newReport);
        setModalReport(newReport);
        setIsModalOpen(true);
      } else {
        console.error("No reports found after generation");
        setError(t("reports.errors.findReport"));
      }

      setError(null);
    } catch (err: any) {
      console.error(`Generate report failed: ${err.message}`);
      setError(err.message || t("reports.errors.generateReport"));
    } finally {
      setLoading(false);
    }
  };


  const handleModalDownload = async () => {
    if (!modalReport) return;
    await handleDownloadReport(modalReport.filePath);
    setIsModalOpen(false);
    setModalReport(null);
    setLoading(true);
    try {
      const reports = await listGeneratedReports();
      setGeneratedReports(reports);
      setError(null);
    } catch (err: any) {
      setError(err.message || t("reports.errors.fetchData"));
    } finally {
      setLoading(false);
    }
  };

  const handleModalDelete = async () => {
    if (!modalReport) return;
    await handleDeleteGeneratedReport(modalReport.generatedReportID);
    setIsModalOpen(false);
    setModalReport(null);
  };

  const handleModalKeep = async () => {
    setIsModalOpen(false);
    setModalReport(null);
    setLoading(true);
    try {
      const reports = await listGeneratedReports();
      setGeneratedReports(reports);
      setError(null);
    } catch (err: any) {
      setError(err.message || t("reports.errors.fetchData"));
    } finally {
      setLoading(false);
    }
  };



  const handleScheduleReport = async () => {
    const cron = getCronExpression();
    if (!cron) {
      setError(t("reports.errors.cronRequired"));
      return;
    }
    setLoading(true);
    try {
      const validatedFilters: FilterValues = { ...filterValues };
      if (selectedReportType === "VisitSummary" && filterValues.visitType === false) {
        validatedFilters.visitType = "recrutementVisits";
      }
      await scheduleReport({
        reportType: selectedReportType,
        filters: validatedFilters,
        format: selectedFormat,
        cronExpression: cron,
      });
      const schedulesData = await listSchedules();
      setSchedules(schedulesData);
      setSchedulePeriod("");
      setCustomPeriodValue("");
      setCustomPeriodUnit("");
      setError(null);
    } catch (err: any) {
      setError(err.message || t("reports.errors.scheduleReport"));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (filePath: string) => {
    try {
      const response = await downloadReport(filePath);
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filePath.split("/").pop() || "report");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      setError(err.message || t("reports.errors.download"));
    }
  };

  const handleDeleteSchedule = async (scheduleID: string) => {
    if (window.confirm(t("reports.confirmDelete"))) {
      try {
        await deleteSchedule(scheduleID);
        setSchedules(schedules.filter(schedule => schedule.scheduleID !== scheduleID));
      } catch (err: any) {
        setError(err.message || t("reports.errors.deleteSchedule"));
      }
    }
  };

  const handleDeleteGeneratedReport = async (reportID: string) => {
    if (window.confirm(t("reports.confirmDelete"))) {
      try {
        await deleteGeneratedReport(reportID);
        setGeneratedReports(generatedReports.filter(report => report.generatedReportID !== reportID));
      } catch (err: any) {
        setError(err.message || t("reports.errors.deleteReport"));
      }
    }
  };

  const validateIPAddress = (ip: string): boolean => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  const renderFilterForm = () => (
    <div className="filter-card">
      <h3>{t("reports.filter.title")}</h3>
      <div className="form-group">
        <label className="filter-label">{t("reports.filter.reportType")}</label>
        <Select
          options={reportTypes.map(type => ({ value: type, label: t(`reports.types.${type.toLowerCase()}`) }))}
          value={reportTypeFilter ? { value: reportTypeFilter, label: t(`reports.types.${reportTypeFilter.toLowerCase()}`) } : null}
          onChange={(option) => setReportTypeFilter(option?.value || "")}
          placeholder={t("reports.filter.placeholders.type")}
          isClearable
          isSearchable
          className="react-select-container"
          classNamePrefix="react-select"
        />
      </div>
      <div className="form-group">
        <label className="filter-label">{t("reports.filter.format")}</label>
        <div className="button-group">
          {formats.map(fmt => (
            <button
              key={fmt}
              className={`toggle-btn ${formatFilter === fmt ? 'active' : ''}`}
              onClick={() => setFormatFilter(fmt)}
            >
              {t(`reports.formats.${fmt}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group form-group-d">
        <label className="filter-label">{t("reports.filter.dateRange")}</label>
        <div className="date-picker-container form-group-d">
          <DatePicker
            selected={dateStart ? new Date(dateStart) : null}
            onChange={(date: Date | null) => date ? setDateStart(date.toISOString().split("T")[0]) : setDateStart("")}
            placeholderText={t("reports.filter.placeholders.startDate")}
            className="date-input"
          />
          <DatePicker
            selected={dateEnd ? new Date(dateEnd) : null}
            onChange={(date: Date | null) => date ? setDateEnd(date.toISOString().split("T")[0]) : setDateEnd("")}
            placeholderText={t("reports.filter.placeholders.endDate")}
            className="date-input"
          />
        </div>
      </div>
    </div>
  );

  const renderGenerateForm = () => {
    const filters = selectedReportType ? allowedFilters[selectedReportType] || [] : [];

    const filterSections = [
      { title: "Date Range", filters: ["dateRange"].filter(f => filters.includes(f)) },
      { title: "User Selection", filters: ["supervisorID", "regionalManagerID", "directorID", "agentID", "userID"].filter(f => filters.includes(f)) },
      { title: "Location", filters: ["regionID", "governorateID", "delegationID"].filter(f => filters.includes(f)) },
      {
        title: "Other Filters",
        filters: filters.filter(f => !["dateRange", "supervisorID", "regionalManagerID", "directorID", "agentID", "userID", "regionID", "governorateID", "delegationID"].includes(f)),
      },
    ].filter(section => section.filters.length > 0);

    const renderRangeInput = (filter: string, label: string) => (
      <div className="form-group range-group">
        <label className="filter-label">{t(`reports.filters.${filter}`)}</label>
        <div className="range-inputs flex gap-2">
          <input
            type="number"
            value={(filterValues[filter] as RangeFilter)?.min || ""}
            onChange={(e) => setFilterValues(prev => ({
              ...prev,
              [filter]: { ...prev[filter] as RangeFilter, min: Number(e.target.value) }
            }))}
            className="range-input"
            placeholder={t("reports.filter.placeholders.min")}
          />
          <span className="range-divider">-</span>
          <input
            type="number"
            value={(filterValues[filter] as RangeFilter)?.max || ""}
            onChange={(e) => setFilterValues(prev => ({
              ...prev,
              [filter]: { ...prev[filter] as RangeFilter, max: Number(e.target.value) }
            }))}
            className="range-input"
            placeholder={t("reports.filter.placeholders.max")}
          />
        </div>
      </div>
    );

    const renderBooleanToggle = (filter: string, label: string) => (
      <div className="form-group toggle-group">
        <label className="filter-label">{t(`reports.filters.${filter}`)}</label>
        <div
          className={`toggle-switch-2 toggle-switch ${filterValues[filter] ? 'active' : ''}`}
          onClick={() => setFilterValues(prev => ({ ...prev, [filter]: !prev[filter] }))}
        >
          <span className="toggle-slider"></span>
        </div>
      </div>
    );

    return (
      <div className="form-card">
        <div className="form-header">
          <h3>{t("reports.generate.title")}</h3>
          {filters.length > 0 && (
            <button
              className={`toggle-btn ${isFilterOpen ? 'active' : ''} toggle-btn-1`}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <FaFilter /> {t("reports.filter.toggle")}
            </button>
          )}
        </div>
        <div className="form-content">
          <div className="report-form">
            <div className="form-group fg-1">
              <label className="filter-label">{t("reports.filter.reportType")}</label>
              <Select
                options={reportTypes.map(type => ({ value: type, label: t(`reports.types.${type.toLowerCase()}`) }))}
                value={selectedReportType ? { value: selectedReportType, label: t(`reports.types.${selectedReportType.toLowerCase()}`) } : null}
                onChange={(option) => setSelectedReportType(option?.value || "")}
                placeholder={t("reports.filter.placeholders.type")}
                isSearchable
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
            <div className="form-group">
              <label className="filter-label">{t("reports.filter.format")}</label>
              <div className="button-group">
                {formats.map(fmt => (
                  <button
                    key={fmt}
                    className={`toggle-btn ${selectedFormat === fmt ? 'active' : ''} toggle-btn-1`}
                    onClick={() => setSelectedFormat(fmt as "pdf" | "excel")}
                  >
                    {t(`reports.formats.${fmt}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {isFilterOpen && filters.length > 0 && (
            <motion.div
              className="filter-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <h4>{t("reports.filter.options")}</h4>
              {filterSections.map(section => (
                <Accordion title={section.title} key={section.title}>
                  <div className="filter-grid">
                    {section.filters.map(filter => {
                      if (!filters.includes(filter)) return null; // Skip disallowed filters
                      switch (filter) {
                        case "dateRange":
                          const dateRange = filterValues[filter] as DateRangeFilter | undefined;
                          return (
                            <div key={filter} className="form-group date-range-group col-span-2">
                              <label className="filter-label">{t("reports.filter.dateRange")}</label>
                              <div className="date-picker-container flex gap-2">
                                <DatePicker
                                  selected={dateRange?.start ? new Date(dateRange.start) : null}
                                  onChange={(date: Date | null) => setFilterValues(prev => ({
                                    ...prev,
                                    [filter]: {
                                      ...((prev[filter] && typeof prev[filter] === 'object' ? prev[filter] : { start: "", end: "" })),
                                      start: date ? date.toISOString() : ""
                                    }
                                  }))}
                                  placeholderText={t("reports.filter.placeholders.startDate")}
                                  className="date-input"
                                />
                                <span className="date-divider">{t("reports.filter.to")}</span>
                                <DatePicker
                                  selected={dateRange?.end ? new Date(dateRange.end) : null}
                                  onChange={(date: Date | null) => setFilterValues(prev => ({
                                    ...prev,
                                    [filter]: {
                                      ...((prev[filter] && typeof prev[filter] === 'object' ? prev[filter] : { start: "", end: "" })),
                                      end: date ? date.toISOString() : ""
                                    }
                                  }))}
                                  placeholderText={t("reports.filter.placeholders.endDate")}
                                  className="date-input"
                                />
                              </div>
                            </div>
                          );
                        case "supervisorID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.supervisor")}</label>
                              <Select
                                options={supervisors.map(sup => ({
                                  value: sup.userID,
                                  label: `${sup.firstname} ${sup.lastname} (${sup.phone})`
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: supervisors.find(sup => sup.userID === filterValues[filter])?.firstname + " " +
                                    supervisors.find(sup => sup.userID === filterValues[filter])?.lastname + ` (${supervisors.find(sup => sup.userID === filterValues[filter])?.phone})`
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.supervisor")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "regionalManagerID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.regionalManager")}</label>
                              <Select
                                options={regionalManagers.map(rm => ({
                                  value: rm.userID,
                                  label: `${rm.firstname} ${rm.lastname} (${rm.phone})`
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: regionalManagers.find(rm => rm.userID === filterValues[filter])?.firstname + " " +
                                    regionalManagers.find(rm => rm.userID === filterValues[filter])?.lastname + ` (${regionalManagers.find(rm => rm.userID === filterValues[filter])?.phone})`
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.regionalManager")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "directorID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.director")}</label>
                              <Select
                                options={directors.map(dir => ({
                                  value: dir.userID,
                                  label: `${dir.firstname} ${dir.lastname} (${dir.phone})`
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: directors.find(dir => dir.userID === filterValues[filter])?.firstname + " " +
                                    directors.find(dir => dir.userID === filterValues[filter])?.lastname + ` (${directors.find(dir => dir.userID === filterValues[filter])?.phone})`
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.director")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "agentID":
                        case "agentName":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.agent")}</label>
                              <Select
                                options={agents.map(agent => ({
                                  value: agent.agentID,
                                  label: `${agent.name} ${agent.lastname} (${agent.phone})`
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: agents.find(agent => agent.agentID === filterValues[filter])?.name + " " +
                                    agents.find(agent => agent.agentID === filterValues[filter])?.lastname + ` (${agents.find(agent => agent.agentID === filterValues[filter])?.phone})`
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.agent")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "regionID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.region")}</label>
                              <Select
                                options={regions.map(region => ({
                                  value: region.regionID,
                                  label: region.name
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: regions.find(region => region.regionID === filterValues[filter])?.name
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.region")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "governorateID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.governorate")}</label>
                              <Select
                                options={governorates.map(gov => ({
                                  value: gov.governorateID,
                                  label: gov.name
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: governorates.find(gov => gov.governorateID === filterValues[filter])?.name
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.governorate")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "delegationID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.delegation")}</label>
                              <Select
                                options={delegations.map(del => ({
                                  value: del.delegationID,
                                  label: del.name
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: delegations.find(del => del.delegationID === filterValues[filter])?.name
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.delegation")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "visitType":
                          return renderBooleanToggle(filter, t("reports.filters.visitType"));
                        case "status":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.status")}</label>
                              <Select
                                isMulti
                                options={
                                  selectedReportType === "UserActivity"
                                    ? logStatuses.map(option => ({ value: option, label: option }))
                                    : (reportStatusOptions[selectedReportType] || []).map(option => ({
                                      value: option,
                                      label: t(`reports.statuses.${option.toLowerCase().replace(/\s/g, "")}`),
                                    }))
                                }
                                value={(filterValues[filter] as string[] || []).map(val => ({
                                  value: val,
                                  label: selectedReportType === "UserActivity"
                                    ? val
                                    : t(`reports.statuses.${val.toLowerCase().replace(/\s/g, "")}`),
                                }))}
                                onChange={(options) =>
                                  setFilterValues(prev => ({
                                    ...prev,
                                    [filter]: options.map(opt => opt.value),
                                  }))
                                }
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.status")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "visitReasons":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.visitReasons")}</label>
                              <Select
                                isMulti
                                options={reasons.map(reason => ({
                                  value: reason.reasonID,
                                  label: reason.item
                                }))}
                                value={(filterValues[filter] as string[] || []).map(val => ({
                                  value: val,
                                  label: reasons.find(r => r.reasonID === val)?.item
                                }))}
                                onChange={(options) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: options.map(opt => opt.value)
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.visitReasons")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "checklistCompleted":
                          return renderBooleanToggle(filter, t("reports.filters.checklistCompleted"));
                        case "visitDuration":
                          return renderRangeInput(filter, t("reports.filters.visitDuration"));
                        case "Anomalies":
                          return renderBooleanToggle(filter, t("reports.filters.Anomalies"));
                        case "numberOfVisits":
                          return renderRangeInput(filter, t("reports.filters.numberOfVisits"));
                        case "totalHours":
                          return renderRangeInput(filter, t("reports.filters.totalHours"));
                        case "aiSuggestions":
                          return renderBooleanToggle(filter, t("reports.filters.aiSuggestions"));
                        case "anomaliesDetected":
                          return renderBooleanToggle(filter, t("reports.filters.anomaliesDetected"));
                        case "visitStatus":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.visitStatus")}</label>
                              <Select
                                isMulti
                                options={visitStatusOptions.map(option => ({ value: option, label: t(`reports.statuses.${option.toLowerCase()}`) }))}
                                value={(filterValues[filter] as string[] || []).map(val => ({ value: val, label: t(`reports.statuses.${val.toLowerCase()}`) }))}
                                onChange={(options) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: options.map(opt => opt.value)
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.visitStatus")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "weekNumber":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.weekNumber")}</label>
                              <input
                                type="number"
                                min={1}
                                max={52}
                                value={(filterValues[filter] as number) || ""}
                                onChange={(e) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: Number(e.target.value)
                                }))}
                                className="text-input"
                                placeholder={t("reports.filter.placeholders.weekNumber")}
                              />
                            </div>
                          );
                        case "bookType":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.bookType")}</label>
                              <Select
                                options={receiptBookTypes.map(type => ({
                                  value: type.typeID,
                                  label: type.name
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: receiptBookTypes.find(type => type.typeID === filterValues[filter])?.name
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.bookType")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "currentHolderName":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.currentHolder")}</label>
                              <Select
                                options={holders.map(holder => ({
                                  value: `${holder.firstname} ${holder.lastname} (${holder.phone})`,
                                  label: `${holder.firstname} ${holder.lastname} (${holder.phone}) - ${holder.Roles?.map(r => r.name).join(", ") || "No Role"}`
                                }))}
                                value={filterValues[filter] ? { value: filterValues[filter] as string, label: filterValues[filter] as string } : null}
                                onChange={(option) => setFilterValues(prev => ({ ...prev, [filter]: option?.value || "" }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.currentHolder")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "assignmentStatus":
                          return renderBooleanToggle(filter, t("reports.filters.assignmentStatus"));
                        case "roleID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.role")}</label>
                              <Select
                                options={roles.map(role => ({ value: role.name, label: role.name }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.role")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "activityType":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.activityType")}</label>
                              <Select
                                options={activityTypes.map(type => ({ value: type, label: type }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.activityType")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "userID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.user")}</label>
                              <Select
                                options={users.map(user => ({
                                  value: user.userID,
                                  label: `${user.firstname} ${user.lastname} (${user.phone}) - ${user.Roles?.map(r => r.name).join(", ")}`
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: users.find(user => user.userID === filterValues[filter])?.firstname + " " +
                                    users.find(user => user.userID === filterValues[filter])?.lastname + ` (${users.find(user => user.userID === filterValues[filter])?.phone}) - ${users.find(user => user.userID === filterValues[filter])?.Roles?.map(r => r.name).join(", ")}`
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.user")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "suspiciousActivity":
                          return renderBooleanToggle(filter, t("reports.filters.suspiciousActivity"));
                        case "ipAddress":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.ipAddress")}</label>
                              <input
                                type="text"
                                value={filterValues[filter] as string || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value && !validateIPAddress(value)) {
                                    setError(t("reports.errors.invalidIP"));
                                  } else {
                                    setError(null);
                                    setFilterValues(prev => ({ ...prev, [filter]: value }));
                                  }
                                }}
                                className="text-input"
                                placeholder={t("reports.filter.placeholders.ipAddress")}
                              />
                            </div>
                          );
                        case "affectedEntity":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.affectedEntity")}</label>
                              <Select
                                options={affectedEntities.map(entity => ({ value: entity, label: entity }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.affectedEntity")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "severity":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.severity")}</label>
                              <Select
                                options={severities.map(severity => ({ value: severity, label: severity }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.severity")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "route":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.route")}</label>
                              <Select
                                options={routes.map(route => ({ value: route, label: route }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.route")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "stubsCollected":
                          return renderRangeInput(filter, t("reports.filters.stubsCollected"));
                        case "receiptBooksAssigned":
                          return renderRangeInput(filter, t("reports.filters.receiptBooksAssigned"));
                        case "locationUpdated":
                          return renderBooleanToggle(filter, t("reports.filters.locationUpdated"));
                        default:
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t(`reports.filters.${filter}`)}</label>
                              <input
                                type="text"
                                value={(filterValues[filter] as string) || ""}
                                onChange={(e) => setFilterValues(prev => ({ ...prev, [filter]: e.target.value }))}
                                className="text-input"
                                placeholder={t(`reports.filter.placeholders.${filter}`)}
                              />
                            </div>
                          );
                      }
                    })}
                  </div>
                </Accordion>
              ))}
            </motion.div>
          )}
        </div>
        <div className="form-actions">
          <button
            className="submit-btn secondary"
            onClick={() => setView("scheduled")}
          >
            {t("reports.actions.cancel")}
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={loading || !selectedReportType}
            className="submit-btn primary"
          >
            {loading ? t("reports.actions.generating") : t("reports.actions.generate")}
          </button>
        </div>
      </div>
    );
  };

  const renderScheduleForm = () => {
    const filters = selectedReportType ? allowedFilters[selectedReportType] || [] : [];

    const filterSections = [
      { title: "Date Range", filters: ["dateRange"].filter(f => filters.includes(f)) },
      { title: "User Selection", filters: ["supervisorID", "regionalManagerID", "directorID", "agentID", "userID"].filter(f => filters.includes(f)) },
      { title: "Location", filters: ["regionID", "governorateID", "delegationID"].filter(f => filters.includes(f)) },
      {
        title: "Other Filters",
        filters: filters.filter(f => !["dateRange", "supervisorID", "regionalManagerID", "directorID", "agentID", "userID", "regionID", "governorateID", "delegationID"].includes(f)),
      },
    ].filter(section => section.filters.length > 0);

    const renderRangeInput = (filter: string, label: string) => (
      <div className="form-group range-group">
        <label className="filter-label">{t(`reports.filters.${filter}`)}</label>
        <div className="range-inputs flex gap-2">
          <input
            type="number"
            value={(filterValues[filter] as RangeFilter)?.min || ""}
            onChange={(e) => setFilterValues(prev => ({
              ...prev,
              [filter]: { ...prev[filter] as RangeFilter, min: Number(e.target.value) }
            }))}
            className="range-input"
            placeholder={t("reports.filter.placeholders.min")}
          />
          <span className="range-divider">-</span>
          <input
            type="number"
            value={(filterValues[filter] as RangeFilter)?.max || ""}
            onChange={(e) => setFilterValues(prev => ({
              ...prev,
              [filter]: { ...prev[filter] as RangeFilter, max: Number(e.target.value) }
            }))}
            className="range-input"
            placeholder={t("reports.filter.placeholders.max")}
          />
        </div>
      </div>
    );

    const renderBooleanToggle = (filter: string, label: string) => (
      <div className="form-group toggle-group">
        <label className="filter-label">{t(`reports.filters.${filter}`)}</label>
        <div
          className={`toggle-switch-2 toggle-switch ${filterValues[filter] ? 'active' : ''}`}
          onClick={() => setFilterValues(prev => ({ ...prev, [filter]: !prev[filter] }))}
        >
          <span className="toggle-slider"></span>
        </div>
      </div>
    );

    return (
      <div className="form-card">
        <div className="form-header">
          <h3>{t("reports.schedule.title")}</h3>
          {filters.length > 0 && (
            <button
              className={`comeback toggle-btn ${isFilterOpen ? 'active' : ''} toggle-btn-1`}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <FaFilter /> {t("reports.filter.toggle")}
            </button>
          )}
        </div>
        <div className="form-content">
          <div className="report-form">
            <div className="form-group fg-1">
              <label className="filter-label">{t("reports.filter.reportType")}</label>
              <Select
                options={reportTypes.map(type => ({ value: type, label: t(`reports.types.${type.toLowerCase()}`) }))}
                value={selectedReportType ? { value: selectedReportType, label: t(`reports.types.${selectedReportType.toLowerCase()}`) } : null}
                onChange={(option) => setSelectedReportType(option?.value || "")}
                placeholder={t("reports.filter.placeholders.type")}
                isSearchable
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
            <div className="form-group">
              <label className="filter-label">{t("reports.filter.format")}</label>
              <div className="button-group">
                {formats.map(fmt => (
                  <button
                    key={fmt}
                    className={`toggle-btn ${selectedFormat === fmt ? 'active' : ''} toggle-btn-1`}
                    onClick={() => setSelectedFormat(fmt as "pdf" | "excel")}
                  >
                    {t(`reports.formats.${fmt}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="form-group fg-1">
            <label className="filter-label">{t("reports.schedule.period")}</label>
            <Select
              options={[
                { value: "daily", label: t("reports.schedule.daily") },
                { value: "weekly", label: t("reports.schedule.weekly") },
                { value: "monthly", label: t("reports.schedule.monthly") },
                { value: "yearly", label: t("reports.schedule.yearly") },
                { value: "custom", label: t("reports.schedule.custom") },
              ]}
              value={schedulePeriod ? { value: schedulePeriod, label: t(`reports.schedule.${schedulePeriod}`) } : null}
              onChange={(option) => setSchedulePeriod(option?.value as "daily" | "weekly" | "monthly" | "yearly" | "custom" || "")}
              placeholder={t("reports.schedule.placeholders.period")}
              isSearchable
              className="react-select-container"
              classNamePrefix="react-select"
            />
          </div>
          {schedulePeriod === "custom" && (
            <div className="form-groups" style={{ display: "flex", flexDirection: "row", gap: "1rem" }}>
              <div>
                <label className="filter-label">{t("reports.schedule.customPeriod")}</label>
                <input
                  type="number"
                  value={customPeriodValue}
                  onChange={(e) => setCustomPeriodValue(e.target.value)}
                  placeholder={t("reports.schedule.placeholders.customPeriod")}
                  className="text-input"
                  style={{ display: "flex", flexDirection: "column" }}
                  min="1"
                />
              </div>
              <div>
                <label className="filter-label">{t("reports.schedule.unit")}</label>
                <Select
                  options={[
                    { value: "minutes", label: t("reports.schedule.minutes") },
                    { value: "hours", label: t("reports.schedule.hours") },
                    { value: "days", label: t("reports.schedule.days") },
                  ]}
                  value={customPeriodUnit ? { value: customPeriodUnit, label: t(`reports.schedule.${customPeriodUnit}`) } : null}
                  onChange={(option) => setCustomPeriodUnit(option?.value as "minutes" | "hours" | "days" || "")}
                  placeholder={t("reports.schedule.placeholders.unit")}
                  isSearchable
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>
            </div>
          )}
          {isFilterOpen && filters.length > 0 && (
            <motion.div
              className="filter-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <h4>{t("reports.filter.options")}</h4>
              {filterSections.map(section => (
                <Accordion title={section.title} key={section.title}>
                  <div className="filter-grid">
                    {section.filters.map(filter => {
                      if (!filters.includes(filter)) return null; // Skip disallowed filters
                      switch (filter) {
                        case "dateRange":
                          const dateRange = filterValues[filter] as DateRangeFilter | undefined;
                          return (
                            <div key={filter} className="form-group date-range-group col-span-2">
                              <label className="filter-label">{t("reports.filter.dateRange")}</label>
                              <div className="date-picker-container flex gap-2">
                                <DatePicker
                                  selected={dateRange?.start ? new Date(dateRange.start) : null}
                                  onChange={(date: Date | null) => setFilterValues(prev => ({
                                    ...prev,
                                    [filter]: {
                                      ...((prev[filter] && typeof prev[filter] === 'object' ? prev[filter] : { start: "", end: "" })),
                                      start: date ? date.toISOString() : ""
                                    }
                                  }))}
                                  placeholderText={t("reports.filter.placeholders.startDate")}
                                  className="date-input"
                                />
                                <span className="date-divider">{t("reports.filter.to")}</span>
                                <DatePicker
                                  selected={dateRange?.end ? new Date(dateRange.end) : null}
                                  onChange={(date: Date | null) => setFilterValues(prev => ({
                                    ...prev,
                                    [filter]: {
                                      ...((prev[filter] && typeof prev[filter] === 'object' ? prev[filter] : { start: "", end: "" })),
                                      end: date ? date.toISOString() : ""
                                    }
                                  }))}
                                  placeholderText={t("reports.filter.placeholders.endDate")}
                                  className="date-input"
                                />
                              </div>
                            </div>
                          );
                        case "supervisorID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.supervisor")}</label>
                              <Select
                                options={supervisors.map(sup => ({
                                  value: sup.userID,
                                  label: `${sup.firstname} ${sup.lastname} (${sup.phone})`
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: supervisors.find(sup => sup.userID === filterValues[filter])?.firstname + " " +
                                    supervisors.find(sup => sup.userID === filterValues[filter])?.lastname + ` (${supervisors.find(sup => sup.userID === filterValues[filter])?.phone})`
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.supervisor")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "regionalManagerID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.regionalManager")}</label>
                              <Select
                                options={regionalManagers.map(rm => ({
                                  value: rm.userID,
                                  label: `${rm.firstname} ${rm.lastname} (${rm.phone})`
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: regionalManagers.find(rm => rm.userID === filterValues[filter])?.firstname + " " +
                                    regionalManagers.find(rm => rm.userID === filterValues[filter])?.lastname + ` (${regionalManagers.find(rm => rm.userID === filterValues[filter])?.phone})`
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.regionalManager")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "directorID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.director")}</label>
                              <Select
                                options={directors.map(dir => ({
                                  value: dir.userID,
                                  label: `${dir.firstname} ${dir.lastname} (${dir.phone})`
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: directors.find(dir => dir.userID === filterValues[filter])?.firstname + " " +
                                    directors.find(dir => dir.userID === filterValues[filter])?.lastname + ` (${directors.find(dir => dir.userID === filterValues[filter])?.phone})`
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.director")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "agentID":
                        case "agentName":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.agent")}</label>
                              <Select
                                options={agents.map(agent => ({
                                  value: agent.agentID,
                                  label: `${agent.name} ${agent.lastname} (${agent.phone})`
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: agents.find(agent => agent.agentID === filterValues[filter])?.name + " " +
                                    agents.find(agent => agent.agentID === filterValues[filter])?.lastname + ` (${agents.find(agent => agent.agentID === filterValues[filter])?.phone})`
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.agent")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "regionID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.region")}</label>
                              <Select
                                options={regions.map(region => ({
                                  value: region.regionID,
                                  label: region.name
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: regions.find(region => region.regionID === filterValues[filter])?.name
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.region")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "governorateID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.governorate")}</label>
                              <Select
                                options={governorates.map(gov => ({
                                  value: gov.governorateID,
                                  label: gov.name
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: governorates.find(gov => gov.governorateID === filterValues[filter])?.name
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.governorate")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "delegationID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.delegation")}</label>
                              <Select
                                options={delegations.map(del => ({
                                  value: del.delegationID,
                                  label: del.name
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: delegations.find(del => del.delegationID === filterValues[filter])?.name
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.delegation")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "visitType":
                          return renderBooleanToggle(filter, t("reports.filters.visitType"));
                        case "status":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.status")}</label>
                              <Select
                                isMulti
                                options={
                                  selectedReportType === "UserActivity"
                                    ? logStatuses.map(option => ({ value: option, label: option }))
                                    : (reportStatusOptions[selectedReportType] || []).map(option => ({
                                      value: option,
                                      label: t(`reports.statuses.${option.toLowerCase().replace(/\s/g, "")}`),
                                    }))
                                }
                                value={(filterValues[filter] as string[] || []).map(val => ({
                                  value: val,
                                  label: selectedReportType === "UserActivity"
                                    ? val
                                    : t(`reports.statuses.${val.toLowerCase().replace(/\s/g, "")}`),
                                }))}
                                onChange={(options) =>
                                  setFilterValues(prev => ({
                                    ...prev,
                                    [filter]: options.map(opt => opt.value),
                                  }))
                                }
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.status")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "visitReasons":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.visitReasons")}</label>
                              <Select
                                isMulti
                                options={reasons.map(reason => ({
                                  value: reason.reasonID,
                                  label: reason.item
                                }))}
                                value={(filterValues[filter] as string[] || []).map(val => ({
                                  value: val,
                                  label: reasons.find(r => r.reasonID === val)?.item
                                }))}
                                onChange={(options) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: options.map(opt => opt.value)
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.visitReasons")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "checklistCompleted":
                          return renderBooleanToggle(filter, t("reports.filters.checklistCompleted"));
                        case "visitDuration":
                          return renderRangeInput(filter, t("reports.filters.visitDuration"));
                        case "Anomalies":
                          return renderBooleanToggle(filter, t("reports.filters.Anomalies"));
                        case "numberOfVisits":
                          return renderRangeInput(filter, t("reports.filters.numberOfVisits"));
                        case "totalHours":
                          return renderRangeInput(filter, t("reports.filters.totalHours"));
                        case "aiSuggestions":
                          return renderBooleanToggle(filter, t("reports.filters.aiSuggestions"));
                        case "anomaliesDetected":
                          return renderBooleanToggle(filter, t("reports.filters.anomaliesDetected"));
                        case "visitStatus":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.visitStatus")}</label>
                              <Select
                                isMulti
                                options={visitStatusOptions.map(option => ({ value: option, label: t(`reports.statuses.${option.toLowerCase()}`) }))}
                                value={(filterValues[filter] as string[] || []).map(val => ({ value: val, label: t(`reports.statuses.${val.toLowerCase()}`) }))}
                                onChange={(options) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: options.map(opt => opt.value)
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.visitStatus")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "weekNumber":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.weekNumber")}</label>
                              <input
                                type="number"
                                min={1}
                                max={52}
                                value={(filterValues[filter] as number) || ""}
                                onChange={(e) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: Number(e.target.value)
                                }))}
                                className="text-input"
                                placeholder={t("reports.filter.placeholders.weekNumber")}
                              />
                            </div>
                          );
                        case "bookType":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.bookType")}</label>
                              <Select
                                options={receiptBookTypes.map(type => ({
                                  value: type.typeID,
                                  label: type.name
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: receiptBookTypes.find(type => type.typeID === filterValues[filter])?.name
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.bookType")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "currentHolderName":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.currentHolder")}</label>
                              <Select
                                options={holders.map(holder => ({
                                  value: `${holder.firstname} ${holder.lastname} (${holder.phone})`,
                                  label: `${holder.firstname} ${holder.lastname} (${holder.phone}) - ${holder.Roles?.map(r => r.name).join(", ") || "No Role"}`
                                }))}
                                value={filterValues[filter] ? { value: filterValues[filter] as string, label: filterValues[filter] as string } : null}
                                onChange={(option) => setFilterValues(prev => ({ ...prev, [filter]: option?.value || "" }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.currentHolder")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "assignmentStatus":
                          return renderBooleanToggle(filter, t("reports.filters.assignmentStatus"));
                        case "roleID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.role")}</label>
                              <Select
                                options={roles.map(role => ({ value: role.name, label: role.name }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.role")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "activityType":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.activityType")}</label>
                              <Select
                                options={activityTypes.map(type => ({ value: type, label: type }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.activityType")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "userID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.user")}</label>
                              <Select
                                options={users.map(user => ({
                                  value: user.userID,
                                  label: `${user.firstname} ${user.lastname} (${user.phone}) - ${user.Roles?.map(r => r.name).join(", ")}`
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: users.find(user => user.userID === filterValues[filter])?.firstname + " " +
                                    users.find(user => user.userID === filterValues[filter])?.lastname + ` (${users.find(user => user.userID === filterValues[filter])?.phone}) - ${users.find(user => user.userID === filterValues[filter])?.Roles?.map(r => r.name).join(", ")}`
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.user")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "suspiciousActivity":
                          return renderBooleanToggle(filter, t("reports.filters.suspiciousActivity"));
                        case "ipAddress":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.ipAddress")}</label>
                              <input
                                type="text"
                                value={filterValues[filter] as string || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value && !validateIPAddress(value)) {
                                    setError(t("reports.errors.invalidIP"));
                                  } else {
                                    setError(null);
                                    setFilterValues(prev => ({ ...prev, [filter]: value }));
                                  }
                                }}
                                className="text-input"
                                placeholder={t("reports.filter.placeholders.ipAddress")}
                              />
                            </div>
                          );
                        case "affectedEntity":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.affectedEntity")}</label>
                              <Select
                                options={affectedEntities.map(entity => ({ value: entity, label: entity }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.affectedEntity")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "severity":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.severity")}</label>
                              <Select
                                options={severities.map(severity => ({ value: severity, label: severity }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.severity")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "route":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t("reports.filters.route")}</label>
                              <Select
                                options={routes.map(route => ({ value: route, label: route }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                onMenuOpen={() => handleSelectorClick(filter)}
                                placeholder={t("reports.filter.placeholders.route")}
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "stubsCollected":
                          return renderRangeInput(filter, t("reports.filters.stubsCollected"));
                        case "receiptBooksAssigned":
                          return renderRangeInput(filter, t("reports.filters.receiptBooksAssigned"));
                        case "locationUpdated":
                          return renderBooleanToggle(filter, t("reports.filters.locationUpdated"));
                        default:
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{t(`reports.filters.${filter}`)}</label>
                              <input
                                type="text"
                                value={(filterValues[filter] as string) || ""}
                                onChange={(e) => setFilterValues(prev => ({ ...prev, [filter]: e.target.value }))}
                                className="text-input"
                                placeholder={t(`reports.filter.placeholders.${filter}`)}
                              />
                            </div>
                          );
                      }
                    })}
                  </div>
                </Accordion>
              ))}
            </motion.div>
          )}
        </div>
        <div className="form-actions">
          <button
            className="submit-btn secondary"
            onClick={() => setView("scheduled")}
          >
            {t("reports.actions.cancel")}
          </button>
          <button
            onClick={handleScheduleReport}
            disabled={loading || !selectedReportType || !schedulePeriod || (schedulePeriod === "custom" && (!customPeriodValue || !customPeriodUnit))}
            className="submit-btn primary"
          >
            {loading ? t("reports.actions.scheduling") : t("reports.actions.schedule")}
          </button>
        </div>
      </div>
    );
  };



  const renderListView = () => {
    const currentPage = view === "scheduled" ? scheduledPage : generatedPage;
    const setCurrentPage = view === "scheduled" ? setScheduledPage : setGeneratedPage;
    const totalItems = view === "scheduled" ? filteredSchedules.length : filteredGeneratedReports.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = view === "scheduled"
      ? filteredSchedules.slice(indexOfFirstItem, indexOfLastItem)
      : filteredGeneratedReports.slice(indexOfFirstItem, indexOfLastItem);

    return (
      <div className="table-card">
        <motion.div
          className="report-grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {loading && (view === "scheduled" ? schedules.length === 0 : generatedReports.length === 0) ? (
            <div className="loading">{t("reports.loading")}</div>
          ) : currentItems.length > 0 ? (
            currentItems.map(item => (
              <ReportCard
                key={view === "scheduled" ? (item as ReportSchedule).scheduleID : (item as GeneratedReport).generatedReportID}
                type={view as "scheduled" | "generated"}
                data={item}
                onDownload={handleDownloadReport}
                onDelete={view === "scheduled" ? handleDeleteSchedule : handleDeleteGeneratedReport}
              />
            ))
          ) : (
            <div className="no-data">{t("reports.table.noData")}</div>
          )}
        </motion.div>
        <Pagination
          totalPages={totalPages}
          currentPage={currentPage}
          onPageChange={(page: number) => setCurrentPage(page)}
        />
      </div>
    );
  };

  return (
    <div className="reporting-container">
      <header className="dashboard-header">
        <h1>
          {view === "scheduled" ? t("reports.scheduled.title") :
            view === "generated" ? t("reports.generated.title") :
              view === "generate" ? t("reports.generate.title") : t("reports.schedule.title")}
        </h1>
        {(view === "scheduled" || view === "generated") && (
          <button onClick={fetchData} className="action-btn refresh" title={t("reports.actions.refresh")}>
            <FaSync />
          </button>
        )}
      </header>
      <section className="dashboard-content">
        <aside className="sidebar">
          <div className="filter-card">
            <h3>{t("reports.manager.title")}</h3>
            <div className="manager-buttons">
              <button
                className={`action-btn ${view === "scheduled" ? "active" : ""}`}
                onClick={() => setView("scheduled")}
              >
                <FaList /> {t("reports.manager.scheduled")}
              </button>
              <button
                className={`action-btn ${view === "generated" ? "active" : ""}`}
                onClick={() => setView("generated")}
              >
                <FaList /> {t("reports.manager.generated")}
              </button>
              <button
                className={`action-btn ${view === "generate" ? "active" : ""}`}
                onClick={() => setView("generate")}
              >
                <FaPlus /> {t("reports.manager.generate")}
              </button>
              <button
                className={`action-btn ${view === "schedule" ? "active" : ""}`}
                onClick={() => setView("schedule")}
              >
                <FaClock /> {t("reports.manager.schedule")}
              </button>
            </div>
          </div>
          {(view === "scheduled" || view === "generated") && (
            <>
              <SortCard />
              {renderFilterForm()}
            </>
          )}
        </aside>
        <main className="main-content">
          {(view === "scheduled" || view === "generated") && renderListView()}
          {view === "generate" && renderGenerateForm()}
          {view === "schedule" && renderScheduleForm()}
        </main>
      </section>
      {isModalOpen && modalReport && (
        <ReportActionModal
          report={modalReport}
          onDownload={handleModalDownload}
          onDelete={handleModalDelete}
          onKeep={handleModalKeep}
        />
      )}
    </div>

  );
};

export default ReportingPage;