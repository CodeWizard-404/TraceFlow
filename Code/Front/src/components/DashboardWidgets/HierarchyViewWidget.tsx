import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    getSupervisorsByRegionalManager,
    getRegionalManagersByDirector,
    getUsersByRegion,
    getUsersByGovernorate,
    getUsersByDelegation,
} from '../../apis/userAPI';
import User from '../../models/User';

interface HierarchyNode {
    user: User;
    role: 'Director' | 'Regional Manager' | 'Supervisor' | 'Agent';
    subordinates: HierarchyNode[];
}

const HierarchyViewWidget: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    const hasPermission = effectivePermissions?.some(
        (p) => p.name === import.meta.env.VITE_PERMISSIONS_READ_HIERARCHY
    );

    const toggleNode = (userID: string) => {
        setExpandedNodes((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(userID)) {
                newSet.delete(userID);
            } else {
                newSet.add(userID);
            }
            return newSet;
        });
    };

    useEffect(() => {
        const fetchHierarchy = async () => {
            if (!user || !hasPermission) {
                setError('Permission denied');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const hierarchyData: HierarchyNode[] = [];
                const userId = user.userID;

                // Determine user role based on Roles array
                let userRole: 'Director' | 'Regional Manager' | 'Supervisor' = 'Supervisor';
                if (user.Roles?.some((role) => role.name.includes('Director'))) {
                    userRole = 'Director';
                } else if (user.Roles?.some((role) => role.name.includes('Regional Manager'))) {
                    userRole = 'Regional Manager';
                }

                if (userRole === 'Director') {
                    const regionalManagers = await getRegionalManagersByDirector(userId);
                    const regionalManagerNodes = await Promise.all(
                        regionalManagers.map(async (rm) => {
                            const supervisors = await getSupervisorsByRegionalManager(rm.userID);
                            return {
                                user: rm,
                                role: 'Regional Manager' as const,
                                subordinates: supervisors.map((sup) => ({
                                    user: sup,
                                    role: 'Supervisor' as const,
                                    subordinates: [],
                                })),
                            };
                        })
                    );
                    hierarchyData.push({
                        user,
                        role: 'Director' as const,
                        subordinates: regionalManagerNodes,
                    });
                } else if (userRole === 'Regional Manager') {
                    const supervisors = await getSupervisorsByRegionalManager(userId);
                    hierarchyData.push({
                        user,
                        role: 'Regional Manager' as const,
                        subordinates: supervisors.map((sup) => ({
                            user: sup,
                            role: 'Supervisor' as const,
                            subordinates: [],
                        })),
                    });
                } else {
                    const regions = user.Regions || [];
                    const governorates = user.Governorates || [];
                    const delegations = user.Delegations || [];

                    const subordinates: HierarchyNode[] = [];
                    if (regions.length > 0) {
                        const regionUsers = await Promise.all(
                            regions.map(async (region) => {
                                const users = await getUsersByRegion(region.regionID);
                                return users.map((u) => ({
                                    user: u,
                                    role: 'Supervisor' as const,
                                    subordinates: [],
                                }));
                            })
                        );
                        subordinates.push(...regionUsers.flat());
                    }
                    if (governorates.length > 0) {
                        const govUsers = await Promise.all(
                            governorates.map(async (gov) => {
                                const users = await getUsersByGovernorate(gov.governorateID);
                                return users.map((u) => ({
                                    user: u,
                                    role: 'Supervisor' as const,
                                    subordinates: [],
                                }));
                            })
                        );
                        subordinates.push(...govUsers.flat());
                    }
                    if (delegations.length > 0) {
                        const delUsers = await Promise.all(
                            delegations.map(async (del) => {
                                const users = await getUsersByDelegation(del.delegationID);
                                return users.map((u) => ({
                                    user: u,
                                    role: 'Agent' as const,
                                    subordinates: [],
                                }));
                            })
                        );
                        subordinates.push(...delUsers.flat());
                    }
                    hierarchyData.push({
                        user,
                        role: 'Supervisor' as const,
                        subordinates,
                    });
                }

                setHierarchy(hierarchyData);
            } catch (err) {
                setError('Failed to fetch hierarchy data');
            } finally {
                setLoading(false);
            }
        };

        fetchHierarchy();
    }, [user, hasPermission]);

    if (!hasPermission) return null;
    if (loading) return <div className="p-4 text-gray-600">Loading hierarchy...</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    const renderHierarchy = (nodes: HierarchyNode[], depth = 0) => {
        return (
            <ul className={depth === 0 ? '' : 'ml-6'}>
                {nodes.map((node) => (
                    <li key={node.user.userID} className="my-2">
                        <div className="flex items-center">
                            {node.subordinates.length > 0 && (
                                <button
                                    onClick={() => toggleNode(node.user.userID)}
                                    className="mr-2 text-gray-600 hover:text-gray-800"
                                >
                                    {expandedNodes.has(node.user.userID) ? '▼' : '▶'}
                                </button>
                            )}
                            <span className="font-semibold text-gray-800">
                                {node.user.firstname} {node.user.lastname}
                            </span>
                            <span className="ml-2 text-sm text-gray-500">({node.role})</span>
                        </div>
                        {node.subordinates.length > 0 && expandedNodes.has(node.user.userID) && (
                            renderHierarchy(node.subordinates, depth + 1)
                        )}
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div className="widget-content p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Organizational Hierarchy</h2>
            {hierarchy.length === 0 ? (
                <p className="text-gray-600">No hierarchy data available.</p>
            ) : (
                renderHierarchy(hierarchy)
            )}
        </div>
    );
};

export default HierarchyViewWidget;