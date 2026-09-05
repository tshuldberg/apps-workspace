// Source locks for the Set-3 channel/thread/room/files hardening (PROMPT-004).
// Pins: the queued-and-flushed modal shape (overflow menu, actions sheet,
// library picker), fail-honest async handlers (thrown awaits surface instead of
// vanishing under a finally), back fallbacks on deep-linkable screens,
// per-action busy state, the Posts-pane error surface, archived read-only
// enforcement in post threads, and real room control toggles.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '(root)');
const channel = readFileSync(join(root, '(tabs)', 'channel', '[communityId]', '[channelId].tsx'), 'utf8');
const thread = readFileSync(join(root, '(tabs)', 'post', '[communityId]', '[channelId]', '[postId].tsx'), 'utf8');
const room = readFileSync(join(root, '(tabs)', 'room', '[communityId]', '[channelId].tsx'), 'utf8');
const files = readFileSync(join(root, '(tabs)', 'files', '[communityId].tsx'), 'utf8');
const actionsSheet = readFileSync(join(root, 'components', 'chat', 'MessageActionsSheet.tsx'), 'utf8');
const composer = readFileSync(join(root, 'components', 'chat', 'ChatComposer.tsx'), 'utf8');
const attachmentCard = readFileSync(join(root, 'components', 'AttachmentCard.tsx'), 'utf8');
const requestButton = readFileSync(join(root, 'components', 'FileIndexRequestButton.tsx'), 'utf8');
const canvasAssets = readFileSync(join(root, 'data', 'canvas-assets.ts'), 'utf8');
const livekitAdapter = readFileSync(join(root, 'data', 'room-livekit-adapter.ts'), 'utf8');

describe('MessageActionsSheet queues actions across its own dismissal', () => {
  it('run() queues into pendingActionRef and closes; it never fires the action in the close commit', () => {
    expect(actionsSheet).toContain('pendingActionRef.current = fn ?? null;');
    expect(actionsSheet).not.toMatch(/onClose\(\);\s*fn\?\.\(\)/u);
  });

  it('the queue flushes from onDismiss (iOS) and the visibility effect (Android)', () => {
    expect(actionsSheet).toContain('onDismiss={flushPendingAction}');
    expect(actionsSheet).toContain("if (!visible && Platform.OS !== 'ios') flushPendingAction();");
  });

  it('the full-picker emoji tap rides the same queue', () => {
    expect(actionsSheet).toContain('pendingActionRef.current = () => onReact(emoji);');
  });
});

