import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { createAIConfig } from '../../../apis/aiAPI';
import { getUsersByRole } from '../../../apis/userAPI';
import { AIConfig } from '../../../models/AI';
import { ViewMode } from '../adminTypes';
import { User } from '../../../models/User';

interface AIConfigAddProps {
    configs: AIConfig[];
    setConfigs: React.Dispatch<React.SetStateAction<AIConfig[]>>;
    view: ViewMode;
    setView: (view: ViewMode) => void;
    setError: (error: string | null) => void;
}

const AIConfigAdd: React.FC<AIConfigAddProps> = ({
    configs,
    setConfigs,
    setView,
    setError,
}) => {
    const { t } = useTranslation();
    const [modelName, setModelName] = useState('');
    const [timesheetMaxSuggestions, setTimesheetMaxSuggestions] = useState(5);
    const [maxOptimizeRoute, setMaxOptimizeRoute] = useState(5);
    const [supervisorId, setSupervisorId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [supervisors, setSupervisors] = useState<User[]>([]);
    const [searchSupervisor, setSearchSupervisor] = useState('');
    const [loadingSupervisors, setLoadingSupervisors] = useState(false);

    useEffect(() => {
        const fetchSupervisors = async () => {
            setLoadingSupervisors(true);
            try {
                const supervisorList = await getUsersByRole(import.meta.env.VITE_ROLES_SUPERVISOR);
                setSupervisors(supervisorList);
                setError(null);
            } catch (err: any) {
                setError(t('adminDashboard.error.fetchSupervisorsFailed') || err.message);
            } finally {
                setLoadingSupervisors(false);
            }
        };
        fetchSupervisors();
    }, [t, setError]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const newConfig = await createAIConfig({
                modelName,
                timesheetMaxSuggestions,
                maxOptimizeRoute,
                supervisorId: supervisorId || undefined,
            });
            setConfigs([...configs, newConfig]);
            setView('ai-configs');
            setError(null);
        } catch (err) {
            setError(t('adminDashboard.error.createAIConfigFailed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredSupervisors = supervisors.filter(
        (user) =>
            `${user.firstname} ${user.lastname}`.toLowerCase().includes(searchSupervisor.toLowerCase()) ||
            user.userID.toLowerCase().includes(searchSupervisor.toLowerCase())
    );

    return (
        <motion.div
            className="ai-config-add form-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <form onSubmit={handleSubmit}>
                <h2>{t('adminDashboard.header.addAIConfig')}</h2>
                <div className="form-group">
                    <label htmlFor="modelName">{t('adminDashboard.aiConfigs.modelName')}</label>
                    <input
                        id="modelName"
                        type="text"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="timesheetMaxSuggestions">{t('adminDashboard.aiConfigs.timesheetMaxSuggestions')}</label>
                    <input
                        id="timesheetMaxSuggestions"
                        type="number"
                        min="0"
                        value={timesheetMaxSuggestions}
                        onChange={(e) => setTimesheetMaxSuggestions(parseInt(e.target.value))}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="maxOptimizeRoute">{t('adminDashboard.aiConfigs.maxOptimizeRoute')}</label>
                    <input
                        id="maxOptimizeRoute"
                        type="number"
                        min="0"
                        value={maxOptimizeRoute}
                        onChange={(e) => setMaxOptimizeRoute(parseInt(e.target.value))}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="supervisorId">{t('adminDashboard.aiConfigs.supervisor')}</label>
                    <div>
                        <input
                            type="text"
                            value={searchSupervisor}
                            onChange={(e) => setSearchSupervisor(e.target.value)}
                            placeholder={t('adminDashboard.aiConfigs.searchSupervisors')}
                            className="search-input"
                            disabled={loadingSupervisors}
                        />
                        <select
                            id="supervisorId"
                            value={supervisorId}
                            onChange={(e) => setSupervisorId(e.target.value)}
                            disabled={loadingSupervisors}
                        >
                            <option value="">{t('adminDashboard.aiConfigs.selectSupervisor')}</option>
                            {filteredSupervisors.map((user) => (
                                <option key={user.userID} value={user.userID}>
                                    {user.firstname} {user.lastname} ({user.phone})
                                </option>
                            ))}
                        </select>
                        {loadingSupervisors && <span>{t('adminDashboard.actions.loading')}</span>}
                    </div>
                </div>
                <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                    className="action-button"
                >
                    {isSubmitting ? t('adminDashboard.actions.submitting') : t('adminDashboard.actions.create')}
                </motion.button>
            </form>
        </motion.div>
    );
};

export default AIConfigAdd;