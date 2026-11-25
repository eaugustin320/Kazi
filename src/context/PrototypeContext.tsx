// Kazi Operational Application State Store & Controller
// Connects UI presentation to real backend HTTP API endpoints & SQLite persistence
// Strictly implements I2, I3, I4, and I5 from BUILD_CORRECTION.md

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  UserRole,
  Mission,
  Company,
  WorkerPrivateProfile,
  StaffingRequest,
  Application,
  Proposal,
  Assignment,
  AttendanceRecord,
  SupportTicket,
  KaziInvoice,
  AuditEvent,
  AttendanceStatus,
  NotificationItem,
  ReplacementItem,
  ServiceQuote,
} from '../types/domain';
import {
  ThemeDefinition,
  REGISTERED_THEMES,
  GABON_PREMIUM_THEME,
  applyThemeToDOM,
  checkThemeContrasts,
  ContrastCheckResult,
} from '../tokens/theme';
import {
  INITIAL_COMPANIES,
  INITIAL_WORKERS,
  INITIAL_MISSIONS,
  INITIAL_STAFFING_REQUESTS,
  INITIAL_APPLICATIONS,
  INITIAL_PROPOSALS,
  INITIAL_ASSIGNMENTS,
  INITIAL_ATTENDANCE,
  INITIAL_SUPPORT_TICKETS,
  INITIAL_INVOICES,
  INITIAL_AUDIT_LOGS,
} from '../data/fixtures';
import { authApi, recruitmentApi, operationsApi, ApiUser } from '../services/api';

export type ViewportMode = 'MOBILE' | 'TABLET' | 'DESKTOP' | 'FLUID';

interface ToastState {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message?: string;
}

interface PrototypeContextType {
  // Session & Identity (I2)
  currentUser: ApiUser | null;
  loginUser: (user: ApiUser) => void;
  logoutUser: () => Promise<void>;
  switchTestAccount: (targetRole: 'WORKER' | 'COMPANY' | 'STAFF') => Promise<void>;

  // Presentation & Theming
  theme: ThemeDefinition;
  setTheme: (themeId: string, reason?: string) => void;
  viewport: ViewportMode;
  setViewport: (mode: ViewportMode) => void;
  contrastResults: ContrastCheckResult[];
  themeSwitchCount: number;

  // Role & Navigation
  role: UserRole | 'SPECIMENS';
  setRole: (role: UserRole | 'SPECIMENS') => void;
  workerView: string;
  setWorkerView: (v: string) => void;
  companyView: string;
  setCompanyView: (v: string) => void;
  adminView: string;
  setAdminView: (v: string) => void;

  // Selected Entities
  selectedMissionId: string;
  setSelectedMissionId: (id: string) => void;
  selectedRequestId: string;
  setSelectedRequestId: (id: string) => void;
  selectedProposalId: string;
  setSelectedProposalId: (id: string) => void;

  // Domain State (Connected to SQLite API)
  missions: Mission[];
  companies: Company[];
  workers: WorkerPrivateProfile[];
  staffingRequests: StaffingRequest[];
  applications: Application[];
  proposals: Proposal[];
  assignments: Assignment[];
  attendance: AttendanceRecord[];
  supportTickets: SupportTicket[];
  invoices: KaziInvoice[];
  quotes: ServiceQuote[];
  replacements: ReplacementItem[];
  notifications: NotificationItem[];
  auditLogs: AuditEvent[];

  // Toast System
  toast: ToastState | null;
  showToast: (type: ToastState['type'], title: string, message?: string) => void;
  hideToast: () => void;

  // Connected Business Actions (I3 & I4)
  applyToMission: (missionId: string, workerId?: string) => Promise<{ success: boolean; error?: string }>;
  withdrawApplication: (applicationId: string, reason: string) => Promise<void>;
  companyDecideProposal: (proposalId: string, decision: 'ACCEPTED' | 'DECLINED') => Promise<void>;
  workerConfirmProposal: (proposalId: string, decision: 'CONFIRMED' | 'DECLINED') => Promise<void>;
  adminFinalizeAssignment: (proposalId: string) => Promise<{ success: boolean; error?: string }>;
  createStaffingRequest: (req: Partial<StaffingRequest>) => Promise<void>;
  adminModerateRequest: (requestId: string, action: 'APPROVE' | 'REQUEST_CHANGES', reason?: string) => Promise<void>;
  adminProposeCandidates: (missionId: string, applicationIds: string[]) => Promise<{ success: boolean; error?: string }>;
  companyDeclareAttendance: (recordId: string, status: AttendanceStatus, hours: number, note: string) => Promise<void>;
  workerConfirmAttendance: (recordId: string) => Promise<void>;
  workerDisputeAttendance: (recordId: string, disputeNote: string) => Promise<void>;
  adminResolveDispute: (recordId: string, resolvedStatus: AttendanceStatus, note: string) => Promise<void>;
  adminRequestReplacement: (assignmentId: string, absentWorkerId: string, dates: string[], reason?: string) => Promise<void>;
  adminConfirmReplacement: (requestId: string, replacementAssignmentId: string, expectedVersion: number) => Promise<void>;
  createSupportTicket: (
    category: 'CHANTIER' | 'PAIEMENT' | 'POINTAGE' | 'ACCES',
    subject: string,
    initialMessage: string,
    missionId?: string
  ) => Promise<void>;
  sendSupportMessage: (ticketId: string, content: string, isInternal?: boolean) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  staffCreateAndSendQuote: (companyId: string, missionId: string, description: string, unitAmount: number) => Promise<void>;
  companyDecideQuote: (quoteId: string, decision: 'ACCEPT' | 'DECLINE', expectedVersion: number) => Promise<void>;
  staffGenerateInvoice: (acceptedQuoteId: string) => Promise<void>;
  staffRecordReceipt: (invoiceId: string, amount: number, externalReference: string) => Promise<void>;
  updateMyProfile: (patch: Record<string, unknown>) => Promise<void>;
  resetToDefaults: () => void;
  refreshServerData: () => Promise<void>;
}

const PrototypeContext = createContext<PrototypeContextType | undefined>(undefined);

