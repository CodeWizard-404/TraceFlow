/**
 * ProfilePage.tsx
 * Component for managing user profile, settings, activity, and notifications.
 * Optimized with memoization, debouncing, lazy-loading, and efficient state management.
 * Includes skeleton loader and fade-in animation for performance and UX.
 * Uses existing ProfilePage.css for styling.
 * Hardened to handle persistent backend PFP serialization issues.
 * Updated to include sorting by Type in notification preferences.
 * Fixed PFP update issue by correctly handling FormData in updateProfile calls and aligning types.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { debounce } from "lodash";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { updateProfile, fetchUserProfile, UpdateProfileInput } from "../../apis/userAPI";
import {
  getNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationTypes,
} from "../../apis/notificationAPI";
import User from "../../models/User";
import Notification from "../../models/Notification";
import NotificationPreference from "../../models/NotificationPreference";
import { initSocket, joinRoom, onNotification, offNotification } from "../../lib/socket";
import "./ProfilePage.css";
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaCamera,
  FaCog,
  FaHistory,
  FaCreditCard,
  FaClock,
  FaCheckCircle,
  FaRegUser,
  FaBell,
  FaSync,
  FaSearch,
  FaTimes,
  FaFilter,
  FaSort,
  FaTrash,
} from "react-icons/fa";

// Skeleton component
const ProfilePageSkeleton: React.FC = () => (
  <div className="profile-page">
    <header className="profile-header">
      <div className="profile-pic-container">
        <div className="custom-skeleton pulsing" style={{ width: '120px', height: '120px', borderRadius: '50%' }} />
      </div>
      <div className="header-info">
        <div className="custom-skeleton pulsing" style={{ width: '200px', height: '24px', marginBottom: '8px' }} />
        <div className="custom-skeleton pulsing" style={{ width: '100px', height: '16px' }} />
      </div>
    </header>
    <nav className="profile-nav">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="custom-skeleton pulsing" style={{ width: '120px', height: '40px', marginRight: '8px' }} />
      ))}
    </nav>
    <main className="profile-content">
      <div className="custom-skeleton pulsing" style={{ width: '150px', height: '24px', marginBottom: '16px' }} />
      <div className="info-grid">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="info-item">
            <div className="custom-skeleton pulsing" style={{ width: '24px', height: '24px', marginRight: '8px' }} />
            <div className="custom-skeleton pulsing" style={{ width: '100px', height: '16px', marginBottom: '8px' }} />
            <div className="custom-skeleton pulsing" style={{ width: '150px', height: '16px' }} />
          </div>
        ))}
      </div>
    </main>
  </div>
);

// Utility to detect image MIME type and validate base64
const detectImageMimeType = (base64: string): string | null => {
  try {
    if (base64.length < 100) {
      console.warn("Base64 string too short to be a valid image:", base64.length);
      return null;
    }
    if (base64 === "W29iamVjdCBPYmplY3Rd" || base64.includes("[object Object]")) {
      console.warn("Invalid PFP data: [object Object] detected");
      return null;
    }
    const prefix = base64.substring(0, 20);
    if (prefix.includes("/9j/")) return "image/jpeg";
    if (prefix.includes("iVBORw0KGgo")) return "image/png";
    return "image/jpeg";
  } catch {
    console.warn("Failed to detect MIME type for base64 string");
    return null;
  }
};

// Validate base64 string
const isValidBase64 = (str: string): boolean => {
  try {
    if (str === "[object Object]" || str === "W29iamVjdCBPYmplY3Rd") {
      console.warn("Invalid base64: [object Object] detected");
      return false;
    }
    const decoded = atob(str);
    if (decoded === "[object Object]") {
      console.warn("Decoded base64 is [object Object]");
      return false;
    }
    return btoa(decoded) === str;
  } catch {
    return false;
  }
};

const ProfilePage: React.FC = React.memo(() => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<User | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "settings" | "activity" | "notifications">("info");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [failedUploadCount, setFailedUploadCount] = useState(0);
  const [isUploadDisabled, setIsUploadDisabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showProfilePicPopup, setShowProfilePicPopup] = useState(false);

  // Notification-specific states
  const [notificationView, setNotificationView] = useState<"list" | "preferences">("list");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreference['preferences']>({});
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [notificationTypes, setNotificationTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showRead, setShowRead] = useState(false);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterEvents, setFilterEvents] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<"createdAt" | "type" | "message">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  // Preferences filtering and sorting
  const [prefFilterType, setPrefFilterType] = useState<string>("");
  const [prefSortBy, setPrefSortBy] = useState<"none" | "event" | "type">("none");
  const [prefSortOrder, setPrefSortOrder] = useState<"asc" | "desc">("asc");
  // Filter panel toggles
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [showEventFilter, setShowEventFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [showPrefTypeFilter, setShowPrefTypeFilter] = useState(false);
  const [showPrefSortPanel, setShowPrefSortPanel] = useState(false);

  // Compute unique event actions
  const availableEventActions = useMemo(() => {
    const actions = new Set<string>();
    availableEvents.forEach((event) => {
      const action = event.split(':')[1];
      if (action) actions.add(action);
    });
    return Array.from(actions).map((action) => ({
      value: action,
      label: action.charAt(0).toUpperCase() + action.slice(1),
    }));
  }, [availableEvents]);

  // Temporary error/success messages
  const setTempError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(""), 5000);
  }, []);

  const setTempSuccess = useCallback((message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 5000);
  }, []);

  // Validation functions
  const validateName = useCallback((value: string, field: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return `${field} is required`;
    if (trimmed.length < 3) return `${field} must be at least 3 characters`;
    if (trimmed.length > 20) return `${field} must be 20 characters or less`;
    if (!/^[a-zA-Z\s'-]+$/.test(trimmed))
      return `${field} can only contain letters, spaces, hyphens, or apostrophes`;
    return "";
  }, []);

  const validateEmail = useCallback((value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "Email is required";
    if (trimmed.length > 70) return "Email must be 70 characters or less";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
      return "Invalid email format";
    return "";
  }, []);

  const validatePhone = useCallback((value: string): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return "Phone is required";
    if (digits.length !== 8) return "Phone must be 8 digits";
    return "";
  }, []);

  const validatePassword = useCallback((value: string): string => {
    if (value && value.length < 8)
      return "Password must be at least 8 characters";
    if (value.length > 128) return "Password must be 128 characters or less";
    if (
      value &&
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$/.test(value)
    ) {
      return "Password must include uppercase, lowercase, digit, and special character, no spaces";
    }
    return "";
  }, []);

  const validatePasswordConfirm = useCallback(
    (password: string, confirm: string): string => {
      if (password && !confirm) return "Password confirmation is required";
      if (password && confirm && password !== confirm)
        return "Passwords do not match";
      return "";
    },
    []
  );

  // Formatting functions
  const formatPhoneDisplay = useCallback((rawValue: string): string => {
    const digits = rawValue.replace(/[^\d]/g, "");
    let formatted = "";
    if (digits.length > 0) formatted += digits.slice(0, 2);
    if (digits.length > 2) formatted += " " + digits.slice(2, 5);
    if (digits.length > 5) formatted += " " + digits.slice(5, 8);
    return formatted;
  }, []);

  const stripPhoneForDatabase = useCallback((raw: string): string => {
    return raw.replace(/[^\d]/g, "");
  }, []);

  // Memoized formatted values
  const formattedPhone = useMemo(
    () => (profileData?.phone ? formatPhoneDisplay(profileData.phone) : ""),
    [profileData?.phone, formatPhoneDisplay]
  );

  // Load last valid PFP from localStorage
  const loadLastValidPFP = useCallback(() => {
    const storedPFP = localStorage.getItem("lastValidPFP");
    if (storedPFP && isValidBase64(storedPFP)) {
      const mimeType = detectImageMimeType(storedPFP);
      if (mimeType) {
        return `data:${mimeType};base64,${storedPFP}`;
      }
    }
    return null;
  }, []);

  // Save valid PFP to localStorage
  const saveValidPFP = useCallback((pfp: string) => {
    if (isValidBase64(pfp) && detectImageMimeType(pfp)) {
      localStorage.setItem("lastValidPFP", pfp);
    }
  }, []);

  // Retry fetching profile picture
  const fetchProfileWithRetry = useCallback(
    async (retries = 2, delay = 1000): Promise<User> => {
      try {
        const user = await fetchUserProfile();
        if (user.PFP && (user.PFP === "[object Object]" || user.PFP === "W29iamVjdCBPYmplY3Rd")) {
          console.warn("Invalid PFP data in response, setting to null");
          user.PFP = null;
        }
        if (user.PFP) {
          saveValidPFP(user.PFP);
        }
        return user;
      } catch (err) {
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return fetchProfileWithRetry(retries - 1, delay * 2);
        }
        throw err;
      }
    },
    [saveValidPFP]
  );

  // Fetch user profile, notifications, and preferences
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) {
        setTempError("User not authenticated");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [fullUser, notificationData, types] = await Promise.all([
          fetchProfileWithRetry(),
          getNotificationPreferences(),
          getNotificationTypes(),
        ]);
        const completeUser: User = {
          userID: fullUser.userID || user.userID || "",
          keycloakId: user.keycloakId || "",
          firstname: fullUser.firstname || user.firstname || "",
          lastname: fullUser.lastname || user.lastname || "",
          phone: fullUser.phone || user.phone || "",
          email: fullUser.email || user.email || "",
          PFP: fullUser.PFP || user.PFP || null,
          password: "",
          googleEmail: fullUser.googleEmail || user.googleEmail,
          tempResetToken: fullUser.tempResetToken,
          regionalManagerID: fullUser.regionalManagerID,
          directorID: fullUser.directorID,
          Roles: fullUser.Roles || user.Roles,
          supervisors: fullUser.supervisors || user.supervisors,
          managers: fullUser.managers || user.managers,
          Regions: fullUser.Regions || user.Regions,
          Governorates: fullUser.Governorates || user.Governorates,
          Delegations: fullUser.Delegations || user.Delegations,
        };

        setProfileData(completeUser);
        setNotificationPrefs(notificationData.preferences);
        setAvailableEvents(notificationData.availableEvents);
        setNotificationTypes(types);

        if (completeUser.PFP && completeUser.PFP.trim()) {
          if (!isValidBase64(completeUser.PFP)) {
            console.warn("Skipping invalid PFP data");
            setProfilePic(loadLastValidPFP());
            setTempError("Profile picture data is corrupted. Please upload a new picture.");
            return;
          }

          const mimeType = detectImageMimeType(completeUser.PFP);
          if (!mimeType) {
            console.warn("Invalid image format for PFP");
            setProfilePic(loadLastValidPFP());
            setTempError("Profile picture is invalid. Please upload a new picture.");
            return;
          }

          const imageSrc = `data:${mimeType};base64,${completeUser.PFP}`;
          const img = new Image();
          img.src = imageSrc;
          img.onload = () => {
            setProfilePic(imageSrc);
            saveValidPFP(completeUser.PFP!);
          };
          img.onerror = (error) => {
            console.error("Profile picture load error:", {
              error,
              imageSrcLength: imageSrc.length,
              mimeType,
              pfpLength: completeUser.PFP!.length,
              pfpPreview: completeUser.PFP!.substring(0, 50),
            });
            setProfilePic(loadLastValidPFP());
            setTempError("Unable to load profile picture. Please upload a new picture.");
          };
        } else {
          setProfilePic(loadLastValidPFP());
        }

        localStorage.setItem("user", JSON.stringify(completeUser));
      } catch (err) {
        console.error("Failed to load user data:", err);
        setTempError(
          err instanceof Error ? err.message : "Failed to load user data"
        );
        if (user) {
          const fallbackUser: User = {
            userID: user.userID || "",
            keycloakId: user.keycloakId || "",
            firstname: user.firstname || "Not set",
            lastname: user.lastname || "Not set",
            phone: user.phone || "",
            email: user.email || "",
            PFP: null,
            password: "",
            googleEmail: user.googleEmail,
            tempResetToken: undefined,
            regionalManagerID: user.regionalManagerID,
            directorID: user.directorID,
            Roles: user.Roles,
            supervisors: user.supervisors,
            managers: user.managers,
            Regions: user.Regions,
            Governorates: user.Governorates,
            Delegations: user.Delegations,
          };
          setProfileData(fallbackUser);
          setProfilePic(loadLastValidPFP());
          localStorage.setItem("user", JSON.stringify(fallbackUser));
        }
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [user, setTempError, fetchProfileWithRetry, loadLastValidPFP, saveValidPFP]);

  // Fetch notifications when notifications tab is active
  useEffect(() => {
    if (activeTab !== "notifications" || notificationView !== "list") return;

    const fetchNotifications = async () => {
      setIsLoadingNotifications(true);
      try {
        const fetchedNotifications = await getNotifications();
        setNotifications(fetchedNotifications);
        setNotificationError(null);
      } catch (err) {
        setNotificationError("Failed to load notifications");
        console.error("Failed to fetch notifications:", err);
      } finally {
        setIsLoadingNotifications(false);
      }
    };

    fetchNotifications();
  }, [activeTab, notificationView]);

  // WebSocket for profile updates and notifications
  useEffect(() => {
    if (!user?.userID || !document.cookie.includes("accessToken")) {
      return;
    }

    initSocket();
    joinRoom(user.userID);

    const handleNotification = (event: string) => {
      if (event === "user:profile_updated" || event === "otp:generated:user") {
        if (event === "user:profile_updated") {
          fetchProfileWithRetry()
            .then((updatedUser) => {
              const completeUser: User = {
                userID: updatedUser.userID || user.userID || "",
                keycloakId: user.keycloakId || "",
                firstname: updatedUser.firstname || user.firstname || "",
                lastname: updatedUser.lastname || user.lastname || "",
                phone: updatedUser.phone || user.phone || "",
                email: updatedUser.email || user.email || "",
                PFP: updatedUser.PFP || user.PFP || null,
                password: "",
                googleEmail: updatedUser.googleEmail || user.googleEmail,
                tempResetToken: updatedUser.tempResetToken,
                regionalManagerID: updatedUser.regionalManagerID,
                directorID: updatedUser.directorID,
                Roles: updatedUser.Roles || user.Roles,
                supervisors: updatedUser.supervisors || user.supervisors,
                managers: updatedUser.managers || user.managers,
                Regions: updatedUser.Regions || user.Regions,
                Governorates: updatedUser.Governorates || user.Governorates,
                Delegations: updatedUser.Delegations || user.Delegations,
              };
              setProfileData(completeUser);
              if (completeUser.PFP && completeUser.PFP.trim()) {
                if (!isValidBase64(completeUser.PFP)) {
                  console.warn("Skipping invalid updated PFP data");
                  setProfilePic(loadLastValidPFP());
                  setTempError("Updated profile picture is corrupted. Please upload a new picture.");
                  return;
                }

                const mimeType = detectImageMimeType(completeUser.PFP);
                if (!mimeType) {
                  console.warn("Invalid image format for updated PFP");
                  setProfilePic(loadLastValidPFP());
                  setTempError("Updated profile picture is invalid. Please upload a new picture.");
                  return;
                }

                const imageSrc = `data:${mimeType};base64,${completeUser.PFP}`;
                const img = new Image();
                img.src = imageSrc;
                img.onload = () => {
                  setProfilePic(imageSrc);
                  saveValidPFP(completeUser.PFP!);
                };
                img.onerror = (error) => {
                  console.error("Updated profile picture load error:", {
                    error,
                    imageSrcLength: imageSrc.length,
                    mimeType,
                    pfpLength: completeUser.PFP!.length,
                    pfpPreview: completeUser.PFP!.substring(0, 50),
                  });
                  setProfilePic(loadLastValidPFP());
                  setTempError("Unable to load updated profile picture. Please upload a new picture.");
                };
              } else {
                setProfilePic(loadLastValidPFP());
              }
              localStorage.setItem("user", JSON.stringify(completeUser));
            })
            .catch((err) => {
              console.error("Failed to refresh profile:", err);
              setProfilePic(loadLastValidPFP());
            });
        }
      }
    };

    onNotification(handleNotification);

    return () => {
      offNotification();
    };
  }, [user, setTempError, fetchProfileWithRetry, loadLastValidPFP, saveValidPFP]);

  // Input handlers
  const handleDoubleClick = useCallback((field: string) => {
    setEditingField(field);
    setError("");
    setSuccess("");
    setFormErrors({});
  }, []);

  const debouncedHandlePhoneChange = useMemo(
    () =>
      debounce((value: string) => {
        const raw = value.replace(/[^\d]/g, "").slice(0, 8);
        setProfileData((prev) =>
          prev ? { ...prev, phone: stripPhoneForDatabase(raw) } : prev
        );
        setFormErrors((prev) => ({ ...prev, phone: validatePhone(raw) }));
      }, 300),
    [validatePhone, stripPhoneForDatabase]
  );

  const handlePhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      debouncedHandlePhoneChange(e.target.value);
    },
    [debouncedHandlePhoneChange]
  );

  const debouncedHandleInputChange = useMemo(
    () =>
      debounce((field: keyof User, value: string) => {
        setProfileData((prev) =>
          prev ? { ...prev, [field]: value } : prev
        );
        let error = "";
        switch (field) {
          case "firstname":
          case "lastname":
            error = validateName(
              value,
              field.charAt(0).toUpperCase() + field.slice(1)
            );
            break;
          case "email":
            error = validateEmail(value);
            break;
          case "phone":
            error = validatePhone(value);
            break;
        }
        setFormErrors((prev) => ({ ...prev, [field]: error }));
      }, 300),
    [validateName, validateEmail, validatePhone]
  );

  const handleInputChange = useCallback(
    (field: keyof User, value: string) => {
      debouncedHandleInputChange(field, value);
    },
    [debouncedHandleInputChange]
  );

  const handleNewPasswordChange = useCallback(
    (value: string) => {
      setNewPassword(value);
      const passwordError = validatePassword(value);
      setFormErrors((prev) => ({
        ...prev,
        newPassword: passwordError,
        confirmPassword: validatePasswordConfirm(value, confirmPassword),
      }));
    },
    [validatePassword, validatePasswordConfirm, confirmPassword]
  );

  const handleConfirmPasswordChange = useCallback(
    (value: string) => {
      setConfirmPassword(value);
      setFormErrors((prev) => ({
        ...prev,
        confirmPassword: validatePasswordConfirm(newPassword, value),
      }));
    },
    [validatePasswordConfirm, newPassword]
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>, field: keyof User) => {
      if (e.key === "Enter" && profileData) {
        const error = formErrors[field];
        if (error) {
          setTempError(error);
          return;
        }
        try {
          // Explicitly type the updatedData to satisfy Partial<User> & UpdateProfileInput
          const updatedData: Partial<User> & UpdateProfileInput = { [field]: profileData[field] };
          const response = await updateProfile(updatedData);
          const updatedUser: User = {
            ...profileData,
            ...response,
            PFP: response.PFP || profileData.PFP,
          };
          setProfileData(updatedUser);
          setTempSuccess("Profile updated successfully");
          setEditingField(null);
          localStorage.setItem("user", JSON.stringify(updatedUser));
        } catch (err) {
          console.error("Profile update error:", err);
          setTempError(
            err instanceof Error ? err.message : "Failed to update profile"
          );
          setProfileData(user || profileData);
        }
      } else if (e.key === "Escape") {
        setProfileData(user || profileData);
        setEditingField(null);
        setFormErrors({});
      }
    },
    [profileData, formErrors, user, setTempError, setTempSuccess]
  );

  const handleProfilePicChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isUploadDisabled) {
        setTempError("Profile picture upload is temporarily disabled due to repeated failures. Please contact support.");
        return;
      }

      if (!e.target.files || e.target.files.length === 0) {
        setTempError("No file selected");
        return;
      }
      const file = e.target.files[0];
      const allowedTypes = ["image/jpeg", "image/png"];
      if (!allowedTypes.includes(file.type)) {
        setTempError("Only JPEG or PNG images are allowed");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setTempError("Image size must be less than 5MB");
        return;
      }

      try {
        // Explicitly type the update data to satisfy Partial<User> & UpdateProfileInput
        const updateData: Partial<User> & UpdateProfileInput = { PFP: file } as Partial<User> & UpdateProfileInput;
        const response = await updateProfile(updateData);

        if (response.PFP && response.PFP.trim()) {
          if (!isValidBase64(response.PFP)) {
            console.warn("Invalid new PFP data");
            setFailedUploadCount((prev) => prev + 1);
            if (failedUploadCount + 1 >= 3) {
              setIsUploadDisabled(true);
              setTempError(
                "Unable to upload profile picture due to server issues. Please contact support."
              );
            } else {
              setTempError(
                "Uploaded profile picture is corrupted. Please try again."
              );
            }
            setProfilePic(loadLastValidPFP());
            return;
          }

          const mimeType = detectImageMimeType(response.PFP);
          if (!mimeType) {
            console.warn("Invalid image format for new PFP");
            setFailedUploadCount((prev) => prev + 1);
            if (failedUploadCount + 1 >= 3) {
              setIsUploadDisabled(true);
              setTempError(
                "Unable to upload profile picture due to server issues. Please contact support."
              );
            } else {
              setTempError(
                "Uploaded profile picture is invalid. Please try again."
              );
            }
            setProfilePic(loadLastValidPFP());
            return;
          }

          const imageSrc = `data:${mimeType};base64,${response.PFP}`;
          const img = new Image();
          img.src = imageSrc;
          img.onload = () => {
            setProfilePic(imageSrc);
            setTempSuccess("Profile picture updated successfully");
            setFailedUploadCount(0);
            setIsUploadDisabled(false);
            saveValidPFP(response.PFP!);
            const updatedUser: User = {
              ...profileData!,
              ...response,
              PFP: response.PFP,
            };
            setProfileData(updatedUser);
            localStorage.setItem("user", JSON.stringify(updatedUser));
            setShowProfilePicPopup(false);
          };
          img.onerror = (error) => {
            console.error("New profile picture load error:", {
              error,
              imageSrcLength: imageSrc.length,
              mimeType,
              pfpLength: response.PFP!.length,
              pfpPreview: response.PFP!.substring(0, 50),
            });
            setFailedUploadCount((prev) => prev + 1);
            if (failedUploadCount + 1 >= 3) {
              setIsUploadDisabled(true);
              setTempError(
                "Unable to upload profile picture due to server issues. Please contact support."
              );
            } else {
              setTempError(
                "Unable to load new profile picture. Please try again."
              );
            }
            setProfilePic(loadLastValidPFP());
          };
        } else {
          console.warn("No PFP data returned after update");
          setProfilePic(null);
          setTempSuccess("Profile picture removed");
          setFailedUploadCount(0);
          setIsUploadDisabled(false);
          localStorage.removeItem("lastValidPFP");
          const updatedUser: User = {
            ...profileData!,
            ...response,
            PFP: null,
          };
          setProfileData(updatedUser);
          localStorage.setItem("user", JSON.stringify(updatedUser));
          setShowProfilePicPopup(false);
        }
      } catch (err) {
        console.error("Profile pic update error:", err);
        setFailedUploadCount((prev) => prev + 1);
        if (failedUploadCount + 1 >= 3) {
          setIsUploadDisabled(true);
          setTempError(
            "Unable to upload profile picture due to server issues. Please contact support."
          );
        } else {
          setTempError(
            err instanceof Error ? err.message : "Failed to update profile picture"
          );
        }
        setProfilePic(loadLastValidPFP());
      }
    },
    [
      profileData,
      setTempSuccess,
      setTempError,
      loadLastValidPFP,
      saveValidPFP,
      failedUploadCount,
      isUploadDisabled,
    ]
  );

  const handleRemoveProfilePic = useCallback(async () => {
    if (isUploadDisabled) {
      setTempError("Profile picture actions are temporarily disabled due to repeated failures. Please contact support.");
      return;
    }

    try {
      // Explicitly type the update data to satisfy Partial<User> & UpdateProfileInput
      const updateData: Partial<User> & UpdateProfileInput = { removePFP: true };
      const response = await updateProfile(updateData);
      setProfilePic(null);
      setTempSuccess("Profile picture removed successfully");
      setFailedUploadCount(0);
      setIsUploadDisabled(false);
      localStorage.removeItem("lastValidPFP");
      const updatedUser: User = {
        ...profileData!,
        ...response,
        PFP: null,
      };
      setProfileData(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setShowProfilePicPopup(false);
    } catch (err) {
      console.error("Profile pic removal error:", err);
      setTempError(
        err instanceof Error ? err.message : "Failed to remove profile picture"
      );
      setProfilePic(loadLastValidPFP());
    }
  }, [profileData, setTempSuccess, setTempError, loadLastValidPFP, isUploadDisabled]);

  const handlePasswordChange = useCallback(async () => {
    if (!newPassword || !confirmPassword) return;
    const passwordError = formErrors.newPassword;
    const confirmError = formErrors.confirmPassword;
    if (passwordError || confirmError) {
      setTempError(passwordError || confirmError);
      return;
    }
    try {
      // Explicitly type the update data to satisfy Partial<User> & UpdateProfileInput
      const updateData: Partial<User> & UpdateProfileInput = { password: newPassword };
      const response = await updateProfile(updateData);
      const updatedUser: User = { ...profileData!, ...response };
      setProfileData(updatedUser);
      setTempSuccess("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
      setFormErrors((prev) => ({
        ...prev,
        newPassword: "",
        confirmPassword: "",
      }));
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (err) {
      console.error("Password update error:", err);
      setTempError(
        err instanceof Error ? err.message : "Failed to update password"
      );
    }
  }, [
    newPassword,
    confirmPassword,
    formErrors,
    profileData,
    setTempSuccess,
    setTempError,
  ]);

  const handleTabChange = useCallback(
    (tab: "info" | "settings" | "activity" | "notifications") => {
      setActiveTab(tab);
    },
    []
  );

  // Notification handlers
  const handleRefreshNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);
    try {
      const fetchedNotifications = await getNotifications();
      setNotifications(fetchedNotifications);
      setNotificationError(null);
    } catch (err) {
      setNotificationError("Failed to refresh notifications");
      console.error("Failed to refresh notifications:", err);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  const handleMarkAsRead = useCallback(async (notificationID: string) => {
    try {
      const updatedNotification = await markNotificationAsRead(notificationID);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationID === notificationID ? updatedNotification : n
        )
      );
    } catch (err) {
      setNotificationError("Failed to mark notification as read");
      console.error("Failed to mark notification as read:", err);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: "read" }))
      );
      setTempSuccess("All notifications marked as read");
    } catch (err) {
      setNotificationError("Failed to mark all notifications as read");
      console.error("Failed to mark all notifications as read:", err);
    }
  }, [setTempSuccess]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setShowRead(false);
    setFilterTypes([]);
    setFilterEvents([]);
    setFilterStatuses([]);
    setStartDate("");
    setEndDate("");
    setSortBy("createdAt");
    setSortOrder("desc");
    setShowTypeFilter(false);
    setShowEventFilter(false);
    setShowStatusFilter(false);
    setShowDateFilter(false);
    setShowSortPanel(false);
  }, []);

  const handlePreferenceChange = useCallback(
    (event: string, channel: "email" | "sms" | "inApp") => {
      setNotificationPrefs((prev) => ({
        ...prev,
        [event]: {
          ...prev[event],
          [channel]: !prev[event][channel],
        },
      }));
    },
    []
  );

  const handleSavePreferences = useCallback(async () => {
    try {
      await updateNotificationPreferences(notificationPrefs);
      setTempSuccess("Notification preferences saved successfully");
    } catch (err) {
      setNotificationError("Failed to save notification preferences");
      console.error("Failed to save preferences:", err);
    }
  }, [notificationPrefs, setTempSuccess]);

  // Filter and sort notifications
  const filteredNotifications = useMemo(() => {
    return notifications
      .filter((n) => {
        const matchesSearch = n.message
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const matchesRead = showRead || n.status !== "read";
        const matchesType =
          filterTypes.length === 0 || filterTypes.includes(n.type);
        const matchesEvent =
          filterEvents.length === 0 ||
          filterEvents.some((action) => {
            const eventAction = n.message.split(':')[1]?.toLowerCase();
            return eventAction && action.toLowerCase() === eventAction;
          });
        const matchesStatus =
          filterStatuses.length === 0 || filterStatuses.includes(n.status);
        const notificationDate = new Date(n.createdAt);
        const matchesDate =
          (!startDate || notificationDate >= new Date(startDate)) &&
          (!endDate || notificationDate <= new Date(endDate));
        return matchesSearch && matchesRead && matchesType && matchesEvent && matchesStatus && matchesDate;
      })
      .sort((a, b) => {
        let valueA: string | number;
        let valueB: string | number;
        switch (sortBy) {
          case "createdAt":
            valueA = new Date(a.createdAt).getTime();
            valueB = new Date(b.createdAt).getTime();
            break;
          case "type":
            valueA = a.type.toLowerCase();
            valueB = b.type.toLowerCase();
            break;
          case "message":
            valueA = a.message.toLowerCase();
            valueB = b.message.toLowerCase();
            break;
        }
        if (sortOrder === "asc") {
          return valueA > valueB ? 1 : -1;
        }
        return valueA < valueB ? 1 : -1;
      });
  }, [
    notifications,
    searchQuery,
    showRead,
    filterTypes,
    filterEvents,
    filterStatuses,
    startDate,
    endDate,
    sortBy,
    sortOrder,
  ]);

  // Filter and sort preferences (only enabled notifications)
  const groupedPreferences = useMemo(() => {
    const grouped: { [type: string]: { value: string; label: string }[] } = {};
    availableEvents.forEach((event) => {
      const action = event.split(':')[1];
      if (!action) return;
      const type = notificationTypes.find((t) =>
        event.toLowerCase().includes(t.toLowerCase())
      ) || "General";
      const isEnabled = notificationPrefs[event]?.email || notificationPrefs[event]?.sms || notificationPrefs[event]?.inApp;
      if (!isEnabled) return;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({
        value: event,
        label: action.charAt(0).toUpperCase() + action.slice(1),
      });
    });

    // Sort events within each type
    Object.keys(grouped).forEach((type) => {
      if (prefSortBy === "event") {
        grouped[type].sort((a, b) => {
          const valueA = a.label.toLowerCase();
          const valueB = b.label.toLowerCase();
          return prefSortOrder === "asc"
            ? valueA.localeCompare(valueB)
            : valueB.localeCompare(valueA);
        });
      }
    });

    // Sort types if prefSortBy is 'type'
    let sortedGrouped = grouped;
    if (prefSortBy === "type") {
      const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const valueA = a.toLowerCase();
        const valueB = b.toLowerCase();
        return prefSortOrder === "asc"
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      });
      sortedGrouped = {};
      sortedKeys.forEach((key) => {
        sortedGrouped[key] = grouped[key];
      });
    }

    // Apply type filter
    const filteredGrouped = prefFilterType
      ? { [prefFilterType]: grouped[prefFilterType] || [] }
      : sortedGrouped;

    return filteredGrouped;
  }, [availableEvents, notificationTypes, notificationPrefs, prefFilterType, prefSortBy, prefSortOrder]);

  if (loading) {
    return <ProfilePageSkeleton />;
  }

  if (!profileData) {
    return (
      <div className="error-message">
        Failed to load profile. Please try again later.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="profile-page">
        <header className="profile-header">
          <div
            className="profile-pic-container"
            onClick={() => {
              if (!isUploadDisabled) {
                if (profilePic) {
                  setShowProfilePicPopup(true);
                } else {
                  document.getElementById("profile-pic-input")?.click();
                }
              }
            }}
          >
            {profilePic ? (
              <img
                src={profilePic}
                alt={`${profileData.firstname} ${profileData.lastname}'s profile picture`}
                className="profile-pic"
              />
            ) : (
              <FaRegUser className="profile-pic-placeholder" />
            )}
            {!isUploadDisabled && (
              <div className="profile-pic-overlay">
                <FaCamera />
              </div>
            )}
            <input
              type="file"
              id="profile-pic-input"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleProfilePicChange}
              disabled={isUploadDisabled}
            />
          </div>
          <div className="header-info">
            <h1>
              <span onDoubleClick={() => handleDoubleClick("firstname")}>
                {editingField === "firstname" ? (
                  <div className="input-container">
                    <input
                      type="text"
                      value={profileData.firstname}
                      onChange={(e) =>
                        handleInputChange("firstname", e.target.value)
                      }
                      onKeyDown={(e) => handleKeyDown(e, "firstname")}
                      autoFocus
                      className="edit-input"
                    />
                    {formErrors.firstname && (
                      <span className="field-error">{formErrors.firstname}</span>
                    )}
                  </div>
                ) : profileData.firstname !== "Not set" ? (
                  profileData.firstname
                ) : (
                  "First Name Not Set"
                )}
              </span>{" "}
              <span onDoubleClick={() => handleDoubleClick("lastname")}>
                {editingField === "lastname" ? (
                  <div className="input-container">
                    <input
                      type="text"
                      value={profileData.lastname}
                      onChange={(e) =>
                        handleInputChange("lastname", e.target.value)
                      }
                      onKeyDown={(e) => handleKeyDown(e, "lastname")}
                      autoFocus
                      className="edit-input"
                    />
                    {formErrors.lastname && (
                      <span className="field-error">{formErrors.lastname}</span>
                    )}
                  </div>
                ) : profileData.lastname !== "Not set" ? (
                  profileData.lastname
                ) : (
                  "Last Name Not Set"
                )}
              </span>
            </h1>
            <p className="user-role">User ID: {profileData.userID}</p>
          </div>
        </header>

        {showProfilePicPopup && profilePic && (
          <div className="profile-pic-popup">
            <div className="profile-pic-popup-content">
              <button
                className="popup-close-btn"
                onClick={() => setShowProfilePicPopup(false)}
              >
                <FaTimes />
              </button>
              <img
                src={profilePic}
                alt={`${profileData.firstname} ${profileData.lastname}'s profile picture`}
                className="popup-profile-pic"
              />
              <div className="popup-buttons">
                <button
                  className="popup-change-btn"
                  onClick={() => document.getElementById("profile-pic-input")?.click()}
                >
                  <FaCamera /> Change
                </button>
                <button
                  className="popup-delete-btn"
                  onClick={handleRemoveProfilePic}
                >
                  <FaTrash /> Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <nav className="profile-nav">
          <button
            className={`nav-tab ${activeTab === "info" ? "active" : ""}`}
            onClick={() => handleTabChange("info")}
          >
            <FaUser /> Profile Info
          </button>
          <button
            className={`nav-tab ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => handleTabChange("settings")}
          >
            <FaCog /> Settings
          </button>
          <button
            className={`nav-tab ${activeTab === "activity" ? "active" : ""}`}
            onClick={() => handleTabChange("activity")}
          >
            <FaHistory /> Activity
          </button>
          <button
            className={`nav-tab ${activeTab === "notifications" ? "active" : ""}`}
            onClick={() => handleTabChange("notifications")}
          >
            <FaBell /> Notifications
          </button>
        </nav>

        <main className="profile-content">
          {activeTab === "info" && (
            <section className="info-section">
              <h2>Profile Information</h2>
              <div className="info-grid">
                <div className="info-item">
                  <FaEnvelope />
                  <label>Email</label>
                  <span onDoubleClick={() => handleDoubleClick("email")}>
                    {editingField === "email" ? (
                      <div className="input-container">
                        <input
                          type="email"
                          value={profileData.email}
                          onChange={(e) =>
                            handleInputChange("email", e.target.value)
                          }
                          onKeyDown={(e) => handleKeyDown(e, "email")}
                          autoFocus
                          className="edit-input"
                        />
                        {formErrors.email && (
                          <span className="field-error">{formErrors.email}</span>
                        )}
                      </div>
                    ) : (
                      profileData.email || "Not set"
                    )}
                  </span>
                </div>
                <div className="info-item">
                  <FaPhone />
                  <label>Phone</label>
                  <span onDoubleClick={() => handleDoubleClick("phone")}>
                    {editingField === "phone" ? (
                      <div className="input-container">
                        <input
                          type="text"
                          value={formattedPhone}
                          onChange={handlePhoneChange}
                          onKeyDown={(e) => handleKeyDown(e, "phone")}
                          autoFocus
                          className="edit-input"
                          maxLength={10}
                          placeholder="XX XXX XXX"
                        />
                        {formErrors.phone && (
                          <span className="field-error">{formErrors.phone}</span>
                        )}
                      </div>
                    ) : formattedPhone ? (
                      `+216 ${formattedPhone}`
                    ) : (
                      "Not set"
                    )}
                  </span>
                </div>
              </div>
            </section>
          )}

          {activeTab === "settings" && (
            <section className="settings-section">
              <h2>Account Settings</h2>
              <div className="settings-grid">
                <div className="settings-item">
                  <h3>Change Password</h3>
                  <div className="form-group">
                    <label>New Password</label>
                    <div className="input-container">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => handleNewPasswordChange(e.target.value)}
                        placeholder="Enter new password"
                      />
                      {formErrors.newPassword && (
                        <span className="field-error">
                          {formErrors.newPassword}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Confirm Password</label>
                    <div className="input-container">
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) =>
                          handleConfirmPasswordChange(e.target.value)
                        }
                        placeholder="Confirm new password"
                      />
                      {formErrors.confirmPassword && (
                        <span className="field-error">
                          {formErrors.confirmPassword}
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="update-btn" onClick={handlePasswordChange}>
                    Update Password
                  </button>
                </div>
                <div className="settings-item">
                  <h3>Two-Factor Authentication</h3>
                  <p>
                    Status: <span className="status">Enabled</span>
                  </p>
                  <button className="action-btn">Enable 2FA</button>
                </div>
              </div>
            </section>
          )}

          {activeTab === "activity" && (
            <section className="activity-section">
              <h2>Recent Activity</h2>
              <div className="activity-list">
                <div className="activity-item">
                  <FaHistory />
                  <div className="activity-details">
                    <p>Visit Logged</p>
                    <span>April 07, 2025 - 10:45</span>
                    <span className="activity-subtext">
                      Agent: John Doe | Location: Tunis
                    </span>
                  </div>
                  <span className="activity-amount">+1 Visit</span>
                </div>
                <div className="activity-item">
                  <FaClock />
                  <div className="activity-details">
                    <p>Timesheet Submitted</p>
                    <span>April 06, 2025 - 16:20</span>
                    <span className="activity-subtext">Duration: 8h 30m</span>
                  </div>
                  <span className="activity-amount">Pending Approval</span>
                </div>
                <div className="activity-item">
                  <FaCreditCard />
                  <div className="activity-details">
                    <p>Carnet Distributed</p>
                    <span>April 05, 2025 - 09:15</span>
                    <span className="activity-subtext">
                      Carnet ID: #CRN12345 | Agent: Amina K.
                    </span>
                  </div>
                  <span className="activity-amount">+1 Carnet</span>
                </div>
                <div className="activity-item">
                  <FaCheckCircle />
                  <div className="activity-details">
                    <p>Souche Collected</p>
                    <span>April 04, 2025 - 14:00</span>
                    <span className="activity-subtext">
                      Carnet ID: #CRN12345 | Status: Validated
                    </span>
                  </div>
                  <span className="activity-amount">+1 Souche</span>
                </div>
              </div>
            </section>
          )}

          {activeTab === "notifications" && (
            <section className="notification-section">
              <h2>Notifications</h2>
              <div className="notification-tabs">
                <button
                  className={`nav-tab ${notificationView === "list" ? "active" : ""}`}
                  onClick={() => setNotificationView("list")}
                >
                  Notification List
                </button>
                <button
                  className={`nav-tab ${notificationView === "preferences" ? "active" : ""}`}
                  onClick={() => setNotificationView("preferences")}
                >
                  Preferences
                </button>
              </div>

              {notificationView === "list" && (
                <div className="notification-list-wrapper">
                  <div className="notification-list-container">
                    <div className="notification-controls">
                      <div className="search-container">
                        <FaSearch />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search notifications..."
                          className="search-input"
                        />
                      </div>
                      <button
                        className={`toggle-read-btn ${showRead ? "active" : ""}`}
                        onClick={() => setShowRead(!showRead)}
                      >
                        {showRead ? "Hide Read" : "Show All"}
                      </button>
                      <button
                        onClick={handleRefreshNotifications}
                        className="action-btn"
                        disabled={isLoadingNotifications}
                      >
                        <FaSync className={isLoadingNotifications ? "spinning" : ""} />
                        Refresh
                      </button>
                      <button
                        onClick={handleMarkAllAsRead}
                        className="action-btn"
                        disabled={isLoadingNotifications || notifications.length === 0}
                      >
                        Mark All Read
                      </button>
                    </div>
                    {notificationError && (
                      <div className="error-message">{notificationError}</div>
                    )}
                    {isLoadingNotifications ? (
                      <div className="custom-skeleton pulsing" style={{ width: '100%', height: '200px' }} />
                    ) : filteredNotifications.length === 0 ? (
                      <p>No notifications found</p>
                    ) : (
                      <div className="notification-list">
                        {filteredNotifications.map((notification) => (
                          <div
                            key={notification.notificationID}
                            className={`notification-item ${notification.status === "read" ? "read" : ""}`}
                            onClick={() => handleMarkAsRead(notification.notificationID)}
                          >
                            <div className="notification-details">
                              <span className="notification-message">{notification.message}</span>
                              <span className="notification-meta">
                                {notification.type} • {notification.status} • {notification.channel} • {new Date(notification.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <aside className="filter-sidebar">
                    <div className="filter-section">
                      <button
                        className={`filter-toggle ${showTypeFilter ? "active" : ""}`}
                        onClick={() => {
                          setShowTypeFilter(!showTypeFilter);
                          setShowEventFilter(false);
                          setShowStatusFilter(false);
                          setShowDateFilter(false);
                          setShowSortPanel(false);
                        }}
                      >
                        <FaFilter /> Type Filter
                      </button>
                      {showTypeFilter && (
                        <div className="filter-content">
                          <div className="filter-group">
                            <div className="filter-options">
                              {notificationTypes.map((type) => (
                                <button
                                  key={type}
                                  className={`filter-option ${filterTypes.includes(type) ? "active" : ""}`}
                                  onClick={() =>
                                    setFilterTypes((prev) =>
                                      prev.includes(type)
                                        ? prev.filter((t) => t !== type)
                                        : [...prev, type]
                                    )
                                  }
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="filter-section">
                      <button
                        className={`filter-toggle ${showEventFilter ? "active" : ""}`}
                        onClick={() => {
                          setShowEventFilter(!showEventFilter);
                          setShowTypeFilter(false);
                          setShowStatusFilter(false);
                          setShowDateFilter(false);
                          setShowSortPanel(false);
                        }}
                      >
                        <FaFilter /> Event Filter
                      </button>
                      {showEventFilter && (
                        <div className="filter-content">
                          <div className="filter-group">
                            <div className="filter-options">
                              {availableEventActions.map(({ value, label }) => (
                                <button
                                  key={value}
                                  className={`filter-option ${filterEvents.includes(value) ? "active" : ""}`}
                                  onClick={() =>
                                    setFilterEvents((prev) =>
                                      prev.includes(value)
                                        ? prev.filter((e) => e !== value)
                                        : [...prev, value]
                                    )
                                  }
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="filter-section">
                      <button
                        className={`filter-toggle ${showStatusFilter ? "active" : ""}`}
                        onClick={() => {
                          setShowStatusFilter(!showStatusFilter);
                          setShowTypeFilter(false);
                          setShowEventFilter(false);
                          setShowDateFilter(false);
                          setShowSortPanel(false);
                        }}
                      >
                        <FaFilter /> Status Filter
                      </button>
                      {showStatusFilter && (
                        <div className="filter-content">
                          <div className="filter-group">
                            <div className="filter-options">
                              {["pending", "sent", "read", "failed"].map((status) => (
                                <button
                                  key={status}
                                  className={`filter-option ${filterStatuses.includes(status) ? "active" : ""}`}
                                  onClick={() =>
                                    setFilterStatuses((prev) =>
                                      prev.includes(status)
                                        ? prev.filter((s) => s !== status)
                                        : [...prev, status]
                                    )
                                  }
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="filter-section">
                      <button
                        className={`filter-toggle ${showDateFilter ? "active" : ""}`}
                        onClick={() => {
                          setShowDateFilter(!showDateFilter);
                          setShowTypeFilter(false);
                          setShowEventFilter(false);
                          setShowStatusFilter(false);
                          setShowSortPanel(false);
                        }}
                      >
                        <FaFilter /> Date Filter
                      </button>
                      {showDateFilter && (
                        <div className="filter-content">
                          <div className="filter-group">
                            <label>Start Date</label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                            />
                            <label>End Date</label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="filter-section">
                      <button
                        className={`filter-toggle ${showSortPanel ? "active" : ""}`}
                        onClick={() => {
                          setShowSortPanel(!showSortPanel);
                          setShowTypeFilter(false);
                          setShowEventFilter(false);
                          setShowStatusFilter(false);
                          setShowDateFilter(false);
                        }}
                      >
                        <FaSort /> Sort
                      </button>
                      {showSortPanel && (
                        <div className="filter-content">
                          <div className="filter-group">
                            <div className="filter-options">
                              <button
                                className={`filter-option ${sortBy === "createdAt" && sortOrder === "desc" ? "active" : ""}`}
                                onClick={() => {
                                  setSortBy("createdAt");
                                  setSortOrder("desc");
                                }}
                              >
                                Newest First
                              </button>
                              <button
                                className={`filter-option ${sortBy === "createdAt" && sortOrder === "asc" ? "active" : ""}`}
                                onClick={() => {
                                  setSortBy("createdAt");
                                  setSortOrder("asc");
                                }}
                              >
                                Oldest First
                              </button>
                              <button
                                className={`filter-option ${sortBy === "type" && sortOrder === "asc" ? "active" : ""}`}
                                onClick={() => {
                                  setSortBy("type");
                                  setSortOrder("asc");
                                }}
                              >
                                Type (A-Z)
                              </button>
                              <button
                                className={`filter-option ${sortBy === "type" && sortOrder === "desc" ? "active" : ""}`}
                                onClick={() => {
                                  setSortBy("type");
                                  setSortOrder("desc");
                                }}
                              >
                                Type (Z-A)
                              </button>
                              <button
                                className={`filter-option ${sortBy === "message" && sortOrder === "asc" ? "active" : ""}`}
                                onClick={() => {
                                  setSortBy("message");
                                  setSortOrder("asc");
                                }}
                              >
                                Message (A-Z)
                              </button>
                              <button
                                className={`filter-option ${sortBy === "message" && sortOrder === "desc" ? "active" : ""}`}
                                onClick={() => {
                                  setSortBy("message");
                                  setSortOrder("desc");
                                }}
                              >
                                Message (Z-A)
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleResetFilters}
                      className="action-btn reset-btn"
                    >
                      <FaTimes /> Reset Filters
                    </button>
                  </aside>
                </div>
              )}

              {notificationView === "preferences" && (
                <div className="notification-preferences-wrapper">
                  <div className="notification-preferences">
                    {Object.entries(groupedPreferences).length === 0 ? (
                      <p>No enabled notification preferences available</p>
                    ) : (
                      Object.entries(groupedPreferences).map(([type, events]) => (
                        <div key={type} className="preference-group">
                          <h3>{type}</h3>
                          <table className="preferences-table">
                            <thead>
                              <tr>
                                <th>Event</th>
                                <th>Email</th>
                                <th>SMS</th>
                                <th>In-App</th>
                              </tr>
                            </thead>
                            <tbody>
                              {events.map(({ value, label }) => (
                                <tr key={value}>
                                  <td>{label}</td>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={notificationPrefs[value]?.email || false}
                                      onChange={() => handlePreferenceChange(value, "email")}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={notificationPrefs[value]?.sms || false}
                                      onChange={() => handlePreferenceChange(value, "sms")}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="checkbox"
                                      checked={notificationPrefs[value]?.inApp || false}
                                      onChange={() => handlePreferenceChange(value, "inApp")}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))
                    )}
                    <button
                      onClick={handleSavePreferences}
                      className="update-btn"
                      disabled={isLoadingNotifications}
                    >
                      Save Preferences
                    </button>
                  </div>
                  <aside className="filter-sidebar">
                    <div className="filter-section">
                      <button
                        className={`filter-toggle ${showPrefTypeFilter ? "active" : ""}`}
                        onClick={() => {
                          setShowPrefTypeFilter(!showPrefTypeFilter);
                          setShowPrefSortPanel(false);
                        }}
                      >
                        <FaFilter /> Type Filter
                      </button>
                      {showPrefTypeFilter && (
                        <div className="filter-content">
                          <div className="filter-group">
                            <div className="filter-options">
                              <button
                                className={`filter-option ${prefFilterType === "" ? "active" : ""}`}
                                onClick={() => setPrefFilterType("")}
                              >
                                All Types
                              </button>
                              {notificationTypes.map((type) => (
                                <button
                                  key={type}
                                  className={`filter-option ${prefFilterType === type ? "active" : ""}`}
                                  onClick={() => setPrefFilterType(type)}
                                >
                                  {type}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="filter-section">
                      <button
                        className={`filter-toggle ${showPrefSortPanel ? "active" : ""}`}
                        onClick={() => {
                          setShowPrefSortPanel(!showPrefSortPanel);
                          setShowPrefTypeFilter(false);
                        }}
                      >
                        <FaSort /> Sort
                      </button>
                      {showPrefSortPanel && (
                        <div className="filter-content">
                          <div className="filter-group">
                            <div className="filter-options">
                              <button
                                className={`filter-option ${prefSortBy === "none" ? "active" : ""}`}
                                onClick={() => setPrefSortBy("none")}
                              >
                                Default
                              </button>
                              <button
                                className={`filter-option ${prefSortBy === "event" && prefSortOrder === "asc" ? "active" : ""}`}
                                onClick={() => {
                                  setPrefSortBy("event");
                                  setPrefSortOrder("asc");
                                }}
                              >
                                Event (A-Z)
                              </button>
                              <button
                                className={`filter-option ${prefSortBy === "event" && prefSortOrder === "desc" ? "active" : ""}`}
                                onClick={() => {
                                  setPrefSortBy("event");
                                  setPrefSortOrder("desc");
                                }}
                              >
                                Event (Z-A)
                              </button>
                              <button
                                className={`filter-option ${prefSortBy === "type" && prefSortOrder === "asc" ? "active" : ""}`}
                                onClick={() => {
                                  setPrefSortBy("type");
                                  setPrefSortOrder("asc");
                                }}
                              >
                                Type (A-Z)
                              </button>
                              <button
                                className={`filter-option ${prefSortBy === "type" && prefSortOrder === "desc" ? "active" : ""}`}
                                onClick={() => {
                                  setPrefSortBy("type");
                                  setPrefSortOrder("desc");
                                }}
                              >
                                Type (Z-A)
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </aside>
                </div>
              )}
            </section>
          )}

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
        </main>
      </div>
    </motion.div>
  );
});

export default ProfilePage;