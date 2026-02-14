import { create } from 'zustand'

interface AppState {
  theme: 'dark' | 'light'
  sidebarOpen: boolean
  activeSymbol: string
  setTheme: (theme: 'dark' | 'light') => void
  toggleSidebar: () => void
  setActiveSymbol: (symbol: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'dark',
  sidebarOpen: true,
  activeSymbol: 'AAPL',
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),
}))
