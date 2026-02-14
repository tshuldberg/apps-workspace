'use client'

import { useEffect, useState, useMemo } from 'react'
import { useHotkeys as useHotkeysBase } from '@marlin/ui/trading/hotkey-manager'

export { HotkeyProvider, useHotkeyContext, formatKeybinding } from '@marlin/ui/trading/hotkey-manager'

/**
 * Next.js-safe wrapper around the package-level useHotkeys hook.
 * Only registers shortcuts on the client (SSR-safe).
 */
export function useHotkeys(
  shortcuts: Record<string, () => void>,
  options?: { global?: boolean; enabled?: boolean },
) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const safeShortcuts = useMemo(
    () => (mounted && options?.enabled !== false ? shortcuts : {}),
    [mounted, shortcuts, options?.enabled],
  )

  useHotkeysBase(safeShortcuts, { global: options?.global })
}
