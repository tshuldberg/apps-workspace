// Plan 56 C1: the WEB canvas renderer (DOM sibling of the mobile
// CanvasSurface; the pure logic both feed on lives in the parity-locked
// canvas-core/canvas-node-registry-core twins). Free layout: absolute
// position, overlap, rotation. Flow layout: full-width stacked sections.
// A degraded node renders the honest placeholder alone (7.5); colors resolve
// through closed tokens to CSS variables only (F2); reserved chrome never
// renders inside this surface (7.3, guard-tested).

import { useEffect, useState } from 'react';
import { Avatar } from '../kit/Avatar';
import type {
  CommunityCanvasNodeEvent,
  CommunityCanvasStrokeEvent,
} from '@mylife/sync';
import type { MkCanvasPolicy } from '@mylife/meerkat-canvas';
import type { DialedCanvas, ResolvedCanvasNode, guestbookNotes } from '../../lib/canvas-core';
import { NODE_PLACEHOLDER_LINE, milestoneLine } from '../../lib/canvas-node-registry-core';
import { BLOCK_RENDERERS, BLOCK_RENDERER_PENDING_LINE, type BlockHostContext } from '../blocks/registry';

/** Resolve a closed color token to a CSS variable (F2: tokens only). */
export function canvasCssColor(token: string | undefined, fallback: string): string {
  switch (token) {
    case 'text': return 'var(--mk-text)';
    case 'muted': return 'var(--mk-text-secondary)';
    case 'accent': return 'var(--mk-accent)';
    case 'paper': return 'var(--mk-bg)';
    case 'surface': return 'var(--mk-surface)';
    case 'success': return 'var(--mk-success, #19805F)';
    case 'warning': return 'var(--mk-warning, #8F660D)';
    case 'danger': return 'var(--mk-danger)';
    case 'info': return 'var(--mk-info, #3566B0)';
    default: return fallback;
  }
}

const TEXT_SIZES: Record<string, number> = { s: 13, m: 16, l: 22, xl: 32 };
const STICKER_SIZES: Record<string, number> = { s: 24, m: 40, l: 64, xl: 96 };

export interface CanvasHostActions {
  onNavigate: (target: { kind: string; id: string }) => void;
  onIncrement: (node: CommunityCanvasNodeEvent) => void;
  onVote: (node: CommunityCanvasNodeEvent, option: number) => void;
  onSignGuestbook: (node: CommunityCanvasNodeEvent, note: string) => void;
  onSelectNode?: (node: CommunityCanvasNodeEvent) => void;
  resolveAssetUri: (node: CommunityCanvasNodeEvent) => Promise<string | null>;
  counts: {
    counterTotal: (nodeId: string) => number;
    pollResults: (nodeId: string, optionCount: number) => number[];
    guestbookNotes: (nodeId: string, limit: number) => ReturnType<typeof guestbookNotes>;
  };
  badgesFor: (deviceId: string) => ReadonlyArray<{ badgeId: string; name: string; glyph: string; supplyCap: number; awardedTo: readonly string[] }>;
  /**
   * Verified member identity for top_friends rows: name/avatar come from the
   * member's own signed profile (never the author's caption); isMember=false
   * renders an honest "no longer a member" line instead of a stale claim.
   */
  memberInfo: (deviceId: string) => { name: string; avatarInitial: string; avatarImage: string | null; isMember: boolean };
  /** Open a member's per-community profile (top_friends row tap). */
  onOpenMemberProfile?: (deviceId: string) => void;
  blockCtx: BlockHostContext | null;
  revision: number;
}

/**
 * Feature 13: tap behaviors (toggle / flip / reveal). State is DEVICE-LOCAL
 * component state (setLocalState, 3.3): nothing replicates.
 */
function BehaviorShell({ behavior, children }: { behavior: string; children: React.ReactNode }): React.ReactElement {
  const [toggled, setToggled] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [revealed, setRevealed] = useState(false);
  if (behavior === 'reveal' && !revealed) {
    return (
      <button type="button" className="mk-canvas-reveal" onClick={() => setRevealed(true)}>
        Tap to reveal
      </button>
    );
  }
  if (behavior === 'toggle' || behavior === 'flip') {
    return (
      <button
        type="button"
        className="mk-canvas-behavior"
        aria-label={behavior === 'toggle' ? 'Toggle' : 'Flip'}
        onClick={() => (behavior === 'toggle' ? setToggled((v) => !v) : setFlipped((v) => !v))}
        style={{ opacity: toggled ? 0.35 : 1, transform: flipped ? 'scaleX(-1)' : undefined }}
      >
        <div style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>{children}</div>
      </button>
    );
  }
  return <>{children}</>;
}

