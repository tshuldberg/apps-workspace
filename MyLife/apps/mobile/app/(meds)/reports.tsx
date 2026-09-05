import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  generateDoctorReport,
  generateTherapyReport,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { ErrorState } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type ReportTemplateKey =
  | 'general'
  | 'diabetes'
  | 'hypertension'
  | 'adherence'
  | 'pain'
  | 'mood'
  | 'visit';

type IncludeSection = 'medications' | 'adherence' | 'measurements' | 'mood' | 'symptoms';

type ReportRecord = {
  id: string;
  template: ReportTemplateKey;
  title: string;
  createdAt: string;
  periodDays: number;
  content: string;
};

const REPORT_HISTORY_KEY = 'meds.report_history';

const TEMPLATE_META: Record<
  ReportTemplateKey,
  {
    label: string;
    description: string;
    icon: string;
    accent: string;
    builder: 'doctor' | 'therapy';
  }
> = {
  general: {
    label: 'General Health Report',
    description: 'Medication, adherence, measurements, mood, and symptoms in one clinical packet.',
    icon: 'description',
    accent: MD_ACCENT_LIGHT,
    builder: 'doctor',
  },
  diabetes: {
    label: 'Diabetes Report',
    description: 'Glucose trends, insulin notes, and adherence details for diabetes follow-ups.',
    icon: 'bloodtype',
    accent: '#8BCFF0',
    builder: 'doctor',
  },
  hypertension: {
    label: 'Hypertension Report',
    description: 'Focus the report on blood pressure and medication stability.',
    icon: 'monitor_heart',
    accent: '#FFB877',
    builder: 'doctor',
  },
  adherence: {
    label: 'Medication Adherence',
    description: 'Center the packet on dose completion, missed doses, and refill consistency.',
    icon: 'event',
    accent: '#FFD60A',
    builder: 'doctor',
  },
  pain: {
    label: 'Pain Diary',
    description: 'Bundle symptoms, tracked pain, and medication notes for pain-management visits.',
    icon: 'healing',
    accent: '#FFB4AB',
    builder: 'doctor',
  },
  mood: {
    label: 'Mood Journal',
    description: 'Therapy-focused export with detailed mood entries and activity context.',
    icon: 'mood',
    accent: '#84CC16',
    builder: 'therapy',
  },
  visit: {
    label: 'Doctor Visit Summary',
    description: 'A concise briefing for the next appointment with the essentials pre-selected.',
    icon: 'assignment',
    accent: MD_ACCENT_LIGHT,
    builder: 'doctor',
  },
};

const PERIOD_OPTIONS = [30, 90, 180, 365];

const SECTION_META: Array<{
  key: IncludeSection;
  label: string;
  description: string;
}> = [
  { key: 'medications', label: 'Medications', description: 'Current meds, dosage, and active status.' },
  { key: 'adherence', label: 'Adherence', description: 'Dose completion and recent compliance.' },
  { key: 'measurements', label: 'Vitals', description: 'Measurements, vitals, glucose, and recorded health data.' },
  { key: 'mood', label: 'Mood', description: 'Mood summaries and detailed therapy logs when relevant.' },
  { key: 'symptoms', label: 'Symptoms', description: 'Symptoms plus correlation highlights.' },
];

