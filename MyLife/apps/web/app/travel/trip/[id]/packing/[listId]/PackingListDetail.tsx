'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PackingItemRow } from '@mylife/travel';
import {
  bulkAddPackingItemsAction,
  createPackingItemAction,
  deletePackingItemAction,
  reorderPackingItemsAction,
  togglePackingItemAction,
  type MutationResult,
} from '../../../../actions';

interface PackingListDetailProps {
  tripId: string;
  listId: string;
  listName: string;
  items: PackingItemRow[];
  loadError: string | null;
}

export function PackingListDetail({
  tripId,
  listId,
  listName,
  items,
  loadError,
}: PackingListDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, PackingItemRow[]>();
    for (const item of items) {
      const key = item.category ?? 'Uncategorized';
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const totals = useMemo(() => {
    const total = items.length;
    const packed = items.filter((i) => i.packed === 1).length;
    const pct = total === 0 ? 0 : Math.round((packed / total) * 100);
    return { total, packed, pct };
  }, [items]);

  function run(
    fn: () => Promise<MutationResult>,
    onSuccess?: () => void,
  ) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          setFormError(result.error ?? 'Something went wrong.');
          return;
        }
        setFormError(null);
        onSuccess?.();
        router.refresh();
      } catch {
        setFormError('Unexpected error. Please try again.');
      }
    });
  }

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set('trip_id', tripId);
    run(
      () => createPackingItemAction(listId, fd),
      () => {
        form.reset();
        setShowAdd(false);
      },
    );
  }

  function handleBulk(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const raw = String(fd.get('labels') ?? '');
    const labels = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (labels.length === 0) {
      setFormError('Enter at least one item (one per line).');
      return;
    }
    run(
      () => bulkAddPackingItemsAction(listId, labels),
      () => {
        form.reset();
        setShowBulk(false);
      },
    );
  }

  function handleToggle(id: string) {
    run(() => togglePackingItemAction(id));
  }

  function handleDelete(id: string) {
    run(() => deletePackingItemAction(id));
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    run(() =>
      reorderPackingItemsAction(
        listId,
        next.map((i) => i.id),
      ),
    );
  }

  if (loadError) {
    return (
      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Could not load items</h3>
        <p style={styles.panelBody}>{loadError}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={styles.header}>
        <p style={styles.eyebrow}>PACKING LIST</p>
        <h2 style={styles.title}>{listName}</h2>
        <p style={styles.meta}>
          {totals.packed} / {totals.total} packed · {totals.pct}%
        </p>
        <progress
          value={totals.packed}
          max={totals.total || 1}
          style={styles.progress}
        />
      </section>

      {items.length === 0 ? (
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>No items yet</h3>
          <p style={styles.panelBody}>
            Add items one at a time or bulk-paste a list below.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {grouped.map(([category, rows]) => (
            <div key={category} style={styles.group}>
              <span style={styles.groupTitle}>{category}</span>
              <div style={{ display: 'grid', gap: 8 }}>
                {rows.map((item) => {
                  const globalIndex = items.findIndex((i) => i.id === item.id);
                  return (
                    <div key={item.id} style={styles.itemRow}>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={item.packed === 1}
                          onChange={() => handleToggle(item.id)}
                          disabled={isPending}
                          style={styles.checkbox}
                        />
                      </label>
                      <div style={{ flex: 1 }}>
                        <span
                          style={{
                            ...styles.itemLabel,
                            ...(item.packed === 1 ? styles.itemLabelPacked : null),
                          }}
                        >
                          {item.label}
                        </span>
                        {item.quantity > 1 ? (
                          <span style={styles.itemMeta}>Qty {item.quantity}</span>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          style={styles.moveBtn}
                          onClick={() => handleMove(globalIndex, -1)}
                          disabled={isPending || globalIndex === 0}
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          style={styles.moveBtn}
                          onClick={() => handleMove(globalIndex, 1)}
                          disabled={
                            isPending || globalIndex === items.length - 1
                          }
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          style={styles.deleteBtn}
                          onClick={() => handleDelete(item.id)}
                          disabled={isPending}
                          aria-label="Delete"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <form onSubmit={handleAdd} style={styles.inlineForm}>
          <label style={styles.label} htmlFor="packing-label">
            Label
          </label>
          <input
            id="packing-label"
            name="label"
            placeholder="Sunglasses"
            style={styles.input}
            required
            autoComplete="off"
          />
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}
          >
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={styles.label} htmlFor="packing-qty">
                Qty
              </label>
              <input
                id="packing-qty"
                name="quantity"
                type="number"
                min={1}
                defaultValue={1}
                style={styles.input}
              />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={styles.label} htmlFor="packing-category">
                Category
              </label>
              <input
                id="packing-category"
                name="category"
                placeholder="clothing, gear, toiletries…"
                style={styles.input}
                autoComplete="off"
              />
            </div>
          </div>
          {formError ? <p style={styles.errorText}>{formError}</p> : null}
          <div style={styles.formActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => {
                setShowAdd(false);
                setFormError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Save item'}
            </button>
          </div>
        </form>
      ) : null}

      {showBulk ? (
        <form onSubmit={handleBulk} style={styles.inlineForm}>
          <label style={styles.label} htmlFor="packing-bulk">
            Bulk add (one per line)
          </label>
          <textarea
            id="packing-bulk"
            name="labels"
            placeholder={'Sunglasses\nSunscreen\nBeach towel'}
            style={{ ...styles.input, minHeight: 140 }}
          />
          {formError ? <p style={styles.errorText}>{formError}</p> : null}
          <div style={styles.formActions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => {
                setShowBulk(false);
                setFormError(null);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.primaryButton}
              disabled={isPending}
            >
              {isPending ? 'Adding…' : 'Add all'}
            </button>
          </div>
        </form>
      ) : null}

      {!showAdd && !showBulk ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={styles.addBtn}
            onClick={() => {
              setShowAdd(true);
              setShowBulk(false);
              setFormError(null);
            }}
          >
            + Add item
          </button>
          <button
            type="button"
            style={styles.addBtn}
            onClick={() => {
              setShowBulk(true);
              setShowAdd(false);
              setFormError(null);
            }}
          >
            + Bulk add
          </button>
        </div>
      ) : null}

      {formError && !showAdd && !showBulk ? (
        <p style={styles.errorText}>{formError}</p>
      ) : null}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  header: {
    display: 'grid',
    gap: 8,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(18px)',
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: '#0EA5E9',
  },
  title: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
    color: 'var(--text)',
  },
  meta: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  progress: {
    width: '100%',
    height: 8,
    accentColor: '#0EA5E9',
  },
  panel: {
    display: 'grid',
    gap: 8,
    padding: 20,
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
  },
  panelTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--text)',
  },
  panelBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  group: {
    display: 'grid',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  groupTitle: {
    color: '#0EA5E9',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  checkboxLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
  checkbox: {
    width: 18,
    height: 18,
    accentColor: '#0EA5E9',
    cursor: 'pointer',
  },
  itemLabel: {
    display: 'block',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
  },
  itemLabelPacked: {
    color: 'var(--text-secondary)',
    textDecoration: 'line-through',
  },
  itemMeta: {
    display: 'block',
    color: 'var(--text-secondary)',
    fontSize: 11,
    marginTop: 2,
  },
  moveBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid rgba(255,180,171,0.3)',
    background: 'transparent',
    color: '#FFB4AB',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
  },
  addBtn: {
    padding: '12px 16px',
    borderRadius: 14,
    border: '1px dashed rgba(255,255,255,0.2)',
    background: 'transparent',
    color: '#0EA5E9',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  inlineForm: {
    display: 'grid',
    gap: 8,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text)',
    fontSize: 14,
  },
  errorText: {
    margin: 0,
    color: '#FFB4AB',
    fontSize: 13,
  },
  primaryButton: {
    justifySelf: 'start',
    padding: '10px 16px',
    borderRadius: 12,
    border: 'none',
    background: '#0EA5E9',
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryButton: {
    justifySelf: 'start',
    padding: '10px 16px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  formActions: {
    display: 'flex',
    gap: 10,
    marginTop: 4,
  },
};
