// Kazi Timeline Component (Ordered workflow progression)

import React from 'react';
import { Check } from 'lucide-react';

export interface TimelineStep {
  title: string;
  description?: string;
  timestamp?: string;
  status: 'completed' | 'current' | 'upcoming';
}

export interface TimelineProps {
  steps: TimelineStep[];
}

export const Timeline: React.FC<TimelineProps> = ({ steps }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
      {steps.map((step, idx) => {
        const isCompleted = step.status === 'completed';
        const isCurrent = step.status === 'current';

        return (
          <div key={idx} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
            {idx < steps.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: '13px',
                  top: '26px',
                  bottom: '-16px',
                  width: '2px',
                  backgroundColor: isCompleted ? 'var(--color-primary)' : 'var(--color-border)',
                }}
              />
            )}

            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: isCompleted
                  ? 'var(--color-primary)'
                  : isCurrent
                  ? 'var(--color-accent)'
                  : 'var(--color-surface)',
                color: isCompleted
                  ? 'var(--color-on-primary)'
                  : isCurrent
                  ? 'var(--color-on-accent)'
                  : 'var(--color-text-muted)',
                border: `2px solid ${
                  isCompleted
                    ? 'var(--color-primary)'
                    : isCurrent
                    ? 'var(--color-accent)'
                    : 'var(--color-control-border)'
                }`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                zIndex: 1,
              }}
            >
              {isCompleted ? <Check size={14} /> : <span style={{ fontSize: '12px', fontWeight: 700 }}>{idx + 1}</span>}
            </div>

            <div style={{ flex: 1, paddingTop: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h5
                  style={{
                    fontSize: '14px',
                    fontWeight: isCurrent ? 700 : 600,
                    color: isCurrent ? 'var(--color-primary)' : 'var(--color-text)',
                  }}
                >
                  {step.title}
                </h5>
                {step.timestamp && (
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{step.timestamp}</span>
                )}
              </div>
              {step.description && (
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {step.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
