import React from 'react';
import Notification from '../../models/Notification';
import ToastNotification from './ToastNotification';
import './notification.css';

interface ToastContainerProps {
    toasts: Notification[];
    onDismiss: (notificationID: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    return (
        <div className="toast-container">
            {toasts.map((notification) => (
                <ToastNotification
                    key={notification.notificationID}
                    notification={notification}
                    onDismiss={onDismiss}
                />
            ))}
        </div>
    );
};

export default ToastContainer;