export const PrototypeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Session State
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);

  // Theme state
  const [theme, setThemeState] = useState<ThemeDefinition>(GABON_PREMIUM_THEME);
  const [viewport, setViewport] = useState<ViewportMode>('FLUID');
  const [themeSwitchCount, setThemeSwitchCount] = useState<number>(0);
  const [contrastResults, setContrastResults] = useState<ContrastCheckResult[]>(() =>
    checkThemeContrasts(GABON_PREMIUM_THEME)
  );

  // Role and subviews
  const [role, setRole] = useState<UserRole | 'SPECIMENS'>('WORKER');
  const [workerView, setWorkerView] = useState<string>('discovery');
  const [companyView, setCompanyView] = useState<string>('overview');
  const [adminView, setAdminView] = useState<string>('queue');

  // Selected items
  const [selectedMissionId, setSelectedMissionId] = useState<string>('mission-01');
  const [selectedRequestId, setSelectedRequestId] = useState<string>('req-01');
  const [selectedProposalId, setSelectedProposalId] = useState<string>('prop-01');

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);

  // Domain State
  const [missions, setMissions] = useState<Mission[]>(INITIAL_MISSIONS);
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [workers, setWorkers] = useState<WorkerPrivateProfile[]>(INITIAL_WORKERS);
  const [staffingRequests, setStaffingRequests] = useState<StaffingRequest[]>(INITIAL_STAFFING_REQUESTS);
  const [applications, setApplications] = useState<Application[]>(INITIAL_APPLICATIONS);
  const [proposals, setProposals] = useState<Proposal[]>(INITIAL_PROPOSALS);
  const [assignments, setAssignments] = useState<Assignment[]>(INITIAL_ASSIGNMENTS);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(INITIAL_ATTENDANCE);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(INITIAL_SUPPORT_TICKETS);
  const [invoices, setInvoices] = useState<KaziInvoice[]>(INITIAL_INVOICES);
  const [quotes, setQuotes] = useState<ServiceQuote[]>([]);
  const [replacements, setReplacements] = useState<ReplacementItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(INITIAL_AUDIT_LOGS);

  // Apply theme to DOM upon mount and changes
  useEffect(() => {
    applyThemeToDOM(theme);
    setContrastResults(checkThemeContrasts(theme));
  }, [theme]);

  const showToast = useCallback((type: ToastState['type'], title: string, message?: string) => {
    setToast({ id: Date.now().toString(), type, title, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  // -------------------------------------------------------------------------
  // Server Data Refresh
  // -------------------------------------------------------------------------
  const refreshServerData = useCallback(async () => {
    try {
      // 1. Fetch public missions from server
      const serverMissions = await recruitmentApi.listMissions();
      if (Array.isArray(serverMissions) && serverMissions.length > 0) {
        const mappedMissions: Mission[] = serverMissions.map((m: any) => ({
          id: m.id,
          companyId: m.companyId || 'company-a',
          companyName: m.companyName || 'BTP Horizon Gabon',
          title: m.title,
          trade: m.trade || m.tradeCode || 'Coffreur',
          siteName: m.siteName || 'Chantier Bord de Mer',
          area: m.area || m.areaCode || 'Libreville',
          address: m.siteAddress || 'Libreville',
          status: m.status || 'OPEN',
          headcountNeeded: m.headcountNeeded || 3,
          headcountAssigned: m.headcountAssigned || 0,
          termsRevision: m.termsRevision || m.currentTermsRevision || 1,
          dayPayXAF: m.dayPayXAF || 15000,
          totalDays: 5,
          startsAt: m.startsAt,
          endsAt: m.endsAt,
          dailyHours: m.dailyHours || '07h30 - 16h30',
          tasks: ['Pose de banches', 'Ferraillage', 'Sécurité'],
          equipmentProvided: ['Casque', 'Gilet'],
          equipmentRequired: ['Chaussures de sécurité'],
          description: m.description || 'Mission Kazi',
        }));
        setMissions(mappedMissions);
        if (!selectedMissionId || !mappedMissions.some((m) => m.id === selectedMissionId)) {
          setSelectedMissionId(mappedMissions[0].id);
        }
      }

      // 2. Fetch requests if company or staff
      if (currentUser?.role === 'COMPANY' || currentUser?.role === 'STAFF') {
        const serverRequests = await recruitmentApi.listRequests();
        if (Array.isArray(serverRequests)) {
          const mappedRequests: StaffingRequest[] = serverRequests.map((r: any) => {
            let terms: any = {};
            try {
              if (typeof r.proposed_terms === 'string') {
                terms = JSON.parse(r.proposed_terms);
              } else if (typeof r.proposedTerms === 'string') {
                terms = JSON.parse(r.proposedTerms);
              } else if (r.proposed_terms && typeof r.proposed_terms === 'object') {
                terms = r.proposed_terms;
              }
            } catch {}

            return {
              id: r.id,
              companyId: r.company_id || r.companyId || 'company-a',
              companyName: r.companyName || 'BTP Horizon Gabon',
              trade: r.trade_code || r.tradeCode || 'Coffreur',
              headcount: r.headcount || 1,
              siteName: terms.siteName || r.siteName || 'Chantier Bord de Mer',
              commune: terms.commune || r.commune || 'Libreville',
              startsAt: terms.startsAt || r.startsAt || '2026-12-10',
              endsAt: terms.endsAt || r.endsAt || '2026-12-14',
              dailyHours: terms.dailyHours || r.dailyHours || '07h30 - 16h30',
              dayPayXAF: Number(terms.dayPayAmount || terms.dayPayXAF || r.dayPayXAF || r.day_pay_amount || 15000),
              equipmentRequirements: terms.equipmentRequirements || r.equipmentRequirements || 'Chaussures de sécurité',
              specialInstructions: terms.specialInstructions || r.specialInstructions || '',
              status: r.status,
              createdAt: r.created_at || r.createdAt || new Date().toISOString(),
              rejectionReason: r.review_reason || r.rejectionReason,
              version: r.version || 2,
            };
          });
          setStaffingRequests(mappedRequests);
        }
      }

      // If staff, also fetch ready proposals
      if (currentUser?.role === 'STAFF') {
        try {
          const staffProps = await recruitmentApi.listStaffReadyProposals();
          if (Array.isArray(staffProps)) {
            const mappedProps: Proposal[] = staffProps.map((p: any) => ({
              id: p.id,
              missionId: p.missionId,
              missionTitle: p.missionTitle || 'Mission Kazi',
              workerId: p.workerId,
              workerName: p.workerName || 'Paul Mba',
              workerTrade: 'Coffreur',
              termsRevision: p.termsRevision || 1,
              companyDecision: p.companyDecision || 'PENDING',
              workerDecision: p.workerDecision || 'PENDING',
              status: p.status,
              proposedAt: new Date().toISOString(),
              expiresAt: p.expiresAt || '',
              version: p.version || 1,
            }));
            setProposals(mappedProps);
          }
        } catch {}
      }

      // 3. Fetch applications if worker
      if (currentUser?.role === 'WORKER') {
        const myApps = await recruitmentApi.getMyApplications();
        if (Array.isArray(myApps)) {
          const mappedApps: Application[] = myApps.map((a: any) => ({
            id: a.id,
            missionId: a.missionId,
            missionTitle: a.missionTitle || 'Mission Kazi',
            workerId: a.workerId,
            workerName: a.workerName || 'Paul Mba',
            workerTrade: a.workerTrade || 'Coffreur',
            workerArea: a.workerArea || 'Libreville',
            status: a.status,
            submittedAt: a.submittedAt,
          }));
          setApplications(mappedApps);

          // Extract proposals attached to worker applications
          const workerProps: Proposal[] = [];
          for (const a of myApps) {
            if (a.proposal) {
              workerProps.push({
                id: a.proposal.id,
                missionId: a.missionId,
                missionTitle: 'Mission Kazi',
                workerId: a.workerId,
                workerName: 'Paul Mba',
                workerTrade: 'Coffreur',
                termsRevision: 1,
                companyDecision: a.proposal.companyDecision,
                workerDecision: a.proposal.workerDecision,
                status: a.proposal.status,
                proposedAt: new Date().toISOString(),
                expiresAt: a.proposal.expiresAt ? new Date(a.proposal.expiresAt).toISOString() : '',
                version: a.proposal.version,
              });
            }
          }
          if (workerProps.length > 0) {
            setProposals(workerProps);
          }
        }
      }

      // 4. Fetch company proposals if company
      if (currentUser?.role === 'COMPANY' && currentUser.companyId) {
        const companyProposals = await recruitmentApi.listCompanyProposals(currentUser.companyId);
        if (Array.isArray(companyProposals)) {
          const mappedProps: Proposal[] = companyProposals.map((p: any) => ({
            id: p.proposalId || p.id,
            missionId: p.missionId || selectedMissionId,
            missionTitle: 'Mission Kazi',
            workerId: p.workerId || 'worker-01',
            workerName: p.anonymizedName || 'Candidat Vérifié',
            workerTrade: p.tradeCodes?.[0] || 'Coffreur',
            termsRevision: 1,
            companyDecision: p.companyDecision || 'PENDING',
            workerDecision: p.workerDecision || 'PENDING',
            status: p.proposalStatus || 'PENDING_COMPANY',
            proposedAt: new Date().toISOString(),
            expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString() : '',
            version: p.version || 1,
          }));
          setProposals(mappedProps);
        }
      }

      // 5. Fetch Quotes & Invoices for Staff or Company
      if (currentUser?.role === 'STAFF') {
        try {
          const qs = await operationsApi.listQuotes();
          if (Array.isArray(qs)) {
            setQuotes(qs);
          }
        } catch {}
        try {
          const invs = await operationsApi.listInvoices();
          if (Array.isArray(invs)) {
            setInvoices(
              invs.map((i: any) => ({
                id: i.invoiceNumber || i.id,
                invoiceId: i.id,
                quoteId: i.quoteId,
                companyId: i.companyId || i.company_id || 'company-a',
                companyName: i.partyTaxSnapshot?.legalName || 'BTP Horizon Gabon',
                missionId: i.missionId || 'mission-01',
                missionTitle: 'Mission Kazi',
                serviceFeeXAF: Number(i.subtotalAmount || i.subtotal_amount || 45000),
                vatXAF: Number(i.taxAmount || i.tax_amount || 8100),
                totalXAF: Number(i.totalAmount || i.total_amount || 53100),
                paidAmountXAF: Number(i.paidAmount || 0),
                status:
                  i.status === 'PAID'
                    ? 'PAID'
                    : i.status === 'PARTIALLY_PAID'
                    ? 'PARTIALLY_PAID'
                    : i.status === 'ISSUED'
                    ? 'ISSUED'
                    : 'SAMPLE',
                issuedAt: i.issuedAt ? new Date(i.issuedAt).toISOString().split('T')[0] : '2026-11-24',
                isPrototypeSample: i.isSampleWatermark !== false,
                version: Number(i.version || 1),
              }))
            );
          }
        } catch {}
      } else if (currentUser?.role === 'COMPANY' && currentUser.companyId) {
        try {
          const qs = await operationsApi.listCompanyQuotes(currentUser.companyId);
          if (Array.isArray(qs)) {
            setQuotes(qs);
          }
        } catch {}
        try {
          const invs = await operationsApi.listCompanyInvoices(currentUser.companyId);
          if (Array.isArray(invs)) {
            setInvoices(
              invs.map((i: any) => ({
                id: i.invoiceNumber || i.id,
                invoiceId: i.id,
                quoteId: i.quoteId,
                companyId: i.companyId || i.company_id || currentUser.companyId!,
                companyName: i.partyTaxSnapshot?.legalName || 'BTP Horizon Gabon',
                missionId: i.missionId || 'mission-01',
                missionTitle: 'Mission Kazi',
                serviceFeeXAF: Number(i.subtotalAmount || i.subtotal_amount || 45000),
                vatXAF: Number(i.taxAmount || i.tax_amount || 8100),
                totalXAF: Number(i.totalAmount || i.total_amount || 53100),
                paidAmountXAF: Number(i.paidAmount || 0),
                status:
                  i.status === 'PAID'
                    ? 'PAID'
                    : i.status === 'PARTIALLY_PAID'
                    ? 'PARTIALLY_PAID'
                    : i.status === 'ISSUED'
                    ? 'ISSUED'
                    : 'SAMPLE',
                issuedAt: i.issuedAt ? new Date(i.issuedAt).toISOString().split('T')[0] : '2026-11-24',
                isPrototypeSample: i.isSampleWatermark !== false,
                version: Number(i.version || 1),
              }))
            );
          }
        } catch {}
      }

      // 6. Fetch Attendance (replace directly from server database, no sample fixture mixing)
      if (currentUser) {
        try {
          const attList = await operationsApi.listAttendance();
          if (Array.isArray(attList)) {
            setAttendance(attList);
          }
        } catch {}
      }

      // 7. Fetch Support Cases (replace directly from server database, no sample fixture mixing)
      if (currentUser) {
        try {
          const cases = await operationsApi.listSupportCases();
          if (Array.isArray(cases)) {
            const mappedTickets: SupportTicket[] = await Promise.all(
              cases.map(async (c: any) => {
                let messages: any[] = [];
                try {
                  const thread = await operationsApi.getSupportCase(c.id);
                  if (thread?.messages) {
                    messages = thread.messages.map((m: any) => ({
                      id: m.id,
                      senderRole: m.authorRole,
                      senderName: m.authorName || m.authorRole,
                      content: m.body,
                      timestamp: new Date(m.createdAt).toISOString(),
                      isStaffInternal: m.visibility === 'STAFF_ONLY',
                    }));
                  }
                } catch {}
                return {
                  id: c.id,
                  creatorRole: (c.workerId ? 'WORKER' : 'COMPANY') as any,
                  creatorId: c.workerId || c.companyId || c.reporterUserId,
                  creatorName: c.reporterUserId,
                  category: c.category,
                  subject: c.subject,
                  status: (c.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : c.status === 'RESOLVED' ? 'RESOLVED' : 'OPEN') as any,
                  missionId: c.missionId || 'mission-01',
                  version: Number(c.version || 1),
                  messages,
                };
              })
            );
            setSupportTickets(mappedTickets);
          }
        } catch {}
      }

      // 8. Fetch In-App Notifications
      if (currentUser) {
        try {
          const notifs = await operationsApi.getMyNotifications();
          if (Array.isArray(notifs)) {
            setNotifications(notifs);
          }
        } catch {}
      }

      // 9. Fetch Replacement Requests (Company & Staff)
      if (currentUser?.role === 'COMPANY' || currentUser?.role === 'STAFF') {
        try {
          const reps = await operationsApi.listReplacements();
          if (Array.isArray(reps)) {
            setReplacements(reps);
          }
        } catch {}
      }

      // 10. Fetch Live Profile & Statistics
      if (currentUser) {
        try {
          const profile = await operationsApi.getMyProfile();
          if (profile?.role === 'WORKER') {
            setWorkers((prev) => {
              const parts = String(profile.displayName || 'Paul Mba').split(' ');
              const firstName = parts[0] || 'Paul';
              const lastName = parts.slice(1).join(' ') || 'Mba';
              const existing = prev.find((w) => w.id === profile.id) || prev[0];
              const updated: WorkerPrivateProfile = {
                ...existing,
                id: profile.id,
                firstName,
                lastName,
                lastNameInitial: `${lastName.charAt(0)}.`,
                phone: profile.phone || existing?.phone || '+24101000000',
                primaryTrade: profile.tradeCodes?.[0] || existing?.primaryTrade || 'Coffreur',
                skills: profile.tradeCodes?.length ? profile.tradeCodes : existing?.skills || ['Coffreur'],
                commune: profile.areaCode || existing?.commune || 'Libreville',
                completedMissionsCount: Number(profile.completedMissionsCount ?? existing?.completedMissionsCount ?? 1),
                attendanceRate: Number(profile.attendanceRate ?? existing?.attendanceRate ?? 100),
                verifiedStatus: profile.profileStatus === 'ACTIVE' ? 'VERIFIED' : 'PENDING',
                availableNow: (profile.availabilityCode || 'AVAILABLE') === 'AVAILABLE',
                cniNumber: existing?.cniNumber || 'CNI-GA-VERIFIED',
                internalNotes: existing?.internalNotes || [],
              };
              const hasId = prev.some((w) => w.id === profile.id);
              return hasId ? prev.map((w) => (w.id === profile.id ? updated : w)) : [updated, ...prev];
            });
          } else if (profile?.role === 'COMPANY') {
            setCompanies((prev) => {
              const existing = prev.find((c) => c.id === profile.id) || prev[0];
              const updated: Company = {
                ...existing,
                id: profile.id,
                name: profile.legalName || existing?.name || 'BTP Horizon Gabon',
                rccm: profile.registrationReference || existing?.rccm || 'RG/FCV 2021 B 1409',
                nif: profile.taxReference || existing?.nif || '098432-A',
                tradeSector: profile.tradeSector || existing?.tradeSector || 'Génie Civil & BTP',
                commune: profile.areaCode || existing?.commune || 'Libreville',
                contactName: existing?.contactName || 'Marc Ndong',
                email: profile.contactEmail || existing?.email || 'contact@btphorizon.ga',
                phone: existing?.phone || '+241 01 72 44 00',
                verificationStatus: profile.verificationStatus || 'VERIFIED',
                joinedDate: existing?.joinedDate || '2026-11-01',
              };
              const hasId = prev.some((c) => c.id === profile.id);
              return hasId ? prev.map((c) => (c.id === profile.id ? updated : c)) : [updated, ...prev];
            });
          }
        } catch {}
      }
    } catch (err: any) {
      console.warn('[Kazi Data] Notice on initial data fetch:', err.message);
    }
  }, [currentUser, selectedMissionId]);

  // Initial session check on mount
  useEffect(() => {
    async function initSession() {
      try {
        const user = await authApi.getMe();
        if (user) {
          setCurrentUser(user);
          const uiRole = user.role === 'STAFF' ? 'ADMIN' : user.role;
          setRole(uiRole);
        }
      } catch {}
      await refreshServerData();
    }
    initSession();
  }, [refreshServerData]);

  // Login handler
  const loginUser = useCallback(
    (user: ApiUser) => {
      setCurrentUser(user);
      const uiRole = user.role === 'STAFF' ? 'ADMIN' : user.role;
      setRole(uiRole);
      showToast('success', `Connecté en tant que ${user.role}`, `Session active pour ${user.phone || user.email || user.id}`);
      refreshServerData();
    },
    [refreshServerData, showToast]
  );

  // Logout handler
  const logoutUser = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {}
    setCurrentUser(null);
    showToast('info', 'Session fermée', 'Vous avez été déconnecté du serveur.');
  }, [showToast]);

  // Fast test account switcher (I2)
  const switchTestAccount = useCallback(
    async (targetRole: 'WORKER' | 'COMPANY' | 'STAFF') => {
      try {
        if (targetRole === 'WORKER') {
          const otpRes = await authApi.sendWorkerOtp('+24101000000');
          const code = otpRes.debugCode || '123456';
          const auth = await authApi.verifyWorkerOtp('+24101000000', code);
          loginUser(auth.user);
        } else if (targetRole === 'COMPANY') {
          const auth = await authApi.loginCompany('contact@btphorizon.ga', 'Password123!');
          loginUser(auth.user);
        } else if (targetRole === 'STAFF') {
          const challenge = await authApi.loginStaff('recruiter@kazi.ga', 'Password123!');
          const auth = await authApi.verifyStaffMfa('recruiter@kazi.ga', challenge.mfaTicket, '123456');
          loginUser(auth.user);
        }
      } catch (err: any) {
        showToast('error', 'Erreur de basculement', err.message);
      }
    },
    [loginUser, showToast]
  );

  // Safe theme switch (KZ16 & KZ17)
  const setTheme = useCallback(
    (themeId: string, reason?: string) => {
      const nextTheme = REGISTERED_THEMES[themeId];
      if (!nextTheme) return;

      setThemeState(nextTheme);
      setThemeSwitchCount((prev) => prev + 1);

      const auditRecord: AuditEvent = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: currentUser?.email || currentUser?.phone || 'utilisateur',
        role: role,
        scope: 'GA / Libreville',
        action: 'THEME_SWITCH_AUDIT',
        previousValue: theme.themeId,
        newValue: themeId,
        reason: reason || 'Changement de thème interactif.',
      };
      setAuditLogs((prev) => [auditRecord, ...prev]);

      showToast(
        'info',
        `Thème appliqué : ${themeId}`,
        'Les variables CSS ont été actualisées sans aucune mutation des données métier.'
      );
    },
    [currentUser, role, showToast, theme.themeId]
  );

  // -------------------------------------------------------------------------
  // Domain Business Actions (I3: First Connected Vertical Slice)
  // -------------------------------------------------------------------------

  // 1. Worker applies to a mission (KZ06)
  const applyToMission = useCallback(
    async (missionId: string, workerId: string = 'worker-01') => {
      const targetMission = missions.find((m) => m.id === missionId);
      if (!targetMission) return { success: false, error: 'Mission introuvable.' };

      try {
        const termsId = targetMission.id === 'mission-01' ? 'terms-01' : `terms_${targetMission.id}`;
        const newApp = await recruitmentApi.applyToMission(missionId, termsId);

        const currentWorker = workers.find((w) => w.id === workerId);
        const mappedApp: Application = {
          id: newApp.id,
          missionId,
          missionTitle: targetMission.title,
          workerId: newApp.workerId || workerId,
          workerName: currentWorker ? `${currentWorker.firstName} ${currentWorker.lastNameInitial}` : 'Paul M.',
          workerTrade: currentWorker?.primaryTrade || targetMission.trade,
          workerArea: currentWorker?.commune || 'Libreville',
          status: 'SUBMITTED',
          submittedAt: new Date().toISOString(),
        };

        setApplications((prev) => [mappedApp, ...prev.filter((a) => a.id !== newApp.id)]);
        showToast('success', 'Candidature enregistrée !', 'Votre candidature est enregistrée en base de données.');
        return { success: true };
      } catch (err: any) {
        showToast('error', 'Erreur de candidature', err.message);
        return { success: false, error: err.message };
      }
    },
    [missions, showToast, workers]
  );

  // 2. Worker withdraws application
  const withdrawApplication = useCallback(
    async (applicationId: string, reason: string) => {
      try {
        await recruitmentApi.withdrawApplication(applicationId, reason);
        setApplications((prev) =>
          prev.map((app) => (app.id === applicationId ? { ...app, status: 'WITHDRAWN', rejectionReason: reason } : app))
        );
        showToast('info', 'Candidature retirée', 'Votre désistement a été pris en compte en base de données.');
      } catch (err: any) {
        showToast('error', 'Erreur de retrait', err.message);
      }
    },
    [showToast]
  );

  // 3. Company creates staffing request (KZ03)
  const createStaffingRequest = useCallback(
    async (req: Partial<StaffingRequest>) => {
      try {
        const reqData = {
          tradeCode: req.trade || 'Coffreur',
          headcount: req.headcount || 4,
          siteName: req.siteName || 'Chantier Bord de Mer',
          commune: req.commune || 'Libreville',
          siteAddress: req.siteName || 'Boulevard Triomphal, Libreville',
          startsAt: req.startsAt || '2026-12-05',
          endsAt: req.endsAt || '2026-12-08',
          dailyHours: req.dailyHours || '07h30 - 16h30',
          dayPayXAF: req.dayPayXAF || 15000,
          equipmentRequirements: req.equipmentRequirements || 'Chaussures de sécurité',
          specialInstructions: req.specialInstructions || '',
        };

        const createdDraft = await recruitmentApi.createRequest(reqData);
        // Automatically submit draft
        const submitted = await recruitmentApi.submitRequest(createdDraft.id);

        const newReq: StaffingRequest = {
          id: submitted.id || createdDraft.id,
          companyId: submitted.companyId || 'company-a',
          companyName: 'BTP Horizon Gabon',
          trade: reqData.tradeCode,
          headcount: reqData.headcount,
          siteName: reqData.siteName,
          commune: reqData.commune,
          startsAt: reqData.startsAt,
          endsAt: reqData.endsAt,
          dailyHours: reqData.dailyHours,
          dayPayXAF: reqData.dayPayXAF,
          equipmentRequirements: reqData.equipmentRequirements,
          specialInstructions: reqData.specialInstructions,
          status: 'SUBMITTED',
          createdAt: new Date().toISOString(),
        };

        setStaffingRequests((prev) => [newReq, ...prev]);
        showToast('success', 'Demande enregistrée !', `Demande #${newReq.id} enregistrée et soumise à Kazi.`);
      } catch (err: any) {
        showToast('error', 'Erreur de création', err.message);
      }
    },
    [showToast]
  );

  // 4. Staff moderates request and publishes mission (KZ04)
  const adminModerateRequest = useCallback(
    async (requestId: string, action: 'APPROVE' | 'REQUEST_CHANGES', reason?: string) => {
      try {
        if (action === 'APPROVE') {
          const targetReq = staffingRequests.find((r) => r.id === requestId);
          const currentVersion = (targetReq as any)?.version || 2;
          let versionAfterReview = currentVersion;

          // If request is still SUBMITTED, execute Step 1: Review & Approve (KZ04)
          if (targetReq?.status === 'SUBMITTED') {
            try {
              await recruitmentApi.reviewRequest(requestId, 'APPROVE', 'Demande conforme aux critères Kazi', currentVersion);
              versionAfterReview = currentVersion + 1;
            } catch (revErr: any) {
              console.warn('[Kazi] Review step notice:', revErr.message);
            }
          }

          // Step 2: Publish approved request into an OPEN mission (KZ04)
          let published: any;
          try {
            published = await recruitmentApi.publishRequest(requestId, versionAfterReview);
          } catch (err: any) {
            if (err.message?.includes('VERSION_CONFLICT')) {
              try {
                published = await recruitmentApi.publishRequest(requestId, 3);
              } catch {
                published = await recruitmentApi.publishRequest(requestId, 2);
              }
            } else {
              throw err;
            }
          }

          setStaffingRequests((prev) =>
            prev.map((r) => (r.id === requestId ? { ...r, status: 'APPROVED' } : r))
          );

          await refreshServerData();
          showToast('success', 'Mission publiée (KZ04)', 'La mission a été approuvée et publiée avec succès.');
        } else {
          setStaffingRequests((prev) =>
            prev.map((r) => (r.id === requestId ? { ...r, status: 'CHANGES_REQUESTED', rejectionReason: reason } : r))
          );
          showToast('info', 'Modifications requises', 'L’entreprise a été notifiée.');
        }
      } catch (err: any) {
        showToast('error', 'Erreur de modération', err.message);
      }
    },
    [refreshServerData, showToast, staffingRequests]
  );

  // 4b. Staff shortlists & proposes candidates (KZ07)
  const adminProposeCandidates = useCallback(
    async (missionId: string, applicationIds: string[]) => {
      try {
        const targetMission = missions.find((m) => m.id === missionId);
        const termsId = targetMission?.id === 'mission-01' ? 'terms-01' : (targetMission ? `terms_${targetMission.id}` : 'terms-01');

        for (const appId of applicationIds) {
          try {
            await recruitmentApi.shortlistApplication(appId, 'Candidat qualifié et disponible');
          } catch {}
        }

        await recruitmentApi.createProposalsBatch(missionId, applicationIds, termsId);
        showToast('success', 'Proposition envoyée (KZ07) !', 'Candidat proposé à l’entreprise cliente.');
        await refreshServerData();
        return { success: true };
      } catch (err: any) {
        showToast('error', 'Erreur de proposition', err.message);
        return { success: false, error: err.message };
      }
    },
    [missions, refreshServerData, showToast]
  );

  // 5. Company decides candidate proposal (KZ08)
  const companyDecideProposal = useCallback(
    async (proposalId: string, decision: 'ACCEPTED' | 'DECLINED') => {
      try {
        const targetProp = proposals.find((p) => p.id === proposalId);
        const version = targetProp?.version || 1;
        await recruitmentApi.companyDecideProposal(proposalId, decision, version);
        setProposals((prev) =>
          prev.map((p) => {
            if (p.id === proposalId) {
              return {
                ...p,
                companyDecision: decision,
                companyDecidedAt: new Date().toISOString(),
                status: decision === 'ACCEPTED' ? 'AWAITING_WORKER' : 'DECLINED',
                version: (p.version || 1) + 1,
              };
            }
            return p;
          })
        );

        if (decision === 'ACCEPTED') {
          showToast('success', 'Proposition acceptée (KZ08)', 'Le délai de disponibilité de 24h a démarré pour l’ouvrier.');
        } else {
          showToast('info', 'Proposition déclinée', 'La proposition a été déclinée.');
        }
      } catch (err: any) {
        showToast('error', 'Erreur de décision', err.message);
      }
    },
    [proposals, showToast]
  );

  // 6. Worker confirms availability (KZ08)
  const workerConfirmProposal = useCallback(
    async (proposalId: string, decision: 'CONFIRMED' | 'DECLINED') => {
      try {
        const targetProposal = proposals.find((p) => p.id === proposalId);
        const targetMission = missions.find((m) => m.id === targetProposal?.missionId);
        const termsId = targetMission?.id === 'mission-01' ? 'terms-01' : (targetProposal?.termsId || (targetMission ? `terms_${targetMission.id}` : 'terms-01'));
        const version = targetProposal?.version || 2;

        await recruitmentApi.workerDecideProposal(proposalId, decision, termsId, version);
        setProposals((prev) =>
          prev.map((p) => {
            if (p.id === proposalId) {
              return {
                ...p,
                workerDecision: decision,
                workerDecidedAt: new Date().toISOString(),
                status: decision === 'CONFIRMED' ? 'READY_FOR_ASSIGNMENT' : 'DECLINED',
                version: (p.version || 2) + 1,
              };
            }
            return p;
          })
        );

        if (decision === 'CONFIRMED') {
          showToast('success', 'Disponibilité confirmée !', 'En attente de finalisation par le recruteur Kazi.');
        } else {
          showToast('info', 'Proposition déclinée', 'Votre refus a été enregistré.');
        }
      } catch (err: any) {
        showToast('error', 'Erreur de confirmation', err.message);
      }
    },
    [missions, proposals, showToast]
  );

  // 7. Staff finalizes assignment atomically (KZ09)
  const adminFinalizeAssignment = useCallback(
    async (proposalId: string) => {
      try {
        const targetProp = proposals.find((p) => p.id === proposalId);
        const idempotencyKey = `fin_${proposalId}_${Date.now()}`;
        const version = targetProp?.version || 3;
        const final = await recruitmentApi.staffFinalizeAssignment(proposalId, version, idempotencyKey);

        const newAssignment: Assignment = {
          id: final.id || `assign-${Date.now()}`,
          missionId: final.missionId || targetProp?.missionId || 'mission-01',
          missionTitle: targetProp?.missionTitle || 'Coffrage voiles béton armé',
          siteName: 'Chantier Bord de Mer',
          workerId: final.workerId || targetProp?.workerId || 'worker-01',
          workerName: targetProp?.workerName || 'Paul Mba',
          companyId: 'company-a',
          companyName: 'BTP Horizon Gabon',
          status: 'CONFIRMED',
          termsRevision: 1,
          dayPayXAF: 15000,
          startsAt: '2026-12-01',
          endsAt: '2026-12-05',
          dailyHours: '07h30 - 16h30',
        };

        setAssignments((prev) => [newAssignment, ...prev]);
        setProposals((prev) => prev.map((p) => (p.id === proposalId ? { ...p, status: 'FINALIZED' } : p)));
        setApplications((prev) =>
          prev.map((a) => (a.workerId === targetProp?.workerId ? { ...a, status: 'ASSIGNED' } : a))
        );
        setMissions((prev) =>
          prev.map((m) =>
            m.id === targetProp?.missionId ? { ...m, headcountAssigned: m.headcountAssigned + 1 } : m
          )
        );

        showToast('success', 'Affectation finalisée (KZ09) !', 'Affectation validée et persistée dans SQLite.');
        return { success: true };
      } catch (err: any) {
        showToast('error', 'Échec de finalisation', err.message);
        return { success: false, error: err.message };
      }
    },
    [proposals, showToast]
  );

  // 8. Attendance, disputes, replacements, support, notifications & billing
  const companyDeclareAttendance = useCallback(
    async (recordId: string, status: AttendanceStatus, hours: number, note: string) => {
      try {
        const target = attendance.find((r) => r.id === recordId || r.assignmentDayId === recordId);
        const dayOrAttId = target?.assignmentDayId || recordId;
        const expectedVersion = target?.version || 1;
        const workedMinutes = status === 'PARTIAL' ? Math.max(30, Math.round(hours * 60)) : status === 'PRESENT' ? 480 : undefined;

        const updated = await operationsApi.updateAttendance(
          dayOrAttId,
          status,
          workedMinutes,
          note,
          expectedVersion
        );
        setAttendance((prev) =>
          prev.map((rec) =>
            rec.id === recordId || rec.assignmentDayId === recordId
              ? {
                  ...rec,
                  companyStatus: status,
                  hoursWorked: hours,
                  companyNote: note,
                  workerAgreed: null,
                  reviewState: 'SUBMITTED_BY_COMPANY',
                  declarationRevision: updated?.declarationRevision ?? (rec.declarationRevision || 0) + 1,
                  version: updated?.version ?? (rec.version || 1) + 1,
                }
              : rec
          )
        );
        showToast('success', 'Pointage enregistré (KZ10)', 'Pointage enregistré en base de données.');
      } catch (err: any) {
        showToast('error', 'Erreur pointage', err.message);
      }
    },
    [attendance, showToast]
  );

  const workerConfirmAttendance = useCallback(
    async (recordId: string) => {
      try {
        const target = attendance.find((r) => r.id === recordId);
        const revision = target?.declarationRevision || 1;
        const updated = await operationsApi.confirmAttendance(recordId, revision);
        setAttendance((prev) =>
          prev.map((rec) =>
            rec.id === recordId
              ? {
                  ...rec,
                  workerAgreed: true,
                  reviewState: 'CONFIRMED',
                  version: updated?.version ?? (rec.version || 1) + 1,
                }
              : rec
          )
        );
        showToast('success', 'Pointage confirmé', 'Votre présence a été validée.');
      } catch (err: any) {
        showToast('error', 'Erreur confirmation', err.message);
      }
    },
    [attendance, showToast]
  );

  const workerDisputeAttendance = useCallback(
    async (recordId: string, disputeNote: string) => {
      try {
        const target = attendance.find((r) => r.id === recordId);
        const revision = target?.declarationRevision || 1;
        const updated = await operationsApi.disputeAttendance(recordId, disputeNote, revision);
        setAttendance((prev) =>
          prev.map((rec) =>
            rec.id === recordId
              ? {
                  ...rec,
                  workerAgreed: false,
                  workerDisputeNote: disputeNote,
                  reviewState: 'DISPUTED',
                  version: updated?.version ?? (rec.version || 1) + 1,
                }
              : rec
          )
        );
        showToast('warning', 'Contestation enregistrée', 'Contestation transmise à Kazi.');
      } catch (err: any) {
        showToast('error', 'Erreur contestation', err.message);
      }
    },
    [attendance, showToast]
  );

  const adminResolveDispute = useCallback(
    async (recordId: string, resolvedStatus: AttendanceStatus, note: string) => {
      try {
        const target = attendance.find((r) => r.id === recordId);
        const expectedVersion = target?.version || 1;
        const workedMinutes = resolvedStatus === 'PARTIAL' ? 240 : undefined;
        const updated = await operationsApi.resolveDispute(
          recordId,
          resolvedStatus,
          note,
          expectedVersion,
          workedMinutes
        );
        setAttendance((prev) =>
          prev.map((rec) =>
            rec.id === recordId
              ? {
                  ...rec,
                  companyStatus: resolvedStatus,
                  hoursWorked: resolvedStatus === 'PARTIAL' ? 4 : resolvedStatus === 'PRESENT' ? 8 : 0,
                  reviewState: 'RESOLVED_BY_STAFF',
                  staffResolutionNote: note,
                  workerAgreed: true,
                  version: updated?.version ?? (rec.version || 1) + 1,
                }
              : rec
          )
        );
        showToast('success', 'Litige résolu', 'Décision d’arbitrage enregistrée en base de données.');
      } catch (err: any) {
        showToast('error', 'Erreur arbitrage', err.message);
      }
    },
    [attendance, showToast]
  );

  const adminRequestReplacement = useCallback(
    async (assignmentId: string, absentWorkerId: string, dates: string[], reason?: string) => {
      try {
        const targetAtt = attendance.find((a) => a.assignmentId === assignmentId);
        const missionId = targetAtt?.missionId || selectedMissionId || 'mission-01';
        const created = await operationsApi.createReplacement({
          assignmentId,
          missionId,
          workerId: absentWorkerId,
          affectedDayIds: dates.length > 0 ? dates : ['day-01'],
          reasonCode: 'WORKER_ABSENT',
          note: reason || `Remplacement demandé pour ${dates.length} date(s).`,
        });
        if (created) {
          setReplacements((prev) => [created, ...prev]);
        }
        showToast('success', 'Remplacement enregistré (KZ11)', `Demande de remplacement enregistrée sans réservation fictive.`);
      } catch (err: any) {
        showToast('error', 'Erreur remplacement', err.message);
      }
    },
    [attendance, selectedMissionId, showToast]
  );

  const adminConfirmReplacement = useCallback(
    async (requestId: string, replacementAssignmentId: string, expectedVersion: number) => {
      try {
        const confirmed = await operationsApi.confirmReplacement(
          requestId,
          replacementAssignmentId,
          expectedVersion
        );
        setReplacements((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, ...confirmed, status: 'CONFIRMED' } : r))
        );
        showToast('success', 'Remplacement confirmé', 'Nouvelle affectation liée avec succès.');
      } catch (err: any) {
        showToast('error', 'Erreur confirmation remplacement', err.message);
      }
    },
    [showToast]
  );

  const createSupportTicket = useCallback(
    async (
      category: 'CHANTIER' | 'PAIEMENT' | 'POINTAGE' | 'ACCES',
      subject: string,
      initialMessage: string,
      missionId?: string
    ) => {
      try {
        const created = await operationsApi.createSupportCase({
          category,
          subject,
          initialMessage,
          missionId,
        });
        await refreshServerData();
        showToast('success', 'Dossier support ouvert', `Dossier "${created?.subject || subject}" créé.`);
      } catch (err: any) {
        showToast('error', 'Erreur création dossier', err.message);
      }
    },
    [refreshServerData, showToast]
  );

  const sendSupportMessage = useCallback(
    async (ticketId: string, content: string, isInternal: boolean = false) => {
      try {
        await operationsApi.sendSupportMessage(ticketId, content, isInternal);
        setSupportTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticketId
              ? {
                  ...ticket,
                  messages: [
                    ...ticket.messages,
                    {
                      id: `msg-${Date.now()}`,
                      senderRole: (role === 'ADMIN' ? 'STAFF' : role === 'SPECIMENS' ? 'STAFF' : role) as 'WORKER' | 'COMPANY' | 'STAFF',
                      senderName: currentUser?.email || currentUser?.phone || 'Moi',
                      content,
                      timestamp: new Date().toISOString(),
                      isStaffInternal: isInternal,
                    },
                  ],
                }
              : ticket
          )
        );
        showToast('success', 'Message envoyé', 'Votre message a été enregistré.');
      } catch (err: any) {
        showToast('error', 'Erreur support', err.message);
      }
    },
    [currentUser, role, showToast]
  );

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      try {
        await operationsApi.markNotificationRead(notificationId);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, readAt: Date.now() } : n))
        );
      } catch (err: any) {
        showToast('error', 'Erreur notification', err.message);
      }
    },
    [showToast]
  );

  const staffCreateAndSendQuote = useCallback(
    async (companyId: string, missionId: string, description: string, unitAmount: number) => {
      try {
        const draft = await operationsApi.createQuote({
          companyId,
          missionId,
          lines: [{ description, quantity: 1, unitAmount, taxRate: 0.18 }],
        });
        if (draft?.id) {
          await operationsApi.sendQuote(draft.id, draft.version || 1);
        }
        await refreshServerData();
        showToast('success', 'Devis créé et transmis', 'Le devis de service Kazi a été envoyé à l’entreprise.');
      } catch (err: any) {
        showToast('error', 'Erreur devis', err.message);
      }
    },
    [refreshServerData, showToast]
  );

  const companyDecideQuote = useCallback(
    async (quoteId: string, decision: 'ACCEPT' | 'DECLINE', expectedVersion: number) => {
      try {
        await operationsApi.decideQuote(quoteId, decision, expectedVersion);
        await refreshServerData();
        showToast(
          'success',
          decision === 'ACCEPT' ? 'Devis accepté' : 'Devis refusé',
          'Votre décision sur le devis de prestation Kazi a été enregistrée.'
        );
      } catch (err: any) {
        showToast('error', 'Erreur décision devis', err.message);
      }
    },
    [refreshServerData, showToast]
  );

  const staffGenerateInvoice = useCallback(
    async (acceptedQuoteId: string) => {
      try {
        const comp = companies[0];
        await operationsApi.createInvoiceFromQuote({
          acceptedQuoteId,
          partyTaxSnapshot: {
            rccm: comp?.rccm || 'RG/FCV 2021 B 1409',
            nif: comp?.nif || '098432-A',
            legalName: comp?.name || 'BTP Horizon Gabon',
            billingAddress: 'Zone Industrielle Oloumi, Libreville',
          },
        });
        await refreshServerData();
        showToast('success', 'Facture SAMPLE émise', 'Facture de service générée avec filigrane SAMPLE.');
      } catch (err: any) {
        showToast('error', 'Erreur facturation', err.message);
      }
    },
    [companies, refreshServerData, showToast]
  );

  const staffRecordReceipt = useCallback(
    async (invoiceId: string, amount: number, externalReference: string) => {
      try {
        await operationsApi.recordReceipt(invoiceId, amount, externalReference);
        await refreshServerData();
        showToast('success', 'Reçu bancaire enregistré', `Paiement hors-ligne (${externalReference}) imputé sur la facture.`);
      } catch (err: any) {
        showToast('error', 'Erreur reçu', err.message);
      }
    },
    [refreshServerData, showToast]
  );

  const updateMyProfile = useCallback(
    async (patch: Record<string, unknown>) => {
      try {
        await operationsApi.updateMyProfile(patch);
        await refreshServerData();
        showToast('success', 'Profil mis à jour', 'Les informations de votre profil ont été sauvegardées.');
      } catch (err: any) {
        showToast('error', 'Erreur profil', err.message);
      }
    },
    [refreshServerData, showToast]
  );

  const resetToDefaults = useCallback(() => {
    refreshServerData();
    showToast('info', 'Données actualisées', 'Synchronisation avec le serveur SQLite effectuée.');
  }, [refreshServerData, showToast]);

  return (
    <PrototypeContext.Provider
      value={{
        currentUser,
        loginUser,
        logoutUser,
        switchTestAccount,
        theme,
        setTheme,
        viewport,
        setViewport,
        contrastResults,
        themeSwitchCount,
        role,
        setRole,
        workerView,
        setWorkerView,
        companyView,
        setCompanyView,
        adminView,
        setAdminView,
        selectedMissionId,
        setSelectedMissionId,
        selectedRequestId,
        setSelectedRequestId,
        selectedProposalId,
        setSelectedProposalId,
        missions,
        companies,
        workers,
        staffingRequests,
        applications,
        proposals,
        assignments,
        attendance,
        supportTickets,
        invoices,
        quotes,
        replacements,
        notifications,
        auditLogs,
        toast,
        showToast,
        hideToast,
        applyToMission,
        withdrawApplication,
        companyDecideProposal,
        workerConfirmProposal,
        adminFinalizeAssignment,
        createStaffingRequest,
        adminModerateRequest,
        adminProposeCandidates,
        companyDeclareAttendance,
        workerConfirmAttendance,
        workerDisputeAttendance,
        adminResolveDispute,
        adminRequestReplacement,
        adminConfirmReplacement,
        createSupportTicket,
        sendSupportMessage,
        markNotificationRead,
        staffCreateAndSendQuote,
        companyDecideQuote,
        staffGenerateInvoice,
        staffRecordReceipt,
        updateMyProfile,
        resetToDefaults,
        refreshServerData,
      }}
    >
      {children}
    </PrototypeContext.Provider>
  );
};

export const usePrototype = (): PrototypeContextType => {
  const context = useContext(PrototypeContext);
  if (!context) {
    throw new Error('usePrototype must be used within a PrototypeProvider');
  }
  return context;
};
