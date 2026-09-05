import type { DatabaseAdapter } from '@mylife/db';

/**
 * Generate a Markdown report for doctor visits.
 */
export function generateDoctorReport(
  db: DatabaseAdapter,
  from: string,
  to: string,
): string {
  const lines: string[] = [];

  lines.push(`# Health Report: ${from} to ${to}`);
  lines.push(`Generated: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');

  // Medication list
  lines.push('## Medications');
  const meds = db.query<{
    name: string; dosage: string; frequency: string; created_at: string; is_active: number;
  }>('SELECT name, dosage, frequency, created_at, is_active FROM md_medications ORDER BY is_active DESC, name ASC LIMIT 200');

  if (meds.length === 0) {
    lines.push('No medications recorded.');
  } else {
    lines.push('| Medication | Dosage | Frequency | Started | Status |');
    lines.push('|------------|--------|-----------|---------|--------|');
    for (const med of meds) {
      const status = med.is_active ? 'Active' : 'Inactive';
      lines.push(`| ${med.name} | ${med.dosage ?? '-'} | ${med.frequency} | ${med.created_at.slice(0, 10)} | ${status} |`);
    }
  }
  lines.push('');

  // Adherence summary
  lines.push('## Adherence Summary');
  const doseStats = db.query<{ total: number; taken: number }>(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken
     FROM md_dose_logs WHERE scheduled_time >= ? AND scheduled_time <= ?`,
    [from, to],
  );
  const rate = doseStats[0].total > 0
    ? Math.round((doseStats[0].taken / doseStats[0].total) * 100)
    : 100;
  lines.push(`Overall adherence: **${rate}%** (${doseStats[0].taken}/${doseStats[0].total} doses taken)`);
  lines.push('');

  // Health measurements
  lines.push('## Health Measurements');
  const measurements = db.query<{ type: string; value: string; unit: string; measured_at: string }>(
    `SELECT type, value, unit, measured_at FROM md_measurements
     WHERE measured_at >= ? AND measured_at <= ?
     ORDER BY measured_at DESC LIMIT 20`,
    [from, to],
  );
  if (measurements.length === 0) {
    lines.push('No measurements recorded in this period.');
  } else {
    lines.push('| Date | Type | Value | Unit |');
    lines.push('|------|------|-------|------|');
    for (const m of measurements) {
      lines.push(`| ${m.measured_at.slice(0, 10)} | ${m.type} | ${m.value} | ${m.unit} |`);
    }
  }
  lines.push('');

  // Mood summary
  lines.push('## Mood Summary');
  const moodEntries = db.query<{ pleasantness: string; mood: string }>(
    `SELECT pleasantness, mood FROM md_mood_entries
     WHERE recorded_at >= ? AND recorded_at <= ?`,
    [from, to],
  );
  if (moodEntries.length === 0) {
    lines.push('No mood entries recorded in this period.');
  } else {
    const pleasant = moodEntries.filter((m) => m.pleasantness === 'pleasant').length;
    const unpleasant = moodEntries.filter((m) => m.pleasantness === 'unpleasant').length;
    const neutral = moodEntries.length - pleasant - unpleasant;
    lines.push(`Total entries: ${moodEntries.length}`);
    lines.push(`- Pleasant: ${pleasant} (${Math.round((pleasant / moodEntries.length) * 100)}%)`);
    lines.push(`- Unpleasant: ${unpleasant} (${Math.round((unpleasant / moodEntries.length) * 100)}%)`);
    lines.push(`- Neutral: ${neutral} (${Math.round((neutral / moodEntries.length) * 100)}%)`);

    // Most common moods
    const moodCounts = new Map<string, number>();
    for (const entry of moodEntries) {
      moodCounts.set(entry.mood, (moodCounts.get(entry.mood) ?? 0) + 1);
    }
    const topMoods = [...moodCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    lines.push('');
    lines.push('Most common moods: ' + topMoods.map(([mood, count]) => `${mood} (${count})`).join(', '));
  }
  lines.push('');

  // Symptom summary
  lines.push('## Symptom Summary');
  const symptomLogs = db.query<{ name: string; count: number }>(
    `SELECT s.name, COUNT(*) as count FROM md_symptom_logs sl
     JOIN md_symptoms s ON s.id = sl.symptom_id
     WHERE sl.logged_at >= ? AND sl.logged_at <= ?
     GROUP BY s.name ORDER BY count DESC`,
    [from, to],
  );
  if (symptomLogs.length === 0) {
    lines.push('No symptoms logged in this period.');
  } else {
    lines.push('| Symptom | Occurrences |');
    lines.push('|---------|-------------|');
    for (const s of symptomLogs) {
      lines.push(`| ${s.name} | ${s.count} |`);
    }
  }
  lines.push('');

  // Correlation highlights
  lines.push('## Correlation Highlights');
  const activeMeds = db.query<{ id: string; name: string; created_at: string }>(
    `SELECT id, name, created_at FROM md_medications
     WHERE is_active = 1 AND created_at >= ? AND created_at <= ?`,
    [from, to],
  );
  if (activeMeds.length === 0) {
    lines.push('No new medications started during this period.');
  } else {
    for (const med of activeMeds) {
      const before = db.query<{ c: number; s: number }>(
        `SELECT COUNT(*) as c,
                SUM(CASE WHEN pleasantness = 'pleasant' THEN 1 WHEN pleasantness = 'unpleasant' THEN -1 ELSE 0 END) as s
         FROM md_mood_entries WHERE recorded_at < ?`,
        [med.created_at],
      );
      const after = db.query<{ c: number; s: number }>(
        `SELECT COUNT(*) as c,
                SUM(CASE WHEN pleasantness = 'pleasant' THEN 1 WHEN pleasantness = 'unpleasant' THEN -1 ELSE 0 END) as s
         FROM md_mood_entries WHERE recorded_at >= ?`,
        [med.created_at],
      );
      if (before[0].c > 0 && after[0].c > 0) {
        const beforeAvg = before[0].s / before[0].c;
        const afterAvg = after[0].s / after[0].c;
        const diff = afterAvg - beforeAvg;
        const direction = diff > 0.1 ? 'improved' : diff < -0.1 ? 'declined' : 'remained stable';
        lines.push(`- **${med.name}** (started ${med.created_at.slice(0, 10)}): Mood ${direction}`);
      }
    }
  }
  lines.push('');

  lines.push('---');
  lines.push('*Generated by MyMeds. All data stored locally on your device.*');

  return lines.join('\n');
}

/**
 * Generate a therapy report with more detailed mood/activity data.
 */
export function generateTherapyReport(
  db: DatabaseAdapter,
  from: string,
  to: string,
): string {
  // Start with the doctor report
  let report = generateDoctorReport(db, from, to);

  // Add detailed mood entries
  const detailedSection: string[] = [];
  detailedSection.push('');
  detailedSection.push('## Detailed Mood Log');

  const entries = db.query<{
    mood: string; energy_level: string; pleasantness: string;
    intensity: number; notes: string; recorded_at: string; id: string;
  }>(
    `SELECT id, mood, energy_level, pleasantness, intensity, notes, recorded_at
     FROM md_mood_entries WHERE recorded_at >= ? AND recorded_at <= ?
     ORDER BY recorded_at ASC
     LIMIT 500`,
    [from, to],
  );

  if (entries.length === 0) {
    detailedSection.push('No mood entries in this period.');
  } else {
    // Batch-load all activities for these entries to avoid N+1
    const entryIds = entries.map((e) => e.id);
    const placeholders = entryIds.map(() => '?').join(',');
    const allActivities = entryIds.length > 0
      ? db.query<{ mood_entry_id: string; activity: string }>(
          `SELECT mood_entry_id, activity FROM md_mood_activities WHERE mood_entry_id IN (${placeholders})`,
          entryIds,
        )
      : [];
    const activityMap = new Map<string, string[]>();
    for (const a of allActivities) {
      const list = activityMap.get(a.mood_entry_id) ?? [];
      list.push(a.activity);
      activityMap.set(a.mood_entry_id, list);
    }

    for (const entry of entries) {
      detailedSection.push(`### ${entry.recorded_at.slice(0, 10)} at ${entry.recorded_at.slice(11, 16)}`);
      detailedSection.push(`- Mood: **${entry.mood}** (${entry.energy_level} energy, ${entry.pleasantness})`);
      detailedSection.push(`- Intensity: ${entry.intensity}/5`);
      if (entry.notes) {
        detailedSection.push(`- Notes: ${entry.notes}`);
      }

      const activities = activityMap.get(entry.id);
      if (activities && activities.length > 0) {
        detailedSection.push(`- Activities: ${activities.join(', ')}`);
      }
      detailedSection.push('');
    }
  }

  // Insert before the footer
  report = report.replace('---\n*Generated by MyMeds', detailedSection.join('\n') + '\n---\n*Generated by MyMeds');

  return report;
}
