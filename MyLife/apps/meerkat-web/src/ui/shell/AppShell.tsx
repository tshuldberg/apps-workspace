// AppShell: the 3-pane Discord layout. Pure structure; each region is supplied
// by the composing view so later slices swap in real rail/sidebar/main content
// without touching the layout.
//
// Responsive: at >= 721px this is the unchanged 3-column grid. At <= 720px the
// CSS collapses to a single pane and `data-pane` selects which one is visible:
// 'sidebar' shows the rail + channel list, 'main' shows the open channel/files
// pane. The composing view derives activePane from view state.

export function AppShell({
  rail,
  sidebar,
  main,
  mobileNav,
  activePane = 'sidebar',
}: {
  rail: React.ReactNode;
  sidebar: React.ReactNode;
  main: React.ReactNode;
  mobileNav?: React.ReactNode;
  /** Narrow-viewport only: which pane is visible. Ignored by the desktop grid. */
  activePane?: 'sidebar' | 'main';
}): React.ReactElement {
  return (
    <div className="mk-shell" data-pane={activePane}>
      <nav className="mk-rail" aria-label="Communities">
        {rail}
      </nav>
      <aside className="mk-sidebar">{sidebar}</aside>
      <main className="mk-main">{main}</main>
      {mobileNav ? <div className="mk-mobile-primary-nav">{mobileNav}</div> : null}
    </div>
  );
}
