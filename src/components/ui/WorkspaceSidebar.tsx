// Kazi Workspace Sidebar Component (Company & Staff Navigation)
// Max desktop width 224px, collapsible, semantic sidebar tokens

import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
}

export interface WorkspaceSidebarProps {
  title: string;
  subtitle?: string;
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  title,
  subtitle,
  items,
  activeId,
  onSelect,
}) => {
  return (
    <aside
      style={{
        width: '224px',
        flexShrink: 0,
        backgroundColor: 'var(--color-sidebar)',
        color: 'var(--color-on-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: '20px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.5px' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px' }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* Nav List */}
      <nav style={{ padding: '12px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="focus-on-dark"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-input)',
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                color: 'var(--color-on-sidebar)',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                minHeight: '44px',
                transition: 'background-color var(--transition-fast)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-on-accent)',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Scope Badge */}
      <div
        style={{
          padding: '14px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.75)',
        }}
      >
        <div>Portée : <strong>Gabon &middot; Libreville</strong></div>
        <div style={{ fontSize: '10px', marginTop: '2px' }}>Plateforme v1.0.0 (D0)</div>
      </div>
    </aside>
  );
};
