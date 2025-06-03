import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { updateAIConfig } from '../../../apis/aiAPI';
import { AIConfig } from '../../../models/AI';
import { ViewMode } from '../adminTypes';

interface AIConfigViewProps {
    selectedConfig: AIConfig | null;
    setSelectedConfig: (config: AIConfig | null) => void;
    configs: AIConfig[];
    setConfigs: React.Dispatch<React.SetStateAction<AIConfig[]>>;
    view: ViewMode;
    setView: (view: ViewMode) => void;
    setError: (error: string | null) => void;
}

const AIConfigView: React.FC<AIConfigViewProps> = ({
    selectedConfig,
    setSelectedConfig,
    configs,
    setConfigs,
    setView,
    setError,
}) => {
    const { t } = useTranslation();
    const [modelName, setModelName] = useState(selectedConfig?.modelName || '');
    const [maxOptimizeRoute, setMaxOptimizeRoute] = useState(selectedConfig?.maxOptimizeRoute || 10);
    const [timesheetMaxSuggestions, setTimesheetMaxSuggestions] = useState(
        selectedConfig?.timesheetMaxSuggestions || 5
    );
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedConfig) return;
        setIsSubmitting(true);
        try {
            const updatedConfig = await updateAIConfig(selectedConfig.configID, {
                modelName,
                maxOptimizeRoute,
                timesheetMaxSuggestions,
            });
            setConfigs(
                configs.map((config) =>
                    config.configID === selectedConfig.configID ? updatedConfig : config
                )
            );
            setSelectedConfig(updatedConfig);
            setView('ai-configs');
            setError(null);
        } catch (err: any) {
            setError(t('adminDashboard.error.updateAIConfigFailed') || err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!selectedConfig) return null;

    return (
        <motion.div
            className="ai-config-view form-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <form onSubmit={handleSubmit}>
                <h2>{t('adminDashboard.header.aiConfigDetails', { modelName: selectedConfig.modelName })}</h2>
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
                    <label htmlFor="maxOptimizeRoute">{t('adminDashboard.aiConfigs.maxOptimizeRoute')}</label>
                    <input
                        id="maxOptimizeRoute"
                        type="number"
                        min="1"
                        value={maxOptimizeRoute}
                        onChange={(e) => setMaxOptimizeRoute(parseInt(e.target.value))}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="timesheetMaxSuggestions">{t('adminDashboard.aiConfigs.timesheetMaxSuggestions')}</label>
                    <input
                        id="timesheetMaxSuggestions"
                        type="number"
                        min="1"
                        value={timesheetMaxSuggestions}
                        onChange={(e) => setTimesheetMaxSuggestions(parseInt(e.target.value))}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>{t('adminDashboard.aiConfigs.supervisorId')}</label>
                    <input
                        type="text"
                        value={selectedConfig.supervisorId || 'Global'}
                        disabled
                    />
                </div>
                <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
                    className="action-button"
                >
                    {isSubmitting ? t('adminDashboard.actions.submitting') : t('adminDashboard.actions.update')}
                </motion.button>
            </form>
        </motion.div>
    );
};

export default AIConfigView;