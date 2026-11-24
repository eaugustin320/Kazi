// Kazi Boundary Runtime Validation Schemas using Zod
// Enforces API.md, PRD.md, and WORKFLOWS.md invariants

import { z } from 'zod';

// Gabon Phone Validation Regex (+241 followed by 7 or 8 digits)
export const GABON_PHONE_REGEX = /^\+241[0-9]{7,8}$/;

// 1. Worker Profile Validation
export const WorkerProfileUpdateSchema = z.object({
  displayName: z.string().min(2, 'Le nom doit comporter au moins 2 caractères').max(80),
  tradeCodes: z.array(z.string()).min(1, 'Au moins un métier doit être sélectionné'),
  areaCode: z.string().min(2, 'Commune requise'),
  experienceText: z.string().max(1000).optional(),
  availabilityCode: z.enum(['AVAILABLE', 'BUSY', 'UNAVAILABLE']).default('AVAILABLE'),
});

// 2. Company Registration Validation
export const CompanyRegistrationSchema = z.object({
  legalName: z.string().min(2, 'Raison sociale requise').max(120),
  tradeSector: z.string().min(2, 'Secteur d’activité requis'),
  registrationReference: z.string().min(3, 'Numéro RCCM requis'),
  taxReference: z.string().min(3, 'Numéro NIF requis'),
  areaCode: z.string().default('libreville'),
  address: z.string().min(5, 'Adresse complète requise'),
  contactEmail: z.string().email('Adresse email invalide'),
  contactPhone: z.string().regex(GABON_PHONE_REGEX, 'Format téléphone gabonais requis (+241...)'),
});

// 3. Staffing Request Validation (KZ03)
export const StaffingRequestCreateSchema = z.object({
  tradeCode: z.string().min(2, 'Métier requis'),
  headcount: z.number().int().min(1, 'Au moins 1 ouvrier requis').max(50, 'Maximum 50 ouvriers par demande'),
  siteName: z.string().min(3, 'Nom du chantier requis'),
  commune: z.string().default('Libreville'),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date YYYY-MM-DD requis'),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date YYYY-MM-DD requis'),
  dailyHours: z.string().min(3, 'Horaires journaliers requis'),
  dayPayXAF: z.number().int().min(5000, 'Le taux minimum journalier est de 5 000 FCFA'),
  equipmentRequirements: z.string().default('Chaussures de sécurité obligatoires'),
  specialInstructions: z.string().max(1000).optional(),
});

// 4. Application Submission Schema (KZ06)
export const ApplicationSubmitSchema = z.object({
  missionId: z.string().optional(),
  termsId: z.string().refine(
    (id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      id.startsWith('terms_') ||
      id === 'terms-01',
    { message: 'Identifiant de termes UUID invalide' }
  ),
});

// 5. Company Proposal Decision Schema (KZ08)
export const CompanyProposalDecisionSchema = z.object({
  decision: z.enum(['ACCEPTED', 'DECLINED']),
  expectedVersion: z.number().int().min(1),
  reason: z.string().max(500).optional(),
});

// 6. Worker Availability Confirmation Schema (KZ08)
export const WorkerProposalDecisionSchema = z.object({
  decision: z.enum(['CONFIRMED', 'DECLINED']),
  termsId: z.string().uuid(),
  expectedVersion: z.number().int().min(1),
});

// 7. Staff Finalization Schema (KZ09)
export const AssignmentFinalizeSchema = z.object({
  proposalId: z.string().uuid(),
  expectedVersion: z.number().int().min(1),
});

// 8. Daily Attendance Declaration Schema (KZ10)
export const AttendanceDeclarationSchema = z.object({
  declaredStatus: z.enum(['PRESENT', 'ABSENT', 'PARTIAL']),
  workedMinutes: z.number().int().min(0).max(960).optional(), // Max 16h
  note: z.string().max(500).optional(),
  expectedVersion: z.number().int().min(1),
});

// 9. Worker Attendance Dispute Schema (KZ10)
export const AttendanceDisputeSchema = z.object({
  declarationRevision: z.number().int().min(0),
  disputeNote: z.string().min(5, 'Précisez le motif de contestation').max(500),
});

// 10. Audit Reason Schema
export const AuditActionSchema = z.object({
  action: z.string(),
  reason: z.string().min(3, 'Un motif consigné est obligatoire pour toute action sensible'),
  scope: z.string().default('GA / Libreville'),
});
