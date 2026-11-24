// Kazi Page Header Component

import React from 'react';
import { StatusBadge } from './StatusBadge';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '20px',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text)' }}>{title}</h2>
          {badge && <StatusBadge label={badge} variant="primary" />}
        </div>
        {subtitle && (
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div style={{ display: 'flex', gap: '10px' }}>{actions}</div>}
    </div>
  );
};
