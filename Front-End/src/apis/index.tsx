import Agent from "../models/Agent";
import { Checklist, VisitChecklist } from "../models/Checklist";
import { Reason, VisitReason } from "../models/Reason";
import Timesheet from "../models/Timesheet";
import Visit from "../models/Visit";

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
export type VerifyQrResponse = {valid: boolean;}
export type LogVisitResponse = Visit;
export type VisitByIdResponse = Visit;

export type CreateChecklistResponse = Checklist;
export type ListChecklistsResponse = Checklist[];
export type ChecklistsByVisitResponse = VisitChecklist[];

export type CreateReasonResponse = Reason;
export type ListReasonsResponse = Reason[];
export type ReasonsByVisitResponse = VisitReason[];