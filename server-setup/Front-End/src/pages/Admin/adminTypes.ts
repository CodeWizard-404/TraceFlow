export type ViewMode =
    | "users"
    | "roles"
    | "permissions"
    | "add-user"
    | "add-role"
    | "add-permission"
    | "user-details"
    | "checklists"
    | "add-checklist"
    | "checklist-details"
    | "reasons"
    | "add-reason"
    | "reason-details";

export type SortField = "name" | "email" | "role" | "item";
export type SortOrder = "asc" | "desc";