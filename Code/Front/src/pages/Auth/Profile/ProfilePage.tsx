/**
 * ProfilePage.tsx
 * Container component for the user profile page, managing tab navigation and shared state.
 * Delegates rendering to specialized components for better performance and maintainability.
 * Uses existing ProfilePage.css for styling.
 */
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../../context/AuthContext";
import { useProfile } from "./useProfile";
import ProfileInfoSection from "./ProfileInfoSection";
import SettingsSection from "./SettingsSection";
import ActivitySection from "./ActivitySection";
import NotificationList from "./NotificationList";
import NotificationPreferences from "./NotificationPreferences";
import { FaUser, FaCog, FaHistory, FaBell, FaCamera, FaTimes, FaTrash } from "react-icons/fa";
import "./ProfilePage.css";

const ProfilePage: React.FC = React.memo(() => {
  const { user } = useAuth();
  const {
    profileData,
    profilePic,
    error,
    success,
    loading,
    isUploadDisabled,
    showProfilePicPopup,
    setShowProfilePicPopup,
    handleProfilePicChange,
    handleRemoveProfilePic,
  } = useProfile();
  const [activeTab, setActiveTab] = useState<"info" | "settings" | "activity" | "notifications">("info");

  const handleTabChange = useCallback(
    (tab: "info" | "settings" | "activity" | "notifications") => {
      setActiveTab(tab);
    },
    []
  );

  if (loading) {
    return (
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
  }

  if (!profileData || !user) {
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
              <FaUser className="profile-pic-placeholder" />
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
              {profileData.firstname !== "Not set" ? profileData.firstname : "First Name Not Set"}{" "}
              {profileData.lastname !== "Not set" ? profileData.lastname : "Last Name Not Set"}
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
          {activeTab === "info" && <ProfileInfoSection />}
          {activeTab === "settings" && <SettingsSection />}
          {activeTab === "activity" && <ActivitySection />}
          {activeTab === "notifications" && (
            <>
              <NotificationList />
              <NotificationPreferences />
            </>
          )}
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
        </main>
      </div>
    </motion.div>
  );
});

export default ProfilePage;