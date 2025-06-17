import React, { useEffect, useRef, useState } from 'react';
import { FaSync } from 'react-icons/fa';
import { useNotification } from '../../context/NotificationContext';
import NotificationItem from './notification';
import { cn } from '../../lib/utils';
import './notification.css';
import { FixedSizeList } from 'react-window';
import { useTranslation } from 'react-i18next';

interface NotificationPanelProps {
    className?: string;
    onClose?: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ className, onClose }) => {
    const { notifications, mergeNotifications, markAllAsRead, refreshNotifications, unreadCount } = useNotification();
    const { t } = useTranslation();
    const panelRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
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

    const handleRefresh = async () => {
        setIsLoading(true);
        try {
            await refreshNotifications();
        } catch (error) {
            console.error('Failed to refresh notifications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMarkAllRead = async () => {
        setIsLoading(true);
        try {
            await markAllAsRead();
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadMore = () => {
        if (paginatedNotifications.length < filteredNotifications.length) {
            setPage((prev) => prev + 1);
        }
    };

    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
        <div style={style}>
            <NotificationItem notification={paginatedNotifications[index]} />
        </div>
    );

    return (
        <div ref={panelRef} className={cn('notification-panel', className)} onClick={(e) => e.stopPropagation()}>
            <div className="notification-panel-header">
                <h2>
                    {t('notification.header')} {unreadCount > 0 && <span className="unread-count">{unreadCount}</span>}
                </h2>
                <div className="notification-panel-controls">
                    <button
                        onClick={handleRefresh}
                        className="control-button"
                        disabled={isLoading}
                        aria-label={isLoading ? t('notification.loading') : t('notification.refresh')}
                    >
                        <FaSync className={cn(isLoading && 'spinning')} />
                    </button>
                    <button
                        onClick={handleMarkAllRead}
                        className="control-button"
                        disabled={isLoading || unreadCount === 0}
                        aria-label={t('notification.clearAll')}
                    >
                        {t('notification.clearAll')}
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
                <p className="no-notifications">{t('notification.noUnread')}</p>
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