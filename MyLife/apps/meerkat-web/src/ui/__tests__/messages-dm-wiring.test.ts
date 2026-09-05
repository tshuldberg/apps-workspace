// Source locks for the Set-4 messages/DM/calls hardening (PROMPT-005), web
// surface. Pins: startCall result-union handling through the shared
// startCallFailureCopy map, fail-honest async handlers (group create/membership,
// delete-for-everyone, clipboard, attachment probe/download, own-device link),
// the group-create re-entry guard, the call-report feedback, and the
// archived-channel gate on the share intake picker.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ui = join(__dirname, '..');
const messagesView = readFileSync(join(ui, 'messages', 'MessagesView.tsx'), 'utf8');
const dmThread = readFileSync(join(ui, 'messages', 'DmThreadPane.tsx'), 'utf8');
const groupInfo = readFileSync(join(ui, 'messages', 'DmGroupInfoPane.tsx'), 'utf8');
const callHistory = readFileSync(join(ui, 'call', 'CallHistoryView.tsx'), 'utf8');
const callOverlay = readFileSync(join(ui, 'call', 'CallOverlay.tsx'), 'utf8');
const ownDevicePanel = readFileSync(join(ui, 'messages', 'OwnDeviceLinkPanel.tsx'), 'utf8');
const shareInbox = readFileSync(join(ui, 'inbox', 'ShareInbox.tsx'), 'utf8');

describe('MessagesView', () => {
  it('person-sheet calls handle the startCall result union with the shared copy', () => {
    expect(messagesView).toContain("setNote(startCallFailureCopy(result.reason, 'browser'))");
    expect(messagesView).toContain("startCallFailureCopy('unknown', 'browser')");
    expect(messagesView).not.toContain('void startCall(');
  });

  it('group create is guarded, busy-labelled, and surfaces a failure in the pane', () => {
    expect(messagesView).toContain('createInFlightRef');
    expect(messagesView).toContain("return 'Could not create the group. Nothing was created.';");
    expect(messagesView).toContain("{creating ? 'Creating…' :");
    expect(messagesView).toContain('if (failure) setError(failure);');
  });
});

describe('DmThreadPane', () => {
  it('header calls handle the startCall result union with the shared copy', () => {
    expect(dmThread).toContain("setNote(startCallFailureCopy(result.reason, 'browser'))");
    expect(dmThread).toContain("startCallFailureCopy('unknown', 'browser')");
    expect(dmThread).not.toContain('void startCall(');
  });

  it('a thrown delete-for-everyone surfaces and still refreshes', () => {
    expect(dmThread).toContain("setNote('Could not delete. The delete did not complete in this browser. Try again.');");
  });

  it('copy failures surface instead of vanishing', () => {
    expect(dmThread).toContain("setNote('Could not copy the text.')");
    expect(dmThread).not.toContain('void navigator.clipboard');
  });

  it('the attachment card catches the presence probe and the download path', () => {
    expect(dmThread).toContain('setCheckFailed(true)');
    expect(dmThread).toContain('Could not check this browser for the file.');
    expect(dmThread).toContain("setDownloadError('This attachment could not be downloaded in this browser.');");
    expect(dmThread).toContain("setDownloadError('This browser has the file reference, but not the file bytes yet.');");
  });
});

describe('DmGroupInfoPane', () => {
  it('membership mutations catch a thrown provider call and busy always clears', () => {
    expect(groupInfo).toContain("setNote('Could not add that member. The change did not complete in this browser; nothing was changed.');");
    expect(groupInfo).toContain("setNote('Could not remove that member. The change did not complete in this browser; nothing was changed.');");
    expect(groupInfo.match(/\} finally \{\s*setBusy\(false\);/gu)?.length).toBe(2);
  });
});

describe('CallHistoryView', () => {
  it('call-back handles the startCall result union and renders the failure', () => {
    expect(callHistory).toContain("setNote(startCallFailureCopy(result.reason, 'browser'))");
    expect(callHistory).toContain("startCallFailureCopy('unknown', 'browser')");
    expect(callHistory).not.toContain('void startCall(row.peerDeviceId, row.kind);');
    expect(callHistory).toContain('mk-box is-error');
  });
});

describe('CallOverlay', () => {
  it('Report confirms, records once per call, and shows honest feedback', () => {
    expect(callOverlay).toContain("window.confirm('Report this call?");
    expect(callOverlay).toContain("{reportedCallId === state.callId ? 'Reported on this device' : 'Report'}");
    expect(callOverlay).toContain('disabled={reportedCallId === state.callId}');
  });
});

describe('OwnDeviceLinkPanel', () => {
  it('link, unlink, and approve catch a thrown provider call (unlink busy always clears)', () => {
    expect(ownDevicePanel).toContain('must not strand the row on "Removing…"');
    expect(ownDevicePanel).toContain('Could not link ${candidate.displayName}. Nothing was changed.');
    expect(ownDevicePanel).toContain("setNotice('That removal could not be approved, so nothing changed.');");
    expect(ownDevicePanel).toContain('} finally {');
  });
});

describe('ShareInbox destination picker', () => {
  it('archived channels are never offered as send targets and a stale target self-repairs', () => {
    expect(shareInbox).toContain('.filter((ch) => !channelArchived(ch))');
    expect(shareInbox).toContain(".find((ch) => !channelArchived(ch))?.id ?? ''");
    expect(shareInbox).toContain('if (channelId && channels.some((ch) => ch.id === channelId)) return;');
  });
});
