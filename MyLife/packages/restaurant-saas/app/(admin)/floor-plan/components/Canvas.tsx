'use client';

import { useRef, useState, useCallback } from 'react';
import type { FloorTable } from '../lib/types';
import { TablePrimitive } from './TablePrimitive';
import { snapPosition } from '../lib/snap';

interface CanvasProps {
  tables: FloorTable[];
  selectedTableId: string | null;
  zoom: number;
  panX: number;
  panY: number;
  snapEnabled: boolean;
  snapSize: 8 | 16;
  serviceLocked: boolean;
  onSelectTable: (id: string | null) => void;
  onMoveTable: (id: string, x: number, y: number) => void;
  onDrop: (shape: string, x: number, y: number) => void;
}

export function Canvas({
  tables,
  selectedTableId,
  zoom,
  panX,
  panY,
  snapEnabled,
  snapSize,
  serviceLocked,
  onSelectTable,
  onMoveTable,
  onDrop,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<{ tableId: string; offsetX: number; offsetY: number } | null>(null);

  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panX) / zoom,
      y: (clientY - rect.top - panY) / zoom,
    };
  }, [zoom, panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || serviceLocked) return;
    const point = getSvgPoint(e.clientX, e.clientY);
    let x = point.x - dragging.offsetX;
    let y = point.y - dragging.offsetY;
    if (snapEnabled) {
      const snapped = snapPosition(x, y, snapSize);
      x = snapped.x;
      y = snapped.y;
    }
    onMoveTable(dragging.tableId, x, y);
  }, [dragging, serviceLocked, getSvgPoint, snapEnabled, snapSize, onMoveTable]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const shape = e.dataTransfer.getData('table-shape');
    if (!shape) return;
    const point = getSvgPoint(e.clientX, e.clientY);
    onDrop(shape, point.x, point.y);
  };

  const handleBackgroundClick = () => {
    onSelectTable(null);
  };

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ background: 'var(--bg)', cursor: dragging ? 'grabbing' : 'default' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleBackgroundClick}
    >
      {/* Grid pattern */}
      {snapEnabled && (
        <defs>
          <pattern id="grid" width={snapSize * zoom} height={snapSize * zoom} patternUnits="userSpaceOnUse">
            <path
              d={`M ${snapSize * zoom} 0 L 0 0 0 ${snapSize * zoom}`}
              fill="none"
              stroke="var(--border)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
      )}
      {snapEnabled && <rect width="100%" height="100%" fill="url(#grid)" />}

      <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
        {tables.map((table) => (
          <TablePrimitive
            key={table.id}
            table={table}
            selected={table.id === selectedTableId}
            locked={serviceLocked}
            onClick={() => onSelectTable(table.id)}
            onDragStart={(e) => {
              if (serviceLocked) return;
              const point = getSvgPoint(e.clientX, e.clientY);
              setDragging({ tableId: table.id, offsetX: point.x - table.x, offsetY: point.y - table.y });
            }}
          />
        ))}
      </g>
    </svg>
  );
}
