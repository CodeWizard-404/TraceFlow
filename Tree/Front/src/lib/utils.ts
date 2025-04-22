import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Notification from '../models/Notification';
import { getNotificationRules } from '../apis/notificationAPI';

// Combine class names using clsx and tailwind-merge
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a notification message using a template and data
export function formatNotificationMessage(template: string, data: Record<string, unknown>): string {
  return template.replace(/{(\w+)}/g, (_, key) => String(data[key] || ''));
}

// Cache for notification types
let cachedTypes: string[] | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let lastCacheTime: number = 0;

// Fetch notification types from backend
const fetchNotificationTypes = async (): Promise<string[]> => {
  try {
    const rules = await getNotificationRules();
    const types = [...new Set(rules.map((rule) => rule.type.toLowerCase()))].filter(
      (type): type is string => !!type
    );
    return types;
  } catch (error) {
    console.error('Failed to fetch notification types:', error);
    return ['general']; // Fallback to 'general' if API fails
  }
};

// Get notification types, using cache if available
const getNotificationTypes = async (): Promise<string[]> => {
  if (cachedTypes && Date.now() - lastCacheTime < CACHE_DURATION) {
    return cachedTypes;
  }

  cachedTypes = await fetchNotificationTypes();
  lastCacheTime = Date.now();
  return cachedTypes;
};

// Map notification type to a display color class
export const getNotificationTypeClass = async (type: Notification['type']): Promise<string> => {
  const types = await getNotificationTypes();
  const typeColors: Record<string, string> = types.reduce((acc, t) => {
    const hue = (types.indexOf(t) * 137.5) % 360; // Generate distinct hues
    return { ...acc, [t]: `bg-[hsl(${hue},70%,50%)] text-white` };
  }, {
    general: 'bg-gray-500 text-white',
    info: 'bg-blue-500 text-white',
    otp: 'bg-purple-500 text-white',
  });

  return typeColors[type.toLowerCase()] || 'bg-gray-500 text-white';
};
