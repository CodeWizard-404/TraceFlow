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


export type AgentsByLocationResponse = Agent[];
export type AgentLocationsResponse = string[];
export type AgentByPhoneResponse = Agent;
export type AgentByIdResponse = Agent;

export interface CreateTimesheetResponse {message: string; timesheet: Timesheet;}
export type ListTimesheetsResponse = Timesheet[];
export type TimesheetByIdResponse = Timesheet;
export type ValidateTimesheetResponse = Timesheet;
export type TimesheetsBySupervisorResponse = Timesheet[];

export type CreateVisitResponse = Visit
export type VerifyQrResponse = {valid: boolean; message: string;}
export type LogVisitResponse = Visit;
export type VisitByIdResponse = Visit;

export type CreateChecklistResponse = Checklist;
export type ListChecklistsResponse = Checklist[];
export type ChecklistsByVisitResponse = VisitChecklist[];

export type CreateReasonResponse = Reason;
export type ListReasonsResponse = Reason[];
export type ReasonsByVisitResponse = VisitReason[];

export type LoginResponse = { token: string; user: User };

export type CreateUserResponse = User;
export type ListUsersResponse = User[];
export type UserByIdResponse = User;
export type AssignRolesResponse = { userID: string; assignedRoles: string[]; totalAssigned: number };
export type RolesByUserResponse = Role[];

export type CreateRoleResponse = Role;
export type ListRolesResponse = Role[];
export type RoleByIdResponse = Role;
export type AssignPermissionsResponse = { roleID: string; assignedPermissions: string[]; totalAssigned: number };
export type PermissionsByRoleResponse = Permission[];

export type ListPermissionsResponse = Permission[];
export type PermissionByIdResponse = Permission;

export type CreateReceiptBookResponse = ReceiptBook;
export type ListReceiptBooksResponse = ReceiptBook[];
export type ReceiptBookByIdResponse = ReceiptBook;
export type SendToSupplierResponse = { message: string };
export type TransferToUserResponse = { message: string };
export type ValidateTransferResponse = ReceiptBook;
export type AssignToAgentResponse = { message: string };
export type ValidateAgentAssignmentResponse = ReceiptBook;
export type TransferHistoryResponse = ReceiptBookTransfer[];

export type CollectStubResponse = { message: string };
export type ValidateStubCollectionResponse = ReceiptStub;
export type TransmitStubResponse = ReceiptStub;
export type ArchiveStubResponse = ReceiptStub;