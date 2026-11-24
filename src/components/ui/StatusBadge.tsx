// Kazi Status Badge Component
// Consumes semantic surfaces and text tokens

import React from 'react';

export type StatusVariant =
  | 'success'
  | 'info'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'primary';

export interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  icon?: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  icon,
}) => {
  const getStyles = (): { bg: string; color: string; border: string } => {
    switch (variant) {
      case 'success':
        return {
          bg: 'var(--color-success-surface)',
          color: 'var(--color-success-text)',
          border: 'var(--color-success-text)',
        };
      case 'info':
        return {
          bg: 'var(--color-info-surface)',
          color: 'var(--color-info-text)',
          border: 'var(--color-info-text)',
        };
      case 'warning':
        return {
          bg: 'var(--color-warning-surface)',
          color: 'var(--color-warning-text)',
          border: 'var(--color-warning-text)',
        };
      case 'danger':
        return {
          bg: 'var(--color-danger-surface)',
          color: 'var(--color-danger-text)',
          border: 'var(--color-danger-text)',
        };
      case 'primary':
        return {
          bg: 'var(--color-surface)',
          color: 'var(--color-primary)',
          border: 'var(--color-primary)',
        };
      case 'neutral':
      default:
        return {
          bg: 'var(--color-background)',
          color: 'var(--color-text-muted)',
          border: 'var(--color-border)',
        };
    }
  };

  const { bg, color, border } = getStyles();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 9px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
        lineHeight: 1.2,
      }}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
};
