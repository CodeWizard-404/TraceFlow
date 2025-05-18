/**
 * SkeletonComponents.tsx
 * Reusable skeleton loading components for AdminDashboard.
 * Matches AdminDashboard.css styles for consistent UI.
 */

import React from "react";
import "../AdminDashboard.css";

// SkeletonForm for add forms
export const SkeletonForm: React.FC = () => (
    <div className="form-card add-form">
        <div className="form-section">
            <div className="custom-skeleton pulsing" style={{ width: "200px", height: "24px" }} />
            <div className="form-content">
                <div className="form-group">
                    <div className="custom-skeleton pulsing" style={{ width: "100px", height: "20px" }} />
                    <div className="custom-skeleton pulsing" style={{ width: "100%", height: "40px" }} />
                </div>
                <div className="custom-skeleton pulsing" style={{ width: "150px", height: "40px" }} />
            </div>
        </div>
    </div>
);

// SkeletonDetails for view components
export const SkeletonDetails: React.FC = () => (
    <div className="details-card">
        <div className="card-header">
            <div className="custom-skeleton pulsing" style={{ width: "300px", height: "32px" }} />
            <div className="actions">
                <div className="custom-skeleton pulsing" style={{ width: "100px", height: "40px" }} />
                <div className="custom-skeleton pulsing" style={{ width: "100px", height: "40px" }} />
            </div>
        </div>
    </div>
);

// SkeletonList for list components
export const SkeletonList: React.FC<{ rows: number }> = ({ rows }) => (
    <div className="hover-reveal-list">
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="list-item-wrapper">
                <div className="list-item">
                    <div className="custom-skeleton pulsing" style={{ width: "80%", height: "20px" }} />
                    <div className="item-actions">
                        <div className="custom-skeleton pulsing" style={{ width: "40px", height: "40px" }} />
                        <div className="custom-skeleton pulsing" style={{ width: "40px", height: "40px" }} />
                    </div>
                </div>
            </div>
        ))}
    </div>
);