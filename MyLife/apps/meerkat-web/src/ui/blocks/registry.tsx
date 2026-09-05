// Composition plan 2.1: the WEB renderer map for the block registry (twin in
// spirit of apps/meerkat/app/(root)/components/blocks/registry.tsx; renderers
// are surface-specific by design, the CONTRACTS are the parity-locked core).
// Every renderer reads data ONLY through the BlockQueries seam
// (lib/block-queries.ts) -- never the DatabaseAdapter, never the network --
// enforced by the block-data-scope test. A block type with no renderer here
// yet renders the honest pending card in BlockStack, never a dead surface.

import type { ComponentType } from 'react';
import type { BlockQueries } from '../../lib/block-queries';
import type { KnownBlockType } from '../../lib/block-registry-core';

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

function HeroBlock({ config, ctx }: BlockRendererProps): React.ReactElement {
  const identity = ctx.queries.heroIdentity();
  const title = typeof config.title === 'string' && config.title ? config.title : ctx.communityName;
  const subtitle = typeof config.subtitle === 'string' ? config.subtitle : identity?.description ?? null;
  return (
    <div className="mk-block-card">
      <div className="mk-block-hero">
        <div className="mk-block-hero-title">{title}</div>
        {subtitle ? <div className="mk-block-hero-subtitle">{subtitle}</div> : null}
      </div>
    </div>
  );
}

function ChatBlock({ config, ctx }: BlockRendererProps): React.ReactElement {
  const channelId = targetChannelId(config, ctx, ['chat']);
  if (!channelId) return <div className="mk-block-card mk-muted">No channel to show yet.</div>;
  const messages = ctx.queries.recentMessages(channelId, 4);
  return (
    <div className="mk-block-card">
      <div className="mk-block-label">#{channelName(ctx, channelId)}</div>
      {messages.length === 0 ? (
        <div className="mk-muted">No messages yet.</div>
      ) : (
        messages.map((message) => (
          <div key={message.id} className="mk-block-line">{message.body || '(attachment)'}</div>
        ))
      )}
      <button type="button" className="mk-block-open" onClick={() => ctx.onOpenChannel(channelId)}>
        Open #{channelName(ctx, channelId)}
      </button>
    </div>
  );
}

function PostsBlock({ config, ctx }: BlockRendererProps): React.ReactElement {
  const channelId = targetChannelId(config, ctx, ['forum', 'chat']);
  if (!channelId) return <div className="mk-block-card mk-muted">No channel to show yet.</div>;
  const cards = ctx.queries.recentPostCards(channelId, 4);
  return (
    <div className="mk-block-card">
      <div className="mk-block-label">Posts · #{channelName(ctx, channelId)}</div>
      {cards.length === 0 ? (
        <div className="mk-muted">No posts yet.</div>
      ) : (
        cards.map((card) => (
          <div key={card.postId} className="mk-block-row">
            <span className="mk-block-line">{card.title ?? card.root.body}</span>
            <span className="mk-block-meta">{card.replyCount} repl{card.replyCount === 1 ? 'y' : 'ies'}</span>
          </div>
        ))
      )}
      <button type="button" className="mk-block-open" onClick={() => ctx.onOpenChannel(channelId)}>
        Open #{channelName(ctx, channelId)}
      </button>
    </div>
  );
}

function GalleryBlock({ ctx }: BlockRendererProps): React.ReactElement {
  const items = ctx.queries.recentLibraryItems(6);
  return (
    <div className="mk-block-card">
      <div className="mk-block-label">Library</div>
      {items.length === 0 ? (
        <div className="mk-muted">Nothing in the library yet.</div>
      ) : (
        items.map((item) => <div key={item.id} className="mk-block-line">{item.title}</div>)
      )}
    </div>
  );
}

function FilesBlock({ ctx }: BlockRendererProps): React.ReactElement {
  const files = ctx.queries.recentFiles(5);
  return (
    <div className="mk-block-card">
      <div className="mk-block-label">Files</div>
      {files.length === 0 ? (
        <div className="mk-muted">No files shared yet.</div>
      ) : (
        files.map((file) => <div key={file.id} className="mk-block-line">{file.name}</div>)
      )}
      <button type="button" className="mk-block-open" onClick={ctx.onOpenFiles}>Open files</button>
    </div>
  );
}

function MembersBlock({ config, ctx }: BlockRendererProps): React.ReactElement {
  const maxShown = typeof config.maxShown === 'number' ? config.maxShown : 8;
  const members = ctx.queries.memberRows(maxShown);
  return (
    <div className="mk-block-card">
      <div className="mk-block-label">Members</div>
      {members.map((member) => (
        <div key={member.deviceId} className="mk-block-row">
          <span className="mk-block-line">{member.name}</span>
          <span className="mk-block-meta">{member.role}</span>
        </div>
      ))}
    </div>
  );
}

function PageBlock({ config }: BlockRendererProps): React.ReactElement {
  const title = typeof config.title === 'string' ? config.title : null;
  const body = typeof config.body === 'string' ? config.body : null;
  if (!title && !body) return <div className="mk-block-card mk-muted">This page is empty.</div>;
  return (
    <div className="mk-block-card">
      {title ? <div className="mk-block-hero-title">{title}</div> : null}
      {body ? <div className="mk-block-body">{body}</div> : null}
    </div>
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
