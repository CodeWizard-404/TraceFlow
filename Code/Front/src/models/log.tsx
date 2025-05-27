export interface Log {
    logID: string;
    ip?: string;
    route: string;
    service: string;
    status?: number;
    level: 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'trace';
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
    message: string;
    url?: string;
    userId?: string;
    metadata?: Record<string, any>;
    traceId: string;
    timestamp: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
}