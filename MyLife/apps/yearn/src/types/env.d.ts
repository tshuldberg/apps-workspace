declare const process: {
  env: {
    NODE_ENV?: string;
    EXPO_PUBLIC_YEARN_PUBLIC_BETA?: string;
    EXPO_PUBLIC_YEARN_CLOUD_ENV?: string;
    EXPO_PUBLIC_YEARN_ALLOW_STAGING_CLOUD_IN_PUBLIC_BETA?: string;
    EXPO_PUBLIC_YEARN_SUPABASE_URL?: string;
    EXPO_PUBLIC_YEARN_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_YEARN_AUTH_REDIRECT_URL?: string;
    [key: string]: string | undefined;
  };
};
