import React, { useState, type ReactNode } from 'react';
import { HomeFilterContext, type HomeFilterId } from './useHomeFilter';

export function HomeFilterProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<HomeFilterId>('trending');
  return (
    <HomeFilterContext.Provider value={{ selected, setSelected }}>
      {children}
    </HomeFilterContext.Provider>
  );
}
