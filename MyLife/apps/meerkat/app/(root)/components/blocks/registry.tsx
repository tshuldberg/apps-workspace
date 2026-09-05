// Composition plan 2.1: the MOBILE renderer map for the block registry.
// Renderers stay OUT of the pure core (this file may touch React Native); the
// contracts live in data/block-registry-core.ts. Every renderer reads data
// ONLY through the BlockQueries seam (data/block-queries.ts) -- never the
// DatabaseAdapter, never the network -- enforced by block-data-scope.test.ts.
// A block type with no renderer here yet renders the honest pending card in
// BlockStack (its composition phase has not shipped), never a dead surface.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';
import type { BlockQueries } from '../../data/block-queries';
import type { KnownBlockType } from '../../data/block-registry-core';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { useMkStyles } from '../../providers/AppThemeProvider';
import { Avatar } from '../Avatar';

/** Host-supplied context: navigation + the audited query seam. */
export interface BlockHostContext {
  communityId: string;
  communityName: string;
  channels: ReadonlyArray<{ id: string; name: string; kind: string }>;
  queries: BlockQueries;
  onOpenChannel: (channelId: string) => void;
  onOpenFiles: () => void;
  /** When rendering inside a channel surface, that channel's id. */
  surfaceChannelId?: string;
  /** Bumps when local rows change so lists re-derive. */
  revision: number;
}

export interface BlockRendererProps {
  config: Record<string, unknown>;
  ctx: BlockHostContext;
}

function targetChannelId(
  config: Record<string, unknown>,
  ctx: BlockHostContext,
  kinds: readonly string[],
): string | null {
  const configured = typeof config.channelId === 'string' ? config.channelId : null;
  if (configured && ctx.channels.some((c) => c.id === configured)) return configured;
  if (ctx.surfaceChannelId) return ctx.surfaceChannelId;
  const byKind = ctx.channels.find((c) => kinds.includes(c.kind));
  return byKind?.id ?? ctx.channels[0]?.id ?? null;
}

function channelName(ctx: BlockHostContext, channelId: string | null): string {
  if (!channelId) return '';
  return ctx.channels.find((c) => c.id === channelId)?.name ?? channelId;
}

function HeroBlock({ config, ctx }: BlockRendererProps) {
  const styles = useMkStyles(makeStyles);
  const identity = ctx.queries.heroIdentity();
  const title = typeof config.title === 'string' && config.title ? config.title : ctx.communityName;
  const subtitle = typeof config.subtitle === 'string' ? config.subtitle : identity?.description ?? null;
  return (
    <View style={styles.card}>
      <View style={styles.heroRow}>
        <Avatar
          imageBase64={identity?.iconImage ?? undefined}
          initial={Array.from(title.trim())[0]?.toUpperCase() ?? '?'}
          size={44}
        />
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={styles.heroSubtitle} numberOfLines={3}>{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function ChatBlock({ config, ctx }: BlockRendererProps) {
  const styles = useMkStyles(makeStyles);
  const channelId = targetChannelId(config, ctx, ['chat']);
  if (!channelId) return <EmptyLine text="No channel to show yet." />;
  const messages = ctx.queries.recentMessages(channelId, 4);
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>#{channelName(ctx, channelId)}</Text>
      {messages.length === 0 ? (
        <Text style={styles.mutedLine}>No messages yet.</Text>
      ) : (
        messages.map((message) => (
          <Text key={message.id} style={styles.listLine} numberOfLines={1}>
            {message.body || '(attachment)'}
          </Text>
        ))
      )}
      <OpenRow label={`Open #${channelName(ctx, channelId)}`} onPress={() => ctx.onOpenChannel(channelId)} />
    </View>
  );
}

function PostsBlock({ config, ctx }: BlockRendererProps) {
  const styles = useMkStyles(makeStyles);
  const channelId = targetChannelId(config, ctx, ['forum', 'chat']);
  if (!channelId) return <EmptyLine text="No channel to show yet." />;
  const cards = ctx.queries.recentPostCards(channelId, 4);
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Posts · #{channelName(ctx, channelId)}</Text>
      {cards.length === 0 ? (
        <Text style={styles.mutedLine}>No posts yet.</Text>
      ) : (
        cards.map((card) => (
          <View key={card.postId} style={styles.postRow}>
            <Text style={styles.listLine} numberOfLines={1}>
              {card.title ?? card.root.body}
            </Text>
            <Text style={styles.metaLine}>
              {card.replyCount} repl{card.replyCount === 1 ? 'y' : 'ies'}
            </Text>
          </View>
        ))
      )}
      <OpenRow label={`Open #${channelName(ctx, channelId)}`} onPress={() => ctx.onOpenChannel(channelId)} />
    </View>
  );
}

function GalleryBlock({ ctx }: BlockRendererProps) {
  const styles = useMkStyles(makeStyles);
  const items = ctx.queries.recentLibraryItems(6);
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Library</Text>
      {items.length === 0 ? (
        <Text style={styles.mutedLine}>Nothing in the library yet.</Text>
      ) : (
        items.map((item) => (
          <Text key={item.id} style={styles.listLine} numberOfLines={1}>{item.title}</Text>
        ))
      )}
    </View>
  );
}

function FilesBlock({ ctx }: BlockRendererProps) {
  const styles = useMkStyles(makeStyles);
  const files = ctx.queries.recentFiles(5);
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Files</Text>
      {files.length === 0 ? (
        <Text style={styles.mutedLine}>No files shared yet.</Text>
      ) : (
        files.map((file) => (
          <Text key={file.id} style={styles.listLine} numberOfLines={1}>{file.name}</Text>
        ))
      )}
      <OpenRow label="Open files" onPress={ctx.onOpenFiles} />
    </View>
  );
}

function MembersBlock({ config, ctx }: BlockRendererProps) {
  const styles = useMkStyles(makeStyles);
  const maxShown = typeof config.maxShown === 'number' ? config.maxShown : 8;
  const members = ctx.queries.memberRows(maxShown);
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Members</Text>
      {members.map((member) => (
        <View key={member.deviceId} style={styles.memberRow}>
          <Text style={styles.listLine} numberOfLines={1}>{member.name}</Text>
          <Text style={styles.metaLine}>{member.role}</Text>
        </View>
      ))}
    </View>
  );
}

function PageBlock({ config }: BlockRendererProps) {
  const styles = useMkStyles(makeStyles);
  const title = typeof config.title === 'string' ? config.title : null;
  const body = typeof config.body === 'string' ? config.body : null;
  if (!title && !body) return <EmptyLine text="This page is empty." />;
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.heroTitle}>{title}</Text> : null}
      {body ? <Text style={styles.bodyText}>{body}</Text> : null}
    </View>
  );
}

function EmptyLine({ text }: { text: string }) {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.mutedLine}>{text}</Text>
    </View>
  );
}

function OpenRow({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useMkStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.openRow, pressed && styles.pressed]}
    >
      <Text style={styles.openText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Renderers shipped in this build. A registered block type absent here renders
 * the honest pending card ("arrives in a later update"); composition phases
 * add entries without touching the spine.
 */
export const BLOCK_RENDERERS: Partial<Record<KnownBlockType, ComponentType<BlockRendererProps>>> = {
  hero: HeroBlock,
  chat: ChatBlock,
  posts: PostsBlock,
  gallery: GalleryBlock,
  files: FilesBlock,
  members: MembersBlock,
  page: PageBlock,
};

/** Honest copy for a known, available block whose renderer ships in a later phase. */
export const BLOCK_RENDERER_PENDING_LINE = 'This block arrives in a later update of this build.';

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: MK_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 14,
      marginBottom: 10,
    },
    cardLabel: {
      color: c.textTertiary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    heroCopy: { flex: 1 },
    heroTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
    heroSubtitle: { color: c.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
    bodyText: { color: c.text, fontSize: 14, lineHeight: 20, marginTop: 6 },
    listLine: { color: c.text, fontSize: 14, marginBottom: 6, flex: 1 },
    metaLine: { color: c.textTertiary, fontSize: 12 },
    mutedLine: { color: c.textSecondary, fontSize: 13 },
    postRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    openRow: { marginTop: 6, alignSelf: 'flex-start' },
    openText: { color: c.accent, fontSize: 13, fontWeight: '600' },
    pressed: { opacity: 0.6 },
  });
