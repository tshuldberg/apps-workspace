'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'

export function Providers({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  // Allow builds without Clerk keys configured
  if (!publishableKey) {
    return <>{children}</>
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#3b82f6',
          colorBackground: '#0f0f1a',
          colorInputBackground: '#1a1a2e',
          colorInputText: '#f8fafc',
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
}
