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
export interface LoginResponse { token: string; user: User; }
export interface Verify2FAResponse { token: string; userID: string; }
export interface Resend2FAResponse { message: string; }



// User API Responses
export type CreateUserResponse = User;
export type ListUsersResponse = User[];
export type UserByPhoneResponse = User;
export type UserByIdResponse = User;
export type UpdateUserResponse = User;
export interface DeleteUserResponse { message: string; }
export interface AssignSupervisorsResponse { managerID: string; assignedSupervisors: string[]; message: string; }
export interface RevokeSupervisorsResponse { managerID: string; revokedSupervisors: User[]; message: string; }
export type SupervisorsByUserResponse = User[];
export type ManagersByUserResponse = User[];


// Role API Responses
export type CreateRoleResponse = Role;
export type ListRolesResponse = Role[];
export type RoleByIdResponse = Role;
export type UpdateRoleResponse = Role;
export interface DeleteRoleResponse { message: string; }
export interface AssignRolesResponse { userID: string; assignedRoles: string[]; totalAssigned: number; }
export interface RevokeRoleResponse { userID: string; revokedRole: Role; totalAssigned: number; message: string; }
export type RolesByUserResponse = Role[];


// Permission API Responses
export type ListPermissionsResponse = Permission[];
export type PermissionByIdResponse = Permission;
export type CreatePermissionResponse = Permission;
export type UpdatePermissionResponse = Permission;
export interface DeletePermissionResponse { message: string; }
export interface AssignPermissionsResponse { roleID: string; assignedPermissions: Permission[]; totalAssigned: number }
export interface RevokePermissionsResponse { roleID: string; revokedPermissions: Permission[]; totalAssigned: number; message: string; }
export type PermissionsByRoleResponse = Permission[];
export type AddPermissionOverrideResponse = UserPermissionOverride;
export interface RemovePermissionOverrideResponse { message: string; }
export type EffectivePermissionsResponse = Permission[];
export type UserPermissionOverrideResponse = UserPermissionOverride;











// Timesheet API Responses
export type CreateTimesheetResponse = { message: string; timesheet: Timesheet; };
export type ListTimesheetsResponse = Timesheet[];
export type TimesheetByIdResponse = Timesheet;
export type ValidateTimesheetResponse = Timesheet;
export type TimesheetsBySupervisorResponse = Timesheet[];
export type UpdateTimesheetResponse = Timesheet;
export type DeleteTimesheetResponse = { message: string };

// Visit API Responses
export interface VerifyQrResponse { valid: boolean; message: string; }
export type LogVisitResponse = Visit;
export type VisitByIdResponse = Visit;


// Reason API Responses
export type CreateReasonResponse = Reason;
export type ListReasonsResponse = Reason[];
export type ReasonsByVisitResponse = VisitReason[];

// Checklist API Responses
export type CreateChecklistResponse = Checklist;
export type ListChecklistsResponse = Checklist[];
export type ChecklistsByVisitResponse = VisitChecklist[];


// Receipt Book API Responses
export type CreateReceiptBookResponse = ReceiptBook;
export type ListReceiptBooksResponse = ReceiptBook[];
export type ReceiptBookByIdResponse = ReceiptBook;
export type UpdateReceiptBookResponse = ReceiptBook;
export interface DeleteReceiptBookResponse { message: string; }
export interface SendToSupplierResponse { message: string; }
export interface ReceiveFromSupplierResponse { message: string; }
export interface TransferResponse { message: string; }
export type ValidateTransferResponse = ReceiptBook;
export type TransferHistoryResponse = ReceiptBookTransfer[];

// Receipt Stub API Responses
export interface CollectStubResponse { message: string; }
export type ValidateStubCollectionResponse = ReceiptStub;
export type ArchiveStubResponse = ReceiptStub;





