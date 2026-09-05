'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  fetchCanvasAction,
  addCanvasNodeAction,
  moveCanvasNodeAction,
  deleteCanvasNodeAction,
} from '../../actions';

interface CanvasNodeData {
  id: string; canvasId: string; nodeType: string;
  label: string; content: string; x: number; y: number; w: number; h: number;
  color: string; zIndex: number;
}
interface CanvasEdgeData { id: string; sourceNodeId: string; targetNodeId: string; label: string }
interface CanvasData { id: string; title: string }

const ACCENT = 'var(--accent-notes)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';

export default function CanvasEditorPage() {
  const params = useParams();
  const canvasId = params.id as string;

  const [canvas, setCanvas] = useState<CanvasData | null>(null);
  const [nodes, setNodes] = useState<CanvasNodeData[]>([]);
  const [edges, setEdges] = useState<CanvasEdgeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'text' | 'shape'>('select');
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCanvasAction(canvasId)
      .then((data) => {
        if (cancelled || !data) { if (!cancelled) setError('Canvas not found.'); return; }
        setCanvas(data.canvas as CanvasData);
        setNodes(data.nodes as CanvasNodeData[]);
        setEdges(data.edges as CanvasEdgeData[]);
      })
      .catch(() => { if (!cancelled) setError('Failed to load canvas.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [canvasId]);

  async function handleAddNode(type: string) {
    try {
      const x = 400 + Math.random() * 200 - 100;
      const y = 300 + Math.random() * 200 - 100;
      const id = await addCanvasNodeAction(canvasId, { nodeType: type, label: type === 'text' ? 'New Text' : 'New Shape', x, y });
      setNodes((prev) => [...prev, { id, canvasId, nodeType: type, label: type === 'text' ? 'New Text' : 'New Shape', content: '', x, y, w: 200, h: 100, color: '', zIndex: prev.length }]);
    } catch { /* silent */ }
  }

  function handleNodeMouseDown(nodeId: string, e: React.MouseEvent) {
    if (tool !== 'select') return;
    e.stopPropagation();
    setSelectedNode(nodeId);
    const startX = e.clientX;
    const startY = e.clientY;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const origX = node.x, origY = node.y;

    function onMove(ev: MouseEvent) {
      const dx = (ev.clientX - startX) / viewport.zoom;
      const dy = (ev.clientY - startY) / viewport.zoom;
      setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, x: origX + dx, y: origY + dy } : n));
    }
    function onUp(ev: MouseEvent) {
      const dx = (ev.clientX - startX) / viewport.zoom;
      const dy = (ev.clientY - startY) / viewport.zoom;
      moveCanvasNodeAction(nodeId, origX + dx, origY + dy).catch(() => {});
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  async function handleDeleteSelected() {
    if (!selectedNode) return;
    try {
      await deleteCanvasNodeAction(selectedNode, canvasId);
      setNodes((prev) => prev.filter((n) => n.id !== selectedNode));
      setEdges((prev) => prev.filter((e) => e.sourceNodeId !== selectedNode && e.targetNodeId !== selectedNode));
      setSelectedNode(null);
    } catch { /* silent */ }
  }

  function handleSvgDoubleClick(_e: React.MouseEvent) {
    if (tool === 'select') return;
    handleAddNode(tool);
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setViewport((v) => ({
      ...v,
      zoom: Math.max(0.25, Math.min(3, v.zoom - e.deltaY * 0.001)),
    }));
  }

  if (error) {
    return (
      <div style={{ padding: 32, borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, textAlign: 'center' }}>
        <p style={{ color: TEXT, fontSize: 18, fontWeight: 600, margin: 0 }}>{error}</p>
        <Link href="/notes/canvas" style={{ display: 'inline-block', marginTop: 16, color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Back to Canvases</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ height: '80vh', borderRadius: 16, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite' }}>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  const tools: { key: typeof tool; label: string }[] = [
    { key: 'select', label: 'Select' },
    { key: 'text', label: 'Text' },
    { key: 'shape', label: 'Shape' },
  ];

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/notes/canvas" style={{ color: TEXT_SEC, textDecoration: 'none', fontSize: 14 }}>&larr; Back</Link>
          <span style={{ fontSize: 18, fontWeight: 600, color: TEXT }}>{canvas?.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: TEXT_SEC }}>{Math.round(viewport.zoom * 100)}%</span>
          {selectedNode && (
            <button type="button" onClick={handleDeleteSelected}
              style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: GLASS, color: '#FF453A', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Delete Node
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8 }}>
        {tools.map((t) => (
          <button key={t.key} type="button" onClick={() => setTool(t.key)}
            style={{
              padding: '6px 14px', borderRadius: 8, border: `1px solid ${BORDER}`,
              backgroundColor: tool === t.key ? ACCENT : GLASS,
              color: tool === t.key ? '#0A0A0F' : TEXT_SEC,
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Canvas SVG */}
      <div style={{ borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: '#080810', overflow: 'hidden', position: 'relative' }}
        onWheel={handleWheel}>
        <svg ref={svgRef} style={{ width: '100%', height: '70vh', cursor: tool === 'select' ? 'default' : 'crosshair' }}
          onDoubleClick={handleSvgDoubleClick}
          onClick={() => setSelectedNode(null)}>
          {/* Grid */}
          <defs>
            <pattern id="grid" width={40 * viewport.zoom} height={40 * viewport.zoom} patternUnits="userSpaceOnUse">
              <path d={`M ${40 * viewport.zoom} 0 L 0 0 0 ${40 * viewport.zoom}`} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
            {/* Edges */}
            {edges.map((edge) => {
              const s = nodes.find((n) => n.id === edge.sourceNodeId);
              const t = nodes.find((n) => n.id === edge.targetNodeId);
              if (!s || !t) return null;
              return (
                <line key={edge.id}
                  x1={s.x + s.w / 2} y1={s.y + s.h / 2}
                  x2={t.x + t.w / 2} y2={t.y + t.h / 2}
                  stroke="rgba(100,116,139,0.4)" strokeWidth={2} />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => (
              <g key={node.id} onMouseDown={(e) => handleNodeMouseDown(node.id, e)} style={{ cursor: 'move' }}>
                <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={12}
                  fill={SURFACE}
                  stroke={selectedNode === node.id ? ACCENT : BORDER}
                  strokeWidth={selectedNode === node.id ? 2 : 1} />
                <text x={node.x + 12} y={node.y + 28} fill={TEXT} fontSize={14} fontWeight={500}>
                  {node.label.slice(0, 25)}
                </text>
                {node.content && (
                  <text x={node.x + 12} y={node.y + 48} fill={TEXT_SEC} fontSize={12}>
                    {node.content.slice(0, 30)}
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Empty hint */}
      {nodes.length === 0 && (
        <p style={{ textAlign: 'center', fontSize: 13, color: TEXT_SEC }}>
          Select a tool above, then double-click the canvas to add nodes.
        </p>
      )}
    </div>
  );
}
