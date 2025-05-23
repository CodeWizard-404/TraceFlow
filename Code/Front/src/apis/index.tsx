import Agent from "../models/Agent";
import { Checklist, VisitChecklist } from "../models/Checklist";
import { Reason, VisitReason } from "../models/Reason";
import ReceiptBook from "../models/ReceiptBook";
import ReceiptBookTransfer from "../models/ReceiptBookTransfer";
import Delegation from "../models/Delegation";
import Governorate from "../models/Governorate";
import Region from "../models/Region";
import Timesheet from "../models/Timesheet";
import Visit from "../models/Visit";
import User from "../models/User";
import Role from "../models/Role";
import Permission from "../models/Permission";
import ReceiptStub from "../models/ReceiptStub";

export type AxiosErrorResponse = { response?: { data?: { error?: string }; status?: number } };

// Auth Routes
export type LoginResponse = { requires2FA: boolean; accessToken?: string; user?: { userID: string; email: string; phone: string; roles: Role[] }; userID?: string; deviceIdentifier?: string; tempToken?: string; refreshToken?: string; expiresIn?: number; message?: string };
export type Verify2FAResponse = { requires2FA: boolean; accessToken?: string; user?: { userID: string; email: string; phone: string; roles: Role[] }; expiresIn?: number };
export type InitiatePasswordResetResponse = { userID: string; message: string };
export type Resend2FAResponse = { userID: string; message: string };
export type VerifyPasswordResetOTPResponse = { userID: string; tempToken: string; message: string };
export type ResetPasswordResponse = { message: string };
export type GoogleCallbackResponse = { requires2FA: boolean; user: User; userID: string; tempToken: string; refreshToken: string; expiresIn: number; deviceIdentifier: string };

// Agent Routes
export type AgentByIdResponse = Agent | null;
export type AgentByPhoneResponse = Agent | null;
export type AgentsByDelegationResponse = { agents: Agent[] };
export type AllAgentsResponse = { agents: Agent[] };
export type CreateAgentResponse = Agent;
export type UpdateAgentResponse = Agent;
export type DeleteAgentResponse = { message: string };
export type SupervisorResponse = User | null;
export interface AgentBulkUploadResponse {
    status: string;
    summary: {
        totalRecords: number;
        agentsCreated: number;
        agentsUpdated: number;
        recordsSkipped: number;
        errorsEncountered: number;
    };
    detailedLog: {
        created: Array<{ agentPhone: string; agentName: string; timestamp: string; details: string }>;
        updated: Array<{ agentPhone: string; agentName: string; timestamp: string; details: string }>;
        skipped: Array<{ agentPhone: string; agentName: string; timestamp: string; reason: string }>;
        errors: Array<{ agentPhone: string; agentName: string; timestamp: string; operation: string; reason: string }>;
    };
}
export type AgentLocationsResponse = {
    locations: Array<{
        agentId: string;
        name: string;
        lastname: string;
        email: string;
        phone: string;
        latitude: number;
        longitude: number;
        address: string;
        source: string;
        delegation?: { id: string; name: string };
        governorate?: { id: string; name: string };
        region?: { id: string; name: string };
    }>;
    center: { lat: number; lng: number };
};
export type NearbyAgentsResponse = Array<Agent & { distance: number }>;
export type AgentsByBoundsResponse = Agent[];

// Checklist Routes
export type ChecklistByIdResponse = Checklist;
export type ChecklistsByVisitResponse = VisitChecklist[];
export type CreateChecklistResponse = Checklist;
export type DeleteChecklistResponse = { message: string };
export type ListChecklistsResponse = Checklist[];
export type UpdateChecklistResponse = Checklist;

// Permission Routes
export type EffectivePermissionsResponse = Permission[];
export type ListPermissionsResponse = Permission[];
export type PermissionByIdResponse = Permission;
export type PermissionsByRoleResponse = Permission[];
export type RemovePermissionOverrideResponse = { message: string };
export type UpdatePermissionResponse = Permission;
export type AssignPermissionsResponse = { roleID: string; assignedPermissions: string[]; totalAssigned: number };
export type RevokePermissionsResponse = { roleID: string; revokedPermission: string; totalAssigned: number };

// Reason Routes
export type CreateReasonResponse = Reason;
export type DeleteReasonResponse = { message: string };
export type ListReasonsResponse = Reason[];
export type ReasonByIdResponse = Reason;
export type ReasonsByVisitResponse = VisitReason[];
export type UpdateReasonResponse = Reason;

// Receipt Book Routes
export type CreateReceiptBookResponse = ReceiptBook;
export type DeleteReceiptBookResponse = { message: string };
export type ListReceiptBooksResponse = ReceiptBook[];
export type ReceiptBookByIdResponse = ReceiptBook;
export type ReceiptBooksByHolderResponse = ReceiptBook[];
export type ReceiveFromSupplierResponse = { message: string };
export type SendToSupplierResponse = { message: string; bookIDs?: string[]; csvUrl?: string; zipUrl?: string };
export type TransferHistoryResponse = ReceiptBookTransfer[];
export type TransferResponse = { message: string; otpID?: string };
export type UpdateReceiptBookResponse = ReceiptBook;
export type ValidateTransferResponse = { message: string };
export interface ReceiptBookBulkUploadResponse {
    status: "pending" | "completed_successfully" | "completed_with_issues" | "failed";
    summary: {
        totalRecords: number;
        booksCreated: number;
        recordsSkipped: number;
        errorsEncountered: number;
    };
    detailedLog: {
        created: Array<{
            bookNumber: string;
            bookType: string;
            timestamp: string;
            details: string;
        }>;
        skipped: Array<{
            bookNumber: string;
            bookType: string;
            timestamp: string;
            reason: string;
        }>;
        errors: Array<{
            bookNumber: string;
            bookType: string;
            timestamp: string;
            operation: string;
            reason: string;
        }>;
    };
}


