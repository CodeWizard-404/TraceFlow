import React, { useState, useEffect, useCallback, useMemo, useRef, ReactNode, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { FaBook, FaHistory, FaArchive, FaUser, FaFilter, FaMapMarkerAlt, FaUsers, FaFileAlt, FaPaperPlane } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useTranslation } from 'react-i18next';
import receiptBookAPI from '../../apis/receiptBookAPI';
import locationAPI from '../../apis/locationApi';
import ReceiptBook from '../../models/ReceiptBook';
import ReceiptBookType from '../../models/ReceiptBookType';
import ReceiptBookTransfer from '../../models/ReceiptBookTransfer';
import User from '../../models/User';
import Governorate from '../../models/Governorate';
import Region from '../../models/Region';
import './StockManagerDashboard.css';

// Error Boundary Component
interface ErrorBoundaryProps {
    children: ReactNode;
    fallback: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

// Constants
const COLORS = ['#4cb1c7', '#f5a800', '#036318', '#930744', '#8b8b8b', '#ff6b6b', '#4b0082'];

const StockManagerDashboard: React.FC = () => {
    const { user, effectivePermissions } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const isFetching = useRef(false); // Track fetch status

    // State
    const [receiptBooks, setReceiptBooks] = useState<ReceiptBook[]>([]);
    const [bookTypes, setBookTypes] = useState<ReceiptBookType[]>([]);
    const [holders, setHolders] = useState<User[]>([]);
    const [transfers, setTransfers] = useState<ReceiptBookTransfer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);

