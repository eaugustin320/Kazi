// Kazi Empty State Component

import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <Inbox size={40} style={{ color: 'var(--color-text-muted)' }} />,
  title,
  description,
  action,
}) => {
  return (
    <div
      style={{
        padding: '40px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-surface)',
        border: '1.5px dashed var(--color-border)',
        borderRadius: 'var(--radius-card)',
        margin: '16px 0',
      }}
    >
      <div style={{ marginBottom: '12px' }}>{icon}</div>
      <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>
        {title}
      </h4>
      <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', maxWidth: '380px', marginBottom: '16px' }}>
        {description}
      </p>
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};
