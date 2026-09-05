'use client';

import type { FloorArea } from '../lib/types';

interface AreaTabsProps {
  areas: FloorArea[];
  selectedAreaId: string;
  onSelectArea: (id: string) => void;
  onAddArea: () => void;
  onRenameArea: (id: string, name: string) => void;
}

export function AreaTabs({ areas, selectedAreaId, onSelectArea, onAddArea }: AreaTabsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px', background: 'var(--surface)', borderRadius: '8px' }}>
      {areas.map((area) => (
        <button
          key={area.id}
          onClick={() => onSelectArea(area.id)}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            fontWeight: area.id === selectedAreaId ? 600 : 400,
            color: area.id === selectedAreaId ? 'var(--text)' : 'var(--text-secondary)',
            background: area.id === selectedAreaId ? 'var(--glass-strong)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {area.name}
        </button>
      ))}
      <button
        onClick={onAddArea}
        style={{
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '0.875rem',
          color: 'var(--text-tertiary)',
          background: 'transparent',
          border: '1px dashed var(--border)',
          cursor: 'pointer',
        }}
      >
        +
      </button>
    </div>
  );
}
