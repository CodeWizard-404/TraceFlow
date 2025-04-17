import Agent from '../models/Agent';
import { Checklist, VisitChecklist } from '../models/Checklist';
import { Reason, VisitReason } from '../models/Reason';
import Timesheet from '../models/Timesheet';
import Visit from '../models/Visit';
import User from '../models/User';
import Role from '../models/Role';
import Permission from '../models/Permission';
import ReceiptBook from '../models/ReceiptBook';
import ReceiptStub from '../models/ReceiptStub';
import ReceiptBookTransfer from '../models/ReceiptBookTransfer';
import UserPermissionOverride from '../models/UserPermissionOverride';

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
    deviceToken?: string;
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
    expiresIn?: number;
}

export interface InitiatePasswordResetResponse {
    userID: string;
    message: string;
}

export interface Resend2FAResponse {
    userID: string;
    message: string;
}

export interface VerifyPasswordResetOTPResponse {
    userID: string;
    tempToken: string;
    message: string;
}

export interface ResetPasswordResponse {
    message: string;
}

export type AgentByIdResponse = Agent;
export type AgentByPhoneResponse = Agent;
export type AgentLocationsResponse = string[];
export type AgentsByLocationResponse = Agent[];

export type ChecklistByIdResponse = Checklist;
export type ChecklistsByVisitResponse = VisitChecklist[];
export type CreateChecklistResponse = Checklist;
export type DeleteChecklistResponse = { message: string };
export type ListChecklistsResponse = Checklist[];
export type UpdateChecklistResponse = Checklist;

export type AddPermissionOverrideResponse = UserPermissionOverride;
export type EffectivePermissionsResponse = Permission[];
export type ListPermissionsResponse = Permission[];
export type PermissionByIdResponse = Permission;
export type PermissionsByRoleResponse = Permission[];
export type RemovePermissionOverrideResponse = { message: string };
export type UpdatePermissionResponse = Permission;
export type UserPermissionOverrideResponse = UserPermissionOverride;
export type AssignPermissionsResponse = {
    roleID: string;
    assignedPermissions: string[];
    totalAssigned: number;
};
export type RevokePermissionsResponse = {
    roleID: string;
    revokedPermission: string;
    totalAssigned: number;
};

export type CreateReasonResponse = Reason;
export type DeleteReasonResponse = { message: string };
export type ListReasonsResponse = Reason[];
export type ReasonByIdResponse = Reason;
export type ReasonsByVisitResponse = VisitReason[];
export type UpdateReasonResponse = Reason;

export type CreateReceiptBookResponse = ReceiptBook;
export type DeleteReceiptBookResponse = { message: string };
export type ListReceiptBooksResponse = ReceiptBook[];
export type ReceiptBookByIdResponse = ReceiptBook;
export type ReceiptBooksByHolderResponse = ReceiptBook[];
export type ReceiveFromSupplierResponse = { message: string };
export type SendToSupplierResponse = { message: string };
export type TransferHistoryResponse = ReceiptBookTransfer[];
export type TransferResponse = { message: string };
export type UpdateReceiptBookResponse = ReceiptBook;
export type ValidateTransferResponse = ReceiptBook;

export type ArchiveStubResponse = ReceiptStub;
export type CollectStubResponse = { message: string };
export type ValidateStubCollectionResponse = ReceiptStub;

export type AssignRolesResponse = {
    userID: string;
    assignedRoles: string[];
    totalAssigned: number;
};
export type CreateRoleResponse = Role;
export type DeleteRoleResponse = { message: string };
export type ListRolesResponse = Role[];
export type RevokeRoleResponse = {
    userID: string;
    revokedRole: string;
    totalAssigned: number;
};
export type RoleByIdResponse = Role;
export type RolesByUserResponse = Role[];
export type UpdateRoleResponse = Role;

export type CreateTimesheetResponse = Timesheet;
export type DeleteTimesheetResponse = { message: string };
export type ListTimesheetsResponse = Timesheet[];
export type TimesheetByIdResponse = Timesheet;
export type TimesheetsBySupervisorResponse = Timesheet[];
export type UpdateTimesheetResponse = Timesheet;
export type ValidateTimesheetResponse = Timesheet;


export interface AssignGoogleAccountResponse {
    user: User;
    message: string;
}
export type AssignSupervisorsResponse = {
    managerID: string;
    assignedSupervisors: string[];
    message: string;
};
export type CreateUserResponse = User;
export type DeleteUserResponse = { message: string };
export type ListUsersResponse = User[];
export type ManagersByUserResponse = User[];
export type RevokeSupervisorsResponse = {
    managerID: string;
    revokedSupervisors: string[];
    message: string;
};
export type SupervisorsByUserResponse = User[];
export type UpdateUserResponse = User;
export type UserByIdResponse = User;
export type UserByPhoneResponse = User;

export type DeleteVisitResponse = { message: string };
export type LogVisitResponse = Visit;
export type UpdateVisitResponse = Visit;
export type VerifyQrResponse = {
    valid: boolean;
    message: string;
};
export type VisitByIdResponse = Visit;