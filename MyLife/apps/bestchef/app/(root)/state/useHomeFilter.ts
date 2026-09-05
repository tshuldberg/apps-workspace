import { createContext, useContext } from 'react';

export type HomeFilterId = 'trending' | 'nearby' | 'following' | 'restaurants';

export interface HomeFilterContextValue {
  selected: HomeFilterId;
  setSelected: (id: HomeFilterId) => void;
}

export const HomeFilterContext = createContext<HomeFilterContextValue>({
  selected: 'trending',
  setSelected: () => {},
});

export function useHomeFilter(): HomeFilterContextValue {
  return useContext(HomeFilterContext);
}
