import { StyleSheet, Text, View } from 'react-native';
import type { DirectMessage } from '../../models';
import {
  FR_ACCENT,
  FR_ON_ACCENT,
  FR_SURFACES,
  FR_TEXT,
  FR_TEXT_SECONDARY,
  FR_TYPOGRAPHY,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface MessageBubbleProps {
  message: DirectMessage & {
    attachmentType?: 'text' | 'image' | 'voice';
    voiceDurationLabel?: string;
  };
  isMe: boolean;
  encrypted?: boolean;
}

export function MessageBubble({
  message,
  isMe,
  encrypted = false,
}: MessageBubbleProps) {
  const incoming = !isMe;
  const attachmentLabel = message.attachmentType === 'image'
    ? 'Image attachment'
    : message.attachmentType === 'voice'
      ? `Voice note ${message.voiceDurationLabel ?? ''}`.trim()
      : null;

  return (
    <View style={[styles.host, isMe ? styles.hostMe : styles.hostOther]}>
      <View style={[styles.bubble, isMe ? styles.outgoing : styles.incoming]}>
        <View style={styles.metaRow}>
          {encrypted ? <MaterialSymbol name="lock" size={12} color={incoming ? FR_TEXT_SECONDARY : FR_ON_ACCENT} /> : null}
          {encrypted ? (
            <Text style={[styles.metaText, isMe ? styles.metaOutgoing : styles.metaIncoming]}>Encrypted</Text>
          ) : null}
        </View>
        {message.body ? (
          <Text style={[styles.body, isMe ? styles.bodyOutgoing : styles.bodyIncoming]}>
            {message.body}
          </Text>
        ) : null}
        {attachmentLabel ? (
          <View style={styles.attachmentRow}>
            <MaterialSymbol
              name={message.attachmentType === 'voice' ? 'mic' : 'photo_camera'}
              size={14}
              color={incoming ? FR_TEXT_SECONDARY : FR_ON_ACCENT}
            />
            <Text style={[styles.metaText, isMe ? styles.metaOutgoing : styles.metaIncoming]}>
              {attachmentLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flexDirection: 'row',
    marginTop: 10,
  },
  hostMe: {
    justifyContent: 'flex-end',
  },
  hostOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  outgoing: {
    backgroundColor: FR_ACCENT,
  },
  incoming: {
    backgroundColor: FR_SURFACES.low,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    ...FR_TYPOGRAPHY.labelTight,
  },
  metaIncoming: {
    color: FR_TEXT_SECONDARY,
  },
  metaOutgoing: {
    color: FR_ON_ACCENT,
  },
  body: {
    ...FR_TYPOGRAPHY.bodyMd,
  },
  bodyIncoming: {
    color: FR_TEXT,
  },
  bodyOutgoing: {
    color: FR_ON_ACCENT,
  },
});
