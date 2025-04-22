export type SortField = "name" | "email" | "role" | "event" | "type" | "enabled";
export type SortOrder = "asc" | "desc";
export type ViewMode =
    | "users"
    | "roles"
    | "permissions"
    | "add-user"
    | "add-role"
    | "add-permission"
    | "user-details"
    | "role-details"
    | "permission-details"
    | "checklists"
    | "add-checklist"
    | "checklist-details"
    | "reasons"
    | "add-reason"
    | "reason-details"
    | "notification-rules"
    | "notification-rule-details"
    | "add-notification-rule"
    | "notifications";