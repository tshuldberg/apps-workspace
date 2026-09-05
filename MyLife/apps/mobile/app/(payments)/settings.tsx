import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from 'lucide-react-native';
import {
  ContactPill,
  DisclosureCallout,
  PaymentGlassCard,
  StatusBadge,
  buildPaymentsSettingsViewModel,
} from '@mylife/payments';
import { colors } from '@mylife/ui';
import { createPaymentsSettingsDemoSnapshot } from './_settingsDemo';

const BackIcon = icons.ChevronLeft;

export default function PaymentsSettingsScreen() {
  const router = useRouter();
  const viewModel = useMemo(
    () => buildPaymentsSettingsViewModel(createPaymentsSettingsDemoSnapshot()),
    [],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <BackIcon size={20} color="#F5FBF8" strokeWidth={2} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{viewModel.title}</Text>
          <Text style={styles.subtitle}>{viewModel.profileHeader.handle}</Text>
        </View>
      </View>

      {viewModel.profileHeader.restrictionDisclosure ? (
        <DisclosureCallout disclosure={viewModel.profileHeader.restrictionDisclosure} />
      ) : null}

      <PaymentGlassCard eyebrow="Profile" title={viewModel.profileHeader.displayName}>
        <View style={styles.badgeRow}>
          <StatusBadge tone="success" label={viewModel.profileHeader.tierLabel} />
          <StatusBadge tone="info" label={viewModel.discoverability.label} />
        </View>
        <Text style={styles.bodyText}>{viewModel.discoverability.helper}</Text>
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Identifiers" title="Verified contact methods">
        <View style={styles.lineStack}>
          {viewModel.identifiers.map((line) => (
            <View key={line.id} style={styles.lineRow}>
              <Text style={styles.lineLabel}>{line.label}</Text>
              <View style={styles.lineCopy}>
                <Text style={styles.lineValue}>{line.value}</Text>
                {line.helper ? <Text style={styles.lineHelper}>{line.helper}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Contacts" title="Favorites">
        <View style={styles.contactStack}>
          {viewModel.contacts.map((contact) => (
            <View key={contact.id} style={styles.contactRow}>
              <ContactPill counterparty={contact} />
              {contact.favorite ? <StatusBadge tone="success" label="Favorite" /> : null}
            </View>
          ))}
        </View>
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Notifications" title="Preferences">
        <View style={styles.lineStack}>
          {viewModel.notifications.map((line) => (
            <View key={line.id} style={styles.lineRow}>
              <Text style={styles.lineLabel}>{line.label}</Text>
              <Text style={styles.lineValue}>{line.value}</Text>
            </View>
          ))}
        </View>
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Limits" title="Product vs compliance">
        <DisclosureCallout disclosure={viewModel.limits.disclosure} />
        <View style={styles.twoCol}>
          <View style={styles.limitCol}>
            <Text style={styles.sectionLabel}>Product</Text>
            {viewModel.limits.product.map((line) => (
              <Text key={line.id} style={styles.limitLine}>
                {line.label}: {line.value}
              </Text>
            ))}
          </View>
          <View style={styles.limitCol}>
            <Text style={styles.sectionLabel}>Compliance</Text>
            {viewModel.limits.compliance.map((line) => (
              <Text key={line.id} style={styles.limitLine}>
                {line.label}: {line.value}
              </Text>
            ))}
          </View>
        </View>
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Fees" title="Current schedule">
        <View style={styles.lineStack}>
          {viewModel.feeSchedule.map((line) => (
            <View key={line.id} style={styles.feeRow}>
              <View style={styles.lineCopy}>
                <Text style={styles.lineLabel}>{line.label}</Text>
                <Text style={styles.lineHelper}>{line.disclosure}</Text>
              </View>
              <Text style={styles.lineValue}>{line.value}</Text>
            </View>
          ))}
        </View>
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Close wallet" title={viewModel.walletClose.canClose ? 'Ready' : 'Blocked'}>
        <Text style={styles.bodyText}>
          {viewModel.walletClose.reason ?? 'Export is ready and the wallet has no pending or available balance.'}
        </Text>
      </PaymentGlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: 18, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  headerText: { flex: 1, gap: 4 },
  title: { color: '#F5FBF8', fontSize: 30, fontWeight: '700' },
  subtitle: { color: 'rgba(245,251,248,0.68)', fontSize: 15, lineHeight: 21 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bodyText: { color: 'rgba(245,251,248,0.70)', fontSize: 14, lineHeight: 20 },
  lineStack: { gap: 12 },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  lineCopy: { flex: 1, gap: 3 },
  lineLabel: { color: 'rgba(245,251,248,0.58)', fontSize: 12, fontWeight: '700' },
  lineValue: { color: '#F5FBF8', fontSize: 14, fontWeight: '700', textAlign: 'right' },
  lineHelper: { color: 'rgba(245,251,248,0.56)', fontSize: 12, lineHeight: 17 },
  contactStack: { gap: 10 },
  contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  twoCol: { flexDirection: 'row', gap: 12 },
  limitCol: {
    flex: 1,
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionLabel: { color: '#BAE6FD', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  limitLine: { color: '#F5FBF8', fontSize: 13, lineHeight: 18 },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
});
