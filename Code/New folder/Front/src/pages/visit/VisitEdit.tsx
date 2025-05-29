/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { debounce } from "lodash";
import { FaListUl, FaArrowLeft } from "react-icons/fa";
import "./VisitDetails.css";
import "../Timesheet/TimesheetForm.css";
import { useAuth } from "../../context/AuthContext";
import Visit from "../../models/Visit";
import Agent from "../../models/Agent";
import User from "../../models/User";
import { Checklist } from "../../models/Checklist";
import { Reason } from "../../models/Reason";
import Region from "../../models/Region";
import Governorate from "../../models/Governorate";
import Delegation from "../../models/Delegation";
import {
  getAgentById,
  getAgentsByDelegation,
  getAgentByPhone,
  getAgentsByUser,
} from "../../apis/agentAPI";
import {
  getSupervisorsByRegionalManager,
  getRegionalManagerBySupervisor,
  getAllUsers,
  getUsersByRegion,
  getUsersByGovernorate,
  getUsersByDelegation,
  getUserById,
  getUserByPhone,
} from "../../apis/userAPI";
import { getAllChecklists } from "../../apis/checklistAPI";
import { getAllReasons } from "../../apis/reasonAPI";
import { getVisitById } from "../../apis/visitAPI";
import { getTimesheetById } from "../../apis/timesheetAPI";
import {
  getRegionsByUser,
  getDelegationsByUser,
  getGovernoratesByUser,
  getAllRegions,
  getAllGovernorates,
  getAllDelegations,
  getDelegationsByGovernorate,
  getGovernoratesByRegion,
  getRegionsByGovernorate,
  getGovernoratesByDelegation,
} from "../../apis/locationApi";
import { useTranslation } from "react-i18next";
import VisitEditForm, { EditFormState } from "./VisitEditForm";

// Constants for environment variables and permissions
const PERMISSIONS = {
  ACCESS_VISIT_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS,
  EDIT_TIMESHEETS_FOR_SUPERVISOR: import.meta.env.VITE_PERMISSIONS_EDIT_VISIT,
  READ_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
  READ_AGENTS_BY_LOCATION: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_DELEGATION,
  READ_AGENTS_BY_PHONE: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_PHONE,
  READ_REASON_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS,
  READ_CHECKLISTS_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS,
  CREATE_TIMESHEETS_FOR_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR,
  LOG_VISITS: import.meta.env.VITE_PERMISSIONS_LOG_VISITS,
} as const;

const ROLES = {
  SUPER_ADMIN: import.meta.env.VITE_ROLES_SUPER_ADMIN,
  SUPERVISOR: import.meta.env.VITE_ROLES_SUPERVISOR,
  REGIONAL_MANAGER: import.meta.env.VITE_ROLES_REGIONAL_MANAGER,
  DIRECTOR: import.meta.env.VITE_ROLES_DIRECTOR,
};

// Interface for edit tracking
interface EditTracking {
  startTime: number | null;
  durationAccumulator: number; // in minutes
}

/**
 * VisitEdit component: Manages editing of visit details with form and camera capabilities.
 */
