import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FaEdit, FaTrash, FaPlay, FaStop } from 'react-icons/fa';
import { AIConfig } from '../../../models/AI';
import { deleteAIConfig, testAIConfig, updateAIConfig } from '../../../apis/aiAPI';
import { getUserById } from '../../../apis/userAPI';
import { ViewMode } from '../adminTypes';

interface AIConfigsListProps {
    configs: AIConfig[];
    setConfigs: React.Dispatch<React.SetStateAction<AIConfig[]>>;
    view: ViewMode;
    setView: (view: ViewMode) => void;
    setSelectedConfig: (config: AIConfig | null) => void;
    setError: (error: string | null) => void;
    searchQuery: string;
    sortField: string;
    sortOrder: 'asc' | 'desc';
    currentPage: number;
    setCurrentPage: (page: number) => void;
    itemsPerPage: number;
}

const AIConfigsList: React.FC<AIConfigsListProps> = ({
    configs,
    setConfigs,
    setSelectedConfig,
    setError,
    searchQuery,
    sortField,
    sortOrder,
    currentPage,
    setCurrentPage,
    itemsPerPage,
}) => {
    const { t } = useTranslation();
    const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        modelName: '',
        maxOptimizeRoute: 0,
        timesheetMaxSuggestions: 0,
        supervisorId: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [supervisorNames, setSupervisorNames] = useState<{ [key: string]: string }>({});
    const [isFetching, setIsFetching] = useState(false);
    const [fetchController, setFetchController] = useState<AbortController | null>(null);

    const fetchSupervisorName = useCallback(async (supervisorId: string, controller: AbortController) => {
        if (!supervisorId) {
            setSupervisorNames((prev) => ({ ...prev, [supervisorId || 'global']: 'Global' }));
            return;
        }
        try {
            const user = await getUserById(supervisorId);
            if (!controller.signal.aborted) {
                setSupervisorNames((prev) => ({
                    ...prev,
                    [supervisorId]: `${user.firstname} ${user.lastname}`,
                }));
            }
        } catch (err: any) {
            if (!controller.signal.aborted) {
                setSupervisorNames((prev) => ({ ...prev, [supervisorId]: 'Error' }));
                setError(t('adminDashboard.error.fetchSupervisorFailed') || err.message);
            }
        }
    }, [t, setError]);

    useEffect(() => {
        const controller = new AbortController();
        setFetchController(controller);
        setIsFetching(true);

        const fetchSupervisors = async () => {
            // Always set 'global' for null/empty supervisorId
            setSupervisorNames((prev) => ({ ...prev, ['global']: 'gloable' }));

            const uniqueSupervisorIds = [
                ...new Set(
                    configs
                        .map((c) => c.supervisorId)
                        .filter((id): id is string => typeof id === 'string' && !!id)
                ),
            ];
            for (const id of uniqueSupervisorIds) {
                if (controller.signal.aborted) break;
                await fetchSupervisorName(id, controller);
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
            if (!controller.signal.aborted) {
                setIsFetching(false);
            }
        };

        fetchSupervisors();

        return () => {
            controller.abort();
            setIsFetching(false);
            setFetchController(null);
        };
    }, [configs, fetchSupervisorName]);

    const handleStopFetch = () => {
        if (fetchController) {
            fetchController.abort();
            setIsFetching(false);
            setFetchController(null);
        }
    };

    const handleEditClick = (config: AIConfig) => {
        setEditingConfigId(config.configID);
        setEditForm({
            modelName: config.modelName,
            maxOptimizeRoute: config.maxOptimizeRoute,
            timesheetMaxSuggestions: config.timesheetMaxSuggestions,
            supervisorId: config.supervisorId || '',
        });
    };

    const handleEditChange = (field: string, value: string | number) => {
        setEditForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleEditSubmit = async (configID: string) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const updatedConfig = await updateAIConfig(configID, {
                modelName: editForm.modelName,
                maxOptimizeRoute: editForm.maxOptimizeRoute,
                timesheetMaxSuggestions: editForm.timesheetMaxSuggestions,
            });
            setConfigs(configs.map((c) => (c.configID === configID ? updatedConfig : c)));
            setEditingConfigId(null);
            setError(null);
        } catch (err: any) {
            setError(t('adminDashboard.error.updateAIConfigFailed') || err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingConfigId(null);
    };

    const handleDelete = async (configID: string) => {
        if (!window.confirm(t('adminDashboard.actions.deleteConfirm'))) return;
        try {
            await deleteAIConfig(configID);
            setConfigs(configs.filter((config) => config.configID !== configID));
            setError(null);
        } catch (err: any) {
            setError(t('adminDashboard.error.deleteAIConfigFailed') || err.message);
        }
    };

    const handleTest = async (configID: string) => {
        try {
            const testResult = await testAIConfig(configID);
            alert(
                t('adminDashboard.actions.testResult', {
                    result: typeof testResult === 'string' ? testResult : JSON.stringify(testResult, null, 2),
                })
            );
            setError(null);
        } catch (err: any) {
            setError(t('adminDashboard.error.testAIConfigFailed') || err.message);
        }
    };

    const filteredConfigs = configs
        .filter((config) =>
            config.modelName.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            const aValue = a[sortField as keyof AIConfig] || '';
            const bValue = b[sortField as keyof AIConfig] || '';
            return sortOrder === 'asc'
                ? String(aValue).localeCompare(String(bValue))
                : String(bValue).localeCompare(String(aValue));
        });

    const totalPages = Math.ceil(filteredConfigs.length / itemsPerPage);
    const paginatedConfigs = filteredConfigs.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="table-card">
            <h2>{t('adminDashboard.sidebar.aiConfigs')}</h2>
            <div className="table-container">
                <div className="table-head">
                    <div className="table-row table-row-55">
                        <div className="table-cell">{t('adminDashboard.aiConfigs.modelName')}</div>
                        <div className="table-cell">{t('adminDashboard.aiConfigs.maxOptimizeRoute')}</div>
                        <div className="table-cell">{t('adminDashboard.aiConfigs.timesheetMaxSuggestions')}</div>
                        <div className="table-cell">{t('adminDashboard.aiConfigs.supervisor')}</div>
                        <div className="table-cell">{t('adminDashboard.aiConfigs.actions')}</div>
                    </div>
                </div>
                <div className="table-body">
                    {paginatedConfigs.map((config) => (
                        <div className="table-row table-row-55" key={config.configID}>
                            {editingConfigId === config.configID ? (
                                <>
                                    <div className="table-cell">
                                        <input
                                            type="text"
                                            value={editForm.modelName}
                                            onChange={(e) => handleEditChange('modelName', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="table-cell">
                                        <input
                                            type="number"
                                            min="0"
                                            value={editForm.maxOptimizeRoute}
                                            onChange={(e) => handleEditChange('maxOptimizeRoute', parseInt(e.target.value))}
                                            required
                                        />
                                    </div>
                                    <div className="table-cell">
                                        <input
                                            type="number"
                                            min="0"
                                            value={editForm.timesheetMaxSuggestions}
                                            onChange={(e) => handleEditChange('timesheetMaxSuggestions', parseInt(e.target.value))}
                                            required
                                        />
                                    </div>
                                    <div className="table-cell">
                                        <span>{supervisorNames[config.supervisorId || 'global'] || 'Loading...'}</span>
                                    </div>
                                    <div className="table-cell actions">
                                        <button
                                            onClick={() => handleEditSubmit(config.configID)}
                                            className="action-button-0 action-button-55"
                                            disabled={isSubmitting}
                                            aria-label={t('adminDashboard.actions.aria.save', { name: config.modelName })}
                                        >
                                            {isSubmitting ? t('adminDashboard.actions.submitting') : t('adminDashboard.actions.save')}
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            className="action-button-0 action-button-55"
                                            disabled={isSubmitting}
                                            aria-label={t('adminDashboard.actions.aria.cancel', { name: config.modelName })}
                                        >
                                            {t('adminDashboard.actions.cancel')}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="table-cell">{config.modelName}</div>
                                    <div className="table-cell">{config.maxOptimizeRoute}</div>
                                    <div className="table-cell">{config.timesheetMaxSuggestions}</div>
                                    <div className="table-cell">
                                        {supervisorNames[config.supervisorId || 'global'] || 'Loading...'}
                                    </div>
                                    <div className="table-cell actions">
                                        <button
                                            onClick={() => handleEditClick(config)}
                                            className="action-button-0 action-button-55"
                                            aria-label={t('adminDashboard.actions.aria.edit', { name: config.modelName })}
                                        >
                                            <FaEdit aria-hidden="true" /> {t('adminDashboard.actions.edit')}
                                        </button>
                                        <button
                                            onClick={() => handleTest(config.configID)}
                                            className="action-button-0 action-button-55"
                                            aria-label={t('adminDashboard.actions.aria.test', { name: config.modelName })}
                                        >
                                            <FaPlay aria-hidden="true" /> {t('adminDashboard.actions.test')}
                                        </button>
                                        <button
                                            onClick={() => handleDelete(config.configID)}
                                            className="action-button-0 action-button-55"
                                            aria-label={t('adminDashboard.actions.aria.delete', { name: config.modelName })}
                                        >
                                            <FaTrash aria-hidden="true" /> {t('adminDashboard.actions.delete')}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="pagination">
                <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label={t('adminDashboard.pagination.aria.previous')}
                >
                    {t('adminDashboard.pagination.previous')}
                </button>
                <span>
                    {t('adminDashboard.pagination.page', { page: currentPage, total: totalPages })}
                </span>
                <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label={t('adminDashboard.pagination.aria.next')}
                >
                    {t('adminDashboard.pagination.next')}
                </button>
                {isFetching && (
                    <button
                        onClick={handleStopFetch}
                        className="action-button-0 action-button-55"
                        aria-label={t('adminDashboard.actions.aria.stopFetch')}
                    >
                        <FaStop aria-hidden="true" /> {t('adminDashboard.actions.stopFetch')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default AIConfigsList;