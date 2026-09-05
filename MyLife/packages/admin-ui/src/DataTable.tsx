'use client';

import React from 'react';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}

function SortIndicator({ active, direction }: { active: boolean; direction?: 'asc' | 'desc' }) {
  if (!active) return <span style={{ opacity: 0.3 }}> ↕</span>;
  return <span> {direction === 'asc' ? '↑' : '↓'}</span>;
}

function SkeletonRow<T>({ columns }: { columns: Column<T>[] }) {
  return (
    <tr>
      {columns.map((_col, i) => (
        <td
          key={i}
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              height: '14px',
              borderRadius: '4px',
              background: 'var(--glass-strong)',
              animation: 'pulse 1.5s ease-in-out infinite',
              width: '70%',
            }}
          />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available',
  loading = false,
  sortBy,
  sortDirection,
  onSort,
}: DataTableProps<T>) {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        borderSpacing: 0,
      }}
    >
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={String(col.key)}
              onClick={() => col.sortable && onSort?.(String(col.key))}
              style={{
                padding: '12px 16px',
                textAlign: 'left',
                background: 'var(--surface-low)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '13px',
                borderBottom: '1px solid var(--border)',
                cursor: col.sortable ? 'pointer' : 'default',
                userSelect: 'none',
                width: col.width,
              }}
            >
              {col.header}
              {col.sortable && (
                <SortIndicator
                  active={sortBy === String(col.key)}
                  direction={sortBy === String(col.key) ? sortDirection : undefined}
                />
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <>
            <SkeletonRow columns={columns} />
            <SkeletonRow columns={columns} />
            <SkeletonRow columns={columns} />
          </>
        ) : data.length === 0 ? (
          <tr>
            <td
              colSpan={columns.length}
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              {emptyMessage}
            </td>
          </tr>
        ) : (
          data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={() => onRowClick?.(row)}
              style={{
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--glass-strong)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '14px',
                  }}
                >
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[String(col.key)] ?? '')}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
