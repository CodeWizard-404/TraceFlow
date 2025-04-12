import React, { JSX, useState } from "react";
import "./AdminDashboard.css";

interface InfoPopupProps {
    isOpen: boolean;
    onClose: () => void;
    contentRenderer: () => JSX.Element;
}

const InfoPopup: React.FC<InfoPopupProps> = ({
    isOpen,
    onClose,
    contentRenderer,
}) => {
    const [isFadingOut, setIsFadingOut] = useState(false);

    const handleClose = () => {
        setIsFadingOut(true);
        setTimeout(() => {
            onClose();
            setIsFadingOut(false);
        }, 300);
    };

    if (!isOpen) return null;

    return (
        <div
            className={`role-info-popup-overlay ${isFadingOut ? "fade-out" : "fade-in"}`}
            onClick={handleClose}
        >
            <div className="role-info-popup" onClick={(e) => e.stopPropagation()}>
                {contentRenderer()}
            </div>
        </div>
    );
};

export default InfoPopup;