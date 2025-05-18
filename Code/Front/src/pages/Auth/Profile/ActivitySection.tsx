/**
 * ActivitySection.tsx
 * Component for displaying the user's recent activity list.
 */
import React from "react";
import { FaHistory, FaClock, FaCreditCard, FaCheckCircle } from "react-icons/fa";

const ActivitySection: React.FC = React.memo(() => {
    return (
        <section className="activity-section">
            <h2>Recent Activity</h2>
            <div className="activity-list">
                <div className="activity-item">
                    <FaHistory />
                    <div className="activity-details">
                        <p>Visit Logged</p>
                        <span>April 07, 2025 - 10:45</span>
                        <span className="activity-subtext">
                            Agent: John Doe | Location: Tunis
                        </span>
                    </div>
                    <span className="activity-amount">+1 Visit</span>
                </div>
                <div className="activity-item">
                    <FaClock />
                    <div className="activity-details">
                        <p>Timesheet Submitted</p>
                        <span>April 06, 2025 - 16:20</span>
                        <span className="activity-subtext">Duration: 8h 30m</span>
                    </div>
                    <span className="activity-amount">Pending Approval</span>
                </div>
                <div className="activity-item">
                    <FaCreditCard />
                    <div className="activity-details">
                        <p>Carnet Distributed</p>
                        <span>April 05, 2025 - 09:15</span>
                        <span className="activity-subtext">
                            Carnet ID: #CRN12345 | Agent: Amina K.
                        </span>
                    </div>
                    <span className="activity-amount">+1 Carnet</span>
                </div>
                <div className="activity-item">
                    <FaCheckCircle />
                    <div className="activity-details">
                        <p>Souche Collected</p>
                        <span>April 04, 2025 - 14:00</span>
                        <span className="activity-subtext">
                            Carnet ID: #CRN12345 | Status: Validated
                        </span>
                    </div>
                    <span className="activity-amount">+1 Souche</span>
                </div>
            </div>
        </section>
    );
});

export default ActivitySection;