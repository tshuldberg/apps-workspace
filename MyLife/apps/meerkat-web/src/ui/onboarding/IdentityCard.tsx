import { useMemo, useState } from 'react';
import { normalizeFriendCodeInput } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { CopyRow } from '../shell/CopyRow';
import { Button } from '../shell/Button';
import { TextField } from '../shell/Field';
import { HonestNotice } from '../shell/HonestNotice';
import { IdentityInfoModal } from './IdentityInfoModal';

// IdentityCard: the node's identity, led by the chosen NAME (the hero). The
// cryptographic fingerprint is demoted to a small "safety code" used only for
// friend-to-friend verification. The friend code (new on web) lets a friend
// connect; the user can type their own vanity word and Meerkat adds a random
// suffix via @mylife/sync. No fabrication: a name is never proof of identity.

// The smallest vanity Meerkat will accept before appending the random suffix.
const VANITY_MIN = 4;

export function IdentityCard(): React.ReactElement {
  const {
    displayName,
    fingerprint,
    identity,
    friendCode,
    friendCodeIsCustom,
    setCustomFriendCode,
    regenerateFriendCode,
  } = useMeerkat();
  const [infoOpen, setInfoOpen] = useState(false);
  const [vanity, setVanity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const normalizedVanity = useMemo(() => normalizeFriendCodeInput(vanity), [vanity]);
  const vanityValid = normalizedVanity.length >= VANITY_MIN;

  const makeOwn = (): void => {
    const result = setCustomFriendCode(vanity);
    if (result) {
      setError(result);
      return;
    }
    setError(null);
    setVanity('');
  };

  return (
    <div className="mk-card">
      <div className="mk-identity-head">
        <div>
          <div className="mk-label">Your name</div>
          <div className="mk-identity-name">{displayName}</div>
        </div>
        <button
          type="button"
          className="mk-info-btn"
          aria-label="About your identity"
          title="About your identity"
          onClick={() => setInfoOpen(true)}
        >
          i
        </button>
      </div>

      <div className="mk-label" style={{ marginTop: 16 }}>
        Your friend code{friendCodeIsCustom ? ' (custom)' : ''}
      </div>
      <CopyRow value={friendCode} label="Copy" />
      <div className="mk-identity-friend-actions">
        <TextField
          label="Make your own"
          value={vanity}
          placeholder="Type a word"
          maxLength={20}
          onChange={(e) => {
            setVanity(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && vanityValid) makeOwn();
          }}
        />
        <Button small onClick={makeOwn} disabled={!vanityValid}>
          Use it
        </Button>
        <Button small variant="ghost" onClick={regenerateFriendCode}>
          Regenerate
        </Button>
      </div>
      {vanity.length > 0 && (
        <p className="mk-muted" style={{ margin: '4px 0 0' }}>
          {vanityValid
            ? `Meerkat keeps ${normalizedVanity} and adds random characters on the end so nobody can guess it.`
            : `Use at least ${VANITY_MIN} letters or numbers.`}
        </p>
      )}
      {error && (
        <div className="mk-box is-error" role="alert" style={{ marginTop: 4 }}>
          {error}
        </div>
      )}
      <HonestNotice>
        Anyone who has your friend code can ask to connect, so share it only with people you
        trust. A custom code is easier to remember, which also makes it a little easier to guess,
        so the random characters Meerkat adds keep it safe.
      </HonestNotice>

      <div className="mk-label" style={{ marginTop: 16 }}>
        Safety code
      </div>
      <CopyRow value={fingerprint} label="Copy" />
      <p className="mk-muted" style={{ margin: '4px 0 0' }}>
        Friends can compare this to be 100% sure it is really you.
      </p>

      <div className="mk-label" style={{ marginTop: 12 }}>
        Public key
      </div>
      <CopyRow value={identity.publicKey} label="Copy key" />

      {infoOpen && <IdentityInfoModal onClose={() => setInfoOpen(false)} />}
    </div>
  );
}
