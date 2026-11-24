// Kazi Component Specimens Gallery (Phase D0b)
// Demonstrates all 24 shared components in their various states (default, hover, focus, disabled, loading, empty, error)

import React, { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Alert } from '../../components/ui/Alert';
import { Dialog } from '../../components/ui/Dialog';
import { Tabs } from '../../components/ui/Tabs';
import { MoneyField } from '../../components/ui/MoneyField';
import { OTPInput } from '../../components/ui/OTPInput';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { FileUpload } from '../../components/ui/FileUpload';
import { Timeline } from '../../components/ui/Timeline';
import { DataTable } from '../../components/ui/DataTable';

export const SpecimensView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('buttons');
  const [moneyVal, setMoneyVal] = useState<number>(12500);
  const [otpVal, setOtpVal] = useState<string>('2410');
  const [isDemoDialogOpen, setIsDemoDialogOpen] = useState(false);

  const tabs = [
    { id: 'buttons', label: 'Boutons & Actions' },
    { id: 'forms', label: 'Champs & Saisies' },
    { id: 'badges', label: 'Badges & Alertes' },
    { id: 'states', label: 'États Vides & Erreurs' },
    { id: 'timeline', label: 'Timeline & Données' },
  ];

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1080px', margin: '0 auto', backgroundColor: 'var(--color-background)' }}>
      <PageHeader
        title="Spécimens des Composants Partagés (D0b)"
        subtitle="Catalogue de validation des 24 composants sémantiques réutilisables sous les thèmes Gabon et Forest"
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* SECTION 1: BUTTONS */}
      {activeTab === 'buttons' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Variantes de Boutons</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <Button variant="primary">Bouton Principal</Button>
              <Button variant="secondary">Bouton Secondaire</Button>
              <Button variant="accent">Bouton Accent</Button>
              <Button variant="danger">Bouton Danger</Button>
              <Button variant="outline">Bouton Contour</Button>
              <Button variant="ghost">Bouton Fantôme</Button>
            </div>
          </div>

          <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>États d'interaction</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <Button variant="primary" isLoading>En cours de chargement</Button>
              <Button variant="primary" disabled>Bouton Désactivé</Button>
              <Button variant="secondary" disabled>Secondaire Désactivé</Button>
              <Button variant="primary" onClick={() => setIsDemoDialogOpen(true)}>
                Ouvrir Modale Accessible
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: FORMS */}
      {activeTab === 'forms' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Champs de Saisie</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Field label="Nom complet de l'ouvrier" placeholder="Ex: Paul Mba" required />
              <Field label="Numéro de téléphone gabonais" placeholder="+241 07 90 11 22" helperText="Préfixe international +241" />
              <Field label="Champ avec erreur" value="Saisie invalide" error="Ce numéro ne correspond pas au format gabonais." />
              <Select
                label="Commune de résidence"
                options={[
                  { value: 'lbv', label: 'Libreville' },
                  { value: 'akd', label: 'Akanda' },
                  { value: 'owd', label: 'Owendo' },
                ]}
              />
            </div>
          </div>

          <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Composants Spécifiques</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <MoneyField label="Rémunération journalière nette" value={moneyVal} onChange={setMoneyVal} />
              </div>
              <div>
                <FileUpload label="Téléversement de pièce CNI ou RCCM" />
              </div>
            </div>
          </div>

          <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Code OTP SMS (6 chiffres)</h4>
            <OTPInput value={otpVal} onChange={setOtpVal} onResend={() => alert('Code renvoyé')} />
          </div>
        </div>
      )}

      {/* SECTION 3: BADGES & ALERTS */}
      {activeTab === 'badges' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Status Badges Sémantiques</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <StatusBadge label="Confirmé" variant="success" />
              <StatusBadge label="En attente" variant="warning" />
              <StatusBadge label="Rejeté / Litige" variant="danger" />
              <StatusBadge label="Information" variant="info" />
              <StatusBadge label="Neutre / Brouillon" variant="neutral" />
              <StatusBadge label="Marque Kazi" variant="primary" />
            </div>
          </div>

          <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Boîtes d'Alertes</h4>
            <Alert type="info" title="Information Système">
              Ceci est une alerte informative consommant les variables --color-info-surface et --color-info-text.
            </Alert>
            <Alert type="success" title="Opération Réussie">
              La candidature a été transmise aux recruteurs Kazi avec succès.
            </Alert>
            <Alert type="warning" title="Action Requise">
              Il reste 6 heures avant expiration de la proposition de disponibilité.
            </Alert>
            <Alert type="danger" title="Alerte Litige">
              Un désaccord d'assiduité a été signalé sur cette mission.
            </Alert>
          </div>
        </div>
      )}

      {/* SECTION 4: STATES */}
      {activeTab === 'states' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Squelettes de Chargement</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Skeleton width="40%" height="24px" />
              <Skeleton width="80%" height="16px" />
              <Skeleton width="60%" height="16px" />
            </div>
          </div>

          <EmptyState
            title="Spécimen État Vide"
            description="Aucun élément à afficher selon les critères appliqués."
            action={{ label: 'Action recommandée', onClick: () => alert('Action cliquée') }}
          />

          <ErrorState
            title="Spécimen État Erreur Réseau"
            message="Le chargement a échoué. Vos données saisies restent intactes."
            onRetry={() => alert('Nouvelle tentative')}
          />
        </div>
      )}

      {/* SECTION 5: TIMELINE & DATA */}
      {activeTab === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Chronologie de Recrutement</h4>
            <Timeline
              steps={[
                { title: 'Candidature soumise', description: 'Ouvrier inscrit sur la mission', timestamp: '21 Nov 09:30', status: 'completed' },
                { title: 'Présélection Kazi', description: 'Profil validé par le recruteur', timestamp: '22 Nov 14:00', status: 'completed' },
                { title: 'Accord Entreprise', description: 'Entreprise valide le profil proposé', timestamp: '22 Nov 17:30', status: 'completed' },
                { title: 'Confirmation Ouvrier', description: 'Invitation sous délai de 24h', timestamp: 'En attente', status: 'current' },
                { title: 'Affectation Finale Ferme', description: 'Verrouillage par Kazi (KZ09)', status: 'upcoming' },
              ]}
            />
          </div>
        </div>
      )}

      {/* Demo Accessible Dialog */}
      <Dialog
        isOpen={isDemoDialogOpen}
        onClose={() => setIsDemoDialogOpen(false)}
        title="Spécimen de Boîte de Dialogue"
        description="Conforme aux critères d'accessibilité WCAG 2.2"
        primaryAction={{ label: 'Valider', onClick: () => setIsDemoDialogOpen(false) }}
        secondaryAction={{ label: 'Fermer', onClick: () => setIsDemoDialogOpen(false) }}
      >
        <p style={{ fontSize: '14px', lineHeight: 1.5 }}>
          Cette boîte de dialogue gère le focus clavier, la touche Échap, le verrouillage du défilement d'arrière-plan et utilise les rayons de courbure spécifiés dans `design-system.json`.
        </p>
      </Dialog>
    </div>
  );
};
