import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { suggestTimesheet } from '../../apis/timesheetAPI';

const AISuggestionsWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_AI_SUGGESTIONS
    );

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }

            try {
                // Get current week number and year
                const today = new Date();
                const startOfYear = new Date(today.getFullYear(), 0, 1);
                const pastDaysOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
                const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

                // Define the required parameters for suggestTimesheet
                const timesheetData = {
                    supervisorId: user.userID,
                    weekNumber: weekNumber,
                    year: today.getFullYear(),
                    criteria: {
                        // Add optional criteria as needed
                        delegationIds: [], // Example: Provide if available
                        agentIds: [], // Example: Provide if available
                        preferredDays: [], // Example: ['Monday', 'Tuesday']
                        timeInterval: { startHour: 9, endHour: 17 }, // Example time interval
                        maxVisitsPerAgentPerWeek: 10, // Example value
                        includeRecruitmentVisits: false, // Example
                        recruitmentAreas: [], // Example
                        description: '', // Optional description
                        filters: {}, // Optional filters
                    },
                    coordinates: {
                        lat: 0, // Replace with actual latitude if available
                        lng: 0, // Replace with actual longitude if available
                    },
                };

                const response = await suggestTimesheet(timesheetData);
                setSuggestions(response.suggestions || []);
            } catch (err) {
                setError('Failed to fetch AI suggestions');
            } finally {
                setLoading(false);
            }
        };
        fetchSuggestions();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div>Loading suggestions...</div>;
    if (error) return <div>{error}</div>;

    return (
        <div className="widget-content">
            <h2>AI Suggestions</h2>
            {suggestions.length === 0 ? (
                <p>No suggestions available.</p>
            ) : (
                <ul>
                    {suggestions.map((sug, index) => (
                        <li key={index}>{sug.description || 'No description available'}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default AISuggestionsWidget;