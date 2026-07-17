'use client'

import { GlobalNavMenu } from '../../components/global-nav-menu.js'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-navy-black">
      <GlobalNavMenu />
      {children}
    </div>
  )
}
