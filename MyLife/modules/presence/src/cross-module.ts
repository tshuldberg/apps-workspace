import type { AppIntention } from './types';

export interface PresenceCrossModuleInterface {
  onAppOpen: (intention: AppIntention) => {
    route: '/(presence)/breathing-pause' | '/(presence)/intention-prompt';
    params: Record<string, string>;
  };
  onAppSessionEnd: (openId: string, appId: string, appName?: string | null) => {
    route: '/(presence)/reflection';
    params: Record<string, string>;
  };
}

const presenceCrossModule: PresenceCrossModuleInterface = {
  onAppOpen(intention) {
    if (intention.breathing_pause === 1) {
      return {
        route: '/(presence)/breathing-pause',
        params: {
          appId: intention.app_id,
          appName: intention.app_name,
        },
      };
    }

    return {
      route: '/(presence)/intention-prompt',
      params: {
        appId: intention.app_id,
        appName: intention.app_name,
      },
    };
  },
  onAppSessionEnd(openId, appId, appName) {
    return {
      route: '/(presence)/reflection',
      params: {
        openId,
        appId,
        appName: appName ?? '',
      },
    };
  },
};

export function getPresenceCrossModule(): PresenceCrossModuleInterface {
  return presenceCrossModule;
}
