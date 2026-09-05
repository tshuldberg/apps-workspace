'use client';

import type { TableShape } from '../lib/types';

const SHAPES: { shape: TableShape; label: string; icon: string }[] = [
  { shape: 'round', label: 'Round', icon: '\u25CF' },
  { shape: 'square', label: 'Square', icon: '\u25A0' },
  { shape: 'rectangle', label: 'Rectangle', icon: '\u25AC' },
  { shape: 'banquette', label: 'Banquette', icon: '\u2310' },
  { shape: 'bar', label: 'Bar', icon: '\u2501' },
];

export function TablePalette() {
  const handleDragStart = (e: React.DragEvent, shape: TableShape) => {
    e.dataTransfer.setData('table-shape', shape);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Tables
      </h3>
      {SHAPES.map(({ shape, label, icon }) => (
        <div
          key={shape}
          draggable
          onDragStart={(e) => handleDragStart(e, shape)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            background: 'var(--glass)',
            border: '1px solid var(--border)',
            cursor: 'grab',
            fontSize: '0.8125rem',
            color: 'var(--text)',
          }}
        >
          <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center' }}>{icon}</span>
          {label}
        </div>
      ))}
    </div>
  );
}
