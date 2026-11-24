// Kazi Candidate Row Component
// Displays candidate to companies strictly without private phone, full name, or identity documents

import React from 'react';
import { CheckCircle2, Shield, User } from 'lucide-react';
import { WorkerPublicProfile } from '../../types/domain';
import { StatusBadge } from './StatusBadge';
import { Button } from './Button';

export interface CandidateRowProps {
  candidate: WorkerPublicProfile;
  proposalStatus?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  showActions?: boolean;
}

export const CandidateRow: React.FC<CandidateRowProps> = ({
  candidate,
  proposalStatus,
  onAccept,
  onDecline,
  showActions = true,
}) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: '16px',
        marginBottom: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--color-border)',
            }}
          >
            <User size={22} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
                {candidate.firstName} {candidate.lastNameInitial}
              </h4>
              {candidate.verifiedStatus === 'VERIFIED' && (
                <span title="Profil vérifié par Kazi" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Shield size={14} style={{ color: 'var(--color-success-text)' }} />
                </span>
              )}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
              {candidate.primaryTrade} &middot; {candidate.commune}
            </p>
          </div>
        </div>

        {proposalStatus && (
          <StatusBadge
            label={proposalStatus}
            variant={
              proposalStatus.includes('CONFIRM') || proposalStatus.includes('ACCEPT')
                ? 'success'
                : proposalStatus.includes('ATTENTE')
                ? 'warning'
                : 'info'
            }
          />
        )}
      </div>

      {/* Skills Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {candidate.skills.map((skill, i) => (
          <span
            key={i}
            style={{
              fontSize: '11px',
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
          >
            {skill}
          </span>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: 'var(--color-text-muted)',
          borderTop: '1px solid var(--color-border)',
          paddingTop: '8px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CheckCircle2 size={13} style={{ color: 'var(--color-success-text)' }} />
          Assiduité historique : <strong>{candidate.attendanceRate}%</strong> ({candidate.completedMissionsCount} missions)
        </span>
        <span style={{ fontStyle: 'italic', fontSize: '11px' }}>
          Identité & contact gérés sous secret Kazi
        </span>
      </div>

      {showActions && (onAccept || onDecline) && (
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          {onDecline && (
            <Button variant="secondary" size="sm" onClick={onDecline} style={{ flex: 1 }}>
              Décliner ce profil
            </Button>
          )}
          {onAccept && (
            <Button variant="primary" size="sm" onClick={onAccept} style={{ flex: 1 }}>
              Accepter le profil
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
