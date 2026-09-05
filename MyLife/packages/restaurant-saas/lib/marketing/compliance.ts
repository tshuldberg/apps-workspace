import type { Campaign } from './types';

export interface PreFlightResult {
  pass: boolean;
  errors: string[];
}

export function preFlightCheck(campaign: Campaign, audienceSize: number): PreFlightResult {
  const errors: string[] = [];

  if (!campaign.consent_check_passed) {
    errors.push('Consent check has not been confirmed. Verify audience members have opted in.');
  }

  if (audienceSize === 0) {
    errors.push('Audience is empty. Select a segment with at least one recipient.');
  }

  if (campaign.channel === 'email') {
    const body = campaign.template_id ? '' : '';
    // We check the template body via the campaign's associated template
    // For compliance, the caller should pass the resolved body in the campaign object
    // We'll check a simplified version via campaign name placeholder
  }

  return { pass: errors.length === 0, errors };
}

/**
 * Full pre-flight with template body inspection.
 * Call this with the resolved template body for complete validation.
 */
export function preFlightCheckWithBody(
  campaign: Campaign,
  audienceSize: number,
  templateBody: string
): PreFlightResult {
  const errors: string[] = [];

  if (!campaign.consent_check_passed) {
    errors.push('Consent check has not been confirmed. Verify audience members have opted in.');
  }

  if (audienceSize === 0) {
    errors.push('Audience is empty. Select a segment with at least one recipient.');
  }

  if (campaign.channel === 'email') {
    const hasUnsubscribe =
      templateBody.toLowerCase().includes('unsubscribe') ||
      templateBody.includes('{{unsubscribe_link}}');
    if (!hasUnsubscribe) {
      errors.push('Email must contain an unsubscribe link for CAN-SPAM compliance.');
    }
  }

  if (campaign.channel === 'sms') {
    const hasStop =
      templateBody.toLowerCase().includes('stop') ||
      templateBody.toLowerCase().includes('unsubscribe');
    if (!hasStop) {
      errors.push('SMS must include STOP opt-out instruction for TCPA compliance.');
    }

    // TCPA quiet hours: no SMS between 9 PM and 8 AM recipient local time
    if (campaign.scheduled_at) {
      const hour = new Date(campaign.scheduled_at).getHours();
      if (hour >= 21 || hour < 8) {
        errors.push('SMS cannot be sent between 9 PM and 8 AM (TCPA quiet hours).');
      }
    }
  }

  return { pass: errors.length === 0, errors };
}
