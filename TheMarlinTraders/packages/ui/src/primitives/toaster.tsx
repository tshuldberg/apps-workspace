'use client'

import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-navy-dark group-[.toaster]:text-text-primary group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-text-secondary',
          actionButton: 'group-[.toast]:bg-accent group-[.toast]:text-text-primary',
          cancelButton: 'group-[.toast]:bg-navy-mid group-[.toast]:text-text-secondary',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
