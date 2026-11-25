// Kazi Client API Client Layer
// Strictly implements I2 and I3: handles real authenticated HTTP calls with cookies/Bearer tokens
// Communicates with /api endpoints exposed by Kazi Node HTTP server

export interface ApiUser {
  id: string;
  role: 'WORKER' | 'COMPANY' | 'STAFF';
  countryCode: string;
  email?: string;
  phone?: string;
  companyId?: string;
  workerProfileId?: string;
  capabilities?: string[];
  mfaVerified?: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  meta?: any;
  error?: {
    code: string;
    message?: string;
    messageKey?: string;
    fields?: Record<string, string[]>;
  };
}

class ApiError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string[]>;

  constructor(code: string, message: string, status: number, fields?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

let activeSessionToken: string | null = null;

export function setClientSessionToken(token: string | null): void {
  activeSessionToken = token;
  if (token) {
    try {
      localStorage.setItem('kazi_client_token', token);
    } catch {}
  } else {
    try {
      localStorage.removeItem('kazi_client_token');
    } catch {}
  }
}

export function getClientSessionToken(): string | null {
  if (activeSessionToken) return activeSessionToken;
  try {
    return localStorage.getItem('kazi_client_token');
  } catch {
    return null;
  }
}

export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getClientSessionToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.method && options.method !== 'GET' && options.method !== 'HEAD') {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // Sends kazi_session HttpOnly cookie
  });

  const contentType = response.headers.get('content-type') || '';
  let body: any = null;
  if (contentType.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  if (!response.ok) {
    const errorInfo = body?.error || {};
    throw new ApiError(
      errorInfo.code || `HTTP_${response.status}`,
      errorInfo.message || `Request failed with status ${response.status}`,
      response.status,
      errorInfo.fields
    );
  }

  return body?.data !== undefined ? body.data : body;
}

// -------------------------------------------------------------------------
// Auth API Endpoints
// -------------------------------------------------------------------------

export const authApi = {
  // Worker OTP
  async sendWorkerOtp(phone: string): Promise<{ sent: boolean; debugCode?: string }> {
    return request('/api/auth/worker/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  },

  async verifyWorkerOtp(phone: string, code: string): Promise<{ sessionToken: string; user: ApiUser }> {
    const res = await request<{ sessionToken: string; user: ApiUser }>('/api/auth/worker/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
    setClientSessionToken(res.sessionToken);
    return res;
  },

  // Company Register & Login
  async registerCompany(data: any): Promise<{ sessionToken: string; user: ApiUser; company: any }> {
    const res = await request<{ sessionToken: string; user: ApiUser; company: any }>('/api/auth/company/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setClientSessionToken(res.sessionToken);
    return res;
  },

  async loginCompany(email: string, password: string): Promise<{ sessionToken: string; user: ApiUser }> {
    const res = await request<{ sessionToken: string; user: ApiUser }>('/api/auth/company/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setClientSessionToken(res.sessionToken);
    return res;
  },

  // Staff Login & MFA
  async loginStaff(email: string, password: string): Promise<{ mfaRequired: boolean; mfaTicket: string; email: string }> {
    return request('/api/auth/staff/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async verifyStaffMfa(email: string, mfaTicket: string, code: string): Promise<{ sessionToken: string; user: ApiUser }> {
    const res = await request<{ sessionToken: string; user: ApiUser }>('/api/auth/staff/mfa-verify', {
      method: 'POST',
      body: JSON.stringify({ email, mfaTicket, code }),
    });
    setClientSessionToken(res.sessionToken);
    return res;
  },

  // Active Session & Logout
  async getMe(): Promise<ApiUser | null> {
    try {
      const res = await request<{ user: ApiUser }>('/api/auth/me');
      return res.user;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      setClientSessionToken(null);
    }
  },

  // Development fast OTP challenge
  async devGetOtp(phone: string): Promise<{ code: string }> {
    const res = await request<{ data: { code: string } }>('/api/auth/dev-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    return res.data;
  },
};

// -------------------------------------------------------------------------
// Recruitment Vertical Slice API Endpoints
// -------------------------------------------------------------------------

export const recruitmentApi = {
  // Requests
  async listRequests(): Promise<any[]> {
    return request('/api/v1/requests');
  },

  async createRequest(data: any): Promise<any> {
    return request('/api/v1/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async submitRequest(requestId: string): Promise<any> {
    return request(`/api/v1/requests/${requestId}/submit`, {
      method: 'POST',
    });
  },

  async reviewRequest(requestId: string, decision: 'APPROVE' | 'REQUEST_CORRECTIONS', reason: string = 'Conforme', expectedVersion: number = 2): Promise<any> {
    return request(`/api/v1/staff/requests/${requestId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason, expectedVersion }),
    });
  },

  async publishRequest(requestId: string, expectedVersion: number = 3): Promise<any> {
    return request(`/api/v1/staff/requests/${requestId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
    });
  },

  // Missions
  async listMissions(filters: { trade?: string; area?: string } = {}): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters.trade) params.set('trade', filters.trade);
    if (filters.area) params.set('area', filters.area);
    return request(`/api/v1/missions?${params.toString()}`);
  },

  async getMissionDetail(missionId: string): Promise<any> {
    return request(`/api/v1/missions/${missionId}`);
  },

  // Applications
  async applyToMission(missionId: string, termsId: string): Promise<any> {
    return request('/api/v1/applications', {
      method: 'POST',
      body: JSON.stringify({ missionId, termsId }),
    });
  },

  async getMyApplications(): Promise<any[]> {
    return request('/api/v1/me/applications');
  },

  async withdrawApplication(applicationId: string, reason: string, expectedVersion: number = 1): Promise<any> {
    return request(`/api/v1/applications/${applicationId}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason, expectedVersion }),
    });
  },

  // Staff Shortlist & Proposals
  async listStaffMissionApplications(missionId: string): Promise<any[]> {
    return request(`/api/v1/staff/missions/${missionId}/applications`);
  },

  async shortlistApplication(applicationId: string, reason: string = 'Profil qualifié', expectedVersion: number = 1): Promise<any> {
    return request(`/api/v1/staff/applications/${applicationId}/shortlist`, {
      method: 'POST',
      body: JSON.stringify({ reason, expectedVersion }),
    });
  },

  async createProposalsBatch(missionId: string, applicationIds: string[], termsId: string): Promise<any[]> {
    return request(`/api/v1/staff/missions/${missionId}/proposals`, {
      method: 'POST',
      body: JSON.stringify({ applicationIds, termsId }),
    });
  },

  // Company Candidate Proposals
  async listCompanyProposals(companyId: string): Promise<any[]> {
    return request(`/api/v1/companies/${companyId}/proposals`);
  },

  async companyDecideProposal(proposalId: string, decision: 'ACCEPTED' | 'DECLINED', expectedVersion: number = 1): Promise<any> {
    return request(`/api/v1/proposals/${proposalId}/company-decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, expectedVersion }),
    });
  },

  // Worker Terms Confirmation
  async workerDecideProposal(proposalId: string, decision: 'CONFIRMED' | 'DECLINED', termsId: string, expectedVersion: number = 1): Promise<any> {
    return request(`/api/v1/proposals/${proposalId}/worker-decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, termsId, expectedVersion }),
    });
  },

  // Staff Finalization
  async listStaffReadyProposals(): Promise<any[]> {
    const res = await request('/api/v1/staff/finalization');
    return res.data || [];
  },

  async staffFinalizeAssignment(proposalId: string, expectedVersion: number = 1, idempotencyKey?: string): Promise<any> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return request(`/api/v1/staff/proposals/${proposalId}/finalize`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ expectedVersion }),
    });
  },
};

// -------------------------------------------------------------------------
// Attendance, Disputes, Billing, Support & Config Endpoints
// -------------------------------------------------------------------------

export const operationsApi = {
  async updateAttendance(assignmentDayId: string, status: string, checkInTime?: string, notes?: string): Promise<any> {
    return request(`/api/v1/assignment-days/${assignmentDayId}/attendance`, {
      method: 'PUT',
      body: JSON.stringify({ status, checkInTime, notes }),
    });
  },

  async disputeAttendance(attendanceId: string, reason: string): Promise<any> {
    return request(`/api/v1/attendance/${attendanceId}/worker-decision`, {
      method: 'POST',
      body: JSON.stringify({ decision: 'DISPUTED', reason }),
    });
  },

  async resolveDispute(attendanceId: string, decision: 'CONFIRMED_PRESENT' | 'CONFIRMED_ABSENT' | 'SPLIT_HOURS', resolutionNotes: string): Promise<any> {
    return request(`/api/v1/staff/attendance/${attendanceId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ decision, resolutionNotes, expectedVersion: 1 }),
    });
  },

  // Invoices & Receipts
  async listInvoices(): Promise<any[]> {
    return request('/api/v1/staff/invoices');
  },

  async listCompanyInvoices(companyId: string): Promise<any[]> {
    return request(`/api/v1/companies/${companyId}/invoices`);
  },

  async getInvoice(id: string): Promise<any> {
    return request(`/api/v1/invoices/${id}`);
  },

  async recordReceipt(invoiceId: string, amount: number, externalReference: string): Promise<any> {
    return request(`/api/v1/staff/invoices/${invoiceId}/receipts`, {
      method: 'POST',
      body: JSON.stringify({ amount, externalReference }),
    });
  },

  async reverseReceipt(receiptId: string, reason: string): Promise<any> {
    return request(`/api/v1/staff/receipts/${receiptId}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Support
  async listSupportCases(): Promise<any[]> {
    return request('/api/v1/support-cases');
  },

  async createSupportCase(subject: string, message: string, priority: string = 'NORMAL'): Promise<any> {
    return request('/api/v1/support-cases', {
      method: 'POST',
      body: JSON.stringify({ subject, message, priority }),
    });
  },

  async sendSupportMessage(caseId: string, bodyText: string, isInternalNote: boolean = false): Promise<any> {
    return request(`/api/v1/support-cases/${caseId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ bodyText, isInternalNote }),
    });
  },

  // Public config
  async getPublicConfig(): Promise<any> {
    return request('/api/v1/public-config');
  },

  // Attendance listing
  async listAttendance(): Promise<any[]> {
    return request('/api/v1/attendance');
  },

  // Support thread details
  async getSupportCase(caseId: string): Promise<any> {
    return request(`/api/v1/support-cases/${caseId}`);
  },

  // Notifications
  async getMyNotifications(): Promise<any[]> {
    return request('/api/v1/me/notifications');
  },

  async markNotificationRead(id: string): Promise<any> {
    return request(`/api/v1/me/notifications/${id}/read`, { method: 'POST' });
  },

  // Replacements
  async createReplacement(params: {
    assignmentId: string;
    missionId: string;
    workerId: string;
    affectedDayIds: string[];
    reasonCode: 'WORKER_ABSENT' | 'WORKER_ILLNESS' | 'SKILL_MISMATCH' | 'COMPANY_REQUEST';
    note?: string;
  }): Promise<any> {
    return request('/api/v1/replacements', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};
