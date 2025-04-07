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

// Agent API Responses
export type AgentsByLocationResponse = Agent[];
export type AgentLocationsResponse = string[];
export type AgentByPhoneResponse = Agent;
export type AgentByIdResponse = Agent;

// Auth API Responses

export type LoginResponse =
    | {
        token: string;
        user: User;
    }
    | {
        requires2FA: true;
        userID: string;
        deviceIdentifier: string;
        message: string;
    };

export interface Verify2FAResponse {
    token: string;
    user: User;
}

export type Resend2FAResponse = { userID: string; message: string };
export type InitiatePasswordResetResponse = { userID: string; message: string };
export type VerifyPasswordResetOTPResponse = { userID: string; message: string };
export type ResetPasswordResponse = { message: string };




// User API Responses
export type CreateUserResponse = User;
export type ListUsersResponse = User[];
export type UserByPhoneResponse = User;
export type UserByIdResponse = User;
export type UpdateUserResponse = User;
export type DeleteUserResponse = { message: string; }
export type AssignSupervisorsResponse = { managerID: string; assignedSupervisors: string[]; message: string; }
export type RevokeSupervisorsResponse = { managerID: string; revokedSupervisors: User[]; message: string; }
export type SupervisorsByUserResponse = User[];
export type ManagersByUserResponse = User[];


// Role API Responses
export type CreateRoleResponse = Role;
export type ListRolesResponse = Role[];
export type RoleByIdResponse = Role;
export type UpdateRoleResponse = Role;
export type DeleteRoleResponse = { message: string; }
export type AssignRolesResponse = { userID: string; assignedRoles: string[]; totalAssigned: number; }
export type RevokeRoleResponse = { userID: string; revokedRole: Role; totalAssigned: number; message: string; }
export type RolesByUserResponse = Role[];


// Permission API Responses
export type ListPermissionsResponse = Permission[];
export type PermissionByIdResponse = Permission;
export type CreatePermissionResponse = Permission;
export type UpdatePermissionResponse = Permission;
export type DeletePermissionResponse = { message: string; }
export type AssignPermissionsResponse = { roleID: string; assignedPermissions: Permission[]; totalAssigned: number }
export type RevokePermissionsResponse = { roleID: string; revokedPermissions: Permission[]; totalAssigned: number; message: string; }
export type PermissionsByRoleResponse = Permission[];
export type AddPermissionOverrideResponse = UserPermissionOverride;
export type RemovePermissionOverrideResponse = { message: string; }
export type EffectivePermissionsResponse = Permission[];
export type UserPermissionOverrideResponse = UserPermissionOverride;











// Timesheet API Responses
export type CreateTimesheetResponse = Timesheet;
export type ListTimesheetsResponse = Timesheet[];
export type TimesheetByIdResponse = Timesheet;
export type ValidateTimesheetResponse = Timesheet;
export type TimesheetsBySupervisorResponse = Timesheet[];
export type UpdateTimesheetResponse = Timesheet;
export type DeleteTimesheetResponse = { message: string };

// Visit API Responses
export type VerifyQrResponse = { valid: boolean; message: string; }
export type LogVisitResponse = Visit;
export type VisitByIdResponse = Visit;
export type UpdateVisitResponse = Visit;
export type DeleteVisitResponse = { message: string };

// Reason API Responses
export type CreateReasonResponse = Reason;
export type ReasonByIdResponse = Reason;
export type UpdateReasonResponse = Reason;
export type DeleteReasonResponse = { message: string; }
export type ListReasonsResponse = Reason[];
export type ReasonsByVisitResponse = VisitReason[];

// Checklist API Responses
export type CreateChecklistResponse = Checklist;
export type ChecklistByIdResponse = Checklist;
export type UpdateChecklistResponse = Checklist;
export type DeleteChecklistResponse = { message: string; }
export type ListChecklistsResponse = Checklist[];
export type ChecklistsByVisitResponse = VisitChecklist[];


// Receipt Book API Responses
export type CreateReceiptBookResponse = ReceiptBook;
export type ListReceiptBooksResponse = ReceiptBook[];
export type ReceiptBookByIdResponse = ReceiptBook;
export type ReceiptBooksByHolderResponse = ReceiptBook[];
export type UpdateReceiptBookResponse = ReceiptBook;
export type DeleteReceiptBookResponse = { message: string; }
export type SendToSupplierResponse = { message: string; }
export type ReceiveFromSupplierResponse = { message: string; }
export type TransferResponse = { message: string; }
export type ValidateTransferResponse = ReceiptBook;
export type TransferHistoryResponse = ReceiptBookTransfer[];

// Receipt Stub API Responses
export type CollectStubResponse = { message: string; }
export type ValidateStubCollectionResponse = ReceiptStub;
export type ArchiveStubResponse = ReceiptStub;