const VisitEdit: React.FC = () => {
  const { t } = useTranslation();
  const { idVisit } = useParams<{ idVisit: string }>();
  const navigate = useNavigate();
  const { user, effectivePermissions, permissionsLoaded } = useAuth();

  // State management
  const [visit, setVisit] = useState<Visit | null>(null);
  const [, setAgent] = useState<Agent | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [regionalManagers, setRegionalManagers] = useState<User[]>([]);
  const [selectedRegionalManager, setSelectedRegionalManager] = useState<string>("");
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>("");
  const [supervisorPhone, setSupervisorPhone] = useState<string>("");
  const [disableLocationInputs, setDisableLocationInputs] = useState<boolean>(false);
  const [disableSupervisorInput, setDisableSupervisorInput] = useState<boolean>(false);
  const [disableRegionalManagerInput, setDisableRegionalManagerInput] = useState<boolean>(false);
  const [fetchMode, setFetchMode] = useState<"none" | "supervisor" | "agent">("none");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);
  const [agentLoading, setAgentLoading] = useState<boolean>(false);
  const [supervisorLoading, setSupervisorLoading] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);

  const [editTracking, setEditTracking] = useState<EditTracking>({
    startTime: null,
    durationAccumulator: 0,
  });

  const [editForm, setEditForm] = useState<EditFormState>({
    date: "",
    time: "",
    regionID: "",
    governorateID: "",
    delegationID: "",
    status: "",
    comment: "",
    agentID: "",
    agentSearch: "",
    agentPhone: "",
    regionSearch: "",
    governorateSearch: "",
    delegationSearch: "",
    reasonSearch: "",
    checklistSearch: "",
    regionalManagerSearch: "",
    supervisorSearch: "",
    duration: null,
    checklists: [],
    reasons: [],
    photosToRemove: [],
    original: {
      date: "",
      time: "",
      regionID: "",
      governorateID: "",
      delegationID: "",
      status: "",
      comment: "",
      agentID: "",
      checklists: [],
      reasons: [],
    },
  });

  // Permission checks
  const userPermissions = useMemo(
    () => ({
      canAccessVisitDetails: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_VISIT_DETAILS
      ) ?? false,
      canLogVisits: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.LOG_VISITS
      ) ?? false,
      canEditTimesheets: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.EDIT_TIMESHEETS_FOR_SUPERVISOR
      ) ?? false,
      canReadSupervisors: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_SUPERVISORS
      ) ?? false,
      canReadAgentsByLocation: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_AGENTS_BY_LOCATION
      ) ?? false,
      canReadAgentsByPhone: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_AGENTS_BY_PHONE
      ) ?? false,
      canReadReasons: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_REASON_ITEMS
      ) ?? false,
      canReadChecklists: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_CHECKLISTS_ITEMS
      ) ?? false,
      canCreateTimesheetsForSupervisors: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.CREATE_TIMESHEETS_FOR_SUPERVISORS
      ) ?? false,
    }),
    [effectivePermissions]
  );

  // Role checks
  const isSuperAdmin = useMemo(
    () => user?.Roles?.some((role) => role.name === ROLES.SUPER_ADMIN) ?? false,
    [user]
  );
  const isRegionalManager = useMemo(
    () => user?.Roles?.some((role) => role.name === ROLES.REGIONAL_MANAGER) ?? false,
    [user]
  );
  const isSupervisor = useMemo(
    () => user?.Roles?.some((role) => role.name === ROLES.SUPERVISOR) ?? false,
    [user]
  );
  const isDirector = useMemo(
    () => user?.Roles?.some((role) => role.name === ROLES.DIRECTOR) ?? false,
    [user]
  );

  // Data fetching
  const fetchVisitData = useCallback(async () => {
    if (!idVisit || !userPermissions.canAccessVisitDetails) {
      navigate("/access-denied");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const visitData = await getVisitById(idVisit);
      setVisit(visitData);

      // Fetch timesheet to get supervisorID
      const timesheetData = await getTimesheetById(visitData.timesheetID);

      const agentData = visitData.agentID
        ? await getAgentById(visitData.agentID)
        : null;
      setAgent(agentData);

      const promises: [
        Promise<Region[]>,
        Promise<Governorate[]>,
        Promise<Delegation[]>,
        Promise<Reason[]>,
        Promise<Checklist[]>,
        Promise<User[]>,
        Promise<User[]>
      ] = [
          userPermissions.canReadAgentsByLocation
            ? isSupervisor
              ? getRegionalManagerBySupervisor(user!.userID).then((rms) =>
                rms.length > 0 ? getRegionsByUser(rms[0].userID) : []
              )
              : isRegionalManager
                ? getRegionsByUser(user!.userID)
                : getAllRegions()
            : Promise.resolve([]),
          getAllGovernorates(),
          getAllDelegations(),
          userPermissions.canReadReasons
            ? getAllReasons()
            : Promise.resolve([]),
          userPermissions.canReadChecklists
            ? getAllChecklists()
            : Promise.resolve([]),
          userPermissions.canReadSupervisors &&
            (isSuperAdmin || isDirector || isRegionalManager)
            ? isRegionalManager
              ? getSupervisorsByRegionalManager(user!.userID)
              : getAllUsers().then((users) =>
                users.filter((u) =>
                  u.Roles?.some(
                    (role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase()
                  )
                )
              )
            : Promise.resolve([]),
          (isSuperAdmin || isDirector)
            ? getAllUsers().then((users) =>
              users.filter((u) =>
                u.Roles?.some(
                  (role) =>
                    role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase()
                )
              )
            )
            : Promise.resolve([]),
        ];

      const [
        regionsData,
        governoratesData,
        delegationsData,
        reasonsData,
        checklistsData,
        supervisorsData,
        regionalManagersData,
      ] = await Promise.all(promises);

      setRegions(regionsData);
      setGovernorates(governoratesData);
      setDelegations(delegationsData);
      setReasons(reasonsData);
      setChecklists(checklistsData);
      setSupervisors(supervisorsData);
      setRegionalManagers(regionalManagersData);

      // Handle location data for all visits
      let regionID = "";
      let governorateID = "";
      let delegationID = visitData.location || "";

      if (agentData && agentData.Delegation?.Governorate?.governorateID) {
        const regions = await getRegionsByGovernorate(agentData.Delegation.Governorate.governorateID);
        regionID = regions?.[0]?.regionID || "";
        governorateID = agentData.Delegation.Governorate.governorateID;
        delegationID = agentData.delegationID || visitData.location || "";
      } else if (visitData.location) {
        // Parse location string (assumed format: "Region, Governorate, Delegation")
        const locationParts = visitData.location.split(",").map(part => part.trim());
        if (locationParts.length >= 3) {
          const [regionName, governorateName, delegationName] = locationParts;
          const region = regionsData.find(r => r.name.toLowerCase() === regionName.toLowerCase());
          const governorate = governoratesData.find(g => g.name.toLowerCase() === governorateName.toLowerCase());
          const delegation = delegationsData.find(d => d.name.toLowerCase() === delegationName.toLowerCase());
          regionID = region?.regionID || "";
          governorateID = governorate?.governorateID || "";
          delegationID = delegation?.delegationID || "";
        } else if (locationParts.length === 1) {
          // Only delegation provided
          const delegation = delegationsData.find(d => d.name.toLowerCase() === locationParts[0].toLowerCase());
          if (delegation) {
            delegationID = delegation.delegationID;
            const govs = await getGovernoratesByDelegation(delegationID);
            if (govs.length === 1) {
              governorateID = govs[0].governorateID;
              const regs = await getRegionsByGovernorate(governorateID);
              regionID = regs.length === 1 ? regs[0].regionID : "";
            }
          }
        }
      }

      setEditForm({
        date: visitData.date,
        time: visitData.time.slice(0, 5),
        regionID,
        governorateID,
        delegationID,
        status: visitData.status,
        comment: visitData.comment || "",
        agentID: visitData.agentID || "",
        agentSearch: agentData ? `${agentData.name} ${agentData.lastname}` : "",
        agentPhone: "",
        regionSearch: "",
        governorateSearch: "",
        delegationSearch: "",
        reasonSearch: "",
        checklistSearch: "",
        regionalManagerSearch: "",
        supervisorSearch: "",
        duration: visitData.duration || null,
        checklists:
          visitData.Checklists?.map((c) => ({
            id: c.checklistID,
            checked: c.VisitChecklist?.checked || false,
          })) || [],
        reasons: visitData.Reasons?.map((r) => ({ id: r.reasonID })) || [],
        photosToRemove: [],
        original: {
          date: visitData.date,
          time: visitData.time.slice(0, 5),
          regionID,
          governorateID,
          delegationID,
          status: visitData.status,
          comment: visitData.comment || "",
          agentID: visitData.agentID || "",
          checklists:
            visitData.Checklists?.map((c) => ({
              id: c.checklistID,
              checked: c.VisitChecklist?.checked || false,
            })) || [],
          reasons: visitData.Reasons?.map((r) => ({ id: r.reasonID })) || [],
        },
      });
      setSelectedSupervisor(timesheetData.supervisorID || "");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("visitDetails.error.fetchFailed");
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [idVisit, userPermissions, permissionsLoaded, navigate, user, t]);

  // Effect to fetch visit data
  useEffect(() => {
    if (permissionsLoaded) fetchVisitData();
  }, [fetchVisitData, permissionsLoaded]);

  useEffect(() => {
    console.log("newPhotos updated:", newPhotos);
  }, [newPhotos]);


  // Camera handling
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        await new Promise<void>((resolve, reject) => {
          if (videoRef.current) {
            videoRef.current.oncanplay = () => resolve();
            videoRef.current.onerror = () => reject(new Error("Video failed to play"));
            videoRef.current.play();
          } else {
            reject(new Error("Video ref is null"));
          }
        });
      } else {
        throw new Error("Video ref is null");
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.name === "NotReadableError"
            ? t("visitDetails.error.cameraInUse")
            : t("visitDetails.error.cameraAccess")
          : t("visitDetails.error.unknown");
      setError(errorMessage);
      console.error("Camera access error:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
        console.log("Camera track stopped:", track);
      });
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
      console.log("Camera stopped");
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current) {
      videoRef.current.play().catch((err: unknown) => {
        setError(t("visitDetails.error.cameraPlayFailed"));
        console.error("Video play failed:", err);
      });
    }
  }, [isCameraActive, t]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error("Video or canvas ref is null");
      setError(t("visitDetails.error.videoNotFound"));
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error("Video stream is not ready");
      setError(t("visitDetails.error.videoNotReady"));
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      console.error("Failed to get 2D context from canvas");
      setError(t("visitDetails.error.canvasContextFailed"));
      return;
    }

    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `photo-${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            console.log("Captured photo:", file);
            setNewPhotos((prev) => {
              const updatedPhotos = [...prev, file];
              console.log("Updated newPhotos:", updatedPhotos);
              return updatedPhotos;
            });
            setFlashEffect(true);
            setTimeout(() => setFlashEffect(false), 300);
          } else {
            console.error("Failed to create blob from canvas");
            setError(t("visitDetails.error.blobCreationFailed"));
          }
        },
        "image/jpeg",
        0.95
      );
    } catch (err) {
      console.error("Error capturing photo:", err);
      setError(t("visitDetails.error.captureFailed"));
    }
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Data fetching by phone
  const fetchAgentByPhone = useCallback(
    debounce(async (phone: string) => {
      if (phone.length !== 8 || !userPermissions.canReadAgentsByPhone) return;
      setAgentLoading(true);
      try {
        const agentData = await getAgentByPhone(phone);
        if (!agentData) throw new Error("Agent not found");
        if (!agentData.delegationID) throw new Error("Agent has no delegation assigned");

        let supervisor: User | null = null;
        if (agentData.supervisorID) {
          supervisor = await getUserById(agentData.supervisorID);
        } else {
          throw new Error("Agent has no supervisor assigned");
        }

        const allDelegations = await getAllDelegations();
        const agentDelegation = allDelegations.find(
          (del) => del.delegationID === agentData.delegationID
        );
        if (!agentDelegation) throw new Error("Delegation not found");
        const supervisorDelegations = await getDelegationsByUser(supervisor.userID);
        if (
          !supervisorDelegations.some(
            (sd) => sd.delegationID === agentData.delegationID
          )
        ) {
          throw new Error("Agent's delegation is not assigned to the supervisor");
        }

        const governoratesData = await getGovernoratesByDelegation(
          agentData.delegationID
        );
        if (governoratesData.length === 0)
          throw new Error("No governorate found for delegation");
        if (governoratesData.length > 1)
          throw new Error("Multiple governorates found for delegation");
        const supervisorGovernorates = await getGovernoratesByUser(
          supervisor.userID
        );
        if (
          !supervisorGovernorates.some(
            (sg) => sg.governorateID === governoratesData[0].governorateID
          )
        ) {
          throw new Error(
            "Delegation's governorate is not assigned to the supervisor"
          );
        }

        const regionsData = await getRegionsByGovernorate(
          governoratesData[0].governorateID
        );
        if (regionsData.length === 0)
          throw new Error("No region found for governorate");
        if (regionsData.length > 1)
          throw new Error("Multiple regions found for governorate");

        setEditForm((prev) => ({
          ...prev,
          agentID: agentData.agentID,
          agentSearch: `${agentData.name || ""} ${agentData.lastname || ""}`,
          delegationID: agentData.delegationID,
          governorateID: governoratesData[0].governorateID,
          regionID: regionsData[0].regionID,
        }));
        setAgents([agentData]);
        setDelegations([agentDelegation]);
        setGovernorates(governoratesData);
        setRegions(regionsData);
        setSelectedSupervisor(supervisor.userID);
        setSupervisors([supervisor]);
        setDisableSupervisorInput(true);

        const regionalManagersData = await getUsersByRegion(regionsData[0].regionID);
        const filteredRegionalManagers = regionalManagersData.filter((u) =>
          u.Roles?.some(
            (role) => role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase()
          )
        );
        setRegionalManagers(filteredRegionalManagers);
        if (filteredRegionalManagers.length === 1) {
          setSelectedRegionalManager(filteredRegionalManagers[0].userID);
          setDisableRegionalManagerInput(true);
        } else {
          setSelectedRegionalManager("");
          setDisableRegionalManagerInput(false);
        }

        setDisableLocationInputs(true);
        setFetchMode("agent");
      } catch (err: any) {
        const errorMessage =
          t("visitDetails.error.agentNotFound") + `: ${err.message}`;
        setError(errorMessage);
        setEditForm((prev) => ({
          ...prev,
          agentID: "",
          agentSearch: "",
          delegationID: "",
          governorateID: "",
          regionID: "",
        }));
        setAgents([]);
        setDelegations([]);
        setGovernorates([]);
        setRegions([]);
        setSelectedSupervisor("");
        setSupervisors([]);
        setSelectedRegionalManager("");
        setRegionalManagers([]);
        setDisableLocationInputs(false);
        setDisableSupervisorInput(false);
        setDisableRegionalManagerInput(false);
        setFetchMode("none");
      } finally {
        setAgentLoading(false);
      }
    }, 500),
    [userPermissions.canReadAgentsByPhone, t]
  );

  const fetchSupervisorByPhone = useCallback(
    debounce(async (phone: string) => {
      if (
        phone.length < 8 ||
        !userPermissions.canReadSupervisors ||
        !userPermissions.canCreateTimesheetsForSupervisors
      )
        return;
      setSupervisorLoading(true);
      try {
        const supervisor = await getUserByPhone(phone);
        if (
          (isSuperAdmin || isDirector || isRegionalManager) &&
          !supervisor.Roles?.some(
            (role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase()
          )
        ) {
          throw new Error("User is not a supervisor");
        }
        setSelectedSupervisor(supervisor.userID);
        setSupervisors((prev) =>
          prev.some((s) => s.userID === supervisor.userID)
            ? prev
            : [...prev, supervisor]
        );
        setEditForm((prev) => ({
          ...prev,
          supervisorSearch: `${supervisor.firstname || ""} ${supervisor.lastname || ""}`,
        }));
        const regionalManagers = await getRegionalManagerBySupervisor(
          supervisor.userID
        );
        if (regionalManagers.length > 0) {
          setSelectedRegionalManager(regionalManagers[0].userID);
          setDisableRegionalManagerInput(true);
        }
        setFetchMode("supervisor");
      } catch (err) {
        setError(t("visitDetails.error.supervisorNotFound"));
        setSelectedSupervisor("");
        setEditForm((prev) => ({ ...prev, supervisorSearch: "" }));
        setFetchMode("none");
      } finally {
        setSupervisorLoading(false);
      }
    }, 500),
    [
      userPermissions.canReadSupervisors,
      userPermissions.canCreateTimesheetsForSupervisors,
      isSuperAdmin,
      isDirector,
      isRegionalManager,
      t,
    ]
  );

  // Effect for phone-based fetching
  useEffect(() => {
    if (editForm.agentPhone) fetchAgentByPhone(editForm.agentPhone);
    if (supervisorPhone) fetchSupervisorByPhone(supervisorPhone);
    return () => {
      fetchAgentByPhone.cancel();
      fetchSupervisorByPhone.cancel();
    };
  }, [
    editForm.agentPhone,
    supervisorPhone,
    fetchAgentByPhone,
    fetchSupervisorByPhone,
  ]);

  const supervisorID = isSupervisor
    ? user!.userID
    : userPermissions.canReadSupervisors && selectedSupervisor
      ? selectedSupervisor
      : "";

  // Effect for regional manager selection
  useEffect(() => {
    const handleRegionalManagerSelection = async () => {
      if (
        !userPermissions.canReadAgentsByLocation ||
        !selectedRegionalManager
      ) {
        setSupervisors([]);
        setRegions([]);
        setEditForm((prev) => ({
          ...prev,
          regionID: "",
          governorateID: "",
          delegationID: "",
          agentID: "",
          agentSearch: "",
        }));
        setDelegations([]);
        setAgents([]);
        setDisableLocationInputs(false);
        setFetchMode("none");
        return;
      }
      try {
        const [supervisorsData, regionsData] = await Promise.all([
          getSupervisorsByRegionalManager(selectedRegionalManager),
          getRegionsByUser(selectedRegionalManager),
        ]);
        setSupervisors(supervisorsData);
        setRegions(regionsData);
        setEditForm((prev) => ({
          ...prev,
          regionID: regionsData.length === 1 ? regionsData[0].regionID : "",
          governorateID: "",
          delegationID: "",
          agentID: "",
          agentSearch: "",
        }));
        setDelegations([]);
        setAgents([]);
        setDisableLocationInputs(false);
        setFetchMode("none");
      } catch (err) {
        setError(t("visitDetails.error.loadRegionalManagerData"));
      }
    };
    handleRegionalManagerSelection();
  }, [selectedRegionalManager, userPermissions.canReadAgentsByLocation, t]);

  // Effect for supervisor selection
  useEffect(() => {
    const handleSupervisorSelection = async () => {
      if (!supervisorID || fetchMode === "agent") {
        if (fetchMode !== "agent") {
          setSelectedRegionalManager("");
          setRegions([]);
          setEditForm((prev) => ({
            ...prev,
            regionID: "",
            governorateID: "",
            delegationID: "",
            agentID: "",
            agentSearch: "",
          }));
          setDelegations([]);
          setAgents([]);
          setDisableLocationInputs(false);
          setFetchMode("none");
        }
        return;
      }
      try {
        const regionalManagers = await getRegionalManagerBySupervisor(
          supervisorID
        );
        const regionalManagerID =
          regionalManagers.length > 0 ? regionalManagers[0].userID : "";
        setSelectedRegionalManager(regionalManagerID);
        const regionsData = regionalManagerID
          ? await getRegionsByUser(regionalManagerID)
          : await getAllRegions();
        setRegions(regionsData);
        setEditForm((prev) => ({
          ...prev,
          regionID: regionsData.length === 1 ? regionsData[0].regionID : "",
          governorateID: "",
          delegationID: "",
          agentID: "",
          agentSearch: "",
        }));
        setDelegations([]);
        setAgents([]);
        setDisableLocationInputs(false);
        setFetchMode("supervisor");
      } catch (err) {
        setError(t("visitDetails.error.loadSupervisorData"));
      }
    };
    handleSupervisorSelection();
  }, [supervisorID, fetchMode, t]);

  // Effect for governorates fetching
  useEffect(() => {
    const fetchGovernorates = async () => {
      if (
        !userPermissions.canReadAgentsByLocation ||
        !editForm.regionID ||
        disableLocationInputs
      ) {
        setGovernorates([]);
        setEditForm((prev) => ({
          ...prev,
          governorateID: "",
          delegationID: "",
          agentID: "",
          agentSearch: "",
        }));
        setDelegations([]);
        setAgents([]);
        return;
      }
      try {
        let governoratesData: Governorate[] = [];
        if (fetchMode === "supervisor" && supervisorID) {
          governoratesData = await getGovernoratesByRegion(editForm.regionID);
          const supervisorGovernorates = await getGovernoratesByUser(
            supervisorID
          );
          governoratesData = governoratesData.filter((gov) =>
            supervisorGovernorates.some(
              (sg) => sg.governorateID === gov.governorateID
            )
          );
        } else if (fetchMode === "none") {
          governoratesData = await getGovernoratesByRegion(editForm.regionID);
        } else {
          return;
        }
        setGovernorates(governoratesData);
        setEditForm((prev) => ({
          ...prev,
          governorateID:
            governoratesData.length === 1
              ? governoratesData[0].governorateID
              : "",
          delegationID: "",
          agentID: "",
          agentSearch: "",
        }));
        setDelegations([]);
        setAgents([]);
      } catch (err) {
        setError(t("visitDetails.error.governoratesLoadFailed"));
      }
    };
    fetchGovernorates();
  }, [
    editForm.regionID,
    supervisorID,
    userPermissions.canReadAgentsByLocation,
    disableLocationInputs,
    fetchMode,
    t,
  ]);

  // Effect for delegations fetching
  useEffect(() => {
    const fetchDelegations = async () => {
      if (
        !userPermissions.canReadAgentsByLocation ||
        !editForm.governorateID ||
        disableLocationInputs
      ) {
        setDelegations([]);
        setEditForm((prev) => ({
          ...prev,
          delegationID: "",
          agentID: "",
          agentSearch: "",
        }));
        setAgents([]);
        return;
      }
      try {
        let delegationsData: Delegation[] = [];
        if (fetchMode === "supervisor" && supervisorID) {
          delegationsData = await getDelegationsByGovernorate(
            editForm.governorateID
          );
          const supervisorDelegations = await getDelegationsByUser(supervisorID);
          delegationsData = delegationsData.filter((del) =>
            supervisorDelegations.some(
              (sd) => sd.delegationID === del.delegationID
            )
          );
        } else if (fetchMode === "none") {
          delegationsData = await getDelegationsByGovernorate(
            editForm.governorateID
          );
        } else {
          return;
        }
        setDelegations(delegationsData);
        setEditForm((prev) => ({
          ...prev,
          delegationID:
            delegationsData.length === 1 ? delegationsData[0].delegationID : "",
          agentID: "",
          agentSearch: "",
        }));
        setAgents([]);
      } catch (err) {
        setError(t("visitDetails.error.delegationsLoadFailed"));
      }
    };
    fetchDelegations();
  }, [
    editForm.governorateID,
    supervisorID,
    userPermissions.canReadAgentsByLocation,
    disableLocationInputs,
    fetchMode,
    t,
  ]);

  // Effect for agents fetching
  useEffect(() => {
    const fetchAgents = async () => {
      if (
        !userPermissions.canReadAgentsByLocation ||
        !editForm.delegationID ||
        fetchMode === "agent"
      ) {
        if (fetchMode !== "agent") {
          setAgents([]);
          setEditForm((prev) => ({ ...prev, agentID: "", agentSearch: "" }));
        }
        return;
      }
      setAgentLoading(true);
      try {
        let agentsData: { agents: Agent[] } = { agents: [] };
        if (fetchMode === "supervisor" && supervisorID) {
          agentsData = await getAgentsByUser(supervisorID);
          agentsData.agents = agentsData.agents.filter(
            (agent) => agent.delegationID === editForm.delegationID
          );
        } else if (fetchMode === "none") {
          agentsData = await getAgentsByDelegation(editForm.delegationID);
        }
        setAgents(agentsData.agents);
        setEditForm((prev) => ({
          ...prev,
          agentID:
            agentsData.agents.length === 1 ? agentsData.agents[0].agentID : "",
          agentSearch: "",
        }));
      } catch (err) {
        setError(
          t("visitDetails.error.agentsLoadFailed", {
            location: editForm.delegationID,
          })
        );
      } finally {
        setAgentLoading(false);
      }
    };
    fetchAgents();
  }, [editForm.delegationID, supervisorID, userPermissions.canReadAgentsByLocation, fetchMode, t]);

  // Effect for regional managers by region
  useEffect(() => {
    const fetchRegionalManagersByRegion = async () => {
      if (
        !(isSuperAdmin || isDirector) ||
        selectedRegionalManager ||
        supervisorID ||
        !editForm.regionID ||
        fetchMode === "agent"
      ) {
        return;
      }
      try {
        const regionalManagersData = await getUsersByRegion(editForm.regionID);
        const filteredRegionalManagers = regionalManagersData.filter((u) =>
          u.Roles?.some(
            (role) => role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase()
          )
        );
        setRegionalManagers(filteredRegionalManagers);
        setSelectedRegionalManager(
          filteredRegionalManagers.length === 1
            ? filteredRegionalManagers[0].userID
            : ""
        );
        setDisableRegionalManagerInput(filteredRegionalManagers.length === 1);
      } catch (err) {
        setError(t("visitDetails.error.loadRegionalManagers"));
      }
    };
    fetchRegionalManagersByRegion();
  }, [
    isSuperAdmin,
    isDirector,
    editForm.regionID,
    selectedRegionalManager,
    supervisorID,
    fetchMode,
    t,
  ]);

  // Effect for supervisors by location or agent
  useEffect(() => {
    const filterSupervisorsByLocationOrAgent = async () => {
      if (
        !userPermissions.canReadSupervisors ||
        supervisorID ||
        !(editForm.agentID || editForm.delegationID || editForm.governorateID) ||
        fetchMode === "agent"
      ) {
        return;
      }
      setSupervisorLoading(true);
      try {
        let supervisorsData: User[] = [];
        if (editForm.agentID) {
          const agent = await getAgentById(editForm.agentID);
          if (agent?.supervisorID) {
            const supervisor = await getUserById(agent.supervisorID);
            supervisorsData = [supervisor];
          }
        } else if (editForm.delegationID) {
          supervisorsData = await getUsersByDelegation(editForm.delegationID);
          supervisorsData = supervisorsData.filter((u) =>
            u.Roles?.some(
              (role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase()
            )
          );
        } else if (editForm.governorateID) {
          supervisorsData = await getUsersByGovernorate(editForm.governorateID);
          supervisorsData = supervisorsData.filter((u) =>
            u.Roles?.some(
              (role) => role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase()
            )
          );
        }
        setSupervisors(supervisorsData);
        setSelectedSupervisor(
          supervisorsData.length === 1 ? supervisorsData[0].userID : ""
        );
        setDisableSupervisorInput(supervisorsData.length === 1);
      } catch (err) {
        setError(t("visitDetails.error.loadSupervisors"));
      } finally {
        setSupervisorLoading(false);
      }
    };
    filterSupervisorsByLocationOrAgent();
  }, [
    editForm.governorateID,
    editForm.delegationID,
    editForm.agentID,
    supervisorID,
    userPermissions.canReadSupervisors,
    fetchMode,
    t,
  ]);

  // Effect for clearing agent phone
  useEffect(() => {
    if (!editForm.agentPhone) {
      setEditForm((prev) => ({
        ...prev,
        agentID: "",
        agentSearch: "",
        delegationID: "",
        governorateID: "",
        regionID: "",
      }));
      setAgents([]);
      setDelegations([]);
      setGovernorates([]);
      setRegions([]);
      setSelectedSupervisor("");
      setSupervisors([]);
      setSelectedRegionalManager("");
      setRegionalManagers([]);
      setDisableLocationInputs(false);
      setDisableSupervisorInput(false);
      setDisableRegionalManagerInput(false);
      setFetchMode("none");

      const refetchInitialData = async () => {
        try {
          const promises: [Promise<User[]>, Promise<User[]>, Promise<Region[]>] = [
            userPermissions.canReadSupervisors &&
              (isSuperAdmin || isDirector || isRegionalManager)
              ? isRegionalManager
                ? getSupervisorsByRegionalManager(user!.userID)
                : getAllUsers().then((users) =>
                  users.filter((u) =>
                    u.Roles?.some(
                      (role) =>
                        role.name.toLowerCase() === ROLES.SUPERVISOR.toLowerCase()
                    )
                  )
                )
              : Promise.resolve([]),
            (isSuperAdmin || isDirector)
              ? getAllUsers().then((users) =>
                users.filter((u) =>
                  u.Roles?.some(
                    (role) =>
                      role.name.toLowerCase() === ROLES.REGIONAL_MANAGER.toLowerCase()
                  )
                )
              )
              : Promise.resolve([]),
            userPermissions.canReadAgentsByLocation
              ? isSupervisor
                ? getRegionalManagerBySupervisor(user!.userID).then((rms) =>
                  rms.length > 0 ? getRegionsByUser(rms[0].userID) : []
                )
                : isRegionalManager
                  ? getRegionsByUser(user!.userID)
                  : getAllRegions()
              : Promise.resolve([]),
          ];
          const [supervisorsData, regionalManagersData, regionsData] = await Promise.all(promises);
          setSupervisors(supervisorsData);
          setRegionalManagers(regionalManagersData);
          setRegions(regionsData);
        } catch (err) {
          setError(t("visitDetails.error.fetchFailed"));
        }
      };
      refetchInitialData();
    }
  }, [
    editForm.agentPhone,
    userPermissions.canReadSupervisors,
    userPermissions.canReadAgentsByLocation,
    isSuperAdmin,
    isDirector,
    isRegionalManager,
    isSupervisor,
    user,
    t,
  ]);

  // Handlers
  const canEditField = (field: string) => {
    if (!visit) return false;
    switch (visit.status) {
      case "visited":
        return ["comment", "checklists", "photos"].includes(field);
      case "pending":
      case "validated":
      case "rejected":
        return [
          "dateTime",
          "regionID",
          "governorateID",
          "delegationID",
          "agentID",
          "checklists",
          "reasons",
          "supervisor",
        ].includes(field);
      default:
        return false;
    }
  };

  // Render
  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>{t("visitDetails.loading")}</p>
      </div>
    );
  }
  if (error || !visit) {
    return (
      <div className="visit-details-container">
        <div className="visit-details-error-card">
          <h2>{t("visitDetails.error.title")}</h2>
          <p>{error || t("visitDetails.error.notFound")}</p>
          <button
            className="visit-details-back-btn"
            onClick={() => navigate(`/visit/${idVisit}`)}
            aria-label={t("visitDetails.aria.backButton")}
          >
            <FaArrowLeft /> {t("visitDetails.actions.back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="visit-details-container">
      <header className="visit-details-header">
        <h1>
          <FaListUl /> {t("visitDetails.title")} - {t("visitDetails.actions.edit")}
          <span
            className={`status-dot status-${visit.status.toLowerCase()}`}
          ></span>
          {visit.duration !== null && (
            <div className="duration-clock">
              <svg className="clock-circle" viewBox="0 0 36 36">
                <circle className="clock-base" cx="18" cy="18" r="16" />
                <circle
                  className="clock-progress"
                  cx="18"
                  cy="18"
                  r="16"
                  strokeDasharray={`${Math.min(
                    (visit.duration! / 60) * 100,
                    100
                  )} 100`}
                />
              </svg>
              <span className="duration-text">
                {visit.duration}m
              </span>
            </div>
          )}
        </h1>
      </header>

      <section>
        <VisitEditForm
          visit={visit}
          editForm={editForm}
          setEditForm={setEditForm}
          userPermissions={userPermissions}
          isSuperAdmin={isSuperAdmin}
          isDirector={isDirector}
          isRegionalManager={isRegionalManager}
          isSupervisor={isSupervisor}
          regionalManagers={regionalManagers}
          selectedRegionalManager={selectedRegionalManager}
          setSelectedRegionalManager={setSelectedRegionalManager}
          supervisors={supervisors}
          selectedSupervisor={selectedSupervisor}
          setSelectedSupervisor={setSelectedSupervisor}
          supervisorPhone={supervisorPhone}
          setSupervisorPhone={setSupervisorPhone}
          regions={regions}
          governorates={governorates}
          delegations={delegations}
          agents={agents}
          reasons={reasons}
          checklists={checklists}
          disableLocationInputs={disableLocationInputs}
          setDisableLocationInputs={setDisableLocationInputs}
          disableSupervisorInput={disableSupervisorInput}
          setDisableSupervisorInput={setDisableSupervisorInput}
          disableRegionalManagerInput={disableRegionalManagerInput}
          setDisableRegionalManagerInput={setDisableRegionalManagerInput}
          agentLoading={agentLoading}
          supervisorLoading={supervisorLoading}
          fetchMode={fetchMode}
          setFetchMode={setFetchMode}
          isCameraActive={isCameraActive}
          setIsCameraActive={setIsCameraActive}
          newPhotos={newPhotos}
          setNewPhotos={setNewPhotos}
          flashEffect={flashEffect}
          setFlashEffect={setFlashEffect}
          videoRef={videoRef as React.RefObject<HTMLVideoElement>}
          canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
          editTracking={editTracking}
          setEditTracking={setEditTracking}
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          startCamera={startCamera}
          stopCamera={stopCamera}
          capturePhoto={capturePhoto}
          removeNewPhoto={removeNewPhoto}
          canEditField={canEditField}
          supervisorID={supervisorID}
          idVisit={idVisit}
          user={user}
          setVisit={setVisit}
          setError={setError}
          t={t}
          navigate={navigate}
        />
      </section>
    </div>
  );
};

export default VisitEdit;