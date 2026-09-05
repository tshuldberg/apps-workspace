import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT,
  DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
  DMCA_COUNTER_SERVICE_ATTESTATION_TEXT,
  dmcaErrorMessage,
} from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { PrimaryButton } from '../components/Buttons';
import { useMyNewsAuth } from '../providers/AuthProvider';
import { getMyNewsCloudConfig } from '../data/launch-environment';
import {
  submitDmcaCounterNotice,
  type DmcaCounterFormFields,
} from '../data/dmca-client';
import { ErrorText } from '../components/ErrorText';

/**
 * In-app DMCA counter-notice form (512(g)(3)). The poster of removed content
 * submits every statutory element here; the submission rides the
 * authenticated path of the mynews-dmca function and is rate-limited per
 * account. Honest states: unconfigured cloud and signed-out sessions get
 * plain copy, success shows the real queue reference, and failures map the
 * server's typed error codes. Nothing is ever simulated.
 */
export default function DmcaCounterScreen() {
  const insets = useSafeAreaInsets();
  const auth = useMyNewsAuth();
  const cloud = useMemo(() => getMyNewsCloudConfig(), []);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [material, setMaterial] = useState('');
  const [location, setLocation] = useState('');
  const [reference, setReference] = useState('');
  const [mistake, setMistake] = useState(false);
  const [perjury, setPerjury] = useState(false);
  const [jurisdiction, setJurisdiction] = useState(false);
  const [service, setService] = useState(false);
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    referenceId: string;
    resolutionStatus: 'resolved' | 'needs-resolution';
  } | null>(null);

  const hasSession = auth.status === 'anonymous' || auth.status === 'linked';

  const submit = useCallback(async () => {
    if (!cloud.ok) return;
    setBusy(true);
    setError(null);
    try {
      const token = await auth.getAccessToken();
      if (!token) {
        setError('Sign in before submitting a counter-notice.');
        return;
      }
      const fields: DmcaCounterFormFields = {
        counterNotifierName: name,
        counterNotifierAddress: address,
        counterNotifierPhone: phone,
        counterNotifierEmail: email,
        removedMaterial: material,
        materialLocationBeforeRemoval: location,
        originalNoticeReference: reference,
        goodFaithMistakeOrMisidentification: mistake,
        statementUnderPenaltyOfPerjury: perjury,
        consentToFederalJurisdiction: jurisdiction,
        acceptanceOfServiceOfProcess: service,
        signature,
      };
      const result = await submitDmcaCounterNotice(cloud.config, token, fields);
      if (result.ok) {
        setDone({ referenceId: result.referenceId, resolutionStatus: result.resolutionStatus });
      } else {
        setError(result.issue ?? dmcaErrorMessage(result.code).message);
      }
    } finally {
      setBusy(false);
    }
  }, [address, auth, cloud, email, jurisdiction, location, material, mistake, name, perjury, phone, reference, service, signature]);

  if (!cloud.ok) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.title}>Counter-notice</Text>
        <Text style={styles.body}>{cloud.reason}</Text>
      </View>
    );
  }

  if (done) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      >
        <Text style={styles.title}>Counter-notice received</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reference</Text>
          <Text style={styles.reference}>{done.referenceId}</Text>
          <Text style={styles.body}>
            {done.resolutionStatus === 'resolved'
              ? 'We matched the URL you gave to specific content. Your counter-notice is queued for review; if the claimant does not file a court action, restoration is considered after 10 to 14 business days.'
              : 'We could not automatically match the URL you gave to specific content, so a human will resolve it. Your counter-notice is queued either way.'}
          </Text>
          <Text style={styles.bodyMuted}>
            Keep this reference. We will contact you at the email you provided.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>Submit a counter-notice</Text>
      <Text style={styles.body}>
        If your content was removed for claimed copyright infringement and you believe that was a
        mistake or misidentification, you can send a DMCA counter-notice. Every field below is
        required by law except the original notice reference.
      </Text>

      {!hasSession ? (
        <View style={styles.card}>
          <Text style={styles.body}>
            Sign in first: counter-notices are tied to your account so we can verify you posted the
            removed content.
          </Text>
        </View>
      ) : null}

      <Field label="Full legal name" value={name} onChange={setName} />
      <Field label="Physical address" value={address} onChange={setAddress} multiline />
      <Field label="Phone number" value={phone} onChange={setPhone} keyboard="phone-pad" />
      <Field label="Email address" value={email} onChange={setEmail} keyboard="email-address" />
      <Field
        label="Identify the removed material"
        value={material}
        onChange={setMaterial}
        multiline
      />
      <Field
        label="Public URL where the material appeared before removal"
        value={location}
        onChange={setLocation}
        placeholder="https://mynews.app/a/article-slug"
        keyboard="url"
      />
      <Field
        label="Original notice reference (optional)"
        value={reference}
        onChange={setReference}
        placeholder="Notice ID from the removal notice, if you have it"
      />

      <Attestation checked={mistake} onToggle={setMistake} text={DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT} />
      <Attestation
        checked={perjury}
        onToggle={setPerjury}
        text="I make the mistake-or-misidentification statement above under penalty of perjury."
      />
      <Attestation
        checked={jurisdiction}
        onToggle={setJurisdiction}
        text={DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT}
      />
      <Attestation checked={service} onToggle={setService} text={DMCA_COUNTER_SERVICE_ATTESTATION_TEXT} />

      <Field
        label="Signature (type your full legal name)"
        value={signature}
        onChange={setSignature}
      />

      {error ? <ErrorText style={styles.error}>{error}</ErrorText> : null}

      <PrimaryButton
        label={busy ? 'Submitting...' : 'Submit counter-notice'}
        onPress={submit}
        disabled={busy || !hasSession}
        loading={busy}
      />

      <Text style={styles.bodyMuted}>
        A counter-notice is a formal legal statement. If the claimant files a court action within
        the waiting period, the content stays down until that action resolves.
      </Text>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboard?: 'default' | 'email-address' | 'phone-pad' | 'url';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, multiline ? styles.inputMultiline : null]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={tokens.textTertiary}
        multiline={multiline}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize={keyboard === 'email-address' || keyboard === 'url' ? 'none' : 'sentences'}
      />
    </View>
  );
}

function Attestation({
  checked,
  onToggle,
  text,
}: {
  checked: boolean;
  onToggle: (next: boolean) => void;
  text: string;
}) {
  return (
    <Pressable
      style={styles.attestation}
      onPress={() => onToggle(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={text}
    >
      <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
        {checked ? (
                      // Decorative: the checked state is announced by the
                      // Pressable role and state, so the glyph does not scale
                      // (it would clip out of its fixed box).
                      <Text style={styles.checkboxMark} allowFontScaling={false}>
                        ✓
                      </Text>
                    ) : null}
      </View>
      <Text style={styles.attestationText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bg },
  centered: { alignItems: 'flex-start', justifyContent: 'center', padding: 24, gap: 8 },
  content: { padding: 20, paddingBottom: 64, gap: 14 },
  title: { color: tokens.text, fontSize: 26, fontWeight: '800' },
  body: { color: tokens.textSecondary, fontSize: 14, lineHeight: 21 },
  bodyMuted: { color: tokens.textTertiary, fontSize: 12, lineHeight: 18 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    gap: 8,
  },
  cardTitle: { color: tokens.text, fontSize: 16, fontWeight: '700' },
  reference: { color: tokens.accent, fontSize: 15, fontWeight: '700' },
  field: { gap: 6 },
  fieldLabel: { color: tokens.text, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: tokens.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    color: tokens.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  attestation: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: tokens.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: tokens.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: tokens.accent, borderColor: tokens.accent },
  checkboxMark: { color: tokens.bg, fontSize: 14, fontWeight: '800' },
  attestationText: { color: tokens.textSecondary, fontSize: 13, lineHeight: 19, flex: 1 },
  error: { color: tokens.danger, fontSize: 13, lineHeight: 19 },
});
