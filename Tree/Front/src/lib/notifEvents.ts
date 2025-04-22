// notifEvents.ts
// Centralized definitions for WebSocket notification events, dynamically derived from admin-defined notification rules

import { getNotificationRules } from '../apis/notificationAPI';
import NotificationRule from '../models/NotificationRule';

// Cache for notification events to reduce API calls
let cachedEvents: string[] | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let lastCacheTime: number = 0;

// Fetch notification events from backend
const fetchNotificationEvents = async (): Promise<string[]> => {
    try {
        const rules: NotificationRule[] = await getNotificationRules();
        // Extract unique event strings from notification rules
        const events = [...new Set(rules.map((rule) => rule.event))].filter(
            (event): event is string => !!event
        );
        return events;
    } catch (error) {
        console.error('Failed to fetch notification events:', error);
        return [];
    }
};

// Get all valid notification events, using cache if available
export const getNotificationEvents = async (): Promise<string[]> => {
    if (
        cachedEvents &&
        Date.now() - lastCacheTime < CACHE_DURATION
    ) {
        return cachedEvents;
    }

    cachedEvents = await fetchNotificationEvents();
    lastCacheTime = Date.now();
    return cachedEvents;
};

// Type for all possible notification events
export type NotificationEvent = string;

// Utility to get events for a specific entity (based on event prefix)
export const getEntityEvents = async (entity: string): Promise<NotificationEvent[]> => {
    const events = await getNotificationEvents();
    return events.filter((event) => event.startsWith(`${entity}:`));
};

// Utility to check if an event is valid
export const isValidNotificationEvent = async (event: string): Promise<boolean> => {
    const events = await getNotificationEvents();
    return events.includes(event);
};
