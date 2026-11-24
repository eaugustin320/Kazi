// Kazi Mission Card Component
// Foregrounds trade, location, daily remuneration XAF, duration, and start date

import React from 'react';
import { MapPin, Calendar, Clock, Banknote, ShieldCheck } from 'lucide-react';
import { Mission } from '../../types/domain';
import { StatusBadge } from './StatusBadge';
import { Button } from './Button';

export interface MissionCardProps {
  mission: Mission;
  onSelect: (mission: Mission) => void;
  onApply?: (mission: Mission) => void;
  isApplied?: boolean;
}

export const MissionCard: React.FC<MissionCardProps> = ({
  mission,
  onSelect,
  onApply,
  isApplied = false,
}) => {
  const slotsRemaining = mission.headcountNeeded - mission.headcountAssigned;

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
        transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {mission.trade}
          </span>
          <h4
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--color-text)',
              marginTop: '2px',
              cursor: 'pointer',
            }}
            onClick={() => onSelect(mission)}
          >
            {mission.title}
          </h4>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{mission.companyName}</span>
        </div>

        <StatusBadge
          label={
            slotsRemaining > 0
              ? `${slotsRemaining} place${slotsRemaining > 1 ? 's' : ''}`
              : 'Complet'
          }
          variant={slotsRemaining > 0 ? 'success' : 'neutral'}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px',
          padding: '10px 12px',
          backgroundColor: 'var(--color-background)',
          borderRadius: 'var(--radius-input)',
          fontSize: '13px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
          <MapPin size={15} style={{ color: 'var(--color-text-muted)' }} />
          <span>{mission.area}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
          <Calendar size={15} style={{ color: 'var(--color-text-muted)' }} />
          <span>{mission.totalDays} jour(s)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
          <Clock size={15} style={{ color: 'var(--color-text-muted)' }} />
          <span>{mission.dailyHours.split('(')[0].trim()}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-primary)',
            fontWeight: 700,
          }}
        >
          <Banknote size={15} />
          <span>{mission.dayPayXAF.toLocaleString('fr-GA')} FCFA / j</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-success-text)' }}>
        <ShieldCheck size={14} />
        <span>Rémunération directe entreprise &middot; 0 FCFA de frais ouvrier</span>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
        <Button variant="secondary" size="sm" onClick={() => onSelect(mission)} style={{ flex: 1 }}>
          Voir détails
        </Button>
        {onApply && (
          <Button
            variant={isApplied ? 'secondary' : 'primary'}
            size="sm"
            disabled={isApplied || slotsRemaining <= 0}
            onClick={() => onApply(mission)}
            style={{ flex: 1 }}
          >
            {isApplied ? 'Déjà postulé' : 'Postuler'}
          </Button>
        )}
      </div>
    </div>
  );
};
