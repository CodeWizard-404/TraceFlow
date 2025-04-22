import React, { useState, useEffect } from 'react';
import { FaSave } from 'react-icons/fa';
import { motion } from 'framer-motion';
import Select, { MultiValue } from 'react-select';
import NotificationRule from '../../../models/NotificationRule';
import { createNotificationRule } from '../../../apis/notificationAPI';
import { getAllUsers } from '../../../apis/userAPI';
import { getAllRoles } from '../../../apis/roleAPI';
import { getNotificationRules } from '../../../apis/notificationAPI';
import { ViewMode } from '../adminTypes';
import '../AdminDashboard.css';
import User from '../../../models/User';
import Role from '../../../models/Role';
import { isValidNotificationEvent } from '../../../lib/notifEvents';

interface NotificationRuleAddProps {
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

const NotificationRuleAddSkeleton: React.FC = () => (
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
        </div>
    </div>
);

const NotificationRuleAdd: React.FC<NotificationRuleAddProps> = ({
    setRules,
    setView,
    setError,
    view,
}) => {
    const [formData, setFormData] = useState<Partial<NotificationRule>>({
        event: '',
        type: 'general',
        recipients: { roles: [], userIDs: [] },
        channels: { websocket: true, email: false, sms: false, inApp: true },
        messageTemplate: '',
        enabled: true,
    });
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
                // Extract unique notification types
                const types = [...new Set(rulesData.map((rule) => rule.type.toLowerCase()))].filter(
                    (type): type is string => !!type
                );
                setNotificationTypes(['general', ...types]);
            } catch (err) {
                setError('Failed to fetch data');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        const timer = setTimeout(() => fetchData(), SKELETON_DELAY);
        return () => clearTimeout(timer);
    }, [setError]);

    const validateEvent = async (value: string): Promise<string> => {
        const trimmed = value.trim();
        if (!trimmed) return 'Event is required';
        if (!/^[a-zA-Z]+:[a-zA-Z]+$/.test(trimmed)) return "Event must be in format 'type:action' (e.g., user:created)";
        // Optionally, check if event is already defined
        const isValid = await isValidNotificationEvent(trimmed);
        if (isValid) return 'Event already exists; it will reuse existing rules';
        return '';
    };

    const validateMessageTemplate = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return 'Message template is required';
        if (trimmed.length < 5) return 'Message template must be at least 5 characters';
        return '';
    };

    const handleChange = async (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData((prev) => ({
                ...prev,
                channels: {
                    websocket: prev.channels?.websocket ?? false,
                    email: prev.channels?.email ?? false,
                    sms: prev.channels?.sms ?? false,
                    inApp: prev.channels?.inApp ?? false,
                    [name]: checked,
                },
            }));
        } else if (name === 'event' || name === 'type' || name === 'messageTemplate') {
            setFormData((prev) => ({ ...prev, [name]: value }));
            if (name === 'event' || name === 'messageTemplate') {
                setTouched((prev) => ({ ...prev, [name]: true }));
                const error = name === 'event' ? await validateEvent(value) : validateMessageTemplate(value);
                setFormErrors((prev) => ({
                    ...prev,
                    [name]: error,
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
        setFormData((prev) => ({
            ...prev,
            recipients: { ...prev.recipients, userIDs },
        }));
    };

    const handleRoleSelect = (selectedOptions: MultiValue<{ value: string; label: string }>) => {
        setSelectedRoles(
            Array.isArray(selectedOptions)
                ? selectedOptions.map((option) => ({ value: option.value, label: option.label }))
                : []
        );
        const roleNames = selectedOptions.map((option) => option.value);
        setFormData((prev) => ({
            ...prev,
            recipients: { ...prev.recipients, roles: roleNames },
        }));
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
        const errors = {
            event: await validateEvent(formData.event || ''),
            messageTemplate: validateMessageTemplate(formData.messageTemplate || ''),
        };
        setFormErrors(errors);
        setTouched({ event: true, messageTemplate: true });

        if (Object.values(errors).some((error) => error && error !== 'Event already exists; it will reuse existing rules')) {
            setError('Please correct the errors in the form');
            return;
        }

        try {
            const newRule = await createNotificationRule({
                ...formData,
                recipients: {
                    roles: selectedRoles.map((role) => role.value),
                    userIDs: selectedUsers.map((user) => user.value),
                },
            } as NotificationRule);
            setRules((prev) => [...prev, newRule]);
            setError('Notification rule created successfully');
            setView('notifications');
        } catch (err: unknown) {
            console.error('Failed to create notification rule:', err);
            setError('Failed to create notification rule');
        }
    };

    if (view !== 'add-notification-rule') return null;

    return (
        <motion.div
            className="form-card"
            variants={formVariants}
            initial="hidden"
            animate="visible"
        >
            {loading && <NotificationRuleAddSkeleton />}
            {!loading && (
                <>
                    <div className="form-header-container">
                        <h2>Add Notification Rule</h2>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                name="enabled"
                                checked={formData.enabled}
                                onChange={(e) => setFormData((prev) => ({ ...prev, enabled: e.target.checked }))}
                            />
                            <span className="slider"></span>
                            <span>{formData.enabled ? 'Enabled' : 'Disabled'}</span>
                            <span className="tooltip" data-tooltip="Toggle to enable or disable this notification rule"></span>
                        </label>
                    </div>
                    <div className="form-section">
                        <h3 className="form-header">Rule Details</h3>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="event">
                                    Event <span className="required">*</span>
                                    <span className="tooltip" data-tooltip="Enter the event in 'type:action' format (e.g., user:created)"></span>
                                </label>
                                <input
                                    type="text"
                                    id="event"
                                    name="event"
                                    value={formData.event}
                                    onChange={handleChange}
                                    className={`form-input ${touched.event && formErrors.event ? 'invalid' : ''}`}
                                    placeholder="e.g., user:created"
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
                            {(['websocket', 'email', 'sms', 'inApp'] as Array<keyof typeof formData.channels>).map((channel: string) => (
                                <label key={channel} className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        name={channel}
                                        checked={formData.channels?.[channel as keyof typeof formData.channels]}
                                        onChange={handleChange}
                                    />
                                    <span className="slider"></span>
                                    <span>{channel.charAt(0).toUpperCase() + channel.slice(1)}</span>
                                    <span className="tooltip" data-tooltip={`Enable ${channel} notifications`}></span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="form-section">
                        <h3 className="form-header">Message</h3>
                        <div className="form-group">
                            <label htmlFor="messageTemplate">
                                Message Template <span className="required">*</span>
                                <span className="tooltip" data-tooltip="Define the content of the notification message"></span>
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
                    </div>
                </>
            )}
        </motion.div>
    );
};

export default NotificationRuleAdd;
