import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import React from 'react';
import {
  AtSign,
  Chrome,
  Heart,
  KeyRound,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AgeGatePanel } from './AgeGatePanel';
import { DiscoverDeck } from './DiscoverDeck';
import { OnboardingWizard } from './OnboardingWizard';
import { RepositoryHarnessPanel } from './RepositoryHarnessPanel';
import {
  YearnLikesSurface,
  YearnMatchesSurface,
  YearnProfileSurface,
} from './YearnSocialSurfaces';
import { buildYearnProfileUpsertInput, type YearnOnboardingDraft } from '../lib/onboarding';
import {
  pickYearnProfilePhoto,
  uploadYearnProfilePhoto,
} from '../lib/photoStorage';
import { yearnSecureStorage } from '../lib/supabase';
import {
  createYearnIntroMessageEncryptor,
  ensureAndPublishYearnE2eeDeviceKey,
} from '../lib/yearnE2ee';
import { YearnRepository } from '../lib/yearnRepository';
import {
  loadPersistedYearnAgeGateBirthdate,
  persistYearnAgeGateBirthdate,
} from '../lib/ageGate';
import { canShowYearnDevSurfaces } from '../lib/launchEnvironment';
import { useYearnCloud } from '../providers/YearnCloudProvider';
import {
  yearnColors,
  yearnRadius,
  yearnSpacing,
  yearnTypography,
} from '../theme/yearnTheme';

type YearnShellTab = 'discover' | 'likes' | 'matches' | 'you';

const activeTabs: Array<{
  id: YearnShellTab;
  label: string;
  icon: typeof Sparkles;
}> = [
  { id: 'discover', label: 'Discover', icon: Sparkles },
  { id: 'likes', label: 'Likes', icon: Heart },
  { id: 'matches', label: 'Matches', icon: MessageCircle },
  { id: 'you', label: 'You', icon: UserRound },
] as const;

export function YearnShell() {
  const cloud = useYearnCloud();
  const betaLabel = cloud.isAuthenticated ? 'Session active' : 'Private beta';
  const showDevSurfaces = canShowYearnDevSurfaces();
  const [activeTab, setActiveTab] = React.useState<YearnShellTab>('discover');
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [authMode, setAuthMode] = React.useState<'email' | 'phone'>('email');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [smsCode, setSmsCode] = React.useState('');
  const [isAgeGateAccepted, setIsAgeGateAccepted] = React.useState(false);
  const [acceptedBirthdate, setAcceptedBirthdate] = React.useState<string | undefined>();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = React.useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = React.useState(false);
  const [isSavingOnboarding, setIsSavingOnboarding] = React.useState(false);
  const [onboardingError, setOnboardingError] = React.useState<string | null>(null);

  const introMessageEncryptor = React.useMemo(() => {
    if (!cloud.supabase || !cloud.userId) return undefined;

    return createYearnIntroMessageEncryptor({
      userId: cloud.userId,
      storage: yearnSecureStorage,
      repository: new YearnRepository(cloud.supabase),
    });
  }, [cloud.supabase, cloud.userId]);

  const handleAppleSignIn = React.useCallback(async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await cloud.signInWithApple();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSigningIn(false);
    }
  }, [cloud]);

  const runAuthAction = React.useCallback(async (action: () => Promise<unknown>) => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await action();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const handleGoogleSignIn = React.useCallback(() => runAuthAction(
    () => cloud.signInWithGoogle(),
  ), [cloud, runAuthAction]);

  const handleEmailLink = React.useCallback(() => runAuthAction(
    () => cloud.requestEmailMagicLink(email),
  ), [cloud, email, runAuthAction]);

  const handlePhoneOtp = React.useCallback(() => runAuthAction(
    () => cloud.requestPhoneOtp(phone),
  ), [cloud, phone, runAuthAction]);

  const handlePhoneVerify = React.useCallback(() => runAuthAction(
    () => cloud.verifyPhoneOtp(phone, smsCode),
  ), [cloud, phone, runAuthAction, smsCode]);

  const handleAgeGateAccepted = React.useCallback((birthdate: string) => {
    setAcceptedBirthdate(birthdate);
    setIsAgeGateAccepted(true);
    void persistYearnAgeGateBirthdate(yearnSecureStorage, birthdate);
  }, []);

  React.useEffect(() => {
    let mounted = true;

    void loadPersistedYearnAgeGateBirthdate(yearnSecureStorage).then((birthdate) => {
      if (!mounted || !birthdate) return;
      setAcceptedBirthdate((current) => current ?? birthdate);
      setIsAgeGateAccepted(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;

    if (!cloud.isAuthenticated || !cloud.supabase || !cloud.userId) {
      setHasCompletedOnboarding(false);
      setIsCheckingProfile(false);
      setOnboardingError(null);
      return () => {
        mounted = false;
      };
    }

    setIsCheckingProfile(true);
    setOnboardingError(null);

    const repository = new YearnRepository(cloud.supabase);
    void repository.fetchMyProfile(cloud.userId)
      .then((profile) => {
        if (!mounted) return;
        setHasCompletedOnboarding(profile !== null);
        if (profile?.birthday) {
          setAcceptedBirthdate(profile.birthday);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setHasCompletedOnboarding(false);
        setOnboardingError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (mounted) setIsCheckingProfile(false);
      });

    return () => {
      mounted = false;
    };
  }, [cloud.isAuthenticated, cloud.supabase, cloud.userId]);

  React.useEffect(() => {
    if (!cloud.isAuthenticated || !cloud.supabase || !cloud.userId) return;

    void ensureAndPublishYearnE2eeDeviceKey({
      userId: cloud.userId,
      storage: yearnSecureStorage,
      repository: new YearnRepository(cloud.supabase),
    }).catch(() => undefined);
  }, [cloud.isAuthenticated, cloud.supabase, cloud.userId]);

  const handleCompleteOnboarding = React.useCallback(async (
    draft: YearnOnboardingDraft,
  ) => {
    if (!cloud.supabase || !cloud.userId) {
      setOnboardingError('Sign in before publishing your profile.');
      return;
    }

    setIsSavingOnboarding(true);
    setOnboardingError(null);

    try {
      const repository = new YearnRepository(cloud.supabase);
      await repository.upsertMyProfile(
        cloud.userId,
        buildYearnProfileUpsertInput(draft),
      );
      setHasCompletedOnboarding(true);
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingOnboarding(false);
    }
  }, [cloud.supabase, cloud.userId]);

  const handleUploadOnboardingPhoto = React.useCallback(async (photoId: string) => {
    if (!cloud.supabase || !cloud.userId) {
      throw new Error('Sign in before uploading profile photos.');
    }

    const picked = await pickYearnProfilePhoto();
    if (!picked) return {};

    const uploaded = await uploadYearnProfilePhoto(cloud.supabase, {
      userId: cloud.userId,
      photoId,
      localUri: picked.uri,
      mimeType: picked.mimeType,
    });

    return {
      path: uploaded.path,
      localUri: picked.uri,
    };
  }, [cloud.supabase, cloud.userId]);

  return (
    <LinearGradient
      colors={[yearnColors.inkwine, yearnColors.inkwineDeep]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.wordmark}>Yearn</Text>
            <Text style={styles.tagline}>Designed to be deleted</Text>
          </View>
          <View style={styles.membershipPill}>
            <ShieldCheck size={14} color={yearnColors.sage} strokeWidth={2.2} />
            <Text style={styles.membershipText}>{betaLabel}</Text>
          </View>
        </View>

        {!isAgeGateAccepted ? (
          <ScrollView
            contentContainerStyle={[styles.content, styles.ageGateContent]}
            showsVerticalScrollIndicator={false}
          >
            <AgeGatePanel onAccepted={handleAgeGateAccepted} />
          </ScrollView>
        ) : !cloud.isReady ? (
          <ScrollView
            contentContainerStyle={[styles.content, styles.ageGateContent]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.statusPanel}>
              <ActivityIndicator color={yearnColors.coral} size="small" />
              <Text style={styles.statusTitle}>Restoring session</Text>
            </View>
          </ScrollView>
        ) : cloud.isAuthenticated && isCheckingProfile ? (
          <ScrollView
            contentContainerStyle={[styles.content, styles.ageGateContent]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.statusPanel}>
              <ActivityIndicator color={yearnColors.coral} size="small" />
              <Text style={styles.statusTitle}>Checking profile</Text>
            </View>
          </ScrollView>
        ) : cloud.isAuthenticated && !hasCompletedOnboarding ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <OnboardingWizard
              initialBirthdate={acceptedBirthdate}
              isSaving={isSavingOnboarding}
              onComplete={handleCompleteOnboarding}
              onUploadPhoto={handleUploadOnboardingPhoto}
              saveError={onboardingError}
            />
          </ScrollView>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {activeTab === 'discover' && (cloud.isAuthenticated || showDevSurfaces) ? (
                <DiscoverDeck
                  allowSampleProfiles={showDevSurfaces}
                  introMessageEncryptor={introMessageEncryptor}
                  isAuthenticated={cloud.isAuthenticated}
                  supabase={cloud.supabase}
                />
              ) : null}

              {activeTab === 'likes' ? (
                <YearnLikesSurface
                  isAuthenticated={cloud.isAuthenticated}
                  supabase={cloud.supabase}
                />
              ) : null}

              {activeTab === 'matches' ? (
                <YearnMatchesSurface
                  isAuthenticated={cloud.isAuthenticated}
                  supabase={cloud.supabase}
                  userId={cloud.userId}
                />
              ) : null}

              {activeTab === 'you' ? (
                <YearnProfileSurface
                  isAuthenticated={cloud.isAuthenticated}
                  onSignOut={cloud.signOut}
                  supabase={cloud.supabase}
                  userId={cloud.userId}
                />
              ) : null}

          {!cloud.isAuthenticated ? (
            <View style={styles.authPanel}>
              <View style={styles.authCopy}>
                <Text style={styles.authTitle}>Private beta sign-in</Text>
                <Text style={styles.authDetail}>
                  Apple creates or restores your Yearn session on this device.
                </Text>
              </View>

              {cloud.isConfigured && cloud.isAppleSignInAvailable ? (
                <View style={styles.appleButtonShell}>
                  <AppleAuthentication.AppleAuthenticationButton
                    accessibilityLabel="Continue with Apple"
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    cornerRadius={8}
                    onPress={handleAppleSignIn}
                    style={styles.appleButton}
                  />
                  {isSigningIn ? (
                    <View style={styles.appleBusyOverlay}>
                      <ActivityIndicator color={yearnColors.inkwine} size="small" />
                    </View>
                  ) : null}
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Apple sign-in unavailable"
                  disabled
                  style={[styles.authFallbackButton, styles.authFallbackDisabled]}
                >
                  <Text style={styles.authFallbackText}>
                    {cloud.isConfigured ? 'Apple sign-in unavailable' : 'Configure Supabase to sign in'}
                  </Text>
                </Pressable>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
                disabled={!cloud.isConfigured || isSigningIn}
                onPress={handleGoogleSignIn}
                style={({ pressed }) => [
                  styles.secondaryAuthButton,
                  (!cloud.isConfigured || isSigningIn) && styles.authFallbackDisabled,
                  pressed && styles.secondaryAuthButtonPressed,
                ]}
              >
                <Chrome size={18} color={yearnColors.vellum} strokeWidth={2.2} />
                <Text style={styles.secondaryAuthButtonText}>Continue with Google</Text>
              </Pressable>

              <View style={styles.authModeRow}>
                {(['email', 'phone'] as const).map((mode) => {
                  const isActive = authMode === mode;
                  const Icon = mode === 'email' ? AtSign : Phone;
                  return (
                    <Pressable
                      key={mode}
                      accessibilityRole="button"
                      accessibilityLabel={mode === 'email' ? 'Use email' : 'Use phone'}
                      onPress={() => setAuthMode(mode)}
                      style={[
                        styles.authModeButton,
                        isActive && styles.authModeButtonActive,
                      ]}
                    >
                      <Icon
                        size={15}
                        color={isActive ? yearnColors.inkwine : yearnColors.textSecondary}
                        strokeWidth={2.2}
                      />
                      <Text style={[
                        styles.authModeText,
                        isActive && styles.authModeTextActive,
                      ]}>
                        {mode === 'email' ? 'Email' : 'Phone'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {authMode === 'email' ? (
                <View style={styles.authForm}>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    inputMode="email"
                    keyboardType="email-address"
                    onChangeText={setEmail}
                    placeholder="name@example.com"
                    placeholderTextColor={yearnColors.textTertiary}
                    style={styles.authInput}
                    value={email}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send magic link"
                    disabled={!cloud.isConfigured || isSigningIn}
                    onPress={handleEmailLink}
                    style={({ pressed }) => [
                      styles.formButton,
                      pressed && styles.formButtonPressed,
                      (!cloud.isConfigured || isSigningIn) && styles.authFallbackDisabled,
                    ]}
                  >
                    <AtSign size={17} color={yearnColors.inkwine} strokeWidth={2.4} />
                    <Text style={styles.formButtonText}>Send link</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.authForm}>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    inputMode="tel"
                    keyboardType="phone-pad"
                    onChangeText={setPhone}
                    placeholder="+14155552671"
                    placeholderTextColor={yearnColors.textTertiary}
                    style={styles.authInput}
                    value={phone}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send SMS code"
                    disabled={!cloud.isConfigured || isSigningIn}
                    onPress={handlePhoneOtp}
                    style={({ pressed }) => [
                      styles.formButton,
                      pressed && styles.formButtonPressed,
                      (!cloud.isConfigured || isSigningIn) && styles.authFallbackDisabled,
                    ]}
                  >
                    <Phone size={17} color={yearnColors.inkwine} strokeWidth={2.4} />
                    <Text style={styles.formButtonText}>Send code</Text>
                  </Pressable>
                  <View style={styles.smsVerifyRow}>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      inputMode="numeric"
                      keyboardType="number-pad"
                      maxLength={6}
                      onChangeText={setSmsCode}
                      placeholder="000000"
                      placeholderTextColor={yearnColors.textTertiary}
                      style={[styles.authInput, styles.smsInput]}
                      value={smsCode}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Verify SMS code"
                      disabled={!cloud.isConfigured || isSigningIn}
                      onPress={handlePhoneVerify}
                      style={({ pressed }) => [
                        styles.verifyButton,
                        pressed && styles.formButtonPressed,
                        (!cloud.isConfigured || isSigningIn) && styles.authFallbackDisabled,
                      ]}
                    >
                      <KeyRound size={17} color={yearnColors.inkwine} strokeWidth={2.4} />
                    </Pressable>
                  </View>
                </View>
              )}

              {cloud.authLinkMessage ? (
                <Text style={styles.authStatus}>{cloud.authLinkMessage}</Text>
              ) : null}

              {authError ? (
                <Text style={styles.authError}>{authError}</Text>
              ) : null}
            </View>
          ) : null}

              {showDevSurfaces ? <RepositoryHarnessPanel /> : null}
            </ScrollView>

            <View style={styles.tabs}>
              {activeTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <Pressable
                    key={tab.label}
                    accessibilityRole="button"
                    accessibilityLabel={tab.label}
                    onPress={() => setActiveTab(tab.id)}
                    style={styles.tab}
                  >
                    <Icon
                      size={20}
                      color={isActive ? yearnColors.coral : yearnColors.textTertiary}
                      strokeWidth={2.2}
                    />
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: yearnSpacing.xl,
    paddingTop: yearnSpacing.lg,
  },
  wordmark: {
    color: yearnColors.vellum,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: 0,
  },
  tagline: {
    color: yearnColors.textSecondary,
    fontSize: 13,
    marginTop: 1,
  },
  membershipPill: {
    alignItems: 'center',
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  membershipText: {
    color: yearnColors.vellum,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    gap: yearnSpacing.xl,
    padding: yearnSpacing.xl,
    paddingBottom: 118,
  },
  ageGateContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  statusPanel: {
    alignItems: 'center',
    backgroundColor: yearnColors.surface,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.md,
    padding: yearnSpacing.xl,
  },
  statusTitle: {
    color: yearnColors.vellum,
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: yearnColors.surface,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  photo: {
    aspectRatio: 0.82,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  photoInitial: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 14, 20, 0.28)',
    borderColor: 'rgba(245, 230, 216, 0.18)',
    borderRadius: 82,
    borderWidth: 1,
    height: 164,
    justifyContent: 'center',
    position: 'absolute',
    top: '30%',
    width: 164,
  },
  photoInitialText: {
    color: yearnColors.vellum,
    fontSize: 78,
    fontWeight: '500',
  },
  cardIdentity: {
    padding: yearnSpacing.xl,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: yearnSpacing.sm,
  },
  name: {
    color: yearnColors.vellum,
    ...yearnTypography.display,
  },
  meta: {
    color: yearnColors.textSecondary,
    fontSize: 15,
    marginTop: 2,
  },
  profileBody: {
    gap: yearnSpacing.md,
    padding: yearnSpacing.xl,
  },
  locationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  locationText: {
    color: yearnColors.textSecondary,
    fontSize: 13,
  },
  occupation: {
    color: yearnColors.vellum,
    fontSize: 16,
    fontWeight: '600',
  },
  intent: {
    color: yearnColors.sage,
    fontSize: 14,
  },
  promptBlock: {
    backgroundColor: yearnColors.surfaceSoft,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.xs,
    padding: yearnSpacing.lg,
  },
  promptQuestion: {
    color: yearnColors.gold,
    ...yearnTypography.label,
    textTransform: 'uppercase',
  },
  promptAnswer: {
    color: yearnColors.vellum,
    ...yearnTypography.body,
  },
  interestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: yearnSpacing.sm,
  },
  interestPill: {
    backgroundColor: 'rgba(232, 133, 107, 0.12)',
    borderColor: 'rgba(232, 133, 107, 0.26)',
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  interestText: {
    color: yearnColors.vellum,
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: yearnSpacing.md,
    justifyContent: 'center',
  },
  authPanel: {
    backgroundColor: yearnColors.surface,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    gap: yearnSpacing.md,
    padding: yearnSpacing.lg,
  },
  authCopy: {
    gap: 4,
  },
  authTitle: {
    color: yearnColors.vellum,
    fontSize: 16,
    fontWeight: '700',
  },
  authDetail: {
    color: yearnColors.textSecondary,
    ...yearnTypography.body,
  },
  appleButtonShell: {
    minHeight: 48,
    position: 'relative',
  },
  appleButton: {
    height: 48,
    width: '100%',
  },
  appleBusyOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 230, 216, 0.64)',
    borderRadius: yearnRadius.sm,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  authFallbackButton: {
    alignItems: 'center',
    borderRadius: yearnRadius.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  authFallbackDisabled: {
    backgroundColor: 'rgba(245, 230, 216, 0.12)',
  },
  authFallbackText: {
    color: yearnColors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryAuthButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 230, 216, 0.08)',
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  secondaryAuthButtonPressed: {
    backgroundColor: 'rgba(245, 230, 216, 0.14)',
  },
  secondaryAuthButtonText: {
    color: yearnColors.vellum,
    fontSize: 14,
    fontWeight: '700',
  },
  authModeRow: {
    backgroundColor: 'rgba(245, 230, 216, 0.06)',
    borderRadius: yearnRadius.sm,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  authModeButton: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 36,
  },
  authModeButtonActive: {
    backgroundColor: yearnColors.coral,
  },
  authModeText: {
    color: yearnColors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  authModeTextActive: {
    color: yearnColors.inkwine,
  },
  authForm: {
    gap: yearnSpacing.sm,
  },
  authInput: {
    backgroundColor: 'rgba(245, 230, 216, 0.08)',
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    color: yearnColors.vellum,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  formButton: {
    alignItems: 'center',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.sm,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  formButtonPressed: {
    backgroundColor: yearnColors.coralPressed,
  },
  formButtonText: {
    color: yearnColors.inkwine,
    fontSize: 14,
    fontWeight: '700',
  },
  smsVerifyRow: {
    flexDirection: 'row',
    gap: yearnSpacing.sm,
  },
  smsInput: {
    flex: 1,
    textAlign: 'center',
  },
  verifyButton: {
    alignItems: 'center',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.sm,
    justifyContent: 'center',
    width: 52,
  },
  authStatus: {
    color: yearnColors.sage,
    fontSize: 12,
    lineHeight: 17,
  },
  authError: {
    color: yearnColors.alarm,
    fontSize: 12,
    lineHeight: 17,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(245, 230, 216, 0.06)',
    borderRadius: 30,
    borderWidth: 1,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  tabs: {
    alignItems: 'center',
    backgroundColor: 'rgba(42, 24, 32, 0.96)',
    borderColor: yearnColors.line,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    left: 0,
    paddingBottom: 22,
    paddingHorizontal: yearnSpacing.md,
    paddingTop: yearnSpacing.md,
    position: 'absolute',
    right: 0,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  tabLabel: {
    color: yearnColors.textTertiary,
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: yearnColors.coral,
  },
});
