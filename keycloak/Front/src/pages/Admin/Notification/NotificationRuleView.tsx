import React, { useState, useEffect } from "react";
import { FaSave, FaTrash, FaTimes } from "react-icons/fa";
import { motion } from "framer-motion";
import NotificationRule from "../../models/NotificationRule";
import { updateNotificationRule, deleteNotificationRule } from "../../../apis/notificationAPI";
import { ViewMode } from "../adminTypes";
import "../AdminDashboard.css";

interface NotificationRuleViewProps {
    selectedRule: NotificationRule | null;
    setSelectedRule: React.Dispatch<React.SetStateAction<NotificationRule | null>>;
    rules: NotificationRule[];
    setRules: React.Dispatch<React.SetStateAction<NotificationRule[]>>;
    view: ViewMode;
    setView: React.Dispatch<React.SetStateAction<ViewMode>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const SKELETON_DELAY = 500;

const formVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const NotificationRuleViewSkeleton: React.FC = () => (
    <div className="form-card skeleton">
        <div className="custom-skeleton pulsing" style={{ width: "200px", height: "24px", marginBottom: "16px" }} />
        {[...Array(3)].map((_, i) => (
            <div key={i} className="form-section">
                <div className="custom-skeleton pulsing" style={{ width: "150px", height: "20px", marginBottom: "12px" }} />
                <div className="form-row">
                    <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
                    <div className="custom-skeleton pulsing" style={{ width: "100%", height: "32px" }} />
                </div>
            </div>
        ))}
        <div className="form-actions-0">
            <div className="custom-skeleton pulsing" style={{ width: "120px", height: "40px" }} />
            <div className="custom-skeleton pulsing" style={{ width: "120px", height: "40px" }} />
        </div>
    </div>
);

const NotificationRuleView: React.FC<NotificationRuleViewProps> = ({
    selectedRule,
    setSelectedRule,
    setRules,
    setView,
    setError,
    view
}) => {
    const [formData, setFormData] = useState<NotificationRule | null>(selectedRule);
    const [formErrors, setFormErrors] = useState({ event: "", messageTemplate: "" });
    const [touched, setTouched] = useState({ event: false, messageTemplate: false });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), SKELETON_DELAY);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        setFormData(selectedRule);
    }, [selectedRule]);

    if (!formData) return null;

    const validateEvent = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return "Event is required";
        if (trimmed.length < 3) return "Event must be at least 3 characters";
        return "";
    };

    const validateMessageTemplate = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return "Message template is required";
        if (trimmed.length < 5) return "Message template must be at least 5 characters";
        return "";
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        if (type === "checkbox") {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData((prev) =>
                prev ? { ...prev, channels: { ...prev.channels, [name]: checked } } : prev
            );
        } else if (name === "recipients.roles") {
            setFormData((prev) =>
                prev
                    ? {
                        ...prev,
                        recipients: { ...prev.recipients, roles: value.split(",").map((r) => r.trim()) },
                    }
                    : prev
            );
        } else if (name === "recipients.userIDs") {
            setFormData((prev) =>
                prev
                    ? {
                        ...prev,
                        recipients: { ...prev.recipients, userIDs: value.split(",").map((id) => id.trim()) },
                    }
                    : prev
            );
        } else {
            setFormData((prev) => (prev ? { ...prev, [name]: value } : prev));
            if (name === "event" || name === "messageTemplate") {
                setTouched((prev) => ({ ...prev, [name]: true }));
                setFormErrors((prev) => ({
                    ...prev,
                    [name]: name === "event" ? validateEvent(value) : validateMessageTemplate(value),
                }));
            }
        }
    };

    const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (!formData) return;

        const errors = {
            event: validateEvent(formData.event),
            messageTemplate: validateMessageTemplate(formData.messageTemplate),
        };
        setFormErrors(errors);
        setTouched({ event: true, messageTemplate: true });

        if (Object.values(errors).some((error) => error)) {
            setError("Please correct the errors in the form");
            return;
        }

        try {
            const updatedRule = await updateNotificationRule(formData.ruleID, formData);
            setRules((prev) =>
                prev.map((r) => (r.ruleID === updatedRule.ruleID ? updatedRule : r))
            );
            setSelectedRule(updatedRule);
            setError("Notification rule updated successfully");
            setView("notifications");
        } catch (err: unknown) {
            console.error("Failed to update notification rule:", err);
            setError("Failed to update notification rule");
        }
    };

    const handleDelete = async () => {
        if (!formData || !window.confirm("Are you sure you want to delete this notification rule?")) return;
        try {
            await deleteNotificationRule(formData.ruleID);
            setRules((prev) => prev.filter((r) => r.ruleID !== formData.ruleID));
            setSelectedRule(null);
            setError("Notification rule deleted successfully");
            setView("notifications");
        } catch (err: unknown) {
            console.error("Failed to delete notification rule:", err);
            setError("Failed to delete notification rule");
        }
    };

    const handleCancel = () => {
        setSelectedRule(null);
        setView("notifications");
    };

    if (view !== "notification-rule-details") return null;

    return (
        <motion.div
            className="form-card"
            variants={formVariants}
            initial="hidden"
            animate="visible"
        >
            {loading && <NotificationRuleViewSkeleton />}
            {!loading && (
                <>
                    <h2>Edit Notification Rule</h2>
                    <div className="form-section">
                        <h3 className="form-header">Rule Details</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="event">
                                    Event <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="event"
                                    name="event"
                                    value={formData.event}
                                    onChange={handleChange}
                                    className={`form-input ${touched.event && formErrors.event ? "invalid-vibrate" : ""}`}
                                    required
                                />
                                {touched.event && formErrors.event && (
                                    <span className="validation-error">{formErrors.event}</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="type">Type</label>
                                <select
                                    id="type"
                                    name="type"
                                    value={formData.type}
                                    onChange={handleChange}
                                    className="form-input"
                                >
                                    <option value="general">General</option>
                                    <option value="timesheet">Timesheet</option>
                                    <option value="receipt">Receipt</option>
                                    <option value="visit">Visit</option>
                                    <option value="anomaly">Anomaly</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="channel-toggle">
                                <input
                                    type="checkbox"
                                    name="enabled"
                                    checked={formData.enabled}
                                    onChange={(e) =>
                                        setFormData((prev) => (prev ? { ...prev, enabled: e.target.checked } : prev))
                                    }
                                />
                                <span>Enabled</span>
                            </label>
                        </div>
                    </div>
                    <div className="form-section">
                        <h3 className="form-header">Recipients</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="recipients.roles">Recipient Roles</label>
                                <input
                                    type="text"
                                    id="recipients.roles"
                                    name="recipients.roles"
                                    value={formData.recipients.roles?.join(", ") || ""}
                                    onChange={handleChange}
                                    placeholder="e.g., manager, supervisor"
                                    className="form-input"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="recipients.userIDs">Recipient User IDs</label>
                                <input
                                    type="text"
                                    id="recipients.userIDs"
                                    name="recipients.userIDs"
                                    value={formData.recipients.userIDs?.join(", ") || ""}
                                    onChange={handleChange}
                                    placeholder="e.g., user_123, user_456"
                                    className="form-input"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="form-section">
                        <h3 className="form-header">Channels</h3>
                        <div className="channels-grid">
                            {["websocket", "email", "sms", "inApp"].map((channel) => (
                                <label key={channel} className="channel-toggle">
                                    <input
                                        type="checkbox"
                                        name={channel}
                                        checked={formData.channels[channel]}
                                        onChange={handleChange}
                                    />
                                    <span>{channel.charAt(0).toUpperCase() + channel.slice(1)}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="form-section">
                        <h3 className="form-header">Message</h3>
                        <div className="form-group">
                            <label htmlFor="messageTemplate">
                                Message Template <span className="required">*</span>
                            </label>
                            <textarea
                                id="messageTemplate"
                                name="messageTemplate"
                                value={formData.messageTemplate}
                                onChange={handleChange}
                                className={`form-input ${touched.messageTemplate && formErrors.messageTemplate ? "invalid-vibrate" : ""}`}
                                required
                            />
                            {touched.messageTemplate && formErrors.messageTemplate && (
                                <span className="validation-error">{formErrors.messageTemplate}</span>
                            )}
                        </div>
                    </div>
                    <div className="form-actions-0">
                        <motion.button
                            className="action-button"
                            onClick={handleSubmit}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            aria-label="Save Rule"
                        >
                            <FaSave /> Save
                        </motion.button>
                        <motion.button
                            className="action-button delete-button"
                            onClick={handleDelete}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            aria-label="Delete Rule"
                        >
                            <FaTrash /> Delete
                        </motion.button>
                        <motion.button
                            className="action-button cancel-button"
                            onClick={handleCancel}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            aria-label="Cancel"
                        >
                            <FaTimes /> Cancel
                        </motion.button>
                    </div>
                </>
            )}
        </motion.div>
    );
};

export default NotificationRuleView;
