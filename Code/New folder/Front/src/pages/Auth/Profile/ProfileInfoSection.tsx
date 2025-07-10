/**
 * ProfileInfoSection.tsx
 * Component for managing user profile information.
 * Handles editing of name, email, and phone with validation and API updates.
 */
import React, { useCallback, useMemo } from "react";
import { useProfile } from "./useProfile";
import { formatPhoneDisplay } from "./profileUtils";
import { FaEnvelope, FaPhone } from "react-icons/fa";

const ProfileInfoSection: React.FC = React.memo(() => {
    const {
        profileData,
        editingField,
        formErrors,
        setEditingField,
        handleInputChange,
        handlePhoneChange,
        handleKeyDown,
    } = useProfile();

    const handleDoubleClick = useCallback((field: string) => {
        setEditingField(field);
    }, [setEditingField]);

    const formattedPhone = useMemo(
        () => (profileData?.phone ? formatPhoneDisplay(profileData.phone) : ""),
        [profileData?.phone]
    );

    if (!profileData) return null;

    return (
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
    );
});

export default ProfileInfoSection;