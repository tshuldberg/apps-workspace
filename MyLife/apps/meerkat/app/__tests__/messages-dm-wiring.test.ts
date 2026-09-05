// Source locks for the Set-4 messages/DM/calls/friends hardening (PROMPT-005).
// Pins: the queued-and-flushed modal shape (person sheet, new-group sheet, DM
// overflow menu, group-info leave), fail-honest async handlers (thrown awaits
// surface instead of vanishing under a finally or a bare void), startCall
// result-union handling through the shared startCallFailureCopy map, back
// fallbacks on deep-linkable screens, the archived-channel gate on the share
// intake picker, and the mobile Leave-group parity with web.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '(root)');
const messages = readFileSync(join(root, '(tabs)', 'messages.tsx'), 'utf8');
const dmThread = readFileSync(join(root, '(tabs)', 'dm', '[conversationId].tsx'), 'utf8');
const calls = readFileSync(join(root, '(tabs)', 'calls.tsx'), 'utf8');
const call = readFileSync(join(root, '(tabs)', 'call.tsx'), 'utf8');
const addFriend = readFileSync(join(root, '(tabs)', 'add-friend.tsx'), 'utf8');
const addInPerson = readFileSync(join(root, '(tabs)', 'add-in-person.tsx'), 'utf8');
const shareInbox = readFileSync(join(root, 'share-inbox', 'index.tsx'), 'utf8');
const ownDeviceCard = readFileSync(join(root, 'components', 'OwnDeviceLinkCard.tsx'), 'utf8');

