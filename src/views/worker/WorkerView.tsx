// Kazi Worker Journey Prototype View (Role: WORKER)
// Demonstrates Discovery, Details, Apply, Double Confirmation, Assignment, Attendance, Support, and Edge States

import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  Banknote,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Calendar,
  Send,
  AlertTriangle,
  History,
  PhoneCall,
  UserCheck,
} from 'lucide-react';
import { usePrototype } from '../../context/PrototypeContext';
import { MissionCard } from '../../components/ui/MissionCard';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Alert } from '../../components/ui/Alert';
import { Dialog } from '../../components/ui/Dialog';
import { WorkerBottomNav } from '../../components/ui/WorkerBottomNav';
import { Timeline } from '../../components/ui/Timeline';
import { AttendanceRow } from '../../components/ui/AttendanceRow';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Field } from '../../components/ui/Field';
import { OTPInput } from '../../components/ui/OTPInput';

export const WorkerView: React.FC = () => {
  const {
    currentUser,
    workerView,
    setWorkerView,
    missions,
    applications,
    proposals,
    assignments,
    attendance,
    supportTickets,
    workers,
    selectedMissionId,
    setSelectedMissionId,
    applyToMission,
    withdrawApplication,
    workerConfirmProposal,
    workerConfirmAttendance,
    workerDisputeAttendance,
    createSupportTicket,
    sendSupportMessage,
    updateMyProfile,
  } = usePrototype();

  const currentWorker = workers[0]; // Paul Mba
  const activeMission = missions.find((m) => m.id === selectedMissionId) || missions[0];

  // Filters
  const [selectedTrade, setSelectedTrade] = useState<string>('TOUS');
  const [selectedArea, setSelectedArea] = useState<string>('TOUTES');

  // Modals & States
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [withdrawReason, setWithdrawReason] = useState<string>('Contrainte personnelle imprévue');
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputeRecordId, setDisputeRecordId] = useState<string>('');
  const [disputeNote, setDisputeNote] = useState<string>('Présent jusqu’à 16h avec le chef de chantier.');
  const [newSupportMsg, setNewSupportMsg] = useState<string>('');

  // Edge state simulator tabs
  const [demoState, setDemoState] = useState<'normal' | 'duplicate' | 'expired' | 'network_error' | 'otp_login'>('normal');
  const [simulatedOtp, setSimulatedOtp] = useState<string>('241001');

  const filteredMissions = missions.filter((m) => {
    if (m.status !== 'OPEN') return false;
    if (selectedTrade !== 'TOUS' && m.trade !== selectedTrade) return false;
    if (selectedArea !== 'TOUTES' && m.area !== selectedArea) return false;
    return true;
  });

  const activeWorkerId = currentUser?.workerProfileId || currentUser?.id || currentWorker.id;
  const workerApplications = applications.filter((a) => a.workerId === activeWorkerId || a.workerId === currentWorker.id || a.workerName?.includes('Paul'));
  const workerProposal =
    proposals.find((p) => p.workerId === activeWorkerId || p.workerId === currentWorker.id) ||
    proposals.find((p) => p.status === 'AWAITING_WORKER' || p.status === 'READY_FOR_ASSIGNMENT') ||
    proposals[0];
  const workerAssignment = assignments.find((a) => a.workerId === activeWorkerId || a.workerId === currentWorker.id) || assignments[0];
  const workerAttendance = attendance.filter(
    (att) =>
      att.workerId === activeWorkerId ||
      att.workerId === currentWorker.id ||
      att.workerId === 'wp_worker-01'
  );
  const workerTicket =
    supportTickets.find((t) => t.creatorId === activeWorkerId || t.creatorId === currentWorker.id) ||
    supportTickets[0] || {
      id: 'ticket-01',
      creatorRole: 'WORKER' as const,
      creatorId: activeWorkerId,
      creatorName: `${currentWorker.firstName} ${currentWorker.lastName}`,
      subject: 'Confirmation de mission & point de ramassage',
      status: 'OPEN' as const,
      messages: [],
    };

  const handleApplyConfirm = () => {
    applyToMission(activeMission.id, currentWorker.id);
    setIsApplyModalOpen(false);
    setWorkerView('applications');
  };

  const handleWithdrawConfirm = () => {
    if (selectedAppId) {
      withdrawApplication(selectedAppId, withdrawReason);
      setIsWithdrawModalOpen(false);
    }
  };

  const handleDisputeSubmit = () => {
    if (disputeRecordId) {
      workerDisputeAttendance(disputeRecordId, disputeNote);
      setIsDisputeModalOpen(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', backgroundColor: 'var(--color-background)' }}>
      {/* Worker Header */}
      <header
        style={{
          padding: '14px 16px',
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)' }}>Kazi</span>
            <StatusBadge label="Ouvrier" variant="primary" />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {currentWorker.firstName} {currentWorker.lastNameInitial} &middot; Libreville (+241)
          </div>
        </div>

        {/* State Simulator Switcher (strictly development only) */}
        {Boolean(import.meta.env?.DEV) && import.meta.env?.MODE !== 'production' && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <select
              value={demoState}
              onChange={(e) => setDemoState(e.target.value as any)}
              style={{
                fontSize: '11px',
                padding: '4px 6px',
                borderRadius: 'var(--radius-input)',
                backgroundColor: 'var(--color-background)',
                border: '1px solid var(--color-control-border)',
                color: 'var(--color-text)',
              }}
              title="Tester les états limites (D0c)"
            >
              <option value="normal">Cas Nominal</option>
              <option value="otp_login">Écran Connexion OTP</option>
              <option value="duplicate">État : Doublon</option>
              <option value="expired">État : Proposition Expirée</option>
              <option value="network_error">État : Erreur Réseau</option>
            </select>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '16px', maxWidth: '640px', width: '100%', margin: '0 auto' }}>
        {/* OTP Login State Demo */}
        {demoState === 'otp_login' && (
          <div style={{ padding: '24px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)' }}>Vérification Mobile</h3>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Entrez le code SMS reçu sur votre numéro gabonais
              </p>
            </div>
            <OTPInput value={simulatedOtp} onChange={setSimulatedOtp} phone={currentWorker.phone} />
            <div style={{ marginTop: '24px' }}>
              <Button
                variant="primary"
                style={{ width: '100%' }}
                onClick={() => setDemoState('normal')}
              >
                Confirmer le code
              </Button>
            </div>
          </div>
        )}

        {/* Network Error State Demo */}
        {demoState === 'network_error' && (
          <ErrorState
            title="Connexion réseau interrompue"
            message="Impossible de synchroniser les dernières missions. Vos données locales et brouillons restent conservés."
            onRetry={() => setDemoState('normal')}
          />
        )}

        {/* Duplicate Application State Demo */}
        {demoState === 'duplicate' && (
          <Alert
            type="warning"
            title="Candidature déjà transmise (Règle KZ06)"
            action={
              <Button size="sm" variant="secondary" onClick={() => setDemoState('normal')}>
                Fermer
              </Button>
            }
          >
            Vous avez déjà postulé à la mission <strong>{activeMission.title}</strong>. Conformément aux règles Kazi, une seule candidature par ouvrier est autorisée par mission.
          </Alert>
        )}

        {/* Expired Proposal State Demo */}
        {demoState === 'expired' && (
          <Alert
            type="danger"
            title="Délai de confirmation expiré (Règle KZ08)"
            action={
              <Button size="sm" variant="secondary" onClick={() => setDemoState('normal')}>
                Fermer
              </Button>
            }
          >
            Le délai de 24h pour confirmer votre disponibilité sur la mission BTP Horizon a expiré. Cette place a été libérée pour un autre candidat.
          </Alert>
        )}

        {/* Nominal Views */}
        {demoState !== 'otp_login' && demoState !== 'network_error' && (
          <>
            {/* VIEW 1: MISSIONS DISCOVERY */}
            {workerView === 'discovery' && (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>
                    Missions disponibles à Libreville
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    Sélectionnez une mission pour consulter les détails et postuler
                  </p>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {['TOUS', 'Manœuvre de chantier', 'Coffreur', 'Manutentionnaire'].map((trade) => (
                    <button
                      key={trade}
                      onClick={() => setSelectedTrade(trade)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: selectedTrade === trade ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: selectedTrade === trade ? 'var(--color-on-primary)' : 'var(--color-text)',
                        border: `1px solid ${selectedTrade === trade ? 'var(--color-primary)' : 'var(--color-control-border)'}`,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        minHeight: '36px',
                      }}
                    >
                      {trade}
                    </button>
                  ))}
                </div>

                {/* Missions List */}
                {filteredMissions.length === 0 ? (
                  <EmptyState
                    title="Aucune mission trouvée"
                    description="Aucune mission ouverte ne correspond actuellement à vos filtres à Libreville."
                    action={{ label: 'Réinitialiser les filtres', onClick: () => setSelectedTrade('TOUS') }}
                  />
                ) : (
                  filteredMissions.map((mission) => {
                    const isAlreadyApplied = applications.some(
                      (a) => a.missionId === mission.id && a.workerId === currentWorker.id && a.status !== 'WITHDRAWN'
                    );
                    return (
                      <MissionCard
                        key={mission.id}
                        mission={mission}
                        isApplied={isAlreadyApplied}
                        onSelect={(m) => {
                          setSelectedMissionId(m.id);
                          setWorkerView('detail');
                        }}
                        onApply={(m) => {
                          setSelectedMissionId(m.id);
                          setIsApplyModalOpen(true);
                        }}
                      />
                    );
                  })
                )}
              </div>
            )}

            {/* VIEW 2: MISSION DETAIL */}
            {workerView === 'detail' && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWorkerView('discovery')}
                  style={{ marginBottom: '12px' }}
                >
                  &larr; Retour aux missions
                </Button>

                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-card)',
                    padding: '20px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {activeMission.trade}
                    </span>
                    <StatusBadge label={`Termes Rév. ${activeMission.termsRevision}`} variant="info" />
                  </div>

                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)', marginBottom: '4px' }}>
                    {activeMission.title}
                  </h3>
                  <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                    {activeMission.companyName} &middot; {activeMission.siteName}
                  </div>

                  {/* Conditions Banner */}
                  <div
                    style={{
                      padding: '14px',
                      backgroundColor: 'var(--color-background)',
                      borderRadius: 'var(--radius-input)',
                      marginBottom: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Rémunération journalière :</span>
                      <strong style={{ color: 'var(--color-primary)' }}>
                        {activeMission.dayPayXAF.toLocaleString('fr-GA')} FCFA / jour
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Durée de la mission :</span>
                      <strong>{activeMission.totalDays} jours ouvrés</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Horaires quotidiens :</span>
                      <strong>{activeMission.dailyHours}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Lieu exact :</span>
                      <strong>{activeMission.address}</strong>
                    </div>
                  </div>

                  {/* Direct payment reassurance */}
                  <Alert type="success" title="Rémunération directe garantie (Invariant Kazi)">
                    La rémunération est versée directement par <strong>{activeMission.companyName}</strong> à la fin de la mission. Kazi ne prélève aucun frais ni commission sur le salaire des ouvriers.
                  </Alert>

                  {/* Tasks */}
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Tâches à accomplir :</h4>
                    <ul style={{ paddingLeft: '20px', fontSize: '13px', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {activeMission.tasks.map((task, idx) => (
                        <li key={idx}>{task}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Equipment */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', fontSize: '13px' }}>
                    <div style={{ padding: '10px', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-input)' }}>
                      <strong>Fourni par l’entreprise :</strong>
                      <div style={{ marginTop: '4px', color: 'var(--color-text-muted)' }}>
                        {activeMission.equipmentProvided.join(', ')}
                      </div>
                    </div>
                    <div style={{ padding: '10px', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-input)' }}>
                      <strong>Requis (à apporter) :</strong>
                      <div style={{ marginTop: '4px', color: 'var(--color-text-muted)' }}>
                        {activeMission.equipmentRequired.join(', ')}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    style={{ width: '100%' }}
                    onClick={() => setIsApplyModalOpen(true)}
                  >
                    Postuler à cette mission
                  </Button>
                </div>
              </div>
            )}

            {/* VIEW 3: APPLICATIONS & PROPOSALS */}
            {workerView === 'applications' && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
                  Mes Candidatures & Propositions
                </h3>

                {/* Urgent Confirmation Banner if proposal awaiting worker */}
                {workerProposal && workerProposal.status === 'AWAITING_WORKER' && (
                  <div
                    style={{
                      padding: '16px',
                      backgroundColor: 'var(--color-warning-surface)',
                      border: '1.5px solid var(--color-warning-text)',
                      borderRadius: 'var(--radius-card)',
                      color: 'var(--color-warning-text)',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                      <AlertTriangle size={18} />
                      <span>Proposition acceptée par l'entreprise !</span>
                    </div>
                    <p style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.4 }}>
                      L'entreprise a validé votre profil pour <strong>{workerProposal.missionTitle}</strong>. Veuillez confirmer votre disponibilité sous 24h.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => workerConfirmProposal(workerProposal.id, 'CONFIRMED')}
                      >
                        Confirmer ma disponibilité
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => workerConfirmProposal(workerProposal.id, 'DECLINED')}
                      >
                        Décliner
                      </Button>
                    </div>
                  </div>
                )}

                {/* Ready for Staff Notice */}
                {workerProposal && workerProposal.status === 'READY_FOR_ASSIGNMENT' && (
                  <Alert type="info" title="Disponibilité enregistrée">
                    Vous avez confirmé votre disponibilité. Le recruteur Kazi procède actuellement au verrouillage final de votre affectation (KZ09).
                  </Alert>
                )}

                {/* Applications List */}
                {workerApplications.length === 0 ? (
                  <EmptyState
                    title="Aucune candidature"
                    description="Vous n'avez pas encore postulé à une mission."
                    action={{ label: 'Découvrir les missions', onClick: () => setWorkerView('discovery') }}
                  />
                ) : (
                  workerApplications.map((app) => (
                    <div
                      key={app.id}
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-card)',
                        padding: '16px',
                        marginBottom: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontSize: '15px', fontWeight: 700 }}>{app.missionTitle}</h4>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            Soumise le {new Date(app.submittedAt).toLocaleDateString('fr-GA')}
                          </span>
                        </div>
                        <StatusBadge
                          label={
                            app.status === 'ASSIGNED'
                              ? 'Mission Confirmée'
                              : app.status === 'PROPOSED'
                              ? 'Proposé à l’entreprise'
                              : app.status === 'WITHDRAWN'
                              ? 'Retiré'
                              : app.status === 'SHORTLISTED'
                              ? 'Présélectionné'
                              : 'Candidature reçue'
                          }
                          variant={
                            app.status === 'ASSIGNED'
                              ? 'success'
                              : app.status === 'PROPOSED'
                              ? 'warning'
                              : app.status === 'WITHDRAWN'
                              ? 'neutral'
                              : 'info'
                          }
                        />
                      </div>

                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {app.status === 'ASSIGNED' ? 'Consulter votre feuille de route' : 'En cours d’évaluation par le recruteur'}
                        </span>
                        {app.status !== 'ASSIGNED' && app.status !== 'WITHDRAWN' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedAppId(app.id);
                              setIsWithdrawModalOpen(true);
                            }}
                            style={{ color: 'var(--color-danger-text)' }}
                          >
                            Se désister
                          </Button>
                        )}
                        {app.status === 'ASSIGNED' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setWorkerView('assignment')}
                          >
                            Voir mission
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* VIEW 4: ACTIVE ASSIGNMENT & ATTENDANCE */}
            {workerView === 'assignment' && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
                  Mission Active & Pointage
                </h3>

                {workerAssignment ? (
                  <>
                    <div
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1.5px solid var(--color-primary)',
                        borderRadius: 'var(--radius-card)',
                        padding: '18px',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                            Affectation Confirmée
                          </span>
                          <h4 style={{ fontSize: '18px', fontWeight: 800, marginTop: '2px' }}>
                            {workerAssignment.missionTitle}
                          </h4>
                          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                            {workerAssignment.companyName} &middot; {workerAssignment.siteName}
                          </span>
                        </div>
                        <StatusBadge label="En cours" variant="success" />
                      </div>

                      <div style={{ marginTop: '14px', padding: '10px', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-input)', fontSize: '13px' }}>
                        <div>Horaires : <strong>{workerAssignment.dailyHours}</strong></div>
                        <div style={{ marginTop: '4px' }}>
                          Rémunération garantie : <strong>{workerAssignment.dayPayXAF.toLocaleString('fr-GA')} FCFA / jour</strong>
                        </div>
                      </div>
                    </div>

                    {/* Attendance Records */}
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>
                        Pointage Journalier des Présences (KZ10)
                      </h4>
                      {workerAttendance.map((rec) => (
                        <AttendanceRow
                          key={rec.id}
                          record={rec}
                          role="WORKER"
                          onConfirm={() => workerConfirmAttendance(rec.id)}
                          onDispute={() => {
                            setDisputeRecordId(rec.id);
                            setIsDisputeModalOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="Aucune mission active"
                    description="Vous n'avez pas de mission active en cours aujourd'hui."
                    action={{ label: 'Consulter les missions', onClick: () => setWorkerView('discovery') }}
                  />
                )}
              </div>
            )}

            {/* VIEW 5: SUPPORT & MESSAGES */}
            {workerView === 'support' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                    Assistance & Coordination Kazi
                  </h3>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      createSupportTicket(
                        'CHANTIER',
                        'Demande de coordination chantier Libreville',
                        'Bonjour Kazi, je souhaite confirmer les consignes EPI pour demain matin.'
                      )
                    }
                  >
                    Nouveau dossier
                  </Button>
                </div>
                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-card)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '460px',
                  }}
                >
                  <div style={{ paddingBottom: '10px', borderBottom: '1px solid var(--color-border)', marginBottom: '10px' }}>
                    <strong>{workerTicket.subject}</strong>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      Coordinateur Kazi Libreville (Temps de réponse habituel &lt; 15 min)
                    </div>
                  </div>

                  {/* Messages list (filtered: excludes staff internal notes per PRD) */}
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {workerTicket.messages
                      .filter((m) => !m.isStaffInternal)
                      .map((msg) => {
                        const isMe = msg.senderRole === 'WORKER';
                        return (
                          <div
                            key={msg.id}
                            style={{
                              alignSelf: isMe ? 'flex-end' : 'flex-start',
                              maxWidth: '85%',
                              padding: '10px 14px',
                              borderRadius: 'var(--radius-card)',
                              backgroundColor: isMe ? 'var(--color-primary)' : 'var(--color-background)',
                              color: isMe ? 'var(--color-on-primary)' : 'var(--color-text)',
                              fontSize: '13px',
                            }}
                          >
                            <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '2px', opacity: 0.85 }}>
                              {msg.senderName}
                            </div>
                            <div>{msg.content}</div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Send input */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
                    <input
                      type="text"
                      placeholder="Écrivez votre message..."
                      value={newSupportMsg}
                      onChange={(e) => setNewSupportMsg(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
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
                      size="sm"
                      onClick={() => {
                        if (newSupportMsg.trim()) {
                          sendSupportMessage(workerTicket.id, newSupportMsg);
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

            {/* VIEW 6: WORKER PROFILE */}
            {workerView === 'profile' && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
                  Mon Profil Professionnel
                </h3>

                <div
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-card)',
                    padding: '18px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                    <div
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        fontWeight: 800,
                      }}
                    >
                      PM
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h4 style={{ fontSize: '17px', fontWeight: 800 }}>
                          {currentWorker.firstName} {currentWorker.lastName}
                        </h4>
                        <StatusBadge label="Vérifié CNI" variant="success" icon={<UserCheck size={12} />} />
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                        {currentWorker.primaryTrade} &middot; {currentWorker.commune} &middot; {currentWorker.phone}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ padding: '10px', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-input)', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)' }}>
                        {currentWorker.completedMissionsCount}
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Missions terminées</span>
                    </div>
                    <div style={{ padding: '10px', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-input)', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-success-text)' }}>
                        {currentWorker.attendanceRate}%
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Taux d’assiduité</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <h5 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>Compétences certifiées :</h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {currentWorker.skills.map((s, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '12px',
                            padding: '3px 9px',
                            backgroundColor: 'var(--color-background)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-pill)',
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Alert type="info">
                    Vos coordonnées privées (téléphone, CNI) ne sont jamais communiquées aux entreprises avant confirmation d'affectation par le coordinateur Kazi.
                  </Alert>

                  <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>
                      Disponibilité actuelle : <strong>{currentWorker.availableNow ? 'Disponible' : 'Occupé'}</strong>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        updateMyProfile({
                          availabilityCode: currentWorker.availableNow ? 'BUSY' : 'AVAILABLE',
                        })
                      }
                    >
                      Basculer disponibilité
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Worker Bottom Navigation */}
      <WorkerBottomNav activeTab={workerView} onChangeTab={setWorkerView} />

      {/* Apply Confirmation Dialog */}
      <Dialog
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Confirmer votre candidature"
        description="Vérification des conditions de la mission avant envoi"
        primaryAction={{
          label: 'Confirmer et postuler',
          onClick: handleApplyConfirm,
        }}
        secondaryAction={{
          label: 'Annuler',
          onClick: () => setIsApplyModalOpen(false),
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ padding: '12px', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-input)' }}>
            <strong>{activeMission.title}</strong>
            <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              {activeMission.companyName} &middot; {activeMission.area} &middot; {activeMission.dayPayXAF.toLocaleString('fr-GA')} FCFA / jour
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
            En postulant, vous confirmez être disponible pour les <strong>{activeMission.totalDays} jours</strong> de la mission et disposer des équipements requis (chaussures de sécurité).
          </p>
        </div>
      </Dialog>

      {/* Withdrawal Dialog */}
      <Dialog
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        title="Se désister de cette candidature"
        description="Cette action est définitive"
        primaryAction={{
          label: 'Confirmer le désistement',
          variant: 'danger',
          onClick: handleWithdrawConfirm,
        }}
        secondaryAction={{
          label: 'Conserver ma candidature',
          onClick: () => setIsWithdrawModalOpen(false),
        }}
      >
        <Field
          label="Motif du désistement"
          value={withdrawReason}
          onChange={(e) => setWithdrawReason(e.target.value)}
          required
        />
      </Dialog>

      {/* Attendance Dispute Dialog */}
      <Dialog
        isOpen={isDisputeModalOpen}
        onClose={() => setIsDisputeModalOpen(false)}
        title="Contester le pointage de présence"
        description="Médiation par l'équipe Kazi (KZ10)"
        primaryAction={{
          label: 'Transmettre la contestation',
          variant: 'danger',
          onClick: handleDisputeSubmit,
        }}
        secondaryAction={{
          label: 'Annuler',
          onClick: () => setIsDisputeModalOpen(false),
        }}
      >
        <Field
          label="Précisez les heures travaillées et les témoins"
          value={disputeNote}
          onChange={(e) => setDisputeNote(e.target.value)}
          required
        />
      </Dialog>
    </div>
  );
};
