import type { ModuleDefinition } from '@mylife/module-registry';
import { ALL_TABLES, CREATE_INDEXES, V2_TABLES, CREATE_V2_INDEXES } from './db/schema';

export const VOICE_MODULE: ModuleDefinition = {
  id: 'voice',
  name: 'MyVoice',
  tagline: 'Private on-device dictation',
  icon: '\uD83C\uDF99\uFE0F',
  accentColor: '#EF4444',
  tier: 'free',
  storageType: 'sqlite',
  schemaVersion: 2,
  tablePrefix: 'vc_',
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    entityRules: [
      {
        tableName: 'transcriptions',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'voice_notes',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
    ],
  },
  migrations: [
    {
      version: 1,
      description: 'Create voice tables: transcriptions, voice notes, settings',
      up: [...ALL_TABLES, ...CREATE_INDEXES],
      down: [
        'DROP TABLE IF EXISTS vc_settings',
        'DROP TABLE IF EXISTS vc_voice_notes',
        'DROP TABLE IF EXISTS vc_transcriptions',
      ],
    },
    {
      version: 2,
      description: 'Add speaker identification, custom voice commands, and multi-language transcription',
      up: [...V2_TABLES, ...CREATE_V2_INDEXES],
      down: [
        'DROP TABLE IF EXISTS vc_language_profiles',
        'DROP TABLE IF EXISTS vc_language_segments',
        'DROP TABLE IF EXISTS vc_command_log',
        'DROP TABLE IF EXISTS vc_commands',
        'DROP TABLE IF EXISTS vc_speaker_segments',
        'DROP TABLE IF EXISTS vc_speakers',
      ],
    },
  ],
  navigation: {
    tabs: [
      { key: 'dictate', label: 'Dictate', icon: 'mic' },
      { key: 'history', label: 'History', icon: 'clock' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'transcription-detail', title: 'Transcription' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.2.0',
};
