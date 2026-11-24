// Kazi Error State Component (Preserves input and allows safe retry)

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Une erreur est survenue',
  message = 'Impossible de charger les données ou d’effectuer l’action réseau. Vos saisies restent préservées.',
  onRetry,
  isRetrying = false,
}) => {
  return (
    <div
      role="alert"
      style={{
        padding: '32px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: 'var(--color-danger-surface)',
        border: '1.5px solid var(--color-danger-text)',
        borderRadius: 'var(--radius-card)',
        color: 'var(--color-danger-text)',
        margin: '16px 0',
      }}
    >
      <AlertTriangle size={36} style={{ marginBottom: '12px' }} />
      <h4 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>{title}</h4>
      <p style={{ fontSize: '14px', maxWidth: '420px', marginBottom: '18px', opacity: 0.9 }}>{message}</p>
      {onRetry && (
        <Button
          variant="danger"
          leftIcon={<RefreshCw size={16} />}
          isLoading={isRetrying}
          onClick={onRetry}
        >
          Réessayer
        </Button>
      )}
    </div>
  );
};
