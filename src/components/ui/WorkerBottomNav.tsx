// Kazi Worker Bottom Navigation Component
// Fixed to bottom of mobile view: Missions, Candidatures, Messages, Profil

import React from 'react';
import { Search, Briefcase, CalendarCheck, MessageSquare, User } from 'lucide-react';

export interface WorkerBottomNavProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  unreadCount?: number;
}

export const WorkerBottomNav: React.FC<WorkerBottomNavProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 1,
}) => {
  const tabs = [
    { id: 'discovery', label: 'Missions', icon: <Search size={20} /> },
    { id: 'applications', label: 'Candidatures', icon: <Briefcase size={20} /> },
    { id: 'assignment', label: 'Pointage', icon: <CalendarCheck size={20} /> },
    { id: 'support', label: 'Messages', icon: <MessageSquare size={20} />, count: unreadCount },
    { id: 'profile', label: 'Profil', icon: <User size={20} /> },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Navigation principale ouvrier"
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 100,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.04)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            style={{
              flex: 1,
              height: '100%',
              minHeight: '44px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              background: 'transparent',
              border: 'none',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'color var(--transition-fast)',
            }}
          >
            <div style={{ position: 'relative' }}>
              {tab.icon}
              {tab.count ? (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-accent)',
                    border: '1.5px solid var(--color-surface)',
                  }}
                />
              ) : null}
            </div>
            <span style={{ fontSize: '11px', fontWeight: isActive ? 700 : 500 }}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
