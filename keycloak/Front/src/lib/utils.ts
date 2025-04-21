import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Notification from '../models/Notification';

// Combine class names using clsx and tailwind-merge
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a notification message using a template and data
export function formatNotificationMessage(template: string, data: Record<string, unknown>): string {
  return template.replace(/{(\w+)}/g, (_, key) => String(data[key] || ''));
}

// Map notification type to a display color class
export function getNotificationTypeClass(type: Notification['type']): string {
  const typeClasses: Record<Notification['type'], string> = {
    timesheet: 'bg-blue-500 text-white',
    receipt: 'bg-green-500 text-white',
    visit: 'bg-purple-500 text-white',
    anomaly: 'bg-red-500 text-white',
    general: 'bg-gray-500 text-white',
  };
  return typeClasses[type] || 'bg-gray-500 text-white';
}
