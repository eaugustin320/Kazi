// Kazi Field Component (Input & Textarea)
// Labels remain visible; 16px font on mobile prevents iOS/Android auto-zoom

import React from 'react';

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Field: React.FC<FieldProps> = ({
  label,
  error,
  helperText,
  required = false,
  id,
  style,
  ...props
}) => {
  const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
      <label
        htmlFor={fieldId}
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

      <input
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : helperText ? `${fieldId}-helper` : undefined}
        style={{
          minHeight: '44px',
          padding: '10px 14px',
          fontSize: '15px',
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          border: `1.5px solid ${error ? 'var(--color-danger-text)' : 'var(--color-control-border)'}`,
          borderRadius: 'var(--radius-input)',
          outline: 'none',
          transition: 'border-color var(--transition-fast)',
          ...style,
        }}
        {...props}
      />

      {error ? (
        <span id={`${fieldId}-error`} style={{ fontSize: '12px', color: 'var(--color-danger-text)', fontWeight: 500 }}>
          {error}
        </span>
      ) : helperText ? (
        <span id={`${fieldId}-helper`} style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
};
