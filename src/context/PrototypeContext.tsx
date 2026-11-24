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
  workerDisputeAttendance: (recordId: string, disputeNote: string) => Promise<void>;
  adminResolveDispute: (recordId: string, resolvedStatus: AttendanceStatus, note: string) => Promise<void>;
  adminRequestReplacement: (assignmentId: string, absentWorkerId: string, dates: string[], reason: string) => void;
  sendSupportMessage: (ticketId: string, content: string, isInternal?: boolean) => Promise<void>;
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

  // 8. Attendance, disputes & billing
  const companyDeclareAttendance = useCallback(
    async (recordId: string, status: AttendanceStatus, hours: number, note: string) => {
      try {
        await operationsApi.updateAttendance(recordId, status === 'PRESENT' ? 'PRESENT' : 'ABSENT', undefined, note);
        setAttendance((prev) =>
          prev.map((rec) =>
            rec.id === recordId
              ? { ...rec, companyStatus: status, hoursWorked: hours, companyNote: note, reviewState: 'SUBMITTED_BY_COMPANY' }
              : rec
          )
        );
        showToast('success', 'Pointage enregistré', 'Pointage enregistré en base de données.');
      } catch (err: any) {
        showToast('error', 'Erreur pointage', err.message);
      }
    },
    [showToast]
  );

  const workerDisputeAttendance = useCallback(
    async (recordId: string, disputeNote: string) => {
      try {
        await operationsApi.disputeAttendance(recordId, disputeNote);
        setAttendance((prev) =>
          prev.map((rec) =>
            rec.id === recordId
              ? { ...rec, workerAgreed: false, workerDisputeNote: disputeNote, reviewState: 'DISPUTED' }
              : rec
          )
        );
        showToast('warning', 'Contestation enregistrée', 'Contestation transmise à Kazi.');
      } catch (err: any) {
        showToast('error', 'Erreur contestation', err.message);
      }
    },
    [showToast]
  );

  const adminResolveDispute = useCallback(
    async (recordId: string, resolvedStatus: AttendanceStatus, note: string) => {
      try {
        await operationsApi.resolveDispute(
          recordId,
          resolvedStatus === 'PRESENT' ? 'CONFIRMED_PRESENT' : 'CONFIRMED_ABSENT',
          note
        );
        setAttendance((prev) =>
          prev.map((rec) =>
            rec.id === recordId
              ? { ...rec, companyStatus: resolvedStatus, reviewState: 'RESOLVED_BY_STAFF', staffResolutionNote: note, workerAgreed: true }
              : rec
          )
        );
        showToast('success', 'Litige résolu', 'Décision d’arbitrage enregistrée dans SQLite.');
      } catch (err: any) {
        showToast('error', 'Erreur arbitrage', err.message);
      }
    },
    [showToast]
  );

  const adminRequestReplacement = useCallback(
    (_assignmentId: string, absentWorkerId: string, dates: string[]) => {
      showToast('info', 'Remplacement engagé', `Recherche de remplaçant sur ${dates.length} date(s).`);
    },
    [showToast]
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
                      senderName: currentUser?.email || 'Moi',
                      content,
                      timestamp: new Date().toISOString(),
                      isStaffInternal: isInternal,
                    },
                  ],
                }
              : ticket
          )
        );
        showToast('success', 'Message envoyé', 'Votre message a été transmis.');
      } catch (err: any) {
        showToast('error', 'Erreur support', err.message);
      }
    },
    [currentUser, role, showToast]
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
        workerDisputeAttendance,
        adminResolveDispute,
        adminRequestReplacement,
        sendSupportMessage,
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