function NodeBody({ node, actions }: { node: ResolvedCanvasNode; actions: CanvasHostActions }): React.ReactElement {
  if (node.parse.status !== 'ok') {
    return <div className="mk-canvas-placeholder">{NODE_PLACEHOLDER_LINE}</div>;
  }
  const props: Record<string, unknown> = node.parse.props;
  const behavior = typeof props.behavior === 'string' ? props.behavior : 'none';
  if (behavior !== 'none' && !actions.onSelectNode) {
    return (
      <BehaviorShell behavior={behavior}>
        <NodeBodyInner node={node} actions={actions} props={props} />
      </BehaviorShell>
    );
  }
  return <NodeBodyInner node={node} actions={actions} props={props} />;
}

function NodeBodyInner({ node, actions, props }: {
  node: ResolvedCanvasNode;
  actions: CanvasHostActions;
  props: Record<string, unknown>;
}): React.ReactElement {
  const event = node.event;
  switch (event.nodeType) {
    case 'text': {
      const size = TEXT_SIZES[(props.size as string) ?? 'm'] ?? 16;
      return (
        <div
          className="mk-canvas-text"
          style={{
            fontSize: size,
            fontWeight: props.weight === 'bold' ? 700 : 400,
            color: canvasCssColor(props.colorToken as string | undefined, 'var(--mk-text)'),
            textAlign: (props.align as 'left' | 'center' | 'right' | undefined) ?? 'left',
          }}
        >
          {String(props.text)}
        </div>
      );
    }
    case 'sticker': {
      const size = STICKER_SIZES[(props.size as string) ?? 'm'] ?? 40;
      return <div style={{ fontSize: size, lineHeight: 1.2 }}>{String(props.emoji)}</div>;
    }
    case 'image':
      return <CanvasImage node={event} props={props} actions={actions} />;
    case 'shape':
      return <CanvasShape props={props} />;
    case 'frame':
      return <div className="mk-canvas-frame" />;
    case 'divider':
      return <CanvasDivider props={props} />;
    case 'link_card': {
      const target = props.target as { kind: string; id: string };
      return (
        <button type="button" className="mk-canvas-link" onClick={() => actions.onNavigate(target)}>
          <span className="mk-canvas-link-label">{String(props.label)}</span>
          <span className="mk-canvas-link-meta">{target.kind} in this community</span>
        </button>
      );
    }
    case 'counter': {
      const total = actions.counts.counterTotal(event.id);
      return (
        <button
          type="button"
          className="mk-canvas-counter"
          aria-label={`${(props.label as string) ?? 'Counter'}: ${total}. Add one.`}
          onClick={() => actions.onIncrement(event)}
        >
          <span className="mk-canvas-counter-total">{total}</span>
          {props.label ? <span className="mk-canvas-counter-label">{String(props.label)}</span> : null}
        </button>
      );
    }
    case 'poll':
      return <CanvasPoll node={event} props={props} actions={actions} />;
    case 'guestbook':
      return <CanvasGuestbook node={event} props={props} actions={actions} />;
    case 'button_88x31': {
      const bg = canvasCssColor(props.bgToken as string | undefined, 'var(--mk-surface-high, var(--mk-surface))');
      const fg = canvasCssColor(props.fgToken as string | undefined, 'var(--mk-text)');
      const border = canvasCssColor(props.borderToken as string | undefined, 'var(--mk-border-strong, var(--mk-border))');
      return (
        <div
          style={{
            width: 88, height: 31, background: bg, border: `2px solid ${border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ color: fg, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {String(props.text)}
          </span>
        </div>
      );
    }
    case 'badge_case': {
      const memberDevice = typeof props.memberDevice === 'string' && props.memberDevice
        ? props.memberDevice
        : event.authorDevice;
      const badges = actions.badgesFor(memberDevice);
      return (
        <div className="mk-canvas-panel">
          <div className="mk-canvas-panel-title">{(props.title as string) ?? 'Badges'}</div>
          {badges.length === 0 ? (
            <div className="mk-canvas-panel-meta">No badges held yet.</div>
          ) : (
            badges.map((badge) => (
              <div key={badge.badgeId} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{badge.glyph}</span>
                <span style={{ flex: 1, fontSize: 13 }}>{badge.name}</span>
                <span className="mk-canvas-panel-meta">{badge.awardedTo.length}/{badge.supplyCap}</span>
              </div>
            ))
          )}
        </div>
      );
    }
    case 'top_friends': {
      const memberDevices = (props.memberDevices as string[]) ?? [];
      return (
        <div className="mk-canvas-panel">
          <div className="mk-canvas-panel-title">{(props.title as string) ?? 'Top friends'}</div>
          {memberDevices.map((deviceId) => {
            const info = actions.memberInfo(deviceId);
            return (
              <button
                key={deviceId}
                type="button"
                className="mk-canvas-friend-row"
                aria-label={`Open ${info.name}'s profile`}
                disabled={!actions.onOpenMemberProfile}
                onClick={() => actions.onOpenMemberProfile?.(deviceId)}
              >
                <Avatar imageBase64={info.avatarImage} initial={info.avatarInitial} size={22} />
                <span className="mk-canvas-friend-name">{info.name}</span>
                {!info.isMember ? <span className="mk-canvas-panel-meta">no longer a member</span> : null}
              </button>
            );
          })}
        </div>
      );
    }
    case 'milestone': {
      const line = milestoneLine(props as { dateIso: string; style: string }, new Date());
      return (
        <div className="mk-canvas-panel mk-canvas-milestone">
          <div className="mk-canvas-panel-title">{String(props.title)}</div>
          <div className="mk-canvas-milestone-line" style={{ color: canvasCssColor(props.colorToken as string | undefined, 'var(--mk-accent)') }}>{line}</div>
          <div className="mk-canvas-panel-meta">{String(props.dateIso)}</div>
        </div>
      );
    }
    case 'block_embed': {
      const embed = props as unknown as { blockType: string; config: Record<string, unknown> };
      const Renderer = BLOCK_RENDERERS[embed.blockType as keyof typeof BLOCK_RENDERERS];
      if (!Renderer || !actions.blockCtx) {
        return <div className="mk-canvas-placeholder">{BLOCK_RENDERER_PENDING_LINE}</div>;
      }
      return <Renderer config={embed.config} ctx={actions.blockCtx} />;
    }
    default:
      return <div className="mk-canvas-placeholder">{NODE_PLACEHOLDER_LINE}</div>;
  }
}

function CanvasImage({ node, props, actions }: {
  node: CommunityCanvasNodeEvent;
  props: Record<string, unknown>;
  actions: CanvasHostActions;
}): React.ReactElement {
  const [uri, setUri] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setUri(null);
    setMissing(false);
    void actions.resolveAssetUri(node).then((resolved) => {
      if (cancelled) return;
      if (resolved) setUri(resolved);
      else setMissing(true);
    });
    return () => { cancelled = true; };
  }, [node, actions]);
  if (uri) {
    const radius = props.cornerRadius === 'round' ? '50%' : props.cornerRadius === 'md' ? 12 : props.cornerRadius === 'sm' ? 6 : 0;
    return (
      <img
        src={uri}
        alt={(props.alt as string) ?? 'Community image'}
        style={{ width: '100%', height: '100%', objectFit: props.fit === 'contain' ? 'contain' : 'cover', borderRadius: radius }}
      />
    );
  }
  return (
    <div className="mk-canvas-placeholder">
      {missing ? 'Available from members who have it, when a sync connects.' : 'Opening…'}
    </div>
  );
}

function CanvasShape({ props }: { props: Record<string, unknown> }): React.ReactElement {
  const fill = canvasCssColor(props.fillToken as string | undefined, 'var(--mk-surface)');
  const stroke = canvasCssColor(props.strokeToken as string | undefined, 'transparent');
  const strokeWidth = (props.strokeWidth as number) ?? 0;
  const shape = props.shape as string;
  if (shape === 'rect' || shape === 'ellipse') {
    return (
      <div style={{ width: '100%', height: '100%', background: fill, borderRadius: shape === 'ellipse' ? '50%' : 8, border: strokeWidth ? `${strokeWidth}px solid ${stroke}` : undefined }} />
    );
  }
  const paths: Record<string, string> = {
    triangle: 'M50 5 L95 95 L5 95 Z',
    star: 'M50 5 L61 38 L96 38 L68 59 L79 92 L50 71 L21 92 L32 59 L4 38 L39 38 Z',
    heart: 'M50 88 C20 65 5 45 5 30 C5 15 18 8 28 8 C38 8 46 15 50 22 C54 15 62 8 72 8 C82 8 95 15 95 30 C95 45 80 65 50 88 Z',
    arrow: 'M5 40 L60 40 L60 20 L95 50 L60 80 L60 60 L5 60 Z',
  };
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <path d={paths[shape] ?? paths.triangle} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    </svg>
  );
}

