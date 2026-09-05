// Source locks for the Set-3 channel/thread/room/files hardening (PROMPT-004),
// web side. Pins: archived read-only enforcement on the web channel surface
// (mobile enforced it from the start; web rendered live composers into archived
// channels), fail-honest async handlers (thrown awaits surface instead of
// vanishing under a finally), the thread delete confirm, real room control
// toggles, and per-action busy on the incoming-requests panel.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const channelDir = join(__dirname, '..', 'channel');
const channelView = readFileSync(join(channelDir, 'ChannelView.tsx'), 'utf8');
const messageList = readFileSync(join(channelDir, 'ChatMessageList.tsx'), 'utf8');
const bubble = readFileSync(join(channelDir, 'ChatMessageBubble.tsx'), 'utf8');
const postsPanel = readFileSync(join(channelDir, 'PostsPanel.tsx'), 'utf8');
const postThread = readFileSync(join(channelDir, 'PostThreadView.tsx'), 'utf8');
const composer = readFileSync(join(channelDir, 'ChatComposer.tsx'), 'utf8');
const fileCard = readFileSync(join(channelDir, 'InChannelFileCard.tsx'), 'utf8');
const requestsPanel = readFileSync(join(channelDir, 'IncomingRequestsPanel.tsx'), 'utf8');
const roomView = readFileSync(join(__dirname, '..', 'call', 'RoomView.tsx'), 'utf8');
const fileActions = readFileSync(join(__dirname, '..', 'files', 'FileActions.tsx'), 'utf8');
const downloads = readFileSync(join(__dirname, '..', 'files', 'DownloadsView.tsx'), 'utf8');
const canvasAssets = readFileSync(join(__dirname, '..', '..', 'lib', 'canvas-assets.ts'), 'utf8');

describe('ChannelView enforces archived read-only (parity with mobile)', () => {
  it('derives the archived flag from the descriptor and shows the locked banner', () => {
    expect(channelView).toContain('channelArchived(channel)');
    expect(channelView).toContain('Archived channel. Content is preserved and read-only here.');
  });

  it('hides the chat composer and the posts composer for an archived channel', () => {
    expect(channelView).toMatch(/\{channelIsArchived \? null : \(\s*\n\s*<ChatComposer/u);
    expect(channelView).toContain('composerHidden={channelIsArchived}');
    expect(postsPanel).toContain('{composerHidden ? null : (');
  });

  it('an archived channel is read-only for reactions, replies, edits, and deletes too', () => {
    // The reaction choke points: chips stay visible, clicks write nothing.
    expect(channelView.match(/if \(channelIsArchived\) return;/gu)?.length).toBe(2);
    // The message list hides every write affordance in read-only mode.
    expect(channelView).toContain('readOnly={channelIsArchived}');
    expect(messageList).toContain('canReact={!readOnly}');
    expect(messageList).toContain("canReply={item.status === 'sent' && !readOnly}");
    expect(messageList).toContain("canEdit={isMine && item.status === 'sent' && !readOnly}");
    expect(messageList).toContain("canDelete={isMine && item.status === 'sent' && !readOnly}");
    expect(bubble).toContain('!pending && !failed && (canReact || canReply)');
    // The posts panel keeps chips visible but drops the add affordance.
    expect(postsPanel).toContain('Archived (read-only) channels keep chips visible but offer no add affordance.');
  });
});

describe('ChannelView history flows fail honest', () => {
  it('a thrown manual import clears busy and renders the failure (it used to strand "Verifying…")', () => {
    expect(channelView).toContain("'Could not verify that manifest.'");
    expect(channelView).toMatch(/\} finally \{\s*\n\s*setManualBusy\(false\);/u);
  });

  it('a thrown automatic lookup renders an honest notice with the manual fallback', () => {
    expect(channelView).toContain('History lookup failed in this browser.');
  });
});

describe('PostThreadView', () => {
  it('delete confirms before recording a deletion (the button used to fire on one click)', () => {
    expect(postThread).toContain("window.confirm('Delete this message?");
  });

  it('an archived channel shows the read-only banner, hides the composer, and drops Reply', () => {
    expect(postThread).toContain('Archived channel. Content is preserved and read-only here.');
    expect(postThread.match(/onReply=\{channelIsArchived \? undefined : setReplyTarget\}/gu)?.length).toBe(2);
    expect(postThread).toMatch(/\{onReply \? \(\s*\n\s*<Button variant="ghost" small onClick=\{\(\) => onReply\(event\)\}/u);
  });

  it('an archived channel is read-only for reactions, edits, and deletes too', () => {
    expect(postThread).toContain('if (channelIsArchived) return;');
    expect(postThread.match(/readOnly=\{channelIsArchived\}/gu)?.length).toBe(2);
    expect(postThread).toContain('{isOwn && !readOnly ? (');
  });
});

describe('RoomView', () => {
  it('a thrown join reaches the honest failed phase instead of stranding "Checking membership..."', () => {
    expect(roomView).toContain("dispatch({ type: 'failed', reason: 'connect_failed' });");
  });

  it('controls toggle off the real local participant state, never hardcode enable', () => {
    expect(roomView).toContain("kind === 'mic' ? !current.micOn");
    expect(roomView).not.toContain('setMic(true)');
    expect(roomView).not.toContain('setCamera(true)');
    expect(roomView).not.toContain('setScreenShare(true)');
  });

  it('a rejected control change surfaces instead of vanishing', () => {
    expect(roomView).toContain('Could not change that. Check the browser permission for this site.');
  });

  it('a room in an archived channel cannot be joined', () => {
    expect(roomView).toContain('archived: descriptorChannel ? channelArchived(descriptorChannel) : false,');
  });
});

describe('File flows surface thrown awaits', () => {
  it('FileActions request-again catches (it used to die under the finally)', () => {
    expect(fileActions).toContain("setFailDetail(err instanceof Error ? err.message : 'Could not send that request.');");
  });

  it('InChannelFileCard: open, save, remove, and request-again all catch', () => {
    expect(fileCard).toContain('A thrown blob read used to die silently');
    expect(fileCard).toContain('a thrown blob read used to strand the button');
    expect(fileCard).toContain("setRemoveFeedback({ removed: false, tone: 'error'");
    expect(fileCard).toContain('window.alert(`Could not request:');
  });

  it('DownloadsView: a thrown blob read becomes a per-file failed outcome, not a lost batch', () => {
    expect(downloads).toContain('caught PER FILE');
    expect(downloads).toContain('A thrown blob read used to die silently');
    expect(downloads).toContain("setFailDetail(err instanceof Error ? err.message : 'Could not send that request.');");
  });
});

describe('IncomingRequestsPanel', () => {
  it('busy is per action so Approve never claims "Working…" during a Decline', () => {
    expect(requestsPanel).toContain("busy: 'approve' | 'decline' | null");
    expect(requestsPanel).toContain("state?.busy === 'approve' ? 'Working…' : 'Approve'");
    expect(requestsPanel).toContain("state?.busy === 'decline' ? 'Working…' : 'Decline'");
  });

  it('a thrown approve/decline renders the failure instead of a stuck row', () => {
    expect(requestsPanel.match(/catch \(err\)/gu)?.length).toBe(2);
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
