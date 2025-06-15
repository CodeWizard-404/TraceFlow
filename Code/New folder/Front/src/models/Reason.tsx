interface Reason {
    reasonID: string;
    item: string;
    createdAt: string;
    updatedAt: string;
}

interface VisitReason extends Reason {
    VisitReasons?: {
        visitID: string;
        reasonID: string;
        createdAt: string;
        updatedAt: string;
    };
}

export type { Reason, VisitReason };