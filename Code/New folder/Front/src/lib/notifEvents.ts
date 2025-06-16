import { getNotificationRules } from '../apis/notificationAPI';
import NotificationRule from '../models/NotificationRule';

// Default notification events for all entities and actions
// Note: WebSocket notifications are always enabled for these events and are not controlled by user preferences or notification rules.
const DEFAULT_EVENTS: string[] = [
    // User events
    'user:created',
    'user:updated',
    'user:profile_updated',
    'user:deleted',
    'user:regional_manager_assigned',
    'user:regional_manager_revoked',
    'user:director_assigned',
    'user:director_revoked',
    'user:supervisor_assigned_to_agent',
    'user:supervisor_revoked_from_agent',
    'user:regions_assigned',
    'user:regions_revoked',
    'user:governorates_assigned',
    'user:governorates_revoked',
    'user:delegations_assigned',
    'user:delegations_revoked',
    // Role events
    'role:created',
    'role:updated',
    'role:deleted',
    'role:assigned',
    'role:revoked',
    // Permission events
    'permission:updated',
    'permission:assigned',
    'permission:revoked',
    // Timesheet events
    'timesheet:created',
    'timesheet:validated',
    // Visit events
    'visit:updated',
    'visit:deleted',
    'visit:logged',
    // Checklist events
    'checklist:created',
    'checklist:updated',
    'checklist:deleted',
    // Reason events
    'reason:created',
    'reason:updated',
    'reason:deleted',
    // Receipt Book events
    'receipt_book_type:created',
    'receipt_book_type:updated',
    'receipt_book_type:deleted',
    'receipt_book:created',
    'receipt_book:sent',
    'receipt_book:transferred',
    'receipt_book:collected',
    'receipt_book:updated',
    'receipt_book:deleted',
    'receipt_book:csv_uploaded',
    'receipt_stub:archived',
    // CSV events
    'csv-header:updated',
    // Agent events
    'agent:created',
    'agent:updated',
    'agent:deleted',
    'agent:csv_uploaded',
    'agent:location_corrected',
    // report events
    'report:generated',
    'report:generated',
    'report:scheduled',
    'report_schedule:deleted',
    'report:deleted',
    // Notification events
    'notification_rule:created',
    'notification-rule:updated',
    'notification_rule:deleted',
    'notification_prefrences:updated',
    'notification:anomaly_triggered',
    'notification:report_triggered',
    // AI events
    'ai_config:deleted',
    'ai_config:updated',
    'ai_config:created',
    'ai:anomaly_detected',
    'ai:report_generated',
    // Logs events
    'logs:deleted',
    'logs:archived',
    'logs:cleared',

];

// Default notification types corresponding to entities and general
const DEFAULT_TYPES: string[] = [
    'general',
    'anomaly',
    'urgent',
    'info',
    'user',
    'role',
    'permission',
    'timesheet',
    'visit',
    'checklist',
    'reason',
    'receipt_book',
    'receipt_stub',
    'csv-heade',
    'agent',
    'notification',
    'notification_rule',
    'notification_prefrences',
    'report',
    'report_schedule',
    'logs',
    'ai_config',
    'ai',
];

// Cache for notification events and types to reduce API calls
let cachedEvents: string[] | null = null;
let cachedTypes: string[] | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let lastCacheTime: number = 0;

// Fetch notification events and types from backend
const fetchNotificationData = async (effectivePermissions: string[] = []): Promise<{ events: string[]; types: string[] }> => {
    try {
        const canReadNotificationRules = effectivePermissions.some(
            (p) => p === import.meta.env.VITE_PERMISSIONS_VIEW_NOTIFICATION_RULES
        );

        let rules: NotificationRule[];
        if (canReadNotificationRules) {
            rules = await getNotificationRules();
        } else {
            rules = [];
        }
        console.log('Fetched notification rules:', {
            rules: rules.map(r => ({ event: r.event, type: r.type })),
            timestamp: new Date().toISOString(),
        });

        // Extract unique event strings from notification rules
        const dynamicEvents = [...new Set(rules.map((rule) => rule.event))].filter(
            (event): event is string => !!event
        );
        // Extract unique type strings from notification rules
        const dynamicTypes = [...new Set(rules.map((rule) => rule.type.toLowerCase()))].filter(
            (type): type is string => !!type
        );
        // Combine default and dynamic events/types, ensuring uniqueness
        const events = [...new Set([...DEFAULT_EVENTS, ...dynamicEvents])];
        const types = [...new Set([...DEFAULT_TYPES, ...dynamicTypes])];
        console.log('Combined notification events and types:', {
            events,
            types,
            timestamp: new Date().toISOString(),
        });
        return { events, types };
    } catch (error) {
        console.error('Failed to fetch notification data:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        });
        // Return default events and types if API call fails
        return {
            events: [...DEFAULT_EVENTS],
            types: [...DEFAULT_TYPES],
        };
    }
};

// Get all valid notification events, using cache if available
export const getNotificationEvents = async (effectivePermissions: string[] = []): Promise<string[]> => {
    if (cachedEvents && cachedTypes && Date.now() - lastCacheTime < CACHE_DURATION) {
        console.log('Returning cached notification events:', {
            events: cachedEvents,
            timestamp: new Date().toISOString(),
        });
        return cachedEvents;
    }

    const { events, types } = await fetchNotificationData(effectivePermissions);
    cachedEvents = events;
    cachedTypes = types;
    lastCacheTime = Date.now();
    console.log('Cached new notification events:', {
        events,
        timestamp: new Date().toISOString(),
    });
    return cachedEvents;
};

// Get all valid notification types, using cache if available
export const getNotificationTypes = async (effectivePermissions: string[] = []): Promise<string[]> => {
    if (cachedEvents && cachedTypes && Date.now() - lastCacheTime < CACHE_DURATION) {
        return cachedTypes;
    }

    const { events, types } = await fetchNotificationData(effectivePermissions);
    cachedEvents = events;
    cachedTypes = types;
    lastCacheTime = Date.now();
    return cachedTypes;
};

// Type for all possible notification events
export type NotificationEvent = string;

// Utility to get events for a specific entity (based on event prefix)
export const getEntityEvents = async (entity: string, effectivePermissions: string[] = []): Promise<NotificationEvent[]> => {
    const events = await getNotificationEvents(effectivePermissions);
    return events.filter((event) => event.startsWith(`${entity}:`));
};

// Utility to check if an event is valid
export const isValidNotificationEvent = async (event: string, effectivePermissions: string[] = []): Promise<boolean> => {
    const events = await getNotificationEvents(effectivePermissions);
    return events.includes(event);
};

// Utility to get all entities
export const getNotificationEntities = async (effectivePermissions: string[] = []): Promise<string[]> => {
    const events = await getNotificationEvents(effectivePermissions);
    const entities = [...new Set(events.map((event) => event.split(':')[0]))];
    return entities;
};

// Utility to get actions for a specific entity
export const getEntityActions = async (entity: string, effectivePermissions: string[] = []): Promise<string[]> => {
    const events = await getEntityEvents(entity, effectivePermissions);
    return events.map((event) => event.split(':')[1]);
};