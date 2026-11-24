// Kazi Select Component

import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Array<{ value: string; label: string }>;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  helperText,
  required = false,
  id,
  style,
  ...props
}) => {
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
      <label
        htmlFor={selectId}
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

      <select
        id={selectId}
        aria-invalid={!!error}
        style={{
          minHeight: '44px',
          padding: '10px 14px',
          fontSize: '15px',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          border: `1.5px solid ${error ? 'var(--color-danger-text)' : 'var(--color-control-border)'}`,
          borderRadius: 'var(--radius-input)',
          outline: 'none',
          cursor: 'pointer',
          ...style,
        }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {error ? (
        <span style={{ fontSize: '12px', color: 'var(--color-danger-text)' }}>{error}</span>
      ) : helperText ? (
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{helperText}</span>
      ) : null}
    </div>
  );
};
