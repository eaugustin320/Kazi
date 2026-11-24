// Kazi Money Field (FCFA / XAF Explicit Formatter)
// Gabon currency has no minor units (minorUnitExponent = 0)

import React from 'react';

export interface MoneyFieldProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  helperText?: string;
  error?: string;
  required?: boolean;
}

export const MoneyField: React.FC<MoneyFieldProps> = ({
  label,
  value,
  onChange,
  helperText,
  error,
  required,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
      <label
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--color-text)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span>{label}</span>
        {required && <span style={{ color: 'var(--color-danger-text)' }}>*</span>}
      </label>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="number"
          step="500"
          min="0"
          value={value || ''}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          style={{
            minHeight: '44px',
            width: '100%',
            padding: '10px 14px',
            paddingRight: '75px',
            fontSize: '16px',
            fontWeight: 600,
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: `1.5px solid ${error ? 'var(--color-danger-text)' : 'var(--color-control-border)'}`,
            borderRadius: 'var(--radius-input)',
            outline: 'none',
          }}
        />
        <span
          style={{
            position: 'absolute',
            right: '12px',
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            pointerEvents: 'none',
          }}
        >
          FCFA
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
        {error ? (
          <span style={{ color: 'var(--color-danger-text)' }}>{error}</span>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>
            {helperText || 'Taux journalier direct ouvrier (XAF)'}
          </span>
        )}
        <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
          {value ? `${value.toLocaleString('fr-GA')} XAF` : '0 XAF'}
        </span>
      </div>
    </div>
  );
};
