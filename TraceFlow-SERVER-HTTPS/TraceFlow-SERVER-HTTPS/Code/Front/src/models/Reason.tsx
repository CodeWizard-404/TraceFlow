interface Reason {
    reasonID: string;
    item: string;
}

interface VisitReason extends Reason {
    VisitReasons?: {
        visitID: string;
        reasonID: string;
    };
}

export type { Reason, VisitReason };