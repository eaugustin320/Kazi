// Kazi Operational HTTP Application Server
// Mounts all Next.js-compatible API route handlers on Node.js http server
// Strictly implements I1 from BUILD_CORRECTION.md

// Load local environment variables from .env if present
try {
  (process as any).loadEnvFile?.();
} catch {
  // .env file is optional or provided by container/environment
}

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDatabaseConnection, initDatabase } from './db/database';
import { createOTPChallenge } from './auth/otp';

// Route Handlers
import * as WorkerSendOtp from '../app/api/auth/worker/send-otp/route';
import * as WorkerVerifyOtp from '../app/api/auth/worker/verify-otp/route';
import * as CompanyRegister from '../app/api/auth/company/register/route';
import * as CompanyLogin from '../app/api/auth/company/login/route';
import * as StaffLogin from '../app/api/auth/staff/login/route';
import * as StaffMfaVerify from '../app/api/auth/staff/mfa-verify/route';
import * as AuthMe from '../app/api/auth/me/route';
import * as AuthLogout from '../app/api/auth/logout/route';

import * as PublicConfig from '../app/api/v1/public-config/route';

import * as RequestsRoute from '../app/api/v1/requests/route';
import * as RequestSubmit from '../app/api/v1/requests/[id]/submit/route';
import * as StaffRequestReview from '../app/api/v1/staff/requests/[id]/review/route';
import * as StaffRequestPublish from '../app/api/v1/staff/requests/[id]/publish/route';

import * as MissionsRoute from '../app/api/v1/missions/route';
import * as MissionDetail from '../app/api/v1/missions/[id]/route';
import * as MissionApplications from '../app/api/v1/missions/[id]/applications/route';
import * as StaffMissionApplications from '../app/api/v1/staff/missions/[id]/applications/route';
import * as StaffMissionClose from '../app/api/v1/staff/missions/[id]/close/route';

import * as ApplicationsRoute from '../app/api/v1/applications/route';
import * as ApplicationWithdraw from '../app/api/v1/applications/[id]/withdraw/route';
import * as MeApplications from '../app/api/v1/me/applications/route';
import * as StaffApplicationShortlist from '../app/api/v1/staff/applications/[id]/shortlist/route';
import * as StaffMissionProposals from '../app/api/v1/staff/missions/[id]/proposals/route';

import * as CompanyProposals from '../app/api/v1/companies/[id]/proposals/route';
import * as ProposalCompanyDecision from '../app/api/v1/proposals/[id]/company-decision/route';
import * as ProposalWorkerDecision from '../app/api/v1/proposals/[id]/worker-decision/route';
import * as StaffProposalFinalize from '../app/api/v1/staff/proposals/[id]/finalize/route';
import * as StaffFinalization from '../app/api/v1/staff/finalization/route';

import * as AssignmentDaysAttendance from '../app/api/v1/assignment-days/[id]/attendance/route';
import * as AttendanceWorkerDecision from '../app/api/v1/attendance/[id]/worker-decision/route';
import * as StaffAttendanceResolve from '../app/api/v1/staff/attendance/[id]/resolve/route';

import * as SupportCases from '../app/api/v1/support-cases/route';
import * as SupportCaseDetail from '../app/api/v1/support-cases/[id]/route';
import * as SupportCaseMessages from '../app/api/v1/support-cases/[id]/messages/route';
import * as StaffSupportCaseTransition from '../app/api/v1/staff/support-cases/[id]/transition/route';

import * as StaffQuotes from '../app/api/v1/staff/quotes/route';
import * as CompanyQuotes from '../app/api/v1/companies/[id]/quotes/route';
import * as StaffQuoteSend from '../app/api/v1/staff/quotes/[id]/send/route';
import * as QuoteDecision from '../app/api/v1/quotes/[id]/decision/route';

import * as StaffInvoices from '../app/api/v1/staff/invoices/route';
import * as CompanyInvoices from '../app/api/v1/companies/[id]/invoices/route';
import * as InvoiceDetail from '../app/api/v1/invoices/[id]/route';
import * as StaffInvoiceReceipts from '../app/api/v1/staff/invoices/[id]/receipts/route';
import * as StaffReceiptReverse from '../app/api/v1/staff/receipts/[id]/reverse/route';

import * as StaffConfigActivate from '../app/api/v1/staff/config/activate/route';
import * as StaffAudit from '../app/api/v1/staff/audit/route';
import * as StaffTeam from '../app/api/v1/staff/team/route';
import * as StaffGrantUpdate from '../app/api/v1/staff/grants/[id]/route';

type RouteHandler = (
  req: Request,
  context: any
) => Promise<Response>;

interface RegisteredRoute {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

const routes: RegisteredRoute[] = [];

function register(method: string, pathPattern: string, handler: RouteHandler) {
  const paramNames: string[] = [];
  const regexPattern = pathPattern
    .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    })
    .replace(/\//g, '\\/');

  routes.push({
    method: method.toUpperCase(),
    pattern: new RegExp(`^${regexPattern}$`),
    paramNames,
    handler,
  });
}

// -------------------------------------------------------------------------
// Route Registration Table
// -------------------------------------------------------------------------

// Health check endpoint (I1)
register('GET', '/api/health', async () => {
  try {
    const db = getDatabaseConnection();
    const row = db.prepare('SELECT 1 as alive;').get();
    return new Response(
      JSON.stringify({
        status: 'ok',
        version: '1.0.0',
        database: row ? 'connected' : 'error',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ status: 'error', error: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

// Development-only OTP helper (I2)
register('POST', '/api/auth/dev-otp', async (req) => {
  if (process.env.NODE_ENV === 'production') {
    return new Response(JSON.stringify({ error: 'Not available in production' }), { status: 404 });
  }
  try {
    const body = await req.json();
    const phone = body?.phone || '+24101000000';
    const challenge = createOTPChallenge(phone);
    return new Response(
      JSON.stringify({
        data: {
          phone,
          code: challenge.debugCode || '123456',
          success: challenge.success,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(JSON.stringify({ error: 'Failed' }), { status: 400 });
  }
});

// Auth
register('POST', '/api/auth/worker/send-otp', WorkerSendOtp.POST);
register('POST', '/api/auth/worker/verify-otp', WorkerVerifyOtp.POST);
register('POST', '/api/auth/company/register', CompanyRegister.POST);
register('POST', '/api/auth/company/login', CompanyLogin.POST);
register('POST', '/api/auth/staff/login', StaffLogin.POST);
register('POST', '/api/auth/staff/mfa-verify', StaffMfaVerify.POST);
register('GET', '/api/auth/me', AuthMe.GET);
register('POST', '/api/auth/logout', AuthLogout.POST);

// Public Config
register('GET', '/api/v1/public-config', PublicConfig.GET);

// Requests
register('GET', '/api/v1/requests', RequestsRoute.GET);
register('POST', '/api/v1/requests', RequestsRoute.POST);
register('POST', '/api/v1/requests/:id/submit', RequestSubmit.POST);
register('POST', '/api/v1/staff/requests/:id/review', StaffRequestReview.POST);
register('POST', '/api/v1/staff/requests/:id/publish', StaffRequestPublish.POST);

// Missions & Applications
register('GET', '/api/v1/missions', MissionsRoute.GET);
register('GET', '/api/v1/missions/:id', MissionDetail.GET);
register('POST', '/api/v1/missions/:id/applications', MissionApplications.POST);
register('GET', '/api/v1/staff/missions/:id/applications', StaffMissionApplications.GET);
register('POST', '/api/v1/staff/missions/:id/close', StaffMissionClose.POST);

register('POST', '/api/v1/applications', ApplicationsRoute.POST);
register('POST', '/api/v1/applications/:id/withdraw', ApplicationWithdraw.POST);
register('GET', '/api/v1/me/applications', MeApplications.GET);
register('POST', '/api/v1/staff/applications/:id/shortlist', StaffApplicationShortlist.POST);
register('POST', '/api/v1/staff/missions/:id/proposals', StaffMissionProposals.POST);

// Proposals & Assignments
register('GET', '/api/v1/companies/:id/proposals', CompanyProposals.GET);
register('POST', '/api/v1/proposals/:id/company-decision', ProposalCompanyDecision.POST);
register('POST', '/api/v1/proposals/:id/worker-decision', ProposalWorkerDecision.POST);
register('POST', '/api/v1/staff/proposals/:id/finalize', StaffProposalFinalize.POST);
register('GET', '/api/v1/staff/finalization', StaffFinalization.GET);
register('POST', '/api/v1/staff/finalization', StaffFinalization.POST);

// Attendance & Disputes
register('PUT', '/api/v1/assignment-days/:id/attendance', AssignmentDaysAttendance.PUT);
register('POST', '/api/v1/attendance/:id/worker-decision', AttendanceWorkerDecision.POST);
register('POST', '/api/v1/staff/attendance/:id/resolve', StaffAttendanceResolve.POST);

// Support
register('GET', '/api/v1/support-cases', SupportCases.GET);
register('POST', '/api/v1/support-cases', SupportCases.POST);
register('GET', '/api/v1/support-cases/:id', SupportCaseDetail.GET);
register('POST', '/api/v1/support-cases/:id/messages', SupportCaseMessages.POST);
register('POST', '/api/v1/staff/support-cases/:id/transition', StaffSupportCaseTransition.POST);

// Quotes & Billing
register('GET', '/api/v1/staff/quotes', StaffQuotes.GET);
register('POST', '/api/v1/staff/quotes', StaffQuotes.POST);
register('GET', '/api/v1/companies/:id/quotes', CompanyQuotes.GET);
register('POST', '/api/v1/staff/quotes/:id/send', StaffQuoteSend.POST);
register('POST', '/api/v1/quotes/:id/decision', QuoteDecision.POST);

// Invoices & Receipts
register('GET', '/api/v1/staff/invoices', StaffInvoices.GET);
register('POST', '/api/v1/staff/invoices', StaffInvoices.POST);
register('GET', '/api/v1/companies/:id/invoices', CompanyInvoices.GET);
register('GET', '/api/v1/invoices/:id', InvoiceDetail.GET);
register('POST', '/api/v1/staff/invoices/:id/receipts', StaffInvoiceReceipts.POST);
register('POST', '/api/v1/staff/receipts/:id/reverse', StaffReceiptReverse.POST);

// Staff Config & Admin
register('POST', '/api/v1/staff/config/activate', StaffConfigActivate.POST);
register('GET', '/api/v1/staff/audit', StaffAudit.GET);
register('GET', '/api/v1/staff/team', StaffTeam.GET);
register('POST', '/api/v1/staff/team', StaffTeam.POST);
register('PATCH', '/api/v1/staff/grants/:id', StaffGrantUpdate.PATCH);

// -------------------------------------------------------------------------
// Static Asset Helpers
// -------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStaticFile(reqPath: string, res: http.ServerResponse): boolean {
  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) return false;

  let filePath = path.join(distDir, reqPath === '/' ? 'index.html' : reqPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  return false;
}

// -------------------------------------------------------------------------
// Request Pipeline
// -------------------------------------------------------------------------

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const host = req.headers.host || '127.0.0.1';
  const urlObj = new URL(req.url || '/', `http://${host}`);
  const pathname = urlObj.pathname;
  const method = (req.method || 'GET').toUpperCase();

  // Allow standard CORS headers for local development
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  }

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Route matching
  if (pathname.startsWith('/api')) {
    for (const r of routes) {
      if (r.method === method) {
        const match = pathname.match(r.pattern);
        if (match) {
          const params: Record<string, string> = {};
          r.paramNames.forEach((name, i) => {
            params[name] = decodeURIComponent(match[i + 1]);
          });

          // Convert node request to web Request
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) headers.append(key, v);
            } else {
              headers.set(key, value);
            }
          }

          let bodyBuffer: Buffer | undefined = undefined;
          if (method !== 'GET' && method !== 'HEAD') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            if (chunks.length > 0) {
              bodyBuffer = Buffer.concat(chunks);
            }
          }

          const webReq = new Request(urlObj.href, {
            method,
            headers,
            body: bodyBuffer as any,
            // @ts-ignore
            duplex: 'half',
          });

          try {
            const webRes = await r.handler(webReq, {
              params: Promise.resolve(params),
            });

            res.statusCode = webRes.status;
            res.statusMessage = webRes.statusText;

            webRes.headers.forEach((val, key) => {
              if (key.toLowerCase() === 'set-cookie') return;
              res.setHeader(key, val);
            });

            // Handle multi-cookie Set-Cookie
            const setCookies = (webRes.headers as any).getSetCookie?.() || webRes.headers.get('set-cookie');
            if (setCookies) {
              res.setHeader('Set-Cookie', setCookies);
            }

            if (webRes.body) {
              const buf = await webRes.arrayBuffer();
              res.end(Buffer.from(buf));
            } else {
              res.end();
            }
            return;
          } catch (handlerErr: any) {
            console.error('API Error:', handlerErr);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { code: 'SERVER_ERROR', message: handlerErr.message } }));
            return;
          }
        }
      }
    }

    // 404 for unmatched API routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'ROUTE_NOT_FOUND', message: `Route ${method} ${pathname} not found` } }));
    return;
  }

  // Non-API: serve static frontend if dist exists
  if (serveStaticFile(pathname, res)) {
    return;
  }

  // Fallback info page if dist is not built
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head><title>Kazi Server 1.0.0</title></head>
      <body style="font-family: sans-serif; padding: 2rem;">
        <h1>Kazi Application Server 1.0.0</h1>
        <p>API endpoints mounted at <code>/api/...</code></p>
        <p>Check health: <a href="/api/health">/api/health</a></p>
      </body>
    </html>
  `);
}

// -------------------------------------------------------------------------
// Server Startup
// -------------------------------------------------------------------------

export function startServer(port: number = Number(process.env.PORT) || 3001): http.Server {
  initDatabase();
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('Unhandled Server Error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Fatal internal server error' }));
      }
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[Kazi Server] Operational HTTP server running at http://127.0.0.1:${port}`);
    console.log(`[Kazi Server] Health check available at http://127.0.0.1:${port}/api/health`);
  });

  return server;
}

// Automatically start if executed directly
startServer();
