// Kazi Domain Types and Data Contracts
// Complies with PRD.md, WORKFLOWS.md, and DATABASE.md

export type UserRole = 'WORKER' | 'COMPANY' | 'ADMIN';
export type AdminCapability = 'RECRUITER' | 'FINANCE' | 'SUPER_ADMIN';

export interface WorkerPublicProfile {
  id: string;
  firstName: string;
  lastNameInitial: string; // PRD: Do not expose full identity to companies
  primaryTrade: string;
  commune: string;
  verifiedStatus: 'VERIFIED' | 'PENDING';
  skills: string[];
  completedMissionsCount: number;
  attendanceRate: number; // percentage (e.g. 98)
  availableNow: boolean;
}

export interface WorkerPrivateProfile extends WorkerPublicProfile {
  lastName: string;
  phone: string;
  cniNumber: string;
  internalNotes: string[];
}

export interface Company {
  id: string;
  name: string;
  tradeSector: string;
  rccm: string;
  nif: string;
  contactName: string;
  email: string;
  phone: string;
  commune: string;
  verificationStatus: 'VERIFIED' | 'PENDING' | 'CHANGES_REQUESTED';
  joinedDate: string;
}

export type MissionStatus = 'OPEN' | 'CLOSED_TO_APPLICATIONS' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Mission {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  trade: string;
  siteName: string;
  area: string; // Libreville, Akanda, Owendo
  address: string;
  status: MissionStatus;
  headcountNeeded: number;
  headcountAssigned: number;
  termsRevision: number;
  dayPayXAF: number;
  totalDays: number;
  startsAt: string;
  endsAt: string;
  dailyHours: string;
  tasks: string[];
  equipmentProvided: string[];
  equipmentRequired: string[];
  description: string;
}

export type StaffingRequestStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED' | 'CANCELLED';

export interface StaffingRequest {
  id: string;
  companyId: string;
  companyName: string;
  trade: string;
  headcount: number;
  siteName: string;
  commune: string;
  startsAt: string;
  endsAt: string;
  dailyHours: string;
  dayPayXAF: number;
  equipmentRequirements: string;
  specialInstructions: string;
  status: StaffingRequestStatus;
  createdAt: string;
  rejectionReason?: string;
}

export type ApplicationStatus = 'SUBMITTED' | 'SHORTLISTED' | 'PROPOSED' | 'ASSIGNED' | 'WITHDRAWN' | 'NOT_SELECTED';

export interface Application {
  id: string;
  missionId: string;
  missionTitle: string;
  workerId: string;
  workerName: string;
  workerTrade: string;
  workerArea: string;
  status: ApplicationStatus;
  submittedAt: string;
  proposalId?: string;
  rejectionReason?: string;
}

export type CompanyProposalDecision = 'PENDING' | 'ACCEPTED' | 'DECLINED';
export type WorkerProposalDecision = 'PENDING' | 'CONFIRMED' | 'DECLINED';
export type ProposalStatus = 'PENDING_COMPANY' | 'AWAITING_WORKER' | 'READY_FOR_ASSIGNMENT' | 'FINALIZED' | 'EXPIRED' | 'DECLINED';

export interface Proposal {
  id: string;
  missionId: string;
  missionTitle: string;
  workerId: string;
  workerName: string;
  workerTrade: string;
  termsRevision: number;
  companyDecision: CompanyProposalDecision;
  workerDecision: WorkerProposalDecision;
  status: ProposalStatus;
  proposedAt: string;
  expiresAt: string; // 24h countdown
  companyDecidedAt?: string;
  workerDecidedAt?: string;
  termsId?: string;
  version?: number;
}

export type AssignmentStatus = 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'WITHDRAWN_BY_WORKER' | 'CANCELLED_BY_COMPANY';

export interface Assignment {
  id: string;
  missionId: string;
  missionTitle: string;
  siteName: string;
  workerId: string;
  workerName: string;
  companyId: string;
  companyName: string;
  status: AssignmentStatus;
  termsRevision: number;
  dayPayXAF: number;
  startsAt: string;
  endsAt: string;
  dailyHours: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'PARTIAL';
export type AttendanceReviewState = 'NOT_RECORDED' | 'SUBMITTED_BY_COMPANY' | 'CONFIRMED' | 'DISPUTED' | 'RESOLVED_BY_STAFF';

export interface AttendanceRecord {
  id: string;
  missionId: string;
  assignmentId: string;
  workerId: string;
  workerName: string;
  date: string;
  companyStatus: AttendanceStatus;
  hoursWorked: number;
  companyNote: string;
  workerAgreed: boolean | null;
  workerDisputeNote?: string;
  reviewState: AttendanceReviewState;
  staffResolutionNote?: string;
}

export interface SupportTicket {
  id: string;
  creatorRole: UserRole;
  creatorId: string;
  creatorName: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  missionId?: string;
  messages: Array<{
    id: string;
    senderRole: 'WORKER' | 'COMPANY' | 'STAFF';
    senderName: string;
    content: string;
    timestamp: string;
    isStaffInternal?: boolean; // PRD: Staff internal notes kept confidential
  }>;
}

export interface KaziInvoice {
  id: string;
  companyId: string;
  companyName: string;
  missionId: string;
  missionTitle: string;
  serviceFeeXAF: number;
  vatXAF: number;
  totalXAF: number;
  status: 'SAMPLE' | 'ISSUED' | 'PAID';
  issuedAt: string;
  isPrototypeSample: boolean; // Must always be true in prototype
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  scope: string;
  action: string;
  previousValue: string;
  newValue: string;
  reason?: string;
}
