export function NavigationIcon({ name }: { name: 'feed' | 'communities' | 'public' | 'messages' | 'me' | 'discover' | 'library' | 'add' | 'organize' | 'settings' }): React.ReactElement {
  const paths = {
    discover: <><circle cx="12" cy="12" r="10" /><path d="m16 8-3 5-5 3 3-5 5-3z" /></>,
    library: <><path d="M4 4h4v16H4zM10 4h4v16h-4zM17 4l4 15-3 1-4-15z" /></>,
    add: <path d="M12 5v14M5 12h14" />,
    organize: <><path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" /></>,
    settings: <><path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 3 2 3-2 3 1 2-3-1-3 2-2-2-3-3-1-1-3z" /><circle cx="12" cy="11" r="3" /></>,
    feed: <><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></>,
    communities: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /><circle cx="9" cy="7" r="4" /></>,
    public: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a18 18 0 0 0 0 20 18 18 0 0 0 0-20" /></>,
    messages: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
    me: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="9" r="3" /><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /></>,
  };
  return <svg width="24" height="24" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" focusable="false">{paths[name]}</svg>;
}
