'use client';

import type { FloorTable } from '../lib/types';

interface TablePrimitiveProps {
  table: FloorTable;
  selected: boolean;
  locked: boolean;
  onClick: () => void;
  onDragStart?: (e: React.MouseEvent) => void;
}

export function TablePrimitive({ table, selected, locked, onClick, onDragStart }: TablePrimitiveProps) {
  const fill = selected ? 'var(--accent-dim)' : 'var(--glass-strong)';
  const stroke = selected ? 'var(--accent)' : 'var(--border)';
  const cursor = locked ? 'default' : 'move';

  const handleMouseDown = (e: React.MouseEvent) => {
    if (locked) return;
    onDragStart?.(e);
  };

  return (
    <g
      transform={`translate(${table.x}, ${table.y}) rotate(${table.rotation}, ${table.width / 2}, ${table.height / 2})`}
      onClick={onClick}
      onMouseDown={handleMouseDown}
      style={{ cursor }}
    >
      {table.shape === 'round' ? (
        <ellipse
          cx={table.width / 2}
          cy={table.height / 2}
          rx={table.width / 2}
          ry={table.height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth={selected ? 2 : 1}
        />
      ) : (
        <rect
          width={table.width}
          height={table.height}
          rx={table.shape === 'banquette' ? 4 : 8}
          fill={fill}
          stroke={stroke}
          strokeWidth={selected ? 2 : 1}
        />
      )}
      {/* Table number label */}
      {table.tableNumber && (
        <text
          x={table.width / 2}
          y={table.height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text)"
          fontSize="11"
          fontWeight="500"
        >
          {table.tableNumber}
        </text>
      )}
      {/* Capacity badge */}
      <text
        x={table.width / 2}
        y={table.height + 14}
        textAnchor="middle"
        fill="var(--text-tertiary)"
        fontSize="9"
      >
        {table.capacityMin}-{table.capacityMax}
      </text>
    </g>
  );
}
