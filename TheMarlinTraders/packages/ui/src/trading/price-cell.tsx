'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils.js'

export interface PriceCellProps {
  price: number
  prevPrice?: number
  decimals?: number
  className?: string
}

/** Displays a price with green flash on uptick, red flash on downtick.
 *  Uses CSS-only animation for minimal main-thread impact. */
export function PriceCell({ price, prevPrice, decimals = 2, className }: PriceCellProps) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)
  const prevRef = useRef(prevPrice ?? price)

  useEffect(() => {
    if (price > prevRef.current) {
      setFlash('up')
    } else if (price < prevRef.current) {
      setFlash('down')
    }
    prevRef.current = price
  }, [price])

  return (
    <span
      className={cn(
        'inline-block tabular-nums font-mono transition-colors duration-75',
        flash === 'up' && 'animate-flash-green text-trading-green',
        flash === 'down' && 'animate-flash-red text-trading-red',
        !flash && 'text-slate-200',
        className,
      )}
      onAnimationEnd={() => setFlash(null)}
    >
      {price.toFixed(decimals)}
    </span>
  )
}
