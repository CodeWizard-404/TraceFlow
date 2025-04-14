import Agent from "../models/Agent";
import { Checklist, VisitChecklist } from "../models/Checklist";
import { Reason, VisitReason } from "../models/Reason";
import Timesheet from "../models/Timesheet";
import Visit from "../models/Visit";
import User from "../models/User";
import Role from "../models/Role";
import Permission from "../models/Permission";
import ReceiptBook from "../models/ReceiptBook";
import ReceiptStub from "../models/ReceiptStub";
import ReceiptBookTransfer from "../models/ReceiptBookTransfer";
import UserPermissionOverride from "../models/UserPermissionOverride";

// Error response type for Axios errors
export interface AxiosErrorResponse {
    response?: {
        data?: { error?: string };
        status?: number;
    };
}

export interface LoginResponse {
    requires2FA: boolean;
    accessToken?: string;
    user?: {
        userID: string;
        email: string;
        phone: string;
        roles: Role[];
    };
    userID?: string;
    deviceIdentifier?: string;
    tempToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    message?: string;
}

export interface Verify2FAResponse {
    requires2FA: boolean;
    accessToken?: string;
    user?: {
        userID: string;
        email: string;
        phone: string;
        roles: Role[];
    };
}

export interface InitiatePasswordResetResponse {
    userID: string; // User ID
    message: string; // Success message
}

export interface Resend2FAResponse {
    userID: string; // User ID
    message: string; // Success message
}

export interface VerifyPasswordResetOTPResponse {
    userID: string; // User ID
    tempToken: string; // Temporary token for reset
    message: string; // Success message
}

export interface ResetPasswordResponse {
    message: string; // Success message
}
// Agent API Responses
export type AgentByIdResponse = Agent; // Single agent by ID
export type AgentByPhoneResponse = Agent; // Single agent by phone
export type AgentLocationsResponse = string[]; // List of agent locations
export type AgentsByLocationResponse = Agent[]; // List of agents by location



// Checklist API Responses
export type ChecklistByIdResponse = Checklist; // Single checklist by ID
export type ChecklistsByVisitResponse = VisitChecklist[]; // Checklists for a visit
export type CreateChecklistResponse = Checklist; // Created checklist
export type DeleteChecklistResponse = { message: string }; // Deletion confirmation
export type ListChecklistsResponse = Checklist[]; // List of checklists
export type UpdateChecklistResponse = Checklist; // Updated checklist

// Permission API Responses
export type AddPermissionOverrideResponse = UserPermissionOverride; // Created permission override
export type EffectivePermissionsResponse = Permission[]; // Effective permissions for user
export type ListPermissionsResponse = Permission[]; // List of permissions
export type PermissionByIdResponse = Permission; // Single permission by ID
export type PermissionsByRoleResponse = Permission[]; // Permissions for a role
export type RemovePermissionOverrideResponse = { message: string }; // Deletion confirmation
export type UpdatePermissionResponse = Permission; // Updated permission
export type UserPermissionOverrideResponse = UserPermissionOverride; // Single permission override
export type AssignPermissionsResponse = {
    roleID: string; // Role ID
    assignedPermissions: string[]; // Assigned permission IDs
    totalAssigned: number; // Total permissions assigned
};
export type RevokePermissionsResponse = {
    roleID: string; // Role ID
    revokedPermission: string; // Revoked permission ID
    totalAssigned: number; // Total permissions remaining
};

// Reason API Responses
export type CreateReasonResponse = Reason; // Created reason
export type DeleteReasonResponse = { message: string }; // Deletion confirmation
export type ListReasonsResponse = Reason[]; // List of reasons
export type ReasonByIdResponse = Reason; // Single reason by ID
export type ReasonsByVisitResponse = VisitReason[]; // Reasons for a visit
export type UpdateReasonResponse = Reason; // Updated reason

// Receipt Book API Responses
export type CreateReceiptBookResponse = ReceiptBook; // Created receipt book
export type DeleteReceiptBookResponse = { message: string }; // Deletion confirmation
export type ListReceiptBooksResponse = ReceiptBook[]; // List of receipt books
export type ReceiptBookByIdResponse = ReceiptBook; // Single receipt book by ID
export type ReceiptBooksByHolderResponse = ReceiptBook[]; // Receipt books by holder
export type ReceiveFromSupplierResponse = { message: string }; // Receipt confirmation
export type SendToSupplierResponse = { message: string }; // Send confirmation
export type TransferHistoryResponse = ReceiptBookTransfer[]; // Transfer history
export type TransferResponse = { message: string }; // Transfer confirmation
export type UpdateReceiptBookResponse = ReceiptBook; // Updated receipt book
export type ValidateTransferResponse = ReceiptBook; // Validated transfer

// Receipt Stub API Responses
export type ArchiveStubResponse = ReceiptStub; // Archived stub
export type CollectStubResponse = { message: string }; // Collection confirmation
export type ValidateStubCollectionResponse = ReceiptStub; // Validated stub

// Role API Responses
export type AssignRolesResponse = {
    userID: string; // User ID
    assignedRoles: string[]; // Assigned role IDs
    totalAssigned: number; // Total roles assigned
};
export type CreateRoleResponse = Role; // Created role
export type DeleteRoleResponse = { message: string }; // Deletion confirmation
export type ListRolesResponse = Role[]; // List of roles
export type RevokeRoleResponse = {
    userID: string; // User ID
    revokedRole: string; // Revoked role ID
    totalAssigned: number; // Total roles remaining
};
export type RoleByIdResponse = Role; // Single role by ID
export type RolesByUserResponse = Role[]; // Roles for a user
export type UpdateRoleResponse = Role; // Updated role

// Timesheet API Responses
export type CreateTimesheetResponse = Timesheet; // Created timesheet
export type DeleteTimesheetResponse = { message: string }; // Deletion confirmation
export type ListTimesheetsResponse = Timesheet[]; // List of timesheets
export type TimesheetByIdResponse = Timesheet; // Single timesheet by ID
export type TimesheetsBySupervisorResponse = Timesheet[]; // Timesheets by supervisor
export type UpdateTimesheetResponse = Timesheet; // Updated timesheet
export type ValidateTimesheetResponse = Timesheet; // Validated timesheet

// User API Responses
export type AssignSupervisorsResponse = {
    managerID: string; // Manager ID
    assignedSupervisors: string[]; // Assigned supervisor IDs
    message: string; // Success message
};
export type CreateUserResponse = User; // Created user
export type DeleteUserResponse = { message: string }; // Deletion confirmation
export type ListUsersResponse = User[]; // List of users
export type ManagersByUserResponse = User[]; // Managers for a user
export type RevokeSupervisorsResponse = {
    managerID: string; // Manager ID
    revokedSupervisors: string[]; // Revoked supervisor IDs
    message: string; // Success message
};
export type SupervisorsByUserResponse = User[]; // Supervisors for a user
export type UpdateUserResponse = User; // Updated user
export type UserByIdResponse = User; // Single user by ID
export type UserByPhoneResponse = User; // Single user by phone

// Visit API Responses
export type DeleteVisitResponse = { message: string }; // Deletion confirmation
export type LogVisitResponse = Visit; // Logged visit
export type UpdateVisitResponse = Visit; // Updated visit
export type VerifyQrResponse = {
    valid: boolean; // QR code validity
    message: string; // Validation message
};
export type VisitByIdResponse = Visit; // Single visit by ID