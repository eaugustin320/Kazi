// Kazi Dialog Component (Accessible Modal)

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'danger' | 'accent';
    isLoading?: boolean;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  primaryAction,
  secondaryAction,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(23, 37, 29, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        style={{
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          borderRadius: 'var(--radius-dialog)',
          maxWidth: '540px',
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          animation: 'kazi-fade-in 180ms ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 id="dialog-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              {title}
            </h3>
            {description && (
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px', margin: 0 }}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              padding: '6px',
              borderRadius: 'var(--radius-pill)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, fontSize: '15px' }}>
          {children}
        </div>

        {/* Footer */}
        {(primaryAction || secondaryAction) && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-background)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            {secondaryAction && (
              <Button variant="secondary" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                variant={primaryAction.variant || 'primary'}
                onClick={primaryAction.onClick}
                isLoading={primaryAction.isLoading}
                disabled={primaryAction.disabled}
              >
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
