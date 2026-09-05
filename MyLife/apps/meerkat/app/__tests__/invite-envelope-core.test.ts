// Share envelopes: pure builders wrapping a community invite link / friend code
// in install + paste instructions. Node-only, no React harness. The web twin
// test mirrors this file; check-meerkat-parity byte-locks the core itself.

import { describe, it, expect } from 'vitest';
import {
  buildCommunityInviteEnvelope,
  buildContactEnvelope,
} from '../(root)/data/invite-envelope-core';

const LINK = 'meerkat://community/join#abc123';
const CODE = 'MEER-AAAA-BBBB-CCCC';
const INSTALL = 'https://testflight.apple.com/join/XYZ';

describe('buildCommunityInviteEnvelope', () => {
  it('includes install, setup, and join steps numbered 1..3 when an install URL is configured', () => {
    const msg = buildCommunityInviteEnvelope({ communityName: 'Fort Kickass', link: LINK, installUrl: INSTALL });
    expect(msg).toContain(`1. Get Meerkat: ${INSTALL}`);
    expect(msg).toContain('2. Open Meerkat and finish the quick setup.');
    expect(msg).toContain('3. Go to Communities, tap +, choose "Join with an invite", and paste the invite link below.');
  });

  it('OMITS the install step entirely (renumbering to 1..2) when no install URL is configured', () => {
    const msg = buildCommunityInviteEnvelope({ communityName: 'Fort Kickass', link: LINK, installUrl: '' });
    expect(msg).not.toContain('Get Meerkat');
    expect(msg).not.toContain('undefined');
    expect(msg).toContain('1. Open Meerkat and finish the quick setup.');
    expect(msg).toContain('2. Go to Communities, tap +, choose "Join with an invite", and paste the invite link below.');
  });

  it('carries the community name, the raw link on its own line, and the real 48h expiry', () => {
    const msg = buildCommunityInviteEnvelope({ communityName: 'Fort Kickass', link: LINK, installUrl: INSTALL });
    expect(msg).toContain('"Fort Kickass"');
    expect(msg.split('\n')).toContain(LINK);
    expect(msg).toContain('The invite expires in 48 hours.');
  });

  it('uses the exact in-app join wording so the recipient can follow it verbatim', () => {
    const msg = buildCommunityInviteEnvelope({ communityName: 'x', link: LINK, installUrl: '' });
    expect(msg).toContain('"Join with an invite"');
  });

  it('trims whitespace on every input', () => {
    const msg = buildCommunityInviteEnvelope({
      communityName: '  Fort Kickass  ',
      link: `  ${LINK}  `,
      installUrl: '   ',
    });
    expect(msg).toContain('"Fort Kickass"');
    expect(msg.split('\n')).toContain(LINK);
    expect(msg).not.toContain('Get Meerkat');
  });
});

describe('buildContactEnvelope', () => {
  it('includes install, setup, and add-friend steps numbered 1..3 when an install URL is configured', () => {
    const msg = buildContactEnvelope({ displayName: 'Trey', friendCode: CODE, installUrl: INSTALL });
    expect(msg).toContain(`1. Get Meerkat: ${INSTALL}`);
    expect(msg).toContain('2. Open Meerkat and finish the quick setup.');
    expect(msg).toContain('3. Go to Messages, open "Add friend", and enter the friend code below.');
  });

  it('OMITS the install step entirely when no install URL is configured', () => {
    const msg = buildContactEnvelope({ displayName: 'Trey', friendCode: CODE, installUrl: '' });
    expect(msg).not.toContain('Get Meerkat');
    expect(msg).toContain('1. Open Meerkat and finish the quick setup.');
    expect(msg).toContain('2. Go to Messages, open "Add friend", and enter the friend code below.');
  });

  it('names the sharer, carries the raw code on its own line, and states the publish dependency honestly', () => {
    const msg = buildContactEnvelope({ displayName: 'Trey', friendCode: CODE, installUrl: INSTALL });
    expect(msg).toContain('Trey wants to connect with you on Meerkat');
    expect(msg.split('\n')).toContain(CODE);
    expect(msg).toContain('ask Trey to open Add friend and publish their code');
  });

  it('never claims delivery, presence, or that the code is guaranteed to resolve', () => {
    const msg = buildContactEnvelope({ displayName: 'Trey', friendCode: CODE, installUrl: INSTALL });
    expect(msg.toLowerCase()).not.toContain('online');
    expect(msg.toLowerCase()).not.toContain('instantly');
    expect(msg.toLowerCase()).not.toContain('delivered');
  });
});
