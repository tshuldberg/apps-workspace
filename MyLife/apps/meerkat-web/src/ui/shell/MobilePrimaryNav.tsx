import { NavigationIcon } from './NavigationIcon';
import { useView } from '../navigation/useView';

// Plan 31 P5: the 5-section web IA mirroring mobile (Feed, Communities, Discover,
// Messages, Me). Friends folded into Messages (People panel), so there is no
// Friends tab.
const NAV_ITEMS = [
  { label: 'Feed', icon: 'feed', action: 'OPEN_FEED' },
  { label: 'Communities', icon: 'communities', action: 'SHOW_SIDEBAR' },
  { label: 'Public', icon: 'public', action: 'OPEN_PUBLIC' },
  { label: 'Messages', icon: 'messages', action: 'OPEN_MESSAGES' },
  { label: 'Me', icon: 'me', action: 'OPEN_SETTINGS' },
] as const;

export function MobilePrimaryNav(): React.ReactElement {
  const { view, dispatch } = useView();

  return (
    <nav className="mk-mobile-tabbar" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active =
          item.action === 'OPEN_FEED'
            ? view.main.pane === 'feed'
            : item.action === 'OPEN_PUBLIC'
              ? view.main.pane === 'public'
              : item.action === 'SHOW_SIDEBAR'
                ? view.main.pane === 'channel' || view.main.pane === 'files'
                : item.action === 'OPEN_MESSAGES'
                  ? view.main.pane === 'messages'
                  : view.overlay?.kind === 'settings';
        return (
          <button
            key={item.label}
            type="button"
            className={`mk-mobile-tab ${active ? 'is-active' : ''}`}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            title={item.label}
            onClick={() => {
              switch (item.action) {
                case 'OPEN_FEED':
                  dispatch({ type: 'OPEN_FEED' });
                  break;
                case 'OPEN_PUBLIC':
                  dispatch({ type: 'OPEN_PUBLIC' });
                  break;
                case 'SHOW_SIDEBAR':
                  dispatch({ type: 'SHOW_SIDEBAR' });
                  break;
                case 'OPEN_MESSAGES':
                  dispatch({ type: 'OPEN_MESSAGES' });
                  break;
                case 'OPEN_SETTINGS':
                  dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } });
                  break;
              }
            }}
          >
            <span className="mk-mobile-tab-icon" aria-hidden="true">
              <NavigationIcon name={item.icon} />
            </span>
            <span className="mk-mobile-tab-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
