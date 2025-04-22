import React, { useState, useEffect } from 'react';
import { FaSave, FaTrash } from 'react-icons/fa';
import { motion } from 'framer-motion';
import Select, { MultiValue } from 'react-select';
import NotificationRule from '../../../models/NotificationRule';
import { updateNotificationRule, deleteNotificationRule, getNotificationRules } from '../../../apis/notificationAPI';
import { getAllUsers } from '../../../apis/userAPI';
import { getAllRoles } from '../../../apis/roleAPI';
import { ViewMode } from '../adminTypes';
import User from '../../../models/User';
import Role from '../../../models/Role';
import '../AdminDashboard.css';

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
        <div className="custom-skeleton pulsing" style={{ width: '200px', height: '24px', marginBottom: '16px' }} />
        {[...Array(4)].map((_, i) => (
            <div key={i} className="form-section">
                <div className="custom-skeleton pulsing" style={{ width: '150px', height: '20px', marginBottom: '12px' }} />
                <div className="form-row">
                    <div className="custom-skeleton pulsing" style={{ width: '100%', height: '32px' }} />
                    <div className="custom-skeleton pulsing" style={{ width: '100%', height: '32px' }} />
                </div>
            </div>
        ))}
        <div className="form-actions-0">
            <div className="custom-skeleton pulsing" style={{ width: '120px', height: '40px' }} />
            <div className="custom-skeleton pulsing" style={{ width: '120px', height: '40px' }} />
        </div>
    </div>
);

