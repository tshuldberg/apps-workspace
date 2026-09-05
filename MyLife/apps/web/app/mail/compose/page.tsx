'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  fetchAccountsAction,
  fetchMessageAction,
  createDraftAction,
  updateDraftAction,
  autoCompleteContactsAction,
} from '../actions';
import { MAIL_COLORS as C } from '../ui';

const { accent: ACCENT, text: TEXT, textSec: TEXT_SEC, textTert: TEXT_TERT, surface: SURFACE, border: BORDER, glass: GLASS, glassStrong: GLASS_STRONG } = C;

interface Account { id: string; email: string; displayName: string }
interface Contact { id: string; email: string; displayName: string | null; isVip: boolean }

function ComposePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const replyTo = searchParams.get('replyTo');
  const replyAll = searchParams.get('replyAll');
  const forward = searchParams.get('forward');
  const draftParam = searchParams.get('draftId');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [toRecipients, setToRecipients] = useState<string[]>([]);
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [ccQuery, setCcQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [activeField, setActiveField] = useState<'to' | 'cc' | null>(null);
  const [draftId, setDraftId] = useState<string | null>(draftParam);
  const [draftSaved, setDraftSaved] = useState(false);
  const [sending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const accts = await fetchAccountsAction();
        if (!cancelled) {
          setAccounts(accts as Account[]);
          if (accts.length > 0) setSelectedAccountId(accts[0].id);
        }
      } catch { /* silent */ }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // Pre-fill for reply/forward
  useEffect(() => {
    const msgId = replyTo ?? replyAll ?? forward;
    if (!msgId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const msg = await fetchMessageAction(msgId);
        if (!msg || cancelled) return;
        if (replyTo) {
          setToRecipients([msg.from]);
          setSubject(`Re: ${msg.subject.replace(/^Re:\s*/i, '')}`);
          setBody(`\n\n---\nOn ${new Date(msg.receivedAt).toLocaleString()}, ${msg.from} wrote:\n${msg.body}`);
        } else if (replyAll) {
          setToRecipients([msg.from]);
          const others = msg.to.filter((e: string) => e !== msg.from);
          if (others.length > 0) { setCcRecipients(others); setShowCc(true); }
          setSubject(`Re: ${msg.subject.replace(/^Re:\s*/i, '')}`);
          setBody(`\n\n---\nOn ${new Date(msg.receivedAt).toLocaleString()}, ${msg.from} wrote:\n${msg.body}`);
        } else if (forward) {
          setSubject(`Fwd: ${msg.subject.replace(/^Fwd:\s*/i, '')}`);
          setBody(`\n\n--- Forwarded message ---\nFrom: ${msg.from}\nDate: ${new Date(msg.receivedAt).toLocaleString()}\nSubject: ${msg.subject}\n\n${msg.body}`);
        }
      } catch { /* silent */ }
    };
    void load();
    return () => { cancelled = true; };
  }, [replyTo, replyAll, forward]);

  // Autocomplete
  useEffect(() => {
    const query = activeField === 'to' ? toQuery : ccQuery;
    if (!query.trim() || !activeField || !selectedAccountId) { setSuggestions([]); return; }
    let cancelled = false;
    const search = async () => {
      try {
        const results = await autoCompleteContactsAction(selectedAccountId, query);
        if (!cancelled) setSuggestions(results as Contact[]);
      } catch { if (!cancelled) setSuggestions([]); }
    };
    void search();
    return () => { cancelled = true; };
  }, [toQuery, ccQuery, activeField, selectedAccountId]);

  const saveDraft = useCallback(async () => {
    if (!subject && !body && toRecipients.length === 0) return;
    try {
      if (draftId) {
        await updateDraftAction(draftId, { subject, to: toRecipients, body });
      } else {
        const draft = await createDraftAction({ accountId: selectedAccountId, subject, to: toRecipients, body });
        if (draft) setDraftId(draft.id);
      }
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch { /* silent */ }
  }, [draftId, selectedAccountId, subject, toRecipients, body]);

  // Auto-save every 30s
  useEffect(() => {
    const timer = setInterval(() => { void saveDraft(); }, 30000);
    return () => clearInterval(timer);
  }, [saveDraft]);

  const addRecipient = useCallback((email: string) => {
    if (activeField === 'to') {
      setToRecipients((prev) => prev.includes(email) ? prev : [...prev, email]);
      setToQuery('');
    } else if (activeField === 'cc') {
      setCcRecipients((prev) => prev.includes(email) ? prev : [...prev, email]);
      setCcQuery('');
    }
    setSuggestions([]);
    setActiveField(null);
  }, [activeField]);

  const handleToKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && toQuery.includes('@')) {
      e.preventDefault();
      addRecipient(toQuery.trim());
    }
  }, [toQuery, addRecipient]);

  const handleCcKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && ccQuery.includes('@')) {
      e.preventDefault();
      addRecipient(ccQuery.trim());
    }
  }, [ccQuery, addRecipient]);

  const isValid = toRecipients.length > 0 && !sending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 24px', borderBottom: `1px solid ${BORDER}`, backgroundColor: GLASS_STRONG,
      }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>
          {draftId ? 'Draft' : 'Compose'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => void saveDraft()}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
              backgroundColor: GLASS, border: `1px solid ${BORDER}`, color: TEXT_SEC, cursor: 'pointer',
            }}
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={!isValid}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 700,
              backgroundColor: isValid ? ACCENT : SURFACE, color: isValid ? '#fff' : TEXT_TERT,
              border: 'none', cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            Send
          </button>
        </div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
        {/* Account picker */}
        {accounts.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 13, color: TEXT_SEC, width: 50 }}>From</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAccountId(a.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${selectedAccountId === a.id ? ACCENT : BORDER}`,
                    backgroundColor: selectedAccountId === a.id ? 'rgba(59,130,246,0.15)' : GLASS,
                    color: selectedAccountId === a.id ? ACCENT : TEXT_SEC,
                  }}
                >
                  {a.email}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* To field */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 0', borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 13, color: TEXT_SEC, width: 50, paddingTop: 4 }}>To</span>
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            {toRecipients.map((email) => (
              <span key={email} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 999, backgroundColor: SURFACE,
                border: `1px solid ${BORDER}`, fontSize: 13, color: TEXT,
              }}>
                {email.split('@')[0]}
                <button
                  type="button"
                  onClick={() => setToRecipients((p) => p.filter((e) => e !== email))}
                  style={{ background: 'none', border: 'none', color: TEXT_TERT, cursor: 'pointer', fontSize: 12 }}
                >
                  x
                </button>
              </span>
            ))}
            <input
              value={toQuery}
              onChange={(e) => { setToQuery(e.target.value); setActiveField('to'); }}
              onFocus={() => setActiveField('to')}
              onKeyDown={handleToKeyDown}
              placeholder={toRecipients.length === 0 ? 'Add recipients...' : ''}
              style={{
                flex: 1, minWidth: 120, background: 'none', border: 'none', outline: 'none',
                color: TEXT, fontSize: 14,
              }}
            />
          </div>
          {!showCc && (
            <button
              type="button"
              onClick={() => setShowCc(true)}
              style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              +CC
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <div style={{
            marginLeft: 58, backgroundColor: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 8, overflow: 'hidden',
          }}>
            {suggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => addRecipient(c.email)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 12px', background: 'none', border: 'none',
                  borderBottom: `1px solid ${BORDER}`, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 14, color: TEXT }}>{c.displayName ?? c.email}</span>
                <span style={{ fontSize: 12, color: TEXT_TERT }}>{c.email}</span>
                {c.isVip && <span style={{ fontSize: 11, color: '#F59E0B' }}>VIP</span>}
              </button>
            ))}
          </div>
        )}

        {/* CC field */}
        {showCc && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 0', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 13, color: TEXT_SEC, width: 50, paddingTop: 4 }}>CC</span>
            <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              {ccRecipients.map((email) => (
                <span key={email} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 999, backgroundColor: SURFACE,
                  border: `1px solid ${BORDER}`, fontSize: 13, color: TEXT,
                }}>
                  {email.split('@')[0]}
                  <button
                    type="button"
                    onClick={() => setCcRecipients((p) => p.filter((e) => e !== email))}
                    style={{ background: 'none', border: 'none', color: TEXT_TERT, cursor: 'pointer', fontSize: 12 }}
                  >
                    x
                  </button>
                </span>
              ))}
              <input
                value={ccQuery}
                onChange={(e) => { setCcQuery(e.target.value); setActiveField('cc'); }}
                onFocus={() => setActiveField('cc')}
                onKeyDown={handleCcKeyDown}
                style={{
                  flex: 1, minWidth: 120, background: 'none', border: 'none', outline: 'none',
                  color: TEXT, fontSize: 14,
                }}
              />
            </div>
          </div>
        )}

        {/* Subject */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 13, color: TEXT_SEC, width: 50 }}>Subj</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: TEXT, fontSize: 16, fontWeight: 500,
            }}
          />
        </div>

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
          style={{
            width: '100%', minHeight: 300, marginTop: 16, padding: 0,
            background: 'none', border: 'none', outline: 'none', resize: 'vertical',
            color: TEXT, fontSize: 15, lineHeight: 1.7, fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Bottom bar */}
      <div style={{
        padding: '8px 24px', borderTop: `1px solid ${BORDER}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: TEXT_TERT,
      }}>
        <span>{draftSaved ? 'Draft saved' : draftId ? 'Draft' : ''}</span>
        <span>Cmd+Enter to Send</span>
      </div>
    </div>
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={null}>
      <ComposePageContent />
    </Suspense>
  );
}
