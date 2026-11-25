// Kazi Administration & Staff View (Role: RECRUITER / FINANCE / ADMIN)
// Demonstrates Prioritized Queue, Request Moderation, Worker Verification, Candidate Matching, Atomic Finalization,
// Attendance Arbitration, Billing, Theme Settings with 17-pair Contrast Matrix, and Redacted Audit Log

import React, { useState } from 'react';
import {
  Inbox,
  FileCheck2,
  Users2,
  CheckCircle,
  AlertTriangle,
  Receipt,
  Palette,
  ShieldCheck,
  History,
  Lock,
  Eye,
  Check,
  RefreshCw,
} from 'lucide-react';
import { usePrototype } from '../../context/PrototypeContext';
import { WorkspaceSidebar } from '../../components/ui/WorkspaceSidebar';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Alert } from '../../components/ui/Alert';
import { Dialog } from '../../components/ui/Dialog';
import { DataTable } from '../../components/ui/DataTable';
import { Field } from '../../components/ui/Field';
import { AttendanceRow } from '../../components/ui/AttendanceRow';
import { CandidateRow } from '../../components/ui/CandidateRow';
import { REGISTERED_THEMES } from '../../tokens/theme';

export const AdminView: React.FC = () => {
  const {
    adminView,
    setAdminView,
    theme,
    setTheme,
    contrastResults,
    themeSwitchCount,
    staffingRequests,
    missions,
    workers,
    applications,
    proposals,
    assignments,
    attendance,
    invoices,
    quotes,
    replacements,
    auditLogs,
    adminModerateRequest,
    adminProposeCandidates,
    adminFinalizeAssignment,
    adminResolveDispute,
    adminRequestReplacement,
    adminConfirmReplacement,
    staffCreateAndSendQuote,
    staffGenerateInvoice,
    staffRecordReceipt,
  } = usePrototype();

  const [selectedReqId, setSelectedReqId] = useState<string>('req-02');
  const [changesNote, setChangesNote] = useState<string>('Veuillez préciser le lieu exact et le taux journalier net.');
  const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);

  // Matching selections
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>(['worker-03']);

  // Modals
  const [selectedAuditRecord, setSelectedAuditRecord] = useState<any>(null);

  const pendingRequests = staffingRequests.filter((r) => r.status === 'SUBMITTED');
  const readyProposals = proposals.filter((p) => p.status === 'READY_FOR_ASSIGNMENT');
  const disputedAttendance = attendance.filter((a) => a.reviewState === 'DISPUTED');

  const navItems = [
    { id: 'queue', label: 'File prioritaire (À traiter)', icon: Inbox, badge: pendingRequests.length + readyProposals.length + disputedAttendance.length },
    { id: 'requests_moderation', label: 'Modération des demandes', icon: FileCheck2, badge: pendingRequests.length || undefined },
    { id: 'workers_verify', label: 'Vivier & Vérification CNI', icon: Users2 },
    { id: 'candidate_matching', label: 'Matching & Présélection', icon: CheckCircle },
    { id: 'finalization', label: 'Finalisation des affectations', icon: Lock, badge: readyProposals.length || undefined },
    { id: 'attendance_disputes', label: 'Arbitrage des litiges', icon: AlertTriangle, badge: disputedAttendance.length || undefined },
    { id: 'billing', label: 'Facturation Kazi (SAMPLE)', icon: Receipt },
    { id: 'themes_settings', label: 'Paramètres & Thèmes', icon: Palette },
    { id: 'audit_log', label: 'Journal d’Audit (Immuable)', icon: History },
  ];

  const handleToggleWorker = (wId: string) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(wId) ? prev.filter((id) => id !== wId) : [...prev, wId]
    );
  };

  return (
    <div style={{ display: 'flex', minHeight: '100%', backgroundColor: 'var(--color-background)' }}>
      {/* Staff Sidebar */}
      <WorkspaceSidebar
        title="Kazi Opérations"
        subtitle="Portail Recruteur & Admin"
        items={navItems}
        activeId={adminView}
        onSelect={setAdminView}
      />

      {/* Main Workspace */}
      <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
        {/* VIEW 1: PRIORITIZED QUEUE */}
        {adminView === 'queue' && (
          <div>
            <PageHeader
              title="File Prioritaire des Actions Requises"
              subtitle="Opérations urgentes à traiter par les coordinateurs et recruteurs Kazi (Libreville)"
              badge="Portée Gabon"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  Demandes d'entreprises en attente
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                  {pendingRequests.length}
                </div>
                <Button size="sm" variant="secondary" onClick={() => setAdminView('requests_moderation')} style={{ marginTop: '10px' }}>
                  Examiner les demandes
                </Button>
              </div>

              <div
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  Confirmations prêtes à finaliser (KZ09)
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-success-text)', marginTop: '4px' }}>
                  {readyProposals.length}
                </div>
                <Button size="sm" variant="primary" onClick={() => setAdminView('finalization')} style={{ marginTop: '10px' }}>
                  Finaliser les placements
                </Button>
              </div>

              <div
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  Litiges de pointage à arbitrer
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-danger-text)', marginTop: '4px' }}>
                  {disputedAttendance.length}
                </div>
                <Button size="sm" variant="danger" onClick={() => setAdminView('attendance_disputes')} style={{ marginTop: '10px' }}>
                  Régler les désaccords
                </Button>
              </div>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
              Dernières actions opérationnelles enregistrées dans l'audit
            </h3>
            <DataTable
              data={auditLogs.slice(0, 4)}
              keyExtractor={(log) => log.id}
              columns={[
                { header: 'Horodatage (UTC)', accessor: (l) => l.timestamp.split('T')[1].slice(0, 8) },
                { header: 'Acteur', accessor: (l) => <strong>{l.actor}</strong> },
                { header: 'Action', accessor: (l) => <StatusBadge label={l.action} variant="info" /> },
                { header: 'Portée', accessor: (l) => l.scope },
                { header: 'Motif', accessor: (l) => l.reason || 'N/A' },
              ]}
            />
          </div>
        )}

        {/* VIEW 2: REQUESTS MODERATION (KZ03 & KZ04) */}
        {adminView === 'requests_moderation' && (
          <div>
            <PageHeader
              title="Modération des Demandes & Publication de Missions"
              subtitle="Contrôle de conformité entreprise et vérification des termes avant ouverture aux ouvriers (KZ04)"
            />

            <DataTable
              data={staffingRequests}
              keyExtractor={(r) => r.id}
              columns={[
                { header: 'Entreprise', accessor: (r) => <strong>{r.companyName}</strong> },
                { header: 'Poste', accessor: (r) => r.trade },
                { header: 'Effectif', accessor: (r) => `${r.headcount} pers.` },
                { header: 'Chantier', accessor: (r) => `${r.siteName} (${r.commune})` },
                { header: 'Taux direct', accessor: (r) => `${(r.dayPayXAF || 15000).toLocaleString('fr-GA')} FCFA` },
                {
                  header: 'Statut',
                  accessor: (r) => (
                    <StatusBadge
                      label={r.status}
                      variant={r.status === 'APPROVED' ? 'success' : r.status === 'SUBMITTED' ? 'warning' : 'info'}
                    />
                  ),
                },
                {
                  header: 'Actions Staff',
                  accessor: (r) => (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {r.status === 'SUBMITTED' ? (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => adminModerateRequest(r.id, 'APPROVE')}
                          >
                            Approuver & Publier
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedReqId(r.id);
                              setIsChangesModalOpen(true);
                            }}
                          >
                            Demander corrections
                          </Button>
                        </>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Traité</span>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* VIEW 3: WORKER VERIFICATION & PRIVATE NOTES (KZ01 & KZ07) */}
        {adminView === 'workers_verify' && (
          <div>
            <PageHeader
              title="Vivier Ouvriers & Vérification Documentaire"
              subtitle="Contrôle des pièces d'identité CNI et gestion des notes internes confidentielles Kazi"
            />

            <Alert type="info">
              Les notes internes et numéros de CNI figurant ci-dessous sont <strong>strictement confidentiels</strong> et ne sont jamais transmis aux entreprises clientes.
            </Alert>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {workers.map((w) => (
                <div
                  key={w.id}
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-card)',
                    padding: '20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ fontSize: '16px', fontWeight: 800 }}>
                          {w.firstName} {w.lastName}
                        </h4>
                        <StatusBadge
                          label={w.verifiedStatus === 'VERIFIED' ? 'CNI Vérifiée' : 'En attente CNI'}
                          variant={w.verifiedStatus === 'VERIFIED' ? 'success' : 'warning'}
                        />
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Téléphone : <strong>{w.phone}</strong> &middot; CNI : <strong>{w.cniNumber}</strong> &middot; {w.commune}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {w.primaryTrade}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        Assiduité : {w.attendanceRate}% ({w.completedMissionsCount} missions)
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
                    <strong style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Notes internes recruteurs Kazi (Privées) :
                    </strong>
                    <ul style={{ paddingLeft: '18px', marginTop: '4px', fontSize: '13px', color: 'var(--color-text)' }}>
                      {w.internalNotes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 4: MATCHING & SELECTION (KZ07) */}
        {adminView === 'candidate_matching' && (() => {
          const openMissions = missions.filter((m) => m.status === 'OPEN');
          const targetMission = openMissions[0] || missions[0];
          const missionApps = targetMission ? applications.filter((a) => a.missionId === targetMission.id) : [];

          return (
            <div>
              <PageHeader
                title="Matching & Proposition de Candidats"
                subtitle="Présélectionnez les ouvriers éligibles et transmettez leurs profils à l'entreprise cliente (KZ07)"
              />

              {targetMission && (
                <div style={{ marginBottom: '16px', padding: '14px 18px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-input)', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      Mission active ({targetMission.companyName})
                    </span>
                    <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>
                      {targetMission.title} &middot; {targetMission.trade}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {targetMission.siteName} ({targetMission.area}) &middot; {targetMission.dayPayXAF.toLocaleString('fr-GA')} FCFA/jour
                    </div>
                  </div>
                  <StatusBadge label={`Besoin : ${targetMission.headcountNeeded - targetMission.headcountAssigned} place(s)`} variant="info" />
                </div>
              )}

              {/* Candidatures reçues pour cette mission */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
                  Candidatures soumises par les ouvriers ({missionApps.length})
                </h4>
                {missionApps.length === 0 ? (
                  <div style={{ padding: '16px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    Aucune candidature ouvrière en attente pour cette mission.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {missionApps.map((app) => {
                      const isProposed = app.status === 'PROPOSED' || app.status === 'ASSIGNED';
                      return (
                        <div
                          key={app.id}
                          style={{
                            padding: '14px 18px',
                            backgroundColor: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-card)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <strong>{app.workerName}</strong> &middot; {app.workerTrade} ({app.workerArea})
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                              Candidature #{app.id} &middot; Soumise le {new Date(app.submittedAt).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                          <div>
                            {isProposed ? (
                              <StatusBadge label="Transmis à l’entreprise" variant="info" />
                            ) : (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => targetMission && adminProposeCandidates(targetMission.id, [app.id])}
                              >
                                Présélectionner & Proposer à l’entreprise (KZ07)
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Vivier complémentaire vérifié */}
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>
                Vivier Kazi vérifié (Libreville)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {workers.map((w) => {
                  const isSelected = selectedWorkerIds.includes(w.id);
                  return (
                    <div
                      key={w.id}
                      onClick={() => handleToggleWorker(w.id)}
                      style={{
                        padding: '14px 18px',
                        backgroundColor: isSelected ? 'var(--color-success-surface)' : 'var(--color-surface)',
                        border: `1.5px solid ${isSelected ? 'var(--color-success-text)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '4px',
                            border: `2px solid ${isSelected ? 'var(--color-success-text)' : 'var(--color-control-border)'}`,
                            backgroundColor: isSelected ? 'var(--color-success-text)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                          }}
                        >
                          {isSelected && <Check size={14} />}
                        </div>
                        <div>
                          <strong>{w.firstName} {w.lastNameInitial}</strong> &middot; {w.primaryTrade} ({w.commune})
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            Compétences : {w.skills.join(', ')}
                          </div>
                        </div>
                      </div>

                      <StatusBadge
                        label={w.verifiedStatus === 'VERIFIED' ? 'Vérifié' : 'En attente CNI'}
                        variant={w.verifiedStatus === 'VERIFIED' ? 'success' : 'neutral'}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* VIEW 5: ATOMIC FINALIZATION (KZ08 & KZ09) */}
        {adminView === 'finalization' && (
          <div>
            <PageHeader
              title="Finalisation Atomique des Assignations"
              subtitle="Vérification conjointe : Accord entreprise + Confirmation ouvrier sur termes identiques (KZ08 / KZ09)"
            />

            <Alert type="success" title="Règle d'invariance KZ09">
              La finalisation verrouille simultanément le calendrier de l'ouvrier et décrémente la capacité de la mission. En cas de concurrence sur la dernière place restante, une seule transaction est autorisée avec succès.
            </Alert>

            {readyProposals.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)' }}>
                Aucune affectation en attente de finalisation.
              </div>
            ) : (
              readyProposals.map((prop) => (
                <div
                  key={prop.id}
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1.5px solid var(--color-primary)',
                    borderRadius: 'var(--radius-card)',
                    padding: '20px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ fontSize: '16px', fontWeight: 800 }}>{prop.workerName}</h4>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                        Mission : {prop.missionTitle} &middot; Termes Révision {prop.termsRevision}
                      </div>
                    </div>
                    <StatusBadge label="Prêt pour finalisation" variant="success" />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-input)', fontSize: '13px', marginBottom: '16px' }}>
                    <div>
                      Accord Entreprise : <strong style={{ color: 'var(--color-success-text)' }}>VALIDÉ (ACCEPTED)</strong>
                    </div>
                    <div>
                      Confirmation Ouvrier : <strong style={{ color: 'var(--color-success-text)' }}>CONFIRMÉE (24h OK)</strong>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    leftIcon={<Lock size={16} />}
                    onClick={() => adminFinalizeAssignment(prop.id)}
                  >
                    Finaliser l'affectation ferme (Verrouillage atomique)
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {/* VIEW 6: ATTENDANCE DISPUTES ARBITRATION (KZ10) */}
        {adminView === 'attendance_disputes' && (
          <div>
            <PageHeader
              title="Arbitrage des Litiges d’Assiduité (KZ10)"
              subtitle="Résolution contradictoire des désaccords de pointage entre entreprise et ouvrier"
            />

            {disputedAttendance.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)' }}>
                Aucun litige de pointage en cours.
              </div>
            ) : (
              disputedAttendance.map((rec) => (
                <AttendanceRow
                  key={rec.id}
                  record={rec}
                  role="ADMIN"
                  onResolve={(status, note) => adminResolveDispute(rec.id, status, note)}
                />
              ))
            )}

            {/* Replacement Requests Management (KZ11) */}
            <div style={{ marginTop: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 700 }}>
                  Demandes de Remplacement d’Ouvriers (KZ11) ({replacements.length})
                </h4>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    adminRequestReplacement(
                      'assign-01',
                      'wp_worker-01',
                      ['day-02'],
                      'Demande de remplacement initiée par le recruteur Kazi'
                    )
                  }
                >
                  Ouvrir une demande de remplacement
                </Button>
              </div>

              {replacements.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                  Aucune demande de remplacement en attente.
                </div>
              ) : (
                replacements.map((rep) => (
                  <div
                    key={rep.id}
                    style={{
                      padding: '14px 16px',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-card)',
                      marginBottom: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '14px' }}>
                        Remplacement #{rep.id.slice(0, 8)} &middot; Affectation : {rep.originalAssignmentId}
                      </strong>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        Ouvrier : {rep.workerId} &middot; Motif : {rep.reasonCode} {rep.note ? `— ${rep.note}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StatusBadge
                        label={rep.status}
                        variant={rep.status === 'CONFIRMED' ? 'success' : 'warning'}
                      />
                      {rep.status !== 'CONFIRMED' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() =>
                            adminConfirmReplacement(
                              rep.id,
                              `assign-repl-${rep.id.slice(0, 6)}`,
                              rep.version || 1
                            )
                          }
                        >
                          Confirmer affectation remplaçant
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW 7: BILLING (KZ14) */}
        {adminView === 'billing' && (
          <div>
            <PageHeader
              title="Facturation Kazi & Reçus Opérationnels (KZ14)"
              subtitle="Gestion des honoraires de service Kazi (Interdiction absolue d'inclure les salaires ouvriers)"
              actions={
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    staffCreateAndSendQuote(
                      'company-a',
                      'mission-01',
                      'Honoraires de sélection & suivi opérationnel Kazi',
                      40000
                    )
                  }
                >
                  Créer & Envoyer Devis Kazi (40 000 FCFA HT)
                </Button>
              }
            />

            <Alert type="warning" title="Spécimen de prototype (SAMPLE)">
              Toutes les factures générées à ce stade comportent la mention SAMPLE. L'émission réelle débutera après validation des décisions juridiques et fiscales du propriétaire (DECISIONS.md).
            </Alert>

            {quotes.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '10px' }}>
                  Devis de Service Kazi ({quotes.length})
                </h4>
                {quotes.map((q) => (
                  <div
                    key={q.id}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-card)',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '13px' }}>Devis #{q.id.slice(0, 12)}</strong> &middot;{' '}
                      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                        HT : {Number(q.serviceAmount).toLocaleString('fr-GA')} FCFA &middot; TVA : {Number(q.taxAmount).toLocaleString('fr-GA')} FCFA &middot; TTC : <strong>{Number(q.totalAmount).toLocaleString('fr-GA')} FCFA</strong>
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StatusBadge
                        label={q.status}
                        variant={q.status === 'ACCEPTED' ? 'success' : q.status === 'SENT' ? 'info' : 'neutral'}
                      />
                      {q.status === 'ACCEPTED' && (
                        <Button size="sm" variant="primary" onClick={() => staffGenerateInvoice(q.id)}>
                          Émettre Facture SAMPLE
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <DataTable
              data={invoices}
              keyExtractor={(i) => i.id}
              columns={[
                { header: 'N° Facture', accessor: (i) => <strong>{i.id}</strong> },
                { header: 'Entreprise', accessor: (i) => i.companyName },
                { header: 'Honoraires Kazi (HT)', accessor: (i) => `${i.serviceFeeXAF.toLocaleString('fr-GA')} FCFA` },
                { header: 'TVA (18%)', accessor: (i) => `${i.vatXAF.toLocaleString('fr-GA')} FCFA` },
                { header: 'Total TTC', accessor: (i) => <strong>{i.totalXAF.toLocaleString('fr-GA')} FCFA</strong> },
                { header: 'Réglé (Hors-ligne)', accessor: (i) => `${(i.paidAmountXAF || 0).toLocaleString('fr-GA')} FCFA` },
                {
                  header: 'Statut',
                  accessor: (i) => (
                    <StatusBadge
                      label={i.status || 'SAMPLE'}
                      variant={i.status === 'PAID' ? 'success' : 'warning'}
                    />
                  ),
                },
                {
                  header: 'Reçu Bancaire',
                  accessor: (i) =>
                    i.status !== 'PAID' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          staffRecordReceipt(
                            i.invoiceId || i.id,
                            i.totalXAF - (i.paidAmountXAF || 0),
                            `VIR-BGFI-${Date.now().toString().slice(-5)}`
                          )
                        }
                      >
                        Enregistrer reçu
                      </Button>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--color-success-text)', fontWeight: 700 }}>
                        Soldée
                      </span>
                    ),
                },
              ]}
            />
          </div>
        )}

        {/* VIEW 8: THEMES SETTINGS & WCAG CONTRAST MATRIX (KZ16) */}
        {adminView === 'themes_settings' && (
          <div>
            <PageHeader
              title="Configuration des Thèmes & Accessibilité WCAG"
              subtitle="Vérification de la portabilité sémantique : 17 paires de contraste vérifiées sans modification métier"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              {/* Theme 1: Gabon Premium */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: `2px solid ${theme.themeId === 'gabon-premium@1.0.0' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-card)',
                  padding: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 800 }}>gabon-premium@1.0.0</h4>
                  {theme.themeId === 'gabon-premium@1.0.0' && <StatusBadge label="Actif" variant="success" />}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
                  Direction retenue pour le lancement Gabon : vert profond, accents or légers et fonds chauds.
                </p>
                <Button
                  variant={theme.themeId === 'gabon-premium@1.0.0' ? 'secondary' : 'primary'}
                  disabled={theme.themeId === 'gabon-premium@1.0.0'}
                  onClick={() => setTheme('gabon-premium@1.0.0', 'Activation thème Gabon pour validation D0e')}
                >
                  {theme.themeId === 'gabon-premium@1.0.0' ? 'Thème actuel' : 'Activer Gabon Premium'}
                </Button>
              </div>

              {/* Theme 2: Forest Premium */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: `2px solid ${theme.themeId === 'forest-premium@1.0.0' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: 'var(--radius-card)',
                  padding: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 800 }}>forest-premium@1.0.0</h4>
                  {theme.themeId === 'forest-premium@1.0.0' && <StatusBadge label="Actif" variant="success" />}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
                  Ancienne direction conservée pour la preuve de portabilité : orange chaleureux et accents forêt.
                </p>
                <Button
                  variant={theme.themeId === 'forest-premium@1.0.0' ? 'secondary' : 'primary'}
                  disabled={theme.themeId === 'forest-premium@1.0.0'}
                  onClick={() => setTheme('forest-premium@1.0.0', 'Activation thème Forest pour validation D0e')}
                >
                  {theme.themeId === 'forest-premium@1.0.0' ? 'Thème actuel' : 'Activer Forest Premium'}
                </Button>
              </div>
            </div>

            {/* Live WCAG Contrast Matrix */}
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>
              Rapport d'accessibilité WCAG 2.2 AA du thème actif ({contrastResults.filter((r) => r.pass).length} / {contrastResults.length} paires validées)
            </h3>
            <DataTable
              data={contrastResults}
              keyExtractor={(r) => `${r.fgKey}-${r.bgKey}`}
              columns={[
                {
                  header: 'Paire sémantique (Premier plan / Arrière-plan)',
                  accessor: (r) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: r.fgColor, border: '1px solid #ccc' }} />
                      <span>{r.fgKey} / {r.bgKey}</span>
                    </div>
                  ),
                },
                { header: 'Couleurs hex', accessor: (r) => `${r.fgColor} sur ${r.bgColor}` },
                {
                  header: 'Ratio calculé',
                  accessor: (r) => <strong>{r.ratio.toFixed(2)}:1</strong>,
                },
                { header: 'Minimum requis', accessor: (r) => `${r.minRequired}:1` },
                {
                  header: 'Résultat WCAG',
                  accessor: (r) => (
                    <StatusBadge
                      label={r.pass ? 'CONFORME (PASS)' : 'ÉCHEC'}
                      variant={r.pass ? 'success' : 'danger'}
                    />
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* VIEW 9: AUDIT LOG (KZ17) */}
        {adminView === 'audit_log' && (
          <div>
            <PageHeader
              title="Journal d’Audit Opérationnel Immuable"
              subtitle="Traçabilité complète des actions de modération, d'affectation et de changement de thème (KZ17)"
            />

            <DataTable
              data={auditLogs}
              keyExtractor={(l) => l.id}
              columns={[
                { header: 'Horodatage (UTC)', accessor: (l) => l.timestamp.replace('T', ' ').slice(0, 19) },
                { header: 'Acteur', accessor: (l) => <strong>{l.actor}</strong> },
                { header: 'Rôle', accessor: (l) => <StatusBadge label={l.role} variant="neutral" /> },
                { header: 'Portée', accessor: (l) => l.scope },
                { header: 'Action', accessor: (l) => <StatusBadge label={l.action} variant="info" /> },
                { header: 'Ancienne valeur', accessor: (l) => l.previousValue },
                { header: 'Nouvelle valeur', accessor: (l) => <strong>{l.newValue}</strong> },
                { header: 'Motif consigné', accessor: (l) => l.reason || 'N/A' },
              ]}
            />
          </div>
        )}
      </div>

      {/* Changes Request Dialog */}
      <Dialog
        isOpen={isChangesModalOpen}
        onClose={() => setIsChangesModalOpen(false)}
        title="Demander des corrections à l'entreprise"
        description="La demande passera au statut CHANGES_REQUESTED"
        primaryAction={{
          label: 'Transmettre la demande de corrections',
          variant: 'danger',
          onClick: () => {
            adminModerateRequest(selectedReqId, 'REQUEST_CHANGES', changesNote);
            setIsChangesModalOpen(false);
          },
        }}
        secondaryAction={{
          label: 'Annuler',
          onClick: () => setIsChangesModalOpen(false),
        }}
      >
        <Field
          label="Motif des corrections demandées"
          value={changesNote}
          onChange={(e) => setChangesNote(e.target.value)}
          required
        />
      </Dialog>
    </div>
  );
};