function CanvasDivider({ props }: { props: Record<string, unknown> }): React.ReactElement {
  const color = canvasCssColor(props.colorToken as string | undefined, 'var(--mk-border)');
  const style = (props.style as string) ?? 'line';
  if (style === 'wave') {
    return (
      <svg viewBox="0 0 100 10" width="100%" height="100%" preserveAspectRatio="none">
        <path d="M0 5 Q12.5 0 25 5 T50 5 T75 5 T100 5" stroke={color} strokeWidth={2} fill="none" />
      </svg>
    );
  }
  if (style === 'dots') {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'space-evenly' }}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} style={{ width: 4, height: 4, borderRadius: 2, background: color }} />
        ))}
      </div>
    );
  }
  return <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}><div style={{ height: 2, width: '100%', background: color }} /></div>;
}

function CanvasPoll({ node, props, actions }: {
  node: CommunityCanvasNodeEvent;
  props: Record<string, unknown>;
  actions: CanvasHostActions;
}): React.ReactElement {
  const options = props.options as string[];
  const results = actions.counts.pollResults(node.id, options.length);
  const total = results.reduce((a, b) => a + b, 0);
  return (
    <div className="mk-canvas-panel">
      <div className="mk-canvas-panel-title">{String(props.question)}</div>
      {options.map((option, index) => (
        <button
          key={`${index}:${option}`}
          type="button"
          className="mk-canvas-poll-option"
          onClick={() => actions.onVote(node, index)}
        >
          <span>{option}</span>
          <span className="mk-canvas-panel-meta">{results[index] ?? 0}</span>
        </button>
      ))}
      <div className="mk-canvas-panel-meta">{total} vote{total === 1 ? '' : 's'} from members</div>
    </div>
  );
}

function CanvasGuestbook({ node, props, actions }: {
  node: CommunityCanvasNodeEvent;
  props: Record<string, unknown>;
  actions: CanvasHostActions;
}): React.ReactElement {
  const [note, setNote] = useState('');
  const notes = actions.counts.guestbookNotes(node.id, 5);
  return (
    <div className="mk-canvas-panel">
      <div className="mk-canvas-panel-title">{(props.title as string) ?? 'Guestbook'}</div>
      {notes.length === 0 ? <div className="mk-canvas-panel-meta">No notes yet. Leave the first.</div> : null}
      {notes.map((entry) => (
        <div key={entry.id} className="mk-canvas-guest-note">{entry.note}</div>
      ))}
      <div className="mk-canvas-guest-row">
        <input
          className="mk-input"
          placeholder={(props.prompt as string) ?? 'Sign the guestbook'}
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="button"
          className="mk-canvas-link-label"
          onClick={() => {
            const trimmed = note.trim();
            if (!trimmed) return;
            actions.onSignGuestbook(node, trimmed);
            setNote('');
          }}
        >
          Sign
        </button>
      </div>
    </div>
  );
}

function StrokesOverlay({ strokes, width, height }: {
  strokes: readonly CommunityCanvasStrokeEvent[];
  width: number;
  height: number;
}): React.ReactElement | null {
  if (strokes.length === 0) return null;
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {strokes.map((stroke) => {
        let payload: { points?: [number, number][]; colorToken?: string; width?: number; brush?: string } = {};
        try {
          payload = JSON.parse(stroke.strokeJson ?? '{}');
        } catch {
          return null;
        }
        const points = payload.points ?? [];
        if (points.length < 2) return null;
        const d = `M${points.map(([x, y]) => `${x} ${y}`).join(' L')}`;
        return (
          <path
            key={stroke.id}
            d={d}
            stroke={canvasCssColor(payload.colorToken, 'var(--mk-text)')}
            strokeWidth={payload.width ?? 2}
            strokeOpacity={payload.brush === 'highlighter' ? 0.4 : 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );
      })}
    </svg>
  );
}

export function CanvasSurface({
  dialed,
  policy,
  actions,
  maxHeight,
}: {
  dialed: DialedCanvas;
  policy: MkCanvasPolicy;
  actions: CanvasHostActions;
  maxHeight?: number;
}): React.ReactElement {
  const roots = dialed.nodes.filter((n) => n.event.parentId === null);
  const childrenOf = new Map<string, ResolvedCanvasNode[]>();
  for (const node of dialed.nodes) {
    if (node.event.parentId === null) continue;
    const list = childrenOf.get(node.event.parentId) ?? [];
    list.push(node);
    childrenOf.set(node.event.parentId, list);
  }

  const renderPositioned = (node: ResolvedCanvasNode, offsetX: number, offsetY: number): React.ReactElement => {
    const e = node.event;
    const inner = actions.onSelectNode ? (
      <button
        type="button"
        className="mk-canvas-select"
        aria-label="Select decoration"
        onClick={() => actions.onSelectNode?.(e)}
      >
        <div style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>
          <NodeBody node={node} actions={actions} />
        </div>
      </button>
    ) : (
      <NodeBody node={node} actions={actions} />
    );
    return (
      <div
        key={e.id}
        style={{
          position: 'absolute',
          left: e.x - offsetX,
          top: e.y - offsetY,
          width: e.w,
          height: e.h,
          transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined,
          opacity: dialed.dimBackground && e.layer === 'background' ? 0.35 : 1,
        }}
      >
        {inner}
        {(childrenOf.get(e.id) ?? []).map((child) => renderPositioned(child, e.x, e.y))}
      </div>
    );
  };

  if (policy.layout === 'flow') {
    const ordered = [...roots].sort((a, b) => a.event.z - b.event.z || a.event.y - b.event.y);
    return (
      <div className="mk-canvas-flow" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
        {ordered.map((node) => (
          <div key={node.event.id} style={{ minHeight: node.event.h, marginBottom: 10 }}>
            {actions.onSelectNode ? (
              <button type="button" className="mk-canvas-select" aria-label="Select decoration" onClick={() => actions.onSelectNode?.(node.event)}>
                <div style={{ pointerEvents: 'none' }}><NodeBody node={node} actions={actions} /></div>
              </button>
            ) : (
              <NodeBody node={node} actions={actions} />
            )}
          </div>
        ))}
        {dialed.hiddenCount > 0 ? (
          <div className="mk-canvas-hidden">{dialed.hiddenCount} decoration{dialed.hiddenCount === 1 ? '' : 's'} hidden by your settings.</div>
        ) : null}
      </div>
    );
  }

  const extentW = Math.max(360, ...dialed.nodes.map((n) => n.event.x + n.event.w)) + 40;
  const extentH = Math.max(240, ...dialed.nodes.map((n) => n.event.y + n.event.h)) + 40;
  // Feature 2 (7.7): a HOST-ENFORCED legibility scrim over the background
  // layer whenever wallpaper-class content exists there.
  const backgroundRoots = roots.filter((n) => n.event.layer === 'background');
  const foregroundRoots = roots.filter((n) => n.event.layer !== 'background');
  const hasWallpaper = backgroundRoots.some((n) => n.event.nodeType === 'image' || n.event.nodeType === 'shape');
  return (
    <div>
      <div className="mk-canvas-scroll" style={maxHeight ? { maxHeight } : undefined}>
        <div style={{ position: 'relative', width: extentW, height: extentH }}>
          {backgroundRoots.map((node) => renderPositioned(node, 0, 0))}
          {hasWallpaper ? <div className="mk-canvas-scrim" /> : null}
          {foregroundRoots.map((node) => renderPositioned(node, 0, 0))}
          <StrokesOverlay strokes={dialed.strokes} width={extentW} height={extentH} />
        </div>
      </div>
      {dialed.hiddenCount > 0 ? (
        <div className="mk-canvas-hidden">{dialed.hiddenCount} decoration{dialed.hiddenCount === 1 ? '' : 's'} hidden by your settings.</div>
      ) : null}
    </div>
  );
}
