import { useMeerkat } from '../../lib/MeerkatProvider';
import { getInvitationIntent } from '../../lib/invitation-intent-core';
import { useView } from '../navigation/useView';
import { Modal } from '../shell/Modal';
import { AppUnlockSection } from './AppUnlockSection';
import { IdentitySection } from './IdentitySection';
import { PublicPersonaSection } from './PublicPersonaSection';
import { RecoverySection } from './RecoverySection';
import { DangerSection } from './DangerSection';
import { LegalSafetySection } from './LegalSafetySection';

/**
 * Settings that must remain available before purchase: buy/restore, identity
 * recovery, public-account rights, and deletion. Private transport, storage,
 * community, and hosted-service controls are deliberately absent.
 */
export function LockedSettingsOverlay(): React.ReactElement {
  const { dispatch } = useView();
  const { db } = useMeerkat();
  return (
    <Modal title="Settings" onClose={() => dispatch({ type: 'CLOSE_OVERLAY' })}>
      <div className="mk-settings">
        {getInvitationIntent(db) && <p>An invitation is waiting. After unlock, return to it to preview and confirm joining.</p>}
        <AppUnlockSection />
        <LegalSafetySection />
        <IdentitySection />
        <PublicPersonaSection />
        <RecoverySection />
        <DangerSection />
      </div>
    </Modal>
  );
}
