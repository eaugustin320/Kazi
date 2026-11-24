// Kazi Company Journey Prototype View (Role: COMPANY OWNER)
// Demonstrates Overview, Multi-step Request Creation, Anonymized Candidate Review, Attendance, Invoices, and Support

import React, { useState } from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Briefcase,
  Receipt,
  HelpCircle,
  Plus,
  Send,
  Building,
  MapPin,
  Clock,
  ShieldAlert,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { usePrototype } from '../../context/PrototypeContext';
import { WorkspaceSidebar } from '../../components/ui/WorkspaceSidebar';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Alert } from '../../components/ui/Alert';
import { Dialog } from '../../components/ui/Dialog';
import { CandidateRow } from '../../components/ui/CandidateRow';
import { AttendanceRow } from '../../components/ui/AttendanceRow';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { MoneyField } from '../../components/ui/MoneyField';
import { DataTable } from '../../components/ui/DataTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { StaffingRequest } from '../../types/domain';

export const CompanyView: React.FC = () => {
  const {
    companyView,
    setCompanyView,
    companies,
    staffingRequests,
    proposals,
    workers,
    missions,
    attendance,
    invoices,
    supportTickets,
    createStaffingRequest,
    companyDecideProposal,
    companyDeclareAttendance,
    sendSupportMessage,
  } = usePrototype();

  const currentCompany = companies[0]; // BTP Horizon Gabon
  const companyRequests = staffingRequests.filter((r) => r.companyId === currentCompany.id);
  const companyProposals = proposals.filter((p) => p.companyDecision === 'PENDING');
  const companyMissions = missions.filter((m) => m.companyId === currentCompany.id);
  const companyAttendance = attendance.filter((a) => a.missionId === 'mission-demo-01');
  const companyInvoices = invoices.filter((i) => i.companyId === currentCompany.id);
  const companyTicket = supportTickets.find((t) => t.creatorId === 'company-a') || supportTickets[0];

  // Request creation form state (Multi-step)
  const [reqStep, setReqStep] = useState<number>(1);
  const [newTrade, setNewTrade] = useState<string>('Coffreur');
  const [newHeadcount, setNewHeadcount] = useState<number>(4);
  const [newSite, setNewSite] = useState<string>('Chantier Bord de Mer');
  const [newCommune, setNewCommune] = useState<string>('Libreville');
  const [newStartsAt, setNewStartsAt] = useState<string>('2026-12-05');
  const [newEndsAt, setNewEndsAt] = useState<string>('2026-12-08');
  const [newHours, setNewHours] = useState<string>('07h30 - 16h30');
  const [newDayPay, setNewDayPay] = useState<number>(15000);
  const [newEpi, setNewEpi] = useState<string>('Chaussures de sécurité coquées obligatoires');
  const [newInstructions, setNewInstructions] = useState<string>('Rendez-vous à 07h00 pour le briefing sécurité.');

  // Modal for company proposal acceptance
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [targetProposalId, setTargetProposalId] = useState<string>('');
  const [newSupportMsg, setNewSupportMsg] = useState<string>('');

  const navItems = [
    { id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
    { id: 'requests', label: 'Demandes de personnel', icon: FileSpreadsheet, badge: companyRequests.length },
    { id: 'proposals', label: 'Candidats proposés', icon: Users, badge: companyProposals.length || undefined },
    { id: 'missions', label: 'Missions & Pointage', icon: Briefcase },
    { id: 'invoices', label: 'Factures de service', icon: Receipt },
    { id: 'support', label: 'Assistance Kazi', icon: HelpCircle },
  ];

  const handleStepSubmit = (asDraft: boolean = false) => {
    createStaffingRequest({
      trade: newTrade,
      headcount: newHeadcount,
      siteName: newSite,
      commune: newCommune,
      startsAt: newStartsAt,
      endsAt: newEndsAt,
      dailyHours: newHours,
      dayPayXAF: newDayPay,
      equipmentRequirements: newEpi,
      specialInstructions: newInstructions,
      status: asDraft ? 'DRAFT' : 'SUBMITTED',
    });
    setReqStep(1);
    setCompanyView('requests');
  };

  const handleConfirmAccept = () => {
    if (targetProposalId) {
      companyDecideProposal(targetProposalId, 'ACCEPTED');
      setIsAcceptModalOpen(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100%', backgroundColor: 'var(--color-background)' }}>
      {/* Sidebar */}
      <WorkspaceSidebar
        title={currentCompany.name}
        subtitle="Espace Entreprise"
        items={navItems}
        activeId={companyView}
        onSelect={setCompanyView}
      />

      {/* Main Content */}
      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        {/* VIEW 1: OVERVIEW */}
        {companyView === 'overview' && (
          <div>
            <PageHeader
              title="Vue d’ensemble de votre activité"
              subtitle="Suivi opérationnel des missions et décisions requises (Gabon / Libreville)"
              actions={
                <Button
                  variant="primary"
                  leftIcon={<Plus size={16} />}
                  onClick={() => setCompanyView('request_new')}
                >
                  Nouvelle demande
                </Button>
              }
            />

            {/* Verification Status Banner */}
            <div
              style={{
                padding: '14px 18px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Building size={24} style={{ color: 'var(--color-primary)' }} />
                <div>
                  <strong style={{ fontSize: '15px' }}>{currentCompany.name}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    RCCM : {currentCompany.rccm} &middot; NIF : {currentCompany.nif}
                  </div>
                </div>
              </div>
              <StatusBadge label="Entreprise Vérifiée" variant="success" />
            </div>

            {/* Action Required: Candidate Proposals awaiting decision */}
            {companyProposals.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} style={{ color: 'var(--color-primary)' }} />
                    <span>Profils proposés par Kazi en attente de votre validation ({companyProposals.length})</span>
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setCompanyView('proposals')}>
                    Voir tout
                  </Button>
                </div>

                {companyProposals.map((prop) => {
                  const workerProfile = workers.find((w) => w.id === prop.workerId) || workers[0];
                  return (
                    <CandidateRow
                      key={prop.id}
                      candidate={workerProfile}
                      proposalStatus="Proposition Kazi reçue"
                      onAccept={() => {
                        setTargetProposalId(prop.id);
                        setIsAcceptModalOpen(true);
                      }}
                      onDecline={() => companyDecideProposal(prop.id, 'DECLINED')}
                    />
                  );
                })}
              </div>
            )}

            {/* Active Staffing Requests */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
                Demandes récentes transmises à Kazi
              </h3>
              <DataTable
                data={companyRequests}
                keyExtractor={(r) => r.id}
                columns={[
                  { header: 'Métier requis', accessor: (r) => <strong>{r.trade}</strong> },
                  { header: 'Effectif', accessor: (r) => `${r.headcount} personnes` },
                  { header: 'Chantier', accessor: (r) => `${r.siteName} (${r.commune})` },
                  { header: 'Dates', accessor: (r) => `${r.startsAt} au ${r.endsAt}` },
                  {
                    header: 'Rémunération directe',
                    accessor: (r) => `${(r.dayPayXAF || 15000).toLocaleString('fr-GA')} FCFA / j`,
                  },
                  {
                    header: 'Statut Kazi',
                    accessor: (r) => (
                      <StatusBadge
                        label={
                          r.status === 'APPROVED'
                            ? 'Validée & Publiée'
                            : r.status === 'SUBMITTED'
                            ? 'Sous revue Kazi'
                            : r.status === 'CHANGES_REQUESTED'
                            ? 'Corrections requises'
                            : 'Brouillon'
                        }
                        variant={
                          r.status === 'APPROVED'
                            ? 'success'
                            : r.status === 'SUBMITTED'
                            ? 'info'
                            : r.status === 'CHANGES_REQUESTED'
                            ? 'warning'
                            : 'neutral'
                        }
                      />
                    ),
                  },
                ]}
              />
            </div>
          </div>
        )}

        {/* VIEW 2: MULTI-STEP REQUEST CREATION (KZ03) */}
        {companyView === 'request_new' && (
          <div style={{ maxWidth: '680px' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCompanyView('requests')}
              style={{ marginBottom: '12px' }}
            >
              &larr; Annuler et retourner aux demandes
            </Button>

            <PageHeader
              title="Nouvelle Demande de Personnel Temporaire"
              subtitle="Kazi sélectionne et vérifie les ouvriers qualifiés pour votre chantier"
            />

            {/* Stepper Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 18px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-card)',
                marginBottom: '20px',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <span style={{ color: reqStep === 1 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                1. Métier & Effectif
              </span>
              <span>&rarr;</span>
              <span style={{ color: reqStep === 2 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                2. Chantier & Calendrier
              </span>
              <span>&rarr;</span>
              <span style={{ color: reqStep === 3 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                3. Conditions & EPI
              </span>
            </div>

            {/* Step 1 */}
            {reqStep === 1 && (
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                  padding: '24px',
                }}
              >
                <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
                  Étape 1 : Définir le besoin en main-d’œuvre
                </h4>

                <Select
                  label="Métier recherché"
                  value={newTrade}
                  onChange={(e) => setNewTrade(e.target.value)}
                  options={[
                    { value: 'Coffreur', label: 'Coffreur / Bancheur' },
                    { value: 'Manœuvre de chantier', label: 'Manœuvre de chantier (Gros Œuvre)' },
                    { value: 'Électricien bâtiment', label: 'Électricien bâtiment' },
                    { value: 'Maçon finisseur', label: 'Maçon finisseur' },
                    { value: 'Manutentionnaire', label: 'Manutentionnaire' },
                  ]}
                  required
                />

                <Field
                  label="Nombre d’ouvriers requis"
                  type="number"
                  min="1"
                  max="50"
                  value={newHeadcount}
                  onChange={(e) => setNewHeadcount(parseInt(e.target.value, 10) || 1)}
                  helperText="Effectif temporaire souhaité pour ce poste"
                  required
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <Button variant="secondary" onClick={() => handleStepSubmit(true)}>
                    Sauvegarder comme brouillon
                  </Button>
                  <Button variant="primary" onClick={() => setReqStep(2)}>
                    Continuer vers l’étape 2 &rarr;
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2 */}
            {reqStep === 2 && (
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                  padding: '24px',
                }}
              >
                <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
                  Étape 2 : Localisation du chantier & Horaires
                </h4>

                <Field
                  label="Nom ou référence du chantier"
                  value={newSite}
                  onChange={(e) => setNewSite(e.target.value)}
                  placeholder="Ex: Chantier Le Méridien, Immeuble Gabon 2026"
                  required
                />

                <Select
                  label="Commune d’intervention (Grand Libreville)"
                  value={newCommune}
                  onChange={(e) => setNewCommune(e.target.value)}
                  options={[
                    { value: 'Libreville', label: 'Libreville Centre & Nord' },
                    { value: 'Akanda', label: 'Akanda' },
                    { value: 'Owendo', label: 'Owendo & Zone Portuaire' },
                  ]}
                  required
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Field
                    label="Date de début"
                    type="date"
                    value={newStartsAt}
                    onChange={(e) => setNewStartsAt(e.target.value)}
                    required
                  />
                  <Field
                    label="Date de fin"
                    type="date"
                    value={newEndsAt}
                    onChange={(e) => setNewEndsAt(e.target.value)}
                    required
                  />
                </div>

                <Field
                  label="Horaires journaliers"
                  value={newHours}
                  onChange={(e) => setNewHours(e.target.value)}
                  helperText="Ex: 07h30 - 16h30 avec 1h de pause"
                  required
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                  <Button variant="secondary" onClick={() => setReqStep(1)}>
                    &larr; Retour
                  </Button>
                  <Button variant="primary" onClick={() => setReqStep(3)}>
                    Continuer vers l’étape 3 &rarr;
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {reqStep === 3 && (
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                  padding: '24px',
                }}
              >
                <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
                  Étape 3 : Taux journalier direct & Équipements de protection
                </h4>

                <MoneyField
                  label="Taux journalier net garanti à chaque ouvrier (XAF)"
                  value={newDayPay}
                  onChange={setNewDayPay}
                  helperText="Rémunération versée directement par votre entreprise à l’ouvrier"
                  required
                />

                <Field
                  label="Équipements de protection requis (EPI à la charge de l'ouvrier)"
                  value={newEpi}
                  onChange={(e) => setNewEpi(e.target.value)}
                  placeholder="Ex: Chaussures de sécurité coquées obligatoires"
                  required
                />

                <Field
                  label="Consignes d'accès ou instructions particulières"
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                />

                <Alert type="info" title="Rappel du modèle d'intermédiation Kazi">
                  Votre demande sera examinée par un recruteur Kazi avant publication. Kazi facturera ses honoraires de mise en relation séparément selon le devis convenu.
                </Alert>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                  <Button variant="secondary" onClick={() => setReqStep(2)}>
                    &larr; Retour
                  </Button>
                  <Button
                    variant="primary"
                    leftIcon={<Send size={16} />}
                    onClick={() => handleStepSubmit(false)}
                  >
                    Envoyer à Kazi
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: STAFFING REQUESTS LIST */}
        {companyView === 'requests' && (
          <div>
            <PageHeader
              title="Demandes de Personnel"
              subtitle="Historique de vos besoins transmis à Kazi"
              actions={
                <Button
                  variant="primary"
                  leftIcon={<Plus size={16} />}
                  onClick={() => setCompanyView('request_new')}
                >
                  Nouvelle demande
                </Button>
              }
            />

            <DataTable
              data={companyRequests}
              keyExtractor={(r) => r.id}
              columns={[
                { header: 'Métier', accessor: (r) => <strong>{r.trade}</strong> },
                { header: 'Effectif', accessor: (r) => `${r.headcount} personnes` },
                { header: 'Lieu', accessor: (r) => `${r.siteName} (${r.commune})` },
                { header: 'Période', accessor: (r) => `${r.startsAt} au ${r.endsAt}` },
                { header: 'Rémunération', accessor: (r) => `${(r.dayPayXAF || 15000).toLocaleString('fr-GA')} FCFA` },
                {
                  header: 'Statut',
                  accessor: (r) => (
                    <StatusBadge
                      label={
                        r.status === 'APPROVED'
                          ? 'Approuvée & Publiée'
                          : r.status === 'SUBMITTED'
                          ? 'En cours de traitement'
                          : r.status === 'CHANGES_REQUESTED'
                          ? 'Modifications requises'
                          : 'Brouillon'
                      }
                      variant={r.status === 'APPROVED' ? 'success' : r.status === 'SUBMITTED' ? 'info' : 'warning'}
                    />
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* VIEW 4: PROPOSALS REVIEW (KZ07 & KZ08) */}
        {companyView === 'proposals' && (
          <div>
            <PageHeader
              title="Candidats Présélectionnés par Kazi"
              subtitle="Profils vérifiés correspondant à vos critères de recherche (Coordonnées privées protégées)"
            />

            <Alert type="info" title="Protection de la vie privée & Invariants Kazi">
              Conformément à la politique Kazi, les numéros de téléphone et documents d'identité des ouvriers ne sont pas diffusés. Vous évaluez les candidats sur leurs compétences réelles et leur assiduité historique vérifiée.
            </Alert>

            {companyProposals.length === 0 ? (
              <EmptyState
                title="Aucun candidat en attente"
                description="Tous les profils proposés ont été examinés ou aucune nouvelle proposition n'est en cours."
              />
            ) : (
              companyProposals.map((prop) => {
                const worker = workers.find((w) => w.id === prop.workerId) || workers[0];
                return (
                  <CandidateRow
                    key={prop.id}
                    candidate={worker}
                    proposalStatus="En attente de votre accord"
                    onAccept={() => {
                      setTargetProposalId(prop.id);
                      setIsAcceptModalOpen(true);
                    }}
                    onDecline={() => companyDecideProposal(prop.id, 'DECLINED')}
                  />
                );
              })
            )}
          </div>
        )}

        {/* VIEW 5: MISSIONS ROSTER & DAILY ATTENDANCE (KZ10) */}
        {companyView === 'missions' && (
          <div>
            <PageHeader
              title="Missions en Cours & Pointage Journalier"
              subtitle="Déclaration de présence quotidienne obligatoire pour chaque ouvrier affecté (KZ10)"
            />

            {/* Mission Card */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-card)',
                padding: '20px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: '18px', fontWeight: 800 }}>Chantier Résidence Le Méridien</h4>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Libreville &middot; 7 ouvriers confirmés sur 10 prévus
                  </div>
                </div>
                <StatusBadge label="En cours d’exécution" variant="success" />
              </div>
            </div>

            <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
              Feuille de présence journalière
            </h4>

            {companyAttendance.map((rec) => (
              <AttendanceRow
                key={rec.id}
                record={rec}
                role="COMPANY"
                onDeclare={(status, hours, note) => companyDeclareAttendance(rec.id, status, hours, note)}
              />
            ))}
          </div>
        )}

        {/* VIEW 6: INVOICES (KZ14) */}
        {companyView === 'invoices' && (
          <div>
            <PageHeader
              title="Factures de Service Kazi"
              subtitle="Honoraires de recrutement et de suivi opérationnel (Hors salaires des ouvriers)"
            />

            <Alert type="warning" title="Spécimen de prototype (SAMPLE)">
              Ce document est un spécimen indicatif (SAMPLE). Les politiques fiscales et conditions d'émission légales sont en cours de validation finale avant le lancement officiel.
            </Alert>

            {companyInvoices.map((inv) => (
              <div
                key={inv.id}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-card)',
                  padding: '24px',
                  marginBottom: '16px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Sample Watermark */}
                <div
                  style={{
                    position: 'absolute',
                    top: '20px',
                    right: '-40px',
                    transform: 'rotate(45deg)',
                    backgroundColor: 'var(--color-warning-surface)',
                    color: 'var(--color-warning-text)',
                    padding: '4px 50px',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '1px',
                    border: '1px solid var(--color-warning-text)',
                  }}
                >
                  SAMPLE
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <h4 style={{ fontSize: '17px', fontWeight: 800 }}>Facture N° {inv.id}</h4>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      Mission : {inv.missionTitle} &middot; Émise le {inv.issuedAt}
                    </span>
                  </div>
                  <StatusBadge label="Facture Kazi" variant="info" />
                </div>

                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--color-background)',
                    borderRadius: 'var(--radius-input)',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px' }}>
                    <span>Honoraires de recrutement Kazi (HT) :</span>
                    <strong>{inv.serviceFeeXAF.toLocaleString('fr-GA')} FCFA</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px' }}>
                    <span>TVA Gabon (18%) :</span>
                    <strong>{inv.vatXAF.toLocaleString('fr-GA')} FCFA</strong>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--color-border)',
                      paddingTop: '8px',
                      fontSize: '16px',
                      fontWeight: 800,
                      color: 'var(--color-primary)',
                    }}
                  >
                    <span>Total Facture Kazi (TTC) :</span>
                    <span>{inv.totalXAF.toLocaleString('fr-GA')} FCFA</span>
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  * Rappel : Les salaires des ouvriers sont réglés directement par votre entreprise de la main à la main ou par mobile money, sans transiter par les comptes de Kazi.
                </p>
              </div>
            ))}
          </div>
        )}

        {/* VIEW 7: SUPPORT */}
        {companyView === 'support' && (
          <div>
            <PageHeader
              title="Assistance & Coordinateur Kazi Dédié"
              subtitle="Échanges directs avec votre chargé de compte à Libreville"
            />

            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-card)',
                padding: '20px',
                height: '480px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', marginBottom: '12px' }}>
                <strong style={{ fontSize: '15px' }}>{companyTicket.subject}</strong>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  Fil de coordination opérationnelle chantier
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {companyTicket.messages
                  .filter((m) => !m.isStaffInternal)
                  .map((msg) => {
                    const isCompany = msg.senderRole === 'COMPANY';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isCompany ? 'flex-end' : 'flex-start',
                          maxWidth: '75%',
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-card)',
                          backgroundColor: isCompany ? 'var(--color-primary)' : 'var(--color-background)',
                          color: isCompany ? 'var(--color-on-primary)' : 'var(--color-text)',
                          fontSize: '14px',
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', opacity: 0.85 }}>
                          {msg.senderName}
                        </div>
                        <div>{msg.content}</div>
                      </div>
                    );
                  })}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                <input
                  type="text"
                  placeholder="Écrivez au coordinateur Kazi..."
                  value={newSupportMsg}
                  onChange={(e) => setNewSupportMsg(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-input)',
                    border: '1px solid var(--color-control-border)',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text)',
                  }}
                />
                <Button
                  variant="primary"
                  onClick={() => {
                    if (newSupportMsg.trim()) {
                      sendSupportMessage(companyTicket.id, newSupportMsg);
                      setNewSupportMsg('');
                    }
                  }}
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accept Proposal Modal */}
      <Dialog
        isOpen={isAcceptModalOpen}
        onClose={() => setIsAcceptModalOpen(false)}
        title="Valider la proposition de candidat"
        description="Règle de double confirmation Kazi (KZ08)"
        primaryAction={{
          label: 'Confirmer l’acceptation',
          onClick: handleConfirmAccept,
        }}
        secondaryAction={{
          label: 'Annuler',
          onClick: () => setIsAcceptModalOpen(false),
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '14px', lineHeight: 1.5 }}>
            Votre acceptation déclenchera immédiatement l'envoi d'une invitation à l'ouvrier pour qu'il confirme sa disponibilité dans un délai de <strong>24 heures</strong>.
          </p>
          <Alert type="info">
            L'affectation finale sera verrouillée de manière atomique par le recruteur Kazi une fois la confirmation de l'ouvrier reçue.
          </Alert>
        </div>
      </Dialog>
    </div>
  );
};
