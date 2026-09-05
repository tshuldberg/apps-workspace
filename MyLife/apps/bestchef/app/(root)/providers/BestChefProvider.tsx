import React, { createContext, useContext, useState } from 'react';

interface BestChefContextValue {
  cloudAvailable: boolean;
  userId: string | null;
}

const BestChefContext = createContext<BestChefContextValue>({
  cloudAvailable: false,
  userId: null,
});

export function useBestChef(): BestChefContextValue {
  return useContext(BestChefContext);
}

export function BestChefProvider({ children }: { children: React.ReactNode }) {
  const [state] = useState<BestChefContextValue>({
    cloudAvailable: false,
    userId: null,
  });

  return (
    <BestChefContext.Provider value={state}>
      {children}
    </BestChefContext.Provider>
  );
}
