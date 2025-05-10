interface Checklist {
    checklistID: string;
    item: string;
}

interface VisitChecklist extends Checklist {
    VisitChecklist?: {
        checked: boolean;
        visitID: string;
        checklistID: string;
    };
}

export type { VisitChecklist, Checklist };