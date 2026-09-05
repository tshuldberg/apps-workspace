import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PublicReader } from '../../../components/PublicReader';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function PublicChannelScreen() {
  const params = useLocalSearchParams<{ publicationId: string; channelId: string }>();
  return (
    <PublicReader
      publicationId={param(params.publicationId)}
      channelId={param(params.channelId)}
    />
  );
}
