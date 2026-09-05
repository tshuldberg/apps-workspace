'use client';

import { useState, useCallback } from 'react';
import { Canvas } from './components/Canvas';
import { TablePalette } from './components/TablePalette';
import { TableProperties } from './components/TableProperties';
import { AreaTabs } from './components/AreaTabs';
import { Toolbar } from './components/Toolbar';
import { createInitialState, applyAction, undo, redo, createTable } from './lib/floor-plan-state';
import type { FloorPlanState, FloorTable, TableShape } from './lib/types';

export default function FloorPlanPage() {
  const [state, setState] = useState<FloorPlanState>(createInitialState);

  const currentTables = state.tables.filter((t) => t.areaId === state.selectedAreaId);
  const selectedTable = state.tables.find((t) => t.id === state.selectedTableId) ?? null;

  const dispatch = useCallback((action: Parameters<typeof applyAction>[1]) => {
    setState((s) => applyAction(s, action));
  }, []);

  const handleMoveTable = useCallback((id: string, x: number, y: number) => {
    setState((s) => {
      const table = s.tables.find((t) => t.id === id);
      if (!table) return s;
      return applyAction(s, { type: 'MOVE_TABLE', tableId: id, x, y, prevX: table.x, prevY: table.y });
    });
  }, []);

  const handleDrop = useCallback((shape: string, x: number, y: number) => {
    setState((s) => {
      const table = createTable(shape as TableShape, x, y, s.selectedAreaId);
      return applyAction(s, { type: 'ADD_TABLE', table });
    });
  }, []);

  const handleUpdateTable = useCallback((updates: Partial<FloorTable>) => {
    setState((s) => {
      if (!s.selectedTableId) return s;
      const table = s.tables.find((t) => t.id === s.selectedTableId);
      if (!table) return s;
      const prev: Partial<FloorTable> = {};
      for (const key of Object.keys(updates) as (keyof FloorTable)[]) {
        (prev as Record<string, unknown>)[key] = table[key];
      }
      return applyAction(s, { type: 'UPDATE_TABLE', tableId: s.selectedTableId, updates, prev });
    });
  }, []);

  const handleDeleteTable = useCallback(() => {
    setState((s) => {
      const table = s.tables.find((t) => t.id === s.selectedTableId);
      if (!table) return s;
      return applyAction(s, { type: 'DELETE_TABLE', table });
    });
  }, []);

  const handleAddArea = useCallback(() => {
    setState((s) => {
      const name = `Area ${s.areas.length + 1}`;
      const area = { id: crypto.randomUUID(), name, displayOrder: s.areas.length, active: true };
      return applyAction(s, { type: 'ADD_AREA', area });
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>Floor Plan</h1>
      </div>

      {/* Area tabs */}
      <AreaTabs
        areas={state.areas}
        selectedAreaId={state.selectedAreaId}
        onSelectArea={(id) => setState((s) => ({ ...s, selectedAreaId: id, selectedTableId: null }))}
        onAddArea={handleAddArea}
        onRenameArea={() => {}}
      />

      {/* Toolbar */}
      <Toolbar
        zoom={state.zoom}
        snapEnabled={state.snapEnabled}
        snapSize={state.snapSize}
        serviceLocked={state.serviceLocked}
        canUndo={state.undoStack.length > 0}
        canRedo={state.redoStack.length > 0}
        onZoomIn={() => setState((s) => ({ ...s, zoom: Math.min(s.zoom + 0.1, 3) }))}
        onZoomOut={() => setState((s) => ({ ...s, zoom: Math.max(s.zoom - 0.1, 0.3) }))}
        onToggleSnap={() => setState((s) => ({ ...s, snapEnabled: !s.snapEnabled }))}
        onToggleSnapSize={() => setState((s) => ({ ...s, snapSize: s.snapSize === 8 ? 16 : 8 }))}
        onToggleLock={() => setState((s) => ({ ...s, serviceLocked: !s.serviceLocked }))}
        onUndo={() => setState(undo)}
        onRedo={() => setState(redo)}
      />

      {/* Main editor area */}
      <div style={{ display: 'flex', flex: 1, gap: '12px', minHeight: 0 }}>
        {/* Left palette */}
        <div style={{ width: '160px', flexShrink: 0, overflow: 'auto', padding: '8px', background: 'var(--surface-low)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <TablePalette />
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <Canvas
            tables={currentTables}
            selectedTableId={state.selectedTableId}
            zoom={state.zoom}
            panX={state.panX}
            panY={state.panY}
            snapEnabled={state.snapEnabled}
            snapSize={state.snapSize}
            serviceLocked={state.serviceLocked}
            onSelectTable={(id) => setState((s) => ({ ...s, selectedTableId: id }))}
            onMoveTable={handleMoveTable}
            onDrop={handleDrop}
          />
        </div>

        {/* Right properties panel */}
        <div style={{ width: '220px', flexShrink: 0, overflow: 'auto', background: 'var(--surface-low)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <TableProperties
            table={selectedTable}
            onUpdate={handleUpdateTable}
            onDelete={handleDeleteTable}
          />
        </div>
      </div>
    </div>
  );
}