function splitMarkdownSections(markdown: string) {
  const match = markdown.match(/\n## /);
  if (!match || match.index === undefined) {
    return { intro: markdown.trim(), sections: [] as Array<{ title: string; body: string }> };
  }

  const intro = markdown.slice(0, match.index).trim();
  const rawSections = markdown.slice(match.index + 1).split('\n## ');
  const sections = rawSections.map((rawSection) => {
    const [heading, ...bodyLines] = rawSection.split('\n');
    return {
      title: heading.trim(),
      body: bodyLines.join('\n').trim(),
    };
  });

  return { intro, sections };
}

function filterReportContent(markdown: string, includes: Record<IncludeSection, boolean>) {
  const { intro, sections } = splitMarkdownSections(markdown);

  const includeTitle = (title: string) => {
    if (title.startsWith('Medications')) return includes.medications;
    if (title.startsWith('Adherence Summary')) return includes.adherence;
    if (title.startsWith('Health Measurements')) return includes.measurements;
    if (title.startsWith('Mood Summary') || title.startsWith('Detailed Mood Log')) return includes.mood;
    if (title.startsWith('Symptom Summary') || title.startsWith('Correlation Highlights')) return includes.symptoms;
    return true;
  };

  return [
    intro,
    ...sections
      .filter((section) => includeTitle(section.title))
      .map((section) => `## ${section.title}\n${section.body}`.trim()),
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function loadHistory(db: ReturnType<typeof useDatabase>): ReportRecord[] {
  const row = db.query<{ value: string }>(
    'SELECT value FROM md_settings WHERE key = ?',
    [REPORT_HISTORY_KEY],
  )[0];
  if (!row?.value) {
    return [];
  }
  try {
    const parsed = JSON.parse(row.value) as ReportRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(db: ReturnType<typeof useDatabase>, history: ReportRecord[]) {
  const updatedAt = new Date().toISOString();
  db.execute(
    `INSERT INTO md_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [REPORT_HISTORY_KEY, JSON.stringify(history.slice(0, 8)), updatedAt],
  );
}

function Pill({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active?: boolean;
  color: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        { backgroundColor: active ? withAlpha(color, 0.18) : MD_SURFACES.high },
      ]}
    >
      <RNText style={[styles.pillText, { color: active ? color : MD_TEXT_SECONDARY }]}>
        {label}
      </RNText>
    </Pressable>
  );
}

export default function ReportsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplateKey>('general');
  const [periodDays, setPeriodDays] = useState(90);
  const [includes, setIncludes] = useState<Record<IncludeSection, boolean>>({
    medications: true,
    adherence: true,
    measurements: true,
    mood: true,
    symptoms: true,
  });
  const [sharingId, setSharingId] = useState<string | null>(null);

  const data = useMemo(() => {
    try {
      const to = new Date().toISOString().slice(0, 10);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - periodDays);
      const from = fromDate.toISOString().slice(0, 10);
      const template = TEMPLATE_META[selectedTemplate];
      const baseReport = template.builder === 'therapy'
        ? generateTherapyReport(db, from, to)
        : generateDoctorReport(db, from, to);
      const header = `# ${template.label}\nPeriod: ${from} to ${to}\n`;
      const preview = filterReportContent(`${header}\n${baseReport}`, includes);
      return {
        error: null,
        from,
        history: loadHistory(db),
        preview,
        template,
        to,
      };
    } catch {
      return {
        error: 'Failed to build the clinical report preview.',
        from: '',
        history: [] as ReportRecord[],
        preview: '',
        template: TEMPLATE_META[selectedTemplate],
        to: '',
      };
    }
  }, [db, includes, periodDays, selectedTemplate, tick]);

  const refresh = () => setTick((value) => value + 1);

  const shareRecord = async (record: ReportRecord) => {
    setSharingId(record.id);
    try {
      const filePath = `${FileSystem.cacheDirectory}${record.id}.md`;
      await FileSystem.writeAsStringAsync(filePath, record.content);
      await Sharing.shareAsync(filePath, {
        dialogTitle: record.title,
        mimeType: 'text/markdown',
      });
    } catch {
      Alert.alert('Unable to share report', 'Please try again.');
    } finally {
      setSharingId(null);
    }
  };

  const generateAndShare = async () => {
    try {
      const record: ReportRecord = {
        id: uuid(),
        template: selectedTemplate,
        title: data.template.label,
        createdAt: new Date().toISOString(),
        periodDays,
        content: data.preview,
      };
      saveHistory(db, [record, ...data.history]);
      await shareRecord(record);
      refresh();
    } catch {
      Alert.alert('Unable to generate report', 'Please try again.');
    }
  };

  if (data.error) {
    return (
      <View style={styles.errorShell}>
        <ErrorState message={data.error} onRetry={refresh} />
      </View>
    );
  }

  const previewLines = data.preview.split('\n').slice(0, 14);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <RNText style={styles.eyebrow}>Archive &amp; Insights</RNText>
          <RNText style={styles.heroTitle}>Clinical Reports</RNText>
          <RNText style={styles.heroBody}>
            Generate a polished visit packet, preview the structure first, then
            share the final report directly from your device.
          </RNText>
        </View>
        <View style={styles.scoreCard}>
          <RNText style={styles.scoreValue}>88</RNText>
          <RNText style={styles.scoreLabel}>Wellness</RNText>
        </View>
      </View>

      <GlassCard padding={20}>
        <SectionHeader title="Template Picker" />
        <View style={styles.templateGrid}>
          {(Object.keys(TEMPLATE_META) as ReportTemplateKey[]).map((key) => {
            const template = TEMPLATE_META[key];
            const active = key === selectedTemplate;
            return (
              <Pressable
                key={key}
                onPress={() => setSelectedTemplate(key)}
                style={[
                  styles.templateCard,
                  active ? { backgroundColor: withAlpha(template.accent, 0.16) } : null,
                ]}
              >
                <View style={[styles.templateIcon, { backgroundColor: withAlpha(template.accent, 0.12) }]}>
                  <MaterialSymbol color={template.accent} name={template.icon} size={20} />
                </View>
                <RNText style={styles.templateTitle}>{template.label}</RNText>
                <RNText style={styles.templateDescription}>{template.description}</RNText>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader title="Report Preview" />
        <View style={styles.controlsStack}>
          <View style={styles.pillRow}>
            {PERIOD_OPTIONS.map((option) => (
              <Pill
                key={option}
                active={periodDays === option}
                color={MD_ACCENT_LIGHT}
                label={`${option} days`}
                onPress={() => setPeriodDays(option)}
              />
            ))}
          </View>

          <View style={styles.checklist}>
            {SECTION_META.map((section) => (
              <Pressable
                key={section.key}
                onPress={() => setIncludes((current) => ({
                  ...current,
                  [section.key]: !current[section.key],
                }))}
                style={styles.checklistRow}
              >
                <View
                  style={[
                    styles.checkIcon,
                    {
                      backgroundColor: includes[section.key]
                        ? withAlpha(MD_ACCENT_LIGHT, 0.18)
                        : MD_SURFACES.high,
                    },
                  ]}
                >
                  <MaterialSymbol
                    color={includes[section.key] ? MD_ACCENT_LIGHT : MD_TEXT_TERTIARY}
                    filled={includes[section.key]}
                    name="check_circle"
                    size={18}
                  />
                </View>
                <View style={styles.checkCopy}>
                  <RNText style={styles.checkTitle}>{section.label}</RNText>
                  <RNText style={styles.checkDescription}>{section.description}</RNText>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewChrome}>
            <RNText style={styles.previewLabel}>{data.template.label}</RNText>
            <RNText style={styles.previewMeta}>
              {data.from} to {data.to}
            </RNText>
          </View>
          <View style={styles.previewSheet}>
            {previewLines.map((line, index) => (
              <RNText
                key={`${line}-${index}`}
                numberOfLines={1}
                style={index === 0 ? styles.previewHeading : styles.previewLine}
              >
                {line || ' '}
              </RNText>
            ))}
          </View>
        </View>

        <Pressable onPress={generateAndShare} style={styles.generateButton}>
          <MaterialSymbol color="#001F2A" name="share" size={20} />
          <RNText style={styles.generateButtonText}>
            {sharingId ? 'Preparing…' : 'Generate and Share'}
          </RNText>
        </Pressable>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader title="Recent Reports" />
        <View style={styles.historyList}>
          {data.history.length === 0 ? (
            <RNText style={styles.emptyCopy}>
              No reports saved yet. Generate your first packet to keep a local
              history for upcoming visits.
            </RNText>
          ) : (
            data.history.map((record) => (
              <View key={record.id} style={styles.historyCard}>
                <View style={styles.historyCopy}>
                  <RNText style={styles.historyTitle}>{record.title}</RNText>
                  <RNText style={styles.historyMeta}>
                    {new Date(record.createdAt).toLocaleString()} • {record.periodDays} days
                  </RNText>
                </View>
                <Pressable onPress={() => shareRecord(record)} style={styles.shareButton}>
                  <MaterialSymbol color={MD_ACCENT_LIGHT} name="share" size={18} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 140,
  },
  errorShell: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  heroRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroTitle: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 40,
    lineHeight: 44,
  },
  heroBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  scoreCard: {
    alignItems: 'flex-end',
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
    borderRadius: 22,
    gap: 2,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  scoreValue: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.bold,
    fontSize: 28,
  },
  scoreLabel: {
    color: MD_TEXT_TERTIARY,
    fontFamily: MD_FONTS.medium,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  templateGrid: {
    gap: 12,
    marginTop: 18,
  },
  templateCard: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 20,
    gap: 10,
    padding: 16,
  },
  templateIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  templateTitle: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 15,
  },
  templateDescription: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  controlsStack: {
    gap: 14,
    marginTop: 18,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
  },
  checklist: {
    gap: 10,
  },
  checklistRow: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  checkIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  checkCopy: {
    flex: 1,
    gap: 2,
  },
  checkTitle: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
  },
  checkDescription: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  previewCard: {
    gap: 12,
    marginTop: 18,
  },
  previewChrome: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLabel: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.bold,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  previewMeta: {
    color: MD_TEXT_TERTIARY,
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
  },
  previewSheet: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 24,
    gap: 8,
    minHeight: 280,
    padding: 18,
  },
  previewHeading: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
  },
  previewLine: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
  },
  generateButton: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 15,
  },
  generateButtonText: {
    color: '#001F2A',
    fontFamily: MD_FONTS.bold,
    fontSize: 14,
  },
  historyList: {
    gap: 10,
    marginTop: 18,
  },
  emptyCopy: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  historyCard: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 14,
  },
  historyCopy: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
  },
  historyMeta: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
  },
  shareButton: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.high,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
});
