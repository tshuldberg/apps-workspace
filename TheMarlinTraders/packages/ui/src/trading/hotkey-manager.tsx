'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'

// ── Types ──────────────────────────────────────────────────

export interface HotkeyBinding {
  /** e.g. 'mod+k', 'ctrl+1', 'shift+d t', 'escape', '1' */
  keys: string
  handler: () => void
  /** If true, fires even when an input is focused */
  global?: boolean
}

interface ParsedBinding {
  /** First chord modifiers + key */
  first: ParsedChord
  /** Optional second key for sequences like 'd t' */
  second: string | null
  handler: () => void
  global: boolean
}

interface ParsedChord {
  mod: boolean // Cmd on Mac, Ctrl elsewhere
  ctrl: boolean
  shift: boolean
  alt: boolean
  key: string
}

// ── Chord parser ───────────────────────────────────────────

function parseChord(raw: string): ParsedChord {
  const parts = raw.toLowerCase().split('+').map((s) => s.trim())
  const key = parts.pop()!
  return {
    mod: parts.includes('mod'),
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key,
  }
}

function parseKeys(keys: string): { first: ParsedChord; second: string | null } {
  const chords = keys.split(' ').map((s) => s.trim()).filter(Boolean)
  return {
    first: parseChord(chords[0]!),
    second: chords.length > 1 ? chords[1]!.toLowerCase() : null,
  }
}

function chordMatches(chord: ParsedChord, e: KeyboardEvent, isMac: boolean): boolean {
  const modPressed = isMac ? e.metaKey : e.ctrlKey
  if (chord.mod && !modPressed) return false
  if (chord.ctrl && !e.ctrlKey) return false
  if (chord.shift && !e.shiftKey) return false
  if (chord.alt && !e.altKey) return false

  // For single-key bindings (no modifiers), ensure no modifiers are held
  const hasModifier = chord.mod || chord.ctrl || chord.shift || chord.alt
  if (!hasModifier && (e.metaKey || e.ctrlKey || e.altKey)) return false

  return e.key.toLowerCase() === chord.key
}

// ── Input detection ────────────────────────────────────────

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

// ── Context ────────────────────────────────────────────────

interface HotkeyContextValue {
  register: (id: string, bindings: HotkeyBinding[]) => void
  unregister: (id: string) => void
}

const HotkeyContext = createContext<HotkeyContextValue | null>(null)

// ── Provider ───────────────────────────────────────────────

const SEQUENCE_TIMEOUT_MS = 800

export function HotkeyProvider({ children }: { children: ReactNode }) {
  const bindingsRef = useRef<Map<string, ParsedBinding[]>>(new Map())
  const pendingSequenceRef = useRef<{ key: string; timestamp: number } | null>(null)
  const isMacRef = useRef(false)

  useEffect(() => {
    isMacRef.current = navigator.platform?.startsWith('Mac') ?? navigator.userAgent.includes('Mac')
  }, [])

  const register = useCallback((id: string, bindings: HotkeyBinding[]) => {
    const parsed = bindings.map((b): ParsedBinding => {
      const { first, second } = parseKeys(b.keys)
      return { first, second, handler: b.handler, global: b.global ?? false }
    })
    bindingsRef.current.set(id, parsed)
  }, [])

  const unregister = useCallback((id: string) => {
    bindingsRef.current.delete(id)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const inputFocused = isInputFocused()
      const now = Date.now()

      // Check for second key in a pending sequence
      const pending = pendingSequenceRef.current
      if (pending && now - pending.timestamp < SEQUENCE_TIMEOUT_MS) {
        const pressedKey = e.key.toLowerCase()
        for (const group of bindingsRef.current.values()) {
          for (const binding of group) {
            if (!binding.second) continue
            if (!binding.global && inputFocused) continue
            if (binding.first.key === pending.key && binding.second === pressedKey) {
              e.preventDefault()
              pendingSequenceRef.current = null
              binding.handler()
              return
            }
          }
        }
        pendingSequenceRef.current = null
      }

      // Try direct matches
      for (const group of bindingsRef.current.values()) {
        for (const binding of group) {
          if (!binding.global && inputFocused) continue
          if (!chordMatches(binding.first, e, isMacRef.current)) continue

          if (binding.second) {
            // Start a sequence
            e.preventDefault()
            pendingSequenceRef.current = { key: binding.first.key, timestamp: now }
            return
          }

          e.preventDefault()
          binding.handler()
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  return (
    <HotkeyContext.Provider value={{ register, unregister }}>
      {children}
    </HotkeyContext.Provider>
  )
}

// ── Hooks ──────────────────────────────────────────────────

/**
 * Register keyboard shortcuts. The `shortcuts` map keys are binding strings
 * (e.g. 'mod+k', 'ctrl+1', 'd t') and values are handler callbacks.
 *
 * Shortcuts are automatically unregistered on unmount.
 */
export function useHotkeys(
  shortcuts: Record<string, () => void>,
  options?: { global?: boolean },
) {
  const ctx = useContext(HotkeyContext)
  const idRef = useRef(`hotkey-${Math.random().toString(36).slice(2, 9)}`)

  useEffect(() => {
    if (!ctx) return

    const bindings: HotkeyBinding[] = Object.entries(shortcuts).map(([keys, handler]) => ({
      keys,
      handler,
      global: options?.global,
    }))

    ctx.register(idRef.current, bindings)
    return () => ctx.unregister(idRef.current)
  }, [ctx, shortcuts, options?.global])
}

/**
 * Get the raw context for advanced use cases (dynamic registration).
 */
export function useHotkeyContext(): HotkeyContextValue {
  const ctx = useContext(HotkeyContext)
  if (!ctx) {
    throw new Error('useHotkeyContext must be used within a HotkeyProvider')
  }
  return ctx
}

/**
 * Format a key binding string for display.
 * Converts 'mod+k' → '⌘K' (Mac) or 'Ctrl+K' (other).
 */
export function formatKeybinding(keys: string, isMac = true): string {
  return keys
    .split(' ')
    .map((chord) => {
      const parts = chord.split('+').map((p) => p.trim())
      return parts
        .map((p) => {
          const lower = p.toLowerCase()
          if (lower === 'mod') return isMac ? '\u2318' : 'Ctrl'
          if (lower === 'ctrl') return isMac ? '\u2303' : 'Ctrl'
          if (lower === 'shift') return '\u21E7'
          if (lower === 'alt') return isMac ? '\u2325' : 'Alt'
          if (lower === 'enter') return '\u21B5'
          if (lower === 'escape') return 'Esc'
          if (lower === 'f11') return 'F11'
          return p.toUpperCase()
        })
        .join(isMac ? '' : '+')
    })
    .join(' then ')
}
