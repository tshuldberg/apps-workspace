import type { ComponentType, ReactNode } from 'react';

type PassthroughComponent = ComponentType<any>;

declare module '@myhabits-web/*' {
  const Component: PassthroughComponent;
  export default Component;
}

declare module '@mywords-web/*' {
  const Component: PassthroughComponent;
  export default Component;
}

declare module '@myfast-web/*' {
  const Component: PassthroughComponent;
  export const Providers: ComponentType<{ children: ReactNode }>;
  export default Component;
}

declare module '@mycar-web/*' {
  const Component: PassthroughComponent;
  export default Component;
}

declare module '@mybudget-web/*' {
  const Component: PassthroughComponent;
  export default Component;
}

declare module '@myhomes-web/*' {
  const Component: PassthroughComponent;
  export default Component;
}

declare module '@myrecipes-web/*' {
  const Component: PassthroughComponent;
  export default Component;
}

declare module '@mysurf-web/*' {
  const Component: PassthroughComponent;
  export default Component;
}

declare module '@myworkouts-web/*' {
  const Component: PassthroughComponent;
  export default Component;
}
