import { sportsGetOddsApiKeyStatus } from '../actions';
import { SportsFollowTeamCta, SportsPanel } from '../_ui';
import { OddsApiKeyForm } from './OddsApiKeyForm';

export const dynamic = 'force-dynamic';

export default async function SportsSettingsPage() {
  const { hasKey } = await sportsGetOddsApiKeyStatus();
  return (
    <>
      <SportsPanel
        eyebrow="Settings"
        title="You will control what MySports surfaces"
        body="Notifications per team, rival alerts, and privacy defaults will live here. Settings wire up in a later phase."
      >
        <SportsFollowTeamCta />
      </SportsPanel>
      <div id="odds-api" style={{ marginTop: 14 }}>
        <OddsApiKeyForm hasKey={hasKey} />
      </div>
    </>
  );
}
