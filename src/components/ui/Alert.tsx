// Kazi Alert Component

import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  children,
  action,
}) => {
  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'var(--color-success-surface)',
          color: 'var(--color-success-text)',
          icon: <CheckCircle size={18} />,
        };
      case 'warning':
        return {
          bg: 'var(--color-warning-surface)',
          color: 'var(--color-warning-text)',
          icon: <AlertTriangle size={18} />,
        };
      case 'danger':
        return {
          bg: 'var(--color-danger-surface)',
          color: 'var(--color-danger-text)',
          icon: <AlertCircle size={18} />,
        };
      case 'info':
      default:
        return {
          bg: 'var(--color-info-surface)',
          color: 'var(--color-info-text)',
          icon: <Info size={18} />,
        };
    }
  };

  const { bg, color, icon } = getStyles();

  return (
    <div
      role="alert"
      style={{
        backgroundColor: bg,
        color: color,
        padding: '12px 16px',
        borderRadius: 'var(--radius-input)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '16px',
        border: `1px solid ${color}33`,
      }}
    >
      <div style={{ flexShrink: 0, marginTop: '2px' }}>{icon}</div>
      <div style={{ flex: 1, fontSize: '14px' }}>
        {title && <div style={{ fontWeight: 700, marginBottom: '4px' }}>{title}</div>}
        <div style={{ lineHeight: 1.45 }}>{children}</div>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
};
