import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DMCA_DESIGNATED_AGENT_EMAIL,
  DMCA_REPEAT_INFRINGER_THRESHOLD,
  DMCA_RESPONSE_SLA_HOURS,
} from '@mylife/mynews';
import { tokens } from '../theme/tokens';
import { SecondaryButton } from '../components/Buttons';

/**
 * In-app copyright / DMCA help screen. Publishes the same takedown facts as the
 * web legal page: where to send notices, the response SLA, the notice-and-
 * takedown process, and the repeat-infringer policy. Honest by construction: it
 * states the process and contact, and does NOT claim a registered designated
 * agent (that is a founder-ops registration step).
 */
export default function DmcaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const steps: Array<{ title: string; body: string }> = [
    {
      title: 'A notice arrives',
      body: 'A copyright owner or their agent sends a DMCA notice by email. It must identify the work, the infringing location, and include the good-faith and accuracy statements and a signature.',
    },
    {
      title: 'We review it',
      body: 'Our moderation team reviews the notice against the reported content. Complete, good-faith notices are actioned and the infringing content is retracted.',
    },
    {
      title: 'A strike is recorded',
      body: 'When we remove content for copyright infringement, we record an audited copyright strike against the account that posted it.',
    },
    {
      title: 'Counter-notice',
      body: 'The poster may reply with a counter-notice if they believe the removal was a mistake. We record and review counter-notices; a counter-notice is not a legal ruling.',
    },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>Copyright and DMCA</Text>
      <Text style={styles.body}>
        MyNews respects copyright and responds to notices of claimed infringement under the DMCA.
        This screen explains how to send a notice, how we handle it, and what happens to repeat
        infringers.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Where to send notices</Text>
        <Text style={styles.body}>
          Send DMCA notices to our copyright contact. Include every element the DMCA requires;
          incomplete notices cannot be acted on.
        </Text>
        <Text style={styles.contact}>{DMCA_DESIGNATED_AGENT_EMAIL}</Text>
        <SecondaryButton
          label="Email a notice"
          onPress={() => void Linking.openURL(`mailto:${DMCA_DESIGNATED_AGENT_EMAIL}`)}
        />
        <Text style={styles.meta}>
          We are in the process of registering a designated agent with the U.S. Copyright Office.
          Until that is confirmed, the address above is the point of contact. We do not claim a
          completed registration we have not made.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Our response time</Text>
        <Text style={styles.body}>
          We aim to review properly formed notices within {DMCA_RESPONSE_SLA_HOURS} hours of receipt.
          Complex notices may take longer.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notice and takedown</Text>
        {steps.map((step) => (
          <View key={step.title} style={styles.step}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Was your content removed by mistake?</Text>
        <Text style={styles.body}>
          If your own content was removed for claimed copyright infringement and you believe that
          was a mistake or misidentification, you can submit a DMCA counter-notice from this
          device. It is reviewed by a human and, absent a court action by the claimant,
          restoration is considered after 10 to 14 business days.
        </Text>
        <SecondaryButton
          label="Submit a counter-notice"
          onPress={() => router.push('/(root)/legal/dmca-counter' as never)}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Repeat-infringer policy</Text>
        <Text style={styles.body}>
          MyNews suspends the accounts of repeat infringers. Each time we remove content for
          copyright infringement, we record a strike against the posting account. An account that
          reaches {DMCA_REPEAT_INFRINGER_THRESHOLD} copyright strikes is suspended. Strikes and
          suspensions are recorded in an internal audit trail.
        </Text>
      </View>

      <Text style={styles.footer}>
        This screen describes our process; it is not legal advice. Filing a knowingly false DMCA
        notice may carry liability under 17 U.S.C. 512(f).
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  title: { color: tokens.text, fontSize: 28, fontWeight: '800', marginBottom: 4 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  contact: { color: tokens.accent, fontSize: 16, fontWeight: '700' },
  body: { color: tokens.textSecondary, fontSize: 14, lineHeight: 20 },
  meta: { color: tokens.textTertiary, fontSize: 13, lineHeight: 19 },
  step: {
    borderTopColor: tokens.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 3,
  },
  stepTitle: { color: tokens.text, fontSize: 14, fontWeight: '700' },
  footer: {
    color: tokens.textTertiary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
});