// Receipt Stub Routes
export type ArchiveStubResponse = ReceiptStub;
export type CollectStubResponse = { message: string };
export type ValidateStubCollectionResponse = ReceiptStub;


// Role Routes
export type AssignRolesResponse = { userID: string; assignedRoles: string[]; totalAssigned: number };
export type CreateRoleResponse = Role;
export type DeleteRoleResponse = { message: string };
export type ListRolesResponse = Role[];
export type RevokeRoleResponse = { userID: string; revokedRole: string; totalAssigned: number };
export type RoleByIdResponse = Role;
export type RolesByUserResponse = Role[];
export type UpdateRoleResponse = Role;

// Timesheet Routes
export type CreateTimesheetResponse = Timesheet;
export type DeleteTimesheetResponse = { message: string };
export type ListTimesheetsResponse = Timesheet[];
export type TimesheetByIdResponse = Timesheet;
export type TimesheetsBySupervisorResponse = Timesheet[];
export type UpdateTimesheetResponse = Timesheet;
export type ValidateTimesheetResponse = Timesheet;
export type TimesheetByWeekNumberAndYearResponse = Timesheet;

// Visit Routes
export type DeleteVisitResponse = { message: string };
export type LogVisitResponse = Visit;
export type UpdateVisitResponse = Visit;
export type VerifyQrResponse = { valid: boolean; message: string; otpID?: string };
export type VisitByIdResponse = Visit;

// User Routes
export type AssignGoogleAccountResponse = { userID: string; keycloakId: string; firstname: string; lastname: string; phone: string; email: string; password: string; };
export type CreateUserResponse = { userID: string; keycloakId: string; email: string; firstname: string; lastname: string; phone: string; password: string; };
export type DeleteUserResponse = { message: string };
export type AssignRegionalManagerResponse = { supervisorID: string; regionalManagerID: string; message: string };
export type RevokeRegionalManagerResponse = { supervisorID: string; regionalManagerID: string | null; message: string; cascadeApplied: { governorates: boolean; delegations: boolean; agents: boolean }; affectedCounts: { governorates: number; delegations: number; agents: number } };
export type AssignDirectorResponse = { regionalManagerID: string; directorID: string; message: string };
export type RevokeDirectorResponse = { regionalManagerID: string; directorID: string | null; message: string };
export type AssignSupervisorToAgentResponse = { agentID: string; supervisorID: string; delegationID: string; message: string };
export type RevokeSupervisorFromAgentResponse = { agentID: string; supervisorID: string | null; delegationID: string | null; message: string };
export type AssignRegionsResponse = Array<{ userID: string; regionID: string; message: string }>;
export type RevokeRegionsResponse = { regionalManagerID: string; regionIDs: string[]; message: string; cascadeApplied: { supervisors: boolean }; affectedCounts: { supervisors: number } };
export type AssignGovernoratesResponse = Array<{ userID: string; governorateID: string; message: string }>;
export type RevokeGovernoratesResponse = { supervisorID: string; governorateIDs: string[]; message: string; cascadeApplied: { delegations: boolean; agents: boolean }; affectedCounts: { delegations: number; agents: number } };
export type AssignDelegationsResponse = Array<{ userID: string; delegationID: string; message: string }>;
export type RevokeDelegationsResponse = { supervisorID: string; delegationIDs: string[]; message: string; cascadeApplied: { agents: boolean }; affectedCounts: { agents: number } };
export type GetUsersByRegionResponse = User[];
export type GetUsersByGovernorateResponse = User[];
export type GetUsersByDelegationResponse = User[];

// Location Routes
export type AllRegionsResponse = Region[];
export type AllGovernoratesResponse = Governorate[];
export type AllDelegationsResponse = Delegation[];
export type DelegationsByGovernorateResponse = Delegation[];
export type GovernoratesByRegionResponse = Governorate[];
export type RegionsByGovernorateResponse = Region[];
export type GovernoratesByDelegationResponse = Governorate[];
export type RegionsByUserResponse = Region[];
export type GovernoratesByUserResponse = Governorate[];
export type DelegationsByUserResponse = Delegation[];
export interface LocationDetailsResponse { success: boolean; address?: string; idInfo?: string; message?: string; }

// Google Maps API response types
export type GeocodeResponse = { geometry: { location: { lat: number; lng: number } }; formattedAddress: string; latitude: number; longitude: number; mock?: boolean };
export interface DirectionsResponse {
    distance: number;
    duration: number;
    steps: Array<{
        instruction: string;
        distance: string;
        duration: string;
    }>;
    polyline: string;
    waypointOrder?: number[];
    trafficSegments?: Array<{
        legIndex: number;
        steps: Array<{
            polyline: string;
            trafficCondition: 'clear' | 'moderate' | 'heavy';
            color: string;
            distance: string;
            duration: string;
            instruction: string;
        }>;
        distance: number;
        duration: number;
    }>;
    mock?: boolean;
}
export type PlacesResponse = Array<{ place_id: string; name: string; formatted_address: string; geometry: { location: { lat: number; lng: number } }; }>;
export type DistanceMatrixResponse = Array<{ elements: Array<{ distance: { text: string; value: number }; duration: { text: string; value: number }; status: string; }>; }>;