'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchNoteGraph } from '../actions';
import { getGraphStats, findOrphans } from '@mylife/notes';
import type { NoteGraph } from '@mylife/notes';

const ACCENT = 'var(--accent-notes)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';

interface NodePos { id: string; x: number; y: number; vx: number; vy: number; title: string; linkCount: number; isOrphan: boolean }

export default function GraphViewPage() {
  const [graph, setGraph] = useState<NoteGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<NodePos[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchNoteGraph()
      .then((g) => { if (!cancelled) setGraph(g); })
      .catch(() => { if (!cancelled) setError('Failed to load graph.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Initialize positions when graph loads
  useEffect(() => {
    if (!graph || graph.nodes.length === 0) return;
    const orphanIds = new Set(findOrphans(graph).map((n) => n.id));
    const w = 800, h = 600;
    const nodes: NodePos[] = graph.nodes.map((n, i) => ({
      id: n.id,
      x: w / 2 + (Math.cos(i * 2.4) * (w / 3)),
      y: h / 2 + (Math.sin(i * 2.4) * (h / 3)),
      vx: 0, vy: 0,
      title: n.title,
      linkCount: n.linkCount,
      isOrphan: orphanIds.has(n.id),
    }));
    // Simple force simulation (30 iterations)
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (let iter = 0; iter < 30; iter++) {
      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 5000 / (dist * dist);
          const fx = (dx / dist) * force, fy = (dy / dist) * force;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }
      // Attraction along edges
      for (const edge of graph.edges) {
        const a = nodeMap.get(edge.source), b = nodeMap.get(edge.target);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = (dist - 120) * 0.05;
        const fx = (dx / Math.max(dist, 1)) * force, fy = (dy / Math.max(dist, 1)) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // Center gravity
      for (const n of nodes) {
        n.vx += (w / 2 - n.x) * 0.01;
        n.vy += (h / 2 - n.y) * 0.01;
        n.x += n.vx * 0.3; n.y += n.vy * 0.3;
        n.vx *= 0.8; n.vy *= 0.8;
        n.x = Math.max(30, Math.min(w - 30, n.x));
        n.y = Math.max(30, Math.min(h - 30, n.y));
      }
    }
    setPositions(nodes);
  }, [graph]);

  const stats = graph ? getGraphStats(graph) : null;

  if (error) {
    return (
      <div style={{ padding: 32, borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, textAlign: 'center' }}>
        <p style={{ color: TEXT, fontSize: 18, fontWeight: 600, margin: 0 }}>{error}</p>
        <button type="button" onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, backgroundColor: ACCENT, color: '#0A0A0F', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ flex: 1, height: 56, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
        <div style={{ height: 500, borderRadius: 16, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {['Notes', 'Links', 'Orphans', 'Clusters', 'Avg Links'].map((l) => (
            <StatCard key={l} label={l} value="0" />
          ))}
        </div>
        <div style={{ padding: 48, borderRadius: 20, border: `1px dashed rgba(100,116,139,0.25)`, backgroundColor: GLASS, textAlign: 'center' }}>
          <p style={{ fontSize: 48, margin: 0 }}>🕸️</p>
          <h2 style={{ margin: '12px 0 8px', fontSize: 24, color: TEXT }}>Knowledge Graph</h2>
          <p style={{ color: TEXT_SEC, maxWidth: 400, margin: '0 auto' }}>
            Create notes with [[backlinks]] to build your knowledge graph. Links between notes will appear as connections.
          </p>
        </div>
      </div>
    );
  }

  const nodeMap = new Map(positions.map((n) => [n.id, n]));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 12 }}>
        <StatCard label="Notes" value={String(stats?.nodeCount ?? 0)} />
        <StatCard label="Links" value={String(stats?.edgeCount ?? 0)} />
        <StatCard label="Orphans" value={String(stats?.orphanCount ?? 0)} />
        <StatCard label="Clusters" value={String(stats?.clusterCount ?? 0)} />
        <StatCard label="Avg Links" value={(stats?.avgLinkCount ?? 0).toFixed(1)} />
      </div>

      {/* SVG Graph */}
      <div style={{ borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, overflow: 'hidden' }}>
        <svg ref={svgRef} viewBox="0 0 800 600" style={{ width: '100%', height: 500 }}>
          {/* Edges */}
          {graph.edges.map((edge, i) => {
            const s = nodeMap.get(edge.source);
            const t = nodeMap.get(edge.target);
            if (!s || !t) return null;
            const isHighlighted = selectedId === edge.source || selectedId === edge.target;
            return (
              <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={isHighlighted ? ACCENT : 'rgba(255,255,255,0.08)'}
                strokeWidth={isHighlighted ? 2 : 1} />
            );
          })}
          {/* Nodes */}
          {positions.map((n) => {
            const r = Math.max(6, Math.min(20, 6 + n.linkCount * 2));
            const isSelected = selectedId === n.id;
            return (
              <g key={n.id} onClick={() => setSelectedId(isSelected ? null : n.id)} style={{ cursor: 'pointer' }}>
                <circle cx={n.x} cy={n.y} r={r}
                  fill={isSelected ? ACCENT : n.isOrphan ? 'rgba(100,116,139,0.3)' : 'rgba(100,116,139,0.7)'}
                  stroke={isSelected ? TEXT : 'none'} strokeWidth={2} />
                <text x={n.x} y={n.y - r - 4} textAnchor="middle"
                  fill={isSelected ? TEXT : TEXT_SEC} fontSize={11} fontWeight={isSelected ? 600 : 400}>
                  {n.title.slice(0, 20) || 'Untitled'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected note info */}
      {selectedId && (() => {
        const n = positions.find((p) => p.id === selectedId);
        if (!n) return null;
        return (
          <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT }}>{n.title || 'Untitled'}</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: TEXT_SEC }}>{n.linkCount} links {n.isOrphan ? '(orphan)' : ''}</p>
            <a href={`/notes/${n.id}`} style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: ACCENT, textDecoration: 'none' }}>
              Open note &rarr;
            </a>
          </div>
        );
      })()}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: ACCENT }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: TEXT_SEC }}>{label}</p>
    </div>
  );
}