    // Permissions
    const permissions = useMemo(() => ({
        canView: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOKS),
        canViewHistory: effectivePermissions?.some(p => p.name === import.meta.env.VITE_PERMISSIONS_ACCESS_RECEIPT_BOOK_HISTORY),
    }), [effectivePermissions]);

    // Fetch Data
    const fetchData = useCallback(async () => {
        if (!user || !permissions.canView || isFetching.current) return;
        isFetching.current = true;
        setIsLoading(true);
        setError(null);

        try {
            // Fetch receipt books
            const booksResponse = await receiptBookAPI.getAllReceiptBooks(1, 1000, 'number', 'ASC', '', 'all', 'all').catch(err => {
                console.error('Failed to fetch receipt books:', err);
                return { books: [] };
            });
            const books = booksResponse.books || [];
            setReceiptBooks(books);
            console.log('Receipt Books:', books);

            // Fetch book types
            const types = await receiptBookAPI.getAllReceiptBookTypes().catch(err => {
                console.error('Failed to fetch book types:', err);
                return [];
            });
            setBookTypes(types);
            console.log('Book Types:', types);

            // Fetch holders
            const holders = await receiptBookAPI.getReceiptBookHolders().catch(err => {
                console.error('Failed to fetch holders:', err);
                return [];
            });
            setHolders(holders);
            console.log('Holders:', holders);

            // Fetch transfer history (batch if possible)
            const transferPromises = books.map((book: ReceiptBook) =>
                receiptBookAPI.getTransferHistory(book.bookID).catch(err => {
                    console.error(`Failed to fetch transfer history for book ${book.bookID}:`, err);
                    return [];
                })
            );
            const transferResults = await Promise.all(transferPromises);
            const transfers = transferResults.flat();
            setTransfers(transfers);
            console.log('Transfers:', transfers);

            // Fetch governorates
            const govResponse = await locationAPI.getAllGovernorates().catch(err => {
                console.error('Failed to fetch governorates:', err);
                return [];
            });
            setGovernorates(govResponse || []);
            console.log('Governorates:', govResponse);

            // Fetch regions
            const regionResponse = await locationAPI.getAllRegions().catch(err => {
                console.error('Failed to fetch regions:', err);
                return [];
            });
            setRegions(regionResponse || []);
            console.log('Regions:', regionResponse);

        } catch (err) {
            console.error('fetchData error:', err);
            setError(t('stockManagerDashboard.errors.fetchFailed'));
        } finally {
            setIsLoading(false);
            isFetching.current = false;
        }
    }, [user, permissions.canView, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Chart Data
    const bookStatusData = useMemo(() => {
        const statusCounts = receiptBooks.reduce((acc, book) => {
            const status = book.status || 'Unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    }, [receiptBooks]);

    const bookTypeData = useMemo(() => {
        const typeCounts = receiptBooks.reduce((acc, book) => {
            const typeName = bookTypes.find(t => t.typeID === book.typeID)?.name || 'Unknown';
            acc[typeName] = (acc[typeName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(typeCounts).map(([name, count]) => ({ name, count }));
    }, [receiptBooks, bookTypes]);

    const transferActivityData = useMemo(() => {
        const transfersByDate = transfers.reduce((acc, transfer) => {
            const date = new Date(transfer.transferDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(transfersByDate)
            .map(([date, transfers]) => ({ date, transfers }))
            .sort((a, b) => new Date(`2025-06-15 ${a.date}`).getTime() - new Date(`2025-06-15 ${b.date}`).getTime());
    }, [transfers]);

    const holderRoleData = useMemo(() => {
        const roleCounts = receiptBooks.reduce((acc, book) => {
            const holder = holders.find(h => h.userID === book.currentHolderID);
            const role = holder?.Roles?.[0]?.name || 'Agent';
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(roleCounts).map(([name, value]) => ({ name, value }));
    }, [receiptBooks, holders]);

    const regionData = useMemo(() => {
        const booksByRegion = receiptBooks.reduce((acc, book) => {
            const agent = book.agentID ? holders.find(h => h.userID === book.agentID) : null;
            const delegation = agent?.Delegations?.[0];
            const governorateID = delegation?.governorateID || 'Unknown';
            const governorate = governorates.find(g => g.governorateID === governorateID);
            const regionName = regions.find(r => r.regionID === governorate?.regionID)?.name || 'Unknown';
            acc[regionName] = (acc[regionName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(booksByRegion).map(([name, count]) => ({ name, count }));
    }, [receiptBooks, holders, governorates, regions]);

    const transferStatusData = useMemo(() => {
        const statusCounts = transfers.reduce((acc, transfer) => {
            const status = transfer.status || 'Unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    }, [transfers]);

    const holderActivityData = useMemo(() => {
        const transfersByHolder = transfers.reduce((acc, transfer) => {
            const holder = holders.find(h => h.userID === transfer.fromUserID || h.userID === transfer.toUserID);
            const holderName = holder ? `${holder.firstname} ${holder.lastname}` : 'Unknown';
            acc[holderName] = (acc[holderName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(transfersByHolder).map(([name, count]) => ({ name, count }));
    }, [transfers, holders]);

    // Stats for Cards
    const stats = useMemo(() => ({
        totalBooks: receiptBooks.length,
        archivedBooks: receiptBooks.filter(b => b.status === 'Archived').length,
        transfers: transfers.length,
        bookTypes: bookTypes.length,
        booksByRegion: regionData.length,
        activeHolders: holders.length,
        pendingStubs: receiptBooks.filter(b => b.ReceiptStub?.status === 'pending').length,
        sentToSupplier: receiptBooks.filter(b => b.status === 'Sent to Supplier').length,
    }), [receiptBooks, transfers, bookTypes, regionData, holders]);

    // Recent Activity
    const recentActivity = useMemo(() => {
        const recentTransfers = transfers
            .slice()
            .sort((a, b) => new Date(b.transferDate).getTime() - new Date(a.transferDate).getTime())
            .slice(0, 3)
            .map(transfer => ({
                type: 'Transfer',
                description: `Book #${receiptBooks.find(b => b.bookID === transfer.bookID)?.number || 'Unknown'} to Supplier (${transfer.status})`,
                timestamp: transfer.transferDate,
            }));
        return recentTransfers;
    }, [transfers, receiptBooks]);

    // Skeleton Loader
    if (isLoading) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="dashboard-container supervisor-container"
            >
                <header className="dashboard-header dashboard-header-1">
                    <div className="header-top">
                        <div className="header-left">
                            <div className="custom-skeleton pulsing" style={{ width: '200px', height: '30px' }} />
                        </div>
                        <div className="user-profile">
                            <div className="custom-skeleton pulsing" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                            <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', marginLeft: '10px' }} />
                        </div>
                    </div>
                    <div className="header-stats">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="stat-card">
                                <div className="custom-skeleton pulsing" style={{ width: '40px', height: '40px', margin: '10px' }} />
                                <div className="stat-content">
                                    <div className="custom-skeleton pulsing" style={{ width: '100px', height: '20px', margin: '5px 0' }} />
                                    <div className="custom-skeleton pulsing" style={{ width: '60px', height: '30px', margin: '5px 0' }} />
                                    <div className="custom-skeleton pulsing" style={{ width: '120px', height: '15px', margin: '5px 0' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </header>
                <div className="dashboard-grid">
                    <section className="dashboard-card">
                        <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                        <hr />
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="custom-skeleton pulsing" style={{ width: '100%', height: '80px', margin: '10px 0' }} />
                        ))}
                    </section>
                    <section className="dashboard-card large-card">
                        <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                        <hr />
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="custom-skeleton pulsing" style={{ width: '100%', height: '80px', margin: '10px 0' }} />
                        ))}
                    </section>
                    <section className="dashboard-card full-width-card">
                        <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                        <hr />
                        <div className="chart-grid chart-grid-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="chart-container">
                                    <div className="custom-skeleton pulsing" style={{ width: '300px', height: '300px', margin: '10px 0' }} />
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="dashboard-card full-width-card">
                        <div className="custom-skeleton pulsing" style={{ width: '150px', height: '25px', margin: '10px 0' }} />
                        <hr />
                        <div className="chart-grid chart-grid-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="chart-container">
                                    <div className="custom-skeleton pulsing" style={{ width: '300px', height: '300px', margin: '10px 0' }} />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="dashboard-container supervisor-container"
        >
            <header className="dashboard-header dashboard-header-1">
                <div className="header-top">
                    <div className="header-left">
                        <h1>{t('stockManagerDashboard.title')}</h1>
                    </div>
                    <div className="user-profile">
                        <FaUser className="user-icon" />
                        <span>{`${user?.firstname} ${user?.lastname}`}</span>
                    </div>
                </div>
                <div className="header-stats">
                    <div className="stat-card">
                        <FaBook className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('stockManagerDashboard.totalBooks')}</h3>
                            <p className="stat-value">{stats.totalBooks}</p>
                            <p className="stat-description">{t('stockManagerDashboard.totalBooksDesc')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaArchive className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('stockManagerDashboard.archivedBooks')}</h3>
                            <p className="stat-value">{stats.archivedBooks}</p>
                            <p className="stat-description">{t('stockManagerDashboard.archivedBooksDesc')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaPaperPlane className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('stockManagerDashboard.transfers')}</h3>
                            <p className="stat-value">{stats.transfers}</p>
                            <p className="stat-description">{t('stockManagerDashboard.transfersDesc')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaFilter className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('stockManagerDashboard.bookTypes')}</h3>
                            <p className="stat-value">{stats.bookTypes}</p>
                            <p className="stat-description">{t('stockManagerDashboard.bookTypesDesc')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaMapMarkerAlt className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('stockManagerDashboard.booksByRegion')}</h3>
                            <p className="stat-value">{stats.booksByRegion}</p>
                            <p className="stat-description">{t('stockManagerDashboard.booksByRegionDesc')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaUsers className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('stockManagerDashboard.activeHolders')}</h3>
                            <p className="stat-value">{stats.activeHolders}</p>
                            <p className="stat-description">{t('stockManagerDashboard.activeHoldersDesc')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaFileAlt className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('stockManagerDashboard.pendingStubs')}</h3>
                            <p className="stat-value">{stats.pendingStubs}</p>
                            <p className="stat-description">{t('stockManagerDashboard.pendingStubsDesc')}</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <FaPaperPlane className="card-icon" />
                        <div className="stat-content">
                            <h3>{t('stockManagerDashboard.sentToSupplier')}</h3>
                            <p className="stat-value">{stats.sentToSupplier}</p>
                            <p className="stat-description">{t('stockManagerDashboard.sentToSupplierDesc')}</p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="dashboard-grid">
                <ErrorBoundary fallback={<div className="dashboard-card"><p className="error-text">{t('stockManagerDashboard.errors.recentActivity')}</p></div>}>
                    <section className="dashboard-card">
                        <h2><FaHistory /> {t('stockManagerDashboard.recentActivity')}</h2>
                        <hr />
                        <div className="card-content">
                            {recentActivity.length === 0 ? (
                                <p className="no-data">{t('stockManagerDashboard.noActivity')}</p>
                            ) : (
                                <div className="activity-list">
                                    {recentActivity.map((activity, index) => (
                                        <div key={index} className="activity-card">
                                            <div className="activity-details">
                                                <p><strong>{activity.type}</strong></p>
                                                <p>{activity.description}</p>
                                                <p className="timestamp">{new Date(activity.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </ErrorBoundary>

                <ErrorBoundary fallback={<div className="dashboard-card large-card"><p className="error-text">{t('stockManagerDashboard.errors.bookSummary')}</p></div>}>
                    <section className="dashboard-card large-card">
                        <h2><FaBook /> {t('stockManagerDashboard.bookSummary')}</h2>
                        <hr />
                        <div className="card-content">
                            <div className="summary-grid">
                                {bookStatusData.map((status, index) => (
                                    <div key={index} className="summary-card">
                                        <div className="summary-details">
                                            <p><strong>{status.name}</strong></p>
                                            <p className="summary-value">{status.value}</p>
                                        </div>
                                    </div>
                                ))}
                                {bookTypeData.map((type, index) => (
                                    <div key={index} className="summary-card">
                                        <div className="summary-details">
                                            <p><strong>{type.name}</strong></p>
                                            <p className="summary-value">{type.count}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </ErrorBoundary>

                <ErrorBoundary fallback={<div className="dashboard-card full-width-card"><p className="error-text">{t('stockManagerDashboard.errors.charts')}</p></div>}>
                    <section className="dashboard-card full-width-card">
                        <h2><FaFilter /> {t('stockManagerDashboard.bookCharts')}</h2>
                        <hr />
                        <div className="card-content">
                            <div className="chart-grid chart-grid-4">
                                {bookStatusData.length > 0 ? (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.bookStatus')}</h3>
                                        <PieChart width={250} height={300}>
                                            <Pie data={bookStatusData} cx={120} cy={120} labelLine={false} outerRadius={80} dataKey="value">
                                                {bookStatusData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </div>
                                ) : (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.bookStatus')}</h3>
                                        <p className="no-data">{t('stockManagerDashboard.noBooks')}</p>
                                    </div>
                                )}
                                {bookTypeData.length > 0 ? (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.bookTypes')}</h3>
                                        <BarChart width={500} height={300} data={bookTypeData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="count" fill="#4cb1c7" />
                                        </BarChart>
                                    </div>
                                ) : (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.bookTypes')}</h3>
                                        <p className="no-data">{t('stockManagerDashboard.noBooks')}</p>
                                    </div>
                                )}
                                {holderRoleData.length > 0 ? (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.holderRoles')}</h3>
                                        <PieChart width={250} height={300}>
                                            <Pie data={holderRoleData} cx={120} cy={120} innerRadius={60} outerRadius={80} dataKey="value">
                                                {holderRoleData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </div>
                                ) : (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.holderRoles')}</h3>
                                        <p className="no-data">{t('stockManagerDashboard.noBooks')}</p>
                                    </div>
                                )}
                                {regionData.length > 0 ? (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.booksByRegion')}</h3>
                                        <BarChart width={500} height={300} data={regionData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="count" fill="#036318" />
                                        </BarChart>
                                    </div>
                                ) : (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.booksByRegion')}</h3>
                                        <p className="no-data">{t('stockManagerDashboard.noBooks')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </ErrorBoundary>

                <ErrorBoundary fallback={<div className="dashboard-card full-width-card"><p className="error-text">{t('stockManagerDashboard.errors.transferCharts')}</p></div>}>
                    <section className="dashboard-card full-width-card">
                        <h2><FaHistory /> {t('stockManagerDashboard.transferCharts')}</h2>
                        <hr />
                        <div className="card-content">
                            <div className="chart-grid chart-grid-4">
                                {transferActivityData.length > 0 ? (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.transferActivity')}</h3>
                                        <LineChart width={500} height={300} data={transferActivityData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Line type="monotone" dataKey="transfers" stroke="#4cb1c7" />
                                        </LineChart>
                                    </div>
                                ) : (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.transferActivity')}</h3>
                                        <p className="no-data">{t('stockManagerDashboard.noTransfers')}</p>
                                    </div>
                                )}
                                {transferStatusData.length > 0 ? (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.transferStatus')}</h3>
                                        <PieChart width={250} height={300}>
                                            <Pie data={transferStatusData} cx={120} cy={120} labelLine={false} outerRadius={80} dataKey="value">
                                                {transferStatusData.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </div>
                                ) : (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.transferStatus')}</h3>
                                        <p className="no-data">{t('stockManagerDashboard.noTransfers')}</p>
                                    </div>
                                )}
                                {holderActivityData.length > 0 ? (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.holderActivity')}</h3>
                                        <BarChart width={500} height={300} data={holderActivityData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="count" fill="#930744" />
                                        </BarChart>
                                    </div>
                                ) : (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.holderActivity')}</h3>
                                        <p className="no-data">{t('stockManagerDashboard.noTransfers')}</p>
                                    </div>
                                )}
                                {transferStatusData.length > 0 ? (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.transferStatusSummary')}</h3>
                                        <div className="summary-grid">
                                            {transferStatusData.map((status, index) => (
                                                <div key={index} className="summary-card">
                                                    <div className="summary-details">
                                                        <p><strong>{status.name}</strong></p>
                                                        <p className="summary-value">{status.value}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="chart-container">
                                        <h3>{t('stockManagerDashboard.transferStatusSummary')}</h3>
                                        <p className="no-data">{t('stockManagerDashboard.noTransfers')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </ErrorBoundary>
            </div>

            {error && <p className="error-text">{error}</p>}
        </motion.div>
    );
};

export default StockManagerDashboard;