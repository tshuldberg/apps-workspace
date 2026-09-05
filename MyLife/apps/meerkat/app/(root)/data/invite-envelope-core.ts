// invite-envelope-core.ts: pure builders for text-message-ready "envelopes"
// around raw Meerkat artifacts (a community invite link, a friend code). A raw
// meerkat:// link or MEER- code sent over iMessage means nothing to a person
// who has never installed Meerkat, so every share surface wraps it in plain
// install + paste instructions. Honesty rules: an envelope never claims
// delivery, presence, or availability; the install step is OMITTED entirely
// when no install URL is configured (never a placeholder link); the friend-code
// envelope names the publish dependency instead of promising the code resolves.
// Byte-identical twin with apps/meerkat-web/src/lib/invite-envelope-core.ts
// below the anchor; check-meerkat-parity locks the two together.

export interface CommunityInviteEnvelopeArgs {
  /** The community's display name from the signed descriptor. */
  communityName: string;
  /** The full meerkat://community/join#... invite link. */
  link: string;
  /** Install/download URL (TestFlight or store). '' omits the install step. */
  installUrl: string;
}

export interface ContactEnvelopeArgs {
  /** The sharer's display name. */
  displayName: string;
  /** The sharer's MEER- friend code (published form when available). */
  friendCode: string;
  /** Install/download URL (TestFlight or store). '' omits the install step. */
  installUrl: string;
}

/** Number a list of instruction lines 1..n. */
function numbered(lines: string[]): string {
  return lines.map((line, i) => `${i + 1}. ${line}`).join('\n');
}

/**
 * A ready-to-text community invite: what it is, how to install, exactly where
 * to paste the link, and the real 48h expiry. The join wording matches the
 * in-app flow ("Join with an invite") so the recipient can follow it verbatim.
 */
export function buildCommunityInviteEnvelope(args: CommunityInviteEnvelopeArgs): string {
  const name = args.communityName.trim();
  const link = args.link.trim();
  const installUrl = args.installUrl.trim();
  const steps: string[] = [];
  if (installUrl) steps.push(`Get Meerkat: ${installUrl}`);
  steps.push('Open Meerkat and finish the quick setup.');
  steps.push('Go to Communities, tap +, choose "Join with an invite", and paste the invite link below.');
  return [
    `You are invited to the private community "${name}" on Meerkat.`,
    '',
    numbered(steps),
    '',
    link,
    '',
    'The invite expires in 48 hours.',
  ].join('\n');
}

/**
 * A ready-to-text contact card: install steps, where to enter the friend code,
 * and an honest line about the publish dependency (a code resolves through the
 * connection server only after its owner publishes it).
 */
export function buildContactEnvelope(args: ContactEnvelopeArgs): string {
  const name = args.displayName.trim();
  const code = args.friendCode.trim();
  const installUrl = args.installUrl.trim();
  const steps: string[] = [];
  if (installUrl) steps.push(`Get Meerkat: ${installUrl}`);
  steps.push('Open Meerkat and finish the quick setup.');
  steps.push('Go to Messages, open "Add friend", and enter the friend code below.');
  return [
    `${name} wants to connect with you on Meerkat, a private messaging app.`,
    '',
    numbered(steps),
    '',
    code,
    '',
    `If the code is not found yet, ask ${name} to open Add friend and publish their code, then try again.`,
  ].join('\n');
}
