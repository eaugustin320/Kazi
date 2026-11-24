// Kazi Tabs Component

import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        borderBottom: '1.5px solid var(--color-border)',
        gap: '4px',
        overflowX: 'auto',
        marginBottom: '20px',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: `2.5px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
              marginBottom: '-2px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              minHeight: '44px',
              transition: 'all var(--transition-fast)',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
                  color: isActive ? 'var(--color-on-primary)' : 'var(--color-text)',
                  fontWeight: 700,
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
