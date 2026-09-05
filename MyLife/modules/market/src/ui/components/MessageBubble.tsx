import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { Message } from '../../types';
import {
  MK_ACCENT,
  MK_ACCENT_DARK,
  MK_SURFACES,
  MK_TEXT,
  MK_TEXT_SECONDARY,
  MK_TYPOGRAPHY,
} from '../tokens';
import {
  formatMarketPrice,
  formatMessageTimestamp,
  getMessageBubbleKind,
} from '../logic';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';

export type MessageBubbleMessage = Message & {
  bubbleType?: 'text' | 'image' | 'location' | 'offer_card';
  imageUrl?: string;
  locationLabel?: string;
  offerTitle?: string;
  offerPrice?: number;
  offerCurrency?: string;
  readAt?: string | null;
};

export interface MessageBubbleProps {
  message: MessageBubbleMessage;
  isMe: boolean;
  encrypted?: boolean;
}

function BubbleContent({ message }: { message: MessageBubbleMessage }) {
  const kind = getMessageBubbleKind(message);

  switch (kind) {
    case 'image':
      return (
        <Image
          source={{ uri: message.imageUrl }}
          style={styles.imageAttachment}
          contentFit="cover"
        />
      );
    case 'location':
      return (
        <View style={styles.inlineRow}>
          <MaterialSymbol name="location_on" size={16} color={MK_TEXT} />
          <Text style={styles.bodyText}>{message.locationLabel}</Text>
        </View>
      );
    case 'offer_card':
      return (
        <View style={styles.offerCard}>
          <Text style={styles.offerTitle}>
            {message.offerTitle ?? 'Offer attached'}
          </Text>
          <Text style={styles.offerPrice}>
            {formatMarketPrice(
              message.offerPrice ?? 0,
              message.offerCurrency ?? 'USD',
            )}
          </Text>
        </View>
      );
    case 'encrypted':
      return (
        <Text style={styles.bodyText}>
          {message.body ?? 'Encrypted message'}
        </Text>
      );
    default:
      return <Text style={styles.bodyText}>{message.body ?? ''}</Text>;
  }
}

export function MessageBubble({
  message,
  isMe,
  encrypted = false,
}: MessageBubbleProps) {
  const shellStyle = isMe ? styles.outgoingBubble : styles.incomingBubble;
  const content = (
    <View style={styles.bubbleContent}>
      {(encrypted || message.contentType === 'application/e2ee+ciphertext') ? (
        <View style={styles.lockRow}>
          <MaterialSymbol
            name="lock"
            size={12}
            color={isMe ? MK_ACCENT_DARK : MK_TEXT_SECONDARY}
          />
          <Text
            style={[
              styles.metaText,
              { color: isMe ? MK_ACCENT_DARK : MK_TEXT_SECONDARY },
            ]}
          >
            Encrypted
          </Text>
        </View>
      ) : null}

      <BubbleContent message={message} />

      <View style={styles.footerRow}>
        <Text
          style={[
            styles.metaText,
            { color: isMe ? MK_ACCENT_DARK : MK_TEXT_SECONDARY },
          ]}
        >
          {formatMessageTimestamp(message.createdAt)}
        </Text>
        {isMe ? (
          <MaterialSymbol
            name="verified"
            size={12}
            color={message.readAt ? MK_ACCENT_DARK : MK_TEXT_SECONDARY}
            filled={Boolean(message.readAt)}
          />
        ) : null}
      </View>
    </View>
  );

  if (isMe) {
    return <View style={[styles.baseBubble, shellStyle]}>{content}</View>;
  }

  return (
    <GlassCard padding={0} style={[styles.baseBubble, shellStyle]}>
      {content}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  baseBubble: {
    maxWidth: '82%',
    borderRadius: 22,
  },
  incomingBubble: {
    backgroundColor: MK_SURFACES.low,
  },
  outgoingBubble: {
    backgroundColor: MK_ACCENT,
    alignSelf: 'flex-end',
  },
  bubbleContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bodyText: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT,
  },
  metaText: {
    ...MK_TYPOGRAPHY.labelUpper,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  imageAttachment: {
    width: 220,
    height: 160,
    borderRadius: 16,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offerCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    gap: 4,
  },
  offerTitle: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  offerPrice: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT,
    fontWeight: '700',
  },
});
