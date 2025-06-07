import React, { useEffect, useRef } from 'react';
import { FaSync } from 'react-icons/fa';
import { useNotification } from '../../context/NotificationContext';
import NotificationItem from './notification';
import { cn } from '../../lib/utils';
import './notification.css';
import { FixedSizeList } from 'react-window';
import { getNotifications } from '../../apis/notificationAPI';

interface NotificationPanelProps {
    className?: string;
    onClose?: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ className, onClose }) => {
    const { notifications, mergeNotifications, markAllAsRead } = useNotification();
    const panelRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [page, setPage] = React.useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node) && onClose) onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const filteredNotifications = notifications
        .filter((n) => n.status !== 'read' && n.channel === 'in-app')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const paginatedNotifications = filteredNotifications.slice(0, page * itemsPerPage);
    const unreadCount = filteredNotifications.length;

    const handleRefresh = async () => {
        setIsLoading(true);
        try {
            const fetchedNotifications = await getNotifications();
            mergeNotifications(fetchedNotifications);
            setPage(1);
        } catch (error) {
            console.error('Failed to refresh notifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllAsRead();
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const loadMore = () => {
        if (paginatedNotifications.length < filteredNotifications.length) {
            setPage((prev) => prev + 1);
        }
    };

    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
        <div style={style}>
            <NotificationItem
                notification={paginatedNotifications[index]}
                onClose={onClose}
            />
        </div>
    );

    return (
        <div ref={panelRef} className={cn('notification-panel', className)} onClick={(e) => e.stopPropagation()}>
            <div className="notification-panel-header">
                <h2>
                    Notifications {unreadCount > 0 && <span className="unread-count">{unreadCount}</span>}
                </h2>
                <div className="notification-panel-controls">
                    <button onClick={handleRefresh} className="control-button" disabled={isLoading}>
                        <FaSync className={cn(isLoading && 'spinning')} />
                    </button>
                    <button onClick={handleMarkAllRead} className="control-button" disabled={isLoading || unreadCount === 0}>
                        Clear
                    </button>
                </div>
            </div>
            {isLoading && (
                <div className="notification-skeleton">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="skeleton-item pulsing" />
                    ))}
                </div>
            )}
            {!isLoading && paginatedNotifications.length === 0 ? (
                <p className="no-notifications">No unread notifications</p>
            ) : (
                <FixedSizeList
                    height={550}
                    width="100%"
                    itemCount={paginatedNotifications.length}
                    itemSize={62}
                    onItemsRendered={({ visibleStopIndex }) => {
                        if (visibleStopIndex >= paginatedNotifications.length - 1) loadMore();
                    }}
                >
                    {Row}
                </FixedSizeList>
            )}
        </div>
    );
};

export default NotificationPanel;