// Kazi Skeleton Component

import React from 'react';

export interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius-input)',
  style,
}) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--color-border)',
        opacity: 0.6,
        animation: 'kazi-pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
};
