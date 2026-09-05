'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useRouter } from 'next/navigation';
import { useModuleRegistry } from '@mylife/module-registry/hooks';
import type { SearchResult } from '@mylife/search';
import { MODULE_ICON_MAP } from '@/lib/module-icons';
import { isWebSupportedModuleId } from '@/lib/modules';
import { searchAction, ensureSearchIndexAction } from '@/app/actions';
import {
  Search,
  ArrowRight,
  Command,
  CornerDownLeft,
} from 'lucide-react';

/* ── types ──────────────────────────────────────── */

type ResultCategory = 'module' | 'action' | 'content';

interface PaletteItem {
  id: string;
  category: ResultCategory;
  label: string;
  description?: string;
  href: string;
  icon?: React.ReactNode;
  accentColor?: string;
}

/* ── quick actions mapped per module ────────────── */

const MODULE_ACTIONS: Array<{
  moduleId: string;
  label: string;
  href: string;
}> = [
  { moduleId: 'mood', label: 'Log Mood', href: '/mood' },
  { moduleId: 'fast', label: 'Start Fast', href: '/fast' },
  { moduleId: 'budget', label: 'Add Transaction', href: '/budget/transactions' },
  { moduleId: 'books', label: 'Add Book', href: '/books/search' },
  { moduleId: 'workouts', label: 'Log Workout', href: '/workouts' },
  { moduleId: 'recipes', label: 'Browse Recipes', href: '/recipes' },
  { moduleId: 'journal', label: 'Write Entry', href: '/journal' },
  { moduleId: 'meds', label: 'Log Medication', href: '/meds' },
  { moduleId: 'habits', label: 'Track Habit', href: '/habits' },
  { moduleId: 'rsvp', label: 'Plan Event', href: '/rsvp' },
  { moduleId: 'health', label: 'Log Health', href: '/health' },
  { moduleId: 'surf', label: 'Check Surf', href: '/surf' },
  { moduleId: 'pets', label: 'Log Pet Care', href: '/pets' },
  { moduleId: 'car', label: 'Log Car Service', href: '/car' },
  { moduleId: 'words', label: 'Practice Words', href: '/words' },
  { moduleId: 'notes', label: 'New Note', href: '/notes' },
];

/* ── fuzzy match helper ─────────────────────────── */

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  // Check for substring match first
  if (lower.includes(q)) return true;
  // Character-by-character fuzzy: each query char must appear in order
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const found = lower.indexOf(q[qi]!, ti);
    if (found === -1) return false;
    ti = found + 1;
  }
  return true;
}

/* ── component ──────────────────────────────────── */

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [contentResults, setContentResults] = useState<SearchResult[]>([]);
  const [searchIndexReady, setSearchIndexReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();
  const registry = useModuleRegistry();

  const enabled = useMemo(
    () => (registry ? registry.getEnabled().filter((m) => isWebSupportedModuleId(m.id)) : []),
    [registry],
  );

  // Ensure search index on first open
  useEffect(() => {
    if (open && !searchIndexReady) {
      void ensureSearchIndexAction().then(() => setSearchIndexReady(true));
    }
  }, [open, searchIndexReady]);

  // Build results
  const items = useMemo<PaletteItem[]>(() => {
    const results: PaletteItem[] = [];
    const q = query.trim();

    if (!q) {
      // Show top modules + actions when empty
      for (const mod of enabled.slice(0, 6)) {
        const Icon = MODULE_ICON_MAP[mod.id];
        results.push({
          id: `mod-${mod.id}`,
          category: 'module',
          label: mod.name,
          description: mod.tagline,
          href: `/${mod.id}`,
          icon: Icon ? <Icon size={16} /> : null,
          accentColor: mod.accentColor,
        });
      }
      for (const action of MODULE_ACTIONS.filter((a) => enabled.some((m) => m.id === a.moduleId)).slice(0, 4)) {
        const mod = enabled.find((m) => m.id === action.moduleId);
        results.push({
          id: `act-${action.moduleId}`,
          category: 'action',
          label: action.label,
          href: action.href,
          accentColor: mod?.accentColor,
        });
      }
      return results;
    }

    // Modules: fuzzy match on name, id, tagline
    for (const mod of enabled) {
      if (
        fuzzyMatch(mod.name, q) ||
        fuzzyMatch(mod.id, q) ||
        fuzzyMatch(mod.tagline, q)
      ) {
        const Icon = MODULE_ICON_MAP[mod.id];
        results.push({
          id: `mod-${mod.id}`,
          category: 'module',
          label: mod.name,
          description: mod.tagline,
          href: `/${mod.id}`,
          icon: Icon ? <Icon size={16} /> : null,
          accentColor: mod.accentColor,
        });
      }
    }

    // Actions: fuzzy match on label
    for (const action of MODULE_ACTIONS) {
      if (!enabled.some((m) => m.id === action.moduleId)) continue;
      if (fuzzyMatch(action.label, q)) {
        const mod = enabled.find((m) => m.id === action.moduleId);
        results.push({
          id: `act-${action.moduleId}-${action.label}`,
          category: 'action',
          label: action.label,
          href: action.href,
          accentColor: mod?.accentColor,
        });
      }
    }

    // Content results from search API (populated async)
    for (const sr of contentResults) {
      const mod = enabled.find((m) => m.id === sr.moduleId);
      results.push({
        id: `content-${sr.moduleId}-${sr.itemId}`,
        category: 'content',
        label: sr.title,
        description: sr.snippet,
        href: `/${sr.moduleId}`,
        accentColor: mod?.accentColor,
      });
    }

    return results;
  }, [query, enabled, contentResults]);

  // Debounced content search
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setContentResults([]);
      return;
    }

    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void searchAction(q, { limit: 5 }).then(setContentResults);
    }, 80);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Open/close handlers
  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery('');
    setContentResults([]);
    setSelectedIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setContentResults([]);
  }, []);

  const selectItem = useCallback(
    (item: PaletteItem) => {
      closePalette();
      router.push(item.href);
    },
    [closePalette, router],
  );

  // Global keyboard listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) {
          closePalette();
        } else {
          openPalette();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, openPalette, closePalette]);

  // Palette-internal keyboard nav
  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePalette();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[selectedIndex];
        if (item) selectItem(item);
      }
    },
    [closePalette, items, selectedIndex, selectItem],
  );

  if (!open) return null;

  // Group items by category for display
  const modules = items.filter((i) => i.category === 'module');
  const actions = items.filter((i) => i.category === 'action');
  const content = items.filter((i) => i.category === 'content');

  // Build flat index for keyboard nav
  let flatIndex = 0;
  function nextIndex() {
    return flatIndex++;
  }

  return (
    <div style={st.overlay} onClick={closePalette}>
      <div style={st.container} onClick={(e) => e.stopPropagation()}>
        {/* Search input */}
        <div style={st.inputRow}>
          <Search size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            style={st.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search modules, actions, content..."
            autoComplete="off"
            spellCheck={false}
          />
          <kbd style={st.kbd}>esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={st.results}>
          {items.length === 0 && query.trim() && (
            <div style={st.empty}>No results for &ldquo;{query.trim()}&rdquo;</div>
          )}

          {modules.length > 0 && (
            <div style={st.group}>
              <div style={st.groupLabel}>Modules</div>
              {modules.map((item) => {
                const idx = nextIndex();
                return (
                  <ResultRow
                    key={item.id}
                    item={item}
                    selected={idx === selectedIndex}
                    onSelect={() => selectItem(item)}
                    onHover={() => setSelectedIndex(idx)}
                  />
                );
              })}
            </div>
          )}

          {actions.length > 0 && (
            <div style={st.group}>
              <div style={st.groupLabel}>Actions</div>
              {actions.map((item) => {
                const idx = nextIndex();
                return (
                  <ResultRow
                    key={item.id}
                    item={item}
                    selected={idx === selectedIndex}
                    onSelect={() => selectItem(item)}
                    onHover={() => setSelectedIndex(idx)}
                  />
                );
              })}
            </div>
          )}

          {content.length > 0 && (
            <div style={st.group}>
              <div style={st.groupLabel}>Content</div>
              {content.map((item) => {
                const idx = nextIndex();
                return (
                  <ResultRow
                    key={item.id}
                    item={item}
                    selected={idx === selectedIndex}
                    onSelect={() => selectItem(item)}
                    onHover={() => setSelectedIndex(idx)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={st.footer}>
          <span style={st.footerHint}>
            <CornerDownLeft size={12} /> select
          </span>
          <span style={st.footerHint}>
            <span style={{ fontSize: 11 }}>↑↓</span> navigate
          </span>
          <span style={st.footerHint}>
            <Command size={12} />K toggle
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── result row ─────────────────────────────────── */

function ResultRow({
  item,
  selected,
  onSelect,
  onHover,
}: {
  item: PaletteItem;
  selected: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const categoryIcon =
    item.category === 'module'
      ? item.icon
      : item.category === 'action'
        ? <ArrowRight size={14} />
        : <Search size={14} />;

  return (
    <button
      data-selected={selected}
      style={{
        ...st.row,
        backgroundColor: selected ? 'var(--glass-strong)' : 'transparent',
      }}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <span
        style={{
          ...st.rowIcon,
          color: item.accentColor ?? 'var(--text-secondary)',
        }}
      >
        {categoryIcon}
      </span>
      <div style={st.rowContent}>
        <span style={st.rowLabel}>{item.label}</span>
        {item.description && (
          <span style={st.rowDesc}>{item.description}</span>
        )}
      </div>
      {selected && (
        <CornerDownLeft size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
      )}
    </button>
  );
}

/* ── styles ─────────────────────────────────────── */

const st: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '15vh',
  },
  container: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--glass-border)',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text)',
    fontSize: 16,
    fontFamily: 'inherit',
  },
  kbd: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    backgroundColor: 'var(--glass)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '2px 6px',
    lineHeight: '16px',
  },
  results: {
    maxHeight: 'min(400px, 50vh)',
    overflowY: 'auto',
    padding: '4px 0',
  },
  empty: {
    padding: '24px 18px',
    color: 'var(--text-tertiary)',
    fontSize: 14,
    textAlign: 'center',
  },
  group: {
    padding: '4px 0',
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '6px 18px 4px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '10px 18px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'background-color 0.1s',
    borderRadius: 0,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'var(--glass)',
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowDesc: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  footer: {
    display: 'flex',
    gap: 16,
    padding: '10px 18px',
    borderTop: '1px solid var(--border)',
  },
  footerHint: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: 'var(--text-tertiary)',
    fontWeight: 500,
  },
};
