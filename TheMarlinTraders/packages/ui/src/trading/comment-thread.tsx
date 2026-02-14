'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CommentData {
  id: string
  ideaId: string
  userId: string
  parentId: string | null
  body: string
  upvotes: number
  createdAt: string | Date
  updatedAt: string | Date
  /** Resolved author name (optional, for display). */
  authorName?: string
  authorAvatarUrl?: string | null
}

export interface CommentThreadProps {
  comments: CommentData[]
  hasMore: boolean
  onLoadMore: () => void
  isLoading?: boolean
  onSubmitComment: (body: string, parentId?: string) => void
  onVoteComment?: (commentId: string) => void
  isSubmitting?: boolean
  className?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string | Date): string {
  const now = Date.now()
  const then = typeof date === 'string' ? new Date(date).getTime() : date.getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffDay > 0) return `${diffDay}d ago`
  if (diffHr > 0) return `${diffHr}h ago`
  if (diffMin > 0) return `${diffMin}m ago`
  return 'just now'
}

const MAX_NESTING_DEPTH = 3

// ── Tree builder ─────────────────────────────────────────────────────────────

interface CommentNode extends CommentData {
  children: CommentNode[]
}

function buildTree(comments: CommentData[]): CommentNode[] {
  const map = new Map<string, CommentNode>()
  const roots: CommentNode[] = []

  // Initialize nodes
  for (const c of comments) {
    map.set(c.id, { ...c, children: [] })
  }

  // Wire parent-child
  for (const c of comments) {
    const node = map.get(c.id)!
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

// ── Single comment component ─────────────────────────────────────────────────

interface SingleCommentProps {
  comment: CommentNode
  depth: number
  onReply: (parentId: string) => void
  replyingTo: string | null
  replyText: string
  onReplyTextChange: (text: string) => void
  onSubmitReply: () => void
  onVote?: (commentId: string) => void
  isSubmitting?: boolean
}

function SingleComment({
  comment,
  depth,
  onReply,
  replyingTo,
  replyText,
  onReplyTextChange,
  onSubmitReply,
  onVote,
  isSubmitting,
}: SingleCommentProps) {
  const isReplying = replyingTo === comment.id

  return (
    <div className={cn(depth > 0 && 'ml-4 border-l border-border/50 pl-4')}>
      <div className="py-2">
        {/* Author + time */}
        <div className="mb-1 flex items-center gap-2">
          {comment.authorAvatarUrl ? (
            <img
              src={comment.authorAvatarUrl}
              alt=""
              className="h-5 w-5 rounded-full"
            />
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-[8px] font-bold text-accent">
              {(comment.authorName ?? comment.userId).charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-xs font-medium text-text-primary">
            {comment.authorName ?? comment.userId.slice(0, 12)}
          </span>
          <span className="text-[10px] text-text-muted">
            {timeAgo(comment.createdAt)}
          </span>
        </div>

        {/* Body */}
        <p className="text-sm leading-relaxed text-text-secondary">
          {comment.body}
        </p>

        {/* Actions */}
        <div className="mt-1 flex items-center gap-3">
          {onVote && (
            <button
              type="button"
              onClick={() => onVote(comment.id)}
              className="flex items-center gap-1 text-[10px] text-text-muted transition-colors hover:text-text-secondary"
            >
              ▲ {comment.upvotes > 0 && comment.upvotes}
            </button>
          )}
          {depth < MAX_NESTING_DEPTH && (
            <button
              type="button"
              onClick={() => onReply(isReplying ? '' : comment.id)}
              className="text-[10px] text-text-muted transition-colors hover:text-text-secondary"
            >
              Reply
            </button>
          )}
        </div>

        {/* Reply input */}
        {isReplying && (
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => onReplyTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && replyText.trim()) {
                  onSubmitReply()
                }
              }}
              placeholder="Write a reply..."
              autoFocus
              className="flex-1 rounded border border-border bg-navy-dark px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={onSubmitReply}
              disabled={!replyText.trim() || isSubmitting}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                replyText.trim() && !isSubmitting
                  ? 'bg-accent text-text-primary hover:bg-accent-hover'
                  : 'cursor-not-allowed bg-accent/30 text-text-muted',
              )}
            >
              Reply
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {comment.children.length > 0 && (
        <div>
          {comment.children.map((child) => (
            <SingleComment
              key={child.id}
              comment={child}
              depth={depth + 1}
              onReply={onReply}
              replyingTo={replyingTo}
              replyText={replyText}
              onReplyTextChange={onReplyTextChange}
              onSubmitReply={onSubmitReply}
              onVote={onVote}
              isSubmitting={isSubmitting}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function CommentThread({
  comments,
  hasMore,
  onLoadMore,
  isLoading = false,
  onSubmitComment,
  onVoteComment,
  isSubmitting = false,
  className,
}: CommentThreadProps) {
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const tree = useMemo(() => buildTree(comments), [comments])

  const handleSubmitTopLevel = useCallback(() => {
    if (newComment.trim()) {
      onSubmitComment(newComment.trim())
      setNewComment('')
    }
  }, [newComment, onSubmitComment])

  const handleSubmitReply = useCallback(() => {
    if (replyText.trim() && replyingTo) {
      onSubmitComment(replyText.trim(), replyingTo)
      setReplyText('')
      setReplyingTo(null)
    }
  }, [replyText, replyingTo, onSubmitComment])

  const handleReply = useCallback((parentId: string) => {
    setReplyingTo(parentId || null)
    setReplyText('')
  }, [])

  return (
    <div className={cn('space-y-4', className)}>
      {/* New comment input */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Add a comment
        </label>
        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts..."
            rows={3}
            className="flex-1 rounded-md border border-border bg-navy-dark px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmitTopLevel}
            disabled={!newComment.trim() || isSubmitting}
            className={cn(
              'rounded-md px-4 py-1.5 text-xs font-medium transition-colors',
              newComment.trim() && !isSubmitting
                ? 'bg-accent text-text-primary hover:bg-accent-hover'
                : 'cursor-not-allowed bg-accent/30 text-text-muted',
            )}
          >
            {isSubmitting ? 'Posting...' : 'Comment'}
          </button>
        </div>
      </div>

      {/* Comment count */}
      <div className="border-t border-border pt-4">
        <span className="text-xs font-medium text-text-muted">
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </span>
      </div>

      {/* Threaded comments */}
      {tree.length > 0 ? (
        <div className="space-y-1">
          {tree.map((node) => (
            <SingleComment
              key={node.id}
              comment={node}
              depth={0}
              onReply={handleReply}
              replyingTo={replyingTo}
              replyText={replyText}
              onReplyTextChange={setReplyText}
              onSubmitReply={handleSubmitReply}
              onVote={onVoteComment}
              isSubmitting={isSubmitting}
            />
          ))}
        </div>
      ) : (
        !isLoading && (
          <div className="py-8 text-center text-xs text-text-muted">
            No comments yet. Be the first to share your thoughts.
          </div>
        )
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoading}
            className="text-xs text-accent hover:text-accent-hover"
          >
            {isLoading ? 'Loading...' : 'Load more comments'}
          </button>
        </div>
      )}
    </div>
  )
}
