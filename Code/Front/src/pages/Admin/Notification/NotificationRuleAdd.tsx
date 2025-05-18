import React, { useState, useEffect, useRef } from 'react';
import { FaSave } from 'react-icons/fa';
import { motion } from 'framer-motion';
import Select, { MultiValue, SingleValue } from 'react-select';
import NotificationRule from '../../../models/NotificationRule';
import { createNotificationRule } from '../../../apis/notificationAPI';
import { getAllUsers } from '../../../apis/userAPI';
import { getAllRoles } from '../../../apis/roleAPI';
import { ViewMode } from '../adminTypes';
import '../AdminDashboard.css';
import User from '../../../models/User';
import Role from '../../../models/Role';
import { isValidNotificationEvent, getNotificationEntities, getEntityActions, getNotificationTypes } from '../../../lib/notifEvents';

interface NotificationRuleAddProps {
    rules: NotificationRule[];
    setRules: React.Dispatch<React.SetStateAction<NotificationRule[]>>;
    view: ViewMode;
    setView: React.Dispatch<React.SetStateAction<ViewMode>>;
    setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const SKELETON_DELAY = 500;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
        channels: { email: false, sms: false, inApp: true },
        messageTemplate: '',
        enabled: true,
    });
    const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
    const [selectedAction, setSelectedAction] = useState<string | null>(null);
    const [formErrors, setFormErrors] = useState({ event: '', messageTemplate: '' });
    const [touched, setTouched] = useState({ event: false, messageTemplate: false });
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [notificationTypes, setNotificationTypes] = useState<string[]>([]);
    const [entities, setEntities] = useState<string[]>([]);
    const [entityActions, setEntityActions] = useState<Record<string, string[]>>({});
    const [selectedUsers, setSelectedUsers] = useState<{ value: string; label: string }[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<{ value: string; label: string }[]>([]);

    // Cache for entities, actions, and types
    const cachedEntities = useRef<string[] | null>(null);
    const cachedEntityActions = useRef<Record<string, string[]> | null>(null);
    const cachedTypes = useRef<string[] | null>(null);
    const lastCacheTime = useRef<number>(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [usersData, rolesData, entitiesData, typesData] = await Promise.all([
                    getAllUsers(),
                    getAllRoles(),
                    getNotificationEntities(),
                    getNotificationTypes(),
                ]);
                setUsers(usersData || []);
                setRoles(rolesData || []);
                setNotificationTypes(typesData || []);

                // Set entities and actions
                if (
                    !cachedEntities.current ||
                    !cachedEntityActions.current ||
                    !cachedTypes.current ||
                    Date.now() - lastCacheTime.current >= CACHE_DURATION
                ) {
                    cachedEntities.current = entitiesData;
                    cachedTypes.current = typesData;
                    const actionMap: Record<string, string[]> = {};
                    for (const entity of entitiesData) {
                        actionMap[entity] = await getEntityActions(entity);
                    }
                    cachedEntityActions.current = actionMap;
                    lastCacheTime.current = Date.now();
                }
                setEntities(cachedEntities.current || []);
                setEntityActions(cachedEntityActions.current || {});
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

    const validateEvent = async (entity: string | null, action: string | null): Promise<string> => {
        if (!entity) return 'Entity is required';
        if (!action) return 'Action is required';
        const event = `${entity}:${action}`;
        const isValid = await isValidNotificationEvent(event);
        if (isValid) return 'Event already exists; it will reuse existing rules';
        return '';
    };

    const validateMessageTemplate = (value: string): string => {
        const trimmed = value.trim();
        if (!trimmed) return 'Message template is required';
        if (trimmed.length < 5) return 'Message template must be at least 5 characters';
        return '';
    };

    const handleEntityChange = async (
        option: SingleValue<{ value: string; label: string }>
    ) => {
        const entity = option ? option.value : null;
        setSelectedEntity(entity);
        setSelectedAction(null); // Reset action when entity changes
        const event = entity && selectedAction ? `${entity}:${selectedAction}` : '';
        setFormData((prev) => ({ ...prev, event }));
        setTouched((prev) => ({ ...prev, event: true }));
        const error = await validateEvent(entity, selectedAction);
        setFormErrors((prev) => ({ ...prev, event: error }));
    };

    const handleActionChange = async (
        option: SingleValue<{ value: string; label: string }>
    ) => {
        const action = option ? option.value : null;
        setSelectedAction(action);
        const event = selectedEntity && action ? `${selectedEntity}:${action}` : '';
        setFormData((prev) => ({ ...prev, event }));
        setTouched((prev) => ({ ...prev, event: true }));
        const error = await validateEvent(selectedEntity, action);
        setFormErrors((prev) => ({ ...prev, event: error }));
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData((prev) => ({
                ...prev,
                channels: {
                    email: prev.channels?.email ?? false,
                    sms: prev.channels?.sms ?? false,
                    inApp: prev.channels?.inApp ?? false,
                    [name]: checked,
                },
            }));
        } else if (name === 'type' || name === 'messageTemplate') {
            setFormData((prev) => ({ ...prev, [name]: value }));
            if (name === 'messageTemplate') {
                setTouched((prev) => ({ ...prev, messageTemplate: true }));
                setFormErrors((prev) => ({
                    ...prev,
                    messageTemplate: validateMessageTemplate(value),
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

    const entityOptions = entities.map((entity) => ({
        value: entity,
        label: entity.charAt(0).toUpperCase() + entity.slice(1),
    }));

    const actionOptions = selectedEntity
        ? (entityActions[selectedEntity] || []).map((action) => ({
            value: action,
            label: action.charAt(0).toUpperCase() + action.slice(1),
        }))
        : [];

    const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        const errors = {
            event: await validateEvent(selectedEntity, selectedAction),
            messageTemplate: validateMessageTemplate(formData.messageTemplate || ''),
        };
        setFormErrors(errors);
        setTouched({ event: true, messageTemplate: true });

        if (
            Object.values(errors).some(
                (error) => error && error !== 'Event already exists; it will reuse existing rules'
            )
        ) {
            setError('Please correct the errors in the form');
            return;
        }

        try {
            const newRule = await createNotificationRule({
                ...formData,
                event: selectedEntity && selectedAction ? `${selectedEntity}:${selectedAction}` : '',
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
                                <label htmlFor="entity">
                                    Entity <span className="required">*</span>
                                    <span className="tooltip" data-tooltip="Select the entity type for the event (e.g., user, timesheet)"></span>
                                </label>
                                <Select
                                    id="entity"
                                    options={entityOptions}
                                    value={entityOptions.find((option) => option.value === selectedEntity) || null}
                                    onChange={handleEntityChange}
                                    className={`react-select-container ${touched.event && formErrors.event && !selectedEntity ? 'invalid' : ''}`}
                                    classNamePrefix="react-select"
                                    placeholder="Select entity..."
                                    isClearable
                                />
                                {touched.event && formErrors.event && !selectedEntity && (
                                    <span className="validation-error">{formErrors.event}</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label htmlFor="action">
                                    Action <span className="required">*</span>
                                    <span className="tooltip" data-tooltip="Select the action for the event (e.g., created, updated)"></span>
                                </label>
                                <Select
                                    id="action"
                                    options={actionOptions}
                                    value={actionOptions.find((option) => option.value === selectedAction) || null}
                                    onChange={handleActionChange}
                                    className={`react-select-container ${touched.event && formErrors.event && selectedEntity && !selectedAction ? 'invalid' : ''}`}
                                    classNamePrefix="react-select"
                                    placeholder="Select action..."
                                    isDisabled={!selectedEntity}
                                    isClearable
                                />
                                {touched.event && formErrors.event && selectedEntity && !selectedAction && (
                                    <span className="validation-error">{formErrors.event}</span>
                                )}
                                {touched.event && formErrors.event && selectedEntity && selectedAction && formErrors.event.includes('already exists') && (
                                    <span className="validation-warning">{formErrors.event}</span>
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
                        <p className="info-text">Real-time WebSocket notifications are always enabled and cannot be disabled.</p>
                        <div className="channels-grid">
                            {(['email', 'sms', 'inApp'] as Array<keyof typeof formData.channels>).map((channel: string) => (
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