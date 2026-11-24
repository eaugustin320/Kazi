// Kazi Attendance Row Component (Daily Attendance & Dispute Tracker)

import React from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { AttendanceRecord, AttendanceStatus } from '../../types/domain';
import { StatusBadge } from './StatusBadge';
import { Button } from './Button';

export interface AttendanceRowProps {
  record: AttendanceRecord;
  role: 'COMPANY' | 'WORKER' | 'ADMIN';
  onDeclare?: (status: AttendanceStatus, hours: number, note: string) => void;
  onDispute?: (note: string) => void;
  onResolve?: (status: AttendanceStatus, note: string) => void;
}

export const AttendanceRow: React.FC<AttendanceRowProps> = ({
  record,
  role,
  onDeclare,
  onDispute,
  onResolve,
}) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: '14px 16px',
        marginBottom: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} style={{ color: 'var(--color-primary)' }} />
          <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>
            {record.date} &middot; {record.workerName}
          </strong>
        </div>

        <StatusBadge
          label={
            record.reviewState === 'CONFIRMED'
              ? 'Validé'
              : record.reviewState === 'DISPUTED'
              ? 'Litige en cours'
              : record.reviewState === 'RESOLVED_BY_STAFF'
              ? 'Arbitré par Kazi'
              : 'Déclaré par l’entreprise'
          }
          variant={
            record.reviewState === 'CONFIRMED'
              ? 'success'
              : record.reviewState === 'DISPUTED'
              ? 'danger'
              : 'info'
          }
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Statut : <strong style={{ color: 'var(--color-text)' }}>{record.companyStatus}</strong>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={14} /> {record.hoursWorked} heures
        </span>
      </div>

      {record.companyNote && (
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          Note entreprise : &ldquo;{record.companyNote}&rdquo;
        </p>
      )}

      {record.reviewState === 'DISPUTED' && record.workerDisputeNote && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: 'var(--color-danger-surface)',
            borderRadius: 'var(--radius-input)',
            fontSize: '12px',
            color: 'var(--color-danger-text)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} />
          <span>Contestation ouvrier : &ldquo;{record.workerDisputeNote}&rdquo;</span>
        </div>
      )}

      {/* Role specific interactive actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        {role === 'COMPANY' && onDeclare && (
          <>
            <Button size="sm" variant="secondary" onClick={() => onDeclare('PRESENT', 8, 'Présent journée complète')}>
              Pointer Présent (8h)
            </Button>
            <Button size="sm" variant="danger" onClick={() => onDeclare('ABSENT', 0, 'Absence constatée')}>
              Pointer Absent
            </Button>
          </>
        )}

        {role === 'WORKER' && record.reviewState === 'SUBMITTED_BY_COMPANY' && onDispute && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => onDispute('Désaccord sur le décompte des heures')}
          >
            Contester ce pointage
          </Button>
        )}

        {role === 'ADMIN' && record.reviewState === 'DISPUTED' && onResolve && (
          <Button
            size="sm"
            variant="primary"
            leftIcon={<CheckCircle size={14} />}
            onClick={() => onResolve('PRESENT', 'Arbitrage staff après vérification avec le chef de chantier')}
          >
            Arbitrer le litige
          </Button>
        )}
      </div>
    </div>
  );
};
