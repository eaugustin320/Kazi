// Kazi Floating Toast Notification

import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { usePrototype } from '../../context/PrototypeContext';

export const Toast: React.FC = () => {
  const { toast, hideToast } = usePrototype();
  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={18} style={{ color: 'var(--color-success-text)' }} />;
      case 'warning':
        return <AlertTriangle size={18} style={{ color: 'var(--color-warning-text)' }} />;
      case 'error':
        return <AlertCircle size={18} style={{ color: 'var(--color-danger-text)' }} />;
      case 'info':
      default:
        return <Info size={18} style={{ color: 'var(--color-info-text)' }} />;
    }
  };

  const getBg = () => {
    switch (toast.type) {
      case 'success':
        return 'var(--color-success-surface)';
      case 'warning':
        return 'var(--color-warning-surface)';
      case 'error':
        return 'var(--color-danger-surface)';
      case 'info':
      default:
        return 'var(--color-info-surface)';
    }
  };

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 10000,
        backgroundColor: getBg(),
        border: '1.5px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: '14px 18px',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '420px',
        animation: 'kazi-fade-in 180ms ease',
      }}
    >
      <div>{getIcon()}</div>
      <div style={{ flex: 1, fontSize: '13px', color: 'var(--color-text)' }}>
        <div style={{ fontWeight: 700 }}>{toast.title}</div>
        {toast.message && <div style={{ opacity: 0.9, marginTop: '2px' }}>{toast.message}</div>}
      </div>
      <button
        onClick={hideToast}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
