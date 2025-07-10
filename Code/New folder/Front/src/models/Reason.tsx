interface Reason {
    reasonID: string;
    item: string;
    createdAt: Date;
    updatedAt: Date;
}

interface VisitReason extends Reason {
    VisitReasons?: {
        visitID: string;
        reasonID: string;
    };
}

export type { Reason, VisitReason };