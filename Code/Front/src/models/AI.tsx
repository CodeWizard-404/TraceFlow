export interface AIConfig {
    configID: string;
    modelName: string;
    anomalyThreshold: number;
    timesheetMaxSuggestions: number;
    supervisorId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface TimesheetSuggestion {
    date: string;
    time: string;
    agentID: string | null;
    location: string | null;
    reasons: Array<{ id: string }>;
    checklists: Array<{ id: string }>;
}

export interface Anomaly {
    // Define based on anomaly detection response structure
    id: string;
    description: string;
    confidence: number;
}

export interface Report {
    // Define based on report response structure
    id: string;
    title: string;
    content: string;
}
