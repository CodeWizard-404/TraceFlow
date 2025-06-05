/**
 * SettingsSection.tsx
 * Component for handling account settings, including password changes and 2FA.
 */
import React from "react";
import { useProfile } from "./useProfile";

const SettingsSection: React.FC = React.memo(() => {
    const {
        newPassword,
        confirmPassword,
        formErrors,
        handleNewPasswordChange,
        handleConfirmPasswordChange,
        handlePasswordChange,
    } = useProfile();

    return (
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

            </div>
        </section>
    );
});

export default SettingsSection;