export interface AIConfig {
    configID: string;
    modelName: string;
    maxOptimizeRoute: number;
    timesheetMaxSuggestions: number;
    supervisorId: string | null;
    createdAt: string;
    updatedAt: string;
}
