// Plan 56 C1: the MOBILE canvas renderer. Renders a VERIFIED, dial-filtered
// node + stroke set (from canvas-core) in free layout (absolute position,
// overlap, rotation: the mmm.page model) or flow layout (full-width stacked
// sections). Everything here is host-owned components over signed data (F1);
// a node whose props parse degraded renders the honest NodePlaceholder alone
// (7.5). Reserved chrome NEVER renders inside this surface (7.3, guard-tested
// by canvas-chrome-leakage.test.ts): no connection status, no verification
// badges, no tab bar. Trust indicators live outside the canvas boundary.

import { useCallback, useEffect, useState } from 'react';
import { Image as RNImage, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type {
  CommunityCanvasNodeEvent,
  CommunityCanvasStrokeEvent,
} from '@mylife/sync';
import type { MkCanvasPolicy } from '@mylife/meerkat-canvas';
import {
  counterTotal as counterTotalFn,
  guestbookNotes as guestbookNotesFn,
  pollResults as pollResultsFn,
  type DialedCanvas,
  type ResolvedCanvasNode,
} from '../../data/canvas-core';
import { NODE_PLACEHOLDER_LINE, milestoneLine } from '../../data/canvas-node-registry-core';
import { BLOCK_RENDERERS, BLOCK_RENDERER_PENDING_LINE, type BlockHostContext } from '../blocks/registry';
import { Avatar } from '../Avatar';
import { BlockPlaceholder } from '../blocks/BlockPlaceholder';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';

/** Resolve a closed color token against the ACTIVE palette (F2: tokens only). */
export function canvasColor(c: MkColors, token: string | undefined, fallback: string): string {
  switch (token) {
    case 'text': return c.text;
    case 'muted': return c.textSecondary;
    case 'accent': return c.accent;
    case 'paper': return c.background;
    case 'surface': return c.surface;
    case 'success': return c.success;
    case 'warning': return c.warning;
    case 'danger': return c.danger;
    case 'info': return c.info;
    default: return fallback;
  }
}

const TEXT_SIZES: Record<string, number> = { s: 13, m: 16, l: 22, xl: 32 };
const STICKER_SIZES: Record<string, number> = { s: 24, m: 40, l: 64, xl: 96 };

/** Host callbacks: every tap dispatches a REAL signed event or navigation. */
export interface CanvasHostActions {
  onNavigate: (target: { kind: string; id: string }) => void;
  onIncrement: (node: CommunityCanvasNodeEvent) => void;
  onVote: (node: CommunityCanvasNodeEvent, option: number) => void;
  onSignGuestbook: (node: CommunityCanvasNodeEvent, note: string) => void;
  /** Editor-mode tap on a node (select). Absent = view mode. */
  onSelectNode?: (node: CommunityCanvasNodeEvent) => void;
  /** Resolve a node's sealed image asset to a data URI (null = not local yet). */
  resolveAssetUri: (node: CommunityCanvasNodeEvent) => Promise<string | null>;
  /** Live counts read verified rows; the host injects them (db stays outside). */
  counts: {
    counterTotal: (nodeId: string) => number;
    pollResults: (nodeId: string, optionCount: number) => number[];
    guestbookNotes: (nodeId: string, limit: number) => ReturnType<typeof guestbookNotesFn>;
  };
  /** Badges a member verifiably holds (badge_case nodes; resolved rows only). */
  badgesFor: (deviceId: string) => ReadonlyArray<{ badgeId: string; name: string; glyph: string; supplyCap: number; awardedTo: readonly string[] }>;
  /**
   * Verified member identity for top_friends rows: name/avatar come from the
   * member's own signed profile (never the author's caption); isMember=false
   * renders an honest "no longer a member" line instead of a stale claim.
   */
  memberInfo: (deviceId: string) => { name: string; avatarInitial: string; avatarImage: string | null; isMember: boolean };
  /** Open a member's per-community profile (top_friends row tap). */
  onOpenMemberProfile?: (deviceId: string) => void;
  /** Block-embed bridge context (composition registry). */
  blockCtx: BlockHostContext | null;
  /** Bumps to re-derive counts after a recorded mark. */
  revision: number;
}

export type { DialedCanvas };
export const CANVAS_COUNT_HELPERS = { counterTotalFn, pollResultsFn, guestbookNotesFn };

/**
 * Feature 13: tap behaviors (toggle / flip / reveal) over any decorated node.
 * State is DEVICE-LOCAL component state (setLocalState, 3.3): nothing
 * replicates, and the underlying signed node is untouched.
 */
function BehaviorShell({ behavior, children }: { behavior: string; children: React.ReactNode }) {
  const styles = useMkStyles(makeStyles);
  const [toggled, setToggled] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [revealed, setRevealed] = useState(false);
  if (behavior === 'reveal' && !revealed) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tap to reveal"
        onPress={() => setRevealed(true)}
        style={styles.revealCover}
      >
        <Text style={styles.revealText}>Tap to reveal</Text>
      </Pressable>
    );
  }
  if (behavior === 'toggle' || behavior === 'flip') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={behavior === 'toggle' ? 'Tap to toggle' : 'Tap to flip'}
        onPress={() => (behavior === 'toggle' ? setToggled((v) => !v) : setFlipped((v) => !v))}
        style={{
          flex: 1,
          opacity: toggled ? 0.35 : 1,
          transform: flipped ? [{ scaleX: -1 }] : undefined,
        }}
      >
        <View style={{ flex: 1 }} pointerEvents="none">{children}</View>
      </Pressable>
    );
  }
  return <>{children}</>;
}

function NodeBody({ node, actions }: { node: ResolvedCanvasNode; actions: CanvasHostActions }) {
  const styles = useMkStyles(makeStyles);
  if (node.parse.status !== 'ok') {
    return (
      <View style={styles.placeholder}><Text style={styles.placeholderText}>{NODE_PLACEHOLDER_LINE}</Text></View>
    );
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
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const event = node.event;
  switch (event.nodeType) {
    case 'text': {
      const size = TEXT_SIZES[(props.size as string) ?? 'm'] ?? 16;
      return (
        <Text
          style={{
            fontSize: size,
            lineHeight: size * 1.35,
            fontWeight: props.weight === 'bold' ? '700' : '400',
            color: canvasColor(c, props.colorToken as string | undefined, c.text),
            textAlign: (props.align as 'left' | 'center' | 'right' | undefined) ?? 'left',
          }}
        >
          {String(props.text)}
        </Text>
      );
    }
    case 'sticker': {
      const size = STICKER_SIZES[(props.size as string) ?? 'm'] ?? 40;
      return <Text style={{ fontSize: size, lineHeight: size * 1.2 }}>{String(props.emoji)}</Text>;
    }
    case 'image':
      return <CanvasImage node={event} props={props} actions={actions} />;
    case 'shape':
      return <CanvasShape props={props} />;
    case 'frame':
      return <View style={[styles.frame, { borderColor: c.border }]} />;
    case 'divider':
      return <CanvasDivider props={props} />;
    case 'link_card': {
      const target = props.target as { kind: string; id: string };
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={String(props.label)}
          onPress={() => actions.onNavigate(target)}
          style={styles.linkCard}
        >
          <Text style={styles.linkLabel} numberOfLines={2}>{String(props.label)}</Text>
          <Text style={styles.linkMeta}>{target.kind} in this community</Text>
        </Pressable>
      );
    }
    case 'counter': {
      const total = actions.counts.counterTotal(event.id);
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${(props.label as string) ?? 'Counter'}: ${total}. Tap to add one.`}
          onPress={() => actions.onIncrement(event)}
          style={styles.counter}
        >
          <Text style={styles.counterTotal}>{total}</Text>
          {props.label ? <Text style={styles.counterLabel} numberOfLines={1}>{String(props.label)}</Text> : null}
        </Pressable>
      );
    }
    case 'poll':
      return <CanvasPoll node={event} props={props} actions={actions} />;
    case 'guestbook':
      return <CanvasGuestbook node={event} props={props} actions={actions} />;
    case 'button_88x31': {
      const bg = canvasColor(c, props.bgToken as string | undefined, c.surfaceHigh);
      const fg = canvasColor(c, props.fgToken as string | undefined, c.text);
      const border = canvasColor(c, props.borderToken as string | undefined, c.borderStrong);
      return (
        <View
          style={{
            width: 88,
            height: 31,
            backgroundColor: bg,
            borderWidth: 2,
            borderColor: border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
            {String(props.text)}
          </Text>
        </View>
      );
    }
    case 'badge_case': {
      const memberDevice = typeof props.memberDevice === 'string' && props.memberDevice
        ? props.memberDevice
        : event.authorDevice;
      const badges = actions.badgesFor(memberDevice);
      return (
        <View style={styles.panelNode}>
          <Text style={styles.panelTitle}>{(props.title as string) ?? 'Badges'}</Text>
          {badges.length === 0 ? (
            <Text style={styles.panelMeta}>No badges held yet.</Text>
          ) : (
            badges.map((badge) => (
              <View key={badge.badgeId} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 18 }}>{badge.glyph}</Text>
                <Text style={styles.listLineBadge} numberOfLines={1}>{badge.name}</Text>
                <Text style={styles.panelMeta}>{badge.awardedTo.length}/{badge.supplyCap}</Text>
              </View>
            ))
          )}
        </View>
      );
    }
    case 'top_friends': {
      const memberDevices = (props.memberDevices as string[]) ?? [];
      return (
        <View style={styles.panelNode}>
          <Text style={styles.panelTitle}>{(props.title as string) ?? 'Top friends'}</Text>
          {memberDevices.map((deviceId) => {
            const info = actions.memberInfo(deviceId);
            return (
              <Pressable
                key={deviceId}
                accessibilityRole="button"
                accessibilityLabel={`Open ${info.name}'s profile`}
                disabled={!actions.onOpenMemberProfile}
                onPress={() => actions.onOpenMemberProfile?.(deviceId)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}
              >
                <Avatar imageBase64={info.avatarImage} initial={info.avatarInitial} size={22} />
                <Text style={styles.listLineBadge} numberOfLines={1}>{info.name}</Text>
                {!info.isMember ? <Text style={styles.panelMeta}>no longer a member</Text> : null}
              </Pressable>
            );
          })}
        </View>
      );
    }
    case 'milestone': {
      const line = milestoneLine(props as { dateIso: string; style: string }, new Date());
      const tone = canvasColor(c, props.colorToken as string | undefined, c.accent);
      return (
        <View style={[styles.panelNode, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={[styles.panelTitle, { textAlign: 'center' }]} numberOfLines={2}>{String(props.title)}</Text>
          <Text style={{ color: tone, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>{line}</Text>
          <Text style={styles.panelMeta}>{String(props.dateIso)}</Text>
        </View>
      );
    }
    case 'block_embed': {
      const embed = props as unknown as { blockType: string; config: Record<string, unknown> };
      const Renderer = BLOCK_RENDERERS[embed.blockType as keyof typeof BLOCK_RENDERERS];
      if (!Renderer || !actions.blockCtx) {
        return <BlockPlaceholder line={BLOCK_RENDERER_PENDING_LINE} />;
      }
      return <Renderer config={embed.config} ctx={actions.blockCtx} />;
    }
    default:
      return (
        <View style={styles.placeholder}><Text style={styles.placeholderText}>{NODE_PLACEHOLDER_LINE}</Text></View>
      );
  }
}

function CanvasImage({ node, props, actions }: {
  node: CommunityCanvasNodeEvent;
  props: Record<string, unknown>;
  actions: CanvasHostActions;
}) {
  const styles = useMkStyles(makeStyles);
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
    const radius = props.cornerRadius === 'round' ? 999 : props.cornerRadius === 'md' ? 12 : props.cornerRadius === 'sm' ? 6 : 0;
    return (
      <RNImage
        source={{ uri }}
        resizeMode={props.fit === 'contain' ? 'contain' : 'cover'}
        style={{ width: '100%', height: '100%', borderRadius: radius }}
        accessibilityLabel={(props.alt as string) ?? 'Community image'}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={styles.pendingAsset}>
      <Text style={styles.placeholderText}>
        {missing ? 'Available from members who have it, when a sync connects.' : 'Opening…'}
      </Text>
    </View>
  );
}

function CanvasShape({ props }: { props: Record<string, unknown> }) {
  const c = useAppThemeColors();
  const fill = canvasColor(c, props.fillToken as string | undefined, c.surfaceHigh);
  const stroke = canvasColor(c, props.strokeToken as string | undefined, 'transparent');
  const strokeWidth = (props.strokeWidth as number) ?? 0;
  const shape = props.shape as string;
  if (shape === 'rect' || shape === 'ellipse') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: fill,
          borderRadius: shape === 'ellipse' ? 999 : 8,
          borderWidth: strokeWidth,
          borderColor: stroke,
        }}
      />
    );
  }
  const paths: Record<string, string> = {
    triangle: 'M50 5 L95 95 L5 95 Z',
    star: 'M50 5 L61 38 L96 38 L68 59 L79 92 L50 71 L21 92 L32 59 L4 38 L39 38 Z',
    heart: 'M50 88 C20 65 5 45 5 30 C5 15 18 8 28 8 C38 8 46 15 50 22 C54 15 62 8 72 8 C82 8 95 15 95 30 C95 45 80 65 50 88 Z',
    arrow: 'M5 40 L60 40 L60 20 L95 50 L60 80 L60 60 L5 60 Z',
  };
  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      <Path d={paths[shape] ?? paths.triangle!} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    </Svg>
  );
}

function CanvasDivider({ props }: { props: Record<string, unknown> }) {
  const c = useAppThemeColors();
  const color = canvasColor(c, props.colorToken as string | undefined, c.border);
  const style = (props.style as string) ?? 'line';
  if (style === 'wave') {
    return (
      <Svg viewBox="0 0 100 10" width="100%" height="100%" preserveAspectRatio="none">
        <Path d="M0 5 Q12.5 0 25 5 T50 5 T75 5 T100 5" stroke={color} strokeWidth={2} fill="none" />
      </Svg>
    );
  }
  if (style === 'dots') {
    return (
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' }}>
        {Array.from({ length: 9 }, (_, i) => (
          <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
        ))}
      </View>
    );
  }
  return <View style={{ flex: 1, justifyContent: 'center' }}><View style={{ height: 2, backgroundColor: color }} /></View>;
}

function CanvasPoll({ node, props, actions }: {
  node: CommunityCanvasNodeEvent;
  props: Record<string, unknown>;
  actions: CanvasHostActions;
}) {
  const styles = useMkStyles(makeStyles);
  const options = props.options as string[];
  const results = actions.counts.pollResults(node.id, options.length);
  const total = results.reduce((a, b) => a + b, 0);
  return (
    <View style={styles.panelNode}>
      <Text style={styles.panelTitle} numberOfLines={2}>{String(props.question)}</Text>
      {options.map((option, index) => (
        <Pressable
          key={`${index}:${option}`}
          accessibilityRole="button"
          accessibilityLabel={`Vote ${option} (${results[index] ?? 0} votes)`}
          onPress={() => actions.onVote(node, index)}
          style={styles.pollOption}
        >
          <Text style={styles.pollOptionText} numberOfLines={1}>{option}</Text>
          <Text style={styles.pollCount}>{results[index] ?? 0}</Text>
        </Pressable>
      ))}
      <Text style={styles.panelMeta}>{total} vote{total === 1 ? '' : 's'} from members</Text>
    </View>
  );
}

function CanvasGuestbook({ node, props, actions }: {
  node: CommunityCanvasNodeEvent;
  props: Record<string, unknown>;
  actions: CanvasHostActions;
}) {
  const styles = useMkStyles(makeStyles);
  const [note, setNote] = useState('');
  const notes = actions.counts.guestbookNotes(node.id, 5);
  const sign = useCallback(() => {
    const trimmed = note.trim();
    if (!trimmed) return;
    actions.onSignGuestbook(node, trimmed);
    setNote('');
  }, [note, actions, node]);
  return (
    <View style={styles.panelNode}>
      <Text style={styles.panelTitle}>{(props.title as string) ?? 'Guestbook'}</Text>
      {notes.length === 0 ? <Text style={styles.panelMeta}>No notes yet. Leave the first.</Text> : null}
      {notes.map((entry) => (
        <Text key={entry.id} style={styles.guestNote} numberOfLines={2}>{entry.note}</Text>
      ))}
      <View style={styles.guestRow}>
        <TextInput
          style={styles.guestInput}
          placeholder={(props.prompt as string) ?? 'Sign the guestbook'}
          value={note}
          onChangeText={setNote}
          maxLength={500}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Sign" onPress={sign} style={styles.guestSign}>
          <Text style={styles.guestSignText}>Sign</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StrokesOverlay({ strokes, width, height }: {
  strokes: readonly CommunityCanvasStrokeEvent[];
  width: number;
  height: number;
}) {
  const c = useAppThemeColors();
  if (strokes.length === 0) return null;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
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
          <Path
            key={stroke.id}
            d={d}
            stroke={canvasColor(c, payload.colorToken, c.text)}
            strokeWidth={payload.width ?? 2}
            strokeOpacity={payload.brush === 'highlighter' ? 0.4 : 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );
      })}
    </Svg>
  );
}

/**
 * The canvas surface. Free layout: an absolutely positioned, pannable field
 * sized to its content. Flow layout: nodes stack as full-width sections in z
 * order (responsive by construction). Frames host their children relative to
 * the frame origin (reparenting never changes read permissions, 3.1).
 */
export function CanvasSurface({
  dialed,
  policy,
  actions,
  maxHeight,
}: {
  dialed: DialedCanvas;
  policy: MkCanvasPolicy;
  actions: CanvasHostActions;
  /** Toppers bound their height (4.2); undefined = natural size. */
  maxHeight?: number;
}) {
  const styles = useMkStyles(makeStyles);
  const roots = dialed.nodes.filter((n) => n.event.parentId === null);
  const childrenOf = new Map<string, ResolvedCanvasNode[]>();
  for (const node of dialed.nodes) {
    if (node.event.parentId === null) continue;
    const list = childrenOf.get(node.event.parentId) ?? [];
    list.push(node);
    childrenOf.set(node.event.parentId, list);
  }

  const renderPositioned = (node: ResolvedCanvasNode, offsetX: number, offsetY: number) => {
    const e = node.event;
    const body = (
      <View
        key={e.id}
        style={{
          position: 'absolute',
          left: e.x - offsetX,
          top: e.y - offsetY,
          width: e.w,
          height: e.h,
          transform: [{ rotate: `${e.rotation}deg` }],
          opacity: dialed.dimBackground && e.layer === 'background' ? 0.35 : 1,
        }}
      >
        {actions.onSelectNode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select decoration"
            onPress={() => actions.onSelectNode?.(e)}
            style={{ flex: 1 }}
          >
            <View style={{ flex: 1 }} pointerEvents="none">
              <NodeBody node={node} actions={actions} />
            </View>
          </Pressable>
        ) : (
          <NodeBody node={node} actions={actions} />
        )}
        {(childrenOf.get(e.id) ?? []).map((child) => renderPositioned(child, e.x, e.y))}
      </View>
    );
    return body;
  };

  if (policy.layout === 'flow') {
    const ordered = [...roots].sort((a, b) => a.event.z - b.event.z || a.event.y - b.event.y);
    return (
      <ScrollView style={maxHeight ? { maxHeight } : undefined}>
        <View style={styles.flowColumn}>
          {ordered.map((node) => (
            <View key={node.event.id} style={{ minHeight: node.event.h, marginBottom: 10 }}>
              {actions.onSelectNode ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Select decoration" onPress={() => actions.onSelectNode?.(node.event)}>
                  <View pointerEvents="none"><NodeBody node={node} actions={actions} /></View>
                </Pressable>
              ) : (
                <NodeBody node={node} actions={actions} />
              )}
            </View>
          ))}
          {dialed.hiddenCount > 0 ? (
            <Text style={styles.hiddenLine}>{dialed.hiddenCount} decoration{dialed.hiddenCount === 1 ? '' : 's'} hidden by your settings.</Text>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  const extentW = Math.max(360, ...dialed.nodes.map((n) => n.event.x + n.event.w)) + 40;
  const extentH = Math.max(240, ...dialed.nodes.map((n) => n.event.y + n.event.h)) + 40;
  // Feature 2 (7.7): a HOST-ENFORCED legibility scrim over the background
  // layer whenever wallpaper-class content exists there. Authors cannot
  // disable it; content above it always reads.
  const backgroundRoots = roots.filter((n) => n.event.layer === 'background');
  const foregroundRoots = roots.filter((n) => n.event.layer !== 'background');
  const hasWallpaper = backgroundRoots.some((n) => n.event.nodeType === 'image' || n.event.nodeType === 'shape');
  return (
    <View style={maxHeight ? { maxHeight } : undefined}>
      <ScrollView horizontal>
        <ScrollView>
          <View style={{ width: extentW, height: extentH }}>
            {backgroundRoots.map((node) => renderPositioned(node, 0, 0))}
            {hasWallpaper ? (
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wallpaperScrim]} />
            ) : null}
            {foregroundRoots.map((node) => renderPositioned(node, 0, 0))}
            <StrokesOverlay strokes={dialed.strokes} width={extentW} height={extentH} />
          </View>
        </ScrollView>
      </ScrollView>
      {dialed.hiddenCount > 0 ? (
        <Text style={styles.hiddenLine}>{dialed.hiddenCount} decoration{dialed.hiddenCount === 1 ? '' : 's'} hidden by your settings.</Text>
      ) : null}
    </View>
  );
}

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    placeholder: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: MK_RADIUS.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 6,
    },
    placeholderText: { color: c.textSecondary, fontSize: 11, textAlign: 'center' },
    pendingAsset: {
      flex: 1,
      backgroundColor: c.surfaceElevated,
      borderRadius: MK_RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 6,
    },
    frame: {
      flex: 1,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: MK_RADIUS.md,
    },
    linkCard: {
      flex: 1,
      backgroundColor: c.surfaceHigh,
      borderRadius: MK_RADIUS.md,
      padding: 10,
      justifyContent: 'center',
    },
    linkLabel: { color: c.accent, fontSize: 14, fontWeight: '600' },
    linkMeta: { color: c.textTertiary, fontSize: 11, marginTop: 2 },
    counter: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: MK_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 6,
    },
    counterTotal: { color: c.text, fontSize: 22, fontWeight: '700' },
    counterLabel: { color: c.textSecondary, fontSize: 11 },
    panelNode: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: MK_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 10,
    },
    panelTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 6 },
    listLineBadge: { color: c.text, fontSize: 13, flex: 1 },
    panelMeta: { color: c.textTertiary, fontSize: 11, marginTop: 4 },
    pollOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      paddingHorizontal: 8,
      backgroundColor: c.surfaceElevated,
      borderRadius: MK_RADIUS.sm,
      marginBottom: 4,
    },
    pollOptionText: { color: c.text, fontSize: 13, flex: 1 },
    pollCount: { color: c.textSecondary, fontSize: 12, marginLeft: 8 },
    guestNote: { color: c.text, fontSize: 12, marginBottom: 4 },
    guestRow: { flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' },
    guestInput: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: MK_RADIUS.sm,
      paddingHorizontal: 8,
      paddingVertical: 6,
      color: c.text,
      fontSize: 12,
      backgroundColor: c.surfaceElevated,
    },
    guestSign: { paddingHorizontal: 10, paddingVertical: 6 },
    guestSignText: { color: c.accent, fontSize: 13, fontWeight: '600' },
    revealCover: {
      flex: 1,
      backgroundColor: c.surfaceHigh,
      borderRadius: MK_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    revealText: { color: c.textSecondary, fontSize: 12, fontWeight: '600' },
    // Feature 2: the contrast-safe scrim (host-enforced, never member-styled).
    wallpaperScrim: { backgroundColor: c.background, opacity: 0.45 },
    flowColumn: { padding: 12 },
    hiddenLine: { color: c.textTertiary, fontSize: 11, padding: 8, textAlign: 'center' },
  });
