import { useEffect, useRef } from 'react';

// Modal: a scrim + centered panel. Esc and scrim-click close. The shell stays
// mounted behind it (overlays never unmount the app).

export function Modal({
  title,
  onClose,
  children,
  locked = false,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  locked?: boolean;
  wide?: boolean;
}): React.ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const lockedRef = useRef(locked);
  closeRef.current = onClose;
  lockedRef.current = locked;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const isTopmost = (): boolean => {
      const panels = document.querySelectorAll('[data-mk-modal]');
      return panels[panels.length - 1] === panel;
    };
    if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    const onFocus = (event: FocusEvent): void => {
      if (isTopmost() && event.target instanceof Node && !panel.contains(event.target)) {
        panel.focus({ preventScroll: true });
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (!isTopmost()) return;
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        if (!lockedRef.current) closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(panel.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, summary, [tabindex]',
      )).filter((element) => element.tabIndex >= 0 && !element.matches(':disabled, [inert] *') && element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        panel.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('focusin', onFocus);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('focusin', onFocus);
      window.removeEventListener('keydown', onKey, true);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="mk-scrim" onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose()}>
      <div ref={panelRef} className={`mk-modal${wide ? ' is-wide' : ''}`} data-mk-modal role="dialog" aria-modal aria-label={title} tabIndex={-1}>
        <div className="mk-modal-header">
          <h2 className="mk-modal-title">{title}</h2>
          {!locked && (
            <button className="mk-modal-close" aria-label="Close" onClick={onClose}>
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
