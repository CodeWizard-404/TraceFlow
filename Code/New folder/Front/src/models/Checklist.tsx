interface Checklist {
    checklistID: string;
    item: string;
    createdAt: string;
    updatedAt: string;
}

interface VisitChecklist extends Checklist {
    VisitChecklist?: {
        checked: boolean;
        visitID: string;
        checklistID: string;
        createdAt: string;
        updatedAt: string;
    };
}

export type { VisitChecklist, Checklist };