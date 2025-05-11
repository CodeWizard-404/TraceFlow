/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { debounce } from "lodash";
import {
  FaCalendar,
  FaClock,
  FaMapMarkerAlt,
  FaUser,
  FaPhone,
  FaListUl,
  FaCheckCircle,
  FaArrowLeft,
  FaCircle,
  FaCamera,
  FaComment,
  FaTimes,
} from "react-icons/fa";
import "./VisitDetails.css";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";
import VisitStatus from "../../models/Enum/VisitStatus";
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
import { getVisitById, updateVisit } from "../../apis/visitAPI";
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

// Constants for environment variables and permissions
const BASE_URL = import.meta.env.VITE_BASE_URL;
const PERMISSIONS = {
  ACCESS_VISIT_DETAILS: import.meta.env.VITE_PERMISSIONS_ACCESS_VISIT_DETAILS,
  EDIT_TIMESHEETS_FOR_SUPERVISOR: import.meta.env.VITE_PERMISSIONS_EDIT_VISIT,
  READ_SUPERVISORS: import.meta.env.VITE_PERMISSIONS_READ_SUPERVISORS,
  READ_AGENTS_BY_LOCATION: import.meta.env
    .VITE_PERMISSIONS_READ_AGENTS_BY_DELEGATION,
  READ_AGENTS_BY_PHONE: import.meta.env.VITE_PERMISSIONS_READ_AGENTS_BY_PHONE,
  READ_REASON_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_REASON_ITEMS,
  READ_CHECKLISTS_ITEMS: import.meta.env.VITE_PERMISSIONS_READ_CHECKLISTS_ITEMS,
  CREATE_TIMESHEETS_FOR_SUPERVISORS: import.meta.env
    .VITE_PERMISSIONS_CREATE_TIMESHEETS_FOR_SUPERVISOR,
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

// Interface for edit form state with original values
interface EditFormState {
  date: string;
  time: string;
  regionID: string;
  governorateID: string;
  delegationID: string;
  status: string;
  comment: string;
  agentID: string;
  agentSearch: string;
  agentPhone: string;
  regionSearch: string;
  governorateSearch: string;
  delegationSearch: string;
  reasonSearch: string;
  checklistSearch: string;
  checklists: Array<{ id: string; checked: boolean }>;
  reasons: Array<{ id: string }>;
  photosToRemove: string[];
  regionalManagerSearch: string;
  supervisorSearch: string;
  original: {
    date: string;
    time: string;
    regionID: string;
    governorateID: string;
    delegationID: string;
    status: string;
    comment: string;
    agentID: string;
    checklists: Array<{ id: string; checked: boolean }>;
    reasons: Array<{ id: string }>;
  };
}

/**
 * VisitDetailsEdit component: Manages editing of visit details with form and camera capabilities.
 */
const VisitDetailsEdit: React.FC = () => {
  const { t } = useTranslation();
  const { idVisit } = useParams<{ idVisit: string }>();
  const navigate = useNavigate();
  const { user, effectivePermissions, permissionsLoaded } = useAuth();

  const [visit, setVisit] = useState<Visit | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
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
  const [agentLoading, setAgentLoading] = useState<boolean>(false);
  const [supervisorLoading, setSupervisorLoading] = useState<boolean>(false);
  const [disableLocationInputs, setDisableLocationInputs] = useState<boolean>(false);
  const [disableSupervisorInput, setDisableSupervisorInput] = useState<boolean>(false);
  const [disableRegionalManagerInput, setDisableRegionalManagerInput] = useState<boolean>(false);
  const [fetchMode, setFetchMode] = useState<"none" | "supervisor" | "agent">("none");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  const userPermissions = useMemo(
    () => ({
      canAccessVisitDetails: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.ACCESS_VISIT_DETAILS
      ),
      canLogVisits: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.LOG_VISITS
      ),
      canEditTimesheets: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.EDIT_TIMESHEETS_FOR_SUPERVISOR
      ),
      canReadSupervisors: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_SUPERVISORS
      ),
      canReadAgentsByLocation: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_AGENTS_BY_LOCATION
      ),
      canReadAgentsByPhone: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_AGENTS_BY_PHONE
      ),
      canReadReasons: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_REASON_ITEMS
      ),
      canReadChecklists: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.READ_CHECKLISTS_ITEMS
      ),
      canCreateTimesheetsForSupervisors: effectivePermissions?.some(
        (p) => p.name === PERMISSIONS.CREATE_TIMESHEETS_FOR_SUPERVISORS
      ),
    }),
    [effectivePermissions]
  );

  const isSuperAdmin = useMemo(
    () => user?.Roles?.some((role) => role.name === ROLES.SUPER_ADMIN),
    [user]
  );
  const isRegionalManager = useMemo(
    () => user?.Roles?.some((role) => role.name === ROLES.REGIONAL_MANAGER),
    [user]
  );
  const isSupervisor = useMemo(
    () => user?.Roles?.some((role) => role.name === ROLES.SUPERVISOR),
    [user]
  );
  const isDirector = useMemo(
    () => user?.Roles?.some((role) => role.name === ROLES.DIRECTOR),
    [user]
  );

  const getCurrentDateTime = () => {
    const now = new Date();
    return {
      date: now.toISOString().split("T")[0],
      time: `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
    };
  };

  const isWeekend = (date: string) => new Date(date).getDay() % 6 === 0;

  const isValidTime = (date: string, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    if (hours < 8 || hours > 17 || (hours === 17 && minutes > 0)) return false;
    const { date: currentDate, time: currentTime } = getCurrentDateTime();
    if (date === currentDate) {
      const [currentH, currentM] = currentTime.split(":").map(Number);
      return !(hours < currentH || (hours === currentH && minutes < currentM));
    }
    return true;
  };

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

      const regions = await getRegionsByGovernorate(agentData!.Delegation?.Governorate?.governorateID || "");
      setEditForm({
        date: visitData.date,
        time: visitData.time.slice(0, 5),
        regionID: regions?.[0]?.regionID || "",
        governorateID: agentData?.Delegation?.Governorate?.governorateID || "",
        delegationID: visitData.location || agentData?.delegationID || "",
        status: visitData.status,
        comment: visitData.comment || "",
        agentID: visitData.agentID,
        agentSearch: agentData ? `${agentData.name} ${agentData.lastname}` : "",
        agentPhone: "",
        regionSearch: "",
        governorateSearch: "",
        delegationSearch: "",
        reasonSearch: "",
        checklistSearch: "",
        regionalManagerSearch: "",
        supervisorSearch: "",
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
          regionID: regions?.[0]?.regionID || "",
          governorateID: agentData?.Delegation?.Governorate?.governorateID || "",
          delegationID: visitData.location || agentData?.delegationID || "",
          status: visitData.status,
          comment: visitData.comment || "",
          agentID: visitData.agentID,
          checklists:
            visitData.Checklists?.map((c) => ({
              id: c.checklistID,
              checked: c.VisitChecklist?.checked || false,
            })) || [],
          reasons: visitData.Reasons?.map((r) => ({ id: r.reasonID })) || [],
        },
      });
      setSelectedSupervisor("");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("visitDetails.error.fetchFailed");
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [idVisit, userPermissions, permissionsLoaded, navigate, user, t]);

  useEffect(() => {
    if (permissionsLoaded) fetchVisitData();
  }, [fetchVisitData, permissionsLoaded]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      setError(t("visitDetails.error.cameraAccess"));
      console.error("Camera access error:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
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
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `photo-${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            setNewPhotos((prev) => [...prev, file]);
            setFlashEffect(true);
            setTimeout(() => setFlashEffect(false), 300);
          } else {
            console.error("Failed to create blob from canvas.");
          }
        }, "image/jpeg");
      }
    }
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  };

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
          supervisorsData = await getUsersByDelegation(editForm.delegationSearch);
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

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !visit ||
      !userPermissions.canEditTimesheets ||
      !editForm.date ||
      !editForm.time ||
      !editForm.delegationID
    )
      return;

    let newStatus = editForm.status;
    let updatedDuration: number | undefined = visit.duration || undefined;

    if (visit.status === VisitStatus.VISITED && userPermissions.canLogVisits) {
      newStatus = VisitStatus.VISITED;
      if (editTracking.startTime) {
        const editDurationMinutes = Math.round(
          (Date.now() - editTracking.startTime) / 60000
        );
        updatedDuration =
          editTracking.durationAccumulator + editDurationMinutes;
      }
    } else if (
      userPermissions.canCreateTimesheetsForSupervisors &&
      selectedSupervisor
    ) {
      newStatus = VisitStatus.VALIDATED;
    } else if (
      [VisitStatus.VALIDATED, VisitStatus.REJECTED].includes(
        visit.status as VisitStatus
      )
    ) {
      newStatus = VisitStatus.PENDING;
    }

    try {
      const updatedVisit = await updateVisit(visit.visitID, {
        date: editForm.date,
        time: `${editForm.time}:00`,
        location: editForm.delegationID,
        status: newStatus,
        comment: editForm.comment,
        agentID: editForm.agentID,
        checklists: editForm.checklists,
        reasons: editForm.reasons,
        photos: newPhotos,
        photosToRemove: editForm.photosToRemove,
        supervisorID:
          selectedSupervisor &&
            userPermissions.canCreateTimesheetsForSupervisors
            ? selectedSupervisor
            : undefined,
        duration: updatedDuration,
      });

      setVisit(updatedVisit);
      setNewPhotos([]);
      stopCamera();
      setEditTracking({ startTime: null, durationAccumulator: 0 });
      navigate(`/visit/${idVisit}`);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : t("visitDetails.error.updateFailed");
      setError(errorMessage);
      console.error(err);
    }
  };

  const handleCancel = () => {
    setEditForm((prev) => ({
      ...prev,
      date: prev.original.date,
      time: prev.original.time,
      regionID: prev.original.regionID,
      governorateID: prev.original.governorateID,
      delegationID: prev.original.delegationID,
      status: prev.original.status,
      comment: prev.original.comment,
      agentID: prev.original.agentID,
      checklists: [...prev.original.checklists],
      reasons: [...prev.original.reasons],
      photosToRemove: [],
    }));
    setEditTracking({ startTime: null, durationAccumulator: 0 });
    navigate(`/visit/${idVisit}`);
  };

  const handleRemovePhoto = (photoUrl: string) => {
    setEditForm((prev) => ({
      ...prev,
      photosToRemove: [...prev.photosToRemove, photoUrl],
    }));
  };

  const handleChecklistChange = (id: string, checked: boolean) => {
    if (visit?.status !== "visited") return;
    setEditForm((prev) => ({
      ...prev,
      checklists: prev.checklists.map((c) =>
        c.id === id ? { ...c, checked } : c
      ),
    }));
  };

  const handleReasonSelect = (reason: Reason) => {
    if (!editForm.reasons.some((r) => r.id === reason.reasonID)) {
      setEditForm((prev) => ({
        ...prev,
        reasons: [...prev.reasons, { id: reason.reasonID }],
        reasonSearch: "",
      }));
    }
  };

  const handleChecklistSelect = (checklist: Checklist) => {
    if (!editForm.checklists.some((c) => c.id === checklist.checklistID)) {
      setEditForm((prev) => ({
        ...prev,
        checklists: [
          ...prev.checklists,
          { id: checklist.checklistID, checked: false },
        ],
        checklistSearch: "",
      }));
    }
  };

  const handleRemoveReason = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      reasons: prev.reasons.filter((_, i) => i !== index),
    }));
  };

  const handleRemoveChecklist = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      checklists: prev.checklists.filter((_, i) => i !== index),
    }));
  };

  const handleImageClick = (photo: string) =>
    setSelectedImage(`${BASE_URL}${photo}`);
  const handleCloseFullscreen = () => setSelectedImage(null);

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

  const formPhotosCount =
    t("visitDetails.form.photos.count", {
      count:
        (visit?.photos?.filter((p) => !editForm.photosToRemove.includes(p))
          .length || 0) + newPhotos.length,
    }) ||
    `(${(visit?.photos?.filter((p) => !editForm.photosToRemove.includes(p))
      .length || 0) + newPhotos.length
    } photos)`;

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

      <section className="visit-details-section">
        <form onSubmit={handleEditSubmit} className="visit-edit-form">
          {(isSuperAdmin || isDirector) &&
            !isRegionalManager &&
            !isSupervisor &&
            canEditField("supervisor") && (
              <div className="form-group">
                <label htmlFor="regionalManager">
                  {t("visitDetails.form.regionalManager")}
                </label>
                <input
                  type="text"
                  id="regional-manager-search"
                  placeholder={t(
                    "visitDetails.form.placeholders.regionalManagerSearch"
                  )}
                  value={editForm.regionalManagerSearch}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      regionalManagerSearch: e.target.value,
                    }))
                  }
                  className="search-input"
                  aria-label={t(
                    "visitDetails.form.placeholders.regionalManagerSearch"
                  )}
                  disabled={disableRegionalManagerInput}
                />
                <select
                  id="regionalManager"
                  value={selectedRegionalManager}
                  onChange={(e) => {
                    setSelectedRegionalManager(e.target.value);
                    setSelectedSupervisor("");
                    setEditForm((prev) => ({
                      ...prev,
                      regionID: "",
                      governorateID: "",
                      delegationID: "",
                      agentID: "",
                      agentSearch: "",
                    }));
                    setDisableLocationInputs(false);
                    setDisableSupervisorInput(false);
                    setDisableRegionalManagerInput(false);
                    setFetchMode("none");
                  }}
                  aria-label={t(
                    "visitDetails.form.placeholders.regionalManagerSelect"
                  )}
                  disabled={disableRegionalManagerInput}
                >
                  <option value="">
                    {t("visitDetails.form.placeholders.regionalManagerSelect")}
                  </option>
                  {regionalManagers
                    .filter((rm) =>
                      `${rm.firstname || ""} ${rm.lastname || ""} ${rm.phone || ""}`
                        .toLowerCase()
                        .includes(editForm.regionalManagerSearch.toLowerCase())
                    )
                    .map((rm) => (
                      <option key={rm.userID} value={rm.userID}>
                        {rm.firstname} {rm.lastname} ({rm.phone})
                      </option>
                    ))}
                </select>
              </div>
            )}
          {(isSuperAdmin || isDirector || isRegionalManager) &&
            !isSupervisor &&
            userPermissions.canCreateTimesheetsForSupervisors &&
            userPermissions.canReadSupervisors &&
            canEditField("supervisor") && (
              <div className="form-group">
                <label htmlFor="supervisor">{t("visitDetails.form.supervisor")}</label>
                <input
                  type="text"
                  id="supervisor-search"
                  placeholder={t("visitDetails.form.placeholders.supervisorSearch")}
                  value={editForm.supervisorSearch}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      supervisorSearch: e.target.value,
                    }))
                  }
                  className="search-input"
                  aria-label={t("visitDetails.form.placeholders.supervisorSearch")}
                  disabled={supervisorLoading || disableSupervisorInput}
                />
                <input
                  type="tel"
                  id="supervisor-phone"
                  placeholder={t("visitDetails.form.placeholders.supervisorPhone")}
                  value={supervisorPhone}
                  onChange={(e) => setSupervisorPhone(e.target.value)}
                  className="search-input"
                  aria-label={t("visitDetails.form.placeholders.supervisorPhone")}
                  disabled={supervisorLoading || disableSupervisorInput}
                />
                {supervisorLoading && (
                  <span className="loading-spinner" aria-hidden="true"></span>
                )}
                <select
                  id="supervisor"
                  value={selectedSupervisor}
                  onChange={(e) => {
                    setSelectedSupervisor(e.target.value);
                    setEditForm((prev) => ({
                      ...prev,
                      regionID: "",
                      governorateID: "",
                      delegationID: "",
                      agentID: "",
                      agentSearch: "",
                    }));
                    setDisableLocationInputs(false);
                    setDisableSupervisorInput(false);
                    setFetchMode("supervisor");
                  }}
                  required
                  aria-label={t("visitDetails.form.placeholders.supervisorSelect")}
                  disabled={supervisorLoading || disableSupervisorInput}
                >
                  <option value="">
                    {t("visitDetails.form.placeholders.supervisorSelect")}
                  </option>
                  {supervisors
                    .filter((s) =>
                      `${s.firstname || ""} ${s.lastname || ""} ${s.phone || ""}`
                        .toLowerCase()
                        .includes(editForm.supervisorSearch.toLowerCase())
                    )
                    .map((s) => (
                      <option key={s.userID} value={s.userID}>
                        {s.firstname} {s.lastname} ({s.phone})
                      </option>
                    ))}
                </select>
              </div>
            )}

          {canEditField("dateTime") && (
            <div className="form-group datetime-group">
              <label>{t("visitDetails.form.date.label")}</label>
              <input
                type="date"
                value={editForm.date}
                onChange={(e) =>
                  !isWeekend(e.target.value) &&
                  setEditForm((prev) => ({ ...prev, date: e.target.value }))
                }
                min={getCurrentDateTime().date}
                className="search-input"
                required
                aria-label={t("visitDetails.form.date.ariaLabel")}
              />
              <label>{t("visitDetails.form.time.label")}</label>
              <input
                type="time"
                value={editForm.time}
                onChange={(e) =>
                  isValidTime(editForm.date, e.target.value) &&
                  setEditForm((prev) => ({ ...prev, time: e.target.value }))
                }
                min={
                  editForm.date === getCurrentDateTime().date
                    ? getCurrentDateTime().time
                    : "08:00"
                }
                max="17:00"
                step="60"
                className="search-input"
                required
                aria-label={t("visitDetails.form.time.ariaLabel")}
              />
            </div>
          )}

          {canEditField("regionID") && (
            <div className="form-group">
              <label htmlFor="region">
                {t("visitDetails.form.region.label")}
              </label>
              <select
                id="region"
                value={editForm.regionID}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    regionID: e.target.value,
                  }))
                }
                required
                disabled={
                  !userPermissions.canReadAgentsByLocation ||
                  disableLocationInputs
                }
                aria-label={t("visitDetails.form.region.ariaLabel")}
              >
                <option value="">
                  {t("visitDetails.form.region.selectPlaceholder")}
                </option>
                {regions.map((reg) => (
                  <option key={reg.regionID} value={reg.regionID}>
                    {reg.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canEditField("governorateID") && (
            <div className="form-group">
              <label htmlFor="governorate">
                {t("visitDetails.form.governorate.label")}
              </label>
              <select
                id="governorate"
                value={editForm.governorateID}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    governorateID: e.target.value,
                  }))
                }
                required
                disabled={
                  !userPermissions.canReadAgentsByLocation ||
                  disableLocationInputs ||
                  !editForm.regionID
                }
                aria-label={t("visitDetails.form.governorate.ariaLabel")}
              >
                <option value="">
                  {t("visitDetails.form.governorate.selectPlaceholder")}
                </option>
                {governorates.map((gov) => (
                  <option key={gov.governorateID} value={gov.governorateID}>
                    {gov.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canEditField("delegationID") && (
            <div className="form-group">
              <label htmlFor="delegation">
                {t("visitDetails.form.delegation.label")}
              </label>
              <select
                id="delegation"
                value={editForm.delegationID}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    delegationID: e.target.value,
                  }))
                }
                required
                disabled={
                  !userPermissions.canReadAgentsByLocation ||
                  disableLocationInputs ||
                  !editForm.governorateID
                }
                aria-label={t("visitDetails.form.delegation.ariaLabel")}
              >
                <option value="">
                  {t("visitDetails.form.delegation.selectPlaceholder")}
                </option>
                {delegations.map((del) => (
                  <option key={del.delegationID} value={del.delegationID}>
                    {del.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {canEditField("agentID") && (
            <>
              <div className="form-group">
                <label htmlFor="agentPhone">
                  {t("visitDetails.form.agentPhone.label")}
                </label>
                <input
                  type="tel"
                  id="agentPhone"
                  placeholder={
                    userPermissions.canReadAgentsByPhone
                      ? t("visitDetails.form.agentPhone.placeholder")
                      : t("visitDetails.form.permissionDenied")
                  }
                  value={editForm.agentPhone}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      agentPhone: e.target.value,
                    }))
                  }
                  className="search-input"
                  disabled={!userPermissions.canReadAgentsByPhone}
                  aria-label={t("visitDetails.form.agentPhone.ariaLabel")}
                />
                {agentLoading && (
                  <span className="loading-spinner" aria-hidden="true"></span>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="agent">
                  {t("visitDetails.form.agent.label")}
                </label>
                <input
                  type="text"
                  placeholder={
                    userPermissions.canReadAgentsByLocation
                      ? t("visitDetails.form.agent.searchPlaceholder")
                      : t("visitDetails.form.permissionDenied")
                  }
                  value={editForm.agentSearch}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      agentSearch: e.target.value,
                    }))
                  }
                  className="search-input"
                  disabled={
                    !userPermissions.canReadAgentsByLocation ||
                    !!editForm.agentPhone ||
                    !editForm.delegationID
                  }
                  aria-label={t("visitDetails.form.agent.searchPlaceholder")}
                />
                {agentLoading && (
                  <span className="loading-spinner" aria-hidden="true"></span>
                )}
                <select
                  id="agent"
                  value={editForm.agentID}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      agentID: e.target.value,
                    }))
                  }
                  required
                  disabled={
                    !userPermissions.canReadAgentsByLocation ||
                    !!editForm.agentPhone ||
                    !editForm.delegationID ||
                    agentLoading
                  }
                  aria-label={t("visitDetails.form.agent.ariaLabel")}
                >
                  <option value="">
                    {t("visitDetails.form.agent.selectPlaceholder")}
                  </option>
                  {agents
                    .filter((a) =>
                      `${a.name || ""} ${a.lastname || ""} ${a.phone || ""}`
                        .toLowerCase()
                        .includes(editForm.agentSearch.toLowerCase())
                    )
                    .map((a) => (
                      <option key={a.agentID} value={a.agentID}>
                        {a.name} {a.lastname} ({a.phone})
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}

          {canEditField("reasons") && (
            <div className="form-group">
              <label>{t("visitDetails.form.reasons.label")}</label>
              <input
                type="text"
                placeholder={
                  userPermissions.canReadReasons
                    ? t("visitDetails.form.reasons.searchPlaceholder")
                    : t("visitDetails.form.permissionDenied")
                }
                value={editForm.reasonSearch}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    reasonSearch: e.target.value,
                  }))
                }
                className="search-input"
                disabled={!userPermissions.canReadReasons}
                aria-label={t("visitDetails.form.reasons.searchPlaceholder")}
              />
              <select
                value=""
                onChange={(e) => {
                  const reason = reasons.find(
                    (r) => r.reasonID === e.target.value
                  );
                  if (reason) handleReasonSelect(reason);
                }}
                disabled={!userPermissions.canReadReasons}
                aria-label={t("visitDetails.form.reasons.ariaLabel")}
              >
                <option value="">
                  {t("visitDetails.form.reasons.selectPlaceholder")}
                </option>
                {reasons
                  .filter((r) =>
                    r.item
                      .toLowerCase()
                      .includes(editForm.reasonSearch.toLowerCase())
                  )
                  .map((r) => (
                    <option key={r.reasonID} value={r.reasonID}>
                      {r.item}
                    </option>
                  ))}
              </select>
              <div className="selected-items">
                {editForm.reasons.map((r, index) => {
                  const reasonItem =
                    reasons.find((re) => re.reasonID === r.id)?.item || r.id;
                  return (
                    <span
                      key={index}
                      className="selected-item"
                      onClick={() => handleRemoveReason(index)}
                      aria-label={
                        t("visitDetails.aria.removeReason", {
                          item: reasonItem,
                        }) || `Remove reason ${reasonItem}`
                      }
                    >
                      {reasonItem} ×
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {canEditField("checklists") && (
            <div className="form-group">
              <label>{t("visitDetails.form.checklists.label")}</label>
              <input
                type="text"
                placeholder={
                  userPermissions.canReadChecklists
                    ? t("visitDetails.form.checklists.searchPlaceholder")
                    : t("visitDetails.form.permissionDenied")
                }
                value={editForm.checklistSearch}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    checklistSearch: e.target.value,
                  }))
                }
                className="search-input"
                disabled={!userPermissions.canReadChecklists}
                aria-label={t("visitDetails.form.checklists.searchPlaceholder")}
              />
              <select
                value=""
                onChange={(e) => {
                  const checklist = checklists.find(
                    (c) => c.checklistID === e.target.value
                  );
                  if (checklist) handleChecklistSelect(checklist);
                }}
                disabled={!userPermissions.canReadChecklists}
                aria-label={t("visitDetails.form.checklists.ariaLabel")}
              >
                <option value="">
                  {t("visitDetails.form.checklists.selectPlaceholder")}
                </option>
                {checklists
                  .filter((c) =>
                    c.item
                      .toLowerCase()
                      .includes(editForm.checklistSearch.toLowerCase())
                  )
                  .map((c) => (
                    <option key={c.checklistID} value={c.checklistID}>
                      {c.item}
                    </option>
                  ))}
              </select>
              <div className="selected-items">
                {editForm.checklists.map((c, index) => {
                  const checklistItem =
                    checklists.find((cl) => cl.checklistID === c.id)?.item ||
                    c.id;
                  return (
                    <div key={index} className="checklist-item">
                      <input
                        type="checkbox"
                        checked={c.checked}
                        onChange={(e) =>
                          handleChecklistChange(c.id, e.target.checked)
                        }
                        disabled={visit.status !== "visited"}
                        aria-label={
                          t("visitDetails.aria.checklistItem", {
                            item: checklistItem,
                          }) || `Toggle checklist ${checklistItem}`
                        }
                      />
                      <span>{checklistItem}</span>
                      <span
                        className="remove-item"
                        onClick={() => handleRemoveChecklist(index)}
                        aria-label={
                          t("visitDetails.aria.removeChecklist", {
                            item: checklistItem,
                          }) || `Remove checklist ${checklistItem}`
                        }
                      >
                        ×
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {canEditField("photos") &&
            (visit.photos?.length || newPhotos.length) ? (
            <div className="form-group photos-section">
              <h2>
                <FaCamera /> {t("visitDetails.form.photos.title")}{" "}
                {formPhotosCount}
              </h2>
              {visit.status === VisitStatus.VISITED && (
                <div className="camera-controls">
                  <button
                    type="button"
                    className="camera-btn"
                    onClick={startCamera}
                    disabled={isCameraActive}
                    aria-label={t("visitDetails.aria.startCamera")}
                  >
                    <FaCamera /> {t("visitDetails.form.photos.startCamera")}
                  </button>
                  <div
                    className={`camera-container ${isCameraActive ? "active" : ""}`}
                  >
                    <div className="camera-frame">
                      <video
                        ref={videoRef}
                        className="camera-preview"
                        muted
                        playsInline
                      />
                      <div
                        className={`flash-overlay ${flashEffect ? "active" : ""}`}
                      ></div>
                      <div className="photo-counter">
                        <FaCamera /> {newPhotos.length}
                      </div>
                      {newPhotos.length > 0 && (
                        <div className="thumbnail-preview">
                          <img
                            src={URL.createObjectURL(
                              newPhotos[newPhotos.length - 1]
                            )}
                            alt={t(
                              "visitDetails.form.photos.lastCapturedAlt"
                            )}
                          />
                        </div>
                      )}
                    </div>
                    {isCameraActive && (
                      <>
                        <button
                          type="button"
                          className="stop-camera-btn"
                          onClick={stopCamera}
                          aria-label={t("visitDetails.aria.stopCamera")}
                        >
                          <FaTimes /> {t("visitDetails.actions.stopCamera")}
                        </button>
                        <button
                          type="button"
                          className="capture-btn"
                          onClick={capturePhoto}
                          aria-label={t("visitDetails.aria.capturePhoto")}
                        >
                          <FaCamera />{" "}
                          {t("visitDetails.actions.capturePhoto")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
              {(visit.photos?.length || newPhotos.length) && (
                <div className="photo-previews">
                  {visit
                    .photos!.filter(
                      (p) => !editForm.photosToRemove.includes(p)
                    )
                    .map((photo, index) => (
                      <div
                        key={`existing-${index}`}
                        className="photo-container"
                      >
                        <img
                          src={`${BASE_URL}${photo}`}
                          alt={
                            t("visitDetails.form.photos.existingAlt", {
                              index: index + 1,
                            }) || `Existing photo ${index + 1}`
                          }
                          className="photo-preview"
                          onClick={() => handleImageClick(photo)}
                        />
                        <button
                          type="button"
                          className="remove-photo-btn"
                          onClick={() => handleRemovePhoto(photo)}
                          aria-label={
                            t("visitDetails.aria.removePhoto", {
                              index: index + 1,
                            }) || `Remove photo ${index + 1}`
                          }
                        >
                          <FaTimes /> {t("visitDetails.actions.removePhoto")}
                        </button>
                      </div>
                    ))}
                  {newPhotos.map((photo, index) => (
                    <div key={`new-${index}`} className="photo-container">
                      <img
                        src={URL.createObjectURL(photo)}
                        alt={
                          t("visitDetails.form.photos.newAlt", {
                            index: index + 1,
                          }) || `New photo ${index + 1}`
                        }
                        className="photo-preview"
                        onClick={() =>
                          setSelectedImage(URL.createObjectURL(photo))
                        }
                      />
                      <button
                        type="button"
                        className="remove-photo-btn"
                        onClick={() => removeNewPhoto(index)}
                        aria-label={
                          t("visitDetails.aria.removePhoto", {
                            index: index + 1,
                          }) || `Remove photo ${index + 1}`
                        }
                      >
                        <FaTimes /> {t("visitDetails.actions.removePhoto")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {canEditField("comment") && (
            <div className="form-group">
              <label>{t("visitDetails.form.comment.label")}</label>
              <textarea
                value={editForm.comment}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    comment: e.target.value,
                  }))
                }
                placeholder={t("visitDetails.form.comment.placeholder")}
                aria-label={t("visitDetails.form.comment.ariaLabel")}
              />
            </div>
          )}

          <div className="form-actions">
            <Button
              type="submit"
              className="visit-details-submit-btn"
              aria-label={t("visitDetails.form.actions.save")}
            >
              {t("visitDetails.form.actions.save")}
            </Button>
            <Button
              type="button"
              className="visit-details-cancel-btn"
              onClick={handleCancel}
              aria-label={t("visitDetails.form.actions.cancel")}
            >
              {t("visitDetails.form.actions.cancel")}
            </Button>
          </div>
        </form>

        {selectedImage && (
          <div
            className="fullscreen-image-overlay"
            onClick={handleCloseFullscreen}
          >
            <img
              src={selectedImage}
              alt={t("visitDetails.fullscreenAlt")}
              className="fullscreen-image"
            />
            <button
              className="fullscreen-close-btn"
              onClick={handleCloseFullscreen}
              aria-label={t("visitDetails.aria.closeFullscreen")}
            >
              <FaTimes />
            </button>
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </section>
    </div>
  );
};

export default VisitDetailsEdit;