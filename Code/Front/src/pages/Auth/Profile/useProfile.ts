/**
 * useProfile.ts
 * Custom hook for managing profile-related state and logic.
 * Handles profile data, notifications, and preferences with WebSocket integration.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { debounce } from "lodash";
import { useAuth } from "../../../context/AuthContext";
import {
    updateProfile,
    fetchUserProfile,
    UpdateProfileInput,
} from "../../../apis/userAPI";
import {
    getNotificationPreferences,
    getNotificationTypes,
} from "../../../apis/notificationAPI";
import User from "../../../models/User";
import Notification from "../../../models/Notification";
import NotificationPreference from "../../../models/NotificationPreference";
import {
    initSocket,
    joinRoom,
    onNotification,
    offNotification,
} from "../../../lib/socket";
import {
    detectImageMimeType,
    isValidBase64,
    validateName,
    validateEmail,
    validatePhone,
    validatePassword,
    validatePasswordConfirm,
    stripPhoneForDatabase,
} from "./profileUtils";

// Define type for groupedPreferences
interface PreferenceEvent {
    value: string;
    label: string;
}
interface GroupedPreferences {
    [type: string]: PreferenceEvent[];
}

export const useProfile = () => {
    console.debug("useProfile hook initialized", { timestamp: new Date().toISOString() });

    const { user } = useAuth();
    const [profileData, setProfileData] = useState<User | null>(null);
    const [editingField, setEditingField] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string>("");
    const [success, setSuccess] = useState<string>("");
    const [profilePic, setProfilePic] = useState<string | null>(null);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [failedUploadCount, setFailedUploadCount] = useState(0);
    const [isUploadDisabled, setIsUploadDisabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showProfilePicPopup, setShowProfilePicPopup] = useState(false);

    // Notification-specific states
    const [notificationView, setNotificationViewState] = useState<"list" | "preferences">("list");
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
    const [prefFilterType, setPrefFilterType] = useState<string>("");
    const [prefSortBy, setPrefSortBy] = useState<"none" | "event" | "type">("none");
    const [prefSortOrder, setPrefSortOrder] = useState<"asc" | "desc">("asc");

    // Debug setNotificationView
    const setNotificationView = useCallback((view: "list" | "preferences") => {
        console.debug("setNotificationView called in useProfile", {
            view,
            previousView: notificationView,
            timestamp: new Date().toISOString(),
        });
        setNotificationViewState(view);
    }, [notificationView]);

    const setTempError = useCallback((message: string) => {
        setError(message);
        setTimeout(() => setError(""), 5000);
    }, []);

    const setTempSuccess = useCallback((message: string) => {
        setSuccess(message);
        setTimeout(() => setSuccess(""), 5000);
    }, []);

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

    const saveValidPFP = useCallback((pfp: string) => {
        if (isValidBase64(pfp) && detectImageMimeType(pfp)) {
            localStorage.setItem("lastValidPFP", pfp);
        }
    }, []);

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

    useEffect(() => {
        const loadUserData = async () => {
            if (!user) {
                setTempError("User not authenticated");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setIsLoadingNotifications(true);
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
                // Validate and set notification preferences
                const validatedPrefs: NotificationPreference['preferences'] = {};
                Object.entries(notificationData.preferences).forEach(([event, channels]) => {
                    validatedPrefs[event] = {
                        email: !!channels.email,
                        sms: !!channels.sms,
                        inApp: !!channels.inApp,
                    };
                });
                setNotificationPrefs(validatedPrefs);
                setAvailableEvents(notificationData.availableEvents.map(item => item.event));
                setNotificationTypes(types);

                console.debug("Loaded notification preferences", {
                    preferences: validatedPrefs,
                    availableEvents: notificationData.availableEvents,
                    notificationTypes: types,
                    timestamp: new Date().toISOString(),
                });

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
                    img.onerror = () => {
                        console.error("Profile picture load error");
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
                setIsLoadingNotifications(false);
            }
        };

        loadUserData();
    }, [user, setTempError, fetchProfileWithRetry, loadLastValidPFP, saveValidPFP]);

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
                                img.onerror = () => {
                                    console.error("Updated profile picture load error");
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

    const debouncedHandlePhoneChange = useMemo(
        () =>
            debounce((value: string) => {
                const raw = value.replace(/[^\d]/g, "").slice(0, 8);
                setProfileData((prev) =>
                    prev ? { ...prev, phone: stripPhoneForDatabase(raw) } : prev
                );
                setFormErrors((prev) => ({ ...prev, phone: validatePhone(raw) }));
            }, 300),
        []
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
        []
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
        [confirmPassword]
    );

    const handleConfirmPasswordChange = useCallback(
        (value: string) => {
            setConfirmPassword(value);
            setFormErrors((prev) => ({
                ...prev,
                confirmPassword: validatePasswordConfirm(newPassword, value),
            }));
        },
        [newPassword]
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
                    img.onerror = () => {
                        console.error("New profile picture load error");
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

    const groupedPreferences: GroupedPreferences = useMemo(() => {
        const grouped: GroupedPreferences = {};
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

        return prefFilterType
            ? { [prefFilterType]: grouped[prefFilterType] || [] }
            : sortedGrouped;
    }, [availableEvents, notificationTypes, notificationPrefs, prefFilterType, prefSortBy, prefSortOrder]);

    return {
        profileData,
        setProfileData,
        editingField,
        setEditingField,
        newPassword,
        setNewPassword,
        confirmPassword,
        setConfirmPassword,
        error,
        setError,
        success,
        setSuccess,
        profilePic,
        setProfilePic,
        formErrors,
        setFormErrors,
        failedUploadCount,
        setFailedUploadCount,
        isUploadDisabled,
        setIsUploadDisabled,
        loading,
        setLoading,
        showProfilePicPopup,
        setShowProfilePicPopup,
        notificationView,
        setNotificationView,
        notifications,
        setNotifications,
        notificationPrefs,
        setNotificationPrefs,
        availableEvents,
        setAvailableEvents,
        notificationTypes,
        setNotificationTypes,
        searchQuery,
        setSearchQuery,
        showRead,
        setShowRead,
        filterTypes,
        setFilterTypes,
        filterEvents,
        setFilterEvents,
        filterStatuses,
        setFilterStatuses,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
        isLoadingNotifications,
        setIsLoadingNotifications,
        notificationError,
        setNotificationError,
        prefFilterType,
        setPrefFilterType,
        prefSortBy,
        setPrefSortBy,
        prefSortOrder,
        setPrefSortOrder,
        availableEventActions,
        groupedPreferences,
        setTempError,
        setTempSuccess,
        handlePhoneChange,
        handleInputChange,
        handleNewPasswordChange,
        handleConfirmPasswordChange,
        handleKeyDown,
        handleProfilePicChange,
        handleRemoveProfilePic,
        handlePasswordChange,
    };
};