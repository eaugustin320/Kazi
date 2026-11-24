// Kazi DataTable Component (Compact on desktop, scrollable region with clear labels)

import React from 'react';

export interface Column<T> {
  header: string;
  accessor: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'Aucune donnée disponible',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '14px',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      style={{
        overflowX: 'auto',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
            {columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  padding: '12px 16px',
                  textAlign: col.align || 'left',
                  fontWeight: 700,
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-muted)',
                  width: col.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              style={{
                borderBottom: '1px solid var(--color-border)',
                transition: 'background-color var(--transition-fast)',
              }}
            >
              {columns.map((col, cIdx) => (
                <td
                  key={cIdx}
                  style={{
                    padding: '12px 16px',
                    textAlign: col.align || 'left',
                    color: 'var(--color-text)',
                  }}
                >
                  {col.accessor(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
