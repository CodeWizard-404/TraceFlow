import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FaDownload, FaTrash, FaFilter, FaSort, FaList, FaPlus, FaClock, FaChevronDown } from "react-icons/fa";
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
import { getAllReceiptBooks, getAllReceiptBookTypes } from "../../apis/receiptBookAPI";
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

// Constants for report types and formats
const reportTypes = [
  "VisitSummary", "Timesheet", "ReceiptBookInventory", "StubCollection",
  "UserActivity", "AIAnomaly", "AgentPerformance", "RegionPerformance", "Full"
];
const formats = ["pdf", "excel"];
const statusOptions = ["Pending", "Visited", "Validated", "Rejected"];
const visitStatusOptions = ["Pending", "Visited", "Validated", "Rejected"];

// Allowed filters for each report type
const allowedFilters: Record<string, string[]> = {
  VisitSummary: [
    "supervisorID", "agentID", "dateRange", "regionID", "governorateID",
    "delegationID", "visitType", "status", "visitReasons", "checklistCompleted",
    "visitDuration", "aiAnomalies"
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
  AIAnomaly: [
    "dateRange", "anomalyType", "roleID", "userID", "affectedEntity",
    "severity", "route"
  ],
  AgentPerformance: [
    "supervisorID", "regionalManagerID", "agentID", "dateRange", "regionID",
    "governorateID", "delegationID", "performanceScore", "numberOfVisits",
    "stubsCollected", "receiptBooksAssigned", "visitCompletionRate",
    "locationUpdated"
  ],
  RegionPerformance: [
    "regionalManagerID", "dateRange", "regionID", "governorateID",
    "delegationID", "performanceScore", "numberOfVisits", "stubsCollected"
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

  return (
    <div className="dropdown-unit dropdown-unit">
      <div className="dropdown-bar" onClick={() => setIsOpen(!isOpen)}>
        <h3>{title}</h3>
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
  const [view, setView] = useState<"scheduled" | "generated" | "generate" | "schedule">("scheduled");
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filter states for list view
  const [reportTypeFilter, setReportTypeFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [scheduleSort, setScheduleSort] = useState<"scheduleID" | "reportType" | "createdAt">("scheduleID");
  const [scheduleSortOrder, setScheduleSortOrder] = useState<"asc" | "desc">("asc");
  const [reportSort, setReportSort] = useState<"generatedReportID" | "reportType" | "generatedAt">("generatedReportID");
  const [reportSortOrder, setReportSortOrder] = useState<"asc" | "desc">("asc");

  // Generate and Schedule view states
  const [selectedReportType, setSelectedReportType] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<"pdf" | "excel">("pdf");
  const [filterValues, setFilterValues] = useState<FilterValues>({});
  const [cronExpression, setCronExpression] = useState("");

  // Data for filters
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [regionalManagers, setRegionalManagers] = useState<User[]>([]);
  const [directors, setDirectors] = useState<User[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
  const [receiptBookTypes, setReceiptBookTypes] = useState<ReceiptBookType[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const [logStatuses, setLogStatuses] = useState<string[]>([]);
  const [anomalyTypes, setAnomalyTypes] = useState<string[]>([]);
  const [affectedEntities, setAffectedEntities] = useState<string[]>([]);
  const [severities, setSeverities] = useState<string[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Fetch filter data only when needed
  const fetchFilterData = async (reportType: string) => {
    try {
      setLoading(true);
      const promises: Promise<any>[] = [];

      if (allowedFilters[reportType]?.includes("supervisorID")) {
        promises.push(getUsersByRole("Supervisor").then(setSupervisors));
      }
      if (allowedFilters[reportType]?.includes("regionalManagerID")) {
        promises.push(getUsersByRole("RegionalManager").then(setRegionalManagers));
      }
      if (allowedFilters[reportType]?.includes("directorID")) {
        promises.push(getUsersByRole("Director").then(setDirectors));
      }
      if (allowedFilters[reportType]?.includes("agentID") || allowedFilters[reportType]?.includes("agentName")) {
        promises.push(getAllAgents().then(data => setAgents(data.agents)));
      }
      if (allowedFilters[reportType]?.includes("regionID")) {
        promises.push(getAllRegions().then(setRegions));
      }
      if (allowedFilters[reportType]?.includes("governorateID")) {
        promises.push(getAllGovernorates().then(setGovernorates));
      }
      if (allowedFilters[reportType]?.includes("delegationID")) {
        promises.push(getAllDelegations().then(setDelegations));
      }
      if (allowedFilters[reportType]?.includes("visitReasons")) {
        promises.push(getAllReasons().then(setReasons));
      }
      if (allowedFilters[reportType]?.includes("bookType")) {
        promises.push(getAllReceiptBookTypes().then(setReceiptBookTypes));
      }
      if (allowedFilters[reportType]?.includes("currentHolderName")) {
        promises.push(getAllReceiptBooks().then(setReceiptBooks));
      }
      if (allowedFilters[reportType]?.includes("roleID")) {
        promises.push(getUniqueValues("role").then(setRoles));
      }
      if (allowedFilters[reportType]?.includes("activityType")) {
        promises.push(getUniqueValues("route").then(setActivityTypes));
      }
      if (allowedFilters[reportType]?.includes("status") && reportType === "UserActivity") {
        promises.push(getUniqueValues("status").then(setLogStatuses));
      }
      if (allowedFilters[reportType]?.includes("anomalyType")) {
        promises.push(getUniqueValues("message").then(setAnomalyTypes));
      }
      if (allowedFilters[reportType]?.includes("affectedEntity")) {
        promises.push(getUniqueValues("service").then(setAffectedEntities));
      }
      if (allowedFilters[reportType]?.includes("severity")) {
        promises.push(getUniqueValues("level").then(setSeverities));
      }
      if (allowedFilters[reportType]?.includes("route")) {
        promises.push(getUniqueValues("route").then(setRoutes));
      }
      if (allowedFilters[reportType]?.includes("userID")) {
        promises.push(getAllUsers().then(setUsers));
      }

      await Promise.all(promises);
    } catch (err) {
      setError("Failed to fetch filter data.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch schedules and reports
  useEffect(() => {
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
        setError(err.message || "Failed to fetch data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch filter data when report type changes
  useEffect(() => {
    if (selectedReportType) {
      fetchFilterData(selectedReportType);
    }
    setFilterValues({});
    setIsFilterOpen(false);
  }, [selectedReportType]);

  // Fetch filtered agents when supervisor or delegation changes
  useEffect(() => {
    if (["VisitSummary", "AgentPerformance", "StubCollection"].includes(selectedReportType)) {
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
          setError("Failed to fetch filtered agents.");
        } finally {
          setLoading(false);
        }
      };
      fetchFilteredAgents();
    }
  }, [filterValues.supervisorID, filterValues.delegationID, selectedReportType]);

  // Fetch filtered governorates when region changes
  useEffect(() => {
    if (["VisitSummary", "AgentPerformance", "ReceiptBookInventory", "RegionPerformance"].includes(selectedReportType) && filterValues.regionID) {
      const fetchFilteredGovernorates = async () => {
        try {
          setLoading(true);
          const data = await getGovernoratesByRegion(filterValues.regionID as string);
          setGovernorates(data);
        } catch (err) {
          setError("Failed to fetch filtered governorates.");
        } finally {
          setLoading(false);
        }
      };
      fetchFilteredGovernorates();
    }
  }, [filterValues.regionID, selectedReportType]);

  // Fetch filtered delegations when governorate changes
  useEffect(() => {
    if (["VisitSummary", "AgentPerformance", "ReceiptBookInventory", "RegionPerformance"].includes(selectedReportType) && filterValues.governorateID) {
      const fetchFilteredDelegations = async () => {
        try {
          setLoading(true);
          const data = await getDelegationsByGovernorate(filterValues.governorateID as string);
          setDelegations(data);
        } catch (err) {
          setError("Failed to fetch filtered delegations.");
        } finally {
          setLoading(false);
        }
      };
      fetchFilteredDelegations();
    }
  }, [filterValues.governorateID, selectedReportType]);

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
      const key = scheduleSort;
      const order = scheduleSortOrder === "asc" ? 1 : -1;
      return (a[key] > b[key] ? 1 : -1) * order;
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
      const key = reportSort;
      const order = reportSortOrder === "asc" ? 1 : -1;
      return (a[key] > b[key] ? 1 : -1) * order;
    });
  }, [generatedReports, reportTypeFilter, formatFilter, dateStart, dateEnd, reportSort, reportSortOrder]);

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const validatedFilters: FilterValues = { ...filterValues };
      if (selectedReportType === "VisitSummary" && filterValues.visitType === false) {
        validatedFilters.visitType = "recrutementVisits";
      }
      await generateReport({
        reportType: selectedReportType,
        filters: validatedFilters,
        format: selectedFormat,
      });
      const reports = await listGeneratedReports();
      setGeneratedReports(reports);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleReport = async () => {
    if (!cronExpression) {
      setError("Cron expression is required.");
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
        cronExpression,
      });
      const schedulesData = await listSchedules();
      setSchedules(schedulesData);
      setCronExpression("");
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to schedule report.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (filePath: string) => {
    setLoading(true);
    try {
      const response = await downloadReport(filePath);
      const blob = new Blob([response], { type: selectedFormat === "pdf" ? "application/pdf" : "application/vnd.ms-excel" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filePath.split("/").pop() || `report.${selectedFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to download report.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleID: string) => {
    setLoading(true);
    try {
      await deleteSchedule(scheduleID);
      const schedulesData = await listSchedules();
      setSchedules(schedulesData);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete schedule.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGeneratedReport = async (reportID: string) => {
    setLoading(true);
    try {
      await deleteGeneratedReport(reportID);
      const reports = await listGeneratedReports();
      setGeneratedReports(reports);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete generated report.");
    } finally {
      setLoading(false);
    }
  };

  const validateIPAddress = (ip: string): boolean => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  const renderFilterForm = () => (
    <div className="filter-card">
      <h3>Filter</h3>
      <div className="form-group">
        <label className="filter-label">Report Type</label>
        <Select
          options={reportTypes.map(type => ({ value: type, label: type }))}
          value={reportTypeFilter ? { value: reportTypeFilter, label: reportTypeFilter } : null}
          onChange={(option) => setReportTypeFilter(option?.value || "")}
          placeholder="Type"
          isClearable
          isSearchable
          className="react-select-container"
          classNamePrefix="react-select"
        />
      </div>
      <div className="form-group">
        <label className="filter-label">Format</label>
        <div className="button-group">
          {formats.map(fmt => (
            <button
              key={fmt}
              className={`toggle-btn ${formatFilter === fmt ? 'active' : ''}`}
              onClick={() => setFormatFilter(fmt)}
            >
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group form-group-d">
        <label className="filter-label">Date Range</label>
        <div className="date-picker-container form-group-d">
          <DatePicker
            selected={dateStart ? new Date(dateStart) : null}
            onChange={(date: Date | null) => date ? setDateStart(date.toISOString().split("T")[0]) : setDateStart("")}
            placeholderText="Start Date"
            className="date-input"
          />
          <DatePicker
            selected={dateEnd ? new Date(dateEnd) : null}
            onChange={(date: Date | null) => date ? setDateEnd(date.toISOString().split("T")[0]) : setDateEnd("")}
            placeholderText="End Date"
            className="date-input"
          />
        </div>
      </div>
    </div>
  );

  const renderGenerateForm = () => {
    const filters = selectedReportType ? allowedFilters[selectedReportType] || [] : [];

    const filterSections = [
      { title: "Date Range", filters: ["dateRange"] },
      { title: "User Selection", filters: ["supervisorID", "regionalManagerID", "directorID", "agentID", "userID"] },
      { title: "Location", filters: ["regionID", "governorateID", "delegationID"] },
      {
        title: "Other Filters",
        filters: filters.filter(f => !["dateRange", "supervisorID", "regionalManagerID", "directorID", "agentID", "userID", "regionID", "governorateID", "delegationID"].includes(f)),
      },
    ];

    const renderRangeInput = (filter: string, label: string) => (
      <div className="form-group range-group">
        <label className="filter-label">{label}</label>
        <div className="range-inputs flex gap-2">
          <input
            type="number"
            value={(filterValues[filter] as RangeFilter)?.min || ""}
            onChange={(e) => setFilterValues(prev => ({
              ...prev,
              [filter]: { ...prev[filter] as RangeFilter, min: Number(e.target.value) }
            }))}
            className="range-input"
            placeholder="Min"
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
            placeholder="Max"
          />
        </div>
      </div>
    );

    const renderBooleanToggle = (filter: string, label: string) => (
      <div className="form-group toggle-group">
        <label className="filter-label">{label}</label>
        <div
          className={`toggle-switch ${filterValues[filter] ? 'active' : ''}`}
          onClick={() => setFilterValues(prev => ({ ...prev, [filter]: !prev[filter] }))}
        >
          <span className="toggle-slider"></span>
        </div>
      </div>
    );

    return (
      <div className="form-card">
        <div className="form-header">
          <h3>Create New Report</h3>
          {filters.length > 0 && (
            <button
              className={`toggle-btn ${isFilterOpen ? 'active' : ''} toggle-btn-1`}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <FaFilter /> Filters
            </button>
          )}
        </div>
        <div className="form-content">
          <div className="report-form">
            <div className="form-group fg-1">
              <label className="filter-label">Report Type</label>
              <Select
                options={reportTypes.map(type => ({ value: type, label: type }))}
                value={selectedReportType ? { value: selectedReportType, label: selectedReportType } : null}
                onChange={(option) => setSelectedReportType(option?.value || "")}
                placeholder="Select Report Type"
                isSearchable
                className="react-select-container"
                classNamePrefix="react-select"
              />
            </div>
            <div className="form-group">
              <label className="filter-label">Format</label>
              <div className="button-group">
                {formats.map(fmt => (
                  <button
                    key={fmt}
                    className={`toggle-btn ${selectedFormat === fmt ? 'active' : ''} toggle-btn-1`}
                    onClick={() => setSelectedFormat(fmt as "pdf" | "excel")}
                  >
                    {fmt.toUpperCase()}
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
              <h4>Filter Options</h4>
              {filterSections.map(section => (
                <Accordion title={section.title} key={section.title}>
                  <div className="filter-grid">
                    {section.filters.map(filter => {
                      switch (filter) {
                        case "dateRange":
                          const dateRange = filterValues[filter] as DateRangeFilter | undefined;
                          return (
                            <div key={filter} className="form-group date-range-group col-span-2">
                              <label className="filter-label">Date Range</label>
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
                                  placeholderText="Start Date"
                                  className="date-input"
                                />
                                <span className="date-divider">to</span>
                                <DatePicker
                                  selected={dateRange?.end ? new Date(dateRange.end) : null}
                                  onChange={(date: Date | null) => setFilterValues(prev => ({
                                    ...prev,
                                    [filter]: {
                                      ...((prev[filter] && typeof prev[filter] === 'object' ? prev[filter] : { start: "", end: "" })),
                                      end: date ? date.toISOString() : ""
                                    }
                                  }))}
                                  placeholderText="End Date"
                                  className="date-input"
                                />
                              </div>
                            </div>
                          );
                        case "supervisorID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">Supervisor</label>
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
                                placeholder="Select Supervisor"
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
                              <label className="filter-label">Regional Manager</label>
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
                                placeholder="Select Regional Manager"
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
                              <label className="filter-label">Director</label>
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
                                placeholder="Select Director"
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
                              <label className="filter-label">Agent</label>
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
                                placeholder="Select Agent"
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
                              <label className="filter-label">Region</label>
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
                                placeholder="Select Region"
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
                              <label className="filter-label">Governorate</label>
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
                                placeholder="Select Governorate"
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
                              <label className="filter-label">Delegation</label>
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
                                placeholder="Select Delegation"
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "visitType":
                          return renderBooleanToggle(filter, "Recruitment Visits");
                        case "status":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">Status</label>
                              <Select
                                isMulti
                                options={(selectedReportType === "UserActivity" ? logStatuses : statusOptions).map(option => ({ value: option, label: option }))}
                                value={(filterValues[filter] as string[] || []).map(val => ({ value: val, label: val }))}
                                onChange={(options) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: options.map(opt => opt.value)
                                }))}
                                placeholder="Select Status"
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
                              <label className="filter-label">Visit Reasons</label>
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
                                placeholder="Select Reasons"
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "checklistCompleted":
                          return renderBooleanToggle(filter, "Checklist Completed");
                        case "visitDuration":
                          return renderRangeInput(filter, "Visit Duration (minutes)");
                        case "aiAnomalies":
                          return renderBooleanToggle(filter, "AI Anomalies");
                        case "numberOfVisits":
                          return renderRangeInput(filter, "Number of Visits");
                        case "totalHours":
                          return renderRangeInput(filter, "Total Hours");
                        case "aiSuggestions":
                          return renderBooleanToggle(filter, "AI Suggestions");
                        case "anomaliesDetected":
                          return renderBooleanToggle(filter, "Anomalies Detected");
                        case "visitStatus":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">Visit Status</label>
                              <Select
                                isMulti
                                options={visitStatusOptions.map(option => ({ value: option, label: option }))}
                                value={(filterValues[filter] as string[] || []).map(val => ({ value: val, label: val }))}
                                onChange={(options) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: options.map(opt => opt.value)
                                }))}
                                placeholder="Select Visit Status"
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
                              <label className="filter-label">Week Number</label>
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
                                placeholder="Enter Week (1-52)"
                              />
                            </div>
                          );
                        case "bookType":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">Book Type</label>
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
                                placeholder="Select Book Type"
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "currentHolderName":
                          const holders = receiptBooks.reduce((acc, book) => {
                            if (book.holder) acc.add(`${book.holder.firstname} ${book.holder.lastname} (${book.holder.phone})`);
                            return acc;
                          }, new Set<string>());
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">Current Holder</label>
                              <Select
                                options={[...holders].map(holder => ({
                                  value: holder,
                                  label: holder
                                }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                placeholder="Select Current Holder"
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "assignmentStatus":
                          return renderBooleanToggle(filter, "Assigned");
                        case "roleID":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">Role</label>
                              <Select
                                options={roles.map(role => ({ value: role, label: role }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                placeholder="Select Role"
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
                              <label className="filter-label">Activity Type</label>
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
                                placeholder="Select Activity Type"
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
                              <label className="filter-label">User</label>
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
                                placeholder="Select User"
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "suspiciousActivity":
                          return renderBooleanToggle(filter, "Suspicious Activity");
                        case "ipAddress":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">IP Address</label>
                              <input
                                type="text"
                                value={filterValues[filter] as string || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value && !validateIPAddress(value)) {
                                    setError("Invalid IP address format.");
                                  } else {
                                    setError(null);
                                    setFilterValues(prev => ({ ...prev, [filter]: value }));
                                  }
                                }}
                                className="text-input"
                                placeholder="e.g., 192.168.1.1"
                              />
                            </div>
                          );
                        case "anomalyType":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">Anomaly Type</label>
                              <Select
                                options={anomalyTypes.map(type => ({ value: type, label: type }))}
                                value={filterValues[filter] ? {
                                  value: filterValues[filter] as string,
                                  label: filterValues[filter] as string
                                } : null}
                                onChange={(option) => setFilterValues(prev => ({
                                  ...prev,
                                  [filter]: option?.value || ""
                                }))}
                                placeholder="Select Anomaly Type"
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "affectedEntity":
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">Affected Entity</label>
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
                                placeholder="Select Affected Entity"
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
                              <label className="filter-label">Severity</label>
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
                                placeholder="Select Severity"
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
                              <label className="filter-label">Route</label>
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
                                placeholder="Select Route"
                                isSearchable
                                isClearable
                                className="react-select-container"
                                classNamePrefix="react-select"
                              />
                            </div>
                          );
                        case "performanceScore":
                          return renderRangeInput(filter, "Performance Score");
                        case "stubsCollected":
                          return renderRangeInput(filter, "Stubs Collected");
                        case "receiptBooksAssigned":
                          return renderRangeInput(filter, "Receipt Books Assigned");
                        case "visitCompletionRate":
                          return renderRangeInput(filter, "Visit Completion Rate (%)");
                        case "locationUpdated":
                          return renderBooleanToggle(filter, "Location Updated");
                        default:
                          return (
                            <div key={filter} className="form-group">
                              <label className="filter-label">{filter}</label>
                              <input
                                type="text"
                                value={(filterValues[filter] as string) || ""}
                                onChange={(e) => setFilterValues(prev => ({ ...prev, [filter]: e.target.value }))}
                                className="text-input"
                                placeholder={`Enter ${filter}`}
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
            Cancel
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={loading || !selectedReportType}
            className="submit-btn primary"
          >
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </div>
      </div>
    );
  };

  const renderScheduleForm = () => (
    <div className="form-card">
      <div className="form-header">
        <FaClock className="header-icon" />
        <h3>Schedule New Report</h3>
      </div>
      <div className="form-content">
        <div className="form-group">
          <label className="filter-label">Report Type</label>
          <Select
            options={reportTypes.map(type => ({ value: type, label: type }))}
            value={selectedReportType ? { value: selectedReportType, label: selectedReportType } : null}
            onChange={(option) => setSelectedReportType(option?.value || "")}
            placeholder="Select Report Type"
            isSearchable
            className="react-select-container"
            classNamePrefix="react-select"
          />
        </div>
        <div className="form-group">
          <label className="filter-label">Format</label>
          <div className="button-group">
            {formats.map(fmt => (
              <button
                key={fmt}
                className={`toggle-btn ${selectedFormat === fmt ? 'active' : ''} toggle-btn-1`}
                onClick={() => setSelectedFormat(fmt as "pdf" | "excel")}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="filter-label">Cron Expression</label>
          <input
            type="text"
            value={cronExpression}
            onChange={(e) => setCronExpression(e.target.value)}
            placeholder="e.g., 0 0 12 * * ?"
            className="text-input"
          />
        </div>
      </div>
      <div className="form-actions">
        <button
          className="submit-btn secondary"
          onClick={() => setView("scheduled")}
        >
          Cancel
        </button>
        <button
          onClick={handleScheduleReport}
          disabled={loading || !selectedReportType || !cronExpression}
          className="submit-btn primary"
        >
          {loading ? "Scheduling..." : "Schedule Report"}
        </button>
      </div>
    </div>
  );

  const renderSkeleton = () => (
    <div className="table-card" aria-busy="true">
      <h2>Loading...</h2>
      <div className="table-container">
        <div className="table-head">
          {view === "scheduled" ? (
            <div className="table-row-1 table-row-0  table-row-8">
              <div className="table-cell">Schedule ID</div>
              <div className="table-cell">Report Type</div>
              <div className="table-cell">Format</div>
              <div className="table-cell">Cron Expression</div>
              <div className="table-cell">Created At</div>
              <div className="table-cell">Actions</div>
            </div>
          ) : (
            <div className="table-row-1 table-row-0  table-row-9">
              <div className="table-cell">Report ID</div>
              <div className="table-cell">Report Type</div>
              <div className="table-cell">Format</div>
              <div className="table-cell">Generated At</div>
              <div className="table-cell">Actions</div>
            </div>
          )}
        </div>
        <div className="table-body">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="table-row ">
              <div className="table-cell"><div className="skeleton"></div></div>
              <div className="table-cell"><div className="skeleton"></div></div>
              <div className="table-cell"><div className="skeleton"></div></div>
              <div className="table-cell"><div className="skeleton"></div></div>
              <div className="table-cell"><div className="skeleton"></div></div>
              {view === "scheduled" && <div className="table-cell"><div className="skeleton"></div></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderListView = () => (
    <motion.div
      className="table-card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {loading && (view === "scheduled" ? schedules.length === 0 : generatedReports.length === 0) ? (
        renderSkeleton()
      ) : (
        <div className="table-container">
          <h2>{view === "scheduled" ? "Scheduled Reports" : "Generated Reports"}</h2>
          <div className="table-head">
            {view === "scheduled" ? (
              <div className="table-row-1 table-row-0  table-row-8">
                <div className="table-cell sortable" onClick={() => { setScheduleSort("scheduleID"); setScheduleSortOrder(prev => prev === "asc" ? "desc" : "asc"); }}>
                  Schedule ID <FaSort />
                </div>
                <div className="table-cell sortable" onClick={() => { setScheduleSort("reportType"); setScheduleSortOrder(prev => prev === "asc" ? "desc" : "asc"); }}>
                  Report Type <FaSort />
                </div>
                <div className="table-cell">Format</div>
                <div className="table-cell">Cron Expression</div>
                <div className="table-cell sortable" onClick={() => { setScheduleSort("createdAt"); setScheduleSortOrder(prev => prev === "asc" ? "desc" : "asc"); }}>
                  Created At <FaSort />
                </div>
                <div className="table-cell">Actions</div>
              </div>
            ) : (
              <div className="table-row-1 table-row-0 table-row-9">
                <div className="table-cell sortable" onClick={() => { setReportSort("generatedReportID"); setReportSortOrder(prev => prev === "asc" ? "desc" : "asc"); }}>
                  Report ID <FaSort />
                </div>
                <div className="table-cell sortable" onClick={() => { setReportSort("reportType"); setReportSortOrder(prev => prev === "asc" ? "desc" : "asc"); }}>
                  Report Type <FaSort />
                </div>
                <div className="table-cell">Format</div>
                <div className="table-cell sortable" onClick={() => { setReportSort("generatedAt"); setReportSortOrder(prev => prev === "asc" ? "desc" : "asc"); }}>
                  Generated At <FaSort />
                </div>
                <div className="table-cell">Actions</div>
              </div>
            )}
          </div>
          <div className="table-body">
            {view === "scheduled" ? (
              filteredSchedules.length > 0 ? (
                filteredSchedules.map(schedule => (
                  <div className="table-row-1 table-row-0 table-row-8">
                    <div className="table-cell">{schedule.scheduleID}</div>
                    <div className="table-cell">{schedule.reportType}</div>
                    <div className="table-cell">{schedule.format.toUpperCase()}</div>
                    <div className="table-cell">{schedule.cronExpression}</div>
                    <div className="table-cell">{new Date(schedule.createdAt).toLocaleString()}</div>
                    <div className="table-cell actions flex space-x-2">
                      <button onClick={() => handleDeleteSchedule(schedule.scheduleID)} disabled={loading} className="action-btn delete">
                        <FaTrash aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="table-row no-data">No scheduled reports found.</div>
              )
            ) : (
              filteredGeneratedReports.length > 0 ? (
                filteredGeneratedReports.map(report => (
                  <div className="table-row-1 table-row-0 table-row-9">
                    <div className="table-cell">{report.generatedReportID}</div>
                    <div className="table-cell">{report.reportType}</div>
                    <div className="table-cell">{report.format.toUpperCase()}</div>
                    <div className="table-cell">{new Date(report.generatedAt).toLocaleString()}</div>
                    <div className="table-cell actions flex space-x-2">
                      <button onClick={() => handleDownloadReport(report.filePath)} disabled={loading} className="action-btn download">
                        <FaDownload aria-hidden="true" />
                      </button>
                      <button onClick={() => handleDeleteGeneratedReport(report.generatedReportID)} disabled={loading} className="action-btn delete">
                        <FaTrash aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="table-row no-data">No generated reports found.</div>
              )
            )}
          </div>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="reporting-container">
      {error && <div className="error-message">{error}</div>}
      <header className="dashboard-header">
        <h1>
          {view === "scheduled" ? "Scheduled Reports" :
            view === "generated" ? "Generated Reports" :
              view === "generate" ? "Generate Report" : "Schedule Report"}
        </h1>
      </header>
      <section className="dashboard-content">
        <aside className="sidebar">
          <div className="filter-card">
            <h3>Manager</h3>
            <div className="manager-buttons">
              <button
                className={`action-btn ${view === "scheduled" ? "active" : ""}`}
                onClick={() => setView("scheduled")}
              >
                <FaList /> Scheduled Reports
              </button>
              <button
                className={`action-btn ${view === "generated" ? "active" : ""}`}
                onClick={() => setView("generated")}
              >
                <FaList /> Generated Reports
              </button>
              <button
                className={`action-btn ${view === "generate" ? "active" : ""}`}
                onClick={() => setView("generate")}
              >
                <FaPlus /> Generate Report
              </button>
              <button
                className={`action-btn ${view === "schedule" ? "active" : ""}`}
                onClick={() => setView("schedule")}
              >
                <FaClock /> Schedule Report
              </button>
            </div>
          </div>
          {(view === "scheduled" || view === "generated") && renderFilterForm()}
        </aside>
        <main className="main-content">
          {(view === "scheduled" || view === "generated") && renderListView()}
          {view === "generate" && renderGenerateForm()}
          {view === "schedule" && renderScheduleForm()}
        </main>
      </section>
    </div>
  );
};

export default ReportingPage;