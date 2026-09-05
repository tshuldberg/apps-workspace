import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import {
  FONT_STACK,
  TOKENS,
  chipStyle,
  formatCount,
  formatRelativeTime,
  getAvatarGradient,
  getInitials,
  getTrustMeta,
  getTrustTier,
  glassPanelStyle,
  gradientButtonStyle,
  shellPanelStyle,
  splitHighlightedText,
} from './ui';

export function MaterialSymbol({
  name,
  size = 20,
  filled = false,
  color = TOKENS.textSecondary,
  style,
}: {
  name: string;
  size?: number;
  filled?: boolean;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        lineHeight: 1,
        color,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' ${size}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

export function SurfaceCard({
  children,
  style,
  level = 'low',
  className,
}: {
  children?: ReactNode;
  style?: CSSProperties;
  level?: 'surface' | 'low' | 'mid' | 'high';
  className?: string;
}) {
  return (
    <section
      className={className}
      style={{
        ...shellPanelStyle(level),
        padding: 22,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function GlassCard({
  children,
  style,
  className,
}: {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <section
      className={className}
      style={{
        ...glassPanelStyle,
        padding: 22,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function HumanVerifiedChip({
  karma = 0,
  isVerified = false,
  role,
  compact = false,
}: {
  karma?: number;
  isVerified?: boolean | number;
  role?: string;
  compact?: boolean;
}) {
  const meta = getTrustMeta(getTrustTier({ karma, isVerified, role }));
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '6px 10px' : '7px 11px',
        borderRadius: 999,
        background: compact ? 'rgba(255,255,255,0.05)' : 'rgba(124,77,255,0.12)',
        color: meta.color,
        boxShadow: meta.glow ? `0 0 16px ${TOKENS.trustGlow}` : 'none',
      }}
    >
      <MaterialSymbol name="verified_user" filled size={compact ? 14 : 16} color={meta.color} />
      {!compact ? (
        <span
          style={{
            color: TOKENS.text,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {meta.label}
        </span>
      ) : null}
    </span>
  );
}

export function Avatar({
  label,
  size = 44,
  imageUrl,
}: {
  label: string;
  size?: number;
  imageUrl?: string | null;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={label}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          objectFit: 'cover',
          display: 'block',
        }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        display: 'grid',
        placeItems: 'center',
        background: getAvatarGradient(label),
        color: '#FFF9F2',
        fontSize: Math.max(12, size * 0.34),
        fontWeight: 800,
        letterSpacing: '0.04em',
      }}
    >
      {getInitials(label)}
    </div>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        {eyebrow ? (
          <span
            style={{
            color: TOKENS.primary,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </span>
        ) : null}
        <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.02, fontWeight: 800, letterSpacing: '-0.04em' }}>
          {title}
        </h1>
        {description ? (
          <p style={{ margin: 0, maxWidth: 760, color: TOKENS.textSecondary, fontSize: 15, lineHeight: 1.65 }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <GlassCard style={{ display: 'grid', placeItems: 'center', minHeight: 280, textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center', maxWidth: 420 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.05)',
          }}
        >
          <MaterialSymbol name={icon} size={32} color={TOKENS.primaryLight} />
        </div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</h2>
        <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.6 }}>{description}</p>
        {actionHref && actionLabel ? (
          <Link href={actionHref} style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </GlassCard>
  );
}

export interface DesktopThreadCardProps {
  href: string;
  title: string;
  body: string;
  communityLabel?: string;
  authorLabel?: string;
  createdAt: string;
  replies: number;
  votes: number;
  views?: number;
  pinned?: boolean;
  tagLabel?: string;
  trust?: { karma?: number; isVerified?: boolean | number; role?: string };
  voteState?: 'up' | 'down' | null;
  onVote?: (direction: 'up' | 'down') => void;
  footer?: ReactNode;
}

export function DesktopThreadCard({
  href,
  title,
  body,
  communityLabel,
  authorLabel,
  createdAt,
  replies,
  votes,
  views,
  pinned,
  tagLabel,
  trust,
  voteState,
  onVote,
  footer,
}: DesktopThreadCardProps) {
  return (
    <SurfaceCard style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div
          style={{
            minWidth: 56,
            display: 'grid',
            gap: 4,
            justifyItems: 'center',
            paddingTop: 4,
          }}
        >
          <button type="button" onClick={() => onVote?.('up')} style={voteButtonStyle(voteState === 'up', TOKENS.upvote)}>
            <MaterialSymbol name="stat_3" filled={voteState === 'up'} size={18} color={voteState === 'up' ? TOKENS.upvote : TOKENS.textTertiary} />
          </button>
          <strong style={{ color: votes > 0 ? TOKENS.upvote : votes < 0 ? TOKENS.downvote : TOKENS.text, fontSize: 18 }}>
            {formatCount(votes)}
          </strong>
          <button type="button" onClick={() => onVote?.('down')} style={voteButtonStyle(voteState === 'down', TOKENS.downvote)}>
            <MaterialSymbol name="stat_3" filled={voteState === 'down'} size={18} color={voteState === 'down' ? TOKENS.downvote : TOKENS.textTertiary} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>

        <div style={{ flex: 1, display: 'grid', gap: 14, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {pinned ? (
              <span style={{ ...chipStyle(true), padding: '6px 10px', fontSize: 10 }}>
                Pinned
              </span>
            ) : null}
            {communityLabel ? (
              <span
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.05)',
                  color: TOKENS.primaryLight,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {communityLabel}
              </span>
            ) : null}
            {tagLabel ? (
              <span style={{ color: TOKENS.textTertiary, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {tagLabel}
              </span>
            ) : null}
          </div>

          <Link href={href} style={{ color: TOKENS.text, textDecoration: 'none' }}>
            <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.12, fontWeight: 800, letterSpacing: '-0.03em' }}>
              {title}
            </h2>
          </Link>

          <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.7, fontSize: 15 }}>
            {body}
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {authorLabel ? (
                <>
                  <Avatar label={authorLabel} size={28} />
                  <span style={{ color: TOKENS.text, fontSize: 13, fontWeight: 700 }}>{authorLabel}</span>
                </>
              ) : null}
              {trust ? (
                <HumanVerifiedChip
                  karma={trust.karma}
                  isVerified={trust.isVerified}
                  role={trust.role}
                  compact
                />
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: TOKENS.textTertiary, fontSize: 12 }}>
              <span>{formatRelativeTime(createdAt)}</span>
              <span>{formatCount(replies)} replies</span>
              {views != null ? <span>{formatCount(views)} views</span> : null}
            </div>
          </div>

          {footer ? <div>{footer}</div> : null}
        </div>
      </div>
    </SurfaceCard>
  );
}

export function CommunityTile({
  href,
  title,
  description,
  members,
  threads,
  humansOnly,
  joined,
  actionLabel,
  onAction,
}: {
  href: string;
  title: string;
  description: string;
  members: number;
  threads: number;
  humansOnly?: boolean | number;
  joined?: boolean;
  actionLabel: string;
  onAction?: () => void;
}) {
  return (
    <SurfaceCard style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 156, background: `radial-gradient(circle at top right, rgba(255,255,255,0.12), transparent 24%), ${getAvatarGradient(title)}` }} />
      <div style={{ padding: 22, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <Link href={href} style={{ color: TOKENS.text, textDecoration: 'none' }}>
              <h3 style={{ margin: 0, fontSize: 24, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.03em' }}>{title}</h3>
            </Link>
            <p style={{ margin: 0, color: TOKENS.textSecondary, lineHeight: 1.6, fontSize: 14 }}>{description}</p>
          </div>
          {humansOnly ? (
            <span style={{ ...chipStyle(true, 'trust'), padding: '6px 10px', fontSize: 10 }}>
              Humans Only
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: TOKENS.textTertiary, fontSize: 12 }}>
            <span>{formatCount(members)} members</span>
            <span>{formatCount(threads)} threads</span>
            {joined ? <span style={{ color: TOKENS.success }}>Joined</span> : null}
          </div>
          <button
            type="button"
            onClick={onAction}
            style={{
              ...(joined ? chipStyle(false) : gradientButtonStyle),
              padding: joined ? '10px 14px' : '10px 16px',
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
}

export function HighlightedText({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitHighlightedText(text, query).map((part, index) => (
        <span
          key={`${part.value}-${index}`}
          style={part.match ? highlightedStyle : undefined}
        >
          {part.value}
        </span>
      ))}
    </>
  );
}

export function StatPill({
  label,
  value,
  icon,
  color = TOKENS.primaryLight,
}: {
  label: string;
  value: string;
  icon: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 10,
        alignItems: 'center',
        padding: '10px 14px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.05)',
      }}
    >
      <MaterialSymbol name={icon} size={16} color={color} />
      <span style={{ color: TOKENS.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <strong style={{ color: TOKENS.text, fontSize: 14 }}>{value}</strong>
    </div>
  );
}

const highlightedStyle: CSSProperties = {
  background: 'rgba(201,137,77,0.18)',
  color: TOKENS.primaryLight,
  padding: '0.08em 0.3em',
  borderRadius: 8,
};

function voteButtonStyle(active: boolean, color: string): CSSProperties {
  return {
    border: 'none',
    background: active ? `${color}22` : 'transparent',
    color,
    borderRadius: 999,
    width: 36,
    height: 36,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  };
}
