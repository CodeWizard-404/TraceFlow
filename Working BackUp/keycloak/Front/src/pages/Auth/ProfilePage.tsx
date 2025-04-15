import React, { useState, useEffect, ChangeEvent, KeyboardEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { updateProfile, fetchUserProfile } from "../../apis/userAPI";
import User from "../../models/User";
import "./ProfilePage.css";
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaWallet,
  FaCamera,
  FaCog,
  FaHistory,
  FaCreditCard,
  FaClock,
  FaCheckCircle,
  FaRegUser,
} from "react-icons/fa";

const ProfilePage: React.FC = () => {
  const { user } = useAuth(); // Removed token
  const [profileData, setProfileData] = useState<User | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "settings" | "activity">("info");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [rawPhone, setRawPhone] = useState("");
  const [rawWallet, setRawWallet] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const setTempError = (message: string) => {
    setError(message);
    setTimeout(() => setError(""), 3000);
  };

  const setTempSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 3000);
  };

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) {
        setTempError("User not authenticated");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const fullUser = await fetchUserProfile();
        const completeUser: User = {
          keycloakId: user.keycloakId || "",
          userID: fullUser.userID || user.userID || "",
          firstname: fullUser.firstname || user.firstname || "",
          lastname: fullUser.lastname || user.lastname || "",
          phone: fullUser.phone || user.phone || "",
          email: fullUser.email || user.email || "",
          wallet: fullUser.wallet || user.wallet || "",
          PFP: fullUser.PFP || user.PFP || null,
          password: "",
        };

        setProfileData(completeUser);
        setRawPhone(completeUser.phone || "");
        setRawWallet(completeUser.wallet || "");

        if (completeUser.PFP) {
          try {
            const imageSrc = `data:image/jpeg;base64,${completeUser.PFP}`;
            setProfilePic(imageSrc);
          } catch (err) {
            console.error("Error converting profile picture:", err);
            setProfilePic(null);
            setTempError("Failed to load profile picture");
          }
        }

        localStorage.setItem("user", JSON.stringify(completeUser));
      } catch (err) {
        console.error("Failed to load user profile:", err);
        setTempError(err instanceof Error ? err.message : "Failed to load user profile");
        if (user) {
          const fallbackUser: User = {
            keycloakId: user.keycloakId || "",
            userID: user.userID || "",
            firstname: user.firstname || "Not set",
            lastname: user.lastname || "Not set",
            phone: user.phone || "",
            email: user.email || "",
            wallet: user.wallet || "",
            PFP: user.PFP || null,
            password: "",
          };
          setProfileData(fallbackUser);
          setRawPhone(fallbackUser.phone || "");
          setRawWallet(fallbackUser.wallet || "");
          if (fallbackUser.PFP) {
            try {
              const imageSrc = `data:image/jpeg;base64,${fallbackUser.PFP}`;
              setProfilePic(imageSrc);
            } catch {
              setProfilePic(null);
            }
          }
          localStorage.setItem("user", JSON.stringify(fallbackUser));
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, [user]);

  // Validation Functions (unchanged)
  const validateName = (value: string, field: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return `${field} is required`;
    if (trimmed.length < 3) return `${field} must be at least 3 characters`;
    if (trimmed.length > 20) return `${field} must be 20 characters or less`;
    if (!/^[a-zA-Z\s'-]+$/.test(trimmed)) return `${field} can only contain letters, spaces, hyphens, or apostrophes`;
    return "";
  };

  const validateEmail = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "Email is required";
    if (trimmed.length > 70) return "Email must be 70 characters or less";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Invalid email format";
    return "";
  };

  const validatePhone = (value: string): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (!digits) return "Phone is required";
    if (digits.length !== 8) return "Phone must be 8 digits";
    return "";
  };

  const validateWallet = (value: string): string => {
    const digits = value.replace(/[^\d]/g, "");
    if (digits && digits.length !== 16) return "Wallet must be exactly 16 digits";
    return "";
  };

  const validatePassword = (value: string): string => {
    if (value && value.length < 8) return "Password must be at least 8 characters";
    if (value.length > 128) return "Password must be 128 characters or less";
    if (value && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[^\s]+$/.test(value)) {
      return "Password must include uppercase, lowercase, digit, and special character, no spaces";
    }
    return "";
  };

  const validatePasswordConfirm = (password: string, confirm: string): string => {
    if (password && !confirm) return "Password confirmation is required";
    if (password && confirm && password !== confirm) return "Passwords do not match";
    return "";
  };

  // Formatting Functions (unchanged)
  const formatPhoneDisplay = (rawValue: string): string => {
    const digits = rawValue.replace(/[^\d]/g, "");
    let formatted = "";
    if (digits.length > 0) formatted += digits.slice(0, 2);
    if (digits.length > 2) formatted += " " + digits.slice(2, 5);
    if (digits.length > 5) formatted += " " + digits.slice(5, 8);
    return formatted;
  };

  const formatWalletDisplay = (rawValue: string): string => {
    const digits = rawValue.replace(/[^\d]/g, "");
    let formatted = "";
    if (digits.length > 0) formatted += digits.slice(0, 4);
    if (digits.length > 4) formatted += "-" + digits.slice(4, 8);
    if (digits.length > 8) formatted += "-" + digits.slice(8, 12);
    if (digits.length > 12) formatted += "-" + digits.slice(12, 16);
    return formatted;
  };

  const stripPhoneForDatabase = (raw: string): string => {
    return raw.replace(/[^\d]/g, "");
  };

  const stripWalletForDatabase = (formatted: string): string => {
    return formatted.replace(/[^\d]/g, "");
  };

  // Input Handlers
  const handleDoubleClick = (field: string) => {
    setEditingField(field);
    setError("");
    setSuccess("");
    setFormErrors({});
    if (field === "phone") setRawPhone(profileData?.phone || "");
    if (field === "wallet") setRawWallet(profileData?.wallet || "");
  };

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 8);
    setRawPhone(raw);
    setProfileData({ ...profileData!, phone: stripPhoneForDatabase(raw) });
    setFormErrors({ ...formErrors, Kathy: validatePhone(raw) });
  };

  const handleWalletChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 16);
    setRawWallet(raw);
    setProfileData({ ...profileData!, wallet: stripWalletForDatabase(raw) });
    setFormErrors({ ...formErrors, wallet: validateWallet(raw) });
  };

  const handleInputChange = (field: keyof User, value: string) => {
    if (profileData) {
      setProfileData({ ...profileData, [field]: value });
      let error = "";
      switch (field) {
        case "firstname":
        case "lastname":
          error = validateName(value, field.charAt(0).toUpperCase() + field.slice(1));
          break;
        case "email":
          error = validateEmail(value);
          break;
        case "phone":
          error = validatePhone(value);
          break;
        case "wallet":
          error = validateWallet(value);
          break;
      }
      setFormErrors({ ...formErrors, [field]: error });
    }
  };

  const handleNewPasswordChange = (value: string) => {
    setNewPassword(value);
    const passwordError = validatePassword(value);
    setFormErrors({
      ...formErrors,
      newPassword: passwordError,
      confirmPassword: validatePasswordConfirm(value, confirmPassword),
    });
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setFormErrors({
      ...formErrors,
      confirmPassword: validatePasswordConfirm(newPassword, value),
    });
  };

  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>, field: keyof User) => {
    if (e.key === "Enter" && profileData) {
      const error = formErrors[field];
      if (error) {
        setTempError(error);
        return;
      }
      try {
        const updatedData: Partial<User> = { [field]: profileData[field] };
        const response = await updateProfile(updatedData);
        const updatedUser: User = {
          ...profileData,
          ...response,
          PFP: response.PFP || profileData.PFP,
        };
        setProfileData(updatedUser);
        setTempSuccess("Profile updated successfully");
        setEditingField(null);
        setRawPhone(updatedUser.phone || "");
        setRawWallet(updatedUser.wallet || "");
        localStorage.setItem("user", JSON.stringify(updatedUser));
      } catch (err) {
        console.error("Profile update error:", err);
        setTempError(err instanceof Error ? err.message : "Failed to update profile");
        setProfileData(user || profileData);
        setRawPhone(user?.phone || profileData?.phone || "");
        setRawWallet(user?.wallet || profileData?.wallet || "");
      }
    } else if (e.key === "Escape") {
      setProfileData(user || profileData);
      setRawPhone(user?.phone || profileData?.phone || "");
      setRawWallet(user?.wallet || profileData?.wallet || "");
      setEditingField(null);
      setFormErrors({});
    }
  };

  const handleProfilePicChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      const formData = new FormData();
      formData.append("PFP", file);
      const response = await updateProfile(formData); // No token
      if (response.PFP) {
        const imageSrc = `data:image/jpeg;base64,${response.PFP}`;
        setProfilePic(imageSrc);
        const updatedUser: User = { ...profileData!, ...response, PFP: response.PFP };
        setProfileData(updatedUser);
        setTempSuccess("Profile picture updated successfully");
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
    } catch (err) {
      console.error("Profile pic update error:", err);
      setTempError(err instanceof Error ? err.message : "Failed to update profile picture");
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) return;
    const passwordError = formErrors.newPassword;
    const confirmError = formErrors.confirmPassword;
    if (passwordError || confirmError) {
      setTempError(passwordError || confirmError);
      return;
    }
    try {
      const response = await updateProfile({ password: newPassword }); // No token
      const updatedUser: User = { ...profileData!, ...response };
      setProfileData(updatedUser);
      setTempSuccess("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
      setFormErrors({ ...formErrors, newPassword: "", confirmPassword: "" });
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (err) {
      console.error("Password update error:", err);
      setTempError(err instanceof Error ? err.message : "Failed to update password");
    }
  };

  if (isLoading) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Loading Profile...</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="error-message">
        Failed to load profile. Please try again later.
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div
          className="profile-pic-container"
          onClick={() => document.getElementById("profile-pic-input")?.click()}
        >
          {profilePic ? (
            <img src={profilePic} alt="Profile" className="profile-pic" />
          ) : (
            <FaRegUser className="profile-pic-placeholder" />
          )}
          <div className="profile-pic-overlay">
            <FaCamera />
          </div>
          <input
            type="file"
            id="profile-pic-input"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleProfilePicChange}
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
                    onChange={(e) => handleInputChange("firstname", e.target.value)}
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
                    onChange={(e) => handleInputChange("lastname", e.target.value)}
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

      <nav className="profile-nav">
        <button
          className={`nav-tab ${activeTab === "info" ? "active" : ""}`}
          onClick={() => setActiveTab("info")}
        >
          <FaUser /> Profile Info
        </button>
        <button
          className={`nav-tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <FaCog /> Settings
        </button>
        <button
          className={`nav-tab ${activeTab === "activity" ? "active" : ""}`}
          onClick={() => setActiveTab("activity")}
        >
          <FaHistory /> Activity
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
                        onChange={(e) => handleInputChange("email", e.target.value)}
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
                        value={formatPhoneDisplay(rawPhone)}
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
                  ) : rawPhone ? (
                    `+216 ${formatPhoneDisplay(rawPhone)}`
                  ) : (
                    "Not set"
                  )}
                </span>
              </div>
              <div className="info-item">
                <FaWallet />
                <label>Wallet</label>
                <span onDoubleClick={() => handleDoubleClick("wallet")}>
                  {editingField === "wallet" ? (
                    <div className="input-container">
                      <input
                        type="text"
                        value={formatWalletDisplay(rawWallet)}
                        onChange={handleWalletChange}
                        onKeyDown={(e) => handleKeyDown(e, "wallet")}
                        autoFocus
                        className="edit-input"
                        maxLength={19}
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                      />
                      {formErrors.wallet && (
                        <span className="field-error">{formErrors.wallet}</span>
                      )}
                    </div>
                  ) : rawWallet ? (
                    formatWalletDisplay(rawWallet)
                  ) : (
                    "Not linked"
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
                      <span className="field-error">{formErrors.newPassword}</span>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label>Confirm Password</label>
                  <div className="input-container">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                      placeholder="Confirm new password"
                    />
                    {formErrors.confirmPassword && (
                      <span className="field-error">{formErrors.confirmPassword}</span>
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
                  <span className="activity-subtext">Agent: John Doe | Location: Tunis</span>
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
                  <span className="activity-subtext">Carnet ID: #CRN12345 | Agent: Amina K.</span>
                </div>
                <span className="activity-amount">+1 Carnet</span>
              </div>
              <div className="activity-item">
                <FaCheckCircle />
                <div className="activity-details">
                  <p>Souche Collected</p>
                  <span>April 04, 2025 - 14:00</span>
                  <span className="activity-subtext">Carnet ID: #CRN12345 | Status: Validated</span>
                </div>
                <span className="activity-amount">+1 Souche</span>
              </div>
            </div>
          </section>
        )}

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
      </main>
    </div>
  );
};

export default ProfilePage;