describe('Channel screen', () => {
  it('overflow-menu navigation queues and flushes after the Modal dismissed', () => {
    expect(channel.match(/overflowPendingRef\.current = \(\) => \{/gu)?.length).toBe(2);
    expect(channel).toContain('onDismiss={flushOverflowAction}');
    expect(channel).toContain("if (!overflowOpen && Platform.OS !== 'ios') flushOverflowAction();");
    expect(channel).not.toMatch(/setOverflowOpen\(false\);\s*router\.push/u);
  });

  it('back affordances fall back when the stack has no history', () => {
    expect(channel.match(/onPress=\{goBack\}/gu)?.length).toBe(2);
    expect(channel).toContain('if (router.canGoBack()) router.back();');
    expect(channel).toContain("else router.replace('/communities');");
    expect(channel).not.toContain('onPress={() => router.back()}');
  });

  it('handleGrant catches a thrown grant and keys busy per action', () => {
    expect(channel).toContain('queueFileGrant can throw');
    expect(channel).toContain("setGrantBusy({ id: requestId, decision });");
    expect(channel).toContain("approving ? 'Sending…' : 'Approve'");
    expect(channel).toContain("declining ? 'Declining…' : 'Decline'");
  });

  it('the Posts pane surfaces channel.error (it used to sit hidden in the chat pane)', () => {
    expect(channel).toContain('accessibilityLabel="Clear post error"');
  });

  it('automatic history lookup fails to an honest notice instead of an unhandled rejection', () => {
    expect(channel).toContain('History lookup failed on this device.');
  });

  it('copy renders an honest failure when the clipboard write rejects', () => {
    expect(channel).toContain("Alert.alert('Copy', 'Could not copy the text.')");
    expect(channel).not.toContain('void Clipboard.setStringAsync');
  });

  it('an archived channel offers no Reply action from the sheet', () => {
    expect(channel).toContain('canReply={actionEvent !== null && !channelIsArchived}');
  });

  it('an archived channel is read-only for reactions, edits, and deletes too', () => {
    expect(channel).toContain('canReact={actionEvent !== null && !channelIsArchived}');
    expect(channel).toContain('canEdit={actionEvent !== null && actionIsMine && !channelIsArchived}');
    expect(channel).toContain('canDelete={actionEvent !== null && actionIsMine && !channelIsArchived}');
    // The post quick-react sheet and the post-card add-reaction affordance.
    expect(channel).toContain('canReact={!channelIsArchived}');
    expect(channel).toContain('onQuickReact={channelIsArchived ? undefined : () => setPostReactTarget(post)}');
    // The reaction choke point: chips stay visible, taps write nothing.
    expect(channel).toContain('if (channelIsArchived) return;');
  });
});

describe('Post thread screen', () => {
  it('back affordances fall back to the channel route', () => {
    expect(thread.match(/onPress=\{goBack\}/gu)?.length).toBe(2);
    expect(thread).toContain("router.replace({ pathname: '/channel/[communityId]/[channelId]'");
    expect(thread).not.toContain('onPress={() => router.back()}');
  });

  it('entering an edit stashes the unsent reply and cancel/reply restore it', () => {
    expect(thread).toContain('setStashedDraft((prev) => prev ?? draft);');
    expect(thread.match(/setDraft\(stashedDraft \?\? ''\);/gu)?.length).toBe(2);
  });

  it('an archived channel shows the read-only banner and hides the reply composer', () => {
    expect(thread).toContain('Archived channel. Content is preserved and read-only here.');
    expect(thread).toContain('canReply={!channelIsArchived}');
  });

  it('an archived channel is read-only for reactions, edits, and deletes too', () => {
    expect(thread).toContain('canReact={!channelIsArchived}');
    expect(thread).toContain('canEdit={actionIsMine && !channelIsArchived}');
    expect(thread).toContain('canDelete={actionIsMine && !channelIsArchived}');
    expect(thread).toContain('if (channelIsArchived) return;');
  });

  it('copy renders an honest failure when the clipboard write rejects', () => {
    expect(thread).not.toContain('void Clipboard.setStringAsync');
    expect(thread).toContain("Alert.alert('Copy', 'Could not copy the text.')");
  });
});

describe('Room screen', () => {
  it('a thrown join reaches the honest failed phase instead of stranding "Checking membership..."', () => {
    expect(room).toContain("dispatch({ type: 'failed', reason: 'connect_failed' });");
  });

  it('controls toggle off the real local participant state, never hardcode enable', () => {
    expect(room).toContain("kind === 'mic' ? !current.micOn");
    expect(room).not.toContain('setMic(true)');
    expect(room).not.toContain('setCamera(true)');
    expect(room).not.toContain('setScreenShare(true)');
  });

  it('a rejected control change surfaces instead of vanishing', () => {
    expect(room).toContain('Could not change that. Check the app permission in system settings.');
  });

  it('leave falls back to the channel route when the room is the only route', () => {
    expect(room).toContain('if (router.canGoBack()) router.back();');
    expect(room).toContain("router.replace({ pathname: '/channel/[communityId]/[channelId]'");
  });

  it('the adapter disconnect never rejects into callers', () => {
    expect(livekitAdapter).toContain('catch { /* already closing */ }');
  });

  it('a room in an archived channel cannot be joined', () => {
    expect(room).toContain('archived: descriptorChannel ? channelArchived(descriptorChannel) : false,');
  });
});

describe('Files screen', () => {
  it('the library-picker choice queues and runs only after the Modal dismissed', () => {
    expect(files).toContain('libPendingRef.current = { file: libTarget, channelId: lib.config.channelId };');
    expect(files).toContain('onDismiss={flushLibPending}');
    expect(files).toContain("if (libTarget === null && Platform.OS !== 'ios') flushLibPending();");
  });

  it('both save paths catch a thrown save instead of an idle-looking dead tap', () => {
    expect(files.match(/Alert\.alert\('Could not save'/gu)?.length).toBe(2);
  });

  it('back affordances fall back to the community home', () => {
    expect(files.match(/onPress=\{(?:selectMode \? exitSelect : )?goBack\}/gu)?.length).toBe(2);
    expect(files).not.toContain('router.back()}');
  });

  it('the library-picker rows carry accessibility roles', () => {
    expect(files).toContain('accessibilityLabel={`${LIBRARY_STRINGS.addToLibrary}: ${lib.name}`}');
  });
});

describe('Attachment/file request handlers surface thrown awaits', () => {
  it('AttachmentCard: open, save, remove, and request-again all catch', () => {
    expect(attachmentCard).toContain("Alert.alert('Could not open'");
    expect(attachmentCard).toContain('a thrown blob read used to strand the button');
    expect(attachmentCard).toContain("Alert.alert('Could not remove'");
    expect(attachmentCard).toContain("Alert.alert('Could not request', err instanceof Error");
  });

  it('FileIndexRequestButton renders a failed status when the request throws', () => {
    expect(requestButton).toContain("setDetail(err instanceof Error ? err.message : 'Could not send that request.');");
    expect(requestButton).toContain("setRequestStatus('failed');");
  });
});

describe('Sealed asset resolution fails safe', () => {
  it('every fetchFromStore await catches to null (a thrown fetch killed whole resolve loops)', () => {
    expect(canvasAssets.match(/\} catch \{\n\s*\/\/ A thrown fetch is the same honest outcome/gu)?.length).toBe(3);
  });
});

describe('ChatComposer send latch', () => {
  it('a rejected async submit releases the latch without an unhandled rejection', () => {
    expect(composer).toContain('.finally(() => latchRef.current.release())');
    expect(composer).toContain('.catch(() => undefined);');
  });
});
