import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  deleteDraft,
  getDraft,
  publishDraft,
  upsertDraft,
  type Draft,
  type NewsroomView,
} from '@mylife/mynews';
import { tokens } from './theme/tokens';
import { useMyNewsAuth } from './providers/AuthProvider';
import { useMyNewsCloud } from './providers/CloudProvider';
import { useMyNewsDb } from './providers/DatabaseProvider';
import { useMyNewsIdentity } from './providers/IdentityProvider';
import { useTermsGate } from './providers/TermsGateProvider';
import { newArticleId, newDraftId } from './lib/ids';
import { publishErrorAction, publishErrorMessage } from './lib/publish-errors';
import { loadSaveTargets, saveToNewsroomFlow } from './lib/newsrooms';
import { ScreenHeader } from './components/ScreenHeader';
import { PrimaryButton, SecondaryButton } from './components/Buttons';
import { ErrorText } from './components/ErrorText';

const AUTOSAVE_MS = 700;

type Kind = 'news' | 'preprint';
type PublishStatus = 'idle' | 'publishing' | 'published';

export default function ComposeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const db = useMyNewsDb();
  const auth = useMyNewsAuth();
  const { isConfigured, port } = useMyNewsCloud();
  const identity = useMyNewsIdentity();
  const { ensureTermsAccepted } = useTermsGate();

  const draftIdRef = useRef<string>('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [headline, setHeadline] = useState('');
  const [dek, setDek] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [kind, setKind] = useState<Kind>('news');
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<'register' | 'keys' | null>(null);
  const [saveTargets, setSaveTargets] = useState<NewsroomView[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingRoomId, setSavingRoomId] = useState<string | null>(null);
  const [savedRoom, setSavedRoom] = useState<NewsroomView | null>(null);

  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  // Newsroom save targets: only shown when a profile exists and the session
  // belongs to at least one newsroom. Load failures leave the action hidden
  // rather than fabricating an empty picker.
  useEffect(() => {
    let cancelled = false;
    if (!port || !hasSession) {
      setSaveTargets([]);
      return;
    }
    loadSaveTargets({ port })
      .then((rooms) => {
        if (!cancelled) setSaveTargets(rooms);
      })
      .catch(() => {
        if (!cancelled) setSaveTargets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [hasSession, port]);

  // Resolve the working draft: load an existing row, or mint a fresh id.
  useEffect(() => {
    if (id && id !== 'new') {
      const existing = getDraft(db, id);
      if (existing) {
        draftIdRef.current = existing.id;
        setHeadline(existing.headline ?? '');
        setDek(existing.dek ?? '');
        setBodyMd(existing.bodyMd);
        setKind(existing.kind);
        setReady(true);
        return;
      }
      draftIdRef.current = id;
    } else {
      draftIdRef.current = newDraftId();
    }
    setReady(true);
  }, [db, id]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Debounced autosave. Skips empty drafts (so backing out of a blank editor
  // leaves no clutter) and stops once the draft has been published + deleted.
  const scheduleSave = useCallback(
    (next: { headline: string; dek: string; bodyMd: string; kind: Kind }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (publishedRef.current) return;
        if (!next.headline.trim() && !next.bodyMd.trim() && !next.dek.trim()) return;
        upsertDraft(
          db,
          {
            id: draftIdRef.current,
            headline: next.headline.trim() ? next.headline : null,
            dek: next.dek.trim() ? next.dek : null,
            bodyMd: next.bodyMd,
            kind: next.kind,
          },
          new Date().toISOString(),
        );
      }, AUTOSAVE_MS);
    },
    [db],
  );

  const onChange = useCallback(
    (patch: Partial<{ headline: string; dek: string; bodyMd: string; kind: Kind }>) => {
      const next = {
        headline: patch.headline ?? headline,
        dek: patch.dek ?? dek,
        bodyMd: patch.bodyMd ?? bodyMd,
        kind: patch.kind ?? kind,
      };
      if (patch.headline !== undefined) setHeadline(patch.headline);
      if (patch.dek !== undefined) setDek(patch.dek);
      if (patch.bodyMd !== undefined) setBodyMd(patch.bodyMd);
      if (patch.kind !== undefined) setKind(patch.kind);
      setError(null);
      setErrorAction(null);
      scheduleSave(next);
    },
    [headline, dek, bodyMd, kind, scheduleSave],
  );

  const handleDelete = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    publishedRef.current = true;
    deleteDraft(db, draftIdRef.current);
    router.back();
  }, [db, router]);

  const handlePublish = useCallback(async () => {
    if (!isConfigured || !port || !identity) return;
    // Terms gate: prompt for acceptance of the current terms before the first
    // write. The server also enforces this; the prompt makes it a clean flow.
    if (!(await ensureTermsAccepted())) return;
    setPublishStatus('publishing');
    setError(null);
    setErrorAction(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const draft: Draft = {
      id: draftIdRef.current,
      headline: headline.trim() ? headline : null,
      dek: dek.trim() ? dek : null,
      bodyMd,
      kind,
      updatedAt: new Date().toISOString(),
    };
    const result = await publishDraft({
      draft,
      articleId: newArticleId(),
      rev: 1,
      identity,
      port,
      nowIso: new Date().toISOString(),
    });
    if (result.ok) {
      publishedRef.current = true;
      deleteDraft(db, draftIdRef.current);
      setPublishStatus('published');
      setTimeout(() => router.replace(`/(root)/article/${result.slug}`), 600);
    } else {
      setError(publishErrorMessage(result.code, result.detail));
      setErrorAction(publishErrorAction(result.code) ?? null);
      setPublishStatus('idle');
    }
  }, [db, identity, isConfigured, port, headline, dek, bodyMd, kind, router, ensureTermsAccepted]);

  const handleSaveToNewsroom = useCallback(
    async (room: NewsroomView) => {
      if (!isConfigured || !port || !identity) return;
      if (!(await ensureTermsAccepted())) return;
      setSavingRoomId(room.id);
      setError(null);
      setErrorAction(null);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const draft: Draft = {
        id: draftIdRef.current,
        headline: headline.trim() ? headline : null,
        dek: dek.trim() ? dek : null,
        bodyMd,
        kind,
        updatedAt: new Date().toISOString(),
      };
      const result = await saveToNewsroomFlow({
        db,
        port,
        identity,
        draft,
        articleId: newArticleId(),
        newsroomId: room.id,
        nowIso: new Date().toISOString(),
      });
      setSavingRoomId(null);
      if (result.ok) {
        publishedRef.current = true;
        setPickerOpen(false);
        setSavedRoom(room);
        setTimeout(
          () => router.replace(`/(root)/newsroom/${encodeURIComponent(room.id)}`),
          600,
        );
      } else {
        setError(result.message);
      }
    },
    [db, dek, headline, identity, isConfigured, kind, bodyMd, port, router, ensureTermsAccepted],
  );

  const disabledReason = ((): string | null => {
    if (!isConfigured) return 'Publishing turns on once a MyNews server is configured for this build.';
    if (!identity) return 'Preparing your signing key on this device...';
    if (!headline.trim() || !bodyMd.trim()) return 'Add a headline and body text to publish.';
    return null;
  })();

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Compose"
        right={
          ready ? (
            <Pressable onPress={handleDelete} hitSlop={10} accessibilityRole="button">
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          ) : null
        }
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.kindToggle}>
            {(['news', 'preprint'] as const).map((option) => (
              <Pressable
                key={option}
                onPress={() => onChange({ kind: option })}
                style={[styles.kindOption, kind === option && styles.kindOptionActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: kind === option }}
              >
                <Text style={[styles.kindText, kind === option && styles.kindTextActive]}>
                  {option === 'news' ? 'News' : 'Preprint'}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            accessibilityLabel="Headline"
            value={headline}
            onChangeText={(text) => onChange({ headline: text })}
            placeholder="Headline"
            placeholderTextColor={tokens.textTertiary}
            style={styles.headlineInput}
            multiline
          />
          <TextInput
            accessibilityLabel="Standfirst, optional"
            value={dek}
            onChangeText={(text) => onChange({ dek: text })}
            placeholder="Standfirst (optional)"
            placeholderTextColor={tokens.textTertiary}
            style={styles.dekInput}
            multiline
          />
          <TextInput
            accessibilityLabel="Article body"
            value={bodyMd}
            onChangeText={(text) => onChange({ bodyMd: text })}
            placeholder="Write your article. Separate paragraphs with a blank line."
            placeholderTextColor={tokens.textTertiary}
            style={styles.bodyInput}
            multiline
            textAlignVertical="top"
          />

          {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}
          {error && errorAction === 'register' ? (
            <SecondaryButton
              label="Register to publish"
              onPress={() =>
                router.push(
                  `/(root)/register?returnTo=${encodeURIComponent(
                    `/(root)/compose?id=${draftIdRef.current}`,
                  )}`,
                )
              }
            />
          ) : null}
          {/* A dead signing key is fixable, but only from Keys and Recovery, so
              the composer routes there instead of leaving the author stuck. */}
          {error && errorAction === 'keys' ? (
            <SecondaryButton
              label="Open Keys and Recovery"
              onPress={() => router.push('/(root)/keys')}
            />
          ) : null}
          {publishStatus === 'published' ? (
            <Text style={styles.success}>Published and signed. Opening your article...</Text>
          ) : null}
          {savedRoom ? (
            <Text style={styles.success}>
              Saved to {savedRoom.name} as a draft. Opening the newsroom...
            </Text>
          ) : null}

          <View style={styles.publishWrap}>
            <PrimaryButton
              label="Publish"
              onPress={() => void handlePublish()}
              disabled={disabledReason !== null || savingRoomId !== null}
              loading={publishStatus === 'publishing'}
            />
            {disabledReason ? <Text style={styles.hint}>{disabledReason}</Text> : (
              <Text style={styles.hint}>
                Publishing signs this revision with your device key. The server records it but cannot
                forge or alter your words.
              </Text>
            )}

            {saveTargets.length > 0 ? (
              <>
                <SecondaryButton
                  label={pickerOpen ? 'Hide newsrooms' : 'Save to newsroom'}
                  onPress={() => setPickerOpen((open) => !open)}
                  disabled={disabledReason !== null || savingRoomId !== null}
                />
                {pickerOpen ? (
                  <View style={styles.roomPicker}>
                    <Text style={styles.hint}>
                      Saving signs this revision and stores it as a draft only this newsroom can
                      see. Publishing stays your explicit act.
                    </Text>
                    {saveTargets.map((room) => (
                      <Pressable
                        key={room.id}
                        onPress={() => void handleSaveToNewsroom(room)}
                        disabled={savingRoomId !== null}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.roomOption, pressed && styles.roomPressed]}
                      >
                        <Text style={styles.roomOptionText} numberOfLines={1}>
                          {savingRoomId === room.id ? `Saving to ${room.name}...` : room.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 14,
  },
  delete: {
    color: tokens.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  kindToggle: {
    flexDirection: 'row',
    backgroundColor: tokens.surface,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  kindOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  kindOptionActive: {
    backgroundColor: tokens.elevated,
  },
  kindText: {
    color: tokens.textTertiary,
    fontSize: 14,
    fontWeight: '600',
  },
  kindTextActive: {
    color: tokens.text,
  },
  headlineInput: {
    color: tokens.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    paddingVertical: 4,
  },
  dekInput: {
    color: tokens.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: 4,
  },
  bodyInput: {
    color: tokens.text,
    fontSize: 16,
    lineHeight: 25,
    minHeight: 260,
    paddingVertical: 4,
  },
  error: {
    color: tokens.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  success: {
    color: tokens.success,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  publishWrap: {
    marginTop: 8,
    gap: 8,
  },
  roomPicker: {
    backgroundColor: tokens.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 10,
    gap: 6,
  },
  roomOption: {
    backgroundColor: tokens.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  roomPressed: {
    opacity: 0.85,
  },
  roomOptionText: {
    color: tokens.text,
    fontSize: 15,
    fontWeight: '600',
  },
  hint: {
    color: tokens.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
