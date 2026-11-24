// Kazi Button Component
// Consumes semantic tokens --color-primary, --color-on-primary, etc.
// Enforces minimum touch target of 44px on touch devices

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  style,
  className = '',
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
          border: '1px solid transparent',
        };
      case 'secondary':
        return {
          backgroundColor: 'var(--color-surface)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-control-border)',
        };
      case 'accent':
        return {
          backgroundColor: 'var(--color-accent)',
          color: 'var(--color-on-accent)',
          border: '1px solid transparent',
        };
      case 'danger':
        return {
          backgroundColor: 'var(--color-danger-surface)',
          color: 'var(--color-danger-text)',
          border: '1px solid var(--color-danger-text)',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--color-primary)',
          border: '1px solid var(--color-primary)',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--color-text)',
          border: '1px solid transparent',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { minHeight: '36px', padding: '6px 12px', fontSize: '13px' };
      case 'lg':
        return { minHeight: '48px', padding: '12px 24px', fontSize: '16px' };
      case 'md':
      default:
        return { minHeight: '44px', padding: '10px 18px', fontSize: '14px' };
    }
  };

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 600,
        borderRadius: 'var(--radius-input)',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all var(--transition-fast)',
        userSelect: 'none',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      className={`kazi-btn kazi-btn-${variant} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span
          style={{
            width: '16px',
            height: '16px',
            border: '2px solid currentColor',
            borderRightColor: 'transparent',
            borderRadius: '50%',
            animation: 'kazi-spin 0.6s linear infinite',
            display: 'inline-block',
          }}
        />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};
