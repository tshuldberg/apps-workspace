// SettingsOverlay (slice 5): the Settings modal. Mirrors the native Settings
// screen, omitting native-only sections (LAN, scheduled/background-drain button,
// Android save-folder, alpha diagnostics, friend code). Closes via CLOSE_OVERLAY.

import { useView } from '../navigation/useView';
import { Modal } from '../shell/Modal';
import { IdentitySection } from './IdentitySection';
import { PublicPersonaSection } from './PublicPersonaSection';
import { CapabilityStatusSection } from './CapabilityStatusSection';
import { DeviceLayoutSection } from './DeviceLayoutSection';
import { AppearanceSection } from './AppearanceSection';
import { RelaySection } from './RelaySection';
import { PublicDirectorySection } from './PublicDirectorySection';
import { TransportSection } from './TransportSection';
import { NotificationsSection } from './NotificationsSection';
import { OwnDeviceLinkPanel } from '../messages/OwnDeviceLinkPanel';
import { ShareInboxSection } from './ShareInboxSection';
import { StorageSection } from './StorageSection';
import { AppUnlockSection } from './AppUnlockSection';
import { HostedServicesSection } from './HostedServicesSection';
import { RecoverySection } from './RecoverySection';
import { DangerSection } from './DangerSection';
import { LegalSafetySection } from './LegalSafetySection';

export function SettingsOverlay(): React.ReactElement {
  const { dispatch } = useView();
  return (
    <Modal wide title="Settings" onClose={() => dispatch({ type: 'CLOSE_OVERLAY' })}>
      <div className="mk-settings">
        <details className="mk-settings-group">
          <summary>Appearance</summary>
          <div className="mk-settings-group-content"><AppearanceSection /><DeviceLayoutSection /></div>
        </details>
        <IdentitySection />
        <PublicPersonaSection />
        <RelaySection />
        <PublicDirectorySection />
        <TransportSection />
        <NotificationsSection />
        <OwnDeviceLinkPanel settings />
        <ShareInboxSection />
        <StorageSection />
        <AppUnlockSection />
        <LegalSafetySection />
        <HostedServicesSection />
        <RecoverySection />
        <details className="mk-settings-group">
          <summary>What works today</summary>
          <div className="mk-settings-group-content"><CapabilityStatusSection /></div>
        </details>
        <DangerSection />
      </div>
    </Modal>
  );
}
