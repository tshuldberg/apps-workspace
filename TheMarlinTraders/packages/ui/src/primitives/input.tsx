import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../lib/utils.js'

const inputVariants = cva(
  'flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-border bg-navy-dark text-text-primary',
        error: 'border-trading-red bg-navy-dark text-text-primary focus-visible:ring-trading-red',
        monospace: 'border-border bg-navy-dark text-text-primary font-mono tabular-nums',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input, inputVariants }
