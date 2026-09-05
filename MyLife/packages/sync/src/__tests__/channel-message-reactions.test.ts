import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '../identity/device-identity';
import {
  createChannelMessage,
  createChannelMessageV2,
  isSingleEmojiGrapheme,
  verifyChannelMessage,
  type ChannelMessageEvent,
} from '../protocol/channel-message';

const author = generateDeviceIdentity('Reactor');
const hlc = { wall: '2026-07-03T00:00:00.000Z', counter: 0 };

const ZWJ = '‍';
const VS16 = '️';
const KEYCAP = '⃣';

describe('isSingleEmojiGrapheme (T0.1, Hermes/V8/Node deterministic)', () => {
  it('accepts a bare emoji code point', () => {
    expect(isSingleEmojiGrapheme('\u{1F44D}')).toBe(true); // 👍
  });

  it('accepts a VS16 presentation emoji (in the locked quick set)', () => {
    expect(isSingleEmojiGrapheme(`❤${VS16}`)).toBe(true); // ❤️
  });

  it('accepts a skin-tone modifier sequence', () => {
    expect(isSingleEmojiGrapheme('\u{1F44D}\u{1F3FD}')).toBe(true); // 👍🏽
  });

  it('accepts a ZWJ family sequence', () => {
    // 👨‍👩‍👧‍👦
    const family = ['\u{1F468}', '\u{1F469}', '\u{1F467}', '\u{1F466}'].join(ZWJ);
    expect(isSingleEmojiGrapheme(family)).toBe(true);
  });

  it('accepts a regional-indicator flag pair', () => {
    expect(isSingleEmojiGrapheme('\u{1F1FA}\u{1F1F8}')).toBe(true); // 🇺🇸
  });

  it('accepts a keycap sequence', () => {
    expect(isSingleEmojiGrapheme(`1${VS16}${KEYCAP}`)).toBe(true); // 1️⃣
  });

  it('rejects a two-emoji string', () => {
    expect(isSingleEmojiGrapheme('\u{1F44D}\u{1F44D}')).toBe(false);
  });

  it('rejects a plain letter', () => {
    expect(isSingleEmojiGrapheme('a')).toBe(false);
  });

  it('rejects the empty string', () => {
    expect(isSingleEmojiGrapheme('')).toBe(false);
  });

  it('rejects an oversized (but structurally valid) sequence past the byte cap', () => {
    // A 5-person ZWJ chain is well-formed grammar but exceeds the 28-byte UTF-8
    // cap, so the hard cap (not the structure) rejects it.
    const fivePersonChain = [
      '\u{1F468}',
      '\u{1F469}',
      '\u{1F467}',
      '\u{1F466}',
      '\u{1F466}',
    ].join(ZWJ);
    expect(isSingleEmojiGrapheme(fivePersonChain)).toBe(false);
  });

  it('rejects a lone regional indicator, a lone VS16, and a lone ZWJ', () => {
    expect(isSingleEmojiGrapheme('\u{1F1FA}')).toBe(false);
    expect(isSingleEmojiGrapheme(VS16)).toBe(false);
    expect(isSingleEmojiGrapheme(ZWJ)).toBe(false);
  });
});

function reactionEvent(
  overrides: Partial<Parameters<typeof createChannelMessageV2>[1]> = {},
): ChannelMessageEvent {
  return createChannelMessageV2(author, {
    communityId: 'c1',
    channelId: 'general',
    body: `❤${VS16}`,
    hlc,
    parentId: 'target-event-id',
    intent: 'react',
    authorKind: 'human',
    ...overrides,
  });
}

describe('verifyChannelMessage react shape (T0.2, fail-closed)', () => {
  it('accepts a well-formed react (single emoji + parentId, no attachments)', () => {
    expect(verifyChannelMessage(reactionEvent())).toBe(true);
  });

  it('rejects a react whose body is not a single emoji grapheme', () => {
    expect(verifyChannelMessage(reactionEvent({ body: 'nope' }))).toBe(false);
    expect(verifyChannelMessage(reactionEvent({ body: '\u{1F44D}\u{1F44D}' }))).toBe(false);
  });

  it('rejects a react missing parentId', () => {
    expect(verifyChannelMessage(reactionEvent({ parentId: undefined }))).toBe(false);
  });

  it('rejects a react carrying attachments', () => {
    const withAttachment = reactionEvent({
      attachments: [{
        id: 'a1',
        blobHash: 'a'.repeat(128),
        name: 'x.png',
        mimeType: 'image/png',
        size: 1,
      }],
    });
    expect(verifyChannelMessage(withAttachment)).toBe(false);
  });

  it('accepts an un-react tombstone (empty body allowed when deleted)', () => {
    const tombstone = reactionEvent({
      body: '',
      supersedes: { id: 'my-prior-react-id', deleted: true },
    });
    expect(verifyChannelMessage(tombstone)).toBe(true);
  });

  it('still rejects a v1 event that smuggles the react intent', () => {
    const v1 = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: `❤${VS16}`,
      hlc,
    });
    const smuggled: ChannelMessageEvent = { ...v1, intent: 'react', parentId: 'x' };
    expect(verifyChannelMessage(smuggled)).toBe(false);
  });
});
