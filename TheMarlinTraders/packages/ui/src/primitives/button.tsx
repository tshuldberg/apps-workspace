import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/utils.js'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-text-primary shadow hover:bg-accent-hover',
        destructive: 'bg-trading-red text-text-primary shadow-sm hover:bg-trading-red-dim',
        outline:
          'border border-border bg-transparent shadow-sm hover:bg-navy-light hover:text-text-primary',
        ghost: 'hover:bg-navy-light hover:text-text-primary',
        link: 'text-accent underline-offset-4 hover:underline',
        'trading-buy':
          'bg-trading-green text-text-primary shadow-sm hover:bg-trading-green-dim font-semibold',
        'trading-sell':
          'bg-trading-red text-text-primary shadow-sm hover:bg-trading-red-dim font-semibold',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
