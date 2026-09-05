// View context: the reducer dispatch + current view, available to any component.

import { createContext, useContext } from 'react';
import type { AppView, ViewAction } from './view-state';
import { INITIAL_VIEW } from './view-state';

export interface ViewContextValue {
  view: AppView;
  dispatch: (action: ViewAction) => void;
}

export const ViewContext = createContext<ViewContextValue>({
  view: INITIAL_VIEW,
  dispatch: () => undefined,
});

export function useView(): ViewContextValue {
  return useContext(ViewContext);
}
