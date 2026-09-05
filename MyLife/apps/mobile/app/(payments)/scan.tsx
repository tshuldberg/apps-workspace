import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { icons } from 'lucide-react-native';
import {
  DisclosureCallout,
  PaymentGlassCard,
  buildPaymentsMerchantQrPayload,
} from '@mylife/payments';
import { colors } from '@mylife/ui';

const BackIcon = icons.ChevronLeft;
const QrIcon = icons.QrCode;

export default function PaymentsScanScreen() {
  const router = useRouter();
  const merchantPayload = useMemo(
    () => buildPaymentsMerchantQrPayload({
      mode: 'merchant',
      payeeWalletId: 'merchant_westside_market',
      amountCents: 3280,
      currency: 'USD',
      expiresAt: '2026-04-24T16:05:00.000Z',
      nonce: 'mobile-demo-qr-001',
    }),
    [],
  );
  const peerPayload = useMemo(
    () => buildPaymentsMerchantQrPayload({
      mode: 'peer_receive',
      payeeWalletId: 'wallet_sender',
      amountCents: null,
      currency: 'USD',
      expiresAt: '2026-04-24T18:00:00.000Z',
      nonce: 'mobile-demo-peer-qr-001',
    }),
    [],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <BackIcon size={20} color="#F5FBF8" strokeWidth={2} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>QR pay</Text>
          <Text style={styles.subtitle}>Merchant scan and personal receive payloads stay distinct</Text>
        </View>
      </View>

      <PaymentGlassCard eyebrow="Merchant" title="Scan-to-pay payload">
        <View style={styles.qrPreview}>
          <QrIcon size={54} color="#BAE6FD" strokeWidth={1.8} />
          <Text style={styles.qrText}>{merchantPayload.mode}</Text>
          <Text style={styles.qrMeta}>{merchantPayload.fingerprint.slice(0, 48)}</Text>
        </View>
      </PaymentGlassCard>

      <PaymentGlassCard eyebrow="Receive" title="Personal QR">
        <View style={styles.qrPreview}>
          <QrIcon size={54} color="#A7F3D0" strokeWidth={1.8} />
          <Text style={styles.qrText}>{peerPayload.mode}</Text>
          <Text style={styles.qrMeta}>{peerPayload.fingerprint.slice(0, 48)}</Text>
        </View>
      </PaymentGlassCard>

      <DisclosureCallout
        disclosure={{
          id: 'qr_payload_versioned',
          tone: 'info',
          title: 'Versioned and fingerprinted',
          body: 'QR payloads include a version, expiry, nonce, and anti-tamper fingerprint before the send engine handles money movement.',
        }}
      />
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
  qrPreview: {
    minHeight: 150,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
  },
  qrText: { color: '#F5FBF8', fontSize: 16, fontWeight: '800' },
  qrMeta: { color: 'rgba(245,251,248,0.58)', fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
