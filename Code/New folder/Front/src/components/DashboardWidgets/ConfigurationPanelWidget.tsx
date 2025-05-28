import { useState, useEffect, FC } from 'react';
import { AIConfig } from '../../models/AI';
import { UpdateAIConfigRequest, updateAIConfig, getAIConfig } from '../../apis/aiAPI';
import { useAuth } from '../../context/AuthContext';
import Permission from '../../models/Permission';

interface ConfigurationPanelWidgetProps {
    configId?: string;
}

const ConfigurationPanelWidget: FC<ConfigurationPanelWidgetProps> = ({ configId }) => {
    const { user, effectivePermissions } = useAuth();
    const [config, setConfig] = useState<AIConfig | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (configId) {
            const fetchConfig = async () => {
                setLoading(true);
                try {
                    const response = await getAIConfig({ configID: configId });
                    setConfig(response);
                    setError(null);
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch config';
                    setError(errorMessage);
                } finally {
                    setLoading(false);
                }
            };
            fetchConfig();
        }
    }, [configId]);

    const handleSensitivityChange = (value: number) => {
        if (config) {
            setConfig({ ...config, anomalyThreshold: value });
        }
    };

    const handleUpdateConfig = async () => {
        if (!config || !configId) return;
        setLoading(true);
        try {
            const updateData: UpdateAIConfigRequest = {
                anomalyThreshold: config.anomalyThreshold,
                modelName: config.modelName,
                timesheetMaxSuggestions: config.timesheetMaxSuggestions,
            };
            const updatedConfig = await updateAIConfig(configId, updateData);
            setConfig(updatedConfig);
            setError(null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update config';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const hasPermission = (permissionName: string): boolean => {
        return effectivePermissions?.some((p: Permission) => p.name === permissionName) ?? false;
    };

    if (!hasPermission(import.meta.env.VITE_PERMISSIONS_UPDATE_CONFIG)) return null;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <div className="p-4 bg-white rounded-lg shadow-md">
            {loading ? (
                <p className="text-gray-600">Loading...</p>
            ) : config ? (
                <div>
                    <h2 className="text-xl font-bold mb-4">Configuration Panel</h2>
                    <p className="text-gray-700 mb-2">Logged in as: {user?.email || 'Unknown'}</p>
                    <label className="block mb-2">
                        Sensitivity:
                        <input
                            type="number"
                            value={config.anomalyThreshold}
                            onChange={(e) => handleSensitivityChange(Number(e.target.value))}
                            disabled={!hasPermission(import.meta.env.VITE_PERMISSIONS_UPDATE_CONFIG)}
                            className="ml-2 p-1 border rounded"
                        />
                    </label>
                    <button
                        onClick={handleUpdateConfig}
                        disabled={!hasPermission(import.meta.env.VITE_PERMISSIONS_UPDATE_CONFIG) || loading}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                    >
                        Save Changes
                    </button>
                </div>
            ) : (
                <p className="text-gray-600">No configuration found.</p>
            )}
        </div>
    );
};

export default ConfigurationPanelWidget;