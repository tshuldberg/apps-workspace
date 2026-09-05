'use client';

import type { FloorTable } from '../lib/types';

interface TablePropertiesProps {
  table: FloorTable | null;
  onUpdate: (updates: Partial<FloorTable>) => void;
  onDelete: () => void;
}

export function TableProperties({ table, onUpdate, onDelete }: TablePropertiesProps) {
  if (!table) {
    return (
      <div style={{ padding: '16px', color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>
        Select a table to edit its properties.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
      <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Properties
      </h3>

      <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        Table Number
        <input
          type="text"
          value={table.tableNumber}
          onChange={(e) => onUpdate({ tableNumber: e.target.value })}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '4px',
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: '0.8125rem',
          }}
        />
      </label>

      <div style={{ display: 'flex', gap: '8px' }}>
        <label style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Min Seats
          <input
            type="number"
            value={table.capacityMin}
            min={1}
            onChange={(e) => onUpdate({ capacityMin: parseInt(e.target.value) || 1 })}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '4px',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '0.8125rem',
            }}
          />
        </label>
        <label style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Max Seats
          <input
            type="number"
            value={table.capacityMax}
            min={1}
            onChange={(e) => onUpdate({ capacityMax: parseInt(e.target.value) || 1 })}
            style={{
              display: 'block',
              width: '100%',
              marginTop: '4px',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '0.8125rem',
            }}
          />
        </label>
      </div>

      <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        Server Zone
        <input
          type="text"
          value={table.serverZone}
          onChange={(e) => onUpdate({ serverZone: e.target.value })}
          style={{
            display: 'block',
            width: '100%',
            marginTop: '4px',
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: '0.8125rem',
          }}
        />
      </label>

      <button
        onClick={onDelete}
        style={{
          marginTop: '8px',
          padding: '8px',
          borderRadius: '6px',
          border: '1px solid var(--danger)',
          background: 'transparent',
          color: 'var(--danger)',
          fontSize: '0.8125rem',
          cursor: 'pointer',
        }}
      >
        Delete Table
      </button>
    </div>
  );
}
