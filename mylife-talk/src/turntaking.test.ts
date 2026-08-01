import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, type Settings } from './config.js';
import { detectControl, TurnTaking } from './turntaking.js';

function subject(overrides: Partial<Settings> = {}, now: () => number = Date.now): TurnTaking {
  return new TurnTaking({ ...DEFAULT_SETTINGS, ...overrides }, now);
}

describe('detectControl', () => {
  it.each([
    ['SCRATCH THAT!', 'cancel'],
    ['stop listening.', 'mute'],
    ['start listening', 'unmute'],
    ['go ahead!!!', 'send'],
    ['hold on', 'wait'],
    ["what's happening?", 'status'],
    ['read it in full', 'read-full'],
    ['help!', 'help'],
  ] as const)('recognizes %s', (text, expected) => {
    expect(detectControl(text, DEFAULT_SETTINGS)).toBe(expected);
  });

  it('does not match phrases followed by meaningful text', () => {
    expect(detectControl('wait while I explain', DEFAULT_SETTINGS)).toBeNull();
    expect(detectControl('send items to the server', DEFAULT_SETTINGS)).toBeNull();
  });
});

describe('TurnTaking utterance modes', () => {
  it('drops everything while muted except unmute', () => {
    const turnTaking = subject();
    const routes = vi.fn();
    const unmutes = vi.fn();
    turnTaking.on('route', routes);
    turnTaking.on('unmute-ear', unmutes);

    turnTaking.onFinalUtterance('stop listening');
    turnTaking.onFinalUtterance('please run tests');
    turnTaking.onFinalUtterance('cancel that');
    expect(routes).not.toHaveBeenCalled();
    expect(turnTaking.phase).toBe('muted');

    turnTaking.onFinalUtterance('start listening');
    expect(unmutes).toHaveBeenCalledOnce();
    expect(turnTaking.phase).toBe('listening');
  });

  it('routes hands-free utterances and handles controls locally', () => {
    const turnTaking = subject();
    const routes = vi.fn();
    const controls = vi.fn();
    turnTaking.on('route', routes);
    turnTaking.on('control', controls);

    turnTaking.onFinalUtterance('Run the focused tests');
    turnTaking.onFinalUtterance('status report');

    expect(routes).toHaveBeenCalledWith('Run the focused tests');
    expect(controls).toHaveBeenCalledWith('status');
  });

  it('buffers confirm-word utterances until a send word', () => {
    const turnTaking = subject({ turnTaking: 'confirm-word' });
    const routes = vi.fn();
    turnTaking.on('route', routes);

    turnTaking.onFinalUtterance('Run the tests');
    turnTaking.onFinalUtterance('and fix failures');
    expect(routes).not.toHaveBeenCalled();
    turnTaking.onFinalUtterance('send it');

    expect(routes).toHaveBeenCalledWith('Run the tests and fix failures');
  });

  it('cancels and clears a confirm-word buffer', () => {
    const turnTaking = subject({ turnTaking: 'confirm-word' });
    const routes = vi.fn();
    const speaks = vi.fn();
    turnTaking.on('route', routes);
    turnTaking.on('speak', speaks);

    turnTaking.onFinalUtterance('Do not send this');
    turnTaking.onFinalUtterance('never mind');
    turnTaking.onFinalUtterance('send it');

    expect(routes).not.toHaveBeenCalled();
    expect(speaks).toHaveBeenCalledWith('Cancelled.');
  });

  it('routes push-to-talk finals regardless of key state and still cancels', () => {
    // talk-ear only captures audio while the key is held, and its final can
    // arrive after the ptt-up event, so TurnTaking must not gate on key state
    const turnTaking = subject({ turnTaking: 'push-to-talk' });
    const routes = vi.fn();
    const speaks = vi.fn();
    turnTaking.on('route', routes);
    turnTaking.on('speak', speaks);

    turnTaking.onPtt('down');
    turnTaking.onFinalUtterance('inside');
    turnTaking.onPtt('up');
    turnTaking.onFinalUtterance('after key up');
    turnTaking.onFinalUtterance('cancel that');

    expect(routes).toHaveBeenCalledTimes(2);
    expect(routes).toHaveBeenNthCalledWith(1, 'inside');
    expect(routes).toHaveBeenNthCalledWith(2, 'after key up');
    expect(speaks).toHaveBeenCalledWith('Cancelled.');
  });
});

describe('TurnTaking verification', () => {
  it('injects instantly and announces completion', () => {
    const turnTaking = subject({ verification: 'instant' });
    const injected = vi.fn();
    const spoken = vi.fn();
    turnTaking.on('inject', injected);
    turnTaking.on('speak', spoken);

    turnTaking.onBrainPrompt('Run tests');

    expect(injected).toHaveBeenCalledWith('Run tests');
    expect(spoken).toHaveBeenCalledWith('Sent.');
  });

  it('reads back and injects after the grace period', () => {
    let time = 100;
    const turnTaking = subject({ verification: 'read-back', readBackGraceMs: 3000 }, () => time);
    const injected = vi.fn();
    const spoken = vi.fn();
    turnTaking.on('inject', injected);
    turnTaking.on('speak', spoken);

    turnTaking.onBrainPrompt('Run tests');
    expect(spoken).toHaveBeenCalledWith('Sending: Run tests');
    time = 3099;
    turnTaking.tick();
    expect(injected).not.toHaveBeenCalled();
    time = 3100;
    turnTaking.tick();
    expect(injected).toHaveBeenCalledWith('Run tests');
  });

  it('pauses read-back indefinitely until send', () => {
    let time = 0;
    const turnTaking = subject({ verification: 'read-back', readBackGraceMs: 10 }, () => time);
    const injected = vi.fn();
    turnTaking.on('inject', injected);

    turnTaking.onBrainPrompt('Run tests');
    turnTaking.onFinalUtterance('wait');
    time = 1000;
    turnTaking.tick();
    expect(injected).not.toHaveBeenCalled();
    turnTaking.onFinalUtterance('go ahead');
    expect(injected).toHaveBeenCalledWith('Run tests');
  });

  it('cancels a read-back prompt', () => {
    let time = 0;
    const turnTaking = subject({ verification: 'read-back', readBackGraceMs: 10 }, () => time);
    const injected = vi.fn();
    turnTaking.on('inject', injected);

    turnTaking.onBrainPrompt('Run tests');
    turnTaking.onFinalUtterance('scratch that');
    time = 100;
    turnTaking.tick();

    expect(injected).not.toHaveBeenCalled();
  });

  it('requires a send word in explicit mode', () => {
    const turnTaking = subject({ verification: 'explicit' });
    const injected = vi.fn();
    const spoken: string[] = [];
    turnTaking.on('inject', injected);
    turnTaking.on('speak', (text) => spoken.push(text));

    turnTaking.onBrainPrompt('Run tests');
    expect(spoken).toEqual(['Sending: Run tests', 'Say send it when ready.']);
    expect(injected).not.toHaveBeenCalled();
    turnTaking.onFinalUtterance('send it');
    expect(injected).toHaveBeenCalledWith('Run tests');
  });

  it('cancels without injecting in explicit mode', () => {
    const turnTaking = subject({ verification: 'explicit' });
    const injected = vi.fn();
    turnTaking.on('inject', injected);

    turnTaking.onBrainPrompt('Run tests');
    turnTaking.onFinalUtterance('cancel that');
    turnTaking.onFinalUtterance('send it');

    expect(injected).not.toHaveBeenCalled();
  });

  it('keeps a pending prompt while routing a new non-control utterance', () => {
    const turnTaking = subject({ verification: 'explicit' });
    const injected = vi.fn();
    const routed = vi.fn();
    turnTaking.on('inject', injected);
    turnTaking.on('route', routed);

    turnTaking.onBrainPrompt('First prompt');
    turnTaking.onFinalUtterance('Actually make it focused');
    expect(routed).toHaveBeenCalledWith('Actually make it focused');
    turnTaking.onFinalUtterance('send it');
    expect(injected).toHaveBeenCalledWith('First prompt');
  });
});
