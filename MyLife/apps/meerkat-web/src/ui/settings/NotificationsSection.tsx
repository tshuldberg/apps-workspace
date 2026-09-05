// NotificationsSection (Plan 42 P6 / WP-42D): the honest permission UX for Web
// Push. Permission is requested HERE, on an explicit user action, never on load.
// Every state the button and copy show derives from the real capability gate,
// the real Notification.permission, and whether a subscription is registered, so
// nothing claims push is on when it is not (NC-42.5). The closed-page limit is
// stated plainly to the user (AC-42.10).

import { useCallback, useEffect, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import {
  computeWebPushStatus,
  isWebPushConfigured,
  isWebPushSupported,
  type WebPushStatus,
} from '../../lib/web-push-core';
import {
  disableWebPush,
  enableWebPush,
  getWebPushConfig,
  hasStoredRegistration,
  readNotificationPermission,
  type EnablePushResult,
} from '../../lib/web-push-registration';

const STATUS_LABEL: Record<WebPushStatus, string> = {
  unsupported: 'Not supported in this browser',
  not_configured: 'Not available in this build',
  default: 'Off',
  denied: 'Blocked in your browser',
  granted_inactive: 'Allowed, not registered yet',
  active: 'On',
};

const ENABLE_ERROR: Record<Exclude<EnablePushResult, { ok: true }>['reason'], string> = {
  unsupported: 'This browser cannot receive web push.',
  not_configured: 'This build has no push service configured.',
  bad_vapid_key: 'The push service key is misconfigured. Contact the operator.',
  permission_denied: 'You blocked notifications. Re-allow them in your browser settings to turn push on.',
  subscribe_failed: 'The browser could not create a push subscription. Try again.',
  bad_subscription: 'The push subscription was incomplete. Try again.',
  register_failed: 'The push service rejected the registration. Try again later.',
};

export function NotificationsSection(): React.ReactElement {
  const { db } = useMeerkat();
  const [status, setStatus] = useState<WebPushStatus>('default');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const supported = isWebPushSupported();
    const configured = isWebPushConfigured(getWebPushConfig());
    setStatus(
      computeWebPushStatus({
        supported,
        configured,
        permission: readNotificationPermission(),
        hasRegisteredSubscription: hasStoredRegistration(db),
      }),
    );
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onEnable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await enableWebPush(db);
      if (!result.ok) setError(ENABLE_ERROR[result.reason]);
    } catch {
      setError('Notifications could not be turned on. Nothing was changed; try again.');
    } finally {
      setBusy(false);
      refresh();
    }
  }, [db, refresh]);

  const onDisable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await disableWebPush(db);
    } catch {
      // disableWebPush drives the push service and can reject; render honestly.
      setError('Notifications could not be fully turned off. Try again.');
    } finally {
      setBusy(false);
      refresh();
    }
  }, [db, refresh]);

  const canEnable = status === 'default' || status === 'granted_inactive';
  const canDisable = status === 'active';

  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Notifications</h3>
      <p className="mk-muted" style={{ marginTop: 0 }}>
        Status: {STATUS_LABEL[status]}
      </p>

      {canEnable && (
        <Button onClick={() => void onEnable()} disabled={busy}>
          {busy ? 'Turning on…' : 'Turn on notifications'}
        </Button>
      )}
      {canDisable && (
        <Button variant="ghost" onClick={() => void onDisable()} disabled={busy}>
          {busy ? 'Turning off…' : 'Turn off notifications'}
        </Button>
      )}

      {error && (
        <p className="mk-muted" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}

      <HonestNotice>
        Push wakes are opaque: the notification is a generic "new activity" nudge, never message
        text. When Meerkat is fully closed, a wake can only show that nudge and prompt you to open
        the app. The actual catch-up runs on this device when you open Meerkat, not from the
        notification itself. Push works only in browsers that support it, and only while this build
        has a push service configured; it is never always-on.
      </HonestNotice>
    </section>
  );
}
