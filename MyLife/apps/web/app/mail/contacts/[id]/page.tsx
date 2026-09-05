'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchContactByEmailAction, fetchAccountsAction, toggleContactVipAction, deleteContactAction } from '../../actions';
import { generateInitials, getAvatarColor, MAIL_COLORS as C } from '../../ui';

const { accent: ACCENT, text: TEXT, textSec: TEXT_SEC, textTert: TEXT_TERT, surface: SURFACE, border: BORDER } = C;
interface Contact {
  id: string; email: string; displayName: string | null; isVip: boolean;
  source: string; frequency: number; company: string | null;
  phone: string | null; notes: string | null; lastContactedAt: string | null;
}

export default function ContactDetailPage() {
  const params = useParams();
  const contactEmail = decodeURIComponent(params.id as string);
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContact = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const accounts = await fetchAccountsAction();
      if (accounts.length === 0) { setError('No accounts configured.'); return; }
      const c = await fetchContactByEmailAction(accounts[0].id, contactEmail);
      setContact(c as Contact | null);
    } catch {
      setError('Could not load contact.');
    } finally {
      setLoading(false);
    }
  }, [contactEmail]);

  useEffect(() => { void loadContact(); }, [loadContact]);

  const handleToggleVip = useCallback(async () => {
    if (!contact) return;
    try {
      const updated = await toggleContactVipAction(contact.id);
      if (updated) setContact(updated as Contact);
    } catch { /* silent */ }
  }, [contact]);

  const handleDelete = useCallback(async () => {
    if (!contact) return;
    try {
      await deleteContactAction(contact.id);
      router.push('/mail/contacts');
    } catch { /* silent */ }
  }, [contact, router]);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ width: 60, height: 60, borderRadius: 999, backgroundColor: SURFACE, opacity: 0.6, marginBottom: 16 }} />
        <div style={{ width: '40%', height: 20, borderRadius: 4, backgroundColor: SURFACE, opacity: 0.6 }} />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ color: '#FF453A', fontSize: 14 }}>{error ?? 'Contact not found'}</p>
        <button type="button" onClick={() => router.push('/mail/contacts')} style={{
          marginTop: 12, padding: '8px 16px', borderRadius: 8, backgroundColor: ACCENT,
          color: '#fff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer',
        }}>Back to Contacts</button>
      </div>
    );
  }

  const avatarColor = getAvatarColor(contact.email);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 560 }}>
      <button type="button" onClick={() => router.push('/mail/contacts')} style={{
        background: 'none', border: 'none', color: ACCENT, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16,
      }}>Back to Contacts</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 999, backgroundColor: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {generateInitials(contact.displayName ?? contact.email)}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT }}>
            {contact.displayName ?? contact.email.split('@')[0]}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: TEXT_SEC }}>{contact.email}</p>
        </div>
        <button type="button" onClick={() => void handleToggleVip()} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 24,
        }}>{contact.isVip ? '⭐' : '☆'}</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: 16, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_TERT, marginBottom: 8 }}>Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contact.company && <div style={{ fontSize: 14, color: TEXT_SEC }}>Company: {contact.company}</div>}
            {contact.phone && <div style={{ fontSize: 14, color: TEXT_SEC }}>Phone: {contact.phone}</div>}
            <div style={{ fontSize: 14, color: TEXT_SEC }}>Source: {contact.source}</div>
            <div style={{ fontSize: 14, color: TEXT_SEC }}>Messages exchanged: {contact.frequency}</div>
            {contact.lastContactedAt && (
              <div style={{ fontSize: 14, color: TEXT_SEC }}>
                Last contacted: {new Date(contact.lastContactedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        {contact.notes && (
          <div style={{ padding: 16, borderRadius: 12, backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, color: TEXT_TERT, marginBottom: 8 }}>Notes</div>
            <p style={{ fontSize: 14, color: TEXT_SEC, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{contact.notes}</p>
          </div>
        )}

        <button type="button" onClick={() => void handleDelete()} style={{
          marginTop: 12, padding: '10px 20px', borderRadius: 8, backgroundColor: 'transparent',
          border: '1px solid #FF453A', color: '#FF453A', fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}>Delete Contact</button>
      </div>
    </div>
  );
}