describe('Messages screen queues person-sheet actions across the Modal dismissal', () => {
  it('the person sheet Modal flushes a pending action from onDismiss and the non-iOS effect', () => {
    expect(messages).toContain('onDismiss={flushPersonPending}');
    expect(messages).toContain("if (selected === null && Platform.OS !== 'ios') flushPersonPending();");
  });

  it('Message and both call buttons queue instead of acting in the close commit', () => {
    expect(messages.match(/personPendingRef\.current = \(\) => \{/gu)?.length).toBe(2);
    expect(messages).not.toMatch(/setSelectedDeviceId\(null\);\s*bump\(\);\s*openConversation/u);
    expect(messages).not.toMatch(/closeSheet\(\);\s*void \(async/u);
  });

  it('the sheet keeps rendering the last row during dismissal', () => {
    expect(messages).toContain('const displaySelected = selected ?? lastSelectedRef.current;');
    expect(messages).toContain('row={displaySelected}');
  });

  it('a failed startCall renders the shared honest copy and a thrown start is caught', () => {
    expect(messages).toContain("Alert.alert('Could not start the call', startCallFailureCopy(result.reason, 'app'))");
    expect(messages).toContain("startCallFailureCopy('unknown', 'app')");
  });

  it('group create is guarded, caught, and queued through the sheet dismissal', () => {
    expect(messages).toContain('groupCreateInFlightRef');
    expect(messages).toContain("Alert.alert('Could not create the group', 'Nothing was created. Try again.')");
    expect(messages).toContain('onDismiss={flushPendingCreate}');
    expect(messages).toContain("if (!visible && Platform.OS !== 'ios') flushPendingCreate();");
    expect(messages).toContain('pendingCreateRef.current = () => onCreate(pickedTitle, pickedIds);');
  });

  it('the new-group sheet resets its picks per open', () => {
    expect(messages).toContain('setSelectedIds([]);');
  });
});

describe('DM thread', () => {
  it('overflow actions queue and flush after the Modal dismissed', () => {
    expect(dmThread).toContain('onDismiss={flushOverflowPending}');
    expect(dmThread).toContain("if (!overflowOpen && Platform.OS !== 'ios') flushOverflowPending();");
    expect(dmThread.match(/overflowPendingRef\.current = \(\) =>/gu)?.length).toBe(3);
    expect(dmThread).not.toMatch(/setOverflowOpen\(false\);\s*setGroupInfoOpen\(true\)/u);
    expect(dmThread).not.toMatch(/setOverflowOpen\(false\);\s*Alert\.alert/u);
  });

  it('copy failures surface instead of vanishing', () => {
    expect(dmThread).toContain("Alert.alert('Copy', 'Could not copy the text.')");
    expect(dmThread).not.toContain('void Clipboard.setStringAsync');
  });

  it('a thrown delete-for-everyone surfaces and still refreshes', () => {
    expect(dmThread).toContain("Alert.alert('Could not delete', 'The delete did not complete on this device. Try again.')");
  });

  it('back affordances fall back to /messages when the stack has no history', () => {
    expect(dmThread).toContain("else router.replace('/messages');");
    expect(dmThread.match(/onPress=\{goBack\}/gu)?.length).toBe(2);
    expect(dmThread).not.toContain('onPress={() => router.back()}');
  });

  it('a failed startCall renders the shared honest copy and a thrown start is caught', () => {
    expect(dmThread).toContain("Alert.alert('Could not start the call', startCallFailureCopy(result.reason, 'app'))");
    expect(dmThread).toContain("startCallFailureCopy('unknown', 'app')");
  });

  it('group membership mutations catch a thrown provider call', () => {
    expect(dmThread).toContain("Alert.alert('Could not add member', 'The change did not complete on this device. Nothing was changed.')");
    expect(dmThread).toContain("Alert.alert('Could not remove member', 'The change did not complete on this device. Nothing was changed.')");
  });

  it('Leave group exists (web parity), archives locally, and queues navigation through the sheet dismissal', () => {
    expect(dmThread).toContain('Leave this group on this device?');
    expect(dmThread).toContain('setDmConversationArchived(db, conversationId, true);');
    expect(dmThread).toContain('pendingRef.current = onLeft;');
    expect(dmThread).toContain('onDismiss={flushPending}');
  });

  it('DM attachments catch the presence probe, open, and save paths', () => {
    expect(dmThread).toContain('setCheckFailed(true)');
    expect(dmThread).toContain('Could not check this device for the file.');
    expect(dmThread).toContain("Alert.alert('Could not open', 'This attachment could not be opened on this device.')");
    expect(dmThread).toContain("Alert.alert('Could not save', 'This attachment could not be saved on this device.')");
  });
});

describe('Calls history screen', () => {
  it('call-back handles the startCall result union instead of dropping it', () => {
    expect(calls).toContain("Alert.alert('Could not start the call', startCallFailureCopy(result.reason, 'app'))");
    expect(calls).toContain("startCallFailureCopy('unknown', 'app')");
    expect(calls).not.toContain('void startCall(row.peerDeviceId, row.kind);');
  });

  it('back falls back to /messages', () => {
    expect(calls).toContain("if (router.canGoBack()) router.back(); else router.replace('/messages');");
  });
});

describe('Active call screen', () => {
  it('back and Done fall back to /calls', () => {
    expect(call).toContain("else router.replace('/calls');");
    expect(call.match(/onPress=\{goBack\}/gu)?.length).toBe(2);
    expect(call).not.toContain('onPress={() => router.back()}');
  });

  it('Report confirms, records once, and shows honest feedback', () => {
    expect(call).toContain("'Report this call?'");
    expect(call).toContain("{reported ? 'Reported on this device' : 'Report'}");
    expect(call).toContain('if (reported) return;');
  });
});

describe('Add friend screen', () => {
  it('publish and add run the relay re-probe inside the busy window with an honest failure note', () => {
    expect(addFriend.match(/No connection server answered just now\./gu)?.length).toBe(2);
    expect(addFriend.match(/finally \{\s*setBusy\(null\);\s*\}/gu)?.length).toBe(2);
  });

  it('copy and share failures surface', () => {
    expect(addFriend).toContain("setNote({ kind: 'error', text: 'Could not copy the code.' });");
    expect(addFriend).toContain("setNote({ kind: 'error', text: 'Could not open the share sheet.' });");
  });

  it('back falls back to /messages', () => {
    expect(addFriend).toContain("if (router.canGoBack()) router.back(); else router.replace('/messages');");
  });
});

describe('Add in person screen', () => {
  it('the best-effort announce cannot reject unhandled', () => {
    expect(addInPerson).toContain('announceRef.current(peer.bundle.deviceId).catch(() => undefined);');
    expect(addInPerson).not.toContain('void announceRef.current');
  });

  it('every back affordance falls back to this mode entry screen', () => {
    expect(addInPerson).toContain("else router.replace(mode === 'device' ? '/sync' : '/add-friend');");
    expect(addInPerson.match(/onPress=\{goBack\}/gu)?.length).toBe(3);
    expect(addInPerson).not.toContain('onPress={() => router.back()}');
  });
});

describe('Share inbox destination picker', () => {
  it('archived channels are never offered as send targets', () => {
    expect(shareInbox).toContain('channelArchived');
    expect(shareInbox).toContain('.filter((channel) => !channelArchived(channel))');
  });
});

describe('Own devices card', () => {
  it('link, unlink, and approve catch a thrown provider call (unlink busy always clears)', () => {
    expect(ownDeviceCard).toContain('must not strand the row on "Removing…"');
    expect(ownDeviceCard).toContain('Could not link ${candidate.displayName}. Nothing was changed.');
    expect(ownDeviceCard).toContain("setNotice('That removal could not be approved, so nothing changed.');");
    expect(ownDeviceCard.match(/\} finally \{/gu)?.length).toBeGreaterThanOrEqual(4);
  });
});