const NotificationRuleView: React.FC<NotificationRuleViewProps> = ({
    selectedRule,
    setSelectedRule,
    setRules,
    setView,
    setError,
    view,
}) => {
    const [formData, setFormData] = useState<NotificationRule | null>(selectedRule);
    const [formErrors, setFormErrors] = useState({ event: '', messageTemplate: '' });
    const [touched, setTouched] = useState({ event: false, messageTemplate: false });
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [notificationTypes, setNotificationTypes] = useState<string[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<{ value: string; label: string }[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<{ value: string; label: string }[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [usersData, rolesData, rulesData] = await Promise.all([
                    getAllUsers(),
                    getAllRoles(),
                    getNotificationRules(),
                ]);
                setUsers(usersData || []);
                setRoles(rolesData || []);
                const types = [...new Set(rulesData.map((rule) => rule.type.toLowerCase()))].filter(
                    (type): type is string => !!type
                );
                setNotificationTypes(['general', ...types]);
                if (selectedRule) {
                    setSelectedUsers(
                        selectedRule.recipients.userIDs?.map((id) => {
                            const user = usersData.find((u) => u.userID === id);
                            return {
                                value: id,
                                label: user ? `${user.firstname} ${user.lastname} (${user.phone})` : id,
                            };
                        }) || []
                    );
                    setSelectedRoles(
                        selectedRule.recipients.roles?.map((name) => ({
                            value: name,
                            label: name,
                        })) || []
                    );
                }
            } catch (err) {
                setError('Failed to fetch data');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(() => fetchData(), SKELETON_DELAY);
        return () => clearTimeout(timer);
    }, [selectedRule, setError]);

    useEffect(() => {
        setFormData(selectedRule);
    }, [selectedRule]);

    if (!formData) return null;

    const validateEvent = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return 'Event is required';
        if (!/^[a-zA-Z]+:[a-zA-Z]+$/.test(trimmed)) return "Event must be in format 'type:action' (e.g., user:created)";
        return '';
    };

    const validateMessageTemplate = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return 'Message template is required';
        if (trimmed.length < 5) return 'Message template must be at least 5 characters';
        return '';
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData((prev) =>
                prev ? { ...prev, channels: { ...prev.channels, [name]: checked } } : prev
            );
        } else if (name === 'event' || name === 'type' || name === 'messageTemplate') {
            setFormData((prev) => (prev ? { ...prev, [name]: value } : prev));
            if (name === 'event' || name === 'messageTemplate') {
                setTouched((prev) => ({ ...prev, [name]: true }));
                setFormErrors((prev) => ({
                    ...prev,
                    [name]: name === 'event' ? validateEvent(value) : validateMessageTemplate(value),
                }));
            }
        }
    };

    const handleUserSelect = (selectedOptions: MultiValue<{ value: string; label: string }>) => {
        setSelectedUsers(
            Array.isArray(selectedOptions)
                ? selectedOptions.map((option) => ({ value: option.value, label: option.label }))
                : []
        );
        const userIDs = selectedOptions.map((option) => option.value);
        setFormData((prev) =>
            prev ? { ...prev, recipients: { ...prev.recipients, userIDs } } : prev
        );
    };

    const handleRoleSelect = (selectedOptions: MultiValue<{ value: string; label: string }>) => {
        setSelectedRoles(
            Array.isArray(selectedOptions)
                ? selectedOptions.map((option) => ({ value: option.value, label: option.label }))
                : []
        );
        const roles = selectedOptions.map((option) => option.value);
        setFormData((prev) =>
            prev ? { ...prev, recipients: { ...prev.recipients, roles } } : prev
        );
    };

    const userOptions = users.map((user) => ({
        value: user.userID,
        label: `${user.firstname} ${user.lastname} (${user.phone})`,
    }));

    const roleOptions = roles.map((role) => ({
        value: role.name,
        label: role.name,
    }));

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
            setError('Please correct the errors in the form');
            return;
        }

        try {
            const updatedRule = await updateNotificationRule(formData.ruleID, formData);
            setRules((prev) =>
                prev.map((r) => (r.ruleID === updatedRule.ruleID ? updatedRule : r))
            );
            setSelectedRule(updatedRule);
            setError('Notification rule updated successfully');
            setView('notifications');
        } catch (err: unknown) {
            console.error('Failed to update notification rule:', err);
            setError('Failed to update notification rule');
        }
    };

    const handleDelete = async () => {
        if (!formData || !window.confirm('Are you sure you want to delete this notification rule?')) return;
        try {
            await deleteNotificationRule(formData.ruleID);
            setRules((prev) => prev.filter((r) => r.ruleID !== formData.ruleID));
            setSelectedRule(null);
            setError('Notification rule deleted successfully');
            setView('notifications');
        } catch (err: unknown) {
            console.error('Failed to delete notification rule:', err);
            setError('Failed to delete notification rule');
        }
    };

    if (view !== 'notification-rule-details') return null;

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
                    <div className="form-header-container">
                        <h2>Edit Notification Rule</h2>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                name="enabled"
                                checked={formData.enabled}
                                onChange={(e) =>
                                    setFormData((prev) => (prev ? { ...prev, enabled: e.target.checked } : prev))
                                }
                            />
                            <span className="slider"></span>
                            <span>{formData.enabled ? 'Enabled' : 'Disabled'}</span>
                        </label>
                    </div>
                    <div className="form-section">
                        <h3 className="form-header">Rule Details</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="event">
                                    Event <span className="required">*</span>
                                    <span className="tooltip" data-tooltip="Unique event name"></span>
                                </label>
                                <input
                                    type="text"
                                    id="event"
                                    name="event"
                                    value={formData.event}
                                    onChange={handleChange}
                                    className={`form-input ${touched.event && formErrors.event ? 'invalid' : ''}`}
                                    required
                                />
                                {touched.event && formErrors.event && (
                                    <span className="validation-error">{formErrors.event}</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="type">
                                    Type
                                    <span className="tooltip" data-tooltip="Select the category of the notification"></span>
                                </label>
                                <select
                                    id="type"
                                    name="type"
                                    value={formData.type}
                                    onChange={handleChange}
                                    className="form-input"
                                >
                                    {notificationTypes.map((type) => (
                                        <option key={type} value={type}>
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="form-section">
                        <h3 className="form-header">Recipients</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="recipients.roles">
                                    Recipient Roles
                                    <span className="tooltip" data-tooltip="Select roles that will receive this notification"></span>
                                </label>
                                <Select
                                    isMulti
                                    options={roleOptions}
                                    value={selectedRoles}
                                    onChange={handleRoleSelect}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select roles..."
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="recipients.userIDs">
                                    Recipient Users
                                    <span className="tooltip" data-tooltip="Select specific users to receive this notification"></span>
                                </label>
                                <Select
                                    isMulti
                                    options={userOptions}
                                    value={selectedUsers}
                                    onChange={handleUserSelect}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                    placeholder="Select users..."
                                />
                            </div>
                        </div>
                    </div>
                    <div className="form-section">
                        <h3 className="form-header">Channels</h3>
                        <div className="channels-grid">
                            {(['websocket', 'email', 'sms', 'inApp'] as Array<keyof typeof formData.channels>).map((channel) => (
                                <label key={channel} className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        name={channel}
                                        checked={formData.channels[channel]}
                                        onChange={handleChange}
                                    />
                                    <span className="slider"></span>
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
                                <span className="tooltip" data-tooltip="Notification message content"></span>
                            </label>
                            <textarea
                                id="messageTemplate"
                                name="messageTemplate"
                                value={formData.messageTemplate}
                                onChange={handleChange}
                                className={`form-input ${touched.messageTemplate && formErrors.messageTemplate ? 'invalid' : ''}`}
                                required
                            />
                            {touched.messageTemplate && formErrors.messageTemplate && (
                                <span className="validation-error">{formErrors.messageTemplate}</span>
                            )}
                        </div>
                    </div>
                    <div className="form-actions-0">
                        <motion.button
                            className="action-button save-button"
                            onClick={handleSubmit}
                            whileHover={{ scale: 1.05, boxShadow: '0 0 8px rgba(76, 177, 199, 0.5)' }}
                            whileTap={{ scale: 0.95 }}
                            aria-label="Save Rule"
                        >
                            <FaSave /> Save
                        </motion.button>
                        <motion.button
                            className="action-button delete-button"
                            onClick={handleDelete}
                            whileHover={{ scale: 1.05, boxShadow: '0 0 8px rgba(232, 31, 118, 0.5)' }}
                            whileTap={{ scale: 0.95 }}
                            aria-label="Delete Rule"
                        >
                            <FaTrash /> Delete
                        </motion.button>
                    </div>
                </>
            )}
        </motion.div>
    );
};

export default NotificationRuleView